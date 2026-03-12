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
    <div className="rounded-[var(--wp-radius-sm)] border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-col items-center justify-center py-12 px-6">
        <p className="text-slate-600 text-sm font-medium">Žádné výsledky nevyhovují hledání nebo filtrům.</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-4 px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-[var(--wp-radius-sm)] border border-indigo-200 transition-colors"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
