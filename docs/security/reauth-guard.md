# Re-auth guard pro citlivé akce

> P1 launch-soon — minimum viable ochrana pro high-risk operace
> (permanent delete, GDPR export, odebrání člena týmu, změna role).

## Co to řeší

Threat model: ukradený notebook s otevřenou Aidvisora session / sdílené
zařízení. Útočník má session cookie, ale NE heslo / MFA token. Bez re-auth
guardu by smazal klienta za 2 kliky.

Standardní přístup (Apple, Google, GitHub) je **„step-up authentication"**:
když uživatel chce provést citlivou akci, vyžádáme čerstvé ověření i přes to,
že je přihlášený. Aidvisora v v1 implementuje lite variantu — **freshness
check** (jak staré je poslední přihlášení), ne plný AAL1→AAL2 step-up přes
Supabase MFA challenge.

## API

Zdroj: `apps/web/src/lib/auth/require-recent-auth.ts`.

### `requireRecentAuth({ maxAgeSeconds?, action? })`

Throw-on-fail varianta. Použij v server actions, které mají být re-auth
chráněné:

```typescript
import { requireRecentAuth } from "@/lib/auth/require-recent-auth";

export async function permanentlyDeleteContacts(ids: string[]) {
  const auth = await requireAuthInAction();
  if (!hasPermission(auth.roleName, "contacts:delete")) throw new Error("Forbidden");
  // Vyhodí ReauthRequiredError, pokud session je starší než 15 minut.
  await requireRecentAuth({ action: "contact.permanent_delete", maxAgeSeconds: 900 });
  // … zbytek logiky …
}
```

### `checkRecentAuth(...)`

Fail-open varianta — vrátí `{ ok: boolean, reason }`, vyhazovat může caller.
Použij, pokud chceš graceful degradation (banner „přihlas se znovu" místo
blokace).

### `ReauthRequiredError`

- `code = "REAUTH_REQUIRED"` — stabilní machine-readable klíč.
- `lastSignInAt: Date | null` — UX hint pro frontend.
- `maxAgeSeconds: number` — kolik sekund je limit.
- `isReauthRequiredError(e)` — typeguard.

## Doporučené `maxAgeSeconds` pro akce

| Akce | maxAgeSeconds | Poznámka |
|---|---|---|
| Permanent delete kontaktu / dokumentu | **900** (15 min) | Už implementováno. |
| GDPR export request (full tenant export) | 900 | Doporučeno. |
| Odebrání člena týmu (remove membership) | 1800 (30 min) | Nižší riziko, reverzibilní. |
| Změna role (promote to Admin) | **900** | Privilege escalation — přísně. |
| Rotace API key / webhook secret | 600 | Administrativní + silně citlivá. |
| Soft archive (reverzibilní) | — | Guard **nepoužívej** — nežádoucí friction. |

## Frontend contract

Server action, která volá `requireRecentAuth`, vyhodí `ReauthRequiredError`.
Klient ho musí umět rozpoznat a otevřít re-auth modal:

```tsx
import { isReauthRequiredError } from "@/lib/auth/require-recent-auth";

try {
  await permanentlyDeleteContacts([id]);
} catch (e) {
  if (isReauthRequiredError(e)) {
    // TODO: otevřít re-auth modal / redirect na /login?reauth=1&return=<path>
    openReauthModal({ action: "contact.permanent_delete" });
    return;
  }
  toast.error(e.message);
}
```

**Stav v repu (v1.0):**

- Helper + první call site (`permanentlyDeleteContacts`) jsou v repu.
- Frontend modal / redirect UX je **ještě nenapojený** — dnes klient dostane
  jen error toast s českou hláškou z `ReauthRequiredError.message`. Pro v1.1
  (po pilotu) dodat plnohodnotný modal s password re-prompt (stejný UX jako
  GitHub / Apple ID confirmations).

## Bezpečnostní poznámky

1. **Nenahrazuje MFA.** Pokud MFA enforcement běží (`MFA_ENFORCE_ADVISORS=1`),
   `last_sign_in_at` už odráží MFA-verified sign-in. Pokud MFA není povinné,
   guard chrání jen proti úplnému session theft — ne proti keyloggeru.
2. **Impersonation bypass.** Až se implementuje admin impersonation (P1),
   impersonated session **musí** projít re-auth guardem jako normální
   uživatel, ne jako admin — jinak by admin mohl přes impersonation obejít
   fresh-auth požadavek u klienta.
3. **Clock skew.** Používáme `Date.now()` na serveru proti
   `session.user.last_sign_in_at` ze Supabase. Oba běží v UTC na Vercel/Supabase
   infrastruktuře — není skew > 1 s. Guarda to nerozhodí.
4. **Audit.** Úspěšné projití guardu nelogujeme (šum). `ReauthRequiredError`
   se nelogguje do `audit_log`, ale pokud dojde k neautorizovanému pokusu
   (`forbidden`), callsite to tam už pálí. Pokud chceme mít stopu i po
   re-auth fail, můžeme v budoucnu přidat `logAuditAction` s action
   `security.reauth_required` do callsitu.
