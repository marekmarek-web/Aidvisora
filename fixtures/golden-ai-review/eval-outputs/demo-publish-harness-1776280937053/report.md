# Demo Publish Harness — Report

- **Generated:** 2026-04-15T19:22:17.053Z
- **Input document:** `Marek Marek Uniqa.pdf`
- **Matched client:** Jiří Chlumecký (`10cc19a4-4e8d-4250-b6a6-3b657d536c67`)

## Pipeline
- OK: ano
- Segment: ZP
- Contract number: 8800279286
- Institution: UNIQA pojišťovna, a.s.
- Product: Život & radost

## Apply
- OK: ne
- Error: invalid input syntax for type uuid: "demo-harness-1776280937053"
- Created/updated contract ID: —
- Payment setup ID: —

## Downstream Checks
| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | Contract/product artifact created | ❌ | invalid input syntax for type uuid: "demo-harness-1776280937053" |
| 2 | Advisor product card / products tab readable | ❌ | Not checked (no contract) |
| 3 | Client portal / Portfolio readable | ❌ | Not checked |
| 4 | Client portal / Platby a příkazy | ✅ | No payment setup rows for this contact (document may not contain payment data) |
| 5 | Coverage / payment setup propagated | ✅ | No payment data in document (acceptable for DIP without explicit payment instructions) |
| 6 | FV (fund valuation) visibility | ❌ | unavailable |
| 7 | No ghost success without downstream data | ✅ | Consistent |

## Blocking Issues
- Apply failed: invalid input syntax for type uuid: "demo-harness-1776280937053"