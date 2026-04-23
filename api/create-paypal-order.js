import {
  getPayPalCurrencyForDisplayCurrency,
  getPlanPricingForCountry,
  isZeroDecimalCurrency,
  normalizeCountryCode,
} from "../lib/pricing.js";

function getCountryCode(req, body) {
  const headerCountry =
    req.headers["x-vercel-ip-country"] ||
    req.headers["X-Vercel-IP-Country"];

  if (headerCountry) {
    return normalizeCountryCode(headerCountry);
  }

  return normalizeCountryCode(body.country_code || body.country || "US");
}

const APPROX_USD_RATES = {
  AED: 0.2723,
  SAR: 0.2666,
  QAR: 0.2747,
  INR: 0.012,
  PKR: 0.0036,
  IDR: 0.000061,
  VND: 0.000039,
  TRY: 0.031,
  ZAR: 0.053,
  NGN: 0.00065,
  EGP: 0.020,
  COP: 0.00025,
  PEN: 0.27,
  BDT: 0.0091,
  CLP: 0.001,
  RON: 0.22,
  MYR: 0.21,
};

function getApproxUsdAmount(amount, currency) {
  const rate = APPROX_USD_RATES[currency];

  if (!rate) {
    return Number(Number(amount).toFixed(2));
  }

  return Number((Number(amount) * rate).toFixed(2));
}

function buildInvoiceId(pricing, iqSession) {
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return `${pricing.planId}__${pricing.tier}__${pricing.currency}__${pricing.price}__${pricing.countryCode}__${iqSession}__${uniqueSuffix}`.slice(0, 127);
}

function buildCreateOrderDebugPayload(order, pricing, chargeCurrency, chargePrice) {
  return {
    name: order?.name || null,
    message: order?.message || null,
    debug_id: order?.debug_id || null,
    details: Array.isArray(order?.details) ? order.details : [],
    countryCode: pricing.countryCode,
    pricingTier: pricing.tier,
    planId: pricing.planId,
    displayCurrency: pricing.currency,
    displayPrice: pricing.price,
    chargeCurrency,
    chargePrice,
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://iqdemie.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

  if (!PAYPAL_CLIENT || !PAYPAL_SECRET) {
    console.error("Missing PayPal credentials");
    return res.status(500).json({ error: "PayPal config missing" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { iq_session, plan_id } = body;

    if (!iq_session || !plan_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const countryCode = getCountryCode(req, body);
    const pricing = getPlanPricingForCountry(countryCode, plan_id);

    const chargeCurrency = getPayPalCurrencyForDisplayCurrency(pricing.currency);

    let valueToSend;
    if (chargeCurrency === pricing.currency) {
      valueToSend = isZeroDecimalCurrency(chargeCurrency)
        ? String(Math.round(Number(pricing.price)))
        : Number(Number(pricing.price).toFixed(2)).toString();
    } else {
      valueToSend = getApproxUsdAmount(pricing.price, pricing.currency).toString();
    }

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

    if (!tokenData || !tokenData.access_token) {
      console.error("PAYPAL TOKEN ERROR", tokenData);
      return res.status(500).json({ error: "PayPal auth failed", detail: tokenData });
    }

    const accessToken = tokenData.access_token;
    const paypalRequestId = `iqdemie-${pricing.planId}-${iq_session}-${Date.now()}`.slice(0, 108);

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": paypalRequestId,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: chargeCurrency,
              value: String(valueToSend),
            },
            custom_id: iq_session,
            invoice_id: buildInvoiceId(pricing, iq_session),
            description: pricing.planName,
          },
        ],
        application_context: {
          brand_name: "IQDemie",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await orderRes.json();

    if (!orderRes.ok || !order || !order.id) {
      console.error("PAYPAL ORDER ERROR:", order);
      return res.status(orderRes.status || 400).json({
        error: "PayPal create order failed",
        paypal: buildCreateOrderDebugPayload(order, pricing, chargeCurrency, Number(valueToSend)),
      });
    }

    return res.status(200).json({
      ...order,
      pricing: {
        countryCode: pricing.countryCode,
        tier: pricing.tier,
        planId: pricing.planId,
        planName: pricing.planName,
        displayCurrency: pricing.currency,
        displayPrice: pricing.price,
        chargeCurrency,
        chargePrice: Number(valueToSend),
      },
    });
  } catch (err) {
    console.error("PayPal create order exception:", err);
    return res.status(500).json({
      error: "PayPal create order exception",
      detail: String(err),
    });
  }
}
