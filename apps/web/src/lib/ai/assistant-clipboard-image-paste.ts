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

/** Try items first, then files (Safari). Only image/* MIME. */
export function extractImageBlobFromClipboardData(dataTransfer: DataTransfer): Blob | File | null {
  const items = Array.from(dataTransfer.items);
  let blob: File | Blob | null =
    items.find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile() ?? null;
  if (!blob) {
    blob = Array.from(dataTransfer.files).find((f) => f.type.startsWith("image/")) ?? null;
  }
  return blob;
}
