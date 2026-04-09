import { getCareerPositionDef, isKnownCareerTrackId, normalizeCareerProgramFromDb } from "./registry";
import type { CareerTrackId } from "./types";

export type CareerWritePayload = {
  careerProgram: string | null;
  careerTrack: string | null;
  careerPositionCode: string | null;
};

const NONE = new Set(["", "__none__", "not_set"]);

function empty(v: string | null | undefined): boolean {
  return v == null || NONE.has(v.trim());
}

/**
 * Validace a normalizace zápisu kariérních polí do memberships.
 * Povolené kanonické programy: beplan, premium_brokers nebo vše prázdné.
 */
export function validateCareerFieldsForWrite(
  programRaw: string | null | undefined,
  trackRaw: string | null | undefined,
  positionRaw: string | null | undefined
): { ok: true; data: CareerWritePayload } | { ok: false; error: string } {
  const p = programRaw?.trim() ?? "";
  const t = trackRaw?.trim() ?? "";
  const pos = positionRaw?.trim() ?? "";

  if (empty(p) && empty(t) && empty(pos)) {
    return { ok: true, data: { careerProgram: null, careerTrack: null, careerPositionCode: null } };
  }

  if (empty(p)) {
    return { ok: false, error: "Vyberte kariérní program, nebo vymažte všechna pole." };
  }

  const { programId, legacyRaw } = normalizeCareerProgramFromDb(p);
  if (programId === "unknown" || programId === "not_set") {
    return { ok: false, error: "Neplatný kariérní program. Povolené hodnoty: beplan, premium_brokers." };
  }
  if (legacyRaw) {
    return {
      ok: false,
      error: "Uložte kanonický program (beplan / premium_brokers), ne legacy hodnotu zastaralého formátu.",
    };
  }

  if (empty(t)) {
    if (!empty(pos)) {
      return { ok: false, error: "Bez kariérní větve nelze uložit pozici." };
    }
    return {
      ok: true,
      data: {
        careerProgram: programId,
        careerTrack: null,
        careerPositionCode: null,
      },
    };
  }

  if (!isKnownCareerTrackId(t) || t === "not_set" || t === "unknown") {
    return { ok: false, error: "Neplatná kariérní větev." };
  }

  const trackId = t as CareerTrackId;

  if (empty(pos)) {
    return {
      ok: true,
      data: {
        careerProgram: programId,
        careerTrack: trackId,
        careerPositionCode: null,
      },
    };
  }

  const def = getCareerPositionDef(programId, trackId, pos);
  if (!def) {
    return { ok: false, error: "Zvolená pozice nepatří do kombinace program + větev." };
  }

  return {
    ok: true,
    data: {
      careerProgram: programId,
      careerTrack: trackId,
      careerPositionCode: def.code,
    },
  };
}
