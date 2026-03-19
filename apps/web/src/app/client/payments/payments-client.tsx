"use client";

import { useMemo, useState } from "react";
import { QrCode } from "lucide-react";
import type { PaymentInstruction } from "@/app/actions/payment-pdf";
import { segmentLabel } from "@/app/lib/segment-labels";
import { QrPaymentModal } from "../QrPaymentModal";

type ClientPaymentsViewProps = {
  paymentInstructions: PaymentInstruction[];
};

function formatPaymentAmount(instruction: PaymentInstruction): string {
  const amount = Number(instruction.amount ?? "");
  if (Number.isFinite(amount) && amount > 0) {
    const suffix = instruction.frequency ? ` / ${instruction.frequency}` : "";
    return `${amount.toLocaleString("cs-CZ")} Kč${suffix}`;
  }
  if (instruction.note?.trim()) return instruction.note;
  return "Dle smlouvy";
}

export function ClientPaymentsView({ paymentInstructions }: ClientPaymentsViewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedPayment = useMemo(() => {
    if (selectedIndex == null) return null;
    const payment = paymentInstructions[selectedIndex];
    if (!payment) return null;

    return {
      partnerName: payment.partnerName,
      productName: payment.productName,
      accountNumber: payment.accountNumber,
      amountLabel: formatPaymentAmount(payment),
      variableSymbol: payment.variableSymbol || payment.contractNumber || null,
      note: payment.note || null,
    };
  }, [selectedIndex, paymentInstructions]);

  return (
    <div className="space-y-8 client-fade-in">
      <div>
        <h2 className="text-3xl font-display font-black text-slate-900 tracking-tight">
          Platby a příkazy
        </h2>
        <p className="text-sm font-medium text-slate-500 mt-2">
          Přehled aktivních platebních údajů napojených na vaše produkty.
        </p>
      </div>

      {paymentInstructions.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-10 text-center">
          <p className="text-slate-500 font-medium">
            Žádné aktivní platební údaje nejsou momentálně dostupné.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Produkt
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Částka
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Číslo účtu
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Var. symbol
                    </th>
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentInstructions.map((instruction, index) => (
                    <tr
                      key={`${instruction.accountNumber}-${index}`}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold text-slate-900 text-sm">
                          {instruction.productName || segmentLabel(instruction.segment)}
                        </p>
                        <p className="text-xs font-medium text-slate-500">
                          {instruction.partnerName}
                        </p>
                      </td>
                      <td className="px-6 py-5 font-black text-slate-800">
                        {formatPaymentAmount(instruction)}
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-600 font-mono">
                        {instruction.accountNumber}
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-600">
                        {instruction.variableSymbol || instruction.contractNumber || "—"}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          onClick={() => setSelectedIndex(index)}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest transition-colors inline-flex items-center gap-2 min-h-[44px]"
                        >
                          <QrCode size={16} />
                          QR Platba
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {paymentInstructions.map((instruction, index) => (
              <div
                key={`${instruction.accountNumber}-${index}`}
                className="bg-white rounded-[20px] border border-slate-100 shadow-sm p-4"
              >
                <p className="text-sm font-black text-slate-900">
                  {instruction.productName || segmentLabel(instruction.segment)}
                </p>
                <p className="text-xs text-slate-500 font-medium mb-3">
                  {instruction.partnerName}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <p>
                    <span className="block text-slate-400 font-black uppercase tracking-wider">
                      Částka
                    </span>
                    <span className="text-slate-800 font-bold">{formatPaymentAmount(instruction)}</span>
                  </p>
                  <p>
                    <span className="block text-slate-400 font-black uppercase tracking-wider">
                      VS
                    </span>
                    <span className="text-slate-800 font-bold">
                      {instruction.variableSymbol || instruction.contractNumber || "—"}
                    </span>
                  </p>
                </div>
                <p className="text-xs mt-3">
                  <span className="text-slate-400 font-black uppercase tracking-wider block">
                    Číslo účtu
                  </span>
                  <span className="text-slate-700 font-mono">{instruction.accountNumber}</span>
                </p>
                <button
                  onClick={() => setSelectedIndex(index)}
                  className="mt-4 w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest transition-colors inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <QrCode size={16} />
                  QR Platba
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <QrPaymentModal
        open={selectedIndex != null}
        onClose={() => setSelectedIndex(null)}
        payment={selectedPayment}
      />
    </div>
  );
}
