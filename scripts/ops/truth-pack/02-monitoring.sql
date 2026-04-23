-- Truth Pack · 02 · First-week daily monitoring (M1–M9)
--
-- Spouštět denně v 9:00 během prvního týdne po launchi.
-- Každá kontrola má doporučený threshold — viz runbook §First-week thresholds.
--
-- READ-ONLY.
-- Supabase SQL editor: paste celý soubor, Run.

-- ========== 02 · First-week monitoring ==========

-- M1 · Stuck reviews per hour (R11). Threshold: 0 za posledních 24 h.
SELECT
  'm1_stuck_reviews_per_hour' AS check_name,
  date_trunc('hour', created_at) AS hour,
  COUNT(*)                       AS stuck_count
FROM contract_upload_reviews
WHERE processing_status = 'processing'
  AND created_at < now() - interval '30 minutes'
GROUP BY hour
ORDER BY hour DESC
LIMIT 48;

-- M2 · Applied review → contract propagation lag. Threshold: max < 60 s.
SELECT
  'm2_apply_to_contract_lag_sec' AS check_name,
  MAX(EXTRACT(EPOCH FROM (c.created_at - r.reviewed_at)))::int AS max_lag_sec,
  AVG(EXTRACT(EPOCH FROM (c.created_at - r.reviewed_at)))::int AS avg_lag_sec,
  COUNT(*)                                                     AS samples,
  'expected max_lag_sec < 60'                                  AS expected
FROM contract_upload_reviews r
JOIN contracts c ON c.source_contract_review_id = r.id
WHERE r.review_status = 'applied'
  AND r.applied_at   > now() - interval '24 hours';

-- M3 · BJ NULL rate last 24 h (R1). Threshold: pct_null < 5 %.
SELECT
  'm3_bj_null_rate_24h' AS check_name,
  COUNT(*)                                                                        AS new_contracts,
  COUNT(*) FILTER (WHERE bj_units IS NULL)                                        AS null_bj,
  ROUND(100.0 * COUNT(*) FILTER (WHERE bj_units IS NULL) / NULLIF(COUNT(*), 0), 1) AS pct_null,
  'expected pct_null < 5.0'                                                       AS expected
FROM contracts
WHERE created_at > now() - interval '24 hours';

-- M4 · Ghost payment setups delta (R10). Threshold: 0 nových za 7 dní.
SELECT
  'm4_ghost_payment_setups_7d' AS check_name,
  COUNT(*)     AS ghosts,
  'expected=0' AS expected
FROM client_payment_setups
WHERE status             = 'active'
  AND visible_to_client  = FALSE
  AND created_at         > now() - interval '7 days';

-- M5 · Stripe webhook success rate (R7). Threshold: failed/(ok+failed) < 1 %.
-- Status values: 'processing' | 'completed' | 'failed'
SELECT
  'm5_stripe_webhook_rate_24h' AS check_name,
  COUNT(*) FILTER (WHERE status = 'completed')  AS ok,
  COUNT(*) FILTER (WHERE status = 'failed')     AS failed,
  COUNT(*) FILTER (WHERE status = 'processing') AS in_flight,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'failed')
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0), 2
  ) AS pct_failed,
  'expected pct_failed < 1.0' AS expected
FROM stripe_webhook_events
WHERE received_at > now() - interval '24 hours';

-- M6 · Client portal adoption signal (R5). Info-only, no threshold.
SELECT
  'm6_portal_requests_per_day' AS check_name,
  date_trunc('day', created_at)::date AS day,
  COUNT(*)                            AS new_requests
FROM opportunities
WHERE (custom_fields->>'client_portal_request')::text IN ('true', '"true"')
  AND created_at > now() - interval '7 days'
GROUP BY day
ORDER BY day;

-- M7 · Orphan advisor_id counter (R2). Threshold: 0.
SELECT
  'm7_orphan_advisor_users' AS check_name,
  COUNT(DISTINCT c.advisor_id) AS orphaned_advisors,
  'expected=0'                 AS expected
FROM contracts c
WHERE c.advisor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.tenant_id = c.tenant_id AND m.user_id::text = c.advisor_id::text
  );

-- M8 · Audit log volume (anomaly detection). Info-only.
SELECT
  'm8_audit_log_top_actions_24h' AS check_name,
  action,
  COUNT(*) AS n
FROM audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY action
ORDER BY n DESC
LIMIT 20;

-- M9 · Analytics snapshot freshness. Threshold: last snapshot < 26 h.
-- Dvoufázový check: nejprve existence, potom freshness separátním query.
-- Postgres parsuje celý query před exekucí, takže nelze dát `FROM analytics_snapshots`
-- do CASE branche — muselo by spadnout. Proto fáze 1 = metadata-only.
--
-- FÁZE 1 (vždy běží):
SELECT
  'm9a_analytics_snapshots_table' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'analytics_snapshots'
  ) THEN 'exists — pokračuj fází 2' ELSE 'table_missing (migration pending, not blocker)' END AS state;

-- FÁZE 2 (spustit SAMOSTATNĚ pouze pokud fáze 1 = 'exists'):
-- SELECT
--   'm9b_analytics_snapshot_age_h' AS check_name,
--   MAX(created_at)                                                AS last_snapshot_at,
--   ROUND(EXTRACT(EPOCH FROM (now() - MAX(created_at))) / 3600, 1) AS age_hours,
--   'expected age_hours < 26.0'                                    AS expected
-- FROM analytics_snapshots;

-- M10 · Storage orphans — split na legit vs. broken.
--
-- Bucket 'documents' obsahuje:
--   /<tenant>/avatars/<id>               → contact avatary (convention-based, ne v DB)
--   /<tenant>/advisor-avatars/<user-id>  → poradcovské avatary (ne v DB)
--   /<tenant>/processing/<review-id>/... → AI review intermediate artefakty
--   /<tenant>/contracts/<uuid>           → primary documents
--   storage_path v documents/contract_upload_reviews/message_attachments
--
-- Blocker threshold: "needs_cleanup" (processing ≥ 7 dní staré) > 100
-- Legit třídy jsou info-only.
WITH classified AS (
  SELECT
    o.name,
    o.created_at,
    CASE
      WHEN EXISTS (SELECT 1 FROM documents               d WHERE d.storage_path = o.name) THEN 'primary_document'
      WHEN EXISTS (SELECT 1 FROM contract_upload_reviews r WHERE r.storage_path = o.name) THEN 'primary_review'
      WHEN EXISTS (SELECT 1 FROM message_attachments     a WHERE a.storage_path = o.name) THEN 'primary_attachment'
      WHEN EXISTS (SELECT 1 FROM contract_upload_reviews r WHERE o.name LIKE '%' || r.id::text || '%')
                                                                                          THEN 'review_intermediate_linked'
      WHEN EXISTS (SELECT 1 FROM documents d WHERE o.name LIKE '%' || d.id::text || '%')  THEN 'document_intermediate_linked'
      WHEN o.name ~ '^[^/]+/avatars/'                                                     THEN 'avatar_contact'
      WHEN o.name ~ '^[^/]+/advisor-avatars/'                                             THEN 'avatar_advisor'
      WHEN o.name ~ '/processing/'                                                        THEN 'processing_orphan_cleanup_lag'
      WHEN o.name LIKE 'contracts/%'                                                      THEN 'legacy_contracts_prefix'
      ELSE 'true_orphan'
    END AS category
  FROM storage.objects o
  WHERE o.bucket_id = 'documents'
)
SELECT
  'm10_storage_classification' AS check_name,
  category,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE created_at < now() - interval '7 days') AS n_older_7d
FROM classified
GROUP BY category
ORDER BY n DESC;
