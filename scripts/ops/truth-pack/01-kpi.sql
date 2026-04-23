-- Truth Pack · 01 · KPI truth (K1–K10)
--
-- Parametrizované queries na cross-check DB ↔ UI.
--
-- === JAK SPUSTIT ===
--
-- A) Supabase SQL editor (doporučené):
--    Před paste najdi-a-nahraď v tomto souboru (BEZ ::uuid suffixu — cast je už v query):
--      :TENANT_ID           → 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--      :ADVISOR_USER_ID     → 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--      :CURRENT_USER_ID     → 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--    Potom paste celý soubor do editoru a Run.
--
--    Pozn.: V live DB jsou contracts.advisor_id + advisor_notifications.target_user_id
--    oba UUID. memberships.user_id je TEXT (OAuth user ID). Casty jsou v query,
--    stačí dát raw UUID string.
--
-- B) psql CLI:
--    psql "$DATABASE_URL_SERVICE" \
--      -v TENANT_ID="'<uuid>'::uuid" \
--      -v ADVISOR_USER_ID="'<uuid>'::uuid" \
--      -v CURRENT_USER_ID="'<uuid>'::uuid" \
--      -f scripts/ops/truth-pack/01-kpi.sql
--    (nebo použij run-all.sh který to udělá za tebe)
--
-- === KDE VZÍT UUID ===
--   TENANT_ID          → SELECT id, slug FROM tenants ORDER BY created_at;
--   ADVISOR_USER_ID    → SELECT user_id, role FROM memberships WHERE tenant_id='<uuid>';
--   CURRENT_USER_ID    → stejný user, pro kterého chceš K6 inbox (typicky = advisor)
--
-- === UI CROSS-CHECK ===
--   K1 → /portal/team/production?period=month
--   K3 → /portal/admin/analytics
--   K4 → /portal/admin/analytics (payment portal readiness)
--   K5 → /portal/klientske-zony
--   K6 → advisor bell v header
--   K8 → Stripe Dashboard → Revenue

-- ========== 01 · KPI truth (parametrized) ==========

-- K1 · Production report truth (R1, R2)
-- Otevři /portal/team/production?period=month pro stejného advisora a porovnej čísla po segmentech.
WITH prod AS (
  SELECT
    id, advisor_id, tenant_id, segment, partner_name,
    premium_amount, premium_annual, bj_units,
    CASE
      WHEN source_kind = 'ai_review'
        THEN COALESCE(advisor_confirmed_at::date, start_date::date)
      ELSE start_date::date
    END AS production_date
  FROM contracts
)
SELECT
  segment,
  COUNT(*)                                AS cnt,
  SUM(premium_amount)::numeric(14, 2)     AS total_premium,
  SUM(premium_annual)::numeric(14, 2)     AS total_annual,
  SUM(bj_units)::numeric(14, 4)           AS total_bj
FROM prod
WHERE tenant_id       = (:TENANT_ID)::uuid
  AND advisor_id      = (:ADVISOR_USER_ID)::uuid
  AND production_date >= date_trunc('month', now())::date
  AND production_date <  (date_trunc('month', now()) + interval '1 month')::date
GROUP BY segment
ORDER BY segment;

-- K2 · BJ coverage (R1) — threshold: pct_with_bj ≥ 95 % pro active portfolio
SELECT
  'k2_bj_coverage' AS check_name,
  COUNT(*)                                                  AS total,
  COUNT(bj_units)                                            AS with_bj,
  COUNT(*) FILTER (WHERE product_category IS NULL)           AS missing_cat,
  ROUND(100.0 * COUNT(bj_units) / NULLIF(COUNT(*), 0), 1)    AS pct_with_bj,
  'expected >= 95.0'                                         AS expected
FROM contracts
WHERE portfolio_status = 'active';

-- K3 · Executive funnel truth (porovnej s /portal/admin/analytics 30-day window)
SELECT
  'k3_executive_funnel_30d' AS check_name,
  COUNT(*)                                                                                    AS uploaded,
  COUNT(*) FILTER (WHERE processing_status <> 'uploaded')                                     AS preprocessed,
  COUNT(*) FILTER (WHERE detected_document_type IS NOT NULL)                                  AS classified,
  COUNT(*) FILTER (WHERE processing_status IN ('extracted', 'review_required', 'failed'))     AS extracted,
  COUNT(*) FILTER (WHERE review_status      IN ('approved', 'applied', 'rejected'))           AS reviewed,
  COUNT(*) FILTER (WHERE review_status      IN ('approved', 'applied'))                       AS approved,
  COUNT(*) FILTER (WHERE review_status      = 'applied')                                      AS applied
FROM contract_upload_reviews
WHERE tenant_id   = (:TENANT_ID)::uuid
  AND created_at >= now() - interval '30 days';

-- K4 · Payment portal readiness (match executive-analytics.ts)
SELECT
  'k4_payment_portal_readiness' AS check_name,
  COUNT(*)                                                                                           AS total,
  COUNT(*) FILTER (WHERE status = 'active' AND needs_human_review = FALSE AND visible_to_client = TRUE)
                                                                                                    AS portal_ready,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'active' AND needs_human_review = FALSE AND visible_to_client = TRUE)
    / NULLIF(COUNT(*), 0), 1
  )                                                                                                 AS pct_ready
FROM client_payment_setups
WHERE tenant_id = (:TENANT_ID)::uuid;

-- K5 · Aktivní client portal requests (R5)
SELECT
  'k5_active_portal_requests' AS check_name,
  COUNT(*) AS active_requests
FROM opportunities
WHERE tenant_id = (:TENANT_ID)::uuid
  AND (custom_fields->>'client_portal_request')::text IN ('true', '"true"')
  AND closed_at IS NULL;

-- K6 · Advisor bell inbox counts (porovnej s UI advisor notification bell)
SELECT
  'k6_advisor_inbox' AS check_name,
  SUM((status = 'unread')::int)    AS unread,
  SUM((status = 'dismissed')::int) AS dismissed,
  COUNT(*)                         AS total
FROM advisor_notifications
WHERE tenant_id       = (:TENANT_ID)::uuid
  AND target_user_id  = (:CURRENT_USER_ID)::uuid
  AND type            = 'client_portal_request';

-- K7 · Business plan metric_type drift (R13)
-- Expected: 0 řádků — všechny metric_type v canonical setu.
SELECT
  'k7_business_plan_metric_drift' AS check_name,
  metric_type,
  COUNT(*) AS targets_affected
FROM advisor_business_plan_targets
WHERE metric_type NOT IN (
  'contracts_count', 'bj_units', 'premium_annual_sum',
  'investment_premium', 'insurance_premium', 'lending_volume',
  'investments', 'pension', 'life', 'hypo'
)
GROUP BY metric_type
ORDER BY targets_affected DESC;

-- K8 · Monthly revenue (porovnej s Stripe Dashboard → Revenue → last 6 months)
SELECT
  'k8_monthly_revenue_czk' AS check_name,
  date_trunc('month', paid_at)::date AS month,
  SUM(amount)::numeric(14, 2)        AS czk
FROM invoices
WHERE status    = 'paid'
  AND paid_at  >= now() - interval '6 months'
GROUP BY month
ORDER BY month DESC;

-- K9 · Subscription status distribution (R7) — porovnej se Stripe: počet past_due/canceled
SELECT
  'k9_subscription_status_distribution' AS check_name,
  status,
  COUNT(*) AS n
FROM subscriptions
GROUP BY status
ORDER BY n DESC;

-- K10 · Time-to-apply (p50/p90 hours) — porovnej s executive-analytics avg
SELECT
  'k10_time_to_apply_hours' AS check_name,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS p50_h,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS p90_h,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)                                         AS avg_h
FROM contract_upload_reviews
WHERE review_status  = 'applied'
  AND tenant_id      = (:TENANT_ID)::uuid
  AND created_at    >= now() - interval '30 days';
