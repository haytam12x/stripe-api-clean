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

    // Official PayPal supported currencies
    const PAYPAL_SUPPORTED = ["AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
      "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD","SEK","CHF","THB","USD"];

    // in-country-only per PayPal
    const IN_COUNTRY_ONLY = ["BRL","CNY","MYR"];

    // fallback conversion table (used if live API fails)
    const CONVERT_TO_USD = {
      INR:0.012, SAR:0.27, KZT:0.0022, RUB:0.011, KRW:0.00075,
      ISK:0.0073, VND:0.000041, IDR:0.000064, NGN:0.00063,
      PKR:0.0036, BDT:0.0091, EGP:0.020, ZAR:0.053, ARS:0.0012,
      TRY:0.031, BRL:0.19  // added BRL to fix Brazil case
    };

    // Decide what we will return (server authoritative).
    let finalCurrency = displayCurrency;
    let finalAmount = Number(rawPrice.toFixed(2));

    // If displayCurrency is already PayPal-supported and not in-country-only => use it as-is
    if (PAYPAL_SUPPORTED.includes(displayCurrency) && !IN_COUNTRY_ONLY.includes(displayCurrency)) {
      finalCurrency = displayCurrency;
      finalAmount = Number(rawPrice.toFixed(2));
    } else {
      // Need to produce a PayPal-supported currency. We choose USD as fallback (you can use EUR if desired)
      // Try live conversion to USD via exchangerate.host; fallback to CONVERT_TO_USD table.
      try {
        // If displayCurrency already equals "USD" just use price
        if (displayCurrency === "USD") {
          finalCurrency = "USD";
          finalAmount = Number(rawPrice.toFixed(2));
        } else {
          // call exchangerate.host convert endpoint
          const q = `https://api.exchangerate.host/convert?from=${encodeURIComponent(displayCurrency)}&to=USD&amount=${encodeURIComponent(String(rawPrice))}`;
          const r = await fetch(q);
          const json = await r.json();
          if (json && (typeof json.result === 'number')) {
            finalCurrency = "USD";
            finalAmount = Number(Number(json.result).toFixed(2));
          } else {
            // If API didn't return a result, use fallback table if available
            if (CONVERT_TO_USD[displayCurrency]) {
              finalCurrency = "USD";
              finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
            } else {
              // Last resort: keep numeric and set USD (not ideal, but prevents PayPal rejection)
              finalCurrency = "USD";
              finalAmount = Number(rawPrice.toFixed(2));
            }
          }
        }
      } catch (err) {
        console.error("exchange API failed, using fallback table", err);
        if (CONVERT_TO_USD[displayCurrency]) {
          finalCurrency = "USD";
          finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
        } else {
          finalCurrency = "USD";
          finalAmount = Number(rawPrice.toFixed(2));
        }
      }
    }

    // Log for debugging
    console.log("prepare-paypal:", { displayCurrency, rawPrice, finalCurrency, finalAmount });

    return res.status(200).json({ finalCurrency, finalAmount });
  } catch (err) {
    console.error("prepare-paypal error:", err);
    return res.status(500).json({ error: "prepare-paypal failure", detail: String(err) });
  }
}
