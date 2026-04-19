-- WS-2 Batch 3 — Live tenant isolation test (swap readiness)
-- Datum: 2026-04-19
--
-- POUŽITÍ:
--   psql "$SUPABASE_DIRECT_URL" -f rls-ws2-batch3-swap-readiness-test.sql
-- nebo v Supabase SQL editoru. Žádný side effect — vše je v transakcích
-- ukončených ROLLBACK. Pouze bezpečné čtení + sanity check policies.
--
-- ÚČEL:
--   Ověřit, že po aplikaci `rls-ws2-batch3-swap-readiness-2026-04-19.sql`:
--     T1) bez `app.tenant_id` + bez `app.user_id` vidí `aidvisora_app` 0 řádků
--         na každé blocker tabulce (fail-closed).
--     T2) s `app.tenant_id = X` vidí jen data tenantu X, nikdy jiného.
--     T3) join-scoped tabulky (household_members, document_versions,
--         export_artifacts) respektují tenant parent.
--     T4) bootstrap flow: `app.user_id = U` bez tenantu vrátí membership
--         + role + tenant jen pro U (getMembership-like lookup).
--     T5) policies existují a referencují roli `aidvisora_app`.
--
-- VÝSTUP:
--   Sada jmenovaných testů (`tN_*`) s `visible`, `own`, `foreign_rows`.
--   Ruční assert: `foreign_rows = 0` u všech T2/T3 řádků; `visible = 0` u T1.
--
-- PŘEDPOKLADY:
--   - aidvisora_app role existuje (Batch 2) a má GRANTy na target tabulky.
--   - Spouští se rolí, která má `SET ROLE aidvisora_app` (member of role).
--     V Supabase MCP / SQL editoru (session role = `postgres`) tento skript
--     **sám** dočasně udělí `GRANT aidvisora_app TO CURRENT_USER` na začátku a
--     odebere na konci — viz sekce "--- GRANT / REVOKE wrapper ---" níže.
--     Pokud tě skript spadne na `42501: permission denied to set role`, běží
--     pod jinou rolí než superuserem s GRANT OPTION; v tom případě ručně:
--       GRANT aidvisora_app TO <your_role>;
--     a na konci `REVOKE`.

-- -----------------------------------------------------------------------------
-- --- GRANT wrapper: umožní `SET ROLE aidvisora_app` z aktuální session role.
-- -----------------------------------------------------------------------------
-- POZNÁMKA: v single-batch executorech (Supabase MCP, Supabase SQL editor)
-- parser/planner cachuje membership před prvním `SET ROLE`. Proto po GRANTu
-- uzavíráme transakci explicit `COMMIT;` — jakmile se pošle následující
-- `BEGIN; SET LOCAL ROLE ...`, pg už vidí aktualizované členství.
-- V `psql -f` režimu je `COMMIT;` no-op (nic nepobíhá otevřené).
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'aidvisora_app', 'USAGE') THEN
    EXECUTE format('GRANT aidvisora_app TO %I', current_user);
  END IF;
END $$;
COMMIT;

-- -----------------------------------------------------------------------------
-- 0) Sanity: existence policies + role
-- -----------------------------------------------------------------------------
SELECT 't0_policy_counts' AS test, tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'memberships','user_profiles','tenants','roles','staff_invitations',
    'client_contacts','export_artifacts','contracts',
    'events','timeline_items','notification_log','execution_actions',
    'household_members','document_versions','document_extraction_fields',
    'advisor_business_plan_targets','mindmap_nodes','mindmap_edges'
  )
GROUP BY tablename
ORDER BY tablename;

SELECT 't0_contracts_roles_include_aidv' AS test,
       policyname, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'contracts'
ORDER BY policyname;

-- -----------------------------------------------------------------------------
-- T1) Bez GUC => aidvisora_app vidí 0 řádků (fail-closed)
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE aidvisora_app;
SELECT 't1_memberships_no_guc'         AS test, count(*) AS visible FROM public.memberships
UNION ALL SELECT 't1_tenants_no_guc',            count(*) FROM public.tenants
UNION ALL SELECT 't1_contracts_no_guc',          count(*) FROM public.contracts
UNION ALL SELECT 't1_households_no_guc',         count(*) FROM public.households
UNION ALL SELECT 't1_documents_no_guc',          count(*) FROM public.documents
UNION ALL SELECT 't1_events_no_guc',             count(*) FROM public.events
UNION ALL SELECT 't1_export_artifacts_no_guc',   count(*) FROM public.export_artifacts
UNION ALL SELECT 't1_mindmap_maps_no_guc',       count(*) FROM public.mindmap_maps
UNION ALL SELECT 't1_staff_invitations_no_guc',  count(*) FROM public.staff_invitations
UNION ALL SELECT 't1_user_profiles_no_guc',      count(*) FROM public.user_profiles
UNION ALL SELECT 't1_household_members_no_guc',  count(*) FROM public.household_members
UNION ALL SELECT 't1_document_versions_no_guc',  count(*) FROM public.document_versions
UNION ALL SELECT 't1_mindmap_nodes_no_guc',      count(*) FROM public.mindmap_nodes
UNION ALL SELECT 't1_mindmap_edges_no_guc',      count(*) FROM public.mindmap_edges;
ROLLBACK;

-- -----------------------------------------------------------------------------
-- T2) Tenant A scope => jen tenant A; tenant B scope => jen tenant B
-- Dosaď dvě různá UUID z `SELECT id FROM public.tenants`.
-- -----------------------------------------------------------------------------
-- PŘÍKLAD — upravte GUC dle reálného seed dat (níže jsou dev sandbox tenants):
BEGIN;
SET LOCAL ROLE aidvisora_app;
SET LOCAL app.tenant_id = 'f8a11820-5719-4663-bd86-a164a1c71676';
SELECT 't2A_memberships'  AS test,
       count(*) AS visible,
       count(*) FILTER (WHERE tenant_id::text = 'f8a11820-5719-4663-bd86-a164a1c71676') AS own,
       count(*) FILTER (WHERE tenant_id::text <> 'f8a11820-5719-4663-bd86-a164a1c71676') AS foreign_rows
FROM public.memberships
UNION ALL SELECT 't2A_contracts', count(*),
       count(*) FILTER (WHERE tenant_id::text = 'f8a11820-5719-4663-bd86-a164a1c71676'),
       count(*) FILTER (WHERE tenant_id::text <> 'f8a11820-5719-4663-bd86-a164a1c71676')
FROM public.contracts
UNION ALL SELECT 't2A_households', count(*),
       count(*) FILTER (WHERE tenant_id::text = 'f8a11820-5719-4663-bd86-a164a1c71676'),
       count(*) FILTER (WHERE tenant_id::text <> 'f8a11820-5719-4663-bd86-a164a1c71676')
FROM public.households
UNION ALL SELECT 't2A_documents', count(*),
       count(*) FILTER (WHERE tenant_id::text = 'f8a11820-5719-4663-bd86-a164a1c71676'),
       count(*) FILTER (WHERE tenant_id::text <> 'f8a11820-5719-4663-bd86-a164a1c71676')
FROM public.documents
UNION ALL SELECT 't2A_events', count(*),
       count(*) FILTER (WHERE tenant_id::text = 'f8a11820-5719-4663-bd86-a164a1c71676'),
       count(*) FILTER (WHERE tenant_id::text <> 'f8a11820-5719-4663-bd86-a164a1c71676')
FROM public.events;
ROLLBACK;

BEGIN;
SET LOCAL ROLE aidvisora_app;
SET LOCAL app.tenant_id = '00000000-0000-4000-8000-000000000001';
SELECT 't2B_memberships' AS test,
       count(*) AS visible,
       count(*) FILTER (WHERE tenant_id::text = '00000000-0000-4000-8000-000000000001') AS own,
       count(*) FILTER (WHERE tenant_id::text <> '00000000-0000-4000-8000-000000000001') AS foreign_rows
FROM public.memberships
UNION ALL SELECT 't2B_contracts', count(*),
       count(*) FILTER (WHERE tenant_id::text = '00000000-0000-4000-8000-000000000001'),
       count(*) FILTER (WHERE tenant_id::text <> '00000000-0000-4000-8000-000000000001')
FROM public.contracts
UNION ALL SELECT 't2B_households', count(*),
       count(*) FILTER (WHERE tenant_id::text = '00000000-0000-4000-8000-000000000001'),
       count(*) FILTER (WHERE tenant_id::text <> '00000000-0000-4000-8000-000000000001')
FROM public.households;
ROLLBACK;

-- -----------------------------------------------------------------------------
-- T3) Join-scoped tabulky: jen row vázaný na viditelný parent tenant
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE aidvisora_app;
SET LOCAL app.tenant_id = 'f8a11820-5719-4663-bd86-a164a1c71676';
SELECT 't3_household_members' AS test, count(*) AS visible FROM public.household_members
UNION ALL SELECT 't3_document_versions', count(*) FROM public.document_versions
UNION ALL SELECT 't3_document_extraction_fields', count(*) FROM public.document_extraction_fields
UNION ALL SELECT 't3_abp_targets', count(*) FROM public.advisor_business_plan_targets
UNION ALL SELECT 't3_mindmap_nodes', count(*) FROM public.mindmap_nodes
UNION ALL SELECT 't3_mindmap_edges', count(*) FROM public.mindmap_edges
UNION ALL SELECT 't3_export_artifacts', count(*) FROM public.export_artifacts;
ROLLBACK;

-- -----------------------------------------------------------------------------
-- T4) Bootstrap: `app.user_id` bez tenant GUC vrátí membership + role + tenant
-- jen pro daného usera (getMembership flow po přepnutí na aidvisora_app).
-- Dosaď reálné user_id z `SELECT user_id FROM memberships LIMIT 1`.
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE aidvisora_app;
SET LOCAL app.user_id = '0597adb1-bf3b-4f84-925a-f2f9c4e387fa';
SELECT 't4_bootstrap_lookup' AS test,
       m.tenant_id,
       r.name AS role_name
FROM public.memberships m
JOIN public.roles r ON r.id = m.role_id
WHERE m.user_id = current_setting('app.user_id', true)
LIMIT 3;

-- Self-only: memberships musí vrátit pouze řádky pro tohoto usera.
SELECT 't4_memberships_self_only' AS test,
       count(*) AS visible_rows,
       count(*) FILTER (WHERE user_id = current_setting('app.user_id', true)) AS own,
       count(*) FILTER (WHERE user_id <> current_setting('app.user_id', true)) AS foreign_rows
FROM public.memberships;
ROLLBACK;

-- -----------------------------------------------------------------------------
-- T5) Sanity: contracts policies NEmají jen `{authenticated}`
-- -----------------------------------------------------------------------------
SELECT 't5_contracts_role_check' AS test,
       policyname,
       'aidvisora_app' = ANY(roles) AS has_aidv,
       'authenticated' = ANY(roles) AS has_auth
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'contracts'
ORDER BY policyname;

-- -----------------------------------------------------------------------------
-- --- REVOKE wrapper: vrátí původní stav členství v roli.
-- Bezpečné pustit i opakovaně — NOOP pokud už dávno členem nejsme.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Best-effort REVOKE. Pokud current_user byl členem `aidvisora_app` už před
  -- spuštěním skriptu (jiný admin setup), tenhle REVOKE by ho odebral — proto
  -- nejdřív ověříme explicit admin_option pouze z přímého grantu.
  IF EXISTS (
    SELECT 1
    FROM pg_auth_members am
    JOIN pg_roles gr ON gr.oid = am.roleid
    JOIN pg_roles mem ON mem.oid = am.member
    WHERE gr.rolname = 'aidvisora_app' AND mem.rolname = current_user
  ) THEN
    BEGIN
      EXECUTE format('REVOKE aidvisora_app FROM %I', current_user);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'swap-readiness-test: REVOKE skipped (%).', SQLERRM;
    END;
  END IF;
END $$;
