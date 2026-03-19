# Backtesting P0 Triage Map

This maps reported production blockers to concrete code paths and the implemented fixes.

## P0 Items

- **Stuck `Ukládám…` / create-update failures (pipeline/calendar)**
  - **Paths:** `apps/web/src/app/dashboard/pipeline/PipelineBoard.tsx`, `apps/web/src/app/actions/pipeline.ts`, `apps/web/src/app/portal/setup/GoogleCalendarUpcomingEvents.tsx`
  - **Fixes:** explicit form error handling, server-side validation, optimistic stage moves with rollback via refresh, idempotency keys and retry+timeout for calendar writes.

- **Google calendar integration appears non-responsive**
  - **Paths:** `apps/web/src/app/portal/setup/SetupView.tsx`, `apps/web/src/app/portal/setup/GoogleCalendarUpcomingEvents.tsx`, `apps/web/src/app/api/calendar/sync/route.ts`
  - **Fixes:** manual sync actions in both integration panel and events widget, explicit user feedback for sync result and failures.

- **Settings/profile instability and broken external link**
  - **Paths:** `apps/web/src/app/portal/setup/SetupView.tsx`, `apps/web/src/app/portal/profile/AdvisorProfileView.tsx`, `apps/web/src/app/actions/auth.ts`
  - **Fixes:** safer profile save flows already catch surfaced errors; CNB links updated to direct finder URL; removed production-facing demo-data trigger from setup page.

- **Team management action does not lead to usable flow**
  - **Path:** `apps/web/src/app/portal/setup/SetupView.tsx`
  - **Fix:** team CTA now routes to team management module (`/portal/team-overview`) instead of a placeholder toast.

## P1/P2 Started In Same Pass

- **Pipeline UX/perf improvements**
  - `apps/web/src/app/dashboard/pipeline/PipelineBoard.tsx`
  - Mobile-safe action visibility, optimistic drag-and-drop move UX, in-form failure messages.

- **Edit labels UX overhaul**
  - `apps/web/src/app/components/monday/EditLabelsEditor.tsx`
  - Modernized modal, drag-reorder, touch-friendly controls, robust save normalization.

- **Business plan period fallback**
  - `apps/web/src/app/portal/BusinessPlanView.tsx`
  - Added fallback lookup for existing plan in selected period before showing empty state.

- **PDF print polish**
  - `apps/web/src/lib/analyses/financial/report/themes/modern.ts`
  - No-wrap money values and white print background for cleaner print-ready output.
