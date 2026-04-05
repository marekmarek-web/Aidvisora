"use client";

/**
 * Toolbar wrapper: white card with search + filters. Same style as Contacts.
 * leftSlot = tabs/chips; children = search input + filter controls.
 */
export function ListPageToolbar({
  leftSlot,
  children,
  className = "",
}: {
  leftSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col justify-between gap-3 rounded-[var(--wp-radius-sm)] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-2 shadow-sm lg:flex-row lg:items-center lg:gap-4 ${className}`}
    >
      {leftSlot != null && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin px-1 min-w-0 shrink-0 py-1 [&_button]:min-h-[44px] [&_button]:shrink-0 lg:[&_button]:min-h-0">
          {leftSlot}
        </div>
      )}
      <div className="flex items-center gap-2 w-full lg:flex-1 lg:min-w-0 px-1 lg:px-2">{children}</div>
    </div>
  );
}
