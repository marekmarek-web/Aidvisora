"use client";

import { useMemo, useState } from "react";
import { updateMemberCareer } from "@/app/actions/team";
import { listTracksForProgram, listCareerPositions } from "@/lib/career/registry";
import type { CareerProgramId, CareerTrackId } from "@/lib/career/types";
import { CAREER_PROGRAM_LABELS, CAREER_TRACK_LABELS } from "@/lib/career/types";

const NONE = "__none__";

const SELECTABLE_PROGRAMS: CareerProgramId[] = ["beplan", "premium_brokers"];

type Props = {
  membershipId: string;
  /** Kanonický program z DB (beplan / premium_brokers) nebo null */
  initialProgram: string | null;
  initialTrack: string | null;
  initialPosition: string | null;
  careerHasLegacyProgram: boolean;
  tenantDefaultProgram: string | null;
  onSaved?: () => void;
};

function resolveInitialProgram(p: string | null, defaultP: string | null): CareerProgramId | typeof NONE {
  if (p && SELECTABLE_PROGRAMS.includes(p as CareerProgramId)) return p as CareerProgramId;
  if (defaultP === "beplan" || defaultP === "premium_brokers") return defaultP;
  return NONE;
}

function buildInitialState(props: Props) {
  const program = resolveInitialProgram(props.initialProgram, props.tenantDefaultProgram);
  let track: string = NONE;
  if (program !== NONE && props.initialTrack && props.initialTrack !== "not_set") {
    const allowedT = listTracksForProgram(program);
    if (allowedT.includes(props.initialTrack as CareerTrackId)) track = props.initialTrack;
  }
  let position: string = NONE;
  if (program !== NONE && track !== NONE && props.initialPosition) {
    const defs = listCareerPositions(program, track as CareerTrackId);
    if (defs.some((d) => d.code === props.initialPosition)) position = props.initialPosition;
  }
  return { program, track, position };
}

export function TeamMemberCareerFields({
  membershipId,
  initialProgram,
  initialTrack,
  initialPosition,
  careerHasLegacyProgram,
  tenantDefaultProgram,
  onSaved,
}: Props) {
  const initial = useMemo(
    () => buildInitialState({ membershipId, initialProgram, initialTrack, initialPosition, careerHasLegacyProgram, tenantDefaultProgram }),
    [membershipId, initialProgram, initialTrack, initialPosition, careerHasLegacyProgram, tenantDefaultProgram]
  );

  const [program, setProgram] = useState<string>(initial.program);
  const [track, setTrack] = useState<string>(initial.track);
  const [position, setPosition] = useState<string>(initial.position);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tracks = useMemo(() => {
    if (program === NONE) return [];
    return listTracksForProgram(program as CareerProgramId);
  }, [program]);

  const positions = useMemo(() => {
    if (program === NONE || track === NONE) return [];
    return listCareerPositions(program as CareerProgramId, track as CareerTrackId);
  }, [program, track]);

  async function handleSave() {
    setMessage(null);
    setSaving(true);
    try {
      const res = await updateMemberCareer(membershipId, {
        careerProgram: program === NONE ? null : program,
        careerTrack: track === NONE ? null : track,
        careerPositionCode: position === NONE ? null : position,
      });
      if (!res.ok) {
        setMessage(res.error ?? "Uložení se nezdařilo.");
        return;
      }
      setMessage("Uloženo.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-[color:var(--wp-surface-card-border)] space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--wp-text-tertiary)]">
        Kariéra (program / větev / pozice)
      </p>
      {careerHasLegacyProgram ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          V databázi je starý formát programu — vyberte znovu <strong>Beplan</strong> nebo <strong>Premium Brokers</strong> a větev.
        </p>
      ) : null}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <select
          value={program}
          onChange={(e) => {
            setProgram(e.target.value);
            setTrack(NONE);
            setPosition(NONE);
            setMessage(null);
          }}
          className="min-w-[160px] px-3 py-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-sm font-medium"
        >
          <option value={NONE}>— Program —</option>
          {SELECTABLE_PROGRAMS.map((id) => (
            <option key={id} value={id}>
              {CAREER_PROGRAM_LABELS[id]}
            </option>
          ))}
        </select>
        <select
          value={track}
          onChange={(e) => {
            setTrack(e.target.value);
            setPosition(NONE);
            setMessage(null);
          }}
          disabled={program === NONE}
          className="min-w-[200px] px-3 py-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-sm font-medium disabled:opacity-50"
        >
          <option value={NONE}>— Větev —</option>
          {tracks.map((tid) => (
            <option key={tid} value={tid}>
              {CAREER_TRACK_LABELS[tid]}
            </option>
          ))}
        </select>
        <select
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            setMessage(null);
          }}
          disabled={program === NONE || track === NONE}
          className="min-w-[220px] px-3 py-2 rounded-xl border border-[color:var(--wp-surface-card-border)] bg-[color:var(--wp-surface-card)] text-sm font-medium disabled:opacity-50"
        >
          <option value={NONE}>— Pozice —</option>
          {positions.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label} ({p.code})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 min-h-[40px]"
        >
          {saving ? "Ukládám…" : "Uložit kariéru"}
        </button>
      </div>
      {message ? <p className="text-xs text-[color:var(--wp-text-secondary)]">{message}</p> : null}
    </div>
  );
}
