"use client";

import { EmptyState } from "@/app/components/EmptyState";

/**
 * Empty state inside white card. Wraps EmptyState with consistent container.
 */
export function ListPageEmpty({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--wp-radius-sm)] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        actionHref={actionHref}
        onAction={onAction}
      />
    </div>
  );
}
