# E-mailové kampaně — stav MVP

Krátký audit funkce `portal/email-campaigns` z pohledu připravenosti k produkčnímu použití. Slouží jako reference při dalším rozvoji (po UX QA passu).

## Co funguje

- **Tvorba a ukládání kampaní** (`email_campaigns` tabulka v Supabase) včetně konceptu (draft) a odeslaných (sent).
- **Segmentace kontaktů** s počty (`getSegmentCounts`) — klienti, potenciální, bez kategorie.
- **Merge fields** `{{jmeno}}`, `{{cele_jmeno}}`, `{{unsubscribe_url}}` přes `previewReplace` (klient) a reálná substituce při odesílání (server).
- **Rozesílka přes Resend API** (serverová action) s respektováním odhlášení (`unsubscribed_at` / globální opt-out).
- **Testovací odeslání** na vlastní e-mail před spuštěním.
- **Limit dávky** 80 příjemců na jedno spuštění (soft cap, chrání před náhodným masovým sendem a Resend rate-limits).
- **WYSIWYG editor** s přepínáním vizuální / zdroj HTML (po UX QA passu).
- **Dynamické jméno odesílatele** (`fromName` z auth user metadata, fallback na e-mail).

## Co nefunguje / chybí

| Oblast | Stav | Poznámka |
| --- | --- | --- |
| Sledování **otevření** (open pixel) | ❌ | V UI zobrazeno „Metriky nejsou sledovány“. |
| Sledování **prokliků** (link wrapping) | ❌ | Resend nabízí via webhooky — zatím nenapojeno. |
| **Bounce / complaint handling** | ❌ | Žádný webhook listener, stav doručení se neaktualizuje. |
| **Queue / worker** pro velké segmenty | ❌ | Odesílání běží inline v server action → limit 80/spuštění. |
| **Scheduling** (naplánované odeslání) | ❌ | Pouze okamžité odeslání. |
| **A/B testování** předmětu | ❌ | — |
| **Custom from (brand domain)** | ⚠️ | Hardcoded doména v Resendu, jméno dnes z auth metadata. |
| **Šablony per tenant** | ⚠️ | Pouze globální `EMPTY_TEMPLATE` + statická galerie; per-workspace šablony v plánu. |
| **Uložení draftu na server** | ⚠️ | Draft žije v `email_campaigns` při „Uložit koncept“, ale není live autosave. |

## Technické zadluženější body

- `EmailCampaignsClient.tsx` je monolit (~1 100 řádků) — v příštím passu rozdělit na `Editor`, `Preview`, `History`, `TemplateGallery`.
- `contenteditable` vizuální editor je lightweight (`document.execCommand`) — deprecated API, pro plnohodnotný WYSIWYG by bylo dobré přejít na **TipTap** nebo **Lexical**.
- Hardcoded galerie šablon (`TEMPLATES`) by měla žít v DB (`email_templates` per tenant / globální katalog).
- `sendCampaign` action posílá sekvenčně — při 80 příjemcích OK, vyšší sendy vyžadují batch + retry logic.

## Doporučený next step (mimo tento UX pass)

1. Webhook listener pro Resend (bounce, delivered, complaint) → `email_campaign_events` tabulka.
2. Open/click tracking (pixel + wrapped URL) + agregovaný dashboard v detailu kampaně.
3. Queue (Trigger.dev nebo Supabase Cron + worker) pro segmenty > 80 adres.
4. Per-workspace šablony a WYSIWYG (TipTap) s media knihovnou.
5. Plán odeslání (cron) + status „scheduled“.

## Ověření

- Manuální test: vytvořit kampaň, přepnout mezi vizuálním a HTML režimem, vložit proměnnou, odeslat testovací e-mail, zkontrolovat preview (správné „Od:“ jméno).
- Smoke test v staging prostředí na malou segmentaci (< 10 kontaktů).
