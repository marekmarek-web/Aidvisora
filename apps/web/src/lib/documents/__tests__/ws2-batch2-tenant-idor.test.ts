/**
 * WS-2 Batch 2 — W3 IDOR fix verification
 *
 * Účel: ověřit, že cílené funkce odmítnou běh bez `tenantId` (signature guard)
 * a že při volání bez tenantId vyhodí výjimku. Zdůvodnění:
 *   - dříve přijímaly jen `storagePath` / `documentId`, což umožňovalo cross-tenant lookup.
 *   - tenantId je teď povinný první-class parametr a filtruje query.
 *
 * Tento test je záměrně lightweight — nekontroluje DB plán; k tomu slouží RLS policies
 * (viz packages/db/migrations/rls-*-2026-04-19.sql).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB — selecty nás nezajímají, jen chceme dovolit voláním dojít až za guard.
vi.mock("db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  },
  documents: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) },
  })),
}));

vi.mock("@/lib/storage/signed-url", () => ({
  createSignedStorageUrl: vi.fn(async () => ({ signedUrl: null })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WS-2 Batch 2 — IDOR guards on document lookup helpers", () => {
  it("fetchAdobeStructuredDataByStoragePath odmítne prázdný tenantId", async () => {
    const { fetchAdobeStructuredDataByStoragePath } = await import("../page-text-map-lookup");
    await expect(
      // @ts-expect-error — test záměrně volá s prázdným tenantId
      fetchAdobeStructuredDataByStoragePath("some/path.pdf", "")
    ).rejects.toThrow(/tenantId is required/);
  });

  it("fetchPageTextMapByStoragePath odmítne prázdný tenantId", async () => {
    const { fetchPageTextMapByStoragePath } = await import("../page-text-map-lookup");
    await expect(
      // @ts-expect-error — test záměrně volá s prázdným tenantId
      fetchPageTextMapByStoragePath("some/path.pdf", "")
    ).rejects.toThrow(/tenantId is required/);
  });

  it("resolveAiInputForDocument odmítne prázdný tenantId", async () => {
    const { resolveAiInputForDocument } = await import("../processing/resolve-ai-input");
    await expect(
      // @ts-expect-error — test záměrně volá s prázdným tenantId
      resolveAiInputForDocument("doc-123", "")
    ).rejects.toThrow(/tenantId is required/);
  });

  it("resolveAiInputForDocument má povinný druhý parametr v signature", async () => {
    // Kompilační smoke check: pokud by se signature zúžila zpět na jednoargumentovou variantu,
    // `length` reflektuje definovaný počet parametrů (před optional/rest) a test spadne.
    const mod = await import("../processing/resolve-ai-input");
    expect(mod.resolveAiInputForDocument.length).toBeGreaterThanOrEqual(2);
  });
});

describe("WS-2 Batch 2 — IDOR guard on syncPortfolioDraftFromProcessedDocument", () => {
  it("odmítne prázdný tenantId", async () => {
    vi.doMock("@/lib/ai/draft-actions", () => ({ resolveSegmentFromType: () => "ZP" }));
    vi.doMock("@/lib/ai/contract-draft-premiums", () => ({ computeDraftPremiums: () => ({}) }));
    vi.doMock("@/lib/ai/extraction-schemas", () => ({ extractedContractSchema: { safeParse: () => ({ success: false }) } }));
    vi.doMock("@/lib/portfolio/build-portfolio-attributes-from-extract", () => ({ buildPortfolioAttributesFromExtracted: () => ({}) }));
    vi.doMock("@/lib/ai/document-messages", () => ({ getDocumentTypeLabel: () => "" }));

    const { syncPortfolioDraftFromProcessedDocument } = await import("@/lib/portfolio/from-document-extraction");
    await expect(
      // @ts-expect-error — test záměrně volá s prázdným tenantId
      syncPortfolioDraftFromProcessedDocument("doc-123", "")
    ).rejects.toThrow(/tenantId is required/);
  });
});
