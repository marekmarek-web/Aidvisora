import { describe, it, expect } from "vitest";
import { FileText, Users } from "lucide-react";
import { getAdvisorNotificationDropdownMeta } from "../advisor-notification-dropdown-meta";

describe("getAdvisorNotificationDropdownMeta", () => {
  it("client_material_response: náhled z preview, ne raw JSON", () => {
    const meta = getAdvisorNotificationDropdownMeta({
      type: "client_material_response",
      title: "Marek Marek",
      body: JSON.stringify({
        contactId: "c1",
        requestId: "r1",
        preview: "Text odpovědi klienta",
      }),
    });
    expect(meta.categoryLabel).toBe("Odpověď na požadavek");
    expect(meta.preview).toBe("Text odpovědi klienta");
    expect(meta.preview).not.toContain("contactId");
    expect(meta.accent).toBe("emerald");
    expect(meta.Icon).toBe(FileText);
  });

  it("client_trezor_upload", () => {
    const meta = getAdvisorNotificationDropdownMeta({
      type: "client_trezor_upload",
      title: "Jan Novák",
      body: JSON.stringify({
        contactId: "c1",
        preview: "Nahrál dokument: smlouva.pdf",
        documentId: "d1",
      }),
    });
    expect(meta.categoryLabel).toBe("Nahrání do trezoru");
    expect(meta.preview).toBe("Nahrál dokument: smlouva.pdf");
    expect(meta.accent).toBe("violet");
  });

  it("client_household_update sladění s toastem (amber, Users)", () => {
    const meta = getAdvisorNotificationDropdownMeta({
      type: "client_household_update",
      title: "Klient",
      body: JSON.stringify({
        contactId: "c1",
        preview: "Přidal člena domácnosti",
        newMemberContactId: "c2",
      }),
    });
    expect(meta.categoryLabel).toBe("Úprava domácnosti");
    expect(meta.accent).toBe("amber");
    expect(meta.Icon).toBe(Users);
  });

  it("client_portal_request používá parser", () => {
    const meta = getAdvisorNotificationDropdownMeta({
      type: "client_portal_request",
      title: "Marek Marek",
      body: JSON.stringify({
        caseType: "investice",
        caseTypeLabel: "Investice",
        preview: "Pravidelné investice — 1M",
      }),
    });
    expect(meta.categoryLabel).toBe("Investice");
    expect(meta.preview).toBe("Pravidelné investice — 1M");
  });
});
