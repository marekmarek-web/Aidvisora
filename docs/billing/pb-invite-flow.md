# Premium Brokers — invite flow

**Interní dokument. Není určen pro publikaci ani zákazníky.**

## Co to je

Způsob, jak distribuovat slevu (Stripe Coupon / Promotion Code `PREMIUM-BROKERS-2026`)
uzavřené kohortě Premium Brokers partnerů **bez** toho, abychom museli dávat
veřejný vstup do UI pro promo kódy. Marek pošle partnerovi odkaz, partner klikne,
sleva se mu automaticky uplatní při checkoutu — i kdyby se registroval třeba o pár
dnů později.

## Jak to funguje

1. **Link pro kohortu:**
   ```
   https://aidvisora.cz/invite/PREMIUM-BROKERS-2026
   ```

2. **Route `/invite/[code]`** (`apps/web/src/app/invite/[code]/route.ts`):
   - Normalizuje kód na UPPER-CASE.
   - Ověří proti whitelistu v `apps/web/src/lib/stripe/promo-codes-shared.ts`
     (konstanta `PREMIUM_BROKERS_PROMO_CODE`).
   - Neznámý kód → tiché přesměrování na `/` (bez cookie, bez odezvy).
     Záměrně nedáváme 404 / error hlášku — brute-force ochrana.
   - Validní kód → nastaví cookie `aidvisora_promo_code` na 14 dní
     (Secure v produkci, SameSite=Lax, **ne-HttpOnly** — chceme, aby UI badge
     uměl kód přečíst a ukázat „sleva je připravena"). Přesměruje na
     `/?promo_applied=PREMIUM-BROKERS-2026`.

3. **Registrace + trial** probíhají beze změn.

4. **Billing UI** (`WorkspaceStripeBilling`):
   - `useEffect` čte cookie `aidvisora_promo_code`.
   - Pokud je hodnota v klientském whitelistu (viz `isKnownPromoCode`), ukáže
     zelený badge „Promo kód aktivní" s lidsky čitelným popisem.
   - UI pouze informuje — skutečná validace + aplikace slevy se děje serverově.

5. **Checkout** (`/api/stripe/checkout`):
   - Přečte `body.promoCode`, pokud chybí, fallbackne na cookie
     `aidvisora_promo_code`.
   - Re-validuje přes whitelist + Stripe Promotion Code API.
   - Do `billing_audit_log` zapíše `PROMO_CODE_REJECTED` / `CHECKOUT_STARTED`
     s `metadata.source = "body" | "cookie"`.
   - **Kritický rozdíl:** neznámý / neplatný kód z `body` vrátí HTTP 400.
     Neznámý / neplatný z `cookie` fallbackuje **silent** — pokračujeme bez
     slevy (cookie mohla zůstat z kampaně, která už skončila; nechceme kvůli
     ní lámat platbu stávajícím zákazníkům).

6. **Stripe Checkout** dostane `discounts: [{ promotion_code: promo_xxx }]`
   a `allow_promotion_codes` se **nepředává** (Stripe neumí mít oboje;
   discounts mají přednost).

7. **Beta Terms gate (FL-1.6).** Pokud normalizovaný promo kód = `PREMIUM-BROKERS-2026`,
   checkout vyžaduje `body.betaTermsAck === true`. Bez toho server vrací
   HTTP 400 a do `billing_audit_log` píše `PROMO_CODE_REJECTED` s reason
   `beta_terms_not_acked`. Při úspěchu se do `subscription.metadata`
   zapisuje `beta_terms_acked: "1"` — tím máme v Stripe auditně zafixované,
   že pilotní účastník podmínky potvrdil.

   UI: `WorkspaceStripeBilling.tsx` čte cookie `aidvisora_promo_code` a pokud
   je to PB kód, zobrazí **druhý checkbox** s odkazem na `/beta-terms`.
   Text stránky: `apps/web/src/app/beta-terms/page.tsx`.

## Provozní zásady

- **Nepublikujte invite odkaz** nikde veřejně — jakmile Stripe Promotion Code
  doběhne (max redemptions / expires_at), invite odkaz začne tiše fallbackovat
  na plnou cenu, ale samotný Stripe coupon tam už nebude.
- **Zrušení kohorty:**
  1. V Stripe Dashboardu deaktivovat / smazat Promotion Code.
  2. V `promo-codes-shared.ts` odstranit hodnotu z `KNOWN_PROMO_CODES`
     (pokud nechceme ani auditlog nových pokusů).
  3. Cookie existující uživatelům vyexpirují do 14 dnů sama; proaktivní
     invalidaci jsme nezaváděli záměrně — uživatel zaznamená jen „badge zmizel",
     nic se nerozbije.
- **Přidání další kohorty** (např. `EARLY-ADOPTER-2026`):
  1. Založit Stripe Coupon + Promotion Code.
  2. Přidat ID do `KNOWN_PROMO_CODES` v `promo-codes-shared.ts`.
  3. Přidat human-label do `promoCodeDisplayLabel`.
  4. Pozvánkový link funguje okamžitě: `/invite/NOVY-KOD`.

## Audit & reporting

Všechny pokusy o uplatnění kódu (úspěšné i neúspěšné) jsou v `billing_audit_log`
s těmito actions:

- `PROMO_CODE_REJECTED` — reason `not_whitelisted` nebo `stripe_lookup_failed`
- `CHECKOUT_STARTED` — s `metadata.promoCode`, `couponId`, `promoCodeSource`

Ukázkový query pro report „kolik PB kohorty už prošlo checkoutem":

```sql
SELECT
  tenant_id,
  metadata ->> 'promoCodeSource' AS source,
  at
FROM billing_audit_log
WHERE action = 'checkout_started'
  AND metadata ->> 'promoCode' = 'PREMIUM-BROKERS-2026'
ORDER BY at DESC;
```

## Bezpečnostní rozvaha

- **Cookie ≠ auth.** Nikdo si přes cookie nemůže přibrat víc, než co Stripe
  Coupon definuje (Stripe je single source of truth).
- **Whitelist ≠ únik.** I kdyby někdo uhodl jiný kód, route `/invite/[code]`
  ho neuzná bez změny v `KNOWN_PROMO_CODES`.
- **Brute-force na Stripe API** je ošetřen tím, že se k Stripe obracíme jen
  pro kódy, které projdou whitelistem. Nejde vyčerpat rate limit neplatnými
  pokusy.
- **CSRF není relevantní**, protože route `GET /invite/[code]` sama nemění
  server-side state kromě cookie, která beztak nic neautorizuje (checkout
  ji znovu validuje).

## Související soubory

- `apps/web/src/lib/stripe/promo-codes-shared.ts`
- `apps/web/src/lib/stripe/promo-codes.ts`
- `apps/web/src/app/invite/[code]/route.ts`
- `apps/web/src/app/api/stripe/checkout/route.ts`
- `apps/web/src/app/components/billing/WorkspaceStripeBilling.tsx`
- `apps/web/src/lib/stripe/billing-audit.ts` (akce `PROMO_CODE_REJECTED`,
  `CHECKOUT_STARTED`)
