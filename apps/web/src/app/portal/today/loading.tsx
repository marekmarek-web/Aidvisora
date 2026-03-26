function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function TodayLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-6 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-64" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-14" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4">
        <Skeleton className="h-4 w-36" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4"
          >
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
