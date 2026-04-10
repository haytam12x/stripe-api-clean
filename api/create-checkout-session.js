import Stripe from "stripe";
import {
  getPlanPricingForCountry,
  isZeroDecimalCurrency,
  normalizeCountryCode,
} from "../lib/pricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getCountryCode(req, body) {
  const headerCountry =
    req.headers["x-vercel-ip-country"] ||
    req.headers["X-Vercel-IP-Country"];

  if (headerCountry) {
    return normalizeCountryCode(headerCountry);
  }

  return normalizeCountryCode(body.country_code || body.country || "US");
}

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

    const { iq_session, plan_id } = body;

    if (!iq_session || !plan_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const countryCode = getCountryCode(req, body);
    const pricing = getPlanPricingForCountry(countryCode, plan_id);

    const unitAmount = isZeroDecimalCurrency(pricing.currency)
      ? Math.round(Number(pricing.price))
      : Math.round(Number(pricing.price) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: pricing.currency.toLowerCase(),
            product_data: {
              name: pricing.planName,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://iqdemie.com/payment-success?iq_session=${iq_session}`,
      cancel_url: `https://iqdemie.com/checkout?iq_session=${iq_session}`,
      metadata: {
        iq_session: iq_session,
        plan_id: pricing.planId,
        plan_name: pricing.planName,
        pricing_tier: pricing.tier,
        display_currency: pricing.currency,
        display_price: String(pricing.price),
        country_code: pricing.countryCode,
        payment_provider: "stripe",
      },
    });

    return res.status(200).json({
      url: session.url,
      pricing: {
        countryCode: pricing.countryCode,
        tier: pricing.tier,
        currency: pricing.currency,
        planId: pricing.planId,
        planName: pricing.planName,
        price: pricing.price,
      },
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
