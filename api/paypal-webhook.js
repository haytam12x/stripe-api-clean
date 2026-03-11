import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyPayPalWebhook(req, body) {
  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

  const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const verifyRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: body,
    }),
  });

  const verifyData = await verifyRes.json();
  return verifyData.verification_status === "SUCCESS";
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rawBody = await getRawBody(req);
  const bodyText = rawBody.toString("utf8");
  const body = JSON.parse(bodyText);

  const isValid = await verifyPayPalWebhook(req, body);
  if (!isValid) {
    console.error("PayPal webhook verification failed");
    return res.status(400).json({ error: "Webhook verification failed" });
  }

  if (body.event_type === "PAYMENT.CAPTURE.COMPLETED" || body.event_type === "CHECKOUT.ORDER.APPROVED") {
    const iq_session = body.resource?.custom_id || 
                       body.resource?.purchase_units?.[0]?.custom_id;

    if (!iq_session) {
      console.error("No iq_session in PayPal webhook");
      return res.status(400).json({ error: "Missing iq_session" });
    }

    const price = body.resource?.amount?.value ? parseFloat(body.resource.amount.value) : null;
const currency = body.resource?.amount?.currency_code ? body.resource.amount.currency_code.toUpperCase() : null;

const { error } = await supabase
  .from("results")
  .update({ paid: true, price: price, currency: currency })
  .eq("session_id", iq_session);

if (error) {
  console.error("Supabase update failed:", error);
  return res.status(500).json({ error: "Database update failed" });
}

console.log("PayPal payment confirmed for session:", iq_session, "amount:", price, currency);
  }

  return res.status(200).json({ received: true });
}
