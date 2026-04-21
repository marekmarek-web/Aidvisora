import { AIReviewStatusStrip } from "./AIReviewStatusStrip";

/**
 * FL-1 — bezhlavičkový shell pro AI Review detail.
 *
 * `portal/layout.tsx` pro tuto cestu přeskakuje `PortalShell`, takže extrakční
 * panel + PDF viewer dostávají plnou výšku viewportu. Kompaktní status strip
 * drží jen back-link, štítek feature a odskok na portál.
 */
export default function AIReviewDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col bg-[color:var(--wp-surface-page)]">
      <AIReviewStatusStrip />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
