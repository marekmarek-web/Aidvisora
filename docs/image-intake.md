# AI Photo / Image Intake — prehled

Samostatna asistentni "lane" pro obrazky v chatu (mimo AI Review PDF pipeline). Dokumentace po fazich:

| Faze | Dokument |
|------|----------|
| 1 | [image-intake-phase1.md](./image-intake-phase1.md) (dokumentace; vitest soubor `phase1` neni) |
| 2 | [image-intake-phase2.md](./image-intake-phase2.md) |
| 3 | [image-intake-phase3.md](./image-intake-phase3.md) |
| 4 | [image-intake-phase4.md](./image-intake-phase4.md) |
| 5 | [image-intake-phase5.md](./image-intake-phase5.md) |
| 6 | [image-intake-phase6.md](./image-intake-phase6.md) |
| 7 | [image-intake-phase7.md](./image-intake-phase7.md) |
| 8 | [image-intake-phase8.md](./image-intake-phase8.md) — lifecycle, cache, admin UI, document sets, cleanup, household scope |
| 9 | [image-intake-phase9.md](./image-intake-phase9.md) — fully surfaced lane: orchestrator wiring, household ambiguity surfacing, persistent intent-assist cache, cleanup monitoring |

## Testy (web)

Z korene monorepa (nebo z `apps/web`):

```bash
pnpm --filter web test:image-intake
```

## Rollout: tri vrstvy

Produkcni requesty predavaji `tenantId` z `ImageIntakeRequest`. Gating je **soucin** (AND):

1. **Env + allowlist + procenta** — `feature-flag.ts` (`IMAGE_INTAKE_*`).
2. **Tenant admin FEATURE_FLAGS** — `feature-flags.ts`, pokud je u `isImageIntake*ForUser(..., tenantId)` predan `tenantId`. Bez druheho argumentu zustava chovani jen na env (napr. starsi testy).
3. **`image-intake-config`** — limity, booleany pro intent assist, DB persist frontu atd.; prioritne runtime override -> env -> default.

### Admin flagy (tenant)

| Kod | Ucel |
|-----|------|
| `image_intake_enabled` | Master prepinac image intake pro tenant |
| `image_intake_combined_multimodal` | Kombinovany multi-image vision pass |
| `image_intake_intent_assist` | Model assist pri nejednoznacne zmene zameru |
| `image_intake_handoff_queue` | Zapis handoffu do AI Review fronty |
| `image_intake_cross_session_persistence` | Cross-session DB persist / merge |

`getImageIntakeAdminFlags(tenantId)` vrati prehled stavu.

## Migrace SQL

Zadna dedicovana migrace pro image intake -- persistence reuseuje `ai_generations` / existujici schema.
