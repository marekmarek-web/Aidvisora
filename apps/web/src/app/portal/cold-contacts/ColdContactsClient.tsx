"use client";

import Link from "next/link";
import type { CallsReportRow } from "@/app/actions/events";
import { EmptyState } from "@/app/components/EmptyState";

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ColdContactsClient({
  initialCalls,
}: {
  initialCalls: CallsReportRow[];
}) {
  return (
    <div className="space-y-8">
      {/* Přehled telefonátů */}
      <section>
        <h2 className="text-sm font-semibold text-[color:var(--wp-text-secondary)] mb-2">Přehled telefonátů</h2>
        <p className="text-[color:var(--wp-text-secondary)] text-sm mb-3">
          Události typu „Telefonát“ – kolik komu bylo zavoláno a kdy.
        </p>
        {initialCalls.length === 0 ? (
          <EmptyState
            icon="📞"
            title="Zatím žádné telefonáty"
            description="Telefonáty evidujte v kalendáři jako aktivitu typu Telefonát."
          />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {initialCalls.map((r) => (
                <article key={r.id} className="rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-[color:var(--wp-text-secondary)] mb-1">Datum a čas</p>
                  <p className="text-sm font-semibold text-[color:var(--wp-text-secondary)]">{formatDateTime(r.startAt)}</p>

                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--wp-text-secondary)] mb-1">Kontakt</p>
                    {r.contactId ? (
                      <Link
                        href={`/portal/contacts/${r.contactId}`}
                        className="text-blue-600 font-medium hover:underline min-h-[44px] inline-flex items-center"
                      >
                        {r.contactName ?? "—"}
                      </Link>
                    ) : (
                      <p className="text-[color:var(--wp-text-secondary)]">{r.contactName ?? "—"}</p>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--wp-text-secondary)] mb-1">Název</p>
                    <p className="text-[color:var(--wp-text-secondary)]">{r.title}</p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--wp-text-secondary)] mb-1">Zdroj leadu</p>
                    <p className="text-[color:var(--wp-text-secondary)]">{r.leadSource ?? "—"}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden md:block rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase">Datum a čas</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase">Kontakt</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase">Název</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase">Zdroj leadu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialCalls.map((r) => (
                      <tr key={r.id} className="border-b border-[color:var(--wp-surface-card-border)] hover:bg-[color:var(--wp-surface-muted)]/50">
                        <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)] whitespace-nowrap">{formatDateTime(r.startAt)}</td>
                        <td className="px-4 py-2.5">
                          {r.contactId ? (
                            <Link href={`/portal/contacts/${r.contactId}`} className="text-blue-600 font-medium hover:underline">
                              {r.contactName ?? "—"}
                            </Link>
                          ) : (
                            <span className="text-[color:var(--wp-text-secondary)]">{r.contactName ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)]">{r.title}</td>
                        <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)]">{r.leadSource ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
