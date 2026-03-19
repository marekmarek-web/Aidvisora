function bytesMatch(input: Uint8Array, signature: number[], offset = 0) {
  if (input.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (input[offset + i] !== signature[i]) return false;
  }
  return true;
}

export async function detectMagicMimeType(file: File): Promise<string | null> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 64));

  if (bytesMatch(bytes, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (bytesMatch(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytesMatch(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";

  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";

  // HEIC/HEIF family: ISO BMFF with "ftyp" box and compatible brand
  const ftyp = String.fromCharCode(...bytes.slice(4, 8));
  if (ftyp === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }

  return null;
}

export function mimeMatchesAllowedSignature(expectedMime: string, detectedMime: string | null) {
  if (!detectedMime) return false;
  if (expectedMime === detectedMime) return true;

  // Allow HEIF/HEIC interchange for clients that report one of variants.
  if ((expectedMime === "image/heif" || expectedMime === "image/heic") && detectedMime === "image/heic") {
    return true;
  }

  return false;
}
