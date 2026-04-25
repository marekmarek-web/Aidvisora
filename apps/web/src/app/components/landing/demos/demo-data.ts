/**
 * Centralizovaná demo data pro interaktivní showcase moduly na homepage.
 *
 * Pravidla:
 * - žádná produkční data,
 * - částky, čísla smluv a poznámky jsou ilustrativní,
 * - žádné fake statistiky ani přepálené claimy.
 *
 * Instituce: používáme veřejně známé české hráče (Allianz, Generali ČP, ČSOB,
 * NN, Conseq, ŠkoFIN). Místo kopírování proprietárních log renderujeme monogram
 * v přibližné brand barvě — dojem „reálné finanční aplikace" bez nároku na
 * partnerství či právní konflikt. `brand` → mapping v `INSTITUTION_BRANDS`.
 */

export type InstitutionBrand = {
  /** zkratka zobrazená v chipu (2–3 znaky) */
  label: string;
  /** tailwind třídy pro pozadí chipu (nasycená brand barva) */
  bg: string;
  /** tailwind třídy pro barvu textu uvnitř chipu */
  fg: string;
};

export const INSTITUTION_BRANDS: Record<string, InstitutionBrand> = {
  allianz: { label: "AZ", bg: "bg-[#003781]", fg: "text-white" },
  amundi: { label: "AM", bg: "bg-[#061B4E]", fg: "text-white" },
  atris: { label: "AT", bg: "bg-[#111827]", fg: "text-white" },
  csob: { label: "ČSOB", bg: "bg-[#004890]", fg: "text-white" },
  efekta: { label: "EO", bg: "bg-[#F4F1EA]", fg: "text-[#3A322A]" },
  /** iShares (BlackRock) — ETF značka pro landing dema */
  ishares: { label: "iS", bg: "bg-[#0B0B0B]", fg: "text-white" },
  generali: { label: "G", bg: "bg-[#C21B17]", fg: "text-white" },
  kooperativa: { label: "K", bg: "bg-[#3C008C]", fg: "text-white" },
  nn: { label: "NN", bg: "bg-[#EE7F00]", fg: "text-white" },
  conseq: { label: "CQ", bg: "bg-[#0B1F3A]", fg: "text-white" },
  raiffeisen: { label: "RB", bg: "bg-[#F8C300]", fg: "text-black" },
  skofin: { label: "ŠF", bg: "bg-[#4BA82E]", fg: "text-white" },
  uniqa: { label: "UQ", bg: "bg-[#005CA9]", fg: "text-white" },
  kb: { label: "KB", bg: "bg-[#C8102E]", fg: "text-white" },
};

export type DemoNote = {
  id: string;
  domain: "investice" | "zp" | "penzijni";
  domainLabel: string;
  title: string;
  preview: string;
  updatedLabel: string;
  accent: string;
};

export const DEMO_NOTES: readonly DemoNote[] = [
  {
    id: "note-inv",
    domain: "investice",
    domainLabel: "Investice",
    title: "Revize portfolia — rodina Dvořákových",
    preview:
      "Navýšit pravidelnou investici z 5 000 na 7 500 Kč. Probrat rebalanc na konzervativnější profil po 55.",
    updatedLabel: "před 2 h",
    accent: "emerald",
  },
  {
    id: "note-zp",
    domain: "zp",
    domainLabel: "Životní pojištění",
    title: "Úprava krytí — Martina H.",
    preview:
      "Chybí krytí invalidity 3. stupně. Nabídnout navýšení IŽP. Ověřit zdravotní dotazník před schůzkou.",
    updatedLabel: "včera",
    accent: "rose",
  },
  {
    id: "note-pen",
    domain: "penzijni",
    domainLabel: "Penzijní spoření",
    title: "DIP vs. DPS — podklad pro schůzku",
    preview:
      "Připravit srovnání DIP a DPS pro klienta ve věku 38 let, daňová úspora, likvidita, výstup do 60 let.",
    updatedLabel: "před 3 dny",
    accent: "indigo",
  },
];

export type DemoRequest = {
  id: string;
  clientName: string;
  caseType: "hypoteka" | "pojisteni" | "investice";
  caseLabel: string;
  title: string;
  preview: string;
  attachments: number;
  receivedLabel: string;
};

export const DEMO_REQUEST: DemoRequest = {
  id: "req-1",
  clientName: "Petr Havel",
  caseType: "hypoteka",
  caseLabel: "Hypotéka",
  title: "Chci řešit novou hypotéku",
  preview:
    "Dobrý den, s manželkou kupujeme byt v Brně. Posílám výpisy a pracovní smlouvy. Zavolejte prosím tento týden.",
  attachments: 4,
  receivedLabel: "teď",
};

export type DemoActivityType = "schuzka" | "telefonat" | "kafe" | "ukol" | "email";

export const DEMO_ACTIVITY_TYPES: ReadonlyArray<{
  id: DemoActivityType;
  label: string;
  hint: string;
}> = [
  { id: "schuzka", label: "Schůzka", hint: "Osobní setkání s klientem" },
  { id: "telefonat", label: "Telefonát", hint: "Hovor nebo konzultace" },
  { id: "kafe", label: "Kafe", hint: "Neformální setkání" },
  { id: "ukol", label: "Úkol", hint: "Akce bez klienta" },
  { id: "email", label: "E-mail", hint: "Odeslat / připravit zprávu" },
];

export type DemoCalendarClient = {
  id: string;
  name: string;
  initials: string;
};

export const DEMO_CALENDAR_CLIENTS: readonly DemoCalendarClient[] = [
  { id: "c-1", name: "Jana Nováková", initials: "JN" },
  { id: "c-2", name: "Petr Havel", initials: "PH" },
  { id: "c-3", name: "Rodina Dvořákových", initials: "RD" },
  { id: "c-4", name: "Martina Horáková", initials: "MH" },
];

export type DemoMeeting = {
  id: string;
  day: number; // 0-4 (Po-Pá)
  startHour: number; // 8-17
  durationHours: number;
  type: DemoActivityType;
  title: string;
  clientId: string;
};

export const DEMO_MEETINGS: readonly DemoMeeting[] = [
  { id: "m-1", day: 0, startHour: 9, durationHours: 1, type: "schuzka", title: "Revize portfolia", clientId: "c-1" },
  { id: "m-2", day: 1, startHour: 11, durationHours: 1, type: "telefonat", title: "Dotaz k hypotéce", clientId: "c-2" },
  { id: "m-3", day: 2, startHour: 14, durationHours: 2, type: "schuzka", title: "Rodinný plán", clientId: "c-3" },
  { id: "m-4", day: 3, startHour: 10, durationHours: 1, type: "kafe", title: "Neformální setkání", clientId: "c-4" },
  { id: "m-5", day: 4, startHour: 13, durationHours: 1, type: "ukol", title: "Odeslat podklady", clientId: "c-1" },
];

export type DemoEmailTemplate = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  body: string;
};

export const DEMO_EMAIL_TEMPLATES: readonly DemoEmailTemplate[] = [
  {
    id: "tpl-birthday",
    name: "Přání k narozeninám",
    subject: "Všechno nejlepší, {{jmeno}} 🎉",
    preheader: "Krátká zpráva od vašeho poradce",
    body:
      "Milá/ý {{jmeno}},\n\nk narozeninám vám přejeme hlavně zdraví, pohodu a dobrá rozhodnutí — i ta finanční.\n\nPokud se chcete v novém roce podívat na portfolio nebo upravit krytí, dejte mi vědět, rád se zastavím.\n\nS pozdravem,\n{{poradce}}",
  },
  {
    id: "tpl-invite",
    name: "Pozvánka na konzultaci",
    subject: "Pozvánka na roční revizi portfolia",
    preheader: "Zabere 45 minut, osobně nebo online",
    body:
      "Dobrý den {{jmeno}},\n\nblíží se konec roku — navrhuji společně projít portfolio, krytí a daňové optimalizace pro příští rok.\n\nSchůzka zabere cca 45 minut, klidně online. Vyberte si termín v mém kalendáři.\n\nTěším se,\n{{poradce}}",
  },
  {
    id: "tpl-summary",
    name: "Měsíční souhrn",
    subject: "Váš měsíční souhrn — {{mesic}}",
    preheader: "Co se v portfoliu dělo za poslední měsíc",
    body:
      "Dobrý den {{jmeno}},\n\nposílám krátký souhrn za {{mesic}}:\n\n• vývoj investičního portfolia\n• aktuální stav pojistných smluv\n• nadcházející termíny a úkoly\n\nDetailní výstup najdete ve svém klientském portálu.\n\nS pozdravem,\n{{poradce}}",
  },
];

export type DemoProduct = {
  id: string;
  kind: "zp" | "investice" | "penzijni" | "hypoteka" | "leasing";
  kindLabel: string;
  institution: string;
  /** klíč do `INSTITUTION_BRANDS` — řídí barvu log-chipu */
  brand: keyof typeof INSTITUTION_BRANDS;
  contractNumber: string;
  amountLabel: string;
  frequencyLabel: string;
  accent: string;
  note?: string;
};

export type DemoClient = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  products: readonly DemoProduct[];
};

export const DEMO_CLIENT: DemoClient = {
  id: "client-jn",
  name: "Jana Nováková",
  initials: "JN",
  email: "jana.novakova@example.cz",
  phone: "+420 777 123 456",
  city: "Praha",
  products: [
    {
      id: "p-zp",
      kind: "zp",
      kindLabel: "Životní pojištění",
      institution: "Kooperativa životní pojišťovna",
      brand: "kooperativa",
      contractNumber: "KOO-852014-22",
      amountLabel: "2 442 Kč",
      frequencyLabel: "měsíčně",
      accent: "rose",
      note: "UNIQA Life? No — zde čistě Kooperativa. Invalidita 2. a 3. stupně, pracovní neschopnost.",
    },
    {
      id: "p-inv",
      kind: "investice",
      kindLabel: "Investice",
      institution: "Amundi Czech Republic Asset Management",
      brand: "amundi",
      contractNumber: "AM-2240-2401",
      amountLabel: "3 000 Kč",
      frequencyLabel: "měsíčně",
      accent: "emerald",
      note: "Fondy a ETF (Amundi) · pravidelná investice, horizont 15+ let",
    },
    {
      id: "p-pen",
      kind: "penzijni",
      kindLabel: "Penzijní spoření",
      institution: "Conseq penzijní společnost",
      brand: "conseq",
      contractNumber: "CQ-2403-1208",
      amountLabel: "1 000 Kč",
      frequencyLabel: "měsíčně + státní příspěvek",
      accent: "indigo",
      note: "DIP / DPS přehled, dynamická strategie, daňové zvýhodnění.",
    },
    {
      id: "p-hypo",
      kind: "hypoteka",
      kindLabel: "Hypotéka",
      institution: "Raiffeisenbank hypotéka",
      brand: "raiffeisen",
      contractNumber: "RB-1124-331",
      amountLabel: "3 800 000 Kč",
      frequencyLabel: "fixace do 2028 · 14 200 Kč / měs.",
      accent: "blue",
      note: "Anuita 14 200 Kč měsíčně · sazba fixovaná do 2028.",
    },
    {
      id: "p-leas",
      kind: "leasing",
      kindLabel: "Leasing na auto",
      institution: "ČSOB Leasing",
      brand: "csob",
      contractNumber: "LE-0042-89",
      amountLabel: "4 959 Kč",
      frequencyLabel: "měsíčně · doba 48 měsíců",
      accent: "amber",
      note: "Majetek a odpovědnost / leasing vozidla · splatnost 48 měsíců.",
    },
  ],
};

export type DemoPortalNav = {
  id:
    | "prehled"
    | "portfolio"
    | "platby"
    | "pozadavky"
    | "zpravy";
  label: string;
};

export const DEMO_PORTAL_NAV: readonly DemoPortalNav[] = [
  { id: "prehled", label: "Můj přehled" },
  { id: "portfolio", label: "Moje portfolio" },
  { id: "platby", label: "Platby a příkazy" },
  { id: "pozadavky", label: "Moje požadavky" },
  { id: "zpravy", label: "Zprávy poradci" },
];

export type DemoPayment = {
  id: string;
  productLabel: string;
  institution: string;
  brand: keyof typeof INSTITUTION_BRANDS;
  accountNumber: string;
  variableSymbol: string;
  amountLabel: string;
  dueLabel: string;
};

export const DEMO_PAYMENTS: readonly DemoPayment[] = [
  {
    id: "pay-zp",
    productLabel: "Životní pojištění",
    institution: "Kooperativa životní pojišťovna",
    brand: "kooperativa",
    accountNumber: "1071801005 / 5500",
    variableSymbol: "8801955412",
    amountLabel: "2 442 Kč",
    dueLabel: "15. v měsíci",
  },
  {
    id: "pay-inv",
    productLabel: "Investice — pravidelná",
    institution: "Amundi Czech Republic Asset Management",
    brand: "amundi",
    accountNumber: "138769176 / 2700",
    variableSymbol: "7023398569",
    amountLabel: "3 000 Kč",
    dueLabel: "10. v měsíci",
  },
  {
    id: "pay-pen",
    productLabel: "Penzijní spoření",
    institution: "Conseq penzijní společnost",
    brand: "conseq",
    accountNumber: "626111626 / 0300",
    variableSymbol: "371748",
    amountLabel: "1 000 Kč",
    dueLabel: "20. v měsíci",
  },
];
