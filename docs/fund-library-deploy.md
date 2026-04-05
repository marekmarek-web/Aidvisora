# Fondová knihovna — deploy DB a post-deploy kontrola

Krátká **release poznámka**: před prvním použitím Fondová knihovna / fronta „Chci přidat fond“ na **cílové** DB musí být aplikovaná migrace **`0020_fund_library_settings`** (nebo ekvivalentní SQL). Bez toho server actions při ukládání nastavení nebo fronty skončí chybou (typicky chybějící sloupec / tabulka).

Hlubší ruční QA: [`fund-library-manual-qa.md`](./fund-library-manual-qa.md).

Inventář assetů (placeholder vs. hotové soubory): [`fund-library-asset-inventory.md`](./fund-library-asset-inventory.md).

---

## Deploy readiness lock (execute plán — fáze 1)

- **Poslední Drizzle migrace pro fondovou knihovnu:** tag `0020_fund_library_settings` v `packages/db/drizzle/meta/_journal.json`. Pro ověření na DB: `SELECT * FROM __drizzle_migrations ORDER BY id;` — musí být řádek obsahující `0020_fund_library_settings`.
- **Portal + FA schéma:** migrace `0017_portal_fa_schema_sync` je v journal před 0020 — při čistém `pnpm db:migrate` z aktuálního repa proběhne v pořadí.
- **Portálový chat (zprávy):** tabulky `messages` / `message_attachments` nejsou součástí Drizzle journalu; pokud prostředí používá chat, ověřte nebo aplikujte idempotentní skript [`packages/db/migrations/portal_messages_tables.sql`](../packages/db/migrations/portal_messages_tables.sql).
- **Poznámka k souborům ve `packages/db/drizzle/`:** mohou existovat číslované `.sql` soubory, které **nejsou** v `_journal.json` (historické nebo mimo hlavní řetězec). Ostrý deploy řiďte výstupem `pnpm db:migrate`, ne ručním výběrem podle názvu souboru.

### Blocker vs. non-blocker (shrnutí)

| Blocker | Non-blocker |
|---------|-------------|
| `0020` neaplikovaná na DB, kterou používá app | Placeholder SVG u části fondů |
| `DATABASE_URL` app ≠ DB po migraci | Batch D (CREIF/ATRIS/Penta) na legacy cestách v `public/report-assets/` |
| zápis fronty / `fund_library` / FA ukládání → 500 | Textové loga v PDF |
| PDF route 500 po smoke testu | Drobná kosmetika textů v modalu |

---

## Co migrace zavádí

- Sloupec **`advisor_preferences.fund_library`** (jsonb) — pořadí a zapnutí fondů u poradce.
- Tabulka **`fund_add_requests`** + index **`fund_add_requests_tenant_created_idx`** + FK na **`tenants`**.
- Idempotentní **UPDATE** starších hodnot **`status`** ve frontě (`under_review` → `in_progress`, atd.).

**Whitelist tenantu** (`tenant_settings`, klíč `fund_library.allowlist`) **novou migraci nepotřebuje** — používá existující tabulku.

Zdrojové soubory v repu:

- Drizzle: `packages/db/drizzle/0020_fund_library_settings.sql` (záznam v `packages/db/drizzle/meta/_journal.json`).
- Ruční kopie: `packages/db/migrations/fund_library_settings_2026-04-06.sql` (+ volitelně `fund_library_z_status_normalize_2026-04-07.sql` — duplicitní UPDATE).
- Součást celkového schématu: `packages/db/supabase-schema.sql` a patch v `packages/db/src/apply-schema.ts` / `apply-schema.mjs`.

---

## Přesný postup na cílovém prostředí

### Předpoklady

1. Zastav se v **kořeni repozitáře** (`Aidvisora/`).
2. Nastav **`DATABASE_URL`** (nebo **`SUPABASE_DB_URL`**) na **tu samou** Postgres instanci a databázi, kterou používá produkční (nebo staging) **`apps/web`** — včetně pooleru, pokud ho aplikace používá.
3. Migrační skript načítá env z **`apps/web/.env.local`**, pokud existuje. Na CI/produkci typicky exportuješ proměnnou přímo v kroku deploy pipeline **před** `pnpm db:migrate`.

### Varianta A — doporučeno: Drizzle migrátor

```bash
cd /cesta/k/Aidvisora
export DATABASE_URL="postgresql://..."   # pokud nečteš z apps/web/.env.local
pnpm db:migrate
```

Očekávaný výstup: `Migrations done.` a ukončení s kódem **0**.

Drizzle si píše stav do tabulky **`__drizzle_migrations`**. Po úspěšném běhu musí být v historii záznam o migraci s tagem odpovídajícím **`0020_fund_library_settings`**.

### Varianta B — Supabase SQL Editor (bez `pnpm`)

1. Otevři **Supabase → SQL Editor** (nebo jiný klient na stejnou DB).
2. Zkopíruj a spusť **celý** obsah souboru  
   **`packages/db/drizzle/0020_fund_library_settings.sql`**  
   (je ekvivalentní logice s `fund_library_settings_2026-04-06.sql` včetně UPDATEů na konci 0020).
3. Volitelně znovu spusť **`fund_library_z_status_normalize_2026-04-07.sql`** — jen idempotentní opakování UPDATEů; na čisté DB nic nezmění.

### Varianta C — širší synchronizace schématu

```bash
pnpm db:apply-schema
```

Aplikuje **`supabase-schema.sql`** + **patch** z `apply-schema` (mj. `fund_library` a `fund_add_requests`). Použij jen pokud víš, že chceš **celý** patch prostředí znovu sladit — není to „jen“ fondová knihovna.

---

## Post-deploy smoke test (~5 min)

Spusť na **nasazené** URL s reálným účtem (ideálně Admin + poradce).

| # | Kontrola |
|---|----------|
| 1 | **Migrace:** žádná 500 při prvním vstupu do Nastavení → Fondy (pokud nevíš jistě, ověř sloupec/tabulku v DB). |
| 2 | **Tenant whitelist:** jako Admin — změna checkboxu, **Uložit nastavení firmy**, refresh → stav drží. |
| 3 | **Moje fondy:** toggle + případně pořadí, **Uložit moje fondy**, refresh → drží. |
| 4 | **Chci přidat fond:** odeslat požadavek → řádek ve frontě. |
| 5 | **FA:** investice do povoleného fondu → **uložit** analýzu bez chyby. |
| 6 | **PDF:** vygenerovat z téže analýzy → soubor se otevře / stáhne bez chyby. |
| 7 | **Legacy analýza:** otevřít starší uloženou FA → uložit znovu bez chyby; v investicích žádný nový řádek s `alternative` ani „World ETF“ jako nový default (viz unit testy fondové knihovny). |

Kritéria *blocker / non-blocker* jsou v sekci **Deploy readiness lock** výše.
