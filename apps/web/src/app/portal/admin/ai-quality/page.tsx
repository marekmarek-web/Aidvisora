"use client";

import { useEffect, useState } from "react";

type QualitySummary = {
  totalDocuments: number;
  successCount: number;
  reviewRequiredCount: number;
  failedCount: number;
  successRate: number;
  reviewRequiredRate: number;
  failedRate: number;
  avgPreprocessDurationMs: number | null;
  avgPipelineDurationMs: number | null;
  byDocumentType: Record<string, { total: number; success: number; failed: number; review: number }>;
  byInputMode: Record<string, { total: number; success: number; failed: number; review: number }>;
  topFailedSteps: Record<string, number>;
  topReasons: Record<string, number>;
};

type CorrectionSummary = {
  totalCorrectedReviews: number;
  topCorrectedFields: Record<string, number>;
  correctionsByDocumentType: Record<string, number>;
};

function KpiCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--wp-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[color:var(--wp-text)]">{value}</p>
      {subtext ? <p className="mt-0.5 text-xs text-[color:var(--wp-text-secondary)]">{subtext}</p> : null}
    </div>
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)} %`;
}

function msToSec(ms: number | null): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AIQualityDashboard() {
  const [quality, setQuality] = useState<QualitySummary | null>(null);
  const [corrections, setCorrections] = useState<CorrectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/ai/quality-summary?days=${days}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/ai/correction-summary?days=${days}`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([q, c]) => {
      setQuality(q);
      setCorrections(c);
      setLoading(false);
    });
  }, [days]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Nacitam metriky...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black text-[color:var(--wp-text)]">AI Extrakce — Kvalita pipeline</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                days === d
                  ? "bg-indigo-600 text-white"
                  : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)] hover:bg-[color:var(--wp-surface-card-border)]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {quality ? (
        <>
          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">KPI</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Celkem dokumentu" value={quality.totalDocuments} />
              <KpiCard label="Uspesne" value={quality.successCount} subtext={pct(quality.successRate)} />
              <KpiCard label="Ke kontrole" value={quality.reviewRequiredCount} subtext={pct(quality.reviewRequiredRate)} />
              <KpiCard label="Selhani" value={quality.failedCount} subtext={pct(quality.failedRate)} />
              <KpiCard label="Prumerna doba" value={msToSec(quality.avgPipelineDurationMs)} subtext={`Preprocess: ${msToSec(quality.avgPreprocessDurationMs)}`} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
              Podle typu dokumentu
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[color:var(--wp-surface-card-border)] text-left text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
                    <th className="py-2 pr-4">Typ</th>
                    <th className="py-2 pr-4">Celkem</th>
                    <th className="py-2 pr-4">OK</th>
                    <th className="py-2 pr-4">Review</th>
                    <th className="py-2 pr-4">Fail</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(quality.byDocumentType)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([type, counts]) => (
                      <tr key={type} className="border-b border-[color:var(--wp-surface-card-border)]">
                        <td className="py-1.5 pr-4 font-medium text-[color:var(--wp-text)]">{type}</td>
                        <td className="py-1.5 pr-4">{counts.total}</td>
                        <td className="py-1.5 pr-4 text-emerald-700">{counts.success}</td>
                        <td className="py-1.5 pr-4 text-amber-700">{counts.review}</td>
                        <td className="py-1.5 pr-4 text-red-700">{counts.failed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
              Podle vstupu
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(quality.byInputMode).map(([mode, counts]) => (
                <div key={mode} className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--wp-text-secondary)]">{mode}</p>
                  <p className="mt-1 text-lg font-black text-[color:var(--wp-text)]">{counts.total}</p>
                  <p className="text-[10px] text-[color:var(--wp-text-secondary)]">
                    OK {counts.success} / Review {counts.review} / Fail {counts.failed}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {Object.keys(quality.topFailedSteps).length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
                Top selhane kroky
              </h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(quality.topFailedSteps)
                  .sort(([, a], [, b]) => b - a)
                  .map(([step, count]) => (
                    <span key={step} className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                      {step}: {count}
                    </span>
                  ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Nepodarilo se nacist kvalitni metriky.</p>
      )}

      {corrections ? (
        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[color:var(--wp-text-secondary)]">
            Opravy ({corrections.totalCorrectedReviews} celkem)
          </h2>
          {Object.keys(corrections.topCorrectedFields).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(corrections.topCorrectedFields)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([field, count]) => (
                  <div key={field} className="flex items-center gap-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{
                        width: `${Math.min(100, (count / corrections.totalCorrectedReviews) * 100 * 3)}%`,
                        minWidth: "4px",
                      }}
                    />
                    <span className="text-xs text-[color:var(--wp-text-secondary)]">
                      {field} ({count})
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-[color:var(--wp-text-secondary)]">Zatim zadne opravy.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
