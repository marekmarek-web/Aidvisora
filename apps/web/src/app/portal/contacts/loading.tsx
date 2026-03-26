function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function ContactsLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-4 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-36 rounded-[6px]" />
      </div>

      <div className="overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]">
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="w-16 p-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[color:var(--wp-surface-card-border)]">
                <td className="p-2">
                  <Skeleton className="h-4 w-32" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-40" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-12" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
