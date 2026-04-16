"use client";

import { useState, useCallback } from "react";
import { ContactContractsOverview } from "./ContactContractsOverview";
import { ManualPaymentSetupModal, type ManualPaymentSetupPrefill } from "./ManualPaymentSetupModal";

export function ContactPortfolioWithPaymentModal({
  contactId,
  baseQueryNoTab,
}: {
  contactId: string;
  baseQueryNoTab: string;
}) {
  const [modalPrefill, setModalPrefill] = useState<ManualPaymentSetupPrefill | undefined>();
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback((prefill?: ManualPaymentSetupPrefill) => {
    setModalPrefill(prefill);
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  function handleSaved() {
    setModalOpen(false);
  }

  return (
    <>
      <ContactContractsOverview
        contactId={contactId}
        baseQueryNoTab={baseQueryNoTab}
        onOpenPaymentModal={openModal}
      />

      {modalOpen && (
        <ManualPaymentSetupModal
          contactId={contactId}
          onClose={closeModal}
          onSaved={handleSaved}
          prefill={modalPrefill}
        />
      )}
    </>
  );
}
