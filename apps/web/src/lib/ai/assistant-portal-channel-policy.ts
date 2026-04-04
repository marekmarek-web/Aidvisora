/**
 * Pravidla pro výběr kanálu mezi klientským požadavkem (pipeline) a materiálovým požadavkem.
 * Text se vkládá do promptu extrakce záměru (fáze 6).
 */

export const ASSISTANT_PORTAL_CHANNEL_POLICY_TEXT = `
KANÁL PORTÁLU — kdy použít jaký záměr:
- create_client_request / create_service_case: klient chce službu, radu, změnu smlouvy, stížnost, obecný „požadavek" řešený jako obchod v pipeline s customFields client_portal_request. Vhodné pro sledování stavu a práci poradce v CRM.
  DŮLEŽITÉ: shrnutí s úkoly pro klienta (např. „požádat o podklady", „naplánovat schůzku", více kroků najednou, follow-up po nabídce) NEPOSÍLEJ jako send_portal_message — vždy create_client_request (text dej do description) nebo u čistě seznamu dokumentů create_material_request / request_client_documents.
- create_material_request / request_client_documents: konkrétní dokumenty, podklady, potvrzení příjmů, výpisy — strukturovaný seznam úkolů pro klienta (advisor_material_requests).
- notify_client_portal: jednorázové upozornění klientovi v portálu (notifikace + push), bez nového obchodu ani materiálového požadavku — např. „dej mu vědět, že…", připomenutí termínu.
- draft_portal_message / send_portal_message: jen krátká konverzace v záložce Zprávy — jedna informační věta (např. „smlouva je připravena k podpisu"), ne souhrn úkolů ani plán dalších kroků.
Nepřekádej kanály: materiálový požadavek není náhradou za servisní případ a naopak.
`.trim();
