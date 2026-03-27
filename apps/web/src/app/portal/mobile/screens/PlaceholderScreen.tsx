"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { MobileCard } from "@/app/shared/mobile-ui/primitives";
import { portalPrimaryButtonClassName } from "@/lib/ui/create-action-button-styles";

export function PlaceholderScreen({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const router = useRouter();
  return (
    <div className="space-y-4 pt-2">
      <MobileCard className="p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 mx-auto flex items-center justify-center">
          <Icon size={28} className="text-indigo-600" />
        </div>
        <h2 className="text-lg font-black text-[color:var(--wp-text)]">{title}</h2>
        <p className="text-sm text-[color:var(--wp-text-secondary)] leading-relaxed">{description}</p>
        <p className="text-xs text-[color:var(--wp-text-secondary)]">
          Plná verze této sekce je dostupná v desktopovém prohlížeči. Mobilní rozhraní se doplňuje postupně.
        </p>
        <button
          type="button"
          onClick={() => router.push("/portal/today")}
          className={clsx(portalPrimaryButtonClassName, "w-full min-h-[48px] text-sm font-black")}
        >
          Zpět na nástěnku
        </button>
      </MobileCard>
    </div>
  );
}
