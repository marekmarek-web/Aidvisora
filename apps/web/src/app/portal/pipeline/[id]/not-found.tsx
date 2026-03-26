import Link from "next/link";

export default function OpportunityNotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-lg font-semibold text-[color:var(--wp-text)]">Obchod nenalezen</h1>
      <p className="text-[color:var(--wp-text-secondary)] mt-1">Tento obchodní případ neexistuje nebo nemáte oprávnění k zobrazení.</p>
      <Link href="/portal/pipeline" className="mt-4 inline-block text-blue-600 hover:underline">
        Zpět na obchodní nástěnku
      </Link>
    </div>
  );
}
