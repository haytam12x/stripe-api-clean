export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { orderID, iq_session } = body;

  const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");
  const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const captureData = await captureRes.json();

  if (captureData.status === "COMPLETED") {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    await supabase.from("results").update({ paid: true }).eq("session_id", iq_session);
    return res.status(200).json({ status: "COMPLETED" });
  } else {
    console.error("Capture failed:", captureData);
    return res.status(400).json({ error: "Capture failed", detail: captureData });
  }
}
