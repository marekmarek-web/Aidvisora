"use client";

import { Edit2 } from "lucide-react";
import { CreateActionButton } from "@/app/components/ui/CreateActionButton";

export function ContactDetailEditButton({ contactId }: { contactId: string }) {
  return (
    <CreateActionButton
      href={`/portal/contacts/${contactId}/edit`}
      icon={Edit2}
      className="min-h-[44px] px-5 py-2 text-xs font-black uppercase tracking-widest shadow-lg"
    >
      Upravit
    </CreateActionButton>
  );
}
