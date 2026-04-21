# App Store Review Notes — Aidvisora v1.0

> **Účel:** hotové copy-paste texty + seznam demo účtů pro Apple App Review.
> Držíme je v repu, aby se neztrácelo, co přesně jsme do App Store Connectu
> poslali u které verze.

---

## 1. Demo účty (před submitem)

**Povinné:** dva reálně fungující účty v produkci (`www.aidvisora.cz`),
předvyplněné fiktivními daty. Apple reviewer je použije skrz native WebView.

### 1.1. Advisor (poradce)

| Pole | Hodnota |
|---|---|
| Email | `reviewer-advisor@aidvisora.cz` |
| Heslo | *(silné heslo, uložit v 1Password trezoru „Aidvisora / App Store Review")* |
| Role | Advisor (ne Admin — reviewer nemá vidět admin nástroje) |
| MFA | **Vypnuté** pro tento účet (přes `MFA_ENFORCE_ADVISORS` override nebo dedicated tenant s vypnutým enforcement) |

**Data, která účet musí mít před submitem:**

- [ ] Min. 3 fiktivní kontakty (Jan Testovací, Eva Reviewerová, Karel Apple).
- [ ] U jednoho kontaktu alespoň 1 smlouva (např. IŽP) a 1 dokument.
- [ ] 1 ukázková AI Review (ideálně status „approved" — dokumentuje výstup AI).
- [ ] 1 kalendářní událost v nadcházejících 7 dnech.
- [ ] 1 otevřený požadavek od klienta (pro demonstraci messaging flow).

### 1.2. Klient

| Pole | Hodnota |
|---|---|
| Email | `reviewer-client@aidvisora.cz` |
| Heslo | *(viz 1Password)* |
| Tenant | Propojený na advisora výše. |

**Data, která účet musí mít:**

- [ ] 2–3 smlouvy / produkty v klientském portálu (pojistky, investice).
- [ ] 1 pending request u poradce.
- [ ] Alespoň jedna stažitelná faktura nebo dokument.

---

## 2. Review Notes — text k vložení do ASC

> Vlož **beze změn** do pole **App Review Information → Notes** v App Store
> Connect. Apple reviewer čte česky a anglicky; text je proto v obou jazycích
> zkráceně.

```
Aidvisora je B2B CRM pro finanční poradce v České republice. Aplikace slouží
poradcům (role Advisor) a jejich klientům (role Client) k centralizované
správě smluv, dokumentů a komunikace.

PŘIHLÁŠENÍ (TESTOVACÍ ÚČTY):
• Advisor: reviewer-advisor@aidvisora.cz / <viz Demo Account>
• Klient:  reviewer-client@aidvisora.cz  / <viz Demo Account>
Doporučujeme otestovat obě role.

PLATBY:
Předplatné se zakládá výhradně na webu (Stripe Checkout, www.aidvisora.cz).
Aplikace sama žádné IAP neobsahuje — je to reader-style app pro práci s
obsahem, který poradce spravuje přes web. Předplatné je B2B nástroj, ne
digitální obsah pro koncového uživatele, takže nespadá pod pravidlo 3.1.1.

OCHRANA DAT:
Aplikace pracuje s osobními údaji klientů finančního poradce (jméno, e-mail,
kontaktní údaje, interní poznámky, smluvní dokumenty). Data jsou uložena na
serverech EU (Supabase, Frankfurt), citlivé PII (rodné číslo, číslo občanky)
je navíc aplikačně šifrované (AES-256-GCM). Privacy Labels v této submit
odrážejí reálný stav.

FUNKCE K OTESTOVÁNÍ:
1. Přihlášení obou rolí (Apple Sign-In + e-mail/heslo).
2. Vytvoření nového kontaktu, připnutí dokumentu.
3. AI Review smlouvy — v Advisor účtu je už jedna připravená ("approved"), lze
   projít výstup extrakce.
4. Messaging mezi poradcem a klientem (účty jsou propojené).
5. Kalendářní událost + notifikace (push je povolený, vyžaduje potvrzení).

KONTAKT:
Technické dotazy / urgentní problém s review účtem:
support@aidvisora.cz (odpovídáme do 24 h i o víkendu).

---

EN (short):

Aidvisora is a B2B CRM for financial advisors in the Czech Republic. Uses
reader-style model — subscription is managed on the web (Stripe), the app
itself contains no IAP. Test credentials above; both advisor and client
accounts are prepopulated with demo data. Data is stored in EU (Supabase
Frankfurt), sensitive PII is application-encrypted. Reach us at
support@aidvisora.cz if demo accounts break.
```

---

## 3. Běžné důvody rejectu + připravená odpověď

Drž si zde historii — pokud tě Apple reviewer shodí, zapiš to sem i s
odpovědí a datem, ať to příště neřešíš od nuly.

| Datum | Verze | Guideline | Důvod rejectu | Naše odpověď |
|---|---|---|---|---|
| *(zatím nic)* | | | | |

---

## 4. Před každým submitem ověř

- [ ] Hesla demo účtů jsou **aktuální** (nebyla resetnutá, nevypršela).
- [ ] Produkční backend běží (viz `/api/health`).
- [ ] Demo advisor má naplněná data (viz §1.1) — pokud poslední review smazal
  testovací data, dodej je zpátky.
- [ ] Apple Sign-In funguje (projdi reálný login, ne mock) — reviewer ho
  skoro jistě otestuje.
- [ ] iOS appka se v TestFlight buildu normálně přihlásí, i když uživatel má
  vypnuté push notifikace.
