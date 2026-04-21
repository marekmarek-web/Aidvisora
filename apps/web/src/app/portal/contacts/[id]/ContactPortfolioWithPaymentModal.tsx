"use client";

import { useState, useCallback } from "react";
import { ContactContractsOverview } from "./ContactContractsOverview";
import { ContactManualPaymentSection, type PaymentSetupRow } from "./ContactManualPaymentSection";
import {
  ManualPaymentSetupModal,
  type ManualPaymentSetupPrefill,
  type ManualPaymentSetupEdit,
} from "./ManualPaymentSetupModal";

export function ContactPortfolioWithPaymentModal({
  contactId,
  baseQueryNoTab,
}: {
  contactId: string;
  baseQueryNoTab: string;
}) {
  const [modalPrefill, setModalPrefill] = useState<ManualPaymentSetupPrefill | undefined>();
  const [modalEdit, setModalEdit] = useState<ManualPaymentSetupEdit | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  const openModal = useCallback((prefill?: ManualPaymentSetupPrefill) => {
    setModalEdit(undefined);
    setModalPrefill(prefill);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((row: PaymentSetupRow) => {
    setModalPrefill(undefined);
    setModalEdit({
      id: row.id,
      providerName: row.providerName,
      productName: row.productName,
      segment: row.segment,
      variableSymbol: row.variableSymbol,
      accountNumber: row.accountNumber,
      bankCode: row.bankCode,
      iban: row.iban,
      constantSymbol: row.constantSymbol,
      specificSymbol: row.specificSymbol,
      amount: row.amount,
      currency: row.currency,
      frequency: row.frequency,
      firstPaymentDate: row.firstPaymentDate,
      visibleToClient: row.visibleToClient,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  function handleSaved() {
    setModalOpen(false);
    setPaymentRefreshKey((k) => k + 1);
  }

  return (
    <>
      <ContactContractsOverview
        contactId={contactId}
        baseQueryNoTab={baseQueryNoTab}
        onOpenPaymentModal={openModal}
      />

      <ContactManualPaymentSection
        key={paymentRefreshKey}
        contactId={contactId}
        onOpenModal={() => openModal()}
        onEditSetup={openEditModal}
      />

      {modalOpen && (
        <ManualPaymentSetupModal
          contactId={contactId}
          onClose={closeModal}
          onSaved={handleSaved}
          prefill={modalPrefill}
          editSetup={modalEdit}
        />
      )}
    </>
  );
}
