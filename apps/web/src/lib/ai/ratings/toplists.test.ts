import { describe, expect, it } from "vitest";
import topListsSeed from "../../../../../../packages/db/src/data/top-lists-seed-v2.json";
import {
  getTopPartnersForSegment,
  resolveSegmentFromText,
  tryRatingLookupReply,
} from "./toplists";
import { resolveContractSegmentFromUserText } from "../assistant-domain-model";

describe("toplists seed lookup", () => {
  it("resolveSegmentFromText maps advisor slang to segment codes", () => {
    expect(resolveSegmentFromText("životko u klienta")).toBe("ZP");
    expect(resolveSegmentFromText("povko a havko")).toBe("AUTO_PR");
    expect(resolveSegmentFromText("havko na autě")).toBe("AUTO_HAV");
    expect(resolveSegmentFromText("penzijko třetí pilíř")).toBe("DPS");
    expect(resolveSegmentFromText("hypoška fix")).toBe("HYPO");
    expect(resolveSegmentFromText("spotřebák na auto")).toBe("UVER");
  });

  it("resolveContractSegmentFromUserText disambiguates auto from phrases", () => {
    expect(resolveContractSegmentFromUserText("povinné ručení Allianz")).toBe("AUTO_PR");
    expect(resolveContractSegmentFromUserText("havarijní u Kooperativy")).toBe("AUTO_HAV");
  });

  it("getTopPartnersForSegment returns ordered rows for ZP and skips excluded Slavia", () => {
    const rows = getTopPartnersForSegment("ZP", 10);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.partner.includes("Slavia"))).toBe(false);
    expect(rows[0].partner.length).toBeGreaterThan(1);
  });

  it("tryRatingLookupReply returns deterministic markdown for rating-style questions", () => {
    const msg = "Které životní pojištění má nejlepší rating?";
    const out = tryRatingLookupReply(msg);
    expect(out).toBeTruthy();
    expect(out).toContain("Životní pojištění");
    expect(out).toMatch(/UNIQA|Orange|Bel Mondo/i);
    expect(out).toContain("EUCS");
  });

  it("P3: rating reply includes disclaimer text from seed note", () => {
    const note = (topListsSeed as { note?: string }).note ?? "";
    expect(note).toContain("Top seznamy");
    const out = tryRatingLookupReply("Jaké životní pojištění má nejvyšší rating?");
    expect(out).toBeTruthy();
    const normalized = out!.replace(/\s+/g, " ");
    expect(
      normalized.includes("Top seznamy (pojišťovny") ||
      normalized.includes("Rating je pouze informativní"),
    ).toBe(true);
  });

  it("tryRatingLookupReply is null without rating intent or segment", () => {
    expect(tryRatingLookupReply("Ahoj, jak se máš?")).toBeNull();
    expect(tryRatingLookupReply("Kdo má nejlepší rating vůbec?")).toBeNull();
  });

  it("DPS top query stays deterministic from internal seed list", () => {
    const out = tryRatingLookupReply("Jaké DPS je u nás top?");
    expect(out).toBeTruthy();
    expect(out).toContain("Penzijní");
    expect(out).not.toContain("nemám interní podklad");
  });
});
