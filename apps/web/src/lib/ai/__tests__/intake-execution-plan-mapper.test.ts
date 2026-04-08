import { describe, it, expect } from "vitest";
import { mapToExecutionPlan, mapToPreviewItems } from "@/lib/ai/image-intake/intake-execution-plan-mapper";
import { emptyActionPlan } from "@/lib/ai/image-intake/types";

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const WRONG_CLIENT_ID = "22222222-2222-2222-2222-222222222222";

describe("mapToPreviewItems — advisor-facing copy", () => {
  it("does not expose internal write action names in description", () => {
    const plan = mapToExecutionPlan(
      "img_x",
      {
        ...emptyActionPlan("client_message_update"),
        recommendedActions: [
          {
            intentType: "create_internal_note",
            writeAction: "createInternalNote",
            label: "Uložit jako interní poznámku",
            reason: "test",
            confidence: 0.9,
            requiresConfirmation: true,
            params: {},
          },
        ],
      },
      CLIENT_ID,
      null,
    );
    const items = mapToPreviewItems(plan);
    expect(items[0].description).toBeDefined();
    expect(items[0].description).not.toMatch(/createInternalNote|Image intake:/i);
    expect(items[0].description).toMatch(/Poznámka|klienta/i);
  });

  it("identity attach steps do not get route contactId (rely on createContact dependency)", () => {
    const plan = mapToExecutionPlan(
      "id_intake",
      {
        ...emptyActionPlan("identity_contact_intake"),
        outputMode: "identity_contact_intake",
        recommendedActions: [
          {
            intentType: "create_contact",
            writeAction: "createContact",
            label: "Založit klienta",
            reason: "test",
            confidence: 0.9,
            requiresConfirmation: true,
            params: { firstName: "A", lastName: "B" },
          },
          {
            intentType: "attach_document",
            writeAction: "attachDocumentToClient",
            label: "Uložit doklad",
            reason: "test",
            confidence: 0.9,
            requiresConfirmation: true,
            params: { docId: "x", _identityIntakeAttach: true },
          },
        ],
      },
      WRONG_CLIENT_ID,
      null,
    );
    const attach = plan.steps.find((s) => s.action === "attachDocumentToClient");
    expect(attach).toBeDefined();
    expect((attach!.params as Record<string, unknown>).contactId).toBeUndefined();
    const create = plan.steps.find((s) => s.action === "createContact");
    expect(create).toBeDefined();
    expect((create!.params as Record<string, unknown>).contactId).toBeUndefined();
  });
});
