import { describe, it, expect, vi } from "vitest";
import { detectInputMode } from "../input-mode-detection";

vi.mock("@/lib/openai", () => ({
  createResponseWithFile: vi.fn(),
}));

describe("input-mode-detection", () => {
  it("returns unsupported for disallowed mime type without calling OpenAI", async () => {
    const result = await detectInputMode("https://example.com/file.zip", "application/zip");
    expect(result.inputMode).toBe("unsupported");
    expect(result.extractionMode).toBe("vision_fallback");
    expect(result.extractionWarnings.some((w) => w.includes("zip"))).toBe(true);
    const openai = await import("@/lib/openai");
    expect(openai.createResponseWithFile).not.toHaveBeenCalled();
  });

  it("returns text_pdf and extractionMode text when model returns text_pdf", async () => {
    const openai = await import("@/lib/openai");
    vi.mocked(openai.createResponseWithFile).mockResolvedValueOnce(
      JSON.stringify({ inputMode: "text_pdf", confidence: 0.95, reason: "Selectable text" })
    );
    const result = await detectInputMode("https://example.com/doc.pdf", "application/pdf");
    expect(result.inputMode).toBe("text_pdf");
    expect(result.extractionMode).toBe("text");
    expect(result.confidence).toBe(0.95);
  });

  it("returns scanned_pdf and vision_fallback when model returns scanned_pdf", async () => {
    const openai = await import("@/lib/openai");
    vi.mocked(openai.createResponseWithFile).mockResolvedValueOnce(
      JSON.stringify({ inputMode: "scanned_pdf", confidence: 0.8, reason: "Image-based" })
    );
    const result = await detectInputMode("https://example.com/scan.pdf", "application/pdf");
    expect(result.inputMode).toBe("scanned_pdf");
    expect(result.extractionMode).toBe("vision_fallback");
  });

  it("returns unsupported and vision_fallback when response is invalid JSON", async () => {
    const openai = await import("@/lib/openai");
    vi.mocked(openai.createResponseWithFile).mockResolvedValueOnce("not json");
    const result = await detectInputMode("https://example.com/x.pdf", "application/pdf");
    expect(result.inputMode).toBe("unsupported");
    expect(result.extractionMode).toBe("vision_fallback");
    expect(result.extractionWarnings.length).toBeGreaterThan(0);
  });
});
