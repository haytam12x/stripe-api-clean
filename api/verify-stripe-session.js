import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isZeroDecimalCurrency } from "../lib/pricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://iqdemie.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const sessionId = String(body.session_id || "").trim();
    const fallbackIqSession = String(body.iq_session || "").trim();

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const iqSession =
      session.metadata?.iq_session ||
      session.client_reference_id ||
      fallbackIqSession;

    if (!iqSession) {
      return res.status(400).json({ error: "Missing iq_session" });
    }

    const chargedCurrency = session.currency
      ? String(session.currency).toUpperCase()
      : "USD";

    const amountTotal = session.amount_total || 0;
    const chargedPrice = isZeroDecimalCurrency(chargedCurrency)
      ? amountTotal
      : amountTotal / 100;

    const isPaid = session.payment_status === "paid" || session.status === "complete";

    if (!isPaid) {
      return res.status(409).json({
        paid: false,
        status: session.status || null,
        payment_status: session.payment_status || null,
      });
    }

    const payload = {
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
    };

    const { error } = await supabase
      .from("results")
      .update(payload)
      .eq("session_id", iqSession);

    if (error) {
      console.error("Supabase verify update failed:", error);
      return res.status(500).json({ error: "Database update failed" });
    }

    return res.status(200).json({
      paid: true,
      iq_session: iqSession,
      session_id: session.id,
      plan_id: payload.plan_id,
      plan_name: payload.plan_name,
    });
  } catch (error) {
    console.error("Stripe verify error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
