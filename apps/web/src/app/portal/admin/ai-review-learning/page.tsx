import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAuth } from "@/lib/auth/require-auth";
import { deriveAdminScope, canAccessAdmin } from "@/lib/admin/admin-permissions";
import { listAiReviewLearningDebug } from "@/lib/ai/ai-review-learning";

export const dynamic = "force-dynamic";

export default async function AiReviewLearningAdminPage() {
  const auth = await requireAuth();
  const scope = deriveAdminScope(auth.roleName);
  if (!canAccessAdmin(scope)) redirect("/portal/today");

  const debug = await listAiReviewLearningDebug({ tenantId: auth.tenantId, limit: 25 });
  const accepted = debug.events.filter((event) => event.acceptedOnApproval).length;
  const topFields = Object.entries(
    debug.events.reduce<Record<string, number>>((acc, event) => {
      acc[event.fieldPath] = (acc[event.fieldPath] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--wp-text-secondary)]">
          Internal AI Review
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">AI Review Learning</h1>
        <p className="mt-3 max-w-3xl text-sm text-[color:var(--wp-text-secondary)]">
          Auditní pohled na ruční opravy, schválené patterny a eval cases. Výstupy jsou
          interní podklady pro poradce, ne doporučení klientovi.
        </p>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Correction events" value={debug.events.length} />
        <Metric label="Accepted" value={accepted} />
        <Metric label="Active patterns" value={debug.patterns.filter((p) => p.enabled).length} />
        <Metric label="Eval cases" value={debug.evalCases.length} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Top Failing Fields">
          {topFields.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {topFields.map(([field, count]) => (
                <li key={field} className="flex min-h-[44px] items-center justify-between rounded-xl bg-[color:var(--wp-surface-muted)] px-3 py-2 text-sm">
                  <code>{field}</code>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Active Learning Patterns">
          {debug.patterns.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3">
              {debug.patterns.slice(0, 8).map((pattern) => (
                <li key={pattern.id} className="rounded-xl border border-[color:var(--wp-surface-card-border)] p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[color:var(--wp-surface-muted)] px-2 py-1 text-xs font-semibold">{pattern.patternType}</span>
                    <span className="text-xs text-[color:var(--wp-text-secondary)]">support {pattern.supportCount}</span>
                  </div>
                  <p className="mt-2 text-[color:var(--wp-text)]">{pattern.promptHint ?? pattern.ruleText}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--wp-text-secondary)]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface)] p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-[color:var(--wp-text-secondary)]">Zatím žádná data.</p>;
}
