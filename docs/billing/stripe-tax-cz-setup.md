# Stripe Tax CZ — konfigurace a rollout

**Verze:** v1 · platnost od 2026-04-21 · maintainer: Marek
**Interní dokument.**

## 1. Co jsme nasadili v repo (FL-2.1)

V `/api/stripe/checkout` má `Checkout.Session.create` tyto nové parametry:

```ts
automatic_tax: { enabled: true },
tax_id_collection: { enabled: true },
billing_address_collection: "required",
customer_update: { address: "auto", name: "auto", shipping: "auto" }, // jen při existujícím customeru
```

Efekt:
- Stripe hosted checkout vynutí **fakturační adresu** (řádek, město, PSČ, země).
- Stripe hosted checkout umožní **DIČ / IČO** (pole „Tax ID“).
- **DPH** se dopočítá automaticky podle ČR sazeb / reverse charge pro EU B2B
  — bez naší logiky.
- Hotová faktura obsahuje všechny povinné náležitosti (firma, adresa, IČO, DIČ,
  sazba DPH, základ, daň).
- Billing adresa + Tax ID se uloží na **Customer** objekt, takže se použijí
  i pro následující faktury (renewal, upgrade atd.).

V `WorkspaceStripeBilling.tsx` jsme doplnili krátkou informační nóta pro
uživatele, že IČO/DIČ/adresu zadá v dalším kroku.

## 2. MANUAL STEP — Stripe Dashboard

**Toto repo sama nenakonfiguruje.** Bez níže uvedených kroků checkout
vyhodí error („Stripe Tax není aktivní“ / „Business registrace chybí“).

### 2.1 Aktivace Stripe Tax

1. Stripe Dashboard → **Tax** → **Get started**.
2. Business details: právní forma `s.r.o.`, sídlo `Česká republika`,
   business address (stejná jako v ARES).
3. **Add registration** → `Czech Republic` → **status VAT registered**,
   VAT number = DIČ firmy (`CZxxxxxxxx`), **effective date** = datum registrace
   k DPH.
4. Pokud je třeba účtovat i EU zákazníkům:
   - **Add registration** pro další státy EU, kde překročíme prahy OSS
     (Union OSS). Pro launch stačí CZ, ostatní se doplní, až se to bude týkat.

### 2.2 Tax Rate fallback (pro produkty nekryté Tax registrací)

- Product Catalog → každá Price má stále `tax_behavior = "exclusive"`.
  Pokud je `inclusive`, Stripe Tax to přijme, ale faktury budou zobrazovat
  DPH jinak, než očekává účetní. **Doporučení:** exclusive pro všechny
  produkty Aidvisory.

### 2.3 Ověření

Po aktivaci:
- Dashboard → **Tax** → **Registrations** musí ukázat CZ „Active“.
- Dashboard → **Tax** → **Monitoring** → „Not yet registered“ countries musí
  být prázdné pro CZ.
- Test checkout (`STRIPE_SECRET_KEY` = test mode) s adresou v CZ:
  - Musí se zobrazit řádek „DPH 21 %“.
  - Zadat test DIČ (Stripe akceptuje libovolný formát v test mode) → DPH se
    přepočítá (reverse charge pro EU B2B mimo CZ, 21 % pro CZ plátce DPH).

### 2.4 Invoices — branding

- Dashboard → **Settings** → **Branding** → nahrát logo Aidvisora, accent
  color `#4F46E5`.
- Dashboard → **Settings** → **Billing** → **Invoice template** →
  - Memo: `„Děkujeme za využívání Aidvisory — SaaS pro pojišťovací poradenství.“`
  - Footer: kontakt `support@aidvisora.cz` + odkaz na /vop.
  - **Custom fields**: přidat `tenant_id` (auto-populate z metadata), pomáhá
    při párování faktur k workspace.

## 3. Jak se to projeví v aplikaci

- **Před checkoutem** (`WorkspaceStripeBilling.tsx`) — info řádek:
  „Fakturační údaje (firma, adresa, IČO/DIČ) zadáte v následujícím kroku…“.
- **V checkoutu (Stripe hosted)** — uživatel vyplní:
  - Jméno / firmu
  - Fakturační adresu
  - Tax ID (volitelné; pokud nevyplní, použije se 21 % CZ).
- **Po checkoutu** (Stripe webhook → náš handler) — do `tenants` se zapíše
  aktualizovaný `stripeCustomerId`. Billing údaje zůstávají **autoritativně
  u Stripe** (nesynchronizujeme je do našeho DB modelu; uživatel je upravuje
  přes Customer Portal).

## 4. Regresní test po nasazení do prod

Checklist pro první reálnou platbu (PB pilot člen):

- [ ] Stripe Tax Registrations → CZ Active.
- [ ] Test checkout z produkce (realný partner, test coupon):
  - [ ] Uživatel vidí řádek „DPH 21 %“ před potvrzením.
  - [ ] Po zaplacení Stripe vygeneruje PDF fakturu → obsahuje všechny
    povinné ČR náležitosti (IČO, DIČ, sazba DPH, základ, daň, číslo faktury).
  - [ ] Faktura dorazí na e-mail uživatele.
- [ ] `billing_audit_log` obsahuje `CHECKOUT_STARTED` s `metadata.promoCode`
  + `subscription.metadata.beta_terms_acked = "1"` (pro PB).

## 5. Rollback

Pokud se během launch ukáže, že Stripe Tax CZ není správně aktivovaný
a padá checkout, dočasné workaround:

1. V `apps/web/src/app/api/stripe/checkout/route.ts` zakomentovat
   `automatic_tax: { enabled: true }` a `tax_id_collection: { enabled: true }`.
2. DPH se pak počítá z pevné Stripe Tax Rate ID (nutno nastavit env
   `STRIPE_TAX_RATE_CZ_21` a předat `default_tax_rates: [env]` do
   `subscription_data`). **Pozor:** faktury pak nebudou obsahovat rozpis pro
   EU reverse charge — je to opravdu jen dočasné.

## 6. Související soubory

- `apps/web/src/app/api/stripe/checkout/route.ts`
- `apps/web/src/app/components/billing/WorkspaceStripeBilling.tsx`
- `docs/billing/pb-invite-flow.md`
- `docs/OPS_RUNBOOK.md` §Stripe billing (pokud existuje)
