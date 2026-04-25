"use client";

import React from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Edit2,
  FileText,
  GripHorizontal,
  LayoutGrid,
  Pin,
  Plus,
  Sparkles,
  User,
} from "lucide-react";

import { LandingMockCanvas } from "./LandingMockCanvas";
import { LandingProductFrame } from "./LandingProductFrame";

type NoteCard = {
  id: number;
  type: string;
  typeColor: "blue" | "purple" | "rose" | "emerald" | "amber";
  title: string;
  client: string;
  date: string;
  content: string;
  nextSteps: string | null;
  isPinned: boolean;
};

const INITIAL_NOTES: NoteCard[] = [
  {
    id: 1,
    type: "HYPOTÉKA",
    typeColor: "blue",
    title: "Žádost o úvěr - Zíta",
    client: "Tomáš Zíta",
    date: "24. 4. 2026",
    content: "LTV 80 %, max. ručení nemovitostí rodičů. Klient má 1 500 000 Kč vlastní zdroje. Probrali jsme fixaci na 3 roky.",
    nextSteps: "Poslat podklady do KB ke schválení. Založit složku.",
    isPinned: true,
  },
  {
    id: 2,
    type: "JINÉ",
    typeColor: "purple",
    title: "Příprava na audit",
    client: "Obecný zápisek",
    date: "25. 4. 2026",
    content: "Doplnit chybějící AML dotazníky u top 10 klientů. Zkontrolovat platnost občanek.",
    nextSteps: null,
    isPinned: false,
  },
  {
    id: 3,
    type: "ŽIVOTNÍ POJIŠTĚNÍ",
    typeColor: "rose",
    title: "Návrh krytí pro rodinu",
    client: "Marek Marek",
    date: "22. 4. 2026",
    content: "Chybí invalidita 3. stupně. Navrhnout navýšení v rámci stávajícího IŽP.",
    nextSteps: "Ověřit zdravotní dotazník před schůzkou.",
    isPinned: false,
  },
  {
    id: 4,
    type: "INVESTICE",
    typeColor: "emerald",
    title: "Rebalancování portfolia",
    client: "Lucie Bílá",
    date: "20. 4. 2026",
    content: "Klientka chce přejít na konzervativnější strategii (blíží se důchodový věk). Přesun z akciového do dluhopisového fondu.",
    nextSteps: null,
    isPinned: false,
  },
  {
    id: 5,
    type: "PENZIJNÍ SPOŘENÍ",
    typeColor: "amber",
    title: "Založení DIPu",
    client: "Jan Novák",
    date: "18. 4. 2026",
    content: "Připravit srovnání DIP a klasického DPS. Daňová úspora 48 000 Kč ročně.",
    nextSteps: "Zavolat v pátek a potvrdit založení.",
    isPinned: false,
  },
];

function getTagColors(color: NoteCard["typeColor"]) {
  const colors = {
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    purple: "border-purple-100 bg-purple-50 text-purple-600",
    rose: "border-rose-100 bg-rose-50 text-rose-600",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-600",
    amber: "border-amber-100 bg-amber-50 text-amber-600",
  } as const;

  return colors[color] ?? colors.blue;
}

export function NotesBoardDemo() {
  const [notes, setNotes] = React.useState(INITIAL_NOTES);
  const [draggedNoteId, setDraggedNoteId] = React.useState<number | null>(null);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggedNoteId(id);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedNoteId(null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: number) => {
    event.preventDefault();
    if (draggedNoteId === null || draggedNoteId === targetId) return;

    setNotes((current) => {
      const draggedIndex = current.findIndex((note) => note.id === draggedNoteId);
      const targetIndex = current.findIndex((note) => note.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      const temp = next[draggedIndex];
      next[draggedIndex] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
    setDraggedNoteId(null);
  };

  return (
    <LandingProductFrame label="Zápisky · nástěnka" status={`${notes.length} zápisků`} statusTone="indigo">
      <LandingMockCanvas className="bg-[#F8FAFC]">
        <div className="min-h-full bg-[#F8FAFC] pb-20 font-inter text-slate-800">
          <style>{`
            .font-jakarta { font-family: var(--font-jakarta), var(--font-primary), -apple-system, BlinkMacSystemFont, sans-serif; }
            .font-inter { font-family: var(--font-primary), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .custom-dots {
              background-image: radial-gradient(#CBD5E1 1px, transparent 1px);
              background-size: 32px 32px;
              background-position: -16px -16px;
            }
            .masonry-grid {
              column-count: 1;
              column-gap: 1.5rem;
            }
            @media (min-width: 768px) {
              .masonry-grid { column-count: 2; }
            }
            @media (min-width: 1024px) {
              .masonry-grid { column-count: 3; }
            }
            .masonry-item {
              break-inside: avoid;
              margin-bottom: 1.5rem;
            }
            .note-card {
              transition: all 0.2s ease;
            }
            .note-card.dragging {
              transform: scale(0.98);
              box-shadow: 0 0 0 2px #5A4BFF;
            }
          `}</style>

          <div className="custom-dots h-full px-6 pt-8 lg:px-10">
            <div className="mx-auto max-w-[1600px]">
              <header className="sticky top-4 z-50 mb-10 flex items-center justify-between gap-6 rounded-[24px] border border-slate-200/60 bg-white/50 p-4 shadow-sm backdrop-blur-xl">
                <div className="flex items-center gap-4 pl-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-100/50 bg-indigo-50 text-indigo-600">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h1 className="font-jakarta text-xl font-extrabold leading-tight text-[#0B1021]">Zápisky</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nástěnka zápisků</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-jakarta font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50">
                    <LayoutGrid size={16} className="text-slate-400" /> Uspořádat
                  </button>
                  <button className="group flex items-center gap-2 rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-5 py-3 text-sm font-jakarta font-bold text-fuchsia-700 shadow-sm transition-all hover:bg-fuchsia-100">
                    <Sparkles size={16} className="text-fuchsia-500 transition-transform group-hover:rotate-12" /> AI Sumarizace
                  </button>
                  <button className="flex items-center gap-2 rounded-xl bg-[#0B1021] px-6 py-3 text-sm font-jakarta font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-lg">
                    <Plus size={18} strokeWidth={2.5} /> NOVÝ ZÁPIS
                  </button>
                </div>
              </header>

              <div className="masonry-grid pb-20">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, note.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(event) => handleDrop(event, note.id)}
                    className={`masonry-item note-card cursor-grab rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
                      draggedNoteId === note.id ? "dragging" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
                      <GripHorizontal size={16} className="text-slate-300 transition-colors hover:text-slate-500" />
                      <div className="flex items-center gap-1.5">
                        <button className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Navázat na obchod">
                          <Briefcase size={14} />
                        </button>
                        <button className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Upravit">
                          <Edit2 size={14} />
                        </button>
                        <button
                          className={`rounded-md p-1.5 transition-colors ${
                            note.isPinned ? "bg-amber-50 text-amber-500 hover:bg-amber-100" : "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                          }`}
                          title="Připnout"
                        >
                          <Pin size={14} className={note.isPinned ? "fill-amber-500" : ""} />
                        </button>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <span
                          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${getTagColors(note.typeColor)}`}
                        >
                          <LayoutGrid size={10} /> {note.type}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <Calendar size={12} /> {note.date}
                        </span>
                      </div>

                      <div className="mb-4">
                        <h3 className="mb-2 font-jakarta text-[17px] font-extrabold leading-snug text-[#0B1021]">{note.title}</h3>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <User size={12} /> {note.client}
                        </div>
                      </div>

                      <p className="mb-4 text-[13px] font-medium leading-relaxed text-slate-600">{note.content}</p>

                      {note.nextSteps ? (
                        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-amber-500" />
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-amber-600">Další kroky</span>
                          </div>
                          <p className="text-[12px] font-semibold leading-snug text-amber-900/80">{note.nextSteps}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </LandingMockCanvas>
    </LandingProductFrame>
  );
}

export default NotesBoardDemo;
