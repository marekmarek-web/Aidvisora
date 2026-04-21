import { NextResponse } from "next/server";

/**
 * Universal Links handshake — Apple vyžaduje soubor na
 * `/.well-known/apple-app-site-association` jako `application/json` bez
 * přípony a bez redirectů.
 *
 * Next.js App Router nemá rád route-segment, který začíná tečkou (`.well-known`),
 * takže obsah generujeme zde v běžné `/api/...` cestě a přepneme přes rewrite
 * v `next.config.js`:
 *
 *   /.well-known/apple-app-site-association
 *     → /api/apple-app-site-association
 *
 * Decision doc: `docs/ios/UNIVERSAL-LINKS.md`.
 *
 * Team ID plníme z `APPLE_TEAM_ID` env. Dokud není vyplněný, vrátíme prázdný
 * `applinks.details`, aby Apple handshake prošel (pouze bez efektu), a
 * nezpůsobili jsme tím hlášené parsing errory v validátoru.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUNDLE_ID = "cz.aidvisora.app";

function buildAasa(): Record<string, unknown> {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const details = teamId
    ? [
        {
          appIDs: [`${teamId}.${BUNDLE_ID}`],
          components: [
            { "/": "/portal/*", comment: "Advisor portal deep links" },
            { "/": "/client/*", comment: "Client portal deep links" },
            { "/": "/auth/*", comment: "Auth callbacks (OAuth, invite accept)" },
            // Marketing + legal zůstávají v Safari (exclude z universal linku).
            { "/": "/pricing", exclude: true },
            { "/": "/terms", exclude: true },
            { "/": "/privacy", exclude: true },
            { "/": "/cookies", exclude: true },
            { "/": "/beta-terms", exclude: true },
          ],
        },
      ]
    : [];
  return {
    applinks: { details },
    webcredentials: teamId ? { apps: [`${teamId}.${BUNDLE_ID}`] } : { apps: [] },
  };
}

export async function GET() {
  return new NextResponse(JSON.stringify(buildAasa()), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
