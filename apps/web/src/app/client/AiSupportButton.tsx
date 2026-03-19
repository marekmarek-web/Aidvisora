"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

export function AiSupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="group relative p-[2.5px] rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-900/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <span className="bg-white rounded-full px-5 py-2.5 flex items-center justify-center gap-2">
            <Sparkles size={16} className="text-purple-500" />
            <span className="font-black text-slate-800 text-sm tracking-wide">AI Podpora</span>
          </span>
        </button>
      ) : (
        <div className="w-[320px] max-w-[calc(100vw-24px)] bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 client-scale-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" />
              <h3 className="font-black text-slate-900 text-sm">AI Podpora</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Zavřít AI panel"
            >
              <X size={15} />
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            AI režim je připraven jako integrační bod. Pro řešení požadavků můžete
            zatím kontaktovat poradce.
          </p>
          <div className="flex gap-2">
            <Link
              href="/client/messages"
              className="flex-1 text-center px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              Napsat poradci
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
