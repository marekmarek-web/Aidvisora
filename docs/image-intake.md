# AI Photo / Image Intake — přehled

Samostatná asistentní “lane” pro obrázky v chatu (mimo AI Review PDF pipeline). Dokumentace po fázích:

| Fáze | Dokument |
|------|----------|
| 1 | [image-intake-phase1.md](./image-intake-phase1.md) (dokumentace; vitest soubor `phase1` není) |
| 2 | [image-intake-phase2.md](./image-intake-phase2.md) |
| 3 | [image-intake-phase3.md](./image-intake-phase3.md) |
| 4 | [image-intake-phase4.md](./image-intake-phase4.md) |
| 5 | [image-intake-phase5.md](./image-intake-phase5.md) |
| 6 | [image-intake-phase6.md](./image-intake-phase6.md) |
| 7 | [image-intake-phase7.md](./image-intake-phase7.md) |

## Testy (web)

Z kořene monorepa (nebo z `apps/web`):

```bash
pnpm --filter web test:image-intake
```

## Rollout: tři vrstvy

Produkční requesty předávají `tenantId` z [`ImageIntakeRequest`](../apps/web/src/lib/ai/image-intake/types.ts). Gating je **součin** (AND):

1. **Env + allowlist + procenta** — [`feature-flag.ts`](../apps/web/src/lib/ai/image-intake/feature-flag.ts) (`IMAGE_INTAKE_*`).
2. **Tenant admin FEATURE_FLAGS** — [`feature-flags.ts`](../apps/web/src/lib/admin/feature-flags.ts), pokud je u `isImageIntake*ForUser(..., tenantId)` předán `tenantId`. Bez druhého argumentu zůstává chování jen na env (např. starší testy).
3. **`image-intake-config`** — limity, booleany pro intent assist, DB persist frontu atd. ([`image-intake-config.ts`](../apps/web/src/lib/ai/image-intake/image-intake-config.ts)); prioritně runtime override → env → default.

### Admin flagy (tenant)

| Kód | Účel |
|-----|------|
| `image_intake_enabled` | Master přepínač image intake pro tenant |
| `image_intake_combined_multimodal` | Kombinovaný multi-image vision pass |
| `image_intake_intent_assist` | Model assist při nejednoznačné změně záměru |
| `image_intake_handoff_queue` | Zápis handoffu do AI Review fronty (`submitToAiReviewQueue`) |
| `image_intake_cross_session_persistence` | Cross-session DB persist / merge |

`getImageIntakeAdminFlags(tenantId)` vrátí přehled stavu.

### Reprezentativní env proměnné

| Oblast | Příklady |
|--------|----------|
| Základ | `IMAGE_INTAKE_ENABLED` |
| Multimodal | `IMAGE_INTAKE_MULTIMODAL_ENABLED`, `IMAGE_INTAKE_MULTIMODAL_MODEL` |
| Stitching / thread | `IMAGE_INTAKE_STITCHING_ENABLED`, `IMAGE_INTAKE_THREAD_RECONSTRUCTION_ENABLED` |
| Handoff doporučení | `IMAGE_INTAKE_REVIEW_HANDOFF_ENABLED` |
| Cross-session | `IMAGE_INTAKE_CROSS_SESSION_ENABLED`, `IMAGE_INTAKE_CROSS_SESSION_PERSISTENCE_ENABLED` |
| Allowlisty | `IMAGE_INTAKE_ALLOWED_USER_IDS`, `IMAGE_INTAKE_MULTIMODAL_ALLOWED_USER_IDS`, … |
| Canary | `IMAGE_INTAKE_COMBINED_MULTIMODAL_PERCENTAGE`, `IMAGE_INTAKE_CROSS_SESSION_PERCENTAGE`, … |
| Config (Phase 7) | `IMAGE_INTAKE_CROSS_SESSION_TTL_HOURS`, `IMAGE_INTAKE_HANDOFF_QUEUE_SUBMIT_ENABLED`, `IMAGE_INTAKE_INTENT_ASSIST_ENABLED`, … |

Kompletní tabulka konfig klíčů: [image-intake-phase7.md § TTL/config](./image-intake-phase7.md#f-ttlconfig-hardening).

## Migrace SQL

Žádná dedikovaná migrace pro image intake Phase 7 — persistence reuseuje `ai_generations` / existující schéma.
