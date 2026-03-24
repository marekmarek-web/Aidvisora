"use client";

import { useState, useMemo } from "react";
import { Users, Calendar, Banknote, ChevronRight, TrendingUp, ArrowRight } from "lucide-react";
import type { StageWithOpportunities, OpportunityCard } from "@/app/actions/pipeline";
import { BottomSheet, EmptyState, MobileCard, MobileSection, StatusBadge } from "@/app/shared/mobile-ui/primitives";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatValue(v: string | null): string {
  if (!v) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M Kč`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis. Kč`;
  return `${n.toLocaleString("cs-CZ")} Kč`;
}

function formatCloseDate(d: string | null): string {
  if (!d) return "—";
  const today = new Date().toISOString().slice(0, 10);
  if (d < today) return "Prošlé";
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Dnes";
  if (diff === 1) return "Zítra";
  if (diff <= 7) return `${diff} dní`;
  return new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

function OpportunityDetailSheet({
  opp,
  stages,
  onClose,
  onMove,
}: {
  opp: OpportunityCard & { stageName: string };
  stages: StageWithOpportunities[];
  onClose: () => void;
  onMove: (toStageId: string) => void;
}) {
  return (
    <BottomSheet open title={opp.title} onClose={onClose}>
      <div className="space-y-4">
        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="info">{opp.stageName}</StatusBadge>
          <StatusBadge tone="neutral">{opp.caseType || "Jiné"}</StatusBadge>
          {opp.expectedValue ? (
            <StatusBadge tone="success">{formatValue(opp.expectedValue)}</StatusBadge>
          ) : null}
        </div>

        {opp.contactName ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Users size={16} className="text-slate-400" />
            {opp.contactName}
          </div>
        ) : null}

        {opp.expectedCloseDate ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Calendar size={16} className="text-slate-400" />
            Uzavření: {new Date(opp.expectedCloseDate).toLocaleDateString("cs-CZ")}
            <span className="text-xs font-bold text-slate-500">
              ({formatCloseDate(opp.expectedCloseDate)})
            </span>
          </div>
        ) : null}

        {/* Move to stage */}
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Posunout do fáze
          </p>
          <div className="space-y-1.5">
            {stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => onMove(stage.id)}
                className={cx(
                  "w-full min-h-[44px] rounded-xl border text-left px-4 text-sm font-semibold flex items-center justify-between transition-colors",
                  stage.name === opp.stageName
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
              >
                {stage.name}
                {stage.name === opp.stageName ? (
                  <span className="text-[10px] font-black text-indigo-500 uppercase">Aktuální</span>
                ) : (
                  <ArrowRight size={14} className="text-slate-300" />
                )}
              </button>
            ))}
          </div>
        </div>

        {opp.contactId ? (
          <a
            href={`/portal/contacts/${opp.contactId}`}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center gap-2"
          >
            <Users size={14} /> Otevřít klienta <ChevronRight size={14} />
          </a>
        ) : null}
      </div>
    </BottomSheet>
  );
}

interface PipelineScreenProps {
  pipeline: StageWithOpportunities[];
  deviceClass: DeviceClass;
  onMoveOpportunity: (oppId: string, toStageId: string) => void;
}

export function PipelineScreen({ pipeline, deviceClass, onMoveOpportunity }: PipelineScreenProps) {
  const [selectedOpp, setSelectedOpp] = useState<(OpportunityCard & { stageName: string }) | null>(null);

  const totalDeals = useMemo(() => pipeline.reduce((s, st) => s + st.opportunities.length, 0), [pipeline]);
  const totalValue = useMemo(
    () =>
      pipeline
        .flatMap((st) => st.opportunities)
        .reduce((s, o) => s + (o.expectedValue ? Number(o.expectedValue) : 0), 0),
    [pipeline]
  );

  const isTablet = deviceClass === "tablet";

  if (pipeline.length === 0) {
    return <EmptyState title="Pipeline je prázdná" description="Začněte přidáním prvního případu." />;
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-3">
        <MobileCard className="flex-1 p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Celkem</p>
          <p className="text-xl font-black text-slate-900 mt-0.5">{totalDeals}</p>
          <p className="text-xs text-slate-500">případů</p>
        </MobileCard>
        <MobileCard className="flex-1 p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hodnota</p>
          <p className="text-lg font-black text-slate-900 mt-0.5">{formatValue(String(totalValue))}</p>
          <p className="text-xs text-slate-500">celkem</p>
        </MobileCard>
      </div>

      {/* Stages grid -- 1 col phone, 2 col tablet */}
      <div className={cx("grid gap-3", isTablet ? "grid-cols-2" : "grid-cols-1")}>
        {pipeline.map((stage) => {
          const stageValue = stage.opportunities.reduce(
            (s, o) => s + (o.expectedValue ? Number(o.expectedValue) : 0),
            0
          );
          const urgentCount = stage.opportunities.filter(
            (o) => o.expectedCloseDate && o.expectedCloseDate < new Date().toISOString().slice(0, 10)
          ).length;

          return (
            <MobileSection key={stage.id} title={stage.name}>
              {/* Stage header card */}
              <MobileCard className="p-3 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-white">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 flex-shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black text-slate-900">{stage.opportunities.length}</p>
                  <p className="text-xs text-slate-500 font-bold">
                    {stageValue > 0 ? formatValue(String(stageValue)) : "bez hodnoty"}
                  </p>
                </div>
                {urgentCount > 0 ? (
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                    {urgentCount} prošlé
                  </span>
                ) : null}
              </MobileCard>

              {/* Opportunity cards */}
              {stage.opportunities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Prázdná fáze</p>
              ) : (
                stage.opportunities.map((opp) => {
                  const isPastDue =
                    opp.expectedCloseDate &&
                    opp.expectedCloseDate < new Date().toISOString().slice(0, 10);
                  return (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => setSelectedOpp({ ...opp, stageName: stage.name })}
                      className={cx(
                        "w-full text-left rounded-2xl border bg-white shadow-sm p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5",
                        isPastDue ? "border-rose-200 bg-rose-50/30" : "border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-slate-900 leading-snug flex-1">
                          {opp.title}
                        </p>
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-0.5" />
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        {opp.contactName ? (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
                            <Users size={11} /> {opp.contactName}
                          </span>
                        ) : null}
                        {opp.expectedValue ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Banknote size={11} /> {formatValue(opp.expectedValue)}
                          </span>
                        ) : null}
                        {opp.expectedCloseDate ? (
                          <span
                            className={cx(
                              "flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded",
                              isPastDue
                                ? "bg-rose-50 text-rose-600"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            <Calendar size={11} /> {formatCloseDate(opp.expectedCloseDate)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </MobileSection>
          );
        })}
      </div>

      {/* Opportunity detail bottom sheet */}
      {selectedOpp ? (
        <OpportunityDetailSheet
          opp={selectedOpp}
          stages={pipeline}
          onClose={() => setSelectedOpp(null)}
          onMove={(toStageId) => {
            onMoveOpportunity(selectedOpp.id, toStageId);
            setSelectedOpp(null);
          }}
        />
      ) : null}
    </div>
  );
}
