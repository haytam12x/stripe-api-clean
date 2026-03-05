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

  // core part inside /api/create-paypal-order
const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
const amount = String(body.amount || body.value || '0.00');
const currency = (body.currency || 'USD').toUpperCase();

// then use amount and currency to create the PayPal order:
const orderRes = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
  method:"POST",
  headers: { Authorization: `Bearer ${accessToken}`, "Content-Type":"application/json" },
  body: JSON.stringify({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: currency, value: String(amount) } }]
  })
});

  const order = await orderRes.json()

if (!order || !order.id) {
  console.log("PAYPAL ORDER ERROR:", order)
  return res.status(400).json({ error: "PayPal create order failed", detail: order })
}

return res.status(200).json(order)
}
