# AI Review → Publish Flow (Phase 4/5/6)

Mapa průchodu smlouvy od nahrání PDF po aplikaci do CRM a viditelnost v klientském portálu.

---

## Přehled (end-to-end)

```
PDF nahrání
  → Extrakce (AI)
  → Review fronta (advisor schvaluje / opravuje)
  → Approve
  → Apply do CRM (kontakt, smlouva, portfolio)
  → Link dokumentu ke klientovi (volitelně visible)
```

---

## 1. Nahrání a extrakce

```
POST /api/ai-review/upload  (nebo přes CRM upload UI)
  → apps/web/src/app/api/ai-review/...
  → uloží do storage (Supabase Storage)
  → INSERT do contract_upload_reviews:
       processingStatus = "processing"
       reviewStatus     = "pending"
  → spustí AI extrakci (OpenAI structured output)
  → UPDATE:
       processingStatus = "done"
       extractedPayload = { ... }
       confidence       = 0.0–1.0
```

---

## 2. Review fronta (advisor)

```
GET /portal/ai-review/
  → apps/web/src/app/portal/ai-review/page.tsx
      └─ seznam položek (reviewStatus: pending | approved | applied | rejected)

Akce advisora:
  matchClient      → přiřadit kontakt (matchedClientId)
  approve          → approveContractReview()
  fieldEdits       → saveContractCorrection() + mergeFieldEditsIntoExtractedPayload()
  apply            → applyContractReviewDrafts()
```

---

## 3. Approve

```
approveContractReview(id, options?)        ← apps/web/src/app/actions/contract-review.ts
  ├─ auth guard (documents:write permission)
  ├─ optional fieldEdits → mergeFieldEditsIntoExtractedPayload()
  ├─ optional correctionReason → saveContractCorrection()
  └─ UPDATE contract_upload_reviews:
       reviewStatus = "approved"
       approvedBy, approvedAt
```

---

## 4. Quality gate (apply readiness)

```
applyContractReviewDrafts(id, options?)    ← apps/web/src/app/actions/contract-review.ts
  ├─ canApply(processingStatus, reviewStatus) — musí být "approved"
  ├─ regeneratePaymentDraftActions(row)    ← vždy fresh z extractedPayload
  ├─ evaluateApplyReadiness(row)           ← apps/web/src/lib/ai/quality-gates.ts
  │     → blockedReasons (např. PAYMENT_MISSING_AMOUNT)
  │     → lze override s overrideGateReasons + audit log
  └─ breadcrumbContractReviewPaymentGate() při blokaci (Sentry)
```

---

## 5. Apply do CRM

```
applyContractReview(input)                 ← apps/web/src/lib/ai/apply-contract-review.ts
  ├─ Publish guard: reviewStatus !== "approved"
  │     → { ok: false } + capturePublishGuardFailure() (Phase 6H)
  ├─ Idempotent: reviewStatus === "applied" → vrátí existující payload
  ├─ DB transakce:
  │     ├─ findExistingContactId / INSERT contacts
  │     ├─ findExistingContractId / INSERT nebo UPDATE contracts
  │     │     segment = validateSegment(extractedPayload.segment) || "ZP"
  │     │     type = segment  (canonical sync)
  │     │     advisorConfirmedAt = now
  │     ├─ INSERT tasks (draftActions type="create_task")
  │     ├─ INSERT/UPDATE portfolio attrs (buildPortfolioAttributesFromExtracted)
  │     └─ INSERT clientPaymentSetups (type="create_payment_setup_for_portal")
  └─ returns ApplyResultPayload { createdContactId, createdContractId, ... }

Po apply:
  UPDATE contract_upload_reviews:
    reviewStatus = "applied"
    appliedBy, appliedAt
    applyResultPayload = bridgedPayload
```

---

## 6. Link dokumentu ke klientovi

```
linkContractReviewFileToContactDocuments(reviewId, options?)
  ← apps/web/src/app/actions/contract-review.ts

  ├─ auth guard (documents:write)
  ├─ matchedClientId musí být set
  ├─ Publish guard (Phase 6E):
  │     visibleToClient=true → reviewStatus musí být "approved" nebo "applied"
  │     → capturePublishGuardFailure() při narušení (Phase 6H)
  ├─ Dedup: pokud storagePath již v documents existuje pro daný kontakt → update (ne INSERT)
  ├─ INSERT documents:
  │     storagePath (sdílený s review — bez kopírování v úložišti)
  │     visibleToClient = options.visibleToClient ?? false
  │     tags = ["ai-smlouva", "review:{reviewId}"]
  └─ visibleToClient=true → notifyClientAdvisorSharedDocument() (best-effort)
```

Auto-linking: `applyContractReviewDrafts` volá `linkContractReviewFileToContactDocuments`
automaticky po úspěšném apply, pokud je `matchedClientId` set (visible=true).

---

## 7. Canonical data rules

| Pole | Pravidlo |
|------|---------|
| `contracts.segment` | `validateSegment(extractedPayload.segment)` — musí být v `contractSegments` enum, fallback `"ZP"` |
| `contracts.type` | Vždy `= segment` (canonical sync) |
| `contracts.advisorConfirmedAt` | Vždy set při create/update přes AI review |
| `documents.visibleToClient` | Lze nastavit `true` pouze pokud `reviewStatus ∈ {approved, applied}` |

---

## 8. Klíčové soubory

| Oblast | Soubor |
|--------|--------|
| Server actions (approve, apply, link) | `apps/web/src/app/actions/contract-review.ts` |
| Core apply logic | `apps/web/src/lib/ai/apply-contract-review.ts` |
| Quality gates | `apps/web/src/lib/ai/quality-gates.ts` |
| Review queue repository | `apps/web/src/lib/ai/review-queue-repository.ts` |
| Field merging / mappers | `apps/web/src/lib/ai-review/mappers.ts` |
| Portfolio attributes builder | `apps/web/src/lib/portfolio/build-portfolio-attributes-from-extract.ts` |
| Bridge payload mapper | `apps/web/src/lib/ai/contracts-analyses-bridge.ts` |
| Payment field contract | `apps/web/src/lib/ai/payment-field-contract.ts` |
| Observability | `apps/web/src/lib/observability/contract-review-sentry.ts`, `portal-sentry.ts` |
| Regression testy | `apps/web/src/lib/client-portal/__tests__/phase-6f-phase5-6-release-gate.test.ts` |

---

## 9. Časté chyby a jak se vyhnout

| Symptom | Příčina | Fix |
|---------|---------|-----|
| Apply vrátí `"Publish guard: review musí být schválena"` | `reviewStatus !== "approved"` při volání apply | Zavolat `approveContractReview` nejdřív |
| Link dokumentu vrátí `"Publish guard: dokument nelze zveřejnit"` | `visibleToClient=true` ale review není approved/applied | Approve/apply nejdřív, pak link |
| `"Nejprve schvalte položku"` v `applyContractReviewDrafts` | `canApply()` vrátil false | Zkontrolovat `processingStatus` a `reviewStatus` |
| `segment` je `""` nebo neznámá hodnota | `extractedPayload.segment` mimo enum | `validateSegment()` fallback na `"ZP"` — je to záměrné |
| Duplicitní dokument po re-linku | Stejný `storagePath` pro kontakt | Dedup logika provede update (ne INSERT) — OK |
