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
      className={`bg-white p-2 rounded-[var(--wp-radius-sm)] border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}
    >
      {leftSlot != null && (
        <div className="flex items-center gap-1 overflow-x-auto px-2 min-w-0 shrink-0">{leftSlot}</div>
      )}
      <div className="flex items-center gap-2 w-full md:flex-1 md:min-w-0 px-2">{children}</div>
    </div>
  );
}
