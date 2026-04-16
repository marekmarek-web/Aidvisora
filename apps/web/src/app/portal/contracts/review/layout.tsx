/**
 * AI Review segment — full-height flex column so the extraction shell can use
 * all vertical space under the portal shell (no extra padding gap).
 * Bez overflow-hidden: seznam může růst a scroll je v hlavní oblasti portálu; detail řídí výšku přes AIReviewExtractionShell.
 */
export default function ContractsReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}
