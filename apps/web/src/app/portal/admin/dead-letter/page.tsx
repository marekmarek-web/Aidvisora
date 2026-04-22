/**
 * B3.14 — Admin UI pro `resilience/dead-letter` queue.
 *
 * Read-only list (server render) + client-side retry/discard buttonky na
 * vlastním routu. Bez téhle stránky ops musel číst DB ručně a vyvolávat
 * `curl` na interní endpoint, což se nestalo nikdy a queue rostla.
 */

import { requireAuth } from "@/lib/auth/require-auth";
import { redirect } from "next/navigation";
import { listDeadLetterItems } from "@/lib/resilience/dead-letter";
import { deriveAdminScope, canAccessAdmin, canAccessSecurityConsole } from "@/lib/admin/admin-permissions";
import { DeadLetterRowActions } from "./DeadLetterRowActions";

export const dynamic = "force-dynamic";

export default async function DeadLetterAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const auth = await requireAuth();
  const scope = deriveAdminScope(auth.roleName);
  if (!canAccessAdmin(scope) || !canAccessSecurityConsole(scope)) {
    redirect("/portal/today");
  }

  const sp = (await searchParams) ?? {};
  const statusFilter = sp.status === "retried" || sp.status === "discarded" || sp.status === "pending"
    ? sp.status
    : "pending";

  const items = await listDeadLetterItems(auth.tenantId, {
    status: statusFilter,
    limit: 100,
  });

  const tabs: Array<{ id: "pending" | "retried" | "discarded"; label: string }> = [
    { id: "pending", label: "Pending" },
    { id: "retried", label: "Retried" },
    { id: "discarded", label: "Discarded" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-black tracking-tight">Dead letter queue</h1>
      <p className="mt-3 text-sm text-[color:var(--wp-text-secondary)]">
        Job payloady, které selhaly po všech retry pokusech. Lze je znovu pustit
        (retry) nebo označit jako vyřešené (discard). Propojeno s{" "}
        <code>resilience.dead-letter.ts</code> (Plan 9B).
      </p>

      <div className="mt-6 flex items-center gap-2" role="tablist" aria-label="Filtr stavu">
        {tabs.map((t) => (
          <a
            key={t.id}
            role="tab"
            aria-selected={statusFilter === t.id}
            href={`/portal/admin/dead-letter?status=${t.id}`}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold ${
              statusFilter === t.id
                ? "bg-[color:var(--wp-text)] text-[color:var(--wp-surface)]"
                : "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)]"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--wp-surface-card-border)] text-left text-xs uppercase tracking-wide text-[color:var(--wp-text-secondary)]">
              <th className="py-2 pr-4">Job</th>
              <th className="py-2 pr-4">Vytvořeno</th>
              <th className="py-2 pr-4">Pokusů</th>
              <th className="py-2 pr-4">Chyba</th>
              <th className="py-2 pr-4">Correlation</th>
              <th className="py-2">Akce</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-sm text-[color:var(--wp-text-secondary)]"
                >
                  Žádné položky ve stavu „{statusFilter}".
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[color:var(--wp-surface-card-border)] align-top"
                >
                  <td className="py-3 pr-4 font-mono text-xs font-bold text-[color:var(--wp-text)]">
                    {item.jobType}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[color:var(--wp-text-secondary)]">
                    {new Date(item.createdAt).toLocaleString("cs-CZ")}
                  </td>
                  <td className="py-3 pr-4 text-xs">{item.attempts}</td>
                  <td className="py-3 pr-4 text-xs text-[color:var(--wp-text-secondary)]">
                    {item.failureReason ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[11px] text-[color:var(--wp-text-secondary)]">
                    {item.correlationId ?? "—"}
                  </td>
                  <td className="py-3">
                    {item.status === "pending" ? (
                      <DeadLetterRowActions id={item.id} />
                    ) : (
                      <span className="text-xs text-[color:var(--wp-text-secondary)]">
                        {item.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
