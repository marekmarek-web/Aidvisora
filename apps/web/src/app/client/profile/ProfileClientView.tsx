"use client";

import { useMemo, useState, useTransition } from "react";
import { Baby, Heart, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { clientUpdateProfile } from "@/app/actions/contacts";
import type { ClientHouseholdDetail } from "@/app/actions/households";
import { AddFamilyMemberModal } from "../AddFamilyMemberModal";

type ProfileClientViewProps = {
  profile: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
  };
  household: ClientHouseholdDetail | null;
};

export function ProfileClientView({ profile, household }: ProfileClientViewProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: profile.email || "",
    phone: profile.phone || "",
    street: profile.street || "",
    city: profile.city || "",
    zip: profile.zip || "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [familyModalOpen, setFamilyModalOpen] = useState(false);

  const initials = useMemo(
    () =>
      `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "K",
    [profile.firstName, profile.lastName]
  );

  function saveProfile() {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await clientUpdateProfile(form);
        setSaved(true);
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Profil se nepodařilo uložit."
        );
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 client-fade-in">
      <div>
        <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">Můj profil</h2>
        <p className="text-slate-500 font-medium mt-1">Nastavení účtu a správa domácnosti.</p>
      </div>

      <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[24px] bg-slate-800 text-white flex items-center justify-center font-black text-2xl shadow-lg">
            {initials}
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-1">
              {profile.firstName} {profile.lastName}
            </h3>
            <p className="text-sm font-bold text-slate-500">{profile.email || "Bez e-mailu"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Telefon
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Ulice
            </label>
            <input
              type="text"
              value={form.street}
              onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                Město
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({ ...current, city: event.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                PSČ
              </label>
              <input
                type="text"
                value={form.zip}
                onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveProfile}
            disabled={isPending}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-600/20 transition-all min-h-[44px] disabled:opacity-50"
          >
            {isPending ? "Ukládám..." : "Uložit změny"}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-bold">Profil uložen.</span>}
          {error && <span className="text-sm text-rose-600 font-bold">{error}</span>}
        </div>
      </section>

      <section className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Heart size={20} className="text-rose-500" />
            Moje domácnost
          </h3>
          <button
            onClick={() => setFamilyModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all min-h-[44px]"
          >
            <Plus size={16} />
            Přidat člena
          </button>
        </div>
        <div className="p-8">
          {!household || household.members.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500 font-medium">
                Domácnost zatím neobsahuje žádné členy.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {household.members.map((member) => {
                const role = member.role?.toLowerCase() || "member";
                const roleLabel =
                  role === "child"
                    ? "Dítě"
                    : role === "partner"
                    ? "Partner"
                    : role === "primary"
                    ? "Hlavní člen"
                    : "Člen";

                return (
                  <div
                    key={member.id}
                    className="p-5 border border-slate-200 rounded-2xl flex items-center gap-4"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black ${
                        role === "child"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {role === "child" ? (
                        <Baby size={20} />
                      ) : (
                        `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {member.firstName} {member.lastName}
                      </h4>
                      <p className="text-xs font-bold text-slate-500">
                        {roleLabel}
                        {member.birthDate ? ` • ${new Date(member.birthDate).getFullYear()}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setFamilyModalOpen(true)}
                className="p-5 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors h-full min-h-[100px]"
              >
                <Plus size={24} className="mb-1" />
                <span className="text-xs font-black uppercase tracking-widest">
                  Narození dítěte / Svatba
                </span>
              </button>
            </div>
          )}
        </div>
      </section>

      <AddFamilyMemberModal
        open={familyModalOpen}
        onClose={() => setFamilyModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
