// /api/prepare-paypal
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
      "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD","SEK","CHF","THB","USD"];

    // In-country only per PayPal:
    const IN_COUNTRY_ONLY = ["BRL","CNY","MYR"];

    // Fallback conversion table (approx USD rates) — covers your full list
    // NOTE: these are fallback approximations. Use exchange API in prod.
    const CONVERT_TO_USD = {
      INR: 0.0124,   // 1 INR ≈ 0.0124 USD
      PHP: 0.018,    // 1 PHP ≈ 0.018 USD
      VND: 0.000043, // 1 VND ≈ 0.000043 USD
      IDR: 0.000067, // 1 IDR ≈ 0.000067 USD
      NGN: 0.0025,   // 1 NGN ≈ 0.0025 USD (approx)
      PKR: 0.0036,
      BDT: 0.0091,
      EGP: 0.020,
      ZAR: 0.053,
      MXN: 0.052,
      BRL: 0.19,
      ARS: 0.005,    // very approximate
      THB: 0.028,
      TRY: 0.031,
      SAR: 0.27,
      KZT: 0.0022,
      RUB: 0.011,
      KRW: 0.00075,
      ISK: 0.0073,
      // add others you expect to see...
    };

    let finalCurrency = displayCurrency;
    let finalAmount = Number(rawPrice.toFixed(2));

    // If currency is PayPal-supported and not in-country-only -> use it directly
    if (PAYPAL_SUPPORTED.includes(displayCurrency) && !IN_COUNTRY_ONLY.includes(displayCurrency)) {
      finalCurrency = displayCurrency;
      finalAmount = Number(rawPrice.toFixed(2));
    } else {
      // Need to produce PayPal-supported currency; choose USD fallback
      if (displayCurrency === "USD") {
        finalCurrency = "USD";
        finalAmount = Number(rawPrice.toFixed(2));
      } else {
        // Try live conversion (preferred)
        try {
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
            finalCurrency = "USD";
            finalAmount = Number(rawPrice.toFixed(2)); // last-resort
          }
        } catch (err) {
          // fallback table if API fails
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

    console.log("prepare-paypal:", { displayCurrency, rawPrice, finalCurrency, finalAmount });

    return res.status(200).json({ finalCurrency, finalAmount });
  } catch (err) {
    console.error("prepare-paypal error:", err);
    return res.status(500).json({ error: "prepare-paypal failure", detail: String(err) });
  }
}
