import { getContactsList } from "@/app/actions/contacts";
import { CsvImportForm } from "@/app/dashboard/contacts/CsvImportForm";
import { ContactsPageClient } from "./ContactsPageClient";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission, type RoleName } from "@/lib/auth/permissions";

export default async function ContactsPage() {
  const auth = await requireAuth();
  const canPermanentlyDelete = hasPermission(auth.roleName as RoleName, "contacts:delete");

  let list: Awaited<ReturnType<typeof getContactsList>> = [];
  try {
    list = await getContactsList();
  } catch {
    list = [];
  }

  return (
    <div className="p-4 space-y-8">
      <ContactsPageClient initialList={list} canPermanentlyDelete={canPermanentlyDelete} />
      <section id="import" className="max-w-[1600px] mx-auto scroll-mt-4">
        <h2 className="text-lg font-bold text-[color:var(--wp-text)] mb-3">Import</h2>
        <CsvImportForm />
      </section>
    </div>
  );
}
