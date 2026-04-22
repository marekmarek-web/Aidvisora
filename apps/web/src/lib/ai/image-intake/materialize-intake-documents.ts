/**
 * Uloží obrázky z image intake do bucketu „documents“ a vytvoří řádky bez contactId,
 * aby šlo po vytvoření klienta provést attachDocumentToClient.
 */

import { randomUUID } from "crypto";
import { documents } from "db";
import { withTenantContext } from "@/lib/db/with-tenant-context";
import { createAdminClient } from "@/lib/supabase/server";
import { parseDataUrl } from "./normalize-intake-image-input";
import type { NormalizedImageAsset } from "./types";
import { MAX_IMAGE_SIZE_BYTES } from "./types";

function extFromMime(mime: string): string {
  const m = mime.split(";")[0]!.trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/heic" || m === "image/heif") return "heic";
  return "bin";
}

async function loadAssetBuffer(
  url: string,
  mimeFromAsset: string,
): Promise<{ buffer: Buffer; mime: string }> {
  if (url.startsWith("data:")) {
    const p = parseDataUrl(url);
    if (!p) throw new Error("invalid_data_url");
    const buf = Buffer.from(p.base64, "base64");
    if (buf.length > MAX_IMAGE_SIZE_BYTES) throw new Error("too_large");
    return { buffer: buf, mime: p.mime };
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) throw new Error(`fetch_${res.status}`);
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > MAX_IMAGE_SIZE_BYTES) throw new Error("too_large");
    const ct = res.headers.get("content-type");
    return {
      buffer: buf,
      mime: ct?.split(";")[0]?.trim() || mimeFromAsset || "application/octet-stream",
    };
  }
  throw new Error("unsupported_url");
}

/**
 * Pro každý asset s platným storageUrl vytvoří dokument v úložišti a DB (contactId null).
 * Při chybě jednotlivého souboru pokračuje — vrací jen úspěšné id.
 */
export async function materializeIntakeImagesAsDocuments(
  assets: NormalizedImageAsset[],
  tenantId: string,
  userId: string,
  intakeId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[materializeIntakeImagesAsDocuments] admin client", e);
    return ids;
  }

  let idx = 0;
  for (const a of assets) {
    const url = a.storageUrl;
    if (!url) {
      idx++;
      continue;
    }
    try {
      const { buffer, mime } = await loadAssetBuffer(url, a.mimeType);
      const ext = extFromMime(mime);
      const objectPath = `${tenantId}/ai-intake/${intakeId}/${Date.now()}_${idx}_${randomUUID().slice(0, 8)}.${ext}`;
      const { error: uploadError } = await admin.storage.from("documents").upload(objectPath, buffer, {
        contentType: mime,
        upsert: false,
      });
      if (uploadError) {
        console.error("[materializeIntakeImagesAsDocuments] upload", uploadError.message);
        idx++;
        continue;
      }
      const displayName = (a.originalFilename?.trim() || `Podklad z dokladu ${idx + 1}`).slice(0, 500);
      const [row] = await withTenantContext({ tenantId, userId }, (tx) =>
        tx
          .insert(documents)
          .values({
            tenantId,
            contactId: null,
            name: displayName,
            storagePath: objectPath,
            mimeType: mime,
            sizeBytes: buffer.length,
            visibleToClient: false,
            uploadSource: "web",
            uploadedBy: userId,
            sourceChannel: "ai_drawer",
          })
          .returning({ id: documents.id }),
      );
      if (row?.id) ids.push(row.id);
    } catch (e) {
      console.error("[materializeIntakeImagesAsDocuments] asset", a.assetId, e);
    }
    idx++;
  }
  return ids;
}
