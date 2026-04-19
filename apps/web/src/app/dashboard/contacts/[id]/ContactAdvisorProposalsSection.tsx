import { listProposalsForContact } from "@/app/actions/advisor-proposals";
import { ContactAdvisorProposalsClient } from "./ContactAdvisorProposalsClient";

export async function ContactAdvisorProposalsSection({ contactId }: { contactId: string }) {
  const proposals = await listProposalsForContact(contactId).catch(() => []);
  return <ContactAdvisorProposalsClient contactId={contactId} initialProposals={proposals} />;
}
