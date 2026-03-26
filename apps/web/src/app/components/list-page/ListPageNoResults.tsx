"use client";

/**
 * No-results state: list has items but filters/search returned nothing. Reset button to clear search/filters.
 */
export function ListPageNoResults({
  onReset,
  resetLabel = "Zrušit vyhledávání",
}: {
  onReset: () => void;
  resetLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--wp-radius-sm)] border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)]">
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <p className="text-sm font-medium text-[color:var(--wp-text-secondary)]">Žádné výsledky nevyhovují hledání nebo filtrům.</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 rounded-[var(--wp-radius-sm)] border border-indigo-300/60 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
