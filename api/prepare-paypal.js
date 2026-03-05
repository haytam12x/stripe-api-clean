// /api/prepare-paypal

const FORCE_USD = [
"INR","PHP","VND","IDR","NGN",
"PKR","BDT","EGP","BRL","ARS",
"THB","TRY","ZAR","KZT","RUB","KRW"
];

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const rawPrice = Number(body.price || 0);
    const displayCurrency = (body.display_currency || body.currency || 'USD').toUpperCase();

    // PayPal official supported list:
    const PAYPAL_SUPPORTED = ["AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
      "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD","SEK","CHF","THB","USD","KRW"];

    // In-country-only per PayPal:
    const IN_COUNTRY_ONLY = ["CNY","MYR"];

    // Fallback conversion table (approx USD rates) — covers your currencies list
    const CONVERT_TO_USD = {
      INR: 0.010, PHP: 0.018, VND: 0.000043, IDR: 0.000067, NGN: 0.00065,
      PKR: 0.0036, BDT: 0.0091, EGP: 0.020, ZAR: 0.053, MXN: 0.060,
      BRL: 0.19, ARS: 0.00075, THB: 0.028, TRY: 0.031, SAR: 0.27,
      KZT: 0.0022, RUB: 0.011, KRW: 0.00075, ISK: 0.0073
    };

    // Zero-decimal currencies list (PayPal expects integer amounts)
    const ZERO_DECIMALS = ["JPY"];

    let finalCurrency = displayCurrency;
    let finalAmount = Number(rawPrice.toFixed(2));

    // If currency is PayPal-supported and not in-country-only -> use as-is
    if (
PAYPAL_SUPPORTED.includes(displayCurrency) &&
!IN_COUNTRY_ONLY.includes(displayCurrency) &&
!FORCE_USD.includes(displayCurrency)
) {
      finalCurrency = displayCurrency;
      finalAmount = ZERO_DECIMALS.includes(displayCurrency) ? Math.round(rawPrice) : Number(rawPrice.toFixed(2));
    } else {
      // fallback: convert to USD (server authoritative)
      if (displayCurrency === "USD") {
        finalCurrency = "USD";
        finalAmount = Number(rawPrice.toFixed(2));
      } else {
        try {
          // live conversion
          const q = `https://api.exchangerate.host/convert?from=${encodeURIComponent(displayCurrency)}&to=USD&amount=${encodeURIComponent(String(rawPrice))}`;
          const r = await fetch(q);
          const json = await r.json();
          if (json && typeof json.result === 'number') {
            finalCurrency = "USD";
            finalAmount = Number(Number(json.result).toFixed(2));
          } else if (CONVERT_TO_USD[displayCurrency]) {
            finalCurrency = "USD";
            finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
          } else {
            // Last-resort: keep numeric but set USD to avoid PayPal rejection (rare)
            finalCurrency = "USD";
            finalAmount = Number(rawPrice.toFixed(2));
          }
        } catch (err) {
          // API failed -> fallback table
          if (CONVERT_TO_USD[displayCurrency]) {
            finalCurrency = "USD";
            finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
          } else {
            finalCurrency = "USD";
            finalAmount = Number(rawPrice.toFixed(2));
          }
        }
      }
    }

    // If finalCurrency is zero-decimal, ensure integer
    if (ZERO_DECIMALS.includes(finalCurrency)) {
      finalAmount = Math.round(finalAmount);
    }

    console.log("prepare-paypal:", { displayCurrency, rawPrice, finalCurrency, finalAmount });

    return res.status(200).json({ finalCurrency, finalAmount });
  } catch (err) {
    console.error("prepare-paypal error:", err);
    return res.status(500).json({ error: "prepare-paypal failure", detail: String(err) });
  }
}
