function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function CalendarLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-4 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-[6px]" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-[6px]" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-16 rounded-[6px]" />
          <Skeleton className="h-8 w-16 rounded-[6px]" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card-border)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-[color:var(--wp-surface-muted)] p-2 text-center">
            <Skeleton className="mx-auto h-4 w-8" />
          </div>
        ))}

        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`d${i}`} className="min-h-[80px] space-y-1 bg-[color:var(--wp-surface-card)] p-2">
            <Skeleton className="h-4 w-6" />
            {i % 4 === 0 && <Skeleton className="h-3 w-full" />}
            {i % 7 === 2 && <Skeleton className="h-3 w-3/4" />}
          </div>
        ))}
      </div>
    </div>
  );
}
