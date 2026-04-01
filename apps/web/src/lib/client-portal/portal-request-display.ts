import { caseTypeToLabel } from "@/lib/client-portal/case-type-labels";

/** Vyplněné z createClientPortalRequest – předmět a popis zvlášť. */
export function getPortalRequestDisplayFields(
  customFields: Record<string, unknown> | null | undefined,
  opportunityTitle: string,
  caseType: string | null | undefined
): { subject: string; body: string | null; preview: string } {
  const custom = customFields ?? {};
  const explicitSubject =
    typeof custom.client_request_subject === "string" ? custom.client_request_subject.trim() : "";
  const rawDesc = typeof custom.client_description === "string" ? custom.client_description.trim() : "";
  const fallbackTitle = opportunityTitle.trim() || `Požadavek z portálu: ${caseTypeToLabel(caseType ?? "")}`;

  if (explicitSubject) {
    const preview = [explicitSubject, rawDesc].filter(Boolean).join(" — ");
    return {
      subject: explicitSubject,
      body: rawDesc || null,
      preview: preview.length > 280 ? `${preview.slice(0, 277)}…` : preview,
    };
  }

  if (rawDesc) {
    const nl = rawDesc.indexOf("\n");
    if (nl === -1) {
      return {
        subject: fallbackTitle,
        body: rawDesc,
        preview: rawDesc.length > 280 ? `${rawDesc.slice(0, 277)}…` : rawDesc,
      };
    }
    const first = rawDesc.slice(0, nl).trim();
    const rest = rawDesc.slice(nl + 1).trim() || null;
    const subj = first || fallbackTitle;
    const preview = [subj, rest].filter(Boolean).join(" — ");
    return {
      subject: subj,
      body: rest,
      preview: preview.length > 280 ? `${preview.slice(0, 277)}…` : preview,
    };
  }

  return {
    subject: fallbackTitle,
    body: null,
    preview: fallbackTitle,
  };
}
