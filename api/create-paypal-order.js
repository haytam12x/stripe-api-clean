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
      const usdPrice = pricing.planId === "basic"
        ? 2.99
        : pricing.planId === "full"
          ? 5.99
          : 19.99;

      valueToSend = Number(usdPrice.toFixed(2)).toString();
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");

    const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
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

    const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
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

    if (!order || !order.id) {
      console.error("PAYPAL ORDER ERROR:", order);
      return res.status(400).json({ error: "PayPal create order failed", detail: order });
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

