"use server";

import { withAuthContext } from "@/lib/auth/with-auth-context";
import { hasPermission } from "@/lib/auth/permissions";
import { contacts } from "db";
import { eq, and, lte, isNotNull } from "db";
import { sendEmail } from "@/lib/email/send-email";
import { serviceReminderTemplate } from "@/lib/email/templates";
import { loadAdvisorMailHeadersForCurrentUser } from "@/lib/email/advisor-mail-headers";

/**
 * Process service reminders: find contacts with upcoming/due service,
 * send email to advisor (and optionally client), log the result.
 * Returns count of emails attempted.
 */
export async function processServiceReminders(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const today = new Date().toISOString().slice(0, 10);

  const dueContacts = await withAuthContext(async (auth, tx) => {
    if (!hasPermission(auth.roleName, "contacts:read")) throw new Error("Forbidden");
    return tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        nextServiceDue: contacts.nextServiceDue,
        unsubscribed: contacts.notificationUnsubscribedAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, auth.tenantId),
          isNotNull(contacts.nextServiceDue),
          lte(contacts.nextServiceDue, today)
        )
      );
  });

  const errors: string[] = [];
  let sent = 0;

  const headers = await loadAdvisorMailHeadersForCurrentUser();

  for (const c of dueContacts) {
    const contactName = `${c.firstName} ${c.lastName}`;

    if (c.unsubscribed) continue;

    if (c.email) {
      const template = serviceReminderTemplate({
        contactName,
        nextServiceDue: c.nextServiceDue ?? today,
      });
      const result = await sendEmail({
        to: c.email,
        subject: template.subject,
        html: template.html,
        from: headers.from,
        replyTo: headers.replyTo,
      });
      if (result.ok) {
        sent++;
      } else {
        errors.push(`${contactName}: ${result.error}`);
      }
    }
  }

  return { processed: dueContacts.length, sent, errors };
}
