import { createPortalNotification } from "@/app/actions/portal-notifications";

/**
 * Jednotné upozornění klienta v portálu, když má u sebe nový sdílený dokument od poradce.
 * Volat jen když je dokument skutečně viditelný klientovi a vázaný na kontakt.
 */
export async function notifyClientAdvisorSharedDocument(params: {
  tenantId: string;
  contactId: string;
  documentId: string;
  documentName: string;
  /** upload = nový soubor; visibility_on = poradce zapnul viditelnost u existujícího */
  reason: "upload" | "visibility_on";
}): Promise<void> {
  const title =
    params.reason === "visibility_on"
      ? "Dokument je dostupný v portálu"
      : "Nový dokument od poradce";
  const body =
    params.reason === "visibility_on"
      ? `Soubor „${params.documentName}“ je nyní viditelný ve vašem portálu.`
      : `Poradce přidal dokument „${params.documentName}“ do vašeho trezoru.`;

  await createPortalNotification({
    tenantId: params.tenantId,
    contactId: params.contactId,
    type: "new_document",
    title,
    body,
    relatedEntityType: "document",
    relatedEntityId: params.documentId,
  });
}
