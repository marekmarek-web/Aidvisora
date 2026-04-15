/**
 * AI Review segment — full-height flex column so the extraction shell can use
 * all vertical space under the portal shell (no extra padding gap).
 */
export default function ContractsReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
