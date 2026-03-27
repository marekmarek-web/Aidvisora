import { NextResponse } from "next/server";
import { cronAuthResponse } from "@/lib/cron-auth";
import { resolveResendReplyTo } from "@/lib/email/resend-reply-to";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nepřipomínat události starší než tento okno (minuty), aby se po výpadku cronu neposlal dávný spam. */
const GRACE_PAST_MIN = 120;

/**
 * Kalendářní připomenutí pro poradce: push (FCM) + volitelně e-mail (Resend).
 * Spouštět z Vercel Cron každých pár minut.
 *
 * E-mail: vypnout nastavením `EVENT_REMINDER_EMAIL=0` (push zůstane, pokud je FCM).
 * Vyžaduje migraci `reminder_notified_at` na `events`.
 */
export async function GET(request: Request) {
  const denied = cronAuthResponse(request);
  if (denied) return denied;

  const { db, events, userProfiles, tenants, eq, and, isNull, lte, gte, or, ne, isNotNull } =
    await import("db");
  const { sendPushToUser } = await import("@/lib/push/send");

  const now = new Date();
  const notBefore = new Date(now.getTime() - GRACE_PAST_MIN * 60_000);

  const rows = await db
    .select({
      id: events.id,
      tenantId: events.tenantId,
      title: events.title,
      startAt: events.startAt,
      assignedTo: events.assignedTo,
      advisorEmail: userProfiles.email,
      tenantNotificationEmail: tenants.notificationEmail,
    })
    .from(events)
    .innerJoin(tenants, eq(events.tenantId, tenants.id))
    .leftJoin(userProfiles, eq(events.assignedTo, userProfiles.userId))
    .where(
      and(
        isNotNull(events.reminderAt),
        isNull(events.reminderNotifiedAt),
        lte(events.reminderAt, now),
        gte(events.reminderAt, notBefore),
        isNotNull(events.assignedTo),
        or(isNull(events.status), and(ne(events.status, "cancelled"), ne(events.status, "done"))),
      ),
    )
    .limit(200);

  const emailEnabled = process.env.EVENT_REMINDER_EMAIL?.trim() !== "0";
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  let processed = 0;
  let emailsSent = 0;

  for (const row of rows) {
    const startLabel = new Date(row.startAt).toLocaleString("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const titleShort = row.title.length > 80 ? `${row.title.slice(0, 77)}…` : row.title;

    await sendPushToUser({
      type: "REMINDER_DUE",
      title: `Připomenutí: ${titleShort}`,
      body: `Začátek: ${startLabel}`,
      tenantId: row.tenantId,
      userId: row.assignedTo!,
      data: { eventId: row.id, surface: "calendar" },
    });

    if (emailEnabled && resendKey && row.advisorEmail?.trim()) {
      const replyTo = row.tenantNotificationEmail?.trim() || resolveResendReplyTo();
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const { error } = await resend.emails.send({
          from,
          to: row.advisorEmail.trim(),
          subject: `Připomenutí: ${titleShort}`,
          html: `<p>Blíží se vaše aktivita v kalendáři.</p><p><strong>${escapeHtml(row.title)}</strong></p><p>Začátek: ${escapeHtml(startLabel)}</p><p><a href="${baseUrl}/portal/calendar">Otevřít kalendář</a></p>`,
          ...(replyTo ? { replyTo } : {}),
        });
        if (!error) emailsSent += 1;
      } catch {
        // e-mail není kritický
      }
    }

    await db
      .update(events)
      .set({ reminderNotifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(events.id, row.id));

    processed += 1;
  }

  return NextResponse.json({ ok: true, processed, emailsSent });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
