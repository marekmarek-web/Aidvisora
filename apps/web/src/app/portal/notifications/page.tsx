import { getNotificationLog } from "@/app/actions/notification-log";
import { EmptyState } from "@/app/components/EmptyState";

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

export default async function NotificationsPage() {
  let notifications: Awaited<ReturnType<typeof getNotificationLog>> = [];
  try {
    notifications = await getNotificationLog();
  } catch {
    notifications = [];
  }

  return (
    <div className="p-4 space-y-4 wp-fade-in">
      <h1 className="text-lg font-semibold text-[color:var(--wp-text)]">Notifikace</h1>
      <p className="text-[color:var(--wp-text-secondary)] text-sm">
        Přehled odeslaných e-mailů a notifikací.
      </p>

      <div className="rounded-[var(--wp-radius-sm)] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] overflow-hidden shadow-sm">
        {notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="Žádné notifikace"
            description="Historie odeslaných notifikací se zobrazí zde."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Datum</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Příjemce</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Předmět</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Kanál</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Stav</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] uppercase tracking-wide">Kontakt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--wp-surface-card-border)]">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-[color:var(--wp-surface-muted)] transition-colors">
                    <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)] whitespace-nowrap">
                      {new Date(n.sentAt).toLocaleString("cs-CZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)]">{n.recipient ?? "–"}</td>
                    <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)]">{n.subject ?? "–"}</td>
                    <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)] capitalize">{n.channel}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-[var(--wp-radius-sm)] text-xs font-medium ${STATUS_COLORS[n.status] ?? "bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text)]"}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[color:var(--wp-text-secondary)]">{n.contactName ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
