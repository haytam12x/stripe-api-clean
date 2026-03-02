import Stripe from "stripe";

export default async function handler(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { tier } = req.body;

  const prices = {
    premium: "price_1T6X5jDCY27ZjW0tY6tXDKVn",
    standard: "price_1T6XG3DCY27ZjW0tdwZWBLSF",
    basic: "price_1T6XZXDCY27ZjW0tFeuK9hzY"
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price: prices[tier],
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: "https://iqdemie.com/results?paid=true",
    cancel_url: "https://iqdemie.com/checkout",
  });

  res.status(200).json({ url: session.url });
}
