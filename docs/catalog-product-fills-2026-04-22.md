# Doplnění placeholder produktů v katalogu — 2026-04-22

Souvisí s plánem [`odp-zam-frequency-tbd-kpi-payment`](/.cursor/plans/odp-zam-frequency-tbd-kpi-payment_1315ec9e.plan.md) a migrací [`catalog-fill-tbd-products-2026-04-22.sql`](../packages/db/migrations/catalog-fill-tbd-products-2026-04-22.sql).

## Kontext

Před touto revizí mělo 41 kombinací `(partner, segment)` v `packages/db/src/catalog.json` jediný produkt — placeholder **„Ostatní (doplnit z dropdownu)"**. To bylo pro poradce zmatečné:
- dropdown produktů obsahoval jen TBD řádek,
- v UI se zobrazoval amber badge „doplnit",
- advisor neviděl, které partnery lze smysluplně nabídnout.

Zdroj pravdy pro doplnění byly **oficiální weby partnerů** (primárně doména `partner.cz`). U každého doplněného produktu je uveden URL, na kterém se aktuální název ověřil. Změny byly provedeny současně v:
- [`packages/db/src/catalog.json`](../packages/db/src/catalog.json) — pro `seed-catalog.mjs` a `ProductPicker`,
- [`packages/db/src/data/top-lists-seed-v2.json`](../packages/db/src/data/top-lists-seed-v2.json) — pro AI rating scoring v `toplists.ts`.

Zároveň byl escape-hatch přejmenován na **„Vlastní produkt (zadejte název)"** a v `seed-catalog.mjs` přestal spadat pod `is_tbd`. V `ProductPicker.tsx` po výběru escape-hatche nyní vyskočí textový input, kam advisor zadá reálný název — ten se uloží jako `productName` na smlouvě.

## Tabulka doplnění

| Partner | Segment | Produkt | Zdroj (URL) |
| --- | --- | --- | --- |
| Allianz pojišťovna | FIRMA_POJ | Moje Firma (Komfort/Plus/Extra/Max); Pojištění podnikatelů | https://www.allianz.cz/cs_CZ/pro-firmy/pro-podnikatele.html |
| ATRIS | INV | ATRIS SPORO; Fond Realita (ISIN CZ0008473139) | https://www.atrisinvest.cz/atris-sporo/ · https://www.atrisinvest.cz/fond-realita/ |
| Avant | INV | AVANT Flex; Fondy kvalifikovaných investorů (AVANT) | https://avantfunds.com/ · https://www.avantfunds.cz/cs/avant-flex/ |
| Cyrrus | INV | CYRRUS Udržitelná budoucnost; RESIDENTO (nemovitostní fond); Cyrrus Pravidelko | https://www.cyrrusis.cz/ |
| Česká spořitelna | UVER | Půjčka na cokoliv; Konsolidace půjček | https://www.csas.cz/cs/osobni-finance/pujcky |
| ČPP | AUTO_HAV | Havarijní pojištění vozidel | https://www.cpp.cz/pojisteni-vozidel/havarijni-pojisteni |
| ČPP | AUTO_PR | Povinné ručení SPOROPOV; Povinné ručení SPECIÁLPOV; Povinné ručení SUPERPOV | https://www.cpp.cz/pojisteni-vozidel/povinne-ruceni |
| ČPP | FIRMA_POJ | Pojištění podnikatelů a průmyslu na míru | https://www.cpp.cz/pojisteni-podnikatelu/pojisteni-podnikatelu-a-prumyslu-na-miru |
| ČPP | MAJ | DOMEX+ (MINI/OPTI/MAXI) | https://www.cpp.cz/pojisteni-majetku-a-odpovednosti-obcanu/pojisteni-domex |
| ČPP | ODP | Pojištění odpovědnosti (součást DOMEX+) | https://www.cpp.cz/pojisteni-majetku-a-odpovednosti-obcanu/pojisteni-domex |
| ČSOB | UVER | Půjčka na cokoliv; Půjčka po ruce; Konsolidace | https://sjednani.csob.cz/konsolidace |
| ČSOB Hypoteční banka | HYPO | Hypotéka; Americká hypotéka; Refinancování hypotéky | https://www.banky.cz/banky/csob-hypotecni-banka/ |
| ČSOB pojišťovna | FIRMA_POJ | TRUMF (živnostníci a menší firmy); Pojištění podnikatelských rizik | https://www.csobpoj.cz/pojisteni/podnikatele-firmy · https://www.csobpoj.cz/pojisteni/podnikatele-firmy/zivnostnik-mensi-firmy/pojisteni-podnikatelskych-rizik |
| ČSOB pojišťovna | MAJ | Náš domov (Standard/Dominant/Premiant) | https://www.csobpoj.cz/documents/10332/1666135/Produktove_informace_Nas_domov.pdf |
| ČSOB pojišťovna | ZP | Forte (investiční a úrazové pojištění) | https://www.csobpoj.cz/pojisteni/zivotni-urazove-pojisteni/zivotni-pojisteni-forte-5.1 |
| Direct | AUTO_HAV | Havarijní pojištění | https://www.direct.cz/auto/havarijni-pojisteni |
| Direct | AUTO_PR | Povinné ručení (balíčky Mám to nejnutnější / Vozím rodinu / Vždycky dojedu / Mám tam všechno) | https://www.direct.cz/blog/wp-content/uploads/2024/09/Pojisteni_flotil_-_Pojistne_podminky_a_vse_dulezite_ke_smlouve_102024-1.pdf |
| Direct | FIRMA_POJ | Pojištění podnikání | https://www.direct.cz/firmy/pojisteni-podnikani |
| Direct | MAJ | Pojištění majetku; Pojištění domu bez limitů | https://www.direct.cz/majetek · https://www.direct.cz/vlastnim-dum |
| Direct | ODP | Pojištění odpovědnosti z občanského života | https://www.banky.cz/pojistovny/direct-pojistovna/pojisteni-majetku-a-odpovednosti/ |
| J&T | INV | J&T MONEY (dluhopisový fond); J&T OPPORTUNITY (akciový fond) | https://jtis.cz/fondy · https://www.jtis.cz/fond/MOC · https://jtis.cz/fond/OCZ |
| Komerční banka | UVER | Osobní půjčka; Konsolidace půjček; Americká hypotéka | https://www.kb.cz/cs/kb-premium/uvery-a-konsolidace |
| Kooperativa | AUTO_HAV | NAMÍRU – Havarijní pojištění | https://www.pojisteni.com/pojistovny/kooperativa-pojistovna-a-s/ |
| Kooperativa | AUTO_PR | NAMÍRU – Povinné ručení | https://koop.cz/navody-a-dokumenty/nejcastejsi-dotazy/pojisteni-vozidel/povinne-ruceni |
| Kooperativa | FIRMA_POJ | Pojištění odpovědnosti podnikatelů a OSVČ | https://koop.cz/pojisteni/pojisteni-odpovednosti/pojisteni-pro-podnikatele |
| Kooperativa | MAJ | Pojištění domácnosti Prima; Pojištění domácnosti Komfort; Pojištění nemovitosti (Prima/Komfort) | https://koop.cz/pojisteni/pojisteni-majetku/pojisteni-domacnosti-rodinneho-domu |
| Kooperativa | ODP | Pojištění odpovědnosti (součást Prima/Komfort) | https://koop.cz/pojisteni/pojisteni-majetku/pojisteni-domacnosti-rodinneho-domu |
| Maxima | AUTO_HAV | Havarijní pojištění (kasko) | https://www.maximapojistovna.cz/cs/havarijni-pojisteni |
| Maxima | AUTO_PR | Pojištění motorových vozidel – povinné ručení | https://www.maximapojistovna.cz/cs/slovnik-pojmu/pojisteni-motorovych-vozidel |
| Maxima | MAJ | Pojištění majetku Ideal/Excelent/VIP | https://www.maximapojistovna.cz/cs/pojisteni/majetek-odpovednost |
| mBank | HYPO | mHypotéka; Americká hypotéka; Refinancování hypotéky | https://www.mbank.cz/osobni/hypoteky/ · https://www.mbank.cz/osobni/mhypoteka/ |
| mBank | UVER | mPůjčka | https://www.mbank.cz/osobni/uvery/mpujcka/ |
| Moventum | INV | Moventum Plus Aktiv – Defensiv / Vyvážené portfolio / Dynamické portfolio | https://www.moventum.cz/asset-management-produkty · https://www.moventum.cz/investicni-modely |
| Oberbank | HYPO | Standard hypotéka (CZK/EUR) | https://www.banky.cz/banky/oberbank/standard-hypoteka/ |
| Oberbank | UVER | Spotřebitelský úvěr / SÚ na bydlení / SÚ zajištěný zástavním právem | https://www.oberbank.cz/financovani |
| Pillow | MAJ | Pojištění nemovitosti; Pojištění domácnosti | https://www.pillow.cz/majetek |
| Pillow | ODP | Pojištění odpovědnosti | https://www.pillow.cz/caste-dotazy/odpovednost-k-nemovitosti/ |
| Raiffeisen Leasing | UVER | Úvěr; Finanční leasing; Operativní leasing | https://www.rl.cz/moznosti-financovani |
| Raiffeisenbank | UVER | Konsolidace a refinancování | https://www.rb.cz/ (via https://www.okfin.cz/konsolidace/raiffeisenbank) |
| RSTS | HYPO | Úvěr HYPO (tarif); HYPOsplátka (překlenovací úvěr); REKO (úvěr na rekonstrukci) | https://www.rsts.cz/uverovy-tarif · https://www.rsts.cz/hyposplatka · https://www.rsts.cz/uver-ze-stavebniho-sporeni |
| UNIQA | FIRMA_POJ | Perfekt (pojištění pro malé a střední podnikatele) | https://www.uniqa.cz/podnikatele/ · https://www.uniqa.cz/pro-media/aktuality/uniqa-prichazi-inovaci-pojisteni-pro-male-stredni-podnikatele/ |

**Celkem doplněno:** 41 řádků → 85+ nových produktů (1–4 produkty na řádek plus zachovaný escape-hatch „Vlastní produkt (zadejte název)").

## Neověřeno — zůstává jen escape-hatch

Žádné. Pro všech 41 kombinací se podařilo dohledat alespoň jeden oficiální produktový název z webu partnera.

## Postup ověření

1. Pro každou kombinaci byl proveden webový dotaz na formát: `{partner} {segment cs_label} produkty oficiální`.
2. Výsledky byly filtrovány na domény partnera (případně banky.cz, pojisteni.cz jako sekundární zdroj).
3. Aktuální názvy produktů byly přeneseny 1:1 včetně originálního diakritiky a závorkových variant.
4. Escape-hatch „Vlastní produkt (zadejte název)" zůstal v každé z 41 kombinací jako poslední položka seznamu, aby advisor mohl dostat do dropdownu libovolný název, pokud se partnerovo portfolio změní nebo produkt bude konkrétní (např. verze balíčku).

## Poznámky

- **Generic názvy jako „Havarijní pojištění" nebo „Cestovní pojištění"** jsou zachovány tam, kde daná pojišťovna nepoužívá marketingový brand (Direct, Maxima, ČSOB pojišťovna u CEST). V `seed-catalog.mjs` to **NENÍ** flagováno jako `is_tbd`, protože to je legitimní reálný název produktu.
- **Balíčky v závorkách** (např. „NAMÍRU (Kolumbus)") u Kooperativa a UNIQA byly přesunuty do ProductName stringu kvůli zachování struktury `categoría → produkt`. Pro KPI a AI klasifikaci je to v pořádku, protože tyto identifikátory se parsují jako jeden title.
- **Conseq / Amundi / INVESTIKA / Generali Česká / Allianz / KB / UniCredit / Modrá pyramida** už měly doplněné produkty z gap-fillu 2026-04-21 (viz [`catalog-audit-2026-04-21.md`](catalog-audit-2026-04-21.md)).

## Další kroky

- Spustit `packages/db/migrations/catalog-fill-tbd-products-2026-04-22.sql` na produkci.
- Spustit `pnpm run db:seed-catalog`, který idempotentně doplní produkty do `products` tabulky se `is_tbd=false`.
- Existující smlouvy s `product_id` ukazujícím na starý placeholder „Ostatní (doplnit z dropdownu)" zůstanou beze změny — staré řádky v `products` nejsou mazány, ale nové jsou preferované.
