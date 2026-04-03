/**
 * 3G: Assistant playbook definitions.
 *
 * Playbooks provide heuristic guidance hints and next-step suggestions for the
 * assistant confirmation flow. They are config-driven and domain-specific.
 *
 * Architecture boundary (3G NBA decision):
 *   - Playbooks are the guidance source for the *assistant confirmation flow* only.
 *   - The LLM-based `generateNextBestAction()` in ai-service.ts is a separate
 *     client-level NBA channel and is NOT replaced or extended here.
 *   - The rule-based `generateFollowUpSuggestions()` in followup-recommendations.ts
 *     is a distinct advisory-feed engine; `augmentSuggestionsWithPlaybookContext`
 *     is a helper for future NBA feed integration and is NOT wired to production yet.
 */
import type { AssistantPlaybook } from "./types";

export const ASSISTANT_PLAYBOOKS: AssistantPlaybook[] = [
  // ─── HYPOTÉKA / ÚVĚR ────────────────────────────────────────────────────
  {
    id: "hypo_uver",
    label: "Hypotéka / úvěr",
    matches: (m, i) =>
      i.productDomain === "hypo" ||
      i.productDomain === "uver" ||
      /hypoték|hypoteční|úvěr|uver|ltv|úrokov|sazeb|fixac|refinanc/i.test(m),
    defaultProductDomain: "hypo",
    priorityMissingHints: [
      "částka jistiny",
      "LTV nebo zástavní hodnota",
      "banka / nabídka",
      "účel (koupě, rekonstrukce, refinancování)",
      "délka fixace",
      "termín čerpání",
    ],
    nextStepSuggestions: [
      "Ověřit příjem a bonitu klienta v analýze.",
      "Naplánovat předání podkladů bance a termín čerpání.",
      "Zkontrolovat pojistné krytí zástavy a životní pojištění.",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity"],
  },

  // ─── INVESTICE (obecná, bez DIP/DPS) ────────────────────────────────────
  {
    id: "investice",
    label: "Investice",
    matches: (m, i) =>
      i.productDomain === "investice" ||
      /\binvestic|\betf\b|portfolio|fond|akcie|dluhopis|horizont|rizikov/i.test(m),
    defaultProductDomain: "investice",
    priorityMissingHints: [
      "investiční horizont",
      "rizikový profil klienta",
      "cílová částka nebo měsíční příspěvek",
      "pravidelná vs. jednorázová investice",
      "účel investice (rezerva, majetek, důchod)",
    ],
    nextStepSuggestions: [
      "Doplnit vhodnost produktu k investičnímu profilu klienta.",
      "Ověřit diverzifikaci portfolia a korelaci s ostatními produkty.",
      "Naplánovat pravidelnou kontrolu portfolia (doporučeno: ročně).",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity"],
  },

  // ─── DIP / DPS (penzijní produkty) ──────────────────────────────────────
  {
    id: "dip_dps",
    label: "DIP / DPS – penzijní spoření",
    matches: (m, i) =>
      i.productDomain === "dip" ||
      i.productDomain === "dps" ||
      /\bdip\b|\bdps\b|penzijn|spoření na důchod|penzijní/i.test(m),
    defaultProductDomain: "dps",
    priorityMissingHints: [
      "typ produktu (DIP nebo DPS)",
      "měsíční příspěvek klienta",
      "příspěvek zaměstnavatele (pokud relevantní)",
      "investiční strategie nebo fond",
      "daňový odpočet a dopad",
    ],
    nextStepSuggestions: [
      "Ověřit daňové výhody a limity pro klientovu situaci.",
      "Zkontrolovat investiční strategii vůči horizontu odchodu do důchodu.",
      "Domluvit pravidelnou revizi příspěvků při změnách příjmu.",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity", "create_service_case"],
  },

  // ─── ŽIVOTNÍ / RIZIKOVÉ POJIŠTĚNÍ ───────────────────────────────────────
  {
    id: "zivotni_riziko",
    label: "Životní / rizikové pojištění",
    matches: (m, i) =>
      i.productDomain === "zivotni_pojisteni" ||
      /životní|zivotni|rizikov|invalid|trval.*pracovní neschopn|smrt|příjem.*pojišt|pojišt.*příjem/i.test(m),
    defaultProductDomain: "zivotni_pojisteni",
    priorityMissingHints: [
      "pojistná částka pro případ smrti / invalidity",
      "výše pojistného (měsíčně)",
      "délka pojistné doby",
      "beneficiár nebo obmyšlená osoba",
      "výluky (sport, profese)",
    ],
    nextStepSuggestions: [
      "Porovnat výši krytí s měsíčními výdaji domácnosti.",
      "Zkontrolovat výluky vůči zaměstnání nebo koníčkům klienta.",
      "Zvážit doplnění o pojištění pracovní neschopnosti.",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity"],
  },

  // ─── MAJETEK / ODPOVĚDNOST / AUTO / CESTOVNÍ ────────────────────────────
  {
    id: "majetek_odpovednost_auto",
    label: "Majetek / odpovědnost / auto / cestovní",
    matches: (m, i) =>
      ["majetek", "odpovednost", "auto", "cestovni"].includes(i.productDomain ?? "") ||
      /majetek|domácnost|odpovědnost|povinné ručení|havarijní|auto|vozidlo|cestovní|cestovka/i.test(m),
    defaultProductDomain: "majetek",
    priorityMissingHints: [
      "předmět pojištění (nemovitost, vozidlo, majetek)",
      "pojistná částka nebo hodnota majetku",
      "limity plnění",
      "spoluúčast",
      "datum počátku pojištění",
    ],
    nextStepSuggestions: [
      "Zkontrolovat podpojištění nebo nadlimitní majetek.",
      "Sladit pojistnou částku s aktuální hodnotou zástavy / hypotéky.",
      "Ověřit, zda je pokryto pojištění odpovědnosti domácnosti.",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity"],
  },

  // ─── FIREMNÍ POJIŠTĚNÍ ───────────────────────────────────────────────────
  {
    id: "firma_pojisteni",
    label: "Firemní pojištění",
    matches: (m, i) =>
      i.productDomain === "firma_pojisteni" ||
      /firemní pojišt|podnikatel|firma.*pojišt|pojišt.*firma|živnostník|s\.r\.o\.|a\.s\./i.test(m),
    defaultProductDomain: "firma_pojisteni",
    priorityMissingHints: [
      "předmět podnikání",
      "typ pojistky (odpovědnost / majetek / D&O / přerušení provozu)",
      "pojistná částka nebo odhadovaná škoda",
      "počet zaměstnanců",
      "roční obrat firmy",
    ],
    nextStepSuggestions: [
      "Ověřit rozsah odpovědnostního krytí vůči obchodní činnosti.",
      "Zkontrolovat pojistku majetku firmy, provozovny a vybavení.",
      "Domluvit předání podkladů (faktury, smlouvy, soupis vybavení).",
    ],
    supportedIntents: ["create_opportunity", "update_opportunity"],
  },

  // ─── SERVIS / VÝROČÍ ────────────────────────────────────────────────────
  {
    id: "servis_vyroci",
    label: "Servis smluv / výročí",
    matches: (m, i) =>
      i.productDomain === "servis" ||
      i.intentType === "create_service_case" ||
      /servis|výročí|vyroci|sjednání|změna smlouvy|doplňkov|cross-sell|revize smlouvy/i.test(m),
    defaultProductDomain: "servis",
    priorityMissingHints: [
      "která smlouva nebo produkt",
      "co se mění nebo reviduje",
      "deadline pro klienta nebo pojišťovnu",
      "návrh nového parametru (částka, krytí, fond)",
    ],
    nextStepSuggestions: [
      "Ověřit aktuální stav smlouvy a termín výročí v portfoliu.",
      "Připravit a zaslat shrnutí změn klientovi přes portál.",
      "Zaznamenat výsledek servisní schůzky jako zápis v CRM.",
    ],
    supportedIntents: ["create_service_case", "create_opportunity", "update_opportunity"],
  },

  // ─── PODKLADY / MATERIAL REQUEST ────────────────────────────────────────
  {
    id: "material_request",
    label: "Podklady od klienta",
    matches: (m, i) =>
      i.intentType === "create_material_request" ||
      i.intentType === "request_client_documents" ||
      i.intentType === "create_client_request" ||
      /podkl|dokument.*klient|klient.*dokument|výpis|potvrzení.*příjm|příjm.*potvrzení|výpis z katastru|podklad.*smlouva/i.test(m),
    defaultProductDomain: null,
    priorityMissingHints: [
      "typ požadovaného dokumentu nebo podkladu",
      "termín dodání od klienta",
      "účel (banka, pojišťovna, správní řízení)",
      "alternativy, pokud dokument není k dispozici",
    ],
    nextStepSuggestions: [
      "Informovat klienta o potřebných podkladech přes portál.",
      "Nastavit připomínku pro případ, že podklady nepřijdou včas.",
      "Po obdržení podklady klasifikovat a přiložit k příslušnému obchodu.",
    ],
    supportedIntents: ["create_material_request", "create_client_request", "request_client_documents"],
  },

  // ─── SCHŮZKA / ÚKOL / ZÁPIS ─────────────────────────────────────────────
  {
    id: "schuzka_ukol_zapis",
    label: "Schůzka / úkol / zápis / připomínka",
    matches: (m, i) =>
      i.intentType === "schedule_meeting" ||
      i.intentType === "create_task" ||
      i.intentType === "create_followup" ||
      i.intentType === "create_note" ||
      i.intentType === "create_internal_note" ||
      i.intentType === "create_reminder" ||
      /schůzk|schuzk|úkol|ukol|follow.?up|poznám|zápis|brief|připomínk|reminder/i.test(m),
    defaultProductDomain: null,
    priorityMissingHints: [
      "datum a čas",
      "účel nebo agenda",
      "účastníci (klient, kolegové)",
      "navazující akce nebo termín úkolu",
    ],
    nextStepSuggestions: [
      "Po schůzce doplnit zápis do CRM.",
      "Naplánovat navazující úkol s konkrétním termínem.",
      "Informovat klienta o výsledku nebo dalším postupu.",
    ],
    supportedIntents: [
      "schedule_meeting",
      "create_task",
      "create_followup",
      "create_note",
      "create_internal_note",
      "create_reminder",
    ],
  },
];
