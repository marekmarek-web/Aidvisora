import Link from "next/link";
import {
  Ban,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
} from "lucide-react";
import { requireClientZoneAuth, getCachedSupabaseUser } from "@/lib/auth/require-auth";
import { getEffectiveTenantSettingsForWorkspaceResolved } from "@/lib/billing/effective-workspace";
import { getClientRequests } from "@/app/actions/client-portal-requests";
import { listClientMaterialRequests } from "@/app/actions/advisor-material-requests";
import { ClientRequestCancelButton } from "./ClientRequestCancelButton";
import { RequestsPageClientActions } from "./requests-client-actions";

export default async function ClientRequestsPage() {
  const auth = await requireClientZoneAuth();
  if (!auth.contactId) return null;

  const supabaseUser = await getCachedSupabaseUser().catch(() => null);
  const portalSettingsResult = await getEffectiveTenantSettingsForWorkspaceResolved({
    tenantId: auth.tenantId,
    userId: auth.userId,
    email: supabaseUser?.email ?? null,
  }).catch(() => null);
  const serviceRequestsEnabled = portalSettingsResult?.settings?.["client_portal.allow_service_requests"] ?? true;

  const [requestsList, materialRequestsList] = await Promise.all([
    getClientRequests(),
    listClientMaterialRequests().catch(() => []),
  ]);

  const activeRequests = requestsList.filter(
    (item) => item.statusKey !== "done" && item.statusKey !== "cancelled"
  );
  const cancelledRequests = requestsList.filter((item) => item.statusKey === "cancelled");
  const completedRequests = requestsList.filter((item) => item.statusKey === "done");

  const openMaterialRequests = materialRequestsList.filter(
    (r) => r.status !== "done" && r.status !== "closed"
  );

  const hasAnything = requestsList.length > 0 || materialRequestsList.length > 0;

  return (
    <div className="space-y-8 client-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">
            Požadavky
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Vaše požadavky na poradce a podklady, které poradce potřebuje od vás.
          </p>
        </div>
        <RequestsPageClientActions serviceRequestsEnabled={serviceRequestsEnabled} />
      </div>

      {!hasAnything ? (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-400">
            <Bell size={22} />
          </div>
          <p className="text-slate-700 font-semibold">Zatím žádné požadavky</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Vytvořte nový požadavek, nebo počkejte na první podnět od poradce.
          </p>
        </div>
      ) : (
        <div className="space-y-10">

          {/* ── OD PORADCE — link card (B2.5). Detail + plný seznam žije na
              /client/pozadavky-poradce, tady už jen summary link, ať není
              stejná entita na 3 místech najednou. */}
          {materialRequestsList.length > 0 && (
            <section className="space-y-4">
              <Link
                href="/client/pozadavky-poradce"
                className="block bg-white rounded-[24px] border border-violet-200 shadow-sm p-5 hover:shadow-md hover:border-violet-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl grid place-items-center border border-violet-100 shrink-0">
                    <ClipboardList size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black text-slate-900">Požadavky od poradce</h3>
                    <p className="text-sm text-slate-500">
                      {openMaterialRequests.length > 0
                        ? `${openMaterialRequests.length} otevřených podkladů čeká na vaši reakci.`
                        : `${materialRequestsList.length} dokončených požadavků ve vašem archivu.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {openMaterialRequests.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-black border border-violet-200">
                        {openMaterialRequests.length}
                      </span>
                    )}
                    <ChevronRight size={18} className="text-slate-400" />
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* ── MOJE POŽADAVKY ── */}
          {requestsList.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 grid place-items-center text-amber-600">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Moje požadavky</h3>
                  <p className="text-xs text-slate-500">Požadavky, které jste odeslali poradci</p>
                </div>
              </div>

              <div className="space-y-3">
                {activeRequests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-5 rounded-[24px] border border-indigo-200 shadow-sm flex flex-col gap-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl grid place-items-center border border-amber-100 shrink-0">
                        <Clock size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">
                          {r.statusLabel}
                        </span>
                        <h4 className="font-bold text-slate-900">{r.title}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{r.caseTypeLabel}</p>
                        {r.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          Aktualizováno {new Date(r.updatedAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <ClientRequestCancelButton requestId={r.id} />
                  </div>
                ))}

                {cancelledRequests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 opacity-75"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl grid place-items-center border border-slate-200 shrink-0">
                        <Ban size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-0.5">
                          {r.statusLabel}
                        </span>
                        <h4 className="font-bold text-slate-900">{r.title}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{r.caseTypeLabel}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Zrušeno {new Date(r.updatedAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {completedRequests.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 opacity-75"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl grid place-items-center border border-emerald-100 shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block mb-0.5">
                          {r.statusLabel}
                        </span>
                        <h4 className="font-bold text-slate-900">{r.title}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{r.caseTypeLabel}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Dokončeno {new Date(r.updatedAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
