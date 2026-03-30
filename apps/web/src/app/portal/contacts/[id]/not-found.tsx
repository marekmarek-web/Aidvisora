import Link from "next/link";

export default function ContactDetailNotFound() {
  return (
    <div className="flex min-h-[min(60dvh,480px)] items-center justify-center px-4 py-8">
      <div className="max-w-md rounded-lg border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] p-6 text-center sm:p-8">
        <h2 className="mb-2 text-lg font-black text-[color:var(--wp-text)]">Kontakt nenalezen</h2>
        <p className="mb-4 text-sm text-[color:var(--wp-text-secondary)]">
          Tento kontakt neexistuje nebo k němu nemáte přístup. Pokud jste ho právě vytvořili, zkuste obnovit stránku nebo se vraťte na seznam.
        </p>
        <Link
          href="/portal/contacts"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Zpět na kontakty
        </Link>
      </div>
    </div>
  );
}
