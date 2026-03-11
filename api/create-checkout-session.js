import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://iqdemie.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const { amount, currency, iq_session } = req.body;
    if (!amount || !currency || !iq_session) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    let finalAmount = amount;
let finalCurrency = currency;

if (currency === "ISK") {
  finalAmount = "12.99";
  finalCurrency = "USD";
}

const unitAmount = finalCurrency === "JPY" || finalCurrency === "KRW"
  ? Math.round(Number(finalAmount))
  : Math.round(Number(finalAmount) * 100);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "cashapp"],
      line_items: [
        {
          price_data: {
            currency: finalCurrency.toLowerCase(),
            product_data: {
              name: "IQ Results & Certificate",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://iqdemie.com/payment-success?iq_session=${iq_session}`,
      cancel_url: `https://iqdemie.com/checkout?iq_session=${iq_session}`,
      metadata: {
        iq_session: iq_session
      }
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
