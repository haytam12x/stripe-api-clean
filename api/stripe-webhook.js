import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isZeroDecimalCurrency } from "../lib/pricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const iq_session =
      session.metadata?.iq_session ||
      session.client_reference_id;

    if (!iq_session) {
      console.error("No iq_session found in Stripe event");
      return res.status(400).json({ error: "Missing iq_session" });
    }

    const chargedCurrency = session.currency
      ? String(session.currency).toUpperCase()
      : "USD";

    const amountTotal = session.amount_total || 0;
    const chargedPrice = isZeroDecimalCurrency(chargedCurrency)
      ? amountTotal
      : amountTotal / 100;

    const { error } = await supabase
      .from("results")
      .update({
        paid: true,
        price: chargedPrice,
        currency: chargedCurrency,
        plan_id: session.metadata?.plan_id || null,
        plan_name: session.metadata?.plan_name || null,
        pricing_tier: session.metadata?.pricing_tier || null,
        display_currency: session.metadata?.display_currency || null,
        display_price: session.metadata?.display_price
          ? parseFloat(session.metadata.display_price)
          : null,
        country_code: session.metadata?.country_code || null,
        payment_provider: session.metadata?.payment_provider || "stripe",
      })
      .eq("session_id", iq_session);

    if (error) {
      console.error("Supabase update failed:", error);
      return res.status(500).json({ error: "Database update failed" });
    }

    console.log(
      "Payment confirmed for session:",
      iq_session,
      "amount:",
      chargedPrice,
      chargedCurrency
    );
  }

  return res.status(200).json({ received: true });
}
