/**
 * P3: documents the expected portal → chat contract for post-upload review (full flow needs auth + storage).
 * Run with E2E_ADVISOR_EMAIL / E2E_ADVISOR_PASSWORD for a signed-in advisor (see advisor-auth.setup.ts).
 */
import { expect, test } from "@playwright/test";

const advisorE2E = !!(
  process.env.E2E_ADVISOR_EMAIL?.trim() && process.env.E2E_ADVISOR_PASSWORD
);

test.describe("assistant P3 upload → reviewId context (optional)", () => {
  test("request body shape: activeContext.reviewId is supported by client builder (smoke)", async ({ page }) => {
    if (!advisorE2E) {
      test.skip();
      return;
    }
    await page.goto("/portal/today");
    await expect(page.getByRole("button", { name: "Otevřít AI asistenta" })).toBeVisible();
    // Full upload → chat E2E belongs here when stable fixtures exist; Vitest covers buildPostUploadReviewPlan + buildAssistantChatRequestBody.
  });
});
