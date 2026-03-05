export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  const rawPrice = Number(body.price || 0);
  const displayCurrency = (body.display_currency || "USD").toUpperCase();

  const PAYPAL_SUPPORTED = [
    "AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
    "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD",
    "SEK","CHF","THB","USD"
  ];

  const IN_COUNTRY_ONLY = ["BRL","CNY","MYR"];

  const CONVERT_TO_USD = {
    INR:0.012,
    SAR:0.27,
    KZT:0.0022,
    RUB:0.011,
    KRW:0.00075,
    ISK:0.0073,
    VND:0.000041,
    IDR:0.000064,
    NGN:0.00063,
    PKR:0.0036,
    BDT:0.0091,
    EGP:0.020,
    ZAR:0.053,
    ARS:0.0012,
    TRY:0.031
  };

  let finalCurrency = displayCurrency;
  let finalAmount = Number(rawPrice.toFixed(2));

  if(CONVERT_TO_USD[displayCurrency]){
    finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
    finalCurrency = "USD";
  }
  else if(!PAYPAL_SUPPORTED.includes(displayCurrency) || IN_COUNTRY_ONLY.includes(displayCurrency)){
    finalCurrency = "USD";

    if(CONVERT_TO_USD[displayCurrency]){
      finalAmount = Number((rawPrice * CONVERT_TO_USD[displayCurrency]).toFixed(2));
    } else {
      finalAmount = Number(rawPrice.toFixed(2));
    }
  }

  return res.status(200).json({
    finalCurrency,
    finalAmount
  });
}
