/**
 * Compute a SHA-256 fingerprint for a document file.
 * Used for deduplication and audit trail.
 */

export async function computeDocumentFingerprint(content: ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  if (content instanceof ArrayBuffer) {
    buffer = content;
  } else {
    const copy = new Uint8Array(content.byteLength);
    copy.set(content);
    buffer = copy.buffer as ArrayBuffer;
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
