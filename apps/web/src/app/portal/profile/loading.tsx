export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] animate-pulse">
      <header className="bg-[color:var(--wp-surface-card)]/80 border-b border-[color:var(--wp-surface-card-border)] px-4 sm:px-6 md:px-8 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-32 bg-[color:var(--wp-surface-card-border)] rounded" />
          <div className="h-10 w-36 bg-[color:var(--wp-surface-card-border)] rounded-xl" />
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6">
        <div className="bg-[color:var(--wp-surface-card)] rounded-2xl p-6 sm:p-8 border border-[color:var(--wp-surface-card-border)] flex flex-col md:flex-row gap-6">
          <div className="h-24 w-24 rounded-full bg-[color:var(--wp-surface-card-border)] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 bg-[color:var(--wp-surface-card-border)] rounded" />
            <div className="h-4 w-32 bg-[color:var(--wp-surface-muted)] rounded" />
          </div>
        </div>
        <div className="bg-[color:var(--wp-surface-card)] rounded-2xl p-6 border border-[color:var(--wp-surface-card-border)] space-y-4">
          <div className="h-4 w-24 bg-[color:var(--wp-surface-muted)] rounded" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-12 bg-[color:var(--wp-surface-muted)] rounded-xl" />
            <div className="h-12 bg-[color:var(--wp-surface-muted)] rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
