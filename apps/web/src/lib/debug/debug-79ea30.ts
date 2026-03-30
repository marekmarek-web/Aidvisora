export async function debugLog79ea30(input: {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId: string;
  hypothesisId: string;
}) {
  const payload = {
    sessionId: "79ea30",
    ...input,
    timestamp: Date.now(),
  };

  // Produkce / Vercel: žádný ingest na Cursor stroji — log jde do Runtime Logs (grep `AIDV_DEBUG_79ea30`).
  // Lokální dev: stejný řádek + best-effort POST do Cursor ingest (naplní debug-79ea30.log).
  // #region agent log
  console.error(`AIDV_DEBUG_79ea30 ${JSON.stringify(payload)}`);
  try {
    const ctrl = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(500) : undefined;
    await fetch("http://127.0.0.1:7387/ingest/30869546-c4c0-4805-9fd6-2bc75f3b0175", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "79ea30",
      },
      body: JSON.stringify(payload),
      signal: ctrl,
    });
  } catch {
    // ignore ingest failures (typické na Vercelu)
  }
  // #endregion
}
