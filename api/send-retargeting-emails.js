import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BREVO_API_KEY = process.env.BREVO_API_KEY;

async function sendEmail(to, name, subject, htmlContent) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: "IQdemie", email: "contact@iqdemie.com" },
      to: [{ email: to, name: name || "there" }],
      subject,
      htmlContent
    })
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.headers["x-cron-secret"] !== "140823") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();

  const { data: users, error } = await supabase
    .from("results")
    .select("session_id, email, name, created_at, email_1_sent, email_2_sent, email_3_sent")
    .eq("completed", true)
    .eq("paid", false)
    .not("email", "is", null);

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;

  for (const user of users) {
    const checkoutUrl = `https://iqdemie.com/checkout?iq_session=${user.session_id}`;
    const name = user.name || "there";
    const hoursSince = (now - new Date(user.created_at)) / (1000 * 60 * 60);

    if (hoursSince >= 1 && !user.email_1_sent) {
      const ok = await sendEmail(
        user.email, name,
        "You forgot something… 🧠",
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <h2 style="color:#111827">Hi ${name}, your IQ results are waiting</h2>
          <p style="color:#6b7280;font-size:15px">You completed the IQdemie test but never unlocked your results.</p>
          <p style="color:#6b7280;font-size:15px">Your score, ranking, and certificate are ready — just one step away.</p>
          <a href="${checkoutUrl}" style="display:inline-block;margin-top:20px;padding:14px 28px;background:linear-gradient(135deg,#4F6AF0,#6C9FFF);color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">View My IQ Results →</a>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px">IQdemie · You're receiving this because you took our IQ test.</p>
        </div>`
      );
      if (ok) {
        await supabase.from("results").update({ email_1_sent: true }).eq("session_id", user.session_id);
        sent++;
      }
    }

    else if (hoursSince >= 24 && !user.email_2_sent) {
      const ok = await sendEmail(
        user.email, name,
        "50% off — your IQ results are still here 🎯",
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <h2 style="color:#111827">Still thinking about it, ${name}?</h2>
          <p style="color:#6b7280;font-size:15px">We're giving you <strong>50% off</strong> to unlock your IQ score and certificate today.</p>
          <a href="${checkoutUrl}&discount=50" style="display:inline-block;margin-top:20px;padding:14px 28px;background:linear-gradient(135deg,#f97316,#fb923c);color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">Claim 50% Off Now →</a>
          <p style="color:#9ca3af;font-size:13px;margin-top:16px">This offer expires in 48 hours.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px">IQdemie · You're receiving this because you took our IQ test.</p>
        </div>`
      );
      if (ok) {
        await supabase.from("results").update({ email_2_sent: true }).eq("session_id", user.session_id);
        sent++;
      }
    }

    else if (hoursSince >= 72 && !user.email_3_sent) {
      const ok = await sendEmail(
        user.email, name,
        "Last chance: unlock your IQ for $1.99 🔥",
        `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
          <h2 style="color:#111827">Final offer, ${name}</h2>
          <p style="color:#6b7280;font-size:15px">We don't want you to miss your results forever. So we're making you an offer we've never made before:</p>
          <p style="font-size:28px;font-weight:800;color:#4F6AF0;margin:16px 0">Unlock everything for just $1.99</p>
          <p style="color:#6b7280;font-size:15px">Your IQ score, full analysis, global ranking, and certificate — all for less than a coffee.</p>
          <a href="${checkoutUrl}&discount=crazy" style="display:inline-block;margin-top:20px;padding:14px 28px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">Yes, I want my results for $1.99 →</a>
          <p style="color:#9ca3af;font-size:13px;margin-top:16px">This is our final offer. After this, your session expires.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px">IQdemie · You're receiving this because you took our IQ test.</p>
        </div>`
      );
      if (ok) {
        await supabase.from("results").update({ email_3_sent: true }).eq("session_id", user.session_id);
        sent++;
      }
    }
  }

  return res.status(200).json({ processed: users.length, sent });
}
