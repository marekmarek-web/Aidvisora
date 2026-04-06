import { Suspense } from "react";
import { requireAuth } from "@/lib/auth/require-auth";
import { getFundLibrarySetupSnapshot } from "@/lib/fund-library/setup-snapshot.server";
import type { RoleName } from "@/shared/rolePermissions";
import FinancialAnalysisPageClient from "./FinancialAnalysisPageClient";

export default async function FinancialAnalysisPage() {
  const auth = await requireAuth();
  const fundLibrarySnapshot = await getFundLibrarySetupSnapshot(
    auth.tenantId,
    auth.userId,
    auth.roleName as RoleName,
  );

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center px-4 text-[color:var(--wp-text-secondary)]">
          Načítání…
        </div>
      }
    >
      <FinancialAnalysisPageClient fundLibrarySnapshot={fundLibrarySnapshot} />
    </Suspense>
  );
}
