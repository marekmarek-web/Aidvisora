# Fondová knihovna — inventář assetů (execute plán, fáze 3)

Datum: 2026-04-05. Účel: přehled `public/logos/funds/` a `public/report-assets/funds/<baseFundKey>/` oproti kanonickým `baseFundKey` z batchů A–D. Fallbacky v `fund-report-asset-resolver.ts` zůstávají beze změny.

## Kanonické fondy (14)

| baseFundKey | Logo `public/logos/funds/` | Hero + gallery `report-assets/funds/…` | Poznámka |
|-------------|----------------------------|----------------------------------------|----------|
| `ishares_core_msci_world` | `ishares_brand.png` | 4× SVG (hero + g1–g3) | Hotovo (placeholder SVG) |
| `ishares_core_sp_500` | `ishares_brand.png` | 4× SVG | sdílené brand logo |
| `ishares_core_global_aggregate_bond` | `ishares_brand.png` | 4× SVG | sdílené brand logo |
| `vanguard_ftse_emerging_markets` | `vanguard_ftse_emerging_markets.png` | 4× SVG | |
| `fidelity_target_2040` | `fidelity_target_2040.png` | 4× SVG | |
| `investika_realitni_fond` | `investika_realitni_fond.png` | 4× SVG | seed: `assetTodo` — finální fotky dodat později |
| `monetika` | `monetika.png` | 4× SVG | |
| `efektika` | `efektika.png` | 4× SVG | |
| `conseq_globalni_akciovy_ucastnicky` | `conseq_globalni_akciovy_ucastnicky.png` | 4× SVG | |
| `nn_povinny_konzervativni` | `nn_*.png` (3 varianty) | 4× SVG | |
| `nn_vyvazeny` | `nn_vyvazeny.png` | 4× SVG | |
| `nn_rustovy` | `nn_rustovy.png` | 4× SVG | |
| `creif` | `creif.png` | **Legacy cesty** v `FUND_DETAILS` + seeds: `/report-assets/creif/*` (JPG/SVG) | Není pod `report-assets/funds/creif/` — záměr do sjednocení |
| `atris` | `atris.png` | **Legacy:** `/report-assets/atris/*` | Stejně jako CREIF |
| `penta` | `penta.png` | **Legacy:** `/report-assets/penta/*` + `hero.svg` | Stejně jako CREIF |

## Stav skupin

- **Plně funkční (logika + soubory):** všech 14 — žádný chybějící soubor pro aktuální resolver + legacy cesty pro D.
- **Placeholder vizuály:** většina `report-assets/funds/*/hero.svg` a `gallery-*.svg` — v seznamech `assetTodo` v seedech je co nahradit reálnou grafikou.
- **Chybějící „kanonická“ složka pro Batch D:** `creif`, `atris`, `penta` používají staré stromy pod `/report-assets/{creif,atris,penta}/` — OK pro deploy; sjednocení do `funds/<key>/` je budoucí kosmetika.

## TODO pro grafiku (kopírovatelný checklist)

Pro fondy se `assetTodo` v `base-funds-batch-*.seed.ts` dodat finální soubory do:

- `/public/logos/funds/<soubor>.png` (nebo aktualizovat cestu v seedu)
- `/public/report-assets/funds/<baseFundKey>/hero.*`
- `/public/report-assets/funds/<baseFundKey>/gallery-1.*` … `gallery-3.*`

## Obsah fondových karet (fáze 4)

Textová vrstva (subtitle → verifiedAt) žije v `apps/web/src/lib/analyses/financial/fund-library/base-funds-batch-{a,b,c,d}.seed.ts`. Chybějící oficiální údaje jsou tam kde `null` / prázdné pole / poznámka v `notes` — bez doloženého zdroje neměnit.
