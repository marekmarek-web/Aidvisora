-- Truth Pack · 00 · Propagation sanity (P1–P15)
--
-- Zdroj: Data-Truth / KPI-Truth sanity pack (2026-04-23).
-- Spustit jako service role (BYPASSRLS) v Supabase SQL editoru nebo:
--   psql "$DATABASE_URL_SERVICE" -f scripts/ops/truth-pack/00-propagation.sql
--
-- Každá kontrola vrací (check_name, violations, expected, severity).
-- Threshold interpretace viz docs/launch/truth-pack-runbook-2026-04-23.md §Thresholds.
--
-- HARD gates (go/no-go):  severity='hard'  → violations MUSÍ být 0
-- SOFT gates (warn):       severity='soft'  → log + investigate, není blocker
--
-- READ-ONLY. Žádné INSERT/UPDATE/DELETE. Bezpečné pustit kdykoliv.
--
-- Supabase SQL editor: NEpodporuje psql meta-příkazy (\echo, \set, :var).
-- Tento soubor je čistý Postgres SQL — můžeš paste celý a Run.

-- ========== 00 · Propagation sanity ==========

-- P1 · Applied AI review bez contract linku (R3, hard)
SELECT
  'p1_applied_review_missing_contract' AS check_name,
  COUNT(*)                              AS violations,
  'expected=0'                          AS expected,
  'hard'                                AS severity
FROM contract_upload_reviews r
LEFT JOIN contracts c ON c.source_contract_review_id = r.id
WHERE r.review_status = 'applied'
  AND c.id IS NULL
  AND r.applied_at IS NOT NULL;

-- P2 · Applied review bez apply_result_payload (R3, hard)
SELECT
  'p2_applied_review_missing_payload' AS check_name,
  COUNT(*)                            AS violations,
  'expected=0'                        AS expected,
  'hard'                              AS severity
FROM contract_upload_reviews
WHERE review_status = 'applied'
  AND apply_result_payload IS NULL;

-- P3 · Contract visible, ale payment_setup visible=false (R4, soft)
SELECT
  'p3_contract_visible_payment_hidden' AS check_name,
  COUNT(*)                             AS violations,
  'expected<5 (manual review each)'    AS expected,
  'soft'                               AS severity
FROM contracts c
JOIN client_payment_setups p
  ON p.tenant_id      = c.tenant_id
 AND p.contract_number = c.contract_number
 AND p.contact_id     = c.client_id
WHERE c.visible_to_client = TRUE
  AND p.status            = 'active'
  AND p.visible_to_client = FALSE;

-- P4 · client_portal_request notif vs. custom_fields marker drift (R5, hard)
SELECT
  'p4_portal_request_marker_drift' AS check_name,
  COUNT(*)                         AS violations,
  'expected=0'                     AS expected,
  'hard'                           AS severity
FROM advisor_notifications n
LEFT JOIN opportunities o
  ON o.id = n.related_entity_id
 AND o.tenant_id = n.tenant_id
WHERE n.type = 'client_portal_request'
  AND n.related_entity_type = 'opportunity'
  AND (
    o.id IS NULL
    OR (o.custom_fields->>'client_portal_request')::text NOT IN ('true', '"true"')
  );

-- P5 · Offboarding rezidua: contracts.advisor_id bez membership (R2, hard)
SELECT
  'p5_contracts_orphan_advisor_id' AS check_name,
  COUNT(*)                         AS violations,
  'expected=0'                     AS expected,
  'hard'                           AS severity
FROM contracts c
WHERE c.advisor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.tenant_id = c.tenant_id
      AND m.user_id::text = c.advisor_id::text
  );

-- P6 · Task/event/opportunity assigned_to bez membership (R2, hard)
SELECT
  entity AS check_name,
  violations,
  'expected=0'     AS expected,
  'hard'           AS severity
FROM (
  SELECT 'p6a_tasks_orphan_assignee'        AS entity,
         COUNT(*)                            AS violations
  FROM tasks t
  WHERE assigned_to IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = t.tenant_id AND m.user_id::text = t.assigned_to::text
    )
  UNION ALL
  SELECT 'p6b_events_orphan_assignee',
         COUNT(*)
  FROM events e
  WHERE assigned_to IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = e.tenant_id AND m.user_id::text = e.assigned_to::text
    )
  UNION ALL
  SELECT 'p6c_opportunities_orphan_assignee',
         COUNT(*)
  FROM opportunities o
  WHERE assigned_to IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.tenant_id = o.tenant_id AND m.user_id::text = o.assigned_to::text
    )
) x
ORDER BY check_name;

-- P7 · Contract segment ↔ type mismatch (R8, hard)
SELECT
  'p7_contract_segment_type_mismatch' AS check_name,
  COUNT(*)                            AS violations,
  'expected=0'                        AS expected,
  'hard'                              AS severity
FROM contracts
WHERE segment <> type;

-- P8 · product_category vs. segment sanity (R8, soft)
SELECT
  'p8_product_category_segment_drift' AS check_name,
  COUNT(*)                            AS violations,
  'expected=0 (UNKNOWN_REVIEW allowed)' AS expected,
  'soft'                              AS severity
FROM contracts
WHERE portfolio_status IN ('active', 'pending_review')
  AND product_category IS NOT NULL
  AND product_category <> 'UNKNOWN_REVIEW'
  AND (
    (segment = 'HYPO'    AND product_category NOT IN ('MORTGAGE')) OR
    (segment = 'UVER'    AND product_category NOT IN ('CONSUMER_LOAN', 'LEASING')) OR
    (segment = 'ZP'      AND product_category NOT LIKE 'LIFE_INSURANCE%') OR
    (segment IN ('DPS', 'DIP') AND product_category NOT LIKE 'PENSION%') OR
    (segment IN ('AUTO_PR', 'AUTO_HAV') AND product_category <> 'MOTOR_INSURANCE') OR
    (segment = 'MAJ'     AND product_category <> 'PROPERTY_INSURANCE') OR
    (segment IN ('ODP', 'ODP_ZAM') AND product_category <> 'LIABILITY_INSURANCE')
  );

-- P9 · contracts.note leak (R9, hard) — mirror pre-launch-verify #3
SELECT
  'p9_contract_note_visible_to_client' AS check_name,
  COUNT(*)                             AS violations,
  'expected=0'                         AS expected,
  'hard'                               AS severity
FROM contracts
WHERE visible_to_client = TRUE
  AND btrim(COALESCE(note, '')) <> '';

-- P10 · PII duální čtení (R6, soft — post-backfill hard)
SELECT
  'p10_pii_plaintext_and_ciphertext_coexist' AS check_name,
  COUNT(*)                                   AS violations,
  'expected=0 after D2 PII backfill'         AS expected,
  'soft'                                     AS severity
FROM contacts
WHERE personal_id IS NOT NULL
  AND personal_id_enc IS NOT NULL;

-- P11 · Payment-intent review bez payment_setup (R4, hard)
SELECT
  'p11_payment_review_missing_setup' AS check_name,
  COUNT(*)                           AS violations,
  'expected=0'                       AS expected,
  'hard'                             AS severity
FROM contract_upload_reviews r
LEFT JOIN client_payment_setups p ON p.source_contract_review_id = r.id
WHERE r.review_status    = 'applied'
  AND r.document_intent  = 'payment_instructions'
  AND p.id IS NULL;

-- P12 · Orphan visible-to-client documents (hard)
SELECT
  'p12_orphan_visible_documents' AS check_name,
  COUNT(*)                       AS violations,
  'expected=0'                   AS expected,
  'hard'                         AS severity
FROM documents
WHERE visible_to_client = TRUE
  AND contract_id    IS NULL
  AND opportunity_id IS NULL
  AND contact_id     IS NULL;

-- P13 · Household member duplicates (R6, hard)
SELECT
  'p13_household_member_dupes' AS check_name,
  COUNT(*)                     AS violations,
  'expected=0'                 AS expected,
  'hard'                       AS severity
FROM (
  SELECT contact_id
  FROM household_members
  GROUP BY contact_id
  HAVING COUNT(*) > 1
) d;

-- P14 · Stripe webhook failures last 24 h (R7, soft)
SELECT
  'p14_stripe_webhook_failed_24h' AS check_name,
  COUNT(*)                        AS violations,
  'expected=0'                    AS expected,
  'soft'                          AS severity
FROM stripe_webhook_events
WHERE received_at > now() - interval '24 hours'
  AND status      = 'failed';

-- P15 · Multiple active subscriptions per tenant (R7, hard)
SELECT
  'p15_multi_active_subscription_tenants' AS check_name,
  COUNT(*)                                AS violations,
  'expected=0'                            AS expected,
  'hard'                                  AS severity
FROM (
  SELECT tenant_id
  FROM subscriptions
  WHERE status IN ('active', 'trialing', 'past_due')
  GROUP BY tenant_id
  HAVING COUNT(*) > 1
) s;

-- P16 · source_kind='ai_review' bez advisor_confirmed_at (corruption §VI.11, hard)
SELECT
  'p16_ai_review_without_advisor_confirm' AS check_name,
  COUNT(*)                                AS violations,
  'expected=0'                            AS expected,
  'hard'                                  AS severity
FROM contracts
WHERE source_kind              = 'ai_review'
  AND advisor_confirmed_at IS NULL;
