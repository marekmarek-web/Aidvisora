# AI Review — akceptační korpus (orientační)

Interní checklist pro ruční nebo lokální regresi nad složkou s PDF **mimo git** (žádná PII v repozitáři).

## Očekávání

- Dokument se **klasifikuje** na rozumný `primaryType` z `document-schema-registry`.
- Po extrakci a **`applyExtractedFieldAliasNormalizations`** nejsou povinná pole z registry označená jako chybějící jen kvůli **jinému názvu pole** v JSON (např. `institutionName` vs `insurer`).
- UI zobrazí **skutečné hodnoty** v `extractedFields`, ne syntetická `missing` z falešné verifikace.

## Mapování vzorů souborů → rodina

| Vzor názvu / typ | primaryType (cíl) |
|------------------|-------------------|
| Pojistná smlouva, *sml.pdf, Generali / UNIQA / MAXIMA / MetLife | `life_insurance_final_contract`, `life_insurance_contract`, `life_insurance_investment_contract` nebo `nonlife_insurance_contract` dle obsahu |
| Navrh_pojistne_smlouvy*, návrh | `life_insurance_proposal` |
| modelace*, *modelace*, změna ČPP | `life_insurance_modelation`, `insurance_policy_change_or_service_doc`, … |
| FUNDOO (pravidelná/jednorázová investice, typicky Amundi) | `investment_payment_instruction`, `investment_subscription_document`, `investment_service_agreement` — **ne** `pension_contract` |
| DPPDP*, smlouva DPS, VL-* (penzijní rámec) | `pension_contract` — v textu rozlišit **DPS** (doplňkové penzijní spoření) vs **PP** (penzijní připojištění) |
| DIP smlouva | `dipExtraction` / příslušný typ; nelze plést s čistým fondovým příkazem ani s DPS |
| Spotřebitelský úvěr ČSOB | `consumer_loan_contract` |
| DP daňové přiznání | `corporate_tax_return` / `self_employed_tax_or_income_document` |
| Poštovní účet / výpis | `bank_statement` |

## Lokální běh (návrh)

Spusťte pipeline z aplikace proti souborům ve vlastní složce; výsledné `extractedFields` lze porovnat s minimální množinou klíčů podle `DOCUMENT_SCHEMA_REGISTRY[primaryType].extractionRules.required` (po strip prefixu `extractedFields.`).

## Minimální automatické testy v repu

- `extraction-field-alias-normalize.test.ts` — aliasy pro IŽP, návrh, úvěr, penzi.
- Rozšiřovat pouze **anonymizované JSON fixture**, ne celé PDF.
