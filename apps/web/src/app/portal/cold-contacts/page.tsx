import type { Metadata } from "next";
import { getCallsReport } from "@/app/actions/events";
import { ColdContactsClient } from "./ColdContactsClient";

export const metadata: Metadata = {
  title: "Studené kontakty",
  description: "Přehled studených kontaktů a telefonátů.",
};

export default async function ColdContactsPage() {
  const calls = await getCallsReport();
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Studené kontakty</h1>
      <ColdContactsClient initialCalls={calls} />
    </div>
  );
}
