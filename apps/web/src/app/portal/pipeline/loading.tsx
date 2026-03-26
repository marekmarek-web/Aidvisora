import { PipelineBoardSkeleton } from "@/app/dashboard/pipeline/PipelineBoardSkeleton";

export default function PipelineLoading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[color:var(--wp-main-scroll-bg)]">
      <div className="flex-1 min-h-0 flex flex-col pb-4 w-full min-w-0">
        <div className="py-4 flex justify-between items-center gap-3 sm:gap-4 border-b border-[color:var(--wp-surface-card-border)] shrink-0 bg-[color:var(--wp-surface-card)] rounded-t-xl">
          <div>
            <div className="h-8 w-64 animate-pulse rounded bg-[color:var(--wp-surface-card-border)] mb-2" />
            <div className="flex items-center gap-3 mt-2">
              <div className="h-4 w-40 animate-pulse rounded bg-[color:var(--wp-surface-muted)]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[color:var(--wp-surface-muted)]" />
            </div>
          </div>
          <div className="h-11 w-36 animate-pulse rounded-xl bg-[color:var(--wp-surface-muted)] shrink-0" />
        </div>
        <div className="flex justify-between gap-3 py-3 shrink-0">
          <div className="h-11 max-w-md w-full animate-pulse rounded-xl bg-[color:var(--wp-surface-muted)]" />
          <div className="flex gap-3">
            <div className="h-11 w-40 animate-pulse rounded-xl bg-[color:var(--wp-surface-muted)]" />
            <div className="h-11 w-32 animate-pulse rounded-xl bg-[color:var(--wp-surface-muted)]" />
          </div>
        </div>
        <PipelineBoardSkeleton />
      </div>
    </div>
  );
}
