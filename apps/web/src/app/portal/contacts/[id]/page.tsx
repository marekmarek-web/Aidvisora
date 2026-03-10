import Link from "next/link";
import { notFound } from "next/navigation";
import { getContact } from "@/app/actions/contacts";
import { getHouseholdForContact } from "@/app/actions/households";
import { ContractsSection } from "@/app/dashboard/contacts/[id]/ContractsSection";
import { DocumentsSection } from "@/app/dashboard/contacts/[id]/DocumentsSection";
import { InviteToClientZoneButton } from "@/app/dashboard/contacts/[id]/InviteToClientZoneButton";
import { SendPaymentPdfButton } from "@/app/dashboard/contacts/[id]/SendPaymentPdfButton";
import { ContactActivityTimeline } from "@/app/dashboard/contacts/[id]/ContactActivityTimeline";
import { ChatThread } from "@/app/components/ChatThread";
import { ClientFinancialSummary } from "@/app/components/contacts/ClientFinancialSummary";
import { ComplianceSection } from "@/app/components/contacts/ComplianceSection";
import { ContactTabLayout } from "./ContactTabLayout";
import { ContactTasksAndEvents } from "./ContactTasksAndEvents";
import { ContactOpportunityBoard } from "./ContactOpportunityBoard";
import { ContactHouseholdCard } from "./ContactHouseholdCard";
import { ContactOpenTasksPreview } from "./ContactOpenTasksPreview";
import { ContactNotesSection } from "./ContactNotesSection";
import { ContactOverviewKpi } from "./ContactOverviewKpi";
import { ClientCoverageWidget } from "@/app/components/contacts/ClientCoverageWidget";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, household] = await Promise.all([
    getContact(id),
    getHouseholdForContact(id),
  ]);
  if (!contact) notFound();

  const overviewContent = (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-8">
      <div className="space-y-6 min-w-0">
        <ContactOverviewKpi contactId={id} />
        <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ClientCoverageWidget contactId={id} />
        </div>
        <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Kontaktní údaje</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <p className="flex flex-col gap-0.5">
            <span className="text-slate-500 text-xs font-medium">E-mail</span>
            <span className="text-slate-800">{contact.email ?? "—"}</span>
          </p>
          <p className="flex flex-col gap-0.5">
            <span className="text-slate-500 text-xs font-medium">Telefon</span>
            <span className="text-slate-800">{contact.phone ?? "—"}</span>
          </p>
          {contact.title && (
            <p className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs font-medium">Titul</span>
              <span className="text-slate-800">{contact.title}</span>
            </p>
          )}
          {contact.birthDate && (
            <p className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs font-medium">Datum narození</span>
              <span className="text-slate-800">{contact.birthDate}</span>
            </p>
          )}
          {(contact.street || contact.city || contact.zip) && (
            <p className="flex flex-col gap-0.5 md:col-span-2">
              <span className="text-slate-500 text-xs font-medium">Adresa</span>
              <span className="text-slate-800">
                {[contact.street, [contact.city, contact.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              </span>
            </p>
          )}
          {contact.lifecycleStage && (
            <p className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs font-medium">Fáze</span>
              <span className="text-slate-800 capitalize">
                {contact.lifecycleStage === "former_client" ? "Bývalý klient" : contact.lifecycleStage === "client" ? "Klient" : contact.lifecycleStage}
              </span>
            </p>
          )}
          {contact.priority && (
            <p className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs font-medium">Priorita</span>
              <span className="text-slate-800">
                {contact.priority === "low" ? "Nízká" : contact.priority === "normal" ? "Běžná" : contact.priority === "high" ? "Vysoká" : contact.priority === "urgent" ? "Urgentní" : contact.priority}
              </span>
            </p>
          )}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-slate-500 text-xs font-medium">Štítky</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {contact.tags.map((tag) => (
                  <span key={tag} className="inline-block rounded-[var(--wp-radius-xs)] bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 border border-blue-100">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(contact.nextServiceDue || contact.serviceCycleMonths) && (
            <p className="flex flex-col gap-0.5 md:col-span-2">
              <span className="text-slate-500 text-xs font-medium">Servisní cyklus</span>
              <span className="text-slate-800">
                {contact.serviceCycleMonths ?? "—"} měsíců
                {contact.nextServiceDue && <> · Příští servis: {contact.nextServiceDue}</>}
              </span>
            </p>
          )}
          {contact.gdprConsentAt && (
            <p className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-xs font-medium">Souhlas GDPR</span>
              <span className="text-slate-800">{new Date(contact.gdprConsentAt).toLocaleString("cs-CZ")}</span>
            </p>
          )}
          {(contact.referralSource || contact.referralContactName) && (
            <p className="flex flex-col gap-0.5 md:col-span-2">
              <span className="text-slate-500 text-xs font-medium">Doporučení</span>
              <span className="text-slate-800">
                {[contact.referralSource, contact.referralContactName].filter(Boolean).join(" – ")}
                {contact.referralContactId && (
                  <Link href={`/portal/contacts/${contact.referralContactId}`} className="ml-2 text-blue-600 hover:underline">
                    kontakt
                  </Link>
                )}
              </span>
            </p>
          )}
        </div>
        {contact.email && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <InviteToClientZoneButton contactId={id} />
          </div>
        )}
        </div>
      </div>

      <aside className="space-y-6 lg:order-2">
        {household && <ContactHouseholdCard household={household} />}
        <ContactOpenTasksPreview contactId={id} />
      </aside>
    </div>
  );

  const smlouvyContent = (
    <div className="space-y-6 md:space-y-8">
      <ContractsSection contactId={id} />
      <ClientFinancialSummary contactId={id} />
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-2 text-sm">Platební instrukce</h2>
        <SendPaymentPdfButton contactId={id} />
      </div>
    </div>
  );

  const aktivitaContent = (
    <div className="space-y-6 md:space-y-8">
      <ContactActivityTimeline contactId={id} />
      <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-3 text-sm">Zprávy</h2>
        <ChatThread contactId={id} currentUserType="advisor" />
      </div>
    </div>
  );

  const zapiskyContent = (
    <div className="space-y-6 md:space-y-8">
      <ContactNotesSection contactId={id} />
    </div>
  );

  const tabs = [
    { id: "prehled" as const, label: "Přehled", content: overviewContent },
    { id: "smlouvy" as const, label: "Produkty", content: smlouvyContent },
    { id: "dokumenty" as const, label: "Dokumenty", content: <div className="space-y-6 md:space-y-8"><DocumentsSection contactId={id} /></div> },
    { id: "zapisky" as const, label: "Zápisky", content: zapiskyContent },
    { id: "aktivita" as const, label: "Aktivita", content: aktivitaContent },
    { id: "ukoly" as const, label: "Úkoly a schůzky", content: <div className="space-y-6 md:space-y-8"><ContactTasksAndEvents contactId={id} /></div> },
    { id: "obchody" as const, label: "Obchody", content: <div className="space-y-6 md:space-y-8"><ContactOpportunityBoard contactId={id} /></div> },
    { id: "kyc" as const, label: "KYC & AML", content: <div className="space-y-6 md:space-y-8"><ComplianceSection contactId={id} /></div> },
  ];

  const initials = [contact.firstName, contact.lastName].map((s) => s?.charAt(0) ?? "").join("").toUpperCase() || "?";
  const statusBadge = (() => {
    if (contact.priority === "urgent" || contact.priority === "high") return { label: "Vysoká priorita", className: "bg-amber-100 text-amber-800 border-amber-200" };
    if (contact.lifecycleStage === "client") return { label: "Klient", className: "bg-blue-100 text-blue-800 border-blue-200" };
    if (contact.lifecycleStage === "lead") return { label: "Lead", className: "bg-slate-100 text-slate-700 border-slate-200" };
    if (contact.lifecycleStage === "prospect") return { label: "Prospect", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (contact.lifecycleStage === "former_client") return { label: "Bývalý klient", className: "bg-slate-100 text-slate-500 border-slate-200" };
    if (contact.tags && contact.tags.length > 0) return { label: contact.tags[0], className: "bg-blue-50 text-blue-700 border-blue-100" };
    return null;
  })();

  const addressLine = [contact.street, [contact.city, contact.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[var(--wp-bg)] pb-8">
      <div className="sticky top-0 z-20 bg-[var(--wp-bg)] border-b border-slate-200/80 px-4 sm:px-6 md:px-8 pt-4 md:pt-6 pb-0">
        <nav className="flex items-center text-sm font-medium text-slate-500 mb-4" aria-label="Breadcrumb">
          <Link href="/portal/contacts" className="hover:text-[var(--wp-accent)] transition-colors">Kontakty</Link>
          <span className="mx-2 text-slate-300">/</span>
          <span className="text-slate-800 font-semibold">{contact.firstName} {contact.lastName}</span>
        </nav>

        {/* Hero card v2 */}
        <div className="rounded-[var(--wp-radius-lg)] border border-slate-200 bg-white shadow-lg overflow-hidden mb-6">
          <div className="p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 md:gap-6">
              <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6 min-w-0">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-[var(--wp-radius-lg)] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl md:text-3xl shadow-md shrink-0"
                  aria-hidden
                >
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {contact.firstName} {contact.lastName}
                    </h1>
                    {contact.title && (
                      <span className="text-slate-500 text-sm md:text-base">{contact.title}</span>
                    )}
                    {statusBadge && (
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    )}
                  </div>
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {contact.tags.map((tag) => (
                        <span key={tag} className="inline-block rounded-lg bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors truncate">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                        <span className="truncate">{contact.email}</span>
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        {contact.phone}
                      </a>
                    )}
                    {addressLine && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span className="truncate max-w-[200px] sm:max-w-none">{addressLine}</span>
                      </span>
                    )}
                    {contact.birthDate && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        {contact.birthDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions – always visible, touch-friendly */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-h-[44px]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    Zavolat
                  </a>
                )}
                <Link
                  href="#aktivita"
                  className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-h-[44px]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Zpráva
                </Link>
                <Link
                  href={`/portal/contacts/${id}/summary`}
                  className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-h-[44px]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                  Klientská zpráva
                </Link>
                <Link
                  href={`/portal/mindmap?contactId=${id}`}
                  className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-h-[44px]"
                >
                  Strategická mapa
                </Link>
                <Link
                  href={`/portal/contacts/${id}/edit`}
                  className="inline-flex items-center gap-2 rounded-[var(--wp-radius)] bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold shadow-md hover:bg-slate-800 transition-colors min-h-[44px]"
                >
                  Upravit
                </Link>
              </div>
            </div>
          </div>
        </div>

        <ContactTabLayout tabs={tabs} defaultTab="prehled" />
      </div>
    </div>
  );
}
