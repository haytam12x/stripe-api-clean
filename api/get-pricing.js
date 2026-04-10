import {
  getPayPalCurrencyForDisplayCurrency,
  getPricesForCountry,
  normalizeCountryCode,
} from "../lib/pricing.js";

function getCountryCode(req) {
  const headerCountry =
    req.headers["x-vercel-ip-country"] ||
    req.headers["X-Vercel-IP-Country"];

  if (headerCountry) {
    return normalizeCountryCode(headerCountry);
  }

  return "US";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://iqdemie.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const countryCode = getCountryCode(req);
    const pricing = getPricesForCountry(countryCode);
    const paypalCurrency = getPayPalCurrencyForDisplayCurrency(pricing.currency);

    return res.status(200).json({
      countryCode: pricing.countryCode,
      tier: pricing.tier,
      currency: pricing.currency,
      paypalCurrency: paypalCurrency,
      paypalUsesDisplayCurrency: paypalCurrency === pricing.currency,
      prices: {
        basic: pricing.prices.basic,
        full: pricing.prices.full,
        professional: pricing.prices.professional,
      },
    });
  } catch (error) {
    console.error("get-pricing error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
