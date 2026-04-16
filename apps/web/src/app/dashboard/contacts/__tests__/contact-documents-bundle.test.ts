import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/actions/documents", () => ({
  getDocumentsForContact: vi.fn(),
}));

vi.mock("@/app/actions/contracts", () => ({
  getContractsByContact: vi.fn(),
}));

import { getDocumentsForContact } from "@/app/actions/documents";
import { getContractsByContact } from "@/app/actions/contracts";
import { fetchContactDocumentsBundle } from "../contact-documents-bundle";

describe("fetchContactDocumentsBundle", () => {
  beforeEach(() => {
    vi.mocked(getDocumentsForContact).mockReset();
    vi.mocked(getContractsByContact).mockReset();
  });

  it("returns empty docs and still loads contracts when documents fail", async () => {
    vi.mocked(getDocumentsForContact).mockRejectedValue(new Error("Forbidden"));
    vi.mocked(getContractsByContact).mockResolvedValue([
      { id: "c1", contactId: "k1", segment: "ZP" } as Awaited<ReturnType<typeof getContractsByContact>>[0],
    ]);

    const result = await fetchContactDocumentsBundle("k1");

    expect(result.docs).toEqual([]);
    expect(result.contracts).toHaveLength(1);
    expect(result.contracts[0].id).toBe("c1");
  });

  it("propagates failure when contracts fail", async () => {
    vi.mocked(getDocumentsForContact).mockResolvedValue([]);
    vi.mocked(getContractsByContact).mockRejectedValue(new Error("contracts failed"));

    await expect(fetchContactDocumentsBundle("k1")).rejects.toThrow("contracts failed");
  });

  it("returns both when both succeed", async () => {
    vi.mocked(getDocumentsForContact).mockResolvedValue([
      { id: "d1", name: "a.pdf", mimeType: "application/pdf", tags: null, contactId: "k1", contractId: null, visibleToClient: false, createdAt: new Date(), uploadSource: null, processingStatus: null, processingStage: null, aiInputSource: null, pageCount: null, isScanLike: null, sizeBytes: null },
    ]);
    vi.mocked(getContractsByContact).mockResolvedValue([]);

    const result = await fetchContactDocumentsBundle("k1");

    expect(result.docs).toHaveLength(1);
    expect(result.contracts).toEqual([]);
  });
});
