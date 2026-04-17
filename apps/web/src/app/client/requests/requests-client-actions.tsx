"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewRequestModal } from "../NewRequestModal";

export function RequestsPageClientActions({ serviceRequestsEnabled = true }: { serviceRequestsEnabled?: boolean }) {
  const [open, setOpen] = useState(false);

  if (!serviceRequestsEnabled) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 inline-flex items-center gap-2 min-h-[44px]"
      >
        <Plus size={18} />
        Nový požadavek
      </button>
      <NewRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
