# Theme audit – hardcoded light classes (snapshot)

Generated during corrective pass. Counts = matches for `bg-white`, `bg-slate-*`, `text-slate-*`, `border-slate-*` in TS/TSX.

## `apps/web/src/app/portal` (high)

| Area | Approx. hits (file) | Notes |
|------|---------------------|--------|
| tasks | 199 | tasks/page.tsx |
| PortalCalendarView | 145 | Calendar |
| TeamOverviewView | 146 | |
| AiAssistantDrawer | 68 | |
| AnalysesPageClient | 62 | |
| BoardMobileScreen | 49 | |
| MindmapListClient | 60 | |
| scan | 72 | |
| ContactsPageClient | 85 | |
| BusinessPlanView | 124 | |
| NotesVisionBoard | 88 | |
| DashboardEditable | 84 | |
| PortalSidebar | 91 | (many intentional light/dark pairs – refactor to tokens) |
| AdvisorProfileView | 134 | |
| HouseholdDetailView | 114 | |
| contracts/review | 50 | |
| messages | 52 | |
| + 80+ more files | 1–40 each | |

## `apps/web/src/app/components` (shared)

| File | Hits | Priority |
|------|------|----------|
| ExtractionLeftPanel | 73 | AI review |
| AIReviewExtractionShell | 53 | |
| PostMeetingSummaryPanel | 49 | |
| ClientCoverageWidget | 53 | |
| CalendarSettingsModal | 64 | |
| ComplianceSection | 40 | |
| DocumentUploadZone | 37 | |
| PDFViewerPanel | 35 | |
| PreMeetingBriefPanel | 32 | |
| CustomDropdown | 12 | **primitives** |
| wizard-* | 5–10 each | **primitives** |
| BaseModal | 8 | **primitives** |
| ListPage* | 2–6 | **primitives** |
| BoardTable | 12 | |

**Out of scope (wave 1):** PremiumLandingPage (marketing), client-only routes unless touched by shared components.

Corrective pass prioritizes: **tokens + shell**, then **primitives** (wizard, dropdown, modal, list-page), then **dashboard + sidecalendar**, then **highest-traffic modules** (notes, business plan, production, contacts list shell, calculators hub).
