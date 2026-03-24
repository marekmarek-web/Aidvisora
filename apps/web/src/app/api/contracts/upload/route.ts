import { NextResponse } from "next/server";
import { getMembership } from "@/lib/auth/get-membership";
import { createAdminClient } from "@/lib/supabase/server";
import { createContractReview, updateContractReview } from "@/lib/ai/review-queue-repository";
import { runContractUnderstandingPipeline } from "@/lib/ai/contract-understanding-pipeline";
import { findClientCandidates, buildAllDraftActions } from "@/lib/ai/draft-actions";
import { isMatchingAmbiguous } from "@/lib/ai/client-matching";
import {
  findMatchedCompanies,
  findMatchedDeals,
  findMatchedExistingContracts,
  findMatchedHouseholds,
} from "@/lib/ai/client-matching";
import { logOpenAICall } from "@/lib/openai";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { detectMagicMimeTypeFromBytes, mimeMatchesAllowedSignature } from "@/lib/security/file-signature";
import { tryBeginIdempotencyWindow } from "@/lib/security/idempotency";
import { createSignedStorageUrl } from "@/lib/storage/signed-url";
import { preprocessForAiExtraction } from "@/lib/documents/processing/preprocess-for-ai";

export const dynamic = "force-dynamic";
/** OpenAI pipeline může trvat dlouho (2× volání s PDF po optimalizaci). Na Vercelu platí limit plánu (Pro často až 300 s). */
export const maxDuration = 120;

const ALLOWED_MIME = ["application/pdf"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/** Set by middleware; /api/contracts/* autorizujeme jen přes hlavičku (bez Supabase v route). */
const USER_ID_HEADER = "x-user-id";

function maskForLog(value: unknown): string {
  if (value == null) return "—";
  const s = String(value);
  if (s.length <= 4) return "***";
  return s.slice(0, 2) + "***" + s.slice(-2);
}

export async function POST(request: Request) {
  const start = Date.now();
  const userId = request.headers.get(USER_ID_HEADER);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const membership = await getMembership(userId);
    // Stejně jako AI asistent: stačí člen workspace; placená / role omezení později.
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const limiter = checkRateLimit(request, "contracts-upload", `${membership.tenantId}:${userId}`, {
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!limiter.ok) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please retry later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file?.size) {
      return NextResponse.json(
        { error: "Vyberte soubor (PDF)." },
        { status: 400 }
      );
    }

    // Single read: Node/Undici File can fail on Supabase upload after arrayBuffer() was consumed.
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Soubor je příliš velký (max 20 MB)." },
        { status: 400 }
      );
    }

    const detectedMime = detectMagicMimeTypeFromBytes(fileBytes.subarray(0, Math.min(64, fileBytes.byteLength)));
    let mimeType = (file.type?.toLowerCase() || "").trim();
    // iOS/Safari often sends empty type or application/octet-stream for real PDFs.
    if (detectedMime === "application/pdf") {
      mimeType = "application/pdf";
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json(
        { error: "Povolený formát je pouze PDF." },
        { status: 400 }
      );
    }
    if (!mimeMatchesAllowedSignature(mimeType, detectedMime)) {
      return NextResponse.json({ error: "Obsah souboru neodpovídá deklarovanému typu." }, { status: 400 });
    }

    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
    if (idempotencyKey) {
      const scopedKey = `contracts:${membership.tenantId}:${userId}:${idempotencyKey}`;
      const accepted = tryBeginIdempotencyWindow(scopedKey, 5 * 60_000);
      if (!accepted) {
        return NextResponse.json({ error: "Duplicate upload request." }, { status: 409 });
      }
    }

    const tenantId = membership.tenantId;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const id = crypto.randomUUID();
    const storagePath = `contracts/${tenantId}/${id}/${Date.now()}-${safeName}`;

    const admin = createAdminClient();
    // Supabase JS na Node/Vercel spolehlivěji přijímá Buffer než čistý Uint8Array.
    const uploadBuffer = Buffer.from(fileBytes);

    let uploadError: { message?: string } | null = null;
    try {
      const up = await admin.storage.from("documents").upload(storagePath, uploadBuffer, {
        contentType: mimeType,
        upsert: false,
      });
      uploadError = up.error;
    } catch (storageErr) {
      console.error("[contracts/upload] storage.upload threw", storageErr);
      return NextResponse.json(
        { error: "Nahrání souboru selhalo.", code: "STORAGE_EXCEPTION" },
        { status: 500 }
      );
    }

    if (uploadError) {
      console.error("[contracts/upload] storage error", uploadError.message ?? uploadError);
      const safeMsg =
        uploadError.message?.toLowerCase().includes("bucket") ||
        uploadError.message?.toLowerCase().includes("not found")
          ? "Úložiště není dostupné."
          : "Nahrání souboru selhalo.";
      return NextResponse.json({ error: safeMsg, code: "STORAGE_REJECTED" }, { status: 500 });
    }

    let reviewId: string;
    try {
      reviewId = await createContractReview({
        tenantId,
        fileName: file.name,
        storagePath,
        mimeType,
        sizeBytes: fileBytes.byteLength,
        processingStatus: "uploaded",
        uploadedBy: userId,
      });
    } catch (dbErr) {
      const pgMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      const pgCode = (dbErr as { code?: string })?.code;
      console.error("[contracts/upload] createContractReview failed", { message: pgMsg, code: pgCode });
      await admin.storage.from("documents").remove([storagePath]).catch(() => {});
      return NextResponse.json(
        {
          error:
            "Nepodařilo se uložit smlouvu do databáze. Zkontroluj migrace (tabulka contract_upload_reviews) a DATABASE_URL.",
          code: "DB_INSERT_REVIEW",
        },
        { status: 500 }
      );
    }

    await updateContractReview(reviewId, tenantId, {
      processingStatus: "processing",
    });
    await logAudit({
      tenantId,
      userId,
      action: "extraction_started",
      entityType: "contract_review",
      entityId: reviewId,
      request,
    }).catch(() => {});

    const signed = await createSignedStorageUrl({
      adminClient: admin,
      bucket: "documents",
      path: storagePath,
      purpose: "internal_processing",
    });
    const fileUrl = signed.signedUrl;

    if (!fileUrl) {
      await updateContractReview(reviewId, tenantId, {
        processingStatus: "failed",
        errorMessage: "Nepodařilo se vytvořit odkaz na soubor.",
      });
      await logAudit({
        tenantId,
        userId,
        action: "extraction_failed",
        entityType: "contract_review",
        entityId: reviewId,
        request,
        meta: { reason: "no_signed_url" },
      }).catch(() => {});
      return NextResponse.json(
        { error: "Zpracování selhalo." },
        { status: 500 }
      );
    }

    let preprocessedUrl = fileUrl;
    let adobePreprocessResult: Awaited<ReturnType<typeof preprocessForAiExtraction>> | null = null;
    let preprocessThrew = false;
    const preprocessStartedAt = Date.now();
    let preprocessDurationMs: number | undefined;
    let pipelineDurationMs: number | undefined;
    try {
      adobePreprocessResult = await preprocessForAiExtraction(
        fileUrl,
        storagePath,
        tenantId,
        id,
        mimeType
      );
      preprocessDurationMs = Date.now() - preprocessStartedAt;
      preprocessedUrl = adobePreprocessResult.fileUrl;

      if (adobePreprocessResult.preprocessed) {
        await updateContractReview(reviewId, tenantId, {
          extractionTrace: {
            adobePreprocessed: true,
            adobeJobIds: adobePreprocessResult.providerJobIds,
            adobeWarnings: adobePreprocessResult.warnings,
            readabilityScore: adobePreprocessResult.readabilityScore,
            ocrConfidenceEstimate: adobePreprocessResult.ocrConfidenceEstimate,
            ocrPdfPath: adobePreprocessResult.ocrPdfPath,
            preprocessDurationMs,
          },
        });
      }
    } catch (preprocessErr) {
      preprocessThrew = true;
      preprocessDurationMs = Date.now() - preprocessStartedAt;
      const preprocessMsg = preprocessErr instanceof Error ? preprocessErr.message : String(preprocessErr);
      console.warn("[contracts/upload] Adobe preprocessing failed, continuing with original", preprocessMsg);
    }

    const pipelineStartedAt = Date.now();
    const preprocessMeta =
      adobePreprocessResult != null
        ? {
            adobePreprocessed: adobePreprocessResult.preprocessed,
            preprocessStatus: adobePreprocessResult.preprocessStatus,
            preprocessMode: adobePreprocessResult.preprocessMode,
            preprocessWarnings: adobePreprocessResult.warnings,
            ocrConfidenceEstimate: adobePreprocessResult.ocrConfidenceEstimate,
            readabilityScore: adobePreprocessResult.readabilityScore,
            preprocessDurationMs,
            normalizedPdfPath: adobePreprocessResult.normalizedPdfPath,
            markdownContentLength: adobePreprocessResult.markdownContent?.length ?? 0,
            pageCountEstimate: adobePreprocessResult.pageCountEstimate,
          }
        : preprocessThrew
          ? {
              preprocessStatus: "failed",
              preprocessMode: "adobe",
              adobePreprocessed: false,
              preprocessWarnings: ["preprocess_exception"],
              preprocessDurationMs,
            }
          : {
              preprocessStatus: "skipped",
              preprocessMode: "none",
              adobePreprocessed: false,
            };

    console.info(
      "[contracts/upload] preprocess_done",
      JSON.stringify({
        reviewId,
        preprocessStatus: preprocessMeta.preprocessStatus,
        preprocessMode: preprocessMeta.preprocessMode,
        adobePreprocessed: preprocessMeta.adobePreprocessed,
        durationMs: preprocessDurationMs,
      })
    );

    const pipelineResult = await runContractUnderstandingPipeline(preprocessedUrl, mimeType, {
      ruleBasedTextHint: adobePreprocessResult?.markdownContent ?? null,
      preprocessMeta,
    });
    pipelineDurationMs = Date.now() - pipelineStartedAt;

    if (pipelineResult.ok) {
      console.info(
        "[contracts/upload] pipeline_ok",
        JSON.stringify({
          reviewId,
          processingStatus: pipelineResult.processingStatus,
          route: pipelineResult.extractionTrace?.extractionRoute,
          normalized: pipelineResult.extractionTrace?.normalizedPipelineClassification,
          documentType: pipelineResult.detectedDocumentType,
        })
      );
    }

    if (!pipelineResult.ok) {
      const errDetail =
        pipelineResult.details != null
          ? ` ${typeof pipelineResult.details === "string" ? pipelineResult.details : JSON.stringify(pipelineResult.details).slice(0, 200)}`
          : "";
      const isRateLimit = pipelineResult.errorCode === "OPENAI_RATE_LIMIT";
      const failTrace = {
        ...(pipelineResult.extractionTrace ?? {}),
        preprocessDurationMs,
        pipelineDurationMs,
        ...(adobePreprocessResult?.preprocessed
          ? {
              adobePreprocessed: true,
              adobeJobIds: adobePreprocessResult.providerJobIds,
              adobeWarnings: adobePreprocessResult.warnings,
              readabilityScore: adobePreprocessResult.readabilityScore,
              ocrPdfPath: adobePreprocessResult.ocrPdfPath,
              normalizedPdfPath: adobePreprocessResult.normalizedPdfPath,
              ocrConfidenceEstimate: adobePreprocessResult.ocrConfidenceEstimate,
            }
          : {}),
      };
      await updateContractReview(reviewId, tenantId, {
        processingStatus: "failed",
        errorMessage: isRateLimit
          ? pipelineResult.errorMessage
          : pipelineResult.errorMessage + errDetail,
        extractionTrace: failTrace,
      });
      await logAudit({
        tenantId,
        userId,
        action: "extraction_failed",
        entityType: "contract_review",
        entityId: reviewId,
        request,
        meta: { step: pipelineResult.extractionTrace?.failedStep },
      }).catch(() => {});
      logOpenAICall({
        endpoint: "contracts/upload_pipeline",
        model: "—",
        latencyMs: Date.now() - start,
        success: false,
        error: maskForLog(pipelineResult.errorMessage),
      });
      return NextResponse.json(
        {
          error: isRateLimit
            ? pipelineResult.errorMessage
            : "Extrakce ze smlouvy selhala.",
          code: pipelineResult.errorCode,
          id: reviewId,
        },
        { status: 200 }
      );
    }

    const data = pipelineResult.extractedPayload;
    const draftActions = buildAllDraftActions(data);
    const clientMatchCandidates = await findClientCandidates(data, { tenantId });
    const matchedHouseholds = await findMatchedHouseholds(tenantId, clientMatchCandidates);
    const matchedDeals = await findMatchedDeals(
      tenantId,
      clientMatchCandidates,
      String(data.extractedFields.contractNumber?.value ?? "")
    );
    const matchedCompanies = await findMatchedCompanies(tenantId, data);
    const matchedContracts = await findMatchedExistingContracts(tenantId, data, clientMatchCandidates);
    data.candidateMatches = {
      matchedClients: clientMatchCandidates.map((c) => ({
        entityId: c.clientId,
        score: c.score,
        reason: c.reasons.join("; "),
        ambiguous: false,
        extra: {
          confidence: c.confidence,
          matchedFields: c.matchedFields,
          displayName: c.displayName,
        },
      })),
      matchedHouseholds,
      matchedDeals,
      matchedCompanies,
      matchedContracts,
      score: clientMatchCandidates[0]?.score ?? 0,
      reason: clientMatchCandidates[0]?.reasons.join("; ") ?? "no_match",
      ambiguityFlags: isMatchingAmbiguous(clientMatchCandidates) ? ["multiple_close_candidates"] : [],
    };
    data.suggestedActions = draftActions.map((a) => ({
      type: a.type,
      label: a.label,
      payload: a.payload,
    }));
    const reasonsForReview = [...pipelineResult.reasonsForReview];
    if (isMatchingAmbiguous(clientMatchCandidates)) {
      reasonsForReview.push("ambiguous_client_match");
    }
    if (
      data.documentClassification.documentIntent === "modifies_existing_product" &&
      matchedContracts.length === 0
    ) {
      reasonsForReview.push("missing_existing_contract_match");
    }

    const mergedTrace = {
      ...pipelineResult.extractionTrace,
      preprocessDurationMs,
      pipelineDurationMs,
      ...(adobePreprocessResult?.preprocessed
        ? {
            adobePreprocessed: true,
            adobeJobIds: adobePreprocessResult.providerJobIds,
            adobeWarnings: adobePreprocessResult.warnings,
            readabilityScore: adobePreprocessResult.readabilityScore,
            ocrPdfPath: adobePreprocessResult.ocrPdfPath,
            normalizedPdfPath: adobePreprocessResult.normalizedPdfPath,
            ocrConfidenceEstimate: adobePreprocessResult.ocrConfidenceEstimate,
          }
        : {}),
    };

    await updateContractReview(reviewId, tenantId, {
      processingStatus: pipelineResult.processingStatus,
      extractedPayload: data,
      draftActions,
      clientMatchCandidates,
      confidence: pipelineResult.confidence,
      reasonsForReview: reasonsForReview.length ? reasonsForReview : null,
      inputMode: pipelineResult.inputMode,
      extractionMode: pipelineResult.extractionMode,
      detectedDocumentType: pipelineResult.detectedDocumentType,
      detectedDocumentSubtype: data.documentClassification.subtype ?? null,
      lifecycleStatus: data.documentClassification.lifecycleStatus ?? null,
      documentIntent: data.documentClassification.documentIntent ?? null,
      extractionTrace: mergedTrace,
      validationWarnings: pipelineResult.validationWarnings.length ? pipelineResult.validationWarnings : null,
      fieldConfidenceMap: pipelineResult.fieldConfidenceMap ?? undefined,
      classificationReasons: pipelineResult.classificationReasons.length ? pipelineResult.classificationReasons : null,
      dataCompleteness: data.dataCompleteness ?? null,
      sensitivityProfile: data.sensitivityProfile ?? null,
      sectionSensitivity: data.sectionSensitivity ?? null,
      relationshipInference: data.relationshipInference ?? null,
    });
    await logAudit({
      tenantId,
      userId,
      action: "extraction_completed",
      entityType: "contract_review",
      entityId: reviewId,
      request,
      meta: { processingStatus: pipelineResult.processingStatus },
    }).catch(() => {});

    logOpenAICall({
      endpoint: "contracts/upload_pipeline",
      model: "—",
      latencyMs: Date.now() - start,
      success: true,
    });

    return NextResponse.json({
      id: reviewId,
      processingStatus: pipelineResult.processingStatus,
      confidence: pipelineResult.confidence,
      needsHumanReview: pipelineResult.processingStatus === "review_required",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : typeof err;
    console.error(
      "[route POST /api/contracts/upload] 500",
      errName,
      message,
      err instanceof Error ? err.stack : ""
    );
    return NextResponse.json(
      { error: "Nahrání smlouvy selhalo.", code: "CONTRACT_UPLOAD_UNHANDLED" },
      { status: 500 }
    );
  }
}
