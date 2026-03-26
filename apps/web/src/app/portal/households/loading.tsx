function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function HouseholdsLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-4 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <Skeleton className="h-6 w-36" />

      <div className="overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]">
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-24" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="w-16 p-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[color:var(--wp-surface-card-border)]">
                <td className="p-2">
                  <Skeleton className="h-4 w-36" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-8" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-24" />
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
