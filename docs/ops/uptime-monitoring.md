# Uptime monitoring — externí (out-of-band)

> Delta audit A24/A30. Sentry alerts (cutlist P0) zachytí runtime errors **v běžící aplikaci**. Pokud ale spadne celá Vercel deployment / DNS / Supabase pool, Sentry mlčí. Tento runbook popisuje externí monitoring, který tuto mezeru pokrývá.

## Endpoint

- **URL:** `https://www.aidvisora.cz/api/healthcheck`
- **Methody:** `GET` (plné), `HEAD` (lehké, jen DB)
- **Ověřené závislosti:** Postgres (Drizzle `SELECT 1`), Stripe API (`/v1/balance`), Resend API (`/domains`)
- **HTTP kódy:**
  - `200` — vše ok
  - `200` + `status: "degraded"` v JSON — DB ok, Stripe nebo Resend fail
  - `503` — DB fail (critical)
- **Response header:** `x-health-summary: db=ok stripe=ok resend=ok`
- **Latency pole:** `latencyMs` per komponenta

## Doporučený setup — Better Stack (fka Better Uptime)

1. Založit účet na [betterstack.com](https://betterstack.com) (free tier = 10 monitorů, 3min interval).
2. Přidat **3 monitory**:
   | Monitor | URL | Check | Interval | Region | Alert |
   |---------|-----|-------|----------|--------|-------|
   | Health | `https://www.aidvisora.cz/api/healthcheck` | HTTP 200 + contains `"status":"ok"` | **60 s** | EU (Frankfurt + Amsterdam) | SMS + email |
   | Landing | `https://www.aidvisora.cz/` | HTTP 200 | 3 min | EU | email |
   | Auth redirect | `https://www.aidvisora.cz/prihlaseni` | HTTP 200 | 3 min | EU | email |
3. **SSL monitor** na `aidvisora.cz` + `www.aidvisora.cz` (expirace cert 30/14/7 dní předem).
4. **Escalation:** SMS po 2 po sobě jdoucích selháních (odfiltruje flap).
5. **Status page:** Better Stack nabízí hostovanou veřejnou status page `status.aidvisora.cz` (CNAME v DNS). Nahradí nebo doplní aktuální `/status` in-app page.

## Alternativa — UptimeRobot

- Free tier = 50 monitorů, 5min interval, HTTPS + keyword.
- Jednodušší, méně SMS zdarma. OK pro soft launch, Better Stack pro paid.

## Alternativa — Checkly

- Placený, ale dělá **browser-based synthetic monitoring** (Playwright scripts). Vyšší úroveň — simuluje login poradce, vytvoření kontaktu, AI Review flow. Zvážit pro paid launch (D+14).

## Co monitor **NEkontroluje**

- FCM push delivery (Google outage → klienti bez notifikace, healthcheck ok)
- OpenAI / Anthropic API (AI Review degraded, healthcheck ok)
- Supabase Auth (password reset flow — vyžaduje syntetický test)
- Storage bucket uploads (velké soubory — nenormální test)

Pro tyto přidat **Checkly synthetic** v D+14 milníku.

## Integrace se Sentry

1. V Sentry založit **Uptime check** (`Alerts` → `Alerts` → `Uptime monitors` — **nepřekrývá** Better Stack, jen doplňuje).
2. Integrační flow pro korelaci: Better Stack webhook → Slack `#incidents` kanál, Sentry alert → stejný kanál. Při incidentu = 2 signály v jednom místě.

## Runbook při alertu

1. Ověřit z browseru: `curl -sf https://www.aidvisora.cz/api/healthcheck | jq`
2. Pokud `status: "down"` a `components.database.status: "fail"`:
   - Zkontrolovat Supabase dashboard (projekt → Database → Metrics)
   - Zkontrolovat connection pool (Supabase → Settings → Database → Connection pooler)
3. Pokud `status: "degraded"` a Stripe/Resend fail:
   - Většinou upstream outage (Stripe status, Resend status) — sdělit to klientům přes statuspage, neřešit aplikačně
4. Pokud health ok, ale Better Stack vidí landing 503:
   - Zkontrolovat Vercel deployment (možná build crash, rollback na předchozí deployment přes `vercel rollback`)

## TODO před prvním paid uživatelem

- [ ] Založit Better Stack účet (30 min)
- [ ] 3 monitory (health, landing, auth) — 20 min
- [ ] SMS eskalace na +420… — 10 min
- [ ] SSL monitor — 5 min
- [ ] Webhook → Slack #incidents — 10 min
- [ ] Vyzkoušet alert: vypnout `DATABASE_URL` v Vercel preview, ověřit že přijde SMS
