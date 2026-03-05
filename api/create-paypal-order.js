export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET

  const auth = Buffer.from(
    PAYPAL_CLIENT + ":" + PAYPAL_SECRET
  ).toString("base64")

  const tokenRes = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  )

  const tokenData = await tokenRes.json()

  if(!tokenData.access_token){
    console.log("PAYPAL TOKEN ERROR:", tokenData)
    return res.status(500).json({error:"PayPal auth failed"})
  }

  const accessToken = tokenData.access_token

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  let currency = body.currency
let price = Number(body.price)

/*
PAYPAL SUPPORTED CURRENCIES
(source: PayPal docs)
*/
const PAYPAL_SUPPORTED = [
"AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
"JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","SGD",
"SEK","CHF","THB","USD"
]

/*
Currencies supported only in-country
Safer to convert unless your PayPal account
is registered in those countries
*/
const IN_COUNTRY_ONLY = ["BRL","CNY","MYR"]

/*
Currencies NOT supported by PayPal
(based on your pricing system)
These must be converted
*/
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
}

/*
If currency unsupported or risky
convert to USD
*/

if(CONVERT_TO_USD[currency]){
  price = Number((price * CONVERT_TO_USD[currency]).toFixed(2))
  currency = "USD"
}

/*
Also convert if PayPal doesn't support it
*/

if(!PAYPAL_SUPPORTED.includes(currency) || IN_COUNTRY_ONLY.includes(currency)){
  currency = "USD"
}

  const orderRes = await fetch(
    "https://api-m.sandbox.paypal.com/v2/checkout/orders",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: String(price)
            }
          }
        ]
      })
    }
  )

  const order = await orderRes.json()

  if (!order.id) {
    console.log("PAYPAL ORDER ERROR:", order)
    return res.status(400).json(order)
  }

  res.status(200).json(order)
}
