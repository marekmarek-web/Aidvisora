import { NextResponse } from "next/server";

/**
 * Android App Links handshake — Play requires a file served at
 * `/.well-known/assetlinks.json` with `application/json`, no redirects.
 *
 * Protože `.well-known` v App Routeru je problematické (segment začíná tečkou),
 * servírujeme z `/api/assetlinks` a přes `rewrite` v `next.config.js` to
 * namapujeme na `/.well-known/assetlinks.json`.
 *
 * Konfigurace:
 *  - `ANDROID_PACKAGE_NAME` (default `cz.aidvisora.app`)
 *  - `ANDROID_SHA256_FINGERPRINTS` — čárkou oddělené `AA:BB:CC:...` fingerprinty
 *     (release signing cert + Play App Signing upload + ladící build). Bez nich
 *     vracíme prázdné pole, aby validator nespadl na parse erroru.
 *
 * Viz `docs/android/APP-LINKS.md` (bude doplněno).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PACKAGE = "cz.aidvisora.app";

function parseFingerprints(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(v));
}

function buildAssetLinks(): unknown {
  const pkg = process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE;
  const fingerprints = parseFingerprints(process.env.ANDROID_SHA256_FINGERPRINTS);
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export async function GET() {
  return new NextResponse(JSON.stringify(buildAssetLinks()), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
