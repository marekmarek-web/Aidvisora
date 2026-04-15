# Demo Publish Harness — Report

- **Generated:** 2026-04-15T17:44:19.488Z
- **Input document:** `AMUNDI DIP.pdf`
- **Matched client:** Jiří Chlumecký (`10cc19a4-4e8d-4250-b6a6-3b657d536c67`)

## Pipeline
- OK: ano
- Segment: DIP
- Contract number: —
- Institution: —
- Product: —

## Apply
- OK: ne
- Error: Pre-apply validace selhala: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; Jméno pojistníka / klienta / účastníka musí být vyplněno.; Název partnera (pojišťovna, banka, fond) musí být vyplněn.
- Created/updated contract ID: —
- Payment setup ID: —

## Downstream Checks
| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | Contract/product artifact created | ❌ | Pre-apply validace selhala: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; Jméno pojistníka / klienta / účastníka musí být vyplněno.; Název partnera (pojišťovna, banka, fond) musí být vyplněn. |
| 2 | Advisor product card / products tab readable | ❌ | Not checked (no contract) |
| 3 | Client portal / Portfolio readable | ❌ | Not checked |
| 4 | Client portal / Platby a příkazy | ✅ | No payment setup rows for this contact (document may not contain payment data) |
| 5 | Coverage / payment setup propagated | ✅ | No payment data in document (acceptable for DIP without explicit payment instructions) |
| 6 | FV (fund valuation) visibility | ❌ | unavailable |
| 7 | No ghost success without downstream data | ✅ | Consistent |

## Blocking Issues
- Apply failed: Pre-apply validace selhala: Číslo smlouvy musí být vyplněno pro dokumenty životního cyklu: smlouva, návrh, potvrzení.; Jméno pojistníka / klienta / účastníka musí být vyplněno.; Název partnera (pojišťovna, banka, fond) musí být vyplněn.