"use client";

/**
 * List page header: h1 + count badge + subtitle left; actions right.
 * Matches Contacts pattern: text-2xl md:text-3xl font-bold, badge, text-sm text-slate-500, primary CTA bg-aidv-create.
 */
export function ListPageHeader({
  title,
  count = null,
  totalCount = null,
  subtitle,
  actions,
}: {
  title: string;
  count?: number | null;
  totalCount?: number | null;
  subtitle?: string | null;
  actions?: React.ReactNode;
}) {
  const showBadge = count !== null && count !== undefined;
  const badgeLabel =
    totalCount != null && totalCount !== count
      ? `${count} / ${totalCount}`
      : count != null
        ? `${count} celkem`
        : "";

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight text-[color:var(--wp-text)] md:gap-3 md:text-3xl">
          {title}
          {showBadge && (
            <span className="rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[color:var(--wp-text-secondary)] md:px-2.5 md:text-sm">
              {badgeLabel}
            </span>
          )}
        </h1>
        {subtitle && <p className="mt-0.5 text-xs text-[color:var(--wp-text-secondary)] md:mt-1 md:text-sm">{subtitle}</p>}
      </div>
      {actions != null && (
        <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0 [&_button]:min-h-[44px] md:[&_button]:min-h-0 [&_a]:min-h-[44px] md:[&_a]:min-h-0">
          {actions}
        </div>
      )}
    </div>
  );
}
