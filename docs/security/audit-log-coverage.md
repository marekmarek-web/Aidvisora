# Audit Log Coverage — WS-2 (launch)

> Interní dokument popisující, **co Aidvisora zaznamenává do `audit_log`**, kde se
> audit generuje v kódu a jaké záruky (append-only, tenant scope) platí.
>
> Nástroj je interní pro finanční poradce. Audit zde slouží pro tenant isolation
> compliance, incident response a interní dohled, ne pro klientský výstup.

---

## 1. Tabulka `public.audit_log`

Schéma (výběr relevantních sloupců):

- `id uuid` — PK.
- `tenant_id uuid` — vždy povinné, scope RLS.
- `user_id uuid` — actor (přihlášený uživatel) nebo `null` u system jobů.
- `action text` — stabilní technická konstanta (viz §3).
- `entity_type text`, `entity_id uuid` — cíl akce.
- `meta jsonb` — strukturovaný context (nikdy ne plná PII, viz §5).
- `ip_address`, `user_agent` — z requestu (když je dostupný).
- `created_at timestamptz default now()`.

### 1.1. Append-only guard

Migrace: `packages/db/migrations/audit-log-append-only-2026-04-20.sql`.

- `UPDATE` a `DELETE` RLS policy byly **DROPPED** pro všechny role.
- `REVOKE UPDATE, DELETE` od `PUBLIC`, `authenticated`, `anon`, `aidvisora_app`.
- Následek: řádek jde pouze **INSERTNOUT**. Modifikace vyžaduje zásah superuser
  role (ops) a je per se alarm. V případě compliance auditu = silná záruka.

---

## 2. Aplikační helpery

`apps/web/src/lib/audit.ts` vystavuje:

- `logAudit(params)` — await-able async varianta; použij v API routech a Server
  Actions, kde chceš selhání auditu hlásit (vzácně).
- `logAuditAction(params)` — fire-and-forget varianta; nesmí blokovat uživatelský
  flow. Použij v hot-path akcích (delete, update, role change, signed URL).

Oba helpery:

- Zvalidují `tenantId` + `action`.
- Z request Headers extrahují IP + UA.
- Píší přímo do `audit_log` přes Drizzle v `withTenantContext`.

---

### 2.1. Assistant / AI audit wrapper (sjednocená nomenklatura)

Historicky v plánech figuruje pojem „ai_action_log" — **samostatná tabulka
`ai_action_log` NEEXISTUJE**. Všechny AI eventy se píší do stejné `audit_log`
tabulky přes `lib/ai/assistant-audit.ts → logAssistantEvent()`, který wrappuje
`logAudit` a:

- prefixuje action namespace `assistant:` (např. `assistant:tool_invoked`,
  `assistant:draft_approved`, `assistant:action_applied`, `assistant:permission_denied`),
- maskuje senzitivní stringy v `meta` (IBAN/rodné číslo/číslo účtu) přes
  `maskSensitive()` a označí zápis `meta.masked = true`,
- používá `entityType = "assistant"` jako default.

Dopady pro audit:

- query pro „AI akce" = `WHERE action LIKE 'assistant:%'`,
- query pro „core compliance" = `WHERE action NOT LIKE 'assistant:%'`,
- tenant scope + append-only záruka je u obou stejná (jsou to řádky v téže tabulce).

V dokumentaci a plánech proto **používáme výraz `audit_log` jako jediné uložiště**
a „AI audit" je jen jeho logická podmnožina přes `assistant:*` prefix.

---

## 3. Pokryté akce (launch scope)

Pokrytí ověřeno testem
`apps/web/src/lib/security/__tests__/ws2-batch2-audit-coverage.test.ts` (static code
scan) a
`ws2-batch5-pii-signed-url-audit.test.ts` (signed URL a avatar proxy route).

### 3.1. Contacts / PII

| Action | Callsite | Poznámka |
|---|---|---|
| `contact.deleted` | `apps/web/src/app/actions/contacts.ts` | Soft delete (`archived`) + permanent delete — oba audituje. |
| `contact.archived` | `apps/web/src/app/actions/contacts.ts` | — |
| `contact.updated` | `apps/web/src/app/actions/contacts.ts` | — |

### 3.2. GDPR / Export

| Action | Callsite |
|---|---|
| `gdpr.export.requested` | `apps/web/src/app/actions/gdpr.ts` |
| `gdpr.export.completed` | `apps/web/src/app/actions/gdpr.ts` |

### 3.3. Role / Team management

| Action | Callsite |
|---|---|
| `team.role.changed` | `apps/web/src/app/actions/team.ts` |
| `team.member.invited` | `apps/web/src/app/actions/team.ts` |
| `team.member.removed` | `apps/web/src/app/actions/team.ts` |

### 3.4. Storage / Signed URLs

| Action | Callsite | Poznámka |
|---|---|---|
| `signed_url.generated` | `apps/web/src/lib/storage/signed-url.ts` | TTL ≤ 1 h, `pathHash` (ne plná cesta) v meta. |
| `storage.signed_url_failed` | `apps/web/src/app/api/storage/avatar/route.ts` | Fallback, když createSignedUrl vrátí `null`. |

### 3.5. Documents / Contract review

| Action | Callsite |
|---|---|
| `document.downloaded` | `apps/web/src/app/api/documents/[id]/download/route.ts` |
| `contract.review.published` | `apps/web/src/app/actions/ai-review.ts` (dle existující coverage) |

### 3.6. Auth / Sessions

| Action | Callsite |
|---|---|
| `auth.login` | middleware / auth handler |
| `auth.logout` | middleware / auth handler |
| `auth.password.changed` | Supabase Auth hook → audit sync |

### 3.7. Assistant / AI (namespace `assistant:*`)

Viz §2.1. Produkované callsitem `logAssistantEvent()` v
`apps/web/src/lib/ai/assistant-audit.ts`:

| Action | Význam |
|---|---|
| `assistant:assistant_opened` | Drawer otevřen uživatelem. |
| `assistant:assistant_query` | Dotaz do LLM (maskovaný prompt v meta). |
| `assistant:tool_invoked` | Tool/function call. |
| `assistant:action_suggested` | AI navrhla akci. |
| `assistant:draft_created` | Vytvořen draft k review. |
| `assistant:draft_approved` / `draft_rejected` | Rozhodnutí poradce. |
| `assistant:action_applied` | Akce potvrzena a zapsaná do CRM. |
| `assistant:permission_denied` | Pokus zablokovaný RBAC/plan capabilities. |
| `assistant:quality_gate_override` | Poradce override AI guardrail. |

---

## 4. Záruky

1. **Tenant isolation** — každá akce má povinný `tenantId`. RLS na `audit_log`
   filtruje tenantem. Read side nesmí nikdy číst cross-tenant (ani pro admin UI —
   admin má vlastní scope).
2. **Append-only** — viz §1.1.
3. **Signed URL privacy** — v meta logujeme `pathHash` (stabilní, krátký hash),
   nikdy plnou cestu. Cesta může obsahovat UUID klienta → nechceme ji v audit logu.
4. **Fail-open na aplikační úrovni** — audit selhání (síť, DB connection) nesmí
   blokovat user-facing akci. Proto `logAuditAction` je fire-and-forget. Pro
   kritické compliance události (`gdpr.*`) používáme `logAudit` a s retry.

---

## 5. Co NELOGOVAT

- **Plaintext PII** — rodné číslo, OP, číslo účtu, datum narození → nikdy do
  `meta`. Pokud je třeba referenci, použij `fingerprintPii` (HMAC) nebo `entityId`.
- **Tokeny / secrets** — OAuth accessy, Supabase service role, webhook secrets.
- **Plné cesty ve Storage** — jen `pathHash`.
- **Request body v plné velikosti** — jen akce a změněná pole (diff-like metadata).

---

## 6. Retention

- Launch: **drž vše.** Tabulka je append-only a růst je pomalý (řádky/den řádu
  jednotek stovek per tenant).
- Enterprise hardening (post-launch): separace hot/cold auditu — přesun řádků
  starších než 180 dní do `audit_log_archive` (immutable bucket / cold Postgres).
  Mimo launch scope.

---

## 7. Monitoring

- Dashboard nad `audit_log` by měl hlídat:
  - spike `contact.deleted` / `gdpr.*` per tenant (abnormální = alert),
  - `storage.signed_url_failed` spike (IAM problém, klíč, regionální výpadek),
  - `team.role.changed` (privilege escalation audit).
- Alerting mimo scope W6; součástí ops checklistu.
