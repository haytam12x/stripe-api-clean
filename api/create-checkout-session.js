import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

  // ===============================
  // CORS CONFIG
  // ===============================
  res.setHeader("Access-Control-Allow-Origin", "https://iqdemie.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {

    const { tier } = req.body;

    const prices = {
      premium: "price_1T6X5jDCY27ZjwOtY6tXDKVn",
      standard: "price_1T6XG3DCY27ZjwOtdwZWBLSP",
      basic: "price_1T6XZXDCY27ZjwOtFeuK9hzY"
    };

    if (!prices[tier]) {
      return res.status(400).json({ error: "Invalid tier" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: prices[tier],
          quantity: 1,
        },
      ],
      mode: "payment",
     success_url: https://iqdemie.com/results?paid=true&iq_session=${req.body.iq_session},
      cancel_url: "https://iqdemie.com/checkout",
    });

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
