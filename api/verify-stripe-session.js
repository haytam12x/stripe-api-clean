import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isZeroDecimalCurrency } from "../lib/pricing.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

const ALLOWED_ORIGINS = new Set([
  "https://iqdemie.com",
  "https://www.iqdemie.com",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://iqdemie.com";

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === "object") return body;

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function pickFirstNonEmpty() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = String(arguments[i] || "").trim();
    if (value) return value;
  }
  return "";
}

async function getResultsRow(iqSession) {
  if (!iqSession) return { data: null, error: null };

  return supabase
    .from("results")
    .select(
      [
        "session_id",
        "paid",
        "plan_id",
        "plan_name",
        "pricing_tier",
        "display_currency",
        "display_price",
        "country_code",
        "payment_provider",
        "details_completed",
        "stripe_checkout_session_id",
      ].join(",")
    )
    .eq("session_id", iqSession)
    .maybeSingle();
}

function buildAlreadyPaidResponse(row, iqSession, sessionId) {
  return {
    paid: true,
    iq_session: iqSession,
    session_id: sessionId || row?.stripe_checkout_session_id || null,
    plan_id: row?.plan_id || null,
    plan_name: row?.plan_name || null,
    details_completed: row?.details_completed === true,
  };
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY");
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  if (!supabase) {
    console.error("Missing Supabase env vars");
    return res.status(500).json({ error: "Database is not configured" });
  }

  try {
    const body = parseRequestBody(req.body);

    if (!body) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    let sessionId = String(body.session_id || "").trim();
    const fallbackIqSession = String(body.iq_session || "").trim();

    if (!sessionId && !fallbackIqSession) {
      return res.status(400).json({ error: "Missing session_id or iq_session" });
    }

    let existingRow = null;

    if (fallbackIqSession) {
      const { data, error } = await getResultsRow(fallbackIqSession);

      if (error) {
        console.error("Failed to load results row before verify:", error);
        return res.status(500).json({ error: "Database lookup failed" });
      }

      existingRow = data || null;

      if (existingRow && existingRow.paid === true && !sessionId) {
        return res
          .status(200)
          .json(buildAlreadyPaidResponse(existingRow, fallbackIqSession, ""));
      }

      if (!sessionId) {
        sessionId = String(existingRow?.stripe_checkout_session_id || "").trim();
      }

      if (!sessionId) {
        return res.status(409).json({
          paid: false,
          pending: true,
          iq_session: fallbackIqSession,
          reason: "missing_session_id",
        });
      }
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error("Stripe retrieve session failed:", error);

      if (error?.type === "StripeInvalidRequestError") {
        return res.status(404).json({ error: "Checkout session not found" });
      }

      return res.status(500).json({ error: "Could not verify checkout session" });
    }

    const iqSession = pickFirstNonEmpty(
      session.metadata?.iq_session,
      session.client_reference_id,
      fallbackIqSession
    );

    if (!iqSession) {
      return res.status(400).json({ error: "Missing iq_session" });
    }

    if (!existingRow || existingRow.session_id !== iqSession) {
      const { data, error } = await getResultsRow(iqSession);

      if (error) {
        console.error("Failed to load results row after Stripe retrieve:", error);
        return res.status(500).json({ error: "Database lookup failed" });
      }

      existingRow = data || null;
    }

    if (existingRow && existingRow.paid === true) {
      return res
        .status(200)
        .json(buildAlreadyPaidResponse(existingRow, iqSession, session.id));
    }

    const isPaid =
      session.payment_status === "paid" || session.status === "complete";

    if (!isPaid) {
      return res.status(409).json({
        paid: false,
        pending: true,
        iq_session: iqSession,
        session_id: session.id,
        status: session.status || null,
        payment_status: session.payment_status || null,
      });
    }

    const chargedCurrency = session.currency
      ? String(session.currency).toUpperCase()
      : "USD";

    const amountTotal = Number(session.amount_total || 0);
    const chargedPrice = isZeroDecimalCurrency(chargedCurrency)
      ? amountTotal
      : amountTotal / 100;

    const displayPriceRaw = pickFirstNonEmpty(
      session.metadata?.display_price,
      existingRow?.display_price
    );
    const parsedDisplayPrice = displayPriceRaw
      ? Number(displayPriceRaw)
      : chargedPrice;

    const payload = {
      paid: true,
      price: chargedPrice,
      currency: chargedCurrency,
      payment_provider: "stripe",
      stripe_checkout_session_id: session.id,
      plan_id: pickFirstNonEmpty(session.metadata?.plan_id, existingRow?.plan_id) || null,
      plan_name:
        pickFirstNonEmpty(session.metadata?.plan_name, existingRow?.plan_name) || null,
      pricing_tier:
        pickFirstNonEmpty(
          session.metadata?.pricing_tier,
          existingRow?.pricing_tier
        ) || null,
      display_currency:
        pickFirstNonEmpty(
          session.metadata?.display_currency,
          existingRow?.display_currency,
          chargedCurrency
        ) || chargedCurrency,
      display_price: Number.isFinite(parsedDisplayPrice)
        ? parsedDisplayPrice
        : chargedPrice,
      country_code:
        pickFirstNonEmpty(
          session.metadata?.country_code,
          existingRow?.country_code
        ) || null,
    };

    const { data: updatedRow, error: updateError } = await supabase
      .from("results")
      .update(payload)
      .eq("session_id", iqSession)
      .select("session_id, plan_id, plan_name, details_completed, stripe_checkout_session_id")
      .maybeSingle();

    if (updateError) {
      console.error("Supabase verify update failed:", updateError);
      return res.status(500).json({ error: "Database update failed" });
    }

    if (!updatedRow) {
      return res.status(404).json({ error: "Result row not found" });
    }

    return res.status(200).json({
      paid: true,
      iq_session: iqSession,
      session_id: session.id,
      plan_id: updatedRow.plan_id || payload.plan_id,
      plan_name: updatedRow.plan_name || payload.plan_name,
      details_completed: updatedRow.details_completed === true,
      status: session.status || null,
      payment_status: session.payment_status || null,
    });
  } catch (error) {
    console.error("Stripe verify error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
