import Stripe from "stripe";
import {
  getPlanPricingForCountry,
  isZeroDecimalCurrency,
  normalizeCountryCode,
} from "../lib/pricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_ORIGINS = new Set([
  "https://iqdemie.com",
  "https://www.iqdemie.com",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://iqdemie.com";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function getCountryCode(req, body) {
  const headerCountry =
    req.headers["x-vercel-ip-country"] ||
    req.headers["X-Vercel-IP-Country"];

  if (headerCountry) {
    return normalizeCountryCode(headerCountry);
  }

  return normalizeCountryCode(body.country_code || body.country || "US");
}

function getSupabaseConfig() {
  return {
    url:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      "",
  };
}

async function patchResultsRow(iqSession, payload) {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    console.warn(
      "Supabase service role env vars are missing. Skipping checkout-session persistence."
    );
    return;
  }

  const endpoint =
    url.replace(/\/$/, "") +
    `/rest/v1/results?session_id=eq.${encodeURIComponent(iqSession)}`;

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase PATCH failed with ${response.status}`);
  }
}

async function persistPendingCheckout({
  iqSession,
  checkoutSessionId,
  pricing,
  countryName,
}) {
  const basePayload = {
    plan_id: pricing.planId,
    plan_name: pricing.planName,
    pricing_tier: pricing.tier,
    price: Number(pricing.price),
    currency: pricing.currency,
    display_currency: pricing.currency,
    display_price: String(pricing.price),
    country_code: pricing.countryCode,
    payment_provider: "stripe",
  };

  if (countryName) {
    basePayload.country = countryName;
  }

  try {
    await patchResultsRow(iqSession, {
      ...basePayload,
      stripe_checkout_session_id: checkoutSessionId,
    });
  } catch (error) {
    console.error(
      "Failed to persist stripe_checkout_session_id. Retrying without that field:",
      error
    );

    try {
      await patchResultsRow(iqSession, basePayload);
    } catch (retryError) {
      console.error(
        "Failed to persist pending Stripe checkout context:",
        retryError
      );
    }
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY");
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  try {
    const body = parseRequestBody(req.body);

    if (!body) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const iqSession = String(body.iq_session || "").trim();
    const requestedPlanId = String(body.plan_id || "").trim().toLowerCase();
    const paymentMethodHint = String(body.payment_method_hint || "card")
      .trim()
      .toLowerCase();
    const countryName = String(body.country || "").trim();

    if (!iqSession || !requestedPlanId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const countryCode = getCountryCode(req, body);
    const pricing = getPlanPricingForCountry(countryCode, requestedPlanId);

    const numericPrice = Number(pricing.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      console.error("Invalid plan pricing:", pricing);
      return res.status(400).json({ error: "Invalid pricing" });
    }

    const unitAmount = isZeroDecimalCurrency(pricing.currency)
      ? Math.round(numericPrice)
      : Math.round(numericPrice * 100);

    const metadata = {
      iq_session: iqSession,
      plan_id: pricing.planId,
      plan_name: pricing.planName,
      pricing_tier: pricing.tier,
      display_currency: pricing.currency,
      display_price: String(pricing.price),
      country_code: pricing.countryCode,
      payment_provider: "stripe",
      payment_method_hint: paymentMethodHint,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: iqSession,
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
      success_url: `https://iqdemie.com/payment-success?iq_session=${encodeURIComponent(
        iqSession
      )}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://iqdemie.com/checkout?iq_session=${encodeURIComponent(
        iqSession
      )}`,
      metadata,
      payment_intent_data: {
        description: `${pricing.planName} | ${iqSession}`,
        metadata,
      },
    });

    await persistPendingCheckout({
      iqSession,
      checkoutSessionId: session.id,
      pricing,
      countryName,
    });

    return res.status(200).json({
      url: session.url,
      session_id: session.id,
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
    console.error("Stripe create-checkout-session error:", error);

    const message =
      error?.type === "StripeInvalidRequestError"
        ? error.message
        : "Internal Server Error";

    return res.status(500).json({ error: message });
  }
}
