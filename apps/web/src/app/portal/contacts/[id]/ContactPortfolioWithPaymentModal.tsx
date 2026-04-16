"use client";

import { useState, useCallback } from "react";
import { ContactContractsOverview } from "./ContactContractsOverview";
import { ContactManualPaymentSection } from "./ContactManualPaymentSection";
import { ManualPaymentSetupModal } from "./ManualPaymentSetupModal";

export function ContactPortfolioWithPaymentModal({
  contactId,
  baseQueryNoTab,
}: {
  contactId: string;
  baseQueryNoTab: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <ContactContractsOverview
        contactId={contactId}
        baseQueryNoTab={baseQueryNoTab}
        onOpenPaymentModal={openModal}
      />

      <ContactManualPaymentSection
        key={refreshKey}
        contactId={contactId}
        onOpenModal={openModal}
      />

      {modalOpen && (
        <ManualPaymentSetupModal
          contactId={contactId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
