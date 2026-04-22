import { describe, it, expect } from "vitest";
import { scoreTextLayerQuality } from "../text-quality";

const EFEKTA_GARBAGE = `Jt-fekta
I
ObchOdnfk
s
cennyml
paptry
£2226210061
Komision6fsk6 smlouva
EFEKTA
obchodnRt I cennymi papfry a.a., zapsan6 v obchodnfm rejsUfku Krajsk,ho soudu v Brn6, oddfl
B,
vlolka
1388,
It:
60717 068, sfdlo: Vinai'sk6 460/3, 603 00 Brno, provozovna: n6m.
Svobody
91/20,
602
00 Brno, t11k6 republlka,
zastoupeny nffe podepsanou opravnlnou osobou
(,,Obchodnlk")
a
Jm6no
a
pPijmenf
/
nd1ev
1pol~ho1tl:
Rodn•
~r110
/
If:
JIN
Chlumecky n10252946
Bydlilti / sfdlo:
Strochaly
2,
41108
Snidovice,
teska
republika
Zapsand
u:
KontoktnfodrNa: Jiny pobyt
dellf net
1
rok:
tesk6 republika
Daf'tovy
clomicil:`;

const CLEAN_CZECH = `Komisionářská smlouva uzavřená mezi společností EFEKTA obchodník s cennými papíry a.s.,
se sídlem Vinařská 460/3, 603 00 Brno, Česká republika, IČO: 60717068, zapsaná v obchodním
rejstříku Krajského soudu v Brně, oddíl B, vložka 1388, zastoupená níže podepsanou oprávněnou
osobou (dále jen "Obchodník") a panem Janem Novákem, rodné číslo 800101/1234, bytem Na
Příkopě 1, 110 00 Praha 1, Česká republika (dále jen "Klient"). Smluvní strany se dohodly,
že Obchodník bude pro Klienta obstarávat nákup a prodej investičních nástrojů na základě jeho
pokynů. Tato smlouva se uzavírá na dobu neurčitou a nabývá účinnosti dnem podpisu obou stran.
Klient prohlašuje, že byl řádně poučen o rizicích spojených s obchodováním na kapitálovém trhu
a o tom, že investiční nástroje mohou být ztrátové. Poplatky za služby jsou specifikovány
v samostatném ceníku, který tvoří přílohu této smlouvy. Veškeré platby budou prováděny
bezhotovostně na účet Obchodníka vedený u České spořitelny, a.s., číslo účtu 123456789/0800.
V případě sporů se smluvní strany pokusí dohodnout mimosoudní cestou, jinak je příslušný
obecný soud dle sídla Obchodníka.`;

const CLEAN_ENGLISH = `This Commission Agreement is made and entered into between EFEKTA a.s., a joint-stock
company incorporated under the laws of the Czech Republic, with its registered seat at
Vinařská 460/3, 603 00 Brno, Czech Republic, and Mr. John Smith, residing at 1 Main Street,
London, United Kingdom (the "Client"). The parties hereby agree that the Broker shall
execute purchase and sale orders for investment instruments on behalf of the Client in
accordance with the instructions provided by the Client. This agreement shall be governed by
Czech law and is effective as of the date of signature by both parties. The Client hereby
acknowledges that he has been duly informed of the risks associated with trading on capital
markets and that investment instruments may result in losses. The fees for services are
specified in a separate schedule attached hereto as an exhibit.`;

describe("scoreTextLayerQuality", () => {
  it("detects garbled OCR as garbage (EFEKTA-like fixture)", () => {
    const result = scoreTextLayerQuality(EFEKTA_GARBAGE);
    expect(result.isLikelyGarbage).toBe(true);
    expect(result.score).toBeLessThan(0.4);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("accepts clean Czech contract text", () => {
    const result = scoreTextLayerQuality(CLEAN_CZECH);
    expect(result.isLikelyGarbage).toBe(false);
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.metrics.stopwordRatio).toBeGreaterThan(0.05);
  });

  it("accepts clean English contract text", () => {
    const result = scoreTextLayerQuality(CLEAN_ENGLISH);
    expect(result.isLikelyGarbage).toBe(false);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it("returns empty_text for empty input", () => {
    const result = scoreTextLayerQuality("");
    expect(result.isLikelyGarbage).toBe(true);
    expect(result.reasons).toContain("empty_text");
  });

  it("returns too_short for very short input", () => {
    const result = scoreTextLayerQuality("abc def");
    expect(result.isLikelyGarbage).toBe(true);
    expect(result.reasons).toContain("too_short");
  });

  it("returns too_few_words for tiny token count", () => {
    const result = scoreTextLayerQuality(
      "AAAAAA BBBBBBB CCCCCCC DDDDDDD EEEEEEE FFFFFFF GGGGGGG HHHHHHH IIIIIII"
    );
    expect(result.isLikelyGarbage).toBe(true);
    expect(result.reasons).toContain("too_few_words");
  });

  it("detects long single-char runs (rozpadlé řádky)", () => {
    const text = "s m l o u v a s m l o u v a s m l o u v a";
    const result = scoreTextLayerQuality(text);
    expect(result.metrics.singleCharRunMax).toBeGreaterThanOrEqual(5);
  });

  it("keeps suspicious-case penalty proportional", () => {
    const garbage = scoreTextLayerQuality(EFEKTA_GARBAGE);
    const clean = scoreTextLayerQuality(CLEAN_CZECH);
    expect(garbage.metrics.suspiciousCaseWordRatio).toBeGreaterThan(
      clean.metrics.suspiciousCaseWordRatio
    );
  });
});
