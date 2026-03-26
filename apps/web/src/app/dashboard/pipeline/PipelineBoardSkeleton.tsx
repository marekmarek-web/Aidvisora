"use client";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`}
      aria-hidden
    />
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-inset)]/60">
      <div className="flex w-full items-center justify-between border-b border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-[10px]" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-7 w-8 shrink-0 rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex shrink-0 flex-col gap-3 rounded-[20px] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-14 rounded" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-28" />
            <div className="flex items-center justify-between border-t border-[color:var(--wp-surface-card-border)] pt-2">
              <Skeleton className="h-6 w-20 rounded-md" />
              <div className="flex gap-1">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
            </div>
          </div>
        ))}
        <Skeleton className="h-12 min-h-[44px] w-full shrink-0 rounded-[16px]" />
      </div>
    </div>
  );
}

export function PipelineBoardSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-4">
      <div className="w-full pb-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
