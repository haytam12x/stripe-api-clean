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
  const price = body.price
  let currency = body.currency

  /* PAYPAL UNSUPPORTED CURRENCIES FALLBACK */

  if(currency === "INR") currency = "USD"
  if(currency === "PKR") currency = "USD"
  if(currency === "BDT") currency = "USD"
  if(currency === "NGN") currency = "USD"
  if(currency === "VND") currency = "USD"
  if(currency === "IDR") currency = "USD"
  if(currency === "EGP") currency = "USD"

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
