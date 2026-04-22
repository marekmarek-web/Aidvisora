# Native scan Tier 1 — Acceptance test matrix

Tento dokument je **acceptance gate** pro každý nový TestFlight / Play Internal build,
který obsahuje nativní Document Scanner flow + AI Review extrakci.

Cíl: ověřit, že kompletní flow **foto smlouvy → scan → PDF → upload → AI Review → CRM** funguje
na reálném zařízení, ne jen v dev shellu.

## Pre-requisites

- Build nainstalován přes TestFlight (iOS) / Play Internal opt-in URL (Android).
- Testovací účet poradce s povolenou `/portal/scan` routou.
- Aspoň 2 papírové smlouvy po ruce:
  - **Čistá pojistná smlouva** (dobré osvětlení, rovná, ostrá).
  - **Komisionářská smlouva scan.pdf** (typický reálný image-only scan — anchor case).

## Matrix

Legenda: ✅ PASS (fwd do produkce) · ⚠️ SOFT PASS (produce jen s flagem / disclaimerem) · ❌ FAIL (blokuje release).

### 1. Native scanner — happy path

| # | Krok | iOS | Android | Poznámka |
|---|------|-----|---------|----------|
| 1.1 | Otevřít `/portal/scan` → tlačítko "Skenovat dokument (systémový skener)" je viditelné |  |  | Jen v nativním shellu, ne Safari / Chrome web. |
| 1.2 | Ťuknout → OS requestne kamera permission → Allow |  |  | Žádost musí být česky. |
| 1.3 | VisionKit (iOS) / ML Kit Document Scanner (Android) se otevře |  |  | První spuštění Androidu stahuje ML Kit modul — čekej max 30 s. |
| 1.4 | Naskenovat 1 čistou stránku → Uložit |  |  | Auto-crop + deskew funguje. |
| 1.5 | Stránka se objeví v UI `/portal/scan` jako scan s náhledem |  |  |  |
| 1.6 | Naskenovat další 2 stránky (celkem 3) |  |  | Sequence zachována. |
| 1.7 | Změnit pořadí stránek (drag & drop) + smazat jednu |  |  |  |
| 1.8 | "Pokračovat" → PDF se vygeneruje + uploadne |  |  | Loading spinner < 30 s. |
| 1.9 | AI Review stránka se otevře s klasifikací |  |  | Musí být `supporting` / `primary` / sub-type. |
| 1.10 | V AI Review panelu vidíš aspoň některé `ConfidencePill` badge |  |  | Vysoká / Střední / Nízká. |

### 2. Native scanner — error paths

| # | Krok | iOS | Android | Poznámka |
|---|------|-----|---------|----------|
| 2.1 | Ťuknout na skener → "Storno" (zrušit) |  |  | `/portal/scan` zůstane v klidu, žádný red banner. |
| 2.2 | V Nastavení OS vypnout kamera permission pro Aidvisora → zkusit znovu |  |  | Žlutá / yellow copy: "Aplikace nemá povolený přístup ke kameře…". |
| 2.3 | Povolit kameru zpět → ťuknout znovu → skener se otevře |  |  |  |
| 2.4 | Letadlo mode (offline) → dokončit scan → "Pokračovat" na upload |  |  | Error: "Připojení k internetu chybí", žádný crash. |
| 2.5 | Online zpět → retry upload → úspěch |  |  |  |

### 3. AI Review extraction (anchor case: Komisionářská smlouva scan.pdf)

| # | Krok | Výsledek | Poznámka |
|---|------|----------|----------|
| 3.1 | Naskenovat / uploadnout Komisionářská smlouva scan.pdf |  | Primary type by měl být `mandate_agreement` / `brokerage_mandate` (ne `consent_or_declaration`). |
| 3.2 | AI Review zobrazí klasifikaci + confidence |  |  |
| 3.3 | Klíčová pole (jméno poradce, klient, IČO, datum) jsou vytěžená |  | Aspoň 60 % required fields mělo by mít value. |
| 3.4 | Pokud nějaké required pole chybí + `AI_REVIEW_PAGE_IMAGE_FALLBACK=true`, fallback by se měl spustit |  | `sourceKind: page_image_fallback` badge + cap confidence 0.7. |
| 3.5 | "Propsat do CRM" → contact / contract / payment setup se vytvoří |  | Ověřit v detail stránce klienta. |

### 4. Web fallback (non-native shell) — regression

| # | Krok | Výsledek | Poznámka |
|---|------|----------|----------|
| 4.1 | Otevřít `/portal/scan` v mobile Safari (ne nativní app) |  | Tlačítko "systémový skener" **nesmí** být viditelné. |
| 4.2 | Quick upload PDF → AI Review funguje |  |  |
| 4.3 | Foto z kamery (mobile web) → normalize → AI Review |  |  |
| 4.4 | HEIC upload z galerie → server convert → AI Review |  |  |

### 5. Performance + stability

| # | Měření | Target iOS | Target Android |
|---|--------|-----------|----------------|
| 5.1 | Čas od ťuknutí na skener do otevření VisionKit / ML Kit | < 1 s | < 3 s (1. run), < 1 s (další) |
| 5.2 | Čas od "Pokračovat" do AI Review render | < 45 s pro 3 stránky |
| 5.3 | Paměť během scan + upload (Xcode debugger / Android Profiler) | < 400 MB | < 500 MB |
| 5.4 | Crash rate v Sentry první 24 h po releasi | < 0.5 % sessions |

## Rozhodovací strom

- **Všechny ✅** → fwd do External Testing / Closed Testing.
- **1+ ❌ v sekci 1 nebo 2** → HOLD, fix + nový build.
- **1+ ❌ v sekci 3** → fwd do Internal jen s disclaimerem v release notes
  ("AI Review scan extraction je beta, kontrolujte extrahovaná pole").
- **1+ ❌ v sekci 4** → HOLD — regrese webového flow je nepřípustná.
- **1+ ❌ v sekci 5** → fwd, ale otevřít ticket na perf optimization.

## Sign-off

| Role | Jméno | Datum | Podpis |
|------|-------|-------|--------|
| Eng | | | |
| Product | | | |
| QA (poradce-tester) | | | |
