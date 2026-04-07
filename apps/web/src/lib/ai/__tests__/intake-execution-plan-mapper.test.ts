import { describe, it, expect } from "vitest";
import { mapToExecutionPlan, mapToPreviewItems } from "@/lib/ai/image-intake/intake-execution-plan-mapper";
import { emptyActionPlan } from "@/lib/ai/image-intake/types";

const CLIENT_ID = "11111111-1111-1111-1111-111111111111";

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
});
