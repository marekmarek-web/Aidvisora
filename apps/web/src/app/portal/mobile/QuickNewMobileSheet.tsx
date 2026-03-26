"use client";

import { BottomSheet } from "@/app/shared/mobile-ui/primitives";
import { QuickActionsMenuContent } from "@/app/portal/quick-new-ui";

export function QuickNewMobileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Nový">
      <p className="text-xs text-[color:var(--wp-text-secondary)] px-0.5 mb-2 leading-snug">
        Sken dokumentu (více stran do jednoho PDF) najdete v této nabídce níže u položky „Skenovat dokument“.
      </p>
      <QuickActionsMenuContent variant="sheet" onClose={onClose} />
    </BottomSheet>
  );
}
