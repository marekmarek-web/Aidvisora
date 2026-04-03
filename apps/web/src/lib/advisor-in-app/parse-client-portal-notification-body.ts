/** Payload uložený v advisor_notifications.body pro typ client_portal_request. */
export function parseClientPortalNotificationBody(body: string | null): {
  caseType: string;
  caseTypeLabel: string;
  preview: string;
} {
  if (!body?.trim()) {
    return { caseType: "jiné", caseTypeLabel: "", preview: "" };
  }
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    if (typeof j !== "object" || j === null || Array.isArray(j)) {
      return { caseType: "jiné", caseTypeLabel: "", preview: "" };
    }
    if (typeof j.caseType === "string" && typeof j.caseTypeLabel === "string") {
      return {
        caseType: j.caseType,
        caseTypeLabel: j.caseTypeLabel,
        preview: typeof j.preview === "string" ? j.preview : "",
      };
    }
    if (typeof j.preview === "string") {
      return {
        caseType: typeof j.caseType === "string" ? j.caseType : "jiné",
        caseTypeLabel: typeof j.caseTypeLabel === "string" ? j.caseTypeLabel : "",
        preview: j.preview,
      };
    }
    return { caseType: "jiné", caseTypeLabel: "", preview: "" };
  } catch {
    /* plain text / legacy non-JSON */
    return { caseType: "jiné", caseTypeLabel: "", preview: body };
  }
}
