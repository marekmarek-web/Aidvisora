import "server-only";

import { db, contacts, eq, and } from "db";
import { getTargetAdvisorUserIdForContact } from "@/app/actions/client-dashboard";
import { emitNotification } from "@/lib/execution/notification-center";

export const ADVISOR_NOTIF_CLIENT_TREZOR_UPLOAD = "client_trezor_upload";
export const ADVISOR_NOTIF_CLIENT_HOUSEHOLD_UPDATE = "client_household_update";

async function getContactDisplayName(tenantId: string, contactId: string): Promise<string> {
  const [c] = await db
    .select({ firstName: contacts.firstName, lastName: contacts.lastName })
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
    .limit(1);
  if (!c) return "Klient";
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Klient";
}

/** Klient nahrál soubor do trezoru — upozornění pro přiřazeného poradce (ne pro klienta). */
export async function notifyAdvisorClientTrezorUpload(params: {
  tenantId: string;
  contactId: string;
  documentId: string;
  documentLabel: string;
}): Promise<void> {
  const displayName = await getContactDisplayName(params.tenantId, params.contactId);
  const targetUserId = await getTargetAdvisorUserIdForContact(params.tenantId, params.contactId);
  if (!targetUserId) return;

  const label = params.documentLabel.trim();
  const preview =
    label.length > 0 ? `Nahrál dokument: ${label}` : "Nahrál nový dokument do trezoru.";

  try {
    await emitNotification({
      tenantId: params.tenantId,
      type: ADVISOR_NOTIF_CLIENT_TREZOR_UPLOAD,
      title: displayName,
      body: JSON.stringify({
        contactId: params.contactId,
        preview,
        documentId: params.documentId,
      }),
      severity: "info",
      targetUserId,
      channels: ["in_app"],
      relatedEntityType: "document",
      relatedEntityId: params.documentId,
    });
  } catch {
    /* best-effort */
  }
}

/** Klient přidal člena domácnosti — upozornění pro přiřazeného poradce. */
export async function notifyAdvisorClientHouseholdUpdate(params: {
  tenantId: string;
  clientContactId: string;
  newMemberContactId: string;
  preview: string;
}): Promise<void> {
  const displayName = await getContactDisplayName(params.tenantId, params.clientContactId);
  const targetUserId = await getTargetAdvisorUserIdForContact(
    params.tenantId,
    params.clientContactId
  );
  if (!targetUserId) return;

  try {
    await emitNotification({
      tenantId: params.tenantId,
      type: ADVISOR_NOTIF_CLIENT_HOUSEHOLD_UPDATE,
      title: displayName,
      body: JSON.stringify({
        contactId: params.clientContactId,
        preview: params.preview,
        newMemberContactId: params.newMemberContactId,
      }),
      severity: "info",
      targetUserId,
      channels: ["in_app"],
      relatedEntityType: "contact",
      relatedEntityId: params.newMemberContactId,
    });
  } catch {
    /* best-effort */
  }
}
