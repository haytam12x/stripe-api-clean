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

  const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
  const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com";

  if (!PAYPAL_CLIENT || !PAYPAL_SECRET) {
    console.error("Missing PayPal credentials");
    return res.status(500).json({ error: "PayPal config missing" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { orderID } = body;

    if (!orderID) {
      return res.status(400).json({ error: "Missing orderID" });
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");

    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("PAYPAL TOKEN ERROR", tokenData);
      return res.status(500).json({ error: "PayPal auth failed", detail: tokenData });
    }

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const captureData = await captureRes.json();

    if (captureData.status !== "COMPLETED") {
      console.error("Capture failed:", captureData);
      return res.status(400).json({ error: "Capture failed", detail: captureData });
    }

    const purchaseUnit = captureData.purchase_units?.[0];
    const iq_session = purchaseUnit?.custom_id;
    const invoiceId = purchaseUnit?.invoice_id || "";

    if (!iq_session) {
      console.error("Missing iq_session in PayPal capture response", captureData);
      return res.status(400).json({ error: "Missing iq_session in PayPal order" });
    }

    const parts = String(invoiceId).split("__");
    const planId = parts[0] || null;
    const pricingTier = parts[1] || null;
    const displayCurrency = parts[2] || null;
    const displayPrice = parts[3] ? parseFloat(parts[3]) : null;
    const countryCode = parts[4] || null;

    const planName =
      planId === "basic"
        ? "Basic Results"
        : planId === "full"
          ? "Full Results"
          : planId === "professional"
            ? "Full Professional Results"
            : null;

    const capture = purchaseUnit?.payments?.captures?.[0];
    const chargedPrice = capture ? parseFloat(capture.amount.value) : null;
    const chargedCurrency = capture ? String(capture.amount.currency_code || "").toUpperCase() : null;

    if (chargedPrice === null || !chargedCurrency) {
      console.error("Missing amount or currency in PayPal capture response", captureData);
      return res.status(400).json({ error: "Missing amount or currency in PayPal capture" });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("results")
      .update({
        paid: true,
        price: chargedPrice,
        currency: chargedCurrency,
        plan_id: planId,
        plan_name: planName,
        pricing_tier: pricingTier,
        display_currency: displayCurrency,
        display_price: displayPrice,
        country_code: countryCode,
        payment_provider: "paypal",
      })
      .eq("session_id", iq_session);

    if (error) {
      console.error("Supabase update failed:", error);
      return res.status(500).json({ error: "Database update failed" });
    }

    console.log(
      "PayPal payment confirmed for session:",
      iq_session,
      "amount:",
      chargedPrice,
      chargedCurrency
    );

    return res.status(200).json({ status: "COMPLETED" });
  } catch (err) {
    console.error("PayPal capture exception:", err);
    return res.status(500).json({
      error: "PayPal capture exception",
      detail: String(err),
    });
  }
}

