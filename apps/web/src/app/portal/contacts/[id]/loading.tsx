function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[color:var(--wp-skeleton-bg)] ${className ?? ""}`} />
  );
}

export default function ContactDetailLoading() {
  return (
    <div className="min-h-[50vh] w-full space-y-4 bg-[color:var(--wp-main-scroll-bg)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 rounded-[6px]" />
      </div>
      <div className="flex gap-2 border-b border-[color:var(--wp-surface-card-border)] pb-2">
        <Skeleton className="h-8 w-20 rounded-[6px]" />
        <Skeleton className="h-8 w-20 rounded-[6px]" />
        <Skeleton className="h-8 w-24 rounded-[6px]" />
      </div>
      <div className="space-y-4 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-6">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
