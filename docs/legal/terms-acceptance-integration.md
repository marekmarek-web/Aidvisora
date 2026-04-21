# Legal terms acceptance — integration checklist

> Delta A10. `user_terms_acceptance` tabulka + helper `recordTermsAcceptance` jsou připravené, ale `recordTermsAcceptance` je dnes hooknutý jen u **Stripe checkout completed**. Níže je přesná mapa, kam se to musí zapojit pro plnou právní důkaznost.

## Tabulka

- Schema: [packages/db/src/schema/user-terms-acceptance.ts](../../packages/db/src/schema/user-terms-acceptance.ts)
- Migrace: [packages/db/migrations/user-terms-acceptance-2026-04-21.sql](../../packages/db/migrations/user-terms-acceptance-2026-04-21.sql)
- Helper: [apps/web/src/lib/legal/terms-acceptance.ts](../../apps/web/src/lib/legal/terms-acceptance.ts)

## Append-only

- DB trigger odmítne `UPDATE` i `DELETE`. Pokud by se musel záznam opravit (typo v IP), jediný legální krok = vložit nový řádek a v `notes` (not yet existuje; přidat pokud potřeba) referencovat "supersedes".

## Kontexty a místa integrace

| Kontext | Kde volat | Documents | Stav | Notes |
|---------|-----------|-----------|------|-------|
| `register` | `apps/web/src/app/components/auth/useAidvisoraLogin.ts` — po úspěšném `signUp` | `["terms", "privacy"]` | **TODO** | Přidat fetch call `/api/legal/accept-terms` nebo server action; uživatel musí zaškrtnout checkbox na register screenu. |
| `checkout` | `apps/web/src/app/api/stripe/webhook/route.ts` — `checkout.session.completed` | `["terms", "dpa", "privacy"]` | ✅ hooked | Stripe checkout → při přechodu na paid tenant potvrzuje DPA. |
| `staff-invite` | `apps/web/src/app/api/staff-invitations/accept/route.ts` (hledat soubor) | `["terms", "privacy"]` | **TODO** | Při akceptaci staff invite pozvaný člen akceptuje ToS. |
| `client-invite` | `apps/web/src/app/invite/[token]/accept/route.ts` nebo komponenta | `["terms", "privacy"]` | **TODO** | Klient přijímající pozvání do portálu musí odsouhlasit — často přehlédnuté. |
| `beta-terms` | `apps/web/src/app/beta-terms/page.tsx` acceptance form (pokud existuje) | `["beta-terms"]` | **TODO** | Pro soft launch partnery. |

## Integrační pattern

### Server action

```ts
import { recordTermsAcceptance } from "@/lib/legal/terms-acceptance";

export async function acceptClientInviteAction(formData: FormData) {
  "use server";
  const { userId, contactId, tenantId } = await resolveInvite(formData);
  await recordTermsAcceptance({
    userId,
    contactId,
    tenantId,
    context: "client-invite",
    documents: ["terms", "privacy"],
    // `request` dostupný přes headers() → request-level je OK vynechat,
    // místo toho předat ručně:
    ipAddress: "forwarded from cookies()?.get(...) or headers() xff",
    userAgent: "...",
  });
}
```

### API route (POST `/api/legal/accept-terms`)

Pro klientský register flow:

```ts
// apps/web/src/app/api/legal/accept-terms/route.ts
import { NextResponse } from "next/server";
import { recordTermsAcceptance } from "@/lib/legal/terms-acceptance";
import { getUserFromRequest } from "@/lib/auth/server";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  await recordTermsAcceptance({
    userId: user.id,
    context: body.context,
    documents: body.documents,
    request,
  });
  return NextResponse.json({ ok: true });
}
```

Po registraci (client-side) volat:

```ts
await fetch("/api/legal/accept-terms", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    context: "register",
    documents: ["terms", "privacy"],
  }),
});
```

## Re-prompt při nové verzi

Když inkrementujete `LEGAL_DOCUMENT_VERSION` v `apps/web/src/app/legal/legal-meta.ts`:

1. Spusťte `findLatestAcceptance({ userId, minVersion: LEGAL_DOCUMENT_VERSION })` v `dashboard` layoutu.
2. Pokud vrátí `null`, zobrazte modální "Aktualizovali jsme podmínky" s checkboxem, který triggeruje další `recordTermsAcceptance`.

## Kontrola v GDPR dotazu

```sql
-- Kdy uživatel naposledy akceptoval, jakou verzi:
SELECT context, version, documents, accepted_at, ip_address, user_agent
FROM user_terms_acceptance
WHERE user_id = '<supabase user id>'
ORDER BY accepted_at DESC;
```

## Co je reálně HARD BLOCKER pro paid launch

- ✅ DB + helper + Stripe checkout hook — **done**
- ❌ Register flow (nutné pro každý nový account) — **ship before soft launch**
- ❌ Client invite flow (klient musí souhlasit s ToS portálu) — **ship before soft launch**
- 🟡 Staff invite — může jít ve 2. PR, není blokátor
- 🟡 Beta terms — jen pokud aktivně onboardujete partnery na beta

## Cross-reference

- [docs/legal/dpa-register.md](./dpa-register.md)
- [docs/security/audit-log-coverage.md](../security/audit-log-coverage.md)
