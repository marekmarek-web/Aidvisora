# AI Photo / Image Intake — Release Runbook

**Capability:** AI Photo / Image Intake (Phases 1–11)
**Status:** READY WITH CAVEATS — viz Release Verdict níže
**Datum:** 2026-04-07

---

## Co capability dělá

Umožňuje poradci nahrát obrázek / screenshot do asistentního chatu a nechat ho automaticky klasifikovat, extrahovat fakta, provázat s klientem/případem a navrhnout akci — vše přes preview/confirm flow bez přímého write execution.

### In scope
- Image intake lane v AI assistantu (oddělená od text-only flow)
- Cheap text classifier + volitelný multimodal vision pass
- Multi-image session stitching
- Cross-session persistence (artefakty v DB)
- Household ambiguity handling
- AI Review handoff doporučení + submit do queue po advisor confirm
- Intent-assist cache (ambient disambiguation)
- Admin/runtime feature flags (per-tenant + per-user + canary %)
- Document-set evaluation
- Cleanup cron (denní artefakty) + 2h cache cleanup cron
- Health endpoint pro monitoring cleanup
- External webhook push po každém cron runu
- Preview/confirm reuse (kanonická akční surface)
- Lane separation guardrails

### Out of scope / není k dispozici
- Parallelní write engine (existuje jen kanonická surface)
- AI Review redesign — handoff je pouze vstupní payload do queue
- OCR/text extraction z PDF přes image intake (to řeší AI Review pipeline)
- Přímá integrace s Adobe (image intake ≠ document processing)
- Batch async zpracování obrázků na pozadí

---

## Env vars — rychlý přehled

Plný seznam s komentáři: `apps/web/.env.example` sekce `AI Photo / Image Intake`.

| Proměnná | Default | Popis |
|---|---|---|
| `IMAGE_INTAKE_ENABLED` | `false` | Master switch |
| `IMAGE_INTAKE_MULTIMODAL_ENABLED` | `false` | Vision pass (platí za call) |
| `IMAGE_INTAKE_STITCHING_ENABLED` | `false` | Multi-image session stitching |
| `IMAGE_INTAKE_REVIEW_HANDOFF_ENABLED` | `false` | Handoff doporučení |
| `IMAGE_INTAKE_HANDOFF_SUBMIT_ENABLED` | `false` | Submit do queue |
| `IMAGE_INTAKE_CROSS_SESSION_ENABLED` | `false` | DB persistence artefaktů |
| `IMAGE_INTAKE_ROLLOUT_PERCENTAGE` | 100 | Canary 0–100 % |
| `IMAGE_INTAKE_CRON_HEALTH_WEBHOOK_URL` | prázdné | Slack/Make/n8n webhook |

Per-tenant overrides: admin panel `/portal/admin/image-intake` nebo `setFeatureOverride()` API.

---

## Rollout — doporučené pořadí

1. Zapni pouze `IMAGE_INTAKE_ENABLED=true` + `IMAGE_INTAKE_ROLLOUT_PERCENTAGE=5`
2. Ověř health, audit log (`image_intake.pipeline_done`), žádné guardrail violations
3. Rozšiř na 20 %, sleduj latenci a cost (classifier call je levný)
4. Zapni `IMAGE_INTAKE_MULTIMODAL_ENABLED=true` pro allowlist uživatelů
5. Sleduj cost (každý vision call) před plným rozvojem
6. Handoff/submit zapni až po stabilitě základního flow

**Bezpečný disable:** Nastav `IMAGE_INTAKE_ENABLED=false` nebo `IMAGE_INTAKE_ROLLOUT_PERCENTAGE=0`. Text-only flow zůstane 100 % nedotčeno.

---

## Rollback

```bash
# Okamžitý kill switch
IMAGE_INTAKE_ENABLED=false
# Nebo canary vypnutí:
IMAGE_INTAKE_ROLLOUT_PERCENTAGE=0
```

- Redeploy nebo Vercel env var update → okamžitý efekt na nové requesty
- Existující session data v DB nejsou dotčena (stará data vyčistí cleanup cron)
- Žádné migrace k revertu (cleanup cron maže `ai_generations` rows; reverze = přestat mazat)

---

## Monitoring — co sledovat po nasazení

### Audit log akce (Supabase / DB)

| Akce | Co signalizuje |
|---|---|
| `image_intake.pipeline_done` | Úspěšný run — sleduj `outputMode`, `clientBindingState`, `writeReady` |
| `image_intake.pipeline_error` | Chyba v pipeline (neblokuje text-only flow) |
| `image_intake.route_rejected` | Nevhodné assets / flag off |
| `image_intake_cleanup.completed` | Cron proběhl, viz `totalDeleted` |
| `image_intake_cleanup.failed` | Cron selhal |
| `image_intake_cleanup.skipped` | Cron přeskočen (cross_session_persistence=false — v pořádku) |
| `image_intake_cache_cleanup.completed` | Dvouhodinový intent-assist cache cron proběhl, viz `deletedCache` v meta |
| `image_intake_cache_cleanup.failed` | Cache cron selhal |
| `image_intake_cache_cleanup.skipped` | Cache cron přeskočen (cross_session_persistence=false — v pořádku, stejný důvod jako denní cleanup) |

### Guardrail signály (sleduj po buildu)

```
guardrailsTriggered > 0  → lane separation nebo binding violation
LANE_VIOLATION           → komunikační screenshot směřoval do AI Review (bug)
BINDING_VIOLATION        → write-ready plán bez klientského bindingu (správně zachyceno)
PREVIEW_VIOLATION        → write execution bez confirm (správně zachyceno)
```

### Health endpoint

```
GET /api/cron/image-intake-cleanup/health
Authorization: Bearer <session token>

Response: { status: "healthy" | "degraded" | "stale" | "unknown", ... }
```

`stale` = žádný run v posledních 48h → ověřit Vercel cron konfiguraci.

### Cost sledování

- Classifier call: kategorie `copilot`, levný model — sleduj `classifierUsedModel` v audit log
- Multimodal pass: dražší vision call — sleduj `multimodalUsed: true` — zapínat opatrně

---

## Must-pass release scénáře

### Guardrail scénáře (musí projít)

| Scénář | Očekávané chování |
|---|---|
| Text-only request (bez `imageAssets`) | Flow jde přes text lane, image intake vůbec není voláno |
| `IMAGE_INTAKE_ENABLED=false` + obrázek | Fallback response, pipeline se nespustí |
| Screenshot komunikace → lane check | NESMÍ být přesměrován do `ai_review_handoff_suggestion` lane |
| Write-ready plán bez jistého bindingu | Guardrail G2 downgrade na `ambiguous_needs_input` |
| Household ambiguity (multiple_candidates) | Write akce blokována, mód downgrade |
| `review_handoff_candidate` dokumentová sada | Zůstává handoff candidate, nepřidávají se write akce |
| Handoff submit bez advisor confirm | `skipped_no_confirm` — submit se neprovede |
| Confirm flow s handoffem | Volá `submitToAiReviewQueue`, uloží `reviewRowId` do session |
| Cleanup cron failure | Vrátí 500, loguje `image_intake_cleanup.failed`, text flow neovlivněn |
| Cache miss / lookup error | Degraduje gracefully na text classifier; pipeline pokračuje |
| Preflight — soubor příliš velký / špatný MIME | `rejectReason` nastaven, eligible=false, fallback response |
| Batch > MAX_IMAGES_PER_INTAKE | Batch oříznut na max, warning v response |

### Lane separation (KRITICKÉ)

- Obrázek + flag ON → image intake lane
- Obrázek + flag OFF → fallback response, text lane nedotčena
- Text zpráva → text lane vždy, image intake lane ignorována
- confirmExecution + obrázek → confirm flow (ne image intake re-run)

---

## Known Limitations (akceptovatelné)

1. **`sessionHashCache` (in-memory)** — modul-level Map v `preflight.ts`. Na Vercel serverless se per-invocation resetuje. Na dlouho-běžícím dev serveru roste — `purgePreflightCache()` je exportováno, ale nikde se nevolá (cleanup cron ani session expiry). Non-issue na produkci (serverless), low-priority fix pro lokální dev.

2. **Feature flag overrides jsou in-memory** — `setFeatureOverride()` v `feature-flags.ts` ukládá do modul-level `Map`. Na serverless se nepersistuje přes invocations. Pro skutečnou per-tenant persistenci by bylo nutné DB vrstvu. Aktuálně dostatečné pro admin-driven globální overrides přes env vars.

3. **Household ambiguity = vždy downgrade** — pokud jsou dva klienti ve stejné domácnosti, je výsledek vždy `ambiguous_needs_input`. Není implementována vizuální volba klienta. Advisor musí přepnout kontext manuálně. Akceptovatelné pro v1.

4. **Handoff submit percentagový gate** — `IMAGE_INTAKE_HANDOFF_SUBMIT_PERCENTAGE` je deterministický hash-bucket; uživatel si nemůže sám zapnout/vypnout. Akceptovatelné.

5. **Vision cost bez per-tenant účtování** — vision calls nejsou odděleně fakturovány per-tenant; cost sdílí celý OpenAI účet. Akceptovatelné pro interní rollout.

6. **`review_handoff_candidate` → žádné write akce** — záměrné omezení z Phase 4. Dokumentová sada označená jako handoff kandidát nedostane žádné write akce, jen handoff doporučení. Pokud advisor nechce handoff, musí flow ukončit manuálně.

---

## Known Non-Blockers (backlog)

- `purgePreflightCache` se nikde nevolá — přidat do session TTL cleanup (low priority)
- `sessionHashCache` unbounded na dev serveru — bounded Set nebo TTL wrapper (low priority)
- Admin panel `/portal/admin/image-intake` — runtime overrides jsou in-memory (pro produkci zvážit DB persistence)
- Webhook `IMAGE_INTAKE_CRON_HEALTH_WEBHOOK_URL` — fire-and-forget, chyba webhook neblokuje cron, ale chybí logování chyby webhook callu (minor)

---

## Release Verdict

**READY WITH CAVEATS**

- Všechny guardrails jsou funkční (G1–G5 verifikovány)
- Lane separation je čistá a přísná
- Text-only flow je nedotčen (ověřeno v kódu i testech)
- Canonical action surface je jediná write cesta
- Cleanup cron + health endpoint jsou na místě
- Known limitations jsou akceptovatelné pro v1 rollout
- **Caveat 1:** Env vars nebyly v `.env.example` — opraveno v tomto passu
- **Caveat 2:** In-memory feature flag overrides nejsou persistentní přes serverless invocations — pro admin overrides používat env vars nebo deployit s tenant-level DB persistence
- **Caveat 3:** Vision cost je třeba sledovat od prvního dne; doporučen konservativní canary start

---

## Post-deploy checklist

- [ ] Ověřit audit log `image_intake.pipeline_done` na prvních requestech
- [ ] Ověřit `guardrailsTriggered: 0` na čistých requestech
- [ ] Zkontrolovat `GET /api/cron/image-intake-cleanup/health` → `status: healthy` (nebo `unknown` pokud cron ještě neproběhl)
- [ ] Ověřit Vercel cron v dashboard: `image-intake-cleanup` (daily 3am UTC) + `image-intake-cache-cleanup` (2h)
- [ ] Pokud `IMAGE_INTAKE_CRON_HEALTH_WEBHOOK_URL` nastaven → ověřit příjem v Slack/Make
- [ ] Poslat test image request a ověřit response (fallback nebo správný outputMode)
- [ ] Ověřit že text-only request (`imageAssets` absent) stále prochází normálně
- [ ] Sledovat cost dashboard OpenAI prvních 24h po zapnutí multimodal

---

## Kam volat disable při incidentu

1. Vercel: `IMAGE_INTAKE_ENABLED=false` → Redeploy
2. Nebo: `IMAGE_INTAKE_ROLLOUT_PERCENTAGE=0` (bez redeploye pokud je env var live)
3. Nebo: Admin UI → tenant override `image_intake_enabled = false`

Text-only assistant flow není ovlivněn žádnou z těchto změn.
