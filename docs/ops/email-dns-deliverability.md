# Email deliverability — DNS (SPF, DKIM, DMARC) + Supabase SMTP

> **Delta A1 + A18.** HARD BLOCKER pro soft launch. Bez těchto záznamů:
>
> 1. Resend začne odmítat odesílání s `verified domain but DMARC not aligned`.
> 2. Gmail (March 2024 policy) a Outlook klasifikují všechny naše maily jako SPAM → klient nedostane invite / password reset / fakturu.
> 3. Supabase default auth mailer posílá z `noreply@mail.app.supabase.io` — klienti vidí cizí doménu v password reset / confirmation mailech → ztráta důvěry.

## Kroky (v pořadí)

### 1. Resend — verifikace `aidvisora.cz`

1. [resend.com/domains](https://resend.com/domains) → **Add Domain** → `aidvisora.cz` (**ne** subdoména — apex doména).
2. Resend vypíše 3 DNS záznamy:
   - `MX`: `send.aidvisora.cz` → `feedback-smtp.eu-west-1.amazonses.com` (priority 10)
   - `TXT`: `send.aidvisora.cz` → `v=spf1 include:amazonses.com ~all`
   - `TXT`: `resend._domainkey.aidvisora.cz` → `p=MIGfMA0G…` (DKIM veřejný klíč)
3. Přidat do Cloudflare (nebo Forpsi, cokoli spravujete). **TTL 300 s** pro rychlou validaci.
4. V Resend dashboard kliknout **Verify DNS Records**. Po 5–30 min musí svítit zelené ✅ u všech tří.

### 2. Apex SPF — sjednotit s Google Workspace / dalšími poskytovateli

Pokud používáte Google Workspace pro inbox, potřebujete **jeden SPF záznam** pro apex:

```
aidvisora.cz.  TXT  "v=spf1 include:_spf.google.com include:amazonses.com ~all"
```

- **Zákaz:** dva různé SPF TXT záznamy na apex — to invaliduje oba a maily všichni shodí.
- Pokud přidáváte Resend přes `send.aidvisora.cz` subdoménu (default doporučení), apex SPF se nemusí měnit — SPF validátor používá Envelope From doménu (`send.aidvisora.cz`).
- Pokud chcete posílat z `noreply@aidvisora.cz` (apex), **Resend doporučí nastavit SPF na apex taky**.

### 3. DMARC — začít monitoring, pak quarantine

1. Start: **p=none** (jen reporty, nic se neodmítá):
   ```
   _dmarc.aidvisora.cz.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@aidvisora.cz; adkim=s; aspf=s"
   ```
2. Zařídit, aby `dmarc@aidvisora.cz` chodil do smyslu (Google Group nebo forward na support@). **Bez toho jsou reporty k ničemu.**
3. Po 7–14 dnech kontrolovat reporty (uvidíte, kdo posílá vaším jménem — legitimní: Resend, Google Workspace; ilegitimní: spoof attempt).
4. Přepnout na **quarantine** (vypadne spam):
   ```
   _dmarc.aidvisora.cz.  TXT  "v=DMARC1; p=quarantine; pct=50; rua=mailto:dmarc@aidvisora.cz; adkim=s; aspf=s"
   ```
5. Po dalších 14 dnech → **p=reject**.

### 4. BIMI (optional, enterprise look)

Po `p=quarantine` nebo `p=reject` můžete přidat BIMI = logo v Gmail/Apple Mail u vašich zpráv. Vyžaduje **VMC** (Verified Mark Certificate, cca 1500 USD/rok u DigiCert). **Pro Aidvisora zatím skip.**

### 5. Supabase Auth — přepnout z default SMTP na Resend

**Toto je hlavní hidden blind spot A18.** Default Supabase mailer:
- posílá z `noreply@mail.app.supabase.io`
- má **rate limit 4 emaily / hodinu** per projekt (viz [Supabase docs](https://supabase.com/docs/guides/auth/auth-smtp))
- nejde o něj prodávat: reset hesla / email confirmation dopadají do spamu

Setup:

1. Resend → API Keys → **Create API key** s `Sending access: Full access` — pojmenovat `supabase-smtp` → zkopírovat `re_…`.
2. Supabase Dashboard → projekt → **Authentication** → **Emails** → **SMTP Settings**:
   - Enable Custom SMTP: **ON**
   - Sender email: `noreply@aidvisora.cz`
   - Sender name: `Aidvisora`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<API key z kroku 1>`
   - Min interval between emails: 1 s (Resend limit)
3. **Save** → v Supabase Auth → **Send test email** → ověřit doručení a `From: noreply@aidvisora.cz`.
4. Supabase → Email Templates → přepsat CZ verze pro **Confirm signup**, **Magic link**, **Reset password**, **Change email**, **Invite user**. Default EN templates = cizí.

### 6. Reply-To vs From

- `From: Aidvisora <noreply@aidvisora.cz>` — deliverability vyžaduje noreply@
- `Reply-To: podpora@aidvisora.cz` — aby klient odpověděl na support inbox (viz env `RESEND_REPLY_TO`)

### 7. Ověření

- [mail-tester.com](https://www.mail-tester.com) — poslat z Resend dashboardu a na apex `noreply@`. Cíl: **10/10**.
- [dmarcian.com/dmarc-inspector](https://dmarcian.com/dmarc-inspector/) — ověřit syntax.
- Gmail → pravý klik → **Show original** → ověřit `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

## Kadence

- 2× ročně: zkontrolovat, jestli SPF není `permerror` (příliš mnoho lookupů — max 10).
- Rotace DKIM klíčů: Resend dělá automaticky, nic ručně.
- DMARC reporty chodit do `dmarc@aidvisora.cz` → 1× týdně zkontrolovat.

## Rollback

Pokud po nasazení DMARC `p=quarantine` klient hlásí, že mu nechodí maily:
1. Rychle přepnout zpět na `p=none`.
2. Zkontrolovat DMARC report — kdo falešně selhal.
3. Typicky problém = Google Workspace / calendar invites posílané z `@aidvisora.cz` adresy bez DKIM. Přidat Google DKIM (`google._domainkey`).

## Cross-reference

- In-repo email abstrakce: [apps/web/src/lib/email/send-email.ts](../../apps/web/src/lib/email/send-email.ts)
- Resend webhook: [apps/web/src/app/api/resend/webhook/route.ts](../../apps/web/src/app/api/resend/webhook/route.ts)
- Outbound mail audit: [docs/ops/outbound-mail-audit.md](./outbound-mail-audit.md)
