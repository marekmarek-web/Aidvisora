# Truth Pack — Operator Runbook

**Verze:** 2026-04-23
**Owner:** Marek (solo on-call)
**Scope:** Executable truth-check tooling pro CRM / portál / AI Review / payments / KPI / business plan / offboarding.
**Předchůdce:** Data-Truth / KPI-Truth sanity pack (2026-04-23, konverzační artefakt — R1–R15, P1–P15, K1–K10, M1–M9, MV1–MV7).

---

## 0. Co tento pack je a co NENÍ

**Je to:**
- 3 SQL soubory v `scripts/ops/truth-pack/` pro ruční spuštění (read-only).
- 1 bash runner `run-all.sh` jako wrapper.
- Operátorský run order + thresholdy + go/no-go gate (tento dokument).
- 7 manuálních spot-check flows (MV1–MV7 níže).

**NENÍ to:**
- Žádný nový audit. Neobjevuje nové problémy — jen ověřuje známé.
- Neprovádí žádné write operace. `run-all.sh` je striktně read-only.
- Neprůběžný admin dashboard (scope v §IV, záměrně odložen).

---

## I. WHAT TO GENERATE — výstup této iterace

| # | Artefakt | Cesta | Typ |
|---|---|---|---|
| 1 | Propagation SQL (P1–P16) | `scripts/ops/truth-pack/00-propagation.sql` | SQL |
| 2 | KPI SQL (K1–K10) parametrizované | `scripts/ops/truth-pack/01-kpi.sql` | SQL |
| 3 | First-week daily monitoring (M1–M10) | `scripts/ops/truth-pack/02-monitoring.sql` | SQL |
| 4 | Orchestrátor + logování | `scripts/ops/truth-pack/run-all.sh` | shell |
| 5 | Tento runbook (thresholds, run order, go/no-go) | `docs/launch/truth-pack-runbook-2026-04-23.md` | md |
| 6 | Manuální spot-check checklist (MV1–MV7) | §V tohoto souboru | md |

Záměrně NE v této iteraci:
- Admin UI stránka `/portal/admin/truth-check` (scope v §IV).
- Scheduled cron wrapper (M1–M10 jako GitHub Action / Vercel Cron) — viz §IV.
- Grafana / PostHog dashboard → out of scope v1.0.

---

## II. FILES TO CREATE / CHANGE

**Nové soubory:**
- `scripts/ops/truth-pack/00-propagation.sql` — 16 propagation checks s `check_name/violations/expected/severity` kolumnou.
- `scripts/ops/truth-pack/01-kpi.sql` — 10 KPI queries, parametrizované přes `\set`.
- `scripts/ops/truth-pack/02-monitoring.sql` — 10 daily-monitoring queries.
- `scripts/ops/truth-pack/run-all.sh` — bash orchestrátor; tee do `.out/<timestamp>.log`.
- `scripts/ops/truth-pack/.gitignore` — ignoruje `.out/`.
- `docs/launch/truth-pack-runbook-2026-04-23.md` — tento dokument.

**Změny existujících souborů:** žádné v této iteraci.

Vazby (bez úpravy):
- `scripts/ops/pre-launch-verify.sql` — zůstává jako STEP 0 před touto packem (migration gates, RLS gates).
- `packages/db/queries/verify-bj-units-coverage-2026-04-22.sql` — podmnožina K2; spouštět nezávisle pro detail.
- `scripts/smoke-rls-aidvisora-app.sql` — spouštět pod `aidvisora_app` rolí, ne truth-pack.

---

## III. OPERATOR RUN ORDER

### Příprava (jednorázově)

```bash
# 1) Najdi tenant_id + advisor_user_id pro pilotní tenant
psql "$DATABASE_URL_SERVICE" -c "SELECT id, slug FROM tenants ORDER BY created_at LIMIT 10;"
psql "$DATABASE_URL_SERVICE" -c "SELECT user_id, role FROM memberships WHERE tenant_id='<uuid>';"

# 2) Nastav env pro spouštěcí session
export DATABASE_URL_SERVICE='postgres://postgres:...@...supabase.co:5432/postgres'
export TRUTH_TENANT_ID='<uuid pilotního tenantu>'
export TRUTH_ADVISOR_USER_ID='<uuid advisor usera pro K1>'
export TRUTH_CURRENT_USER_ID='<stejný user jako advisor — pro K6 inbox>'
```

> `DATABASE_URL_SERVICE` = service-role connection (BYPASSRLS). Nikdy necommitovat. Najdi v Supabase Dashboard → Project → Connection strings (password: service_role PGPASSWORD).

### Launch-day / ad-hoc sanity — přesné pořadí

Každý STEP má **stop-gate**. Pokud hard check flagne > 0, **nepokračuj** — řeš, pak re-run.

```
STEP 0 · Migration + RLS sanity
  psql "$DATABASE_URL_SERVICE" -f scripts/ops/pre-launch-verify.sql
  Gate: všechny check #1–#7 expected=0, #8a–#8e exists_count=1.

STEP 1 · Propagation
  ./scripts/ops/truth-pack/run-all.sh propagation
  Gate: všechny 'hard' severity = 0 violations. 'soft' log, nečeká.

STEP 2 · KPI cross-check proti UI
  ./scripts/ops/truth-pack/run-all.sh kpi
  Otevři v browseru:
    - /portal/team/production?period=month  → porovnej s K1
    - /portal/admin/analytics                → porovnej s K3 + K4
    - advisor bell (header)                  → porovnej s K6
    - Stripe Dashboard → Revenue            → porovnej s K8
  Gate: čísla se shodují na 3 náhodných trojicích (tenant, advisor, period).
        K2 pct_with_bj ≥ 95 %. K7 = 0 rows (žádný metric_type mimo canonical set).

STEP 3 · Monitoring baseline (launch T-0)
  ./scripts/ops/truth-pack/run-all.sh monitoring
  Gate: M2 max_lag_sec < 60. M3 pct_null < 5. M5 pct_failed < 1. M7 = 0. M9 age_h < 26.

STEP 4 · Manual spot-checks MV1–MV7 (§V níže)
  Na pilotním tenantu (seed + test klient). MV1–MV4 musí být zelené,
  MV5–MV7 = zdokumentovaný drift je OK.

STEP 5 · Go/no-go gate (§VI)
```

### Denní monitoring (first-week po launchi)

```bash
# Každý den v 9:00 CET
./scripts/ops/truth-pack/run-all.sh monitoring
# Po 72 h automatizuj — viz §IV „Scheduled cron scope".
```

---

## IV. OPTIONAL ADMIN UI SCOPE

Záměrně odloženo — SQL v Supabase editoru je pro launch dostatečné a levnější než UI. Tento scope je připraven **post-launch** (v1.1), pokud by byla potřeba.

### IV.A Stránka `/portal/admin/truth-check` (scope, NE teď)

**UI pattern:** kopíruj `/portal/admin/ai-quality` (již existuje, stejný layout `ADMIN → KpiCard + tabulky`).

```
apps/web/src/app/portal/admin/truth-check/
├── page.tsx                # "use client" + fetch server action
└── README.md               # scope + how to extend

apps/web/src/app/actions/admin-truth-check.ts
├── runPropagationChecks()  → { check_name, violations, expected, severity }[]
├── runKpiChecks()          → per-check tabulka (K1–K10 rows)
└── runMonitoringChecks()   → M1–M10 rows + lag metrics
```

**Obsah stránky:**
- KpiCard per každý hard check (green = 0, red = > 0).
- Tabulka s historií posledních N runů (read z `ops_truth_runs` append-only tabulky — nová migrace).
- "Run now" button (server action, RBAC = owner/admin).
- Export CSV (tabulka → download).

**Rozsah:** 1 den práce (1 page, 1 server action, 1 migrace pro `ops_truth_runs`).
**Gate kdy stavět:** až `run-all.sh` pouštíme > 5× týdně, tj. truth-check je provozní rutina a 3 lidi to potřebují vidět.

### IV.B Scheduled cron (M1–M10 daily)

**Forma:** nové Vercel Cron entry v `vercel.json` → hit `/api/admin/truth-monitor` (POST, protected `CRON_SECRET`).

Route:
```
apps/web/src/app/api/admin/truth-monitor/route.ts
- Spustí M1–M10 přes service role client (Supabase pg).
- Výsledky append do `ops_truth_runs`.
- Pokud jakýkoliv threshold překročen → Slack webhook (URL v env).
```

**Rozsah:** 0.5 dne. **Gate:** po T+7 dní, kdy máme baseline distribucí.

### IV.C Out of scope
- Grafana dashboardy. Sentry custom metrics. PostHog panely. → v1.2+.

---

## V. FIRST-WEEK TRUTH MONITORING FLOW

### V.A Thresholdy (operator reference)

#### Propagation (`00-propagation.sql`) — HARD gates

| Check | Hard/Soft | Threshold | Akce při fail |
|---|---|---|---|
| P1 applied review bez contractu | HARD | 0 | investigate mid-tx failure; replay `apply-contract-review` z audit logu |
| P2 applied review bez payloadu | HARD | 0 | stejně — mid-tx; resolve manually |
| P3 contract visible / payment hidden | SOFT | < 5 | manual toggle sync per row |
| P4 portal request marker drift | HARD | 0 | `setAdvisorPortalRequestHandling` re-apply; zkontroluj `customFields` writes |
| P5 orphan advisor_id | HARD | 0 | reassign na aktivního advisora; viz MV7 |
| P6 tasks/events/opps orphan assignee | HARD | 0 | reassign |
| P7 segment ≠ type | HARD | 0 | `UPDATE contracts SET type=segment WHERE segment<>type;` (po review) |
| P8 product_category drift | SOFT | 0 (UNKNOWN_REVIEW OK) | recompute BJ + re-classify |
| P9 contract.note leak | HARD | 0 | scrub note nebo `visible_to_client=false` |
| P10 PII duální čtení | SOFT → HARD po D2 | 0 po backfill | dokončit D2 backfill |
| P11 payment review bez setup | HARD | 0 | replay apply; log do Sentry |
| P12 orphan visible documents | HARD | 0 | `visible_to_client=false` nebo link |
| P13 household dupes | HARD | 0 | dedup přes `household-unique-contact` migration (mělo by být 0 po B2.7) |
| P14 stripe webhook failed 24h | SOFT | 0 | resend events ze Stripe Dashboard |
| P15 multi-active subscription | HARD | 0 | cancel duplicate in Stripe, webhook sync |
| P16 ai_review bez advisor_confirmed_at | HARD | 0 | set confirmed_at manually nebo flip source_kind |

#### KPI (`01-kpi.sql`) — go/no-go

| Check | Threshold | Akce |
|---|---|---|
| K1 production by segment | UI ↔ DB exact match na 3 trojicích | pokud diff → `recompute-all-bj.ts` |
| K2 BJ coverage | pct_with_bj ≥ 95 % pro active | recompute + re-extract u missing_cat rows |
| K3 executive funnel | shoda s `/portal/admin/analytics` | snapshot cron sanity |
| K4 payment portal readiness | monitor-only baseline | — |
| K5 active portal requests | match s `/portal/klientske-zony` | P4 rerun |
| K6 advisor inbox | match s bell UI | check `advisor_notifications` target_user_id |
| K7 business plan metric drift | 0 řádků | rename metric_type na canonical set |
| K8 monthly revenue | ±1 % proti Stripe Revenue | investigate webhook |
| K9 subscription status | sum ~ Stripe Dashboard | webhook sync |
| K10 time-to-apply | baseline, info-only | — |

#### Monitoring (`02-monitoring.sql`) — daily thresholds

| Check | Threshold | Red flag action |
|---|---|---|
| M1 stuck reviews / hour | 0 za 24 h | restart cron `stuck-contract-reviews`, pokud > 5 zombie → manual cleanup |
| M2 apply→contract lag | max < 60 s | Sentry trace, DB locks |
| M3 BJ NULL rate 24h | pct_null < 5 % | recompute; zkontroluj `product_category` extractor |
| M4 ghost payment setups 7d | 0 nových | audit `create-payment-setup` writer; měl by default false → visible toggle |
| M5 stripe webhook failed | pct_failed < 1 % | resend events, verify signing secret |
| M6 portal requests /day | info | — |
| M7 orphan advisor users | 0 | reassign; viz MV7 |
| M8 audit log volume | anomaly detection | porovnat s T-1 — vyšší řád → incident |
| M9 analytics snapshot age | < 26 h | re-run snapshot cron manuálně |
| M10 storage orphans | 0 | delete storage objekty bez DB row (po confirm) |

### V.B Check-in kadence (first 7 days)

| Okno | Frekvence | Co pouštět | Kdo |
|---|---|---|---|
| T+0 → T+4h | á 30 min | `monitoring` + Sentry | Marek |
| T+4h → T+24h | á 2 h | `monitoring` | Marek |
| T+24h → T+72h | á 6 h | `monitoring` | Marek |
| T+72h → T+7d | 1× denně 9:00 | `monitoring` | Marek |
| T+7d | 1× | `propagation` + `kpi` plný re-run | Marek |

### V.C Manuální spot-check flows (MV1–MV7)

Runtime ověření, které SQL sám nedokáže. **Na pilotním tenantu** (seed + test klient).

**MV1 · CRM truth** (15 min)
1. Vytvoř contact přes `/portal/contacts/new` → v DB ověř `contacts` row, `personal_id_ciphertext IS NOT NULL`, `personal_id IS NULL` (po D2).
2. Spoj 2 contacts do household → `household_members` má 2 rows, unique index drží.
3. Vytvoř opportunity → `assigned_to = auth user`, stage = první `sort_order`.
4. Přepiš `assigned_to` → tasks/events k opportunity se NEpřepíší.

**MV2 · Client portal truth** (20 min)
1. Client login na `/client` → vidí pouze contracts s `visible_to_client=true`, `portfolio_status IN ('active','ended')`.
2. `contracts.note` nikde v DOM (grep `document.body.innerHTML`).
3. Payment setup s `visible=false` → klient nevidí.
4. Klient vytvoří request → `opportunities.custom_fields.client_portal_request=true`, `advisor_notifications` row existuje.
5. Cancel klientem → `closed_at != null`, `closed_as='lost'`, `custom_fields.client_portal_cancelled=true`.
6. Advisor "Vyřešeno" → notification `status='read'`, `custom_fields.advisor_portal_handling='resolved'`.

**MV3 · AI Review publish truth** (30 min)
1. Upload PDF → review row: `uploaded` → `processing` → `extracted`/`review_required`.
2. Approve + apply → **1** contract + 1 payment_setup (pokud payment intent) + documents link.
3. Re-apply (idempotency) → žádný duplicate contract.
4. Upload stejného PDF znovu → `resolveExistingContractForDedup` zablokuje duplicate.
5. Reject → `review_status='rejected'`, žádný contract, audit log.
6. Ověř `contracts.source_contract_review_id = review.id`, `advisor_confirmed_at != null`.

**MV4 · Payments truth** (15 min)
1. Manual payment modal → default `visible_to_client=false` (D6/B2.12).
2. Ghost scenario: `status='active'` + `visible=false` → po 30 dnech se objeví v pre-launch check #6 a M4.
3. Conseq DPS → `constant_symbol='558'`. ČPP → `700135002/0800` (main) vs. `700485002/0800` (extra).
4. Stripe trigger `invoice.payment_failed` (stripe-cli) → `subscriptions.failed_payment_attempts++`, email odchází.

**MV5 · KPI truth** (20 min)
1. `/portal/team/production?period=month` — poznač `totalBjUnits`, `totalCount`.
2. K1 s `:advisor_user_id` a `:tenant_id` → musí sedět.
3. Změň `advisor_confirmed_at` na `start_date - 1 day` → KPI spadne.
4. `pnpm tsx apps/web/scripts/recompute-all-bj.ts` → `bj_units` se přepočítá, KPI zpět.

**MV6 · Business plan truth** (10 min, dokumentovaný drift OK)
1. Target `bj_units=50`, 10× contract á 5 → progress 100 %.
2. Offboard poradce → `advisor_id` přepsáno, bývalý poradce BP actuals = 0 (D5/B4.14 known drift).
3. Successor poradce → K1 zobrazí celých 50 BJ.

**MV7 · Offboarding truth** (15 min)
1. `previewOffboarding(tenantId, userId)` → poznač counts.
2. `executeOffboarding(...)` → ověř tasks/events/opportunities/contracts.advisor_id přepsány; `user_*_integrations` + `user_devices` = 0; BP + preferences departingUserId zachovány.
3. Departing production report = 0. Successor obsahuje vše.

---

## VI. GO / NO-GO GATE

**Před kliknutím Submit / Release / Promote** musí platit VŠE:

- [ ] `scripts/ops/pre-launch-verify.sql` — všechny hard checks zelené.
- [ ] `run-all.sh propagation` — každý 'hard' severity check = 0 violations.
- [ ] `run-all.sh kpi` — K2 ≥ 95 %, K7 = 0 rows, K1 UI ↔ DB shoda 3/3 trojic.
- [ ] `run-all.sh monitoring` — M2 < 60 s, M3 < 5 %, M5 < 1 %, M7 = 0, M9 < 26 h, M10 = 0.
- [ ] MV1–MV4 spot-checks zelené na pilotním tenantu.
- [ ] MV5–MV7 dokumentovaný drift potvrzen (není blocker, je known).
- [ ] Log z posledního runu archivován (`scripts/ops/truth-pack/.out/<ts>.log`).

**Pokud kterýkoli hard fail → NEspouštět launch.** Fix → re-run → gate.

---

## VII. CO TENTO PACK NEUMÍ (flagy pro manual verify)

- **Stripe reálný stav** — K8/K9 jdou proti naší `invoices`/`subscriptions`, ne proti Stripe API. Manual cross-check v Dashboard.
- **PostHog / Sentry** — M8 vidí jen audit_log; Sentry incidenty A1–A12 = manual (viz `docs/audit/pre-launch-verify-checklist-2026-04-22.md` §14).
- **RLS runtime test** — `scripts/smoke-rls-aidvisora-app.sql` musí běžet **separately** pod `aidvisora_app` rolí, ne service.
- **APNs/FCM push** — manual device test; viz store-submission §IV.E.
- **Edge Config kill-switches** — manual v `/portal/admin/kill-switches`.
- **Mobile scan flow** — MV3 je DB-truth; fyzický device test = launch-ops pack §II.C.

---

## VIII. Apendix — quick reference

### Spuštění ze shellu (TL;DR)

```bash
cd /Users/marekmarek/Developer/Aidvisora
export DATABASE_URL_SERVICE='...'
export TRUTH_TENANT_ID='...'
export TRUTH_ADVISOR_USER_ID='...'
export TRUTH_CURRENT_USER_ID='...'

./scripts/ops/truth-pack/run-all.sh all
# → log v scripts/ops/truth-pack/.out/<ts>-all.log
```

### Spuštění v Supabase SQL editoru

Supabase editor **nepodporuje psql meta-příkazy** (`\echo`, `\set`, `:'var'`). SQL soubory jsou proto
čistý Postgres. KPI soubor má tokeny `:TENANT_ID`, `:ADVISOR_USER_ID`, `:CURRENT_USER_ID` které
musíš ručně najít-a-nahradit **před** Run.

1. Otevři [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard) (Role: `postgres` nebo service role).
2. **`00-propagation.sql`** → paste celý → Run → screenshot.
3. **`01-kpi.sql`** — najdi-a-nahraď (Cmd+F → Replace all) **před** Run:
   - `:TENANT_ID`          → `'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid`
   - `:ADVISOR_USER_ID`    → `'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid`
   - `:CURRENT_USER_ID`    → `'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid`

   UUID získáš:
   ```sql
   SELECT id, slug FROM tenants ORDER BY created_at;
   SELECT user_id, role FROM memberships WHERE tenant_id = '<uuid>';
   ```
4. **`02-monitoring.sql`** → paste celý → Run.
5. Archivuj CSV (tlačítko "Download") nebo screenshot → 1Password „Aidvisora / Truth runs".

> Pozn.: Supabase editor typicky zobrazí **pouze poslední `SELECT`**. Pokud chceš vidět všechny
> kontroly, spouštěj je po blocích (P1, P2, …) nebo použij `run-all.sh` přes psql.

### Kontaktní body

- Sanity pack source (konverzační): agent transcript `852286bd-52c3-4b68-8f66-7deecb75221a` (2026-04-23).
- Pre-launch SQL upstream: `scripts/ops/pre-launch-verify.sql`.
- BJ units detail: `packages/db/queries/verify-bj-units-coverage-2026-04-22.sql`.
- Launch-ops pack: [`docs/launch/store-submission-launch-ops-pack-2026-04-23.md`](store-submission-launch-ops-pack-2026-04-23.md).

---

*Konec runbooku. Pokud truth-pack něco flagne, log do `docs/launch/truth-pack-log.md` (datum, check_name, violations, fix).*
