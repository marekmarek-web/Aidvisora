/**
 * Šablony pro hromadné e-mailové kampaně.
 *
 * Pozn. ke compliance (aidvisor-compliance):
 * Šablony jsou **koncepty**, které si poradce sám upraví před odesláním.
 * Žádná šablona nesmí prezentovat jmenovaný investiční/úvěrový/pojišťovací
 * produkt jako "doporučení" klientovi ani uvádět konkrétní výnosy, sazby
 * či tvrzení o vhodnosti. Vše je v tónu administrativní komunikace,
 * obecné informace a pozvánky na osobní konzultaci.
 */

export type CampaignTemplateId =
  | "blank"
  | "birthday"
  | "newsletter"
  | "consultation"
  | "premium_dark"
  | "minimal_clean";

export type CampaignTemplate = {
  id: CampaignTemplateId;
  /** Krátký název v galerii. */
  name: string;
  /** Typ vizuální identity – pro ikonu v galerii. */
  kind: "blank" | "birthday" | "newsletter" | "consultation";
  /** Název lucide ikony (mapujeme v UI). */
  iconName: "Mail" | "Gift" | "Newspaper" | "Calendar" | "Sparkles" | "Leaf";
  /** Barevná schémata v galerii (Tailwind class). */
  accentClass: string;
  /** Volitelný popisek / styl – zobrazí se v galerii pod názvem. */
  style: string;
  /** Předmět e-mailu (s podporou {{jmeno}}, {{cele_jmeno}}). */
  subject: string;
  /** HTML tělo e-mailu (s {{jmeno}}, {{cele_jmeno}}). */
  body: string;
};

/** Základní společný CSS reset pro e-mailový HTML kontejner. */
const EMAIL_CONTAINER_STYLE = [
  "font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif",
  "color: #0f172a",
  "max-width: 600px",
  "margin: 0 auto",
  "background: #ffffff",
  "line-height: 1.6",
].join(";");

const BLANK_BODY = `<div style="${EMAIL_CONTAINER_STYLE}; padding: 24px;">
  <p>Dobrý den, {{jmeno}},</p>
  <p>…</p>
  <p>S pozdravem,<br/>Martin Dvořák</p>
</div>`;

/**
 * Premium „Aidvisora" šablona – tmavý header, gradientový banner, čistý obsah, patička.
 * Použití: newsletter, upozornění, informační shrnutí.
 */
const NEWSLETTER_BODY = `<div style="${EMAIL_CONTAINER_STYLE};">
  <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; color: #ffffff; border-radius: 0 0 0 0;">
    <div style="display: inline-block; width: 44px; height: 44px; background: rgba(255,255,255,0.15); border-radius: 12px; text-align: center; line-height: 44px; font-weight: 900; font-size: 18px; margin-bottom: 16px;">MD</div>
    <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.01em;">Shrnutí za uplynulý měsíc</h1>
    <p style="margin: 0; color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 600;">Informativní souhrn pro vás jako mého klienta</p>
  </div>
  <div style="padding: 32px; background: #ffffff;">
    <p style="margin: 0 0 16px 0; font-size: 15px;">Dobrý den, {{jmeno}},</p>
    <p style="margin: 0 0 16px 0; font-size: 15px;">
      níže naleznete stručný informativní přehled posledního období. Text je obecný a slouží pouze jako podklad —
      konkrétní dopady na vaši smluvní dokumentaci probereme na naší příští schůzce.
    </p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #6366f1;">Co stojí za pozornost</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
        <li style="margin-bottom: 6px;">Obecný vývoj trhů a základních sazeb.</li>
        <li style="margin-bottom: 6px;">Administrativní novinky (termíny, povinnosti).</li>
        <li style="margin-bottom: 0;">Oblasti, na které bych se rád/a zeptal/a při příští schůzce.</li>
      </ul>
    </div>
    <p style="margin: 0 0 16px 0; font-size: 15px;">
      Pokud budete chtít cokoliv probrat nebo upravit, stačí odpovědět na tento e-mail.
    </p>
    <p style="margin: 0; font-size: 15px;">S pozdravem,<br/><strong>Martin Dvořák</strong></p>
  </div>
  <div style="padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
    <p style="margin: 0 0 6px 0;"><strong style="color: #334155;">Bc. Martin Dvořák</strong> — Finanční poradce</p>
    <p style="margin: 0;">Pokud si nepřejete dostávat tyto e-maily, můžete se <a href="{{unsubscribe_url}}" style="color: #4f46e5;">odhlásit zde</a>.</p>
  </div>
</div>`;

/** Narozeninové přání – teplejší tóny, gradient. */
const BIRTHDAY_BODY = `<div style="${EMAIL_CONTAINER_STYLE};">
  <div style="background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%); padding: 40px 32px; color: #ffffff; text-align: center;">
    <div style="font-size: 42px; margin-bottom: 8px;">&#127874;</div>
    <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 6px 0; letter-spacing: -0.01em;">Vše nejlepší, {{jmeno}}!</h1>
    <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">Dnešek patří vám</p>
  </div>
  <div style="padding: 32px; background: #ffffff;">
    <p style="margin: 0 0 16px 0; font-size: 15px;">Krásný den, {{jmeno}},</p>
    <p style="margin: 0 0 16px 0; font-size: 15px;">
      dovolte mi popřát vám všechno nejlepší k vašim dnešním narozeninám.
      Hlavně hodně zdraví, spokojenosti a ať se vám daří v osobním i profesním životě.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px;">Užijte si svůj den!</p>
    <p style="margin: 0; font-size: 15px;">S pozdravem,<br/><strong>Martin Dvořák</strong></p>
  </div>
  <div style="padding: 20px 32px; background: #fdf2f8; border-top: 1px solid #fbcfe8; font-size: 11px; color: #9f1239;">
    <p style="margin: 0;">Pokud si nepřejete dostávat tyto e-maily, můžete se <a href="{{unsubscribe_url}}" style="color: #be185d;">odhlásit zde</a>.</p>
  </div>
</div>`;

/**
 * Pozvánka na osobní konzultaci.
 * Záměrně bez konkrétního produktu, bez výnosů, bez tvrzení o vhodnosti.
 */
const CONSULTATION_BODY = `<div style="${EMAIL_CONTAINER_STYLE};">
  <div style="padding: 40px 32px 24px 32px; background: #ffffff; border-bottom: 4px solid #4f46e5;">
    <div style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; text-align: center; line-height: 40px; color: #ffffff; font-weight: 900; font-size: 16px; margin-bottom: 16px;">MD</div>
    <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 6px 0; color: #0f172a; letter-spacing: -0.01em;">Čas na krátkou kontrolu vašich financí?</h1>
    <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 600;">Pozvánka na osobní konzultaci</p>
  </div>
  <div style="padding: 28px 32px 32px 32px; background: #ffffff;">
    <p style="margin: 0 0 16px 0; font-size: 15px;">Dobrý den, {{jmeno}},</p>
    <p style="margin: 0 0 16px 0; font-size: 15px;">
      rád/a bych si s vámi domluvil/a krátkou schůzku, kde si společně projdeme
      aktuální stav vaší smluvní dokumentace, případné změny a oblasti, které
      byste sám/sama chtěl/a probrat.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px;">
      Schůzka je nezávazná a trvá přibližně 30 minut. Můžeme se potkat osobně
      nebo online — podle toho, co vám bude více vyhovovat.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="#" style="display: inline-block; background: #1a1c2e; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 0.02em;">Vybrat termín schůzky &rarr;</a>
    </div>
    <p style="margin: 24px 0 16px 0; font-size: 15px;">Pokud vám termín nevyhovuje, stačí odpovědět na tento e-mail a domluvíme se jindy.</p>
    <p style="margin: 0; font-size: 15px;">S pozdravem,<br/><strong>Martin Dvořák</strong></p>
  </div>
  <div style="padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
    <p style="margin: 0 0 6px 0;"><strong style="color: #334155;">Bc. Martin Dvořák</strong> — Finanční poradce</p>
    <p style="margin: 0;">Pokud si nepřejete dostávat tyto e-maily, můžete se <a href="{{unsubscribe_url}}" style="color: #4f46e5;">odhlásit zde</a>.</p>
  </div>
</div>`;

/** „Premium Dark" – variantní newsletter v tmavém provedení. */
const PREMIUM_DARK_BODY = `<div style="${EMAIL_CONTAINER_STYLE};">
  <div style="background: #0b1020; padding: 44px 32px; color: #ffffff; text-align: left;">
    <div style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(135deg, #60a5fa, #a78bfa); border-radius: 12px; text-align: center; line-height: 44px; font-weight: 900; font-size: 18px; margin-bottom: 20px;">A</div>
    <h1 style="font-size: 26px; font-weight: 900; margin: 0 0 8px 0; letter-spacing: -0.01em;">Informativní souhrn</h1>
    <p style="margin: 0; color: #94a3b8; font-size: 14px; font-weight: 600;">Čtvrtletní přehled pro mé klienty</p>
  </div>
  <div style="padding: 36px 32px; background: #ffffff;">
    <p style="margin: 0 0 16px 0; font-size: 15px;">Dobrý den, {{jmeno}},</p>
    <p style="margin: 0 0 16px 0; font-size: 15px;">
      v krátkosti shrnuji obecné informace za uplynulé období. Tento e-mail je informativní
      a nenahrazuje osobní konzultaci.
    </p>
    <div style="border-left: 3px solid #6366f1; padding: 4px 0 4px 16px; margin: 24px 0;">
      <p style="margin: 0; font-size: 14px; font-style: italic; color: #475569;">„Dobré rozhodnutí není to, které přinese zázračný výnos, ale to, které vám dovolí v klidu spát."</p>
    </div>
    <p style="margin: 0; font-size: 15px;">S pozdravem,<br/><strong>Martin Dvořák</strong></p>
  </div>
  <div style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
    <p style="margin: 0;">Odhlášení z odběru — <a href="{{unsubscribe_url}}" style="color: #4f46e5;">odhlásit</a>.</p>
  </div>
</div>`;

/** „Minimal Clean" – čistá šablona bez dekorací, hodí se pro rychlé oznámení. */
const MINIMAL_CLEAN_BODY = `<div style="${EMAIL_CONTAINER_STYLE}; padding: 32px 24px;">
  <p style="margin: 0 0 16px 0; font-size: 15px;">Dobrý den, {{jmeno}},</p>
  <p style="margin: 0 0 16px 0; font-size: 15px;">
    krátká zpráva — níže naleznete informaci, kterou jsem vám slíbil/a zaslat.
  </p>
  <p style="margin: 0 0 16px 0; font-size: 15px;">
    V případě dotazů odpovězte prosím přímo na tento e-mail.
  </p>
  <p style="margin: 0 0 24px 0; font-size: 15px;">S pozdravem,<br/><strong>Martin Dvořák</strong></p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"/>
  <p style="margin: 0; font-size: 11px; color: #64748b;">Pokud si nepřejete dostávat tyto e-maily, můžete se <a href="{{unsubscribe_url}}" style="color: #4f46e5;">odhlásit zde</a>.</p>
</div>`;

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "blank",
    name: "Prázdný e-mail",
    kind: "blank",
    iconName: "Mail",
    accentClass: "text-slate-500 bg-slate-100",
    style: "Od nuly",
    subject: "",
    body: BLANK_BODY,
  },
  {
    id: "birthday",
    name: "Přání k narozeninám",
    kind: "birthday",
    iconName: "Gift",
    accentClass: "text-rose-500 bg-rose-100",
    style: "Osobní přání",
    subject: "Všechno nejlepší k narozeninám, {{jmeno}}!",
    body: BIRTHDAY_BODY,
  },
  {
    id: "newsletter",
    name: "Měsíční souhrn",
    kind: "newsletter",
    iconName: "Newspaper",
    accentClass: "text-blue-500 bg-blue-100",
    style: "Aidvisora — gradient",
    subject: "Informativní souhrn za uplynulý měsíc",
    body: NEWSLETTER_BODY,
  },
  {
    id: "consultation",
    name: "Pozvánka na konzultaci",
    kind: "consultation",
    iconName: "Calendar",
    accentClass: "text-emerald-500 bg-emerald-100",
    style: "Termín schůzky",
    subject: "Čas na krátkou kontrolu vašich financí?",
    body: CONSULTATION_BODY,
  },
  {
    id: "premium_dark",
    name: "Premium Dark",
    kind: "newsletter",
    iconName: "Sparkles",
    accentClass: "text-indigo-500 bg-indigo-100",
    style: "Tmavé provedení",
    subject: "Čtvrtletní informativní souhrn",
    body: PREMIUM_DARK_BODY,
  },
  {
    id: "minimal_clean",
    name: "Minimal Clean",
    kind: "blank",
    iconName: "Leaf",
    accentClass: "text-teal-500 bg-teal-100",
    style: "Čistá verze",
    subject: "Krátká zpráva",
    body: MINIMAL_CLEAN_BODY,
  },
];

export function findTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}
