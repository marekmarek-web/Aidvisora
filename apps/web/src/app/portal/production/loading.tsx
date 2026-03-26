function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function ProductionLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-6 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-20 rounded-[6px]" />
          <Skeleton className="h-8 w-20 rounded-[6px]" />
          <Skeleton className="h-8 w-20 rounded-[6px]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-6">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-[200px] w-[200px] rounded-full" />
        </div>
        <div className="min-w-[280px] flex-1 overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
          <div className="flex gap-2 border-b border-[color:var(--wp-surface-card-border)] p-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[color:var(--wp-surface-card-border)] p-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
