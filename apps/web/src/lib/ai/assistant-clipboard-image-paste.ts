/**
 * Shared clipboard image detection for AI assistant composers (drawer + mobile screen).
 *
 * Client debug logs (console): localStorage.setItem("aidvisora_debug_assistant_image","1")
 *   or NEXT_PUBLIC_DEBUG_ASSISTANT_IMAGE_PASTE=true
 * Server logs: DEBUG_ASSISTANT_IMAGE_PASTE=true on POST /api/ai/assistant/chat
 */

export function assistantImagePastePipelineDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (process.env.NEXT_PUBLIC_DEBUG_ASSISTANT_IMAGE_PASTE === "true") return true;
    return window.localStorage.getItem("aidvisora_debug_assistant_image") === "1";
  } catch {
    return false;
  }
}

export function logAssistantImagePipelineClient(step: string, payload: Record<string, unknown>): void {
  if (!assistantImagePastePipelineDebugEnabled()) return;
  console.log(`[assistant-image-pipeline][client:${step}]`, payload);
}

const DEFAULT_MAX_CLIPBOARD_IMAGES = 4;

function isImageFileLike(f: File): boolean {
  if (f.type && f.type.startsWith("image/")) return true;
  const n = f.name.toLowerCase();
  return /\.(heic|heif|jpg|jpeg|png|webp|gif|bmp|tiff?)$/i.test(n);
}

/** Try items first, then files (Safari). Only image/* MIME. */
export function extractImageBlobFromClipboardData(dataTransfer: DataTransfer): Blob | File | null {
  const multi = extractImageFilesFromClipboardData(dataTransfer, { max: 1 });
  return multi.files[0] ?? null;
}

export type ExtractClipboardImagesResult = {
  files: File[];
  /** True when more than `max` image files were present and list was capped. */
  truncated: boolean;
};

/**
 * All image files from the clipboard, up to `max` (default 4).
 * Order: clipboard items in sequence, then `files` not already included.
 */
export function extractImageFilesFromClipboardData(
  dataTransfer: DataTransfer,
  opts?: { max?: number },
): ExtractClipboardImagesResult {
  const max = opts?.max ?? DEFAULT_MAX_CLIPBOARD_IMAGES;
  const seen = new Set<string>();
  const all: File[] = [];

  const tryAdd = (f: File | null) => {
    if (!f || !isImageFileLike(f)) return;
    const key = `${f.name}:${f.size}:${f.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push(f);
  };

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") continue;
    const t = item.type || "";
    const f = item.getAsFile();
    if (!f) continue;
    if (t.startsWith("image/") || isImageFileLike(f)) tryAdd(f);
  }

  for (const f of Array.from(dataTransfer.files)) {
    tryAdd(f);
  }

  const truncated = all.length > max;
  return { files: all.slice(0, max), truncated };
}
