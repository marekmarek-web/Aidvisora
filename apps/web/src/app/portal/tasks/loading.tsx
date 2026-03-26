function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function TasksLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-4 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <Skeleton className="h-6 w-24" />

      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-[6px]" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]">
              <th className="w-10 p-2">
                <Skeleton className="mx-auto h-4 w-4" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="p-2 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="w-24 p-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-[color:var(--wp-surface-card-border)]">
                <td className="p-2 text-center">
                  <Skeleton className="mx-auto h-4 w-4 rounded" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-44" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="p-2">
                  <Skeleton className="h-4 w-20" />
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center gap-2 border-t border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)]/50 p-3">
          <Skeleton className="h-8 flex-1 rounded-[6px]" />
          <Skeleton className="h-8 w-44 rounded-[6px]" />
          <Skeleton className="h-8 w-36 rounded-[6px]" />
          <Skeleton className="h-8 w-20 rounded-[6px]" />
        </div>
      </div>
    </div>
  );
}
