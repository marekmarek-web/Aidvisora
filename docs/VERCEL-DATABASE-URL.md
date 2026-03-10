# DATABASE_URL na Vercelu – ENOTFOUND

Pokud na Vercelu vidíš chybu:

```text
Error: getaddrinfo ENOTFOUND db.xxxxx.supabase.co
```

znamená to, že Vercel neumí vyřešit hostname přímého připojení k Supabase (`db.xxx.supabase.co`). Přímé připojení používá hlavně IPv6; serverless na Vercelu často má jen IPv4, takže DNS/connect selže.

## Řešení: použít Connection pooler (Session mode)

1. V **Supabase Dashboard** otevři projekt **Aidvisora**.
2. Jdi na **Project Settings** (ozubené kolečko) → **Database**.
3. V sekci **Connection string** klikni na **Connect** (nebo na záložku s connection stringy).
4. Vyber **Session** (ne Direct, ne Transaction).
5. Zkopíruj connection string. Bude vypadat třeba takto:
   ```text
   postgres://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
   Důležité: host je **`aws-0-<region>.pooler.supabase.com`**, ne `db.xxx.supabase.co`.
6. Nahraď v něm `[YOUR-PASSWORD]` skutečným heslem databáze (stejné jako u Direct).
7. Na **Vercelu**: Project **advisorcrm-web** → **Settings** → **Environment Variables**.
8. Uprav proměnnou **DATABASE_URL**: vlož tam zkopírovaný connection string (Session pooler) a ulož.
9. Po změně env spusť **Redeploy** posledního deploymentu (Deployments → ⋮ u posledního → Redeploy), aby se nová `DATABASE_URL` načetla.

Po redeployi by chyba `ENOTFOUND db.xxx.supabase.co` měla zmizet.

## Shrnutí

| Typ připojení | Host | Port | Kdy použít |
|---------------|------|------|------------|
| Direct | `db.xxx.supabase.co` | 5432 | Lokálně, migrace; z Vercelu často ENOTFOUND (IPv6) |
| **Session (pooler)** | `aws-0-<region>.pooler.supabase.com` | 5432 | **Doporučeno pro Vercel** (IPv4) |
| Transaction (pooler) | `db.xxx.supabase.co` | 6543 | Také pro serverless; pokud Direct nefunguje, zkus Session |

V tomto projektu je v DB klientu už nastaveno `prepare: false`, takže kdybys přešel na Transaction mode (6543), bude to také fungovat – ale pro odstranění ENOTFOUND je nejjistější **Session** pooler s hostem `aws-0-*.pooler.supabase.com`.
