# Fáze 1 — inventář reálného korpusu (`Test AI/`)

**Source of truth (strojová):** [`fixtures/golden-ai-review/scenarios.manifest.json`](../fixtures/golden-ai-review/scenarios.manifest.json) — pole `corpusDocuments` (**verze 3 manifestu**), včetně Fáze 1 polí: `expectedOutputMode`, `expectedFamily`, `expectedCoreFields`, `expectedActionsAllowed` / `expectedActionsForbidden`, `expectedFallbackBehavior` (reference), `expectedSensitivity`, `expectedClientBindingType`, `expectedNotesForAdvisor`.

**Definice bucketů:** [ai-review-assistant-phase-1-corpus-buckets.md](./ai-review-assistant-phase-1-corpus-buckets.md)

**Release gate (Fáze 1+):** [ai-review-phase1-release-gate.md](./ai-review-phase1-release-gate.md)

**Scope dalších fází:** AI Review i AI asistent se v eval a opravách **musí opírat o celý tento korpus** (**29** řádků **C001–C029**) a o scénáře **G01–G12**. Dokument [ai-assistant-stage5-acceptance.md](./ai-assistant-stage5-acceptance.md) **není** definicí rozsahu korpusu.

**PDF v gitu:** sloupec „v git“ odpovídá `git ls-files -- Test AI/` po spuštění [`regenerate-manifest.cjs`](../fixtures/golden-ai-review/regenerate-manifest.cjs) (pole `gitTracked`). Ostatní PDF drž lokálně ve `Test AI/` se stejným názvem jako `referenceFile`.

**Chybějící soubor v clone:** např. `Hanna Havdan GČP.pdf` (C027) — doplnit lokálně; není blokací pro JSON/docs.

**Nově v git korpusu (C028–C029):** `SMLOUVA O POSKYTOVÁNÍ SLUŽEB.pdf`, `Investiční smlouva Codya.pdf` — doplněno do manifestu jako referenční servisní vs investiční dráha.

---

## Přehled C001–C029

| ID | Soubor | expectedFamily | familyBucket | expectedPrimaryType | expectedOutputMode | publish | packet | v git |
|----|--------|------------------|--------------|---------------------|--------------------|---------|--------|-------|
| C001 | 1045978-001_D102_Smlouva o poskytnutí hypotečního úvěru_navrh.pdf | mortgage | mortgage_or_mortgage_proposal | mortgage_document | signature_ready_proposal | partial | ne | ne |
| C002 | 30. Pojistná smlouva c. 3282140369.pdf | life_insurance | final_life_contract | life_insurance_final_contract | structured_product_document | ano | ne | ano |
| C003 | 33543904_Modelace zivotniho pojisteni.pdf | life_insurance | life_modelation | life_insurance_modelation | modelation_or_precontract | ne | ne | ne |
| C004 | AMUNDI PLATFORMA - účet CZ KLASIK - DIP (4).pdf | investment | investment_or_dip_or_dps | investment_subscription_document | structured_product_document | ano | ne | ne |
| C005 | DPPDP9-0009513230-20250325-100501.pdf | investment | investment_or_dip_or_dps | pension_contract | structured_product_document | ano | ne | ano |
| C006 | Honzajk čpp změna.pdf | compliance | service_or_aml_or_supporting_doc | insurance_policy_change_or_service_doc | reference_or_supporting_document | ne | ne | ano |
| C007 | Honzajk_KNZ_1FG_modelace_251107_161032.pdf | life_insurance | life_modelation | life_insurance_modelation | modelation_or_precontract | ne | ne | ano |
| C008 | Lehnert Metlife.pdf | life_insurance | life_proposal | life_insurance_proposal | signature_ready_proposal | partial | ne | ne |
| C009 | Navrh_pojistne_smlouvy (1).pdf | life_insurance | life_bundle_with_questionnaires | life_insurance_proposal | signature_ready_proposal | partial | ano | ne |
| C010 | Navrh_pojistne_smlouvy (2).pdf | life_insurance | life_proposal | nonlife_insurance_contract | signature_ready_proposal | partial | ne | ne |
| C011 | Navrh_pojistne_smlouvy (3).pdf | life_insurance | life_proposal | liability_insurance_offer | signature_ready_proposal | partial | ne | ano |
| C012 | Navrh_pojistne_smlouvy (4).pdf | life_insurance | life_proposal | nonlife_insurance_contract | signature_ready_proposal | partial | ne | ne |
| C013 | Navrh_pojistne_smlouvy_20251201152350427347.PDF | life_insurance | life_proposal | life_insurance_proposal | signature_ready_proposal | partial | ne | ano |
| C014 | Pojistna_smlouva.pdf | life_insurance | life_bundle_with_questionnaires | life_insurance_proposal | signature_ready_proposal | partial | ano | ne |
| C015 | Pojistna_smlouva_Bibiš.pdf | life_insurance | life_proposal | nonlife_insurance_contract | signature_ready_proposal | partial | ne | ne |
| C016 | RSR Quick s.r.o. DP 2024.pdf | compliance | service_or_aml_or_supporting_doc | corporate_tax_return | reference_or_supporting_document | ne | ne | ano |
| C017 | Roman Koloburda UNIQA.pdf | life_insurance | life_proposal | life_insurance_proposal | signature_ready_proposal | partial | ne | ano |
| C018 | Smlouva (3).pdf | investment | investment_or_dip_or_dps | pension_contract | structured_product_document | ano | ne | ne |
| C019 | Smlouva o ČSOB Spotřebitelském úvěru.pdf | consumer_credit | consumer_loan | consumer_loan_contract | structured_product_document | ano | ne | ne |
| C020 | Smlouva-o-poskytovani-sluzeb-Chlumecky-Jiri.pdf | compliance | service_or_aml_or_supporting_doc | service_agreement | reference_or_supporting_document | ne | ne | ne |
| C021 | Smlouva-o-upisu-CODYAMIX-Chlumecky-Jiri.pdf | investment | investment_or_dip_or_dps | investment_subscription_document | structured_product_document | ano | ne | ne |
| C022 | VL-202512.pdf | investment | investment_or_dip_or_dps | pension_contract | structured_product_document | partial | ne | ano |
| C023 | komis sml. aml fatca (1).pdf | compliance | service_or_aml_or_supporting_doc | consent_or_declaration | reference_or_supporting_document | ne | ne | ne |
| C024 | Úvěrová smlouva ČÚ 111 06034 25 (1).pdf | mortgage | mortgage_or_mortgage_proposal | mortgage_document | structured_product_document | ano | ne | ne |
| C025 | ČSOB Leasing PBI.pdf | leasing | leasing | generic_financial_document | structured_product_document | ano | ne | ne |
| C026 | Čučka zamzam GČP.pdf | life_insurance | life_proposal | liability_insurance_offer | signature_ready_proposal | partial | ne | ne |
| C027 | Hanna Havdan GČP.pdf | life_insurance | life_bundle_with_questionnaires | life_insurance_investment_contract | structured_product_document | partial | ano | ne |
| C028 | SMLOUVA O POSKYTOVÁNÍ SLUŽEB.pdf | compliance | service_or_aml_or_supporting_doc | service_agreement | reference_or_supporting_document | ne | ne | ne |
| C029 | Investiční smlouva Codya.pdf | investment | investment_or_dip_or_dps | investment_subscription_document | structured_product_document | ano | ne | ne |

**Alias:** C019 má `aliasFileNames` pro alternativní název souboru spotřebitelského úvěru (viz JSON).

**G02 (modelace):** scénář pokrývá pouze **C003, C007, C013** (návrh životního pojištění / modelace — bez C011 odpovědnostní nabídky).

---

## SQL migrace

Žádné.

```sql
-- Žádný nový skript.
```
