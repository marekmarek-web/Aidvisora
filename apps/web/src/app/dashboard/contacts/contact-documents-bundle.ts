import { getDocumentsForContact } from "@/app/actions/documents";
import { getContractsByContact } from "@/app/actions/contracts";
import type { DocumentRow } from "@/app/actions/documents";
import type { ContractRow } from "@/app/actions/contracts";

/**
 * Dokumenty + smlouvy pro kontakt (sdílený React Query klíč).
 * Smlouvy musí být vždy načteny pro modaly úpravy smlouvy; chyba u dokumentů
 * (např. chybí documents:read) nesmí zablokovat načtení smluv.
 */
export async function fetchContactDocumentsBundle(contactId: string): Promise<{
  docs: DocumentRow[];
  contracts: ContractRow[];
}> {
  const [docsResult, contractsResult] = await Promise.allSettled([
    getDocumentsForContact(contactId),
    getContractsByContact(contactId),
  ]);

  const docs: DocumentRow[] =
    docsResult.status === "fulfilled" ? docsResult.value : [];

  if (contractsResult.status === "rejected") {
    throw contractsResult.reason;
  }

  return { docs, contracts: contractsResult.value };
}
