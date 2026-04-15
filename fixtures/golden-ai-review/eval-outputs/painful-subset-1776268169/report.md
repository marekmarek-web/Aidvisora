# AI Review batch lab

- Generated: 2026-04-15T15:51:58.800Z
- Input: `/Users/marekmarek/Developer/Aidvisora/fixtures/golden-ai-review/eval-outputs/painful-subset-1776266814/subset-input`
- Files: 14
- Traffic: GREEN=1, YELLOW=13, RED=0

## Severity summary (categories)
| Category | ok | warn | fail |
| --- | --- | --- | --- |
| structured_form_extraction | 0 | 14 | 0 |
| segment_mapping | 11 | 3 | 0 |
| finality | 14 | 0 | 0 |
| client_matching | 14 | 0 | 0 |
| crm_write_through | 0 | 5 | 9 |
| ocr | 14 | 0 | 0 |
| ui_humanization | 14 | 0 | 0 |

## Top 20 worst
- **YELLOW** Plachý KB DPS.pdf (score 385)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** AMUNDI DIP.pdf (score 375)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** smlouva o poskytnutí hypotečního úvěru - návrh.pdf (score 375)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** Smlouva DPS.pdf (score 370)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** IŽP - Generali.pdf (score 355)
  - policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.
- **YELLOW** SMLOUVA O POSKYTOVÁNÍ SLUŽEB.pdf (score 355)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** Investiční smlouva Codya.pdf (score 350)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** Patroch Amundi.pdf (score 350)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- **YELLOW** Pojištění odpovědnosti v zaměstnání.pdf (score 300)
- **YELLOW** ČPP DOMEX+.pdf (score 280)
- **YELLOW** INVESTIKA PLACHÝ.pdf (score 265)
- **YELLOW** Komisionářská smlouva scan.pdf (score 240)
- **YELLOW** Čučka konsolidace.pdf (score 230)
- **GREEN** SMLOUVA O ÚVĚRU.pdf (score 170)
  - contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.

## Per file
### YELLOW — AMUNDI DIP.pdf
- Type: upisovací dokument k investici (`investment_subscription_document`) · segment: DIP
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — INVESTIKA PLACHÝ.pdf
- Type: bankovní výpis (`bank_statement`) · segment: —
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a
### YELLOW — Investiční smlouva Codya.pdf
- Type: smlouvu o investičních službách (`investment_service_agreement`) · segment: INV
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — IŽP - Generali.pdf
- Type: smlouvu k investičnímu životnímu pojištění (`life_insurance_investment_contract`) · segment: ZP
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.
### YELLOW — Komisionářská smlouva scan.pdf
- Type: souhlas / prohlášení (`consent_or_declaration`) · segment: —
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
### YELLOW — Patroch Amundi.pdf
- Type: smlouvu o investičních službách (`investment_service_agreement`) · segment: INV
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — Plachý KB DPS.pdf
- Type: smlouvu k DPS (doplňkové penzijní spoření) nebo PP (penzijní připojištění) (`pension_contract`) · segment: DPS
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — Pojištění odpovědnosti v zaměstnání.pdf
- Type: nabídku pojištění odpovědnosti (`liability_insurance_offer`) · segment: ODP
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
### YELLOW — SMLOUVA O POSKYTOVÁNÍ SLUŽEB.pdf
- Type: smlouvu o investičních službách (`investment_service_agreement`) · segment: INV
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### GREEN — SMLOUVA O ÚVĚRU.pdf
- Type: smlouvu o spotřebitelském úvěru (`consumer_loan_contract`) · segment: UVER
- Publish eligible: ano · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — Smlouva DPS.pdf
- Type: smlouvu k DPS (doplňkové penzijní spoření) nebo PP (penzijní připojištění) (`pension_contract`) · segment: DPS
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — smlouva o poskytnutí hypotečního úvěru - návrh.pdf
- Type: dokument k hypotéce (`mortgage_document`) · segment: HYPO
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
- Write-through / pre-apply: contract_number_required: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; policyholder_name_required: Jméno pojistníka / klienta / účastníka musí být vyplněno.; partner_name_required: Název partnera (pojišťovna, banka, fond) musí být vyplněn.
### YELLOW — ČPP DOMEX+.pdf
- Type: předsmluvní informace (`precontract_information`) · segment: MAJ
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72
### YELLOW — Čučka konsolidace.pdf
- Type: finanční dokument (`generic_financial_document`) · segment: —
- Publish eligible: ne · match: skipped_no_tenant_id
- OCR: golden_eval_local; ocr_est=n/a; readability=72