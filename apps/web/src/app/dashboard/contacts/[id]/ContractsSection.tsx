"use client";

import { ContactContractModals } from "./ContactContractModals";
import { ContractsListSection } from "./ContractsListSection";

/** Dashboard i portál — seznam + wizard/úprava (modaly sdílí URL `add` / `edit`). */
export function ContractsSection({ contactId }: { contactId: string }) {
  return (
    <>
      <ContractsListSection contactId={contactId} />
      <ContactContractModals contactId={contactId} />
    </>
  );
}

export { ContractsListSection } from "./ContractsListSection";
export { ContactContractModals } from "./ContactContractModals";
