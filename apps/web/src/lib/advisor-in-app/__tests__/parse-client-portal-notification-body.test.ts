import { describe, it, expect } from "vitest";
import { parseClientPortalNotificationBody } from "../parse-client-portal-notification-body";

describe("parseClientPortalNotificationBody", () => {
  it("parsuje plné schéma client_portal_request", () => {
    const body = JSON.stringify({
      caseType: "servis_smlouvy",
      caseTypeLabel: "Servis smlouvy",
      preview: "Úprava smlouvy — text",
      contactId: "83fc409b-d023-4c2a-9353-958b686b4f0f",
    });
    expect(parseClientPortalNotificationBody(body)).toEqual({
      caseType: "servis_smlouvy",
      caseTypeLabel: "Servis smlouvy",
      preview: "Úprava smlouvy — text",
    });
  });

  it("bez plného schématu použije string preview místo celého JSON", () => {
    const body = JSON.stringify({
      contactId: "83fc409b-d023-4c2a-9353-958b686b4f0f",
      requestId: "a6534fce-fee8-47c6-a269-111111111111",
      preview: "Klient odpověděl na podklady",
    });
    const r = parseClientPortalNotificationBody(body);
    expect(r.preview).toBe("Klient odpověděl na podklady");
    expect(r.preview).not.toContain("contactId");
    expect(r.caseType).toBe("jiné");
  });

  it("plain text tělo vrátí jako preview", () => {
    expect(parseClientPortalNotificationBody("Krátká poznámka")).toEqual({
      caseType: "jiné",
      caseTypeLabel: "",
      preview: "Krátká poznámka",
    });
  });

  it("prázdné tělo", () => {
    expect(parseClientPortalNotificationBody(null)).toEqual({
      caseType: "jiné",
      caseTypeLabel: "",
      preview: "",
    });
  });

  it("JSON bez preview vrátí prázdný preview, ne serializovaný objekt", () => {
    const body = JSON.stringify({ contactId: "x", requestId: "y" });
    const r = parseClientPortalNotificationBody(body);
    expect(r.preview).toBe("");
    expect(r.preview).not.toContain("contactId");
  });
});
