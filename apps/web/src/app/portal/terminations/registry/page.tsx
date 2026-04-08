import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/require-auth";
import { hasPermission } from "@/lib/auth/permissions";
import { listTerminationInsurerRegistryDirectoryAction } from "@/app/actions/terminations";
import { isTerminationsModuleEnabledOnServer } from "@/lib/terminations/terminations-feature-flag";
import { TerminationRegistryDirectory } from "./TerminationRegistryDirectory";

export const metadata: Metadata = {
  title: "Registr pojišťoven — výpovědi",
};

export const dynamic = "force-dynamic";

export default async function TerminationRegistryPage() {
  const auth = await requireAuth();
  if (auth.roleName === "Client") {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-red-600">Nepovoleno.</p>
      </div>
    );
  }

  if (!isTerminationsModuleEnabledOnServer()) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-[color:var(--wp-text-secondary)]">Modul výpovědí je vypnutý.</p>
      </div>
    );
  }

  if (!hasPermission(auth.roleName, "contacts:read")) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-red-600">Nemáte oprávnění zobrazit registr.</p>
      </div>
    );
  }

  const res = await listTerminationInsurerRegistryDirectoryAction();
  if (!res.ok) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-sm text-red-600" role="alert">
          {res.error}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--wp-text)]">Registr pojišťoven — adresy a kanály</h1>
          <p className="mt-1 text-sm text-[color:var(--wp-text-secondary)]">
            Jednotný seznam pro výpovědi a ukončení smluv. Podklady odpovídají internímu katalogu v databázi.
          </p>
        </div>
        <Link
          href="/portal/terminations/new"
          className="rounded-[var(--wp-radius)] bg-[var(--wp-accent)] px-4 py-2.5 text-sm font-semibold text-white min-h-[44px] inline-flex items-center"
        >
          Nová výpověď
        </Link>
      </div>

      <TerminationRegistryDirectory rows={res.rows} />
    </div>
  );
}
