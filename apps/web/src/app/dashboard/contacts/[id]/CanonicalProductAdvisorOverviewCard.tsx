"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ElementType, type ReactNode } from "react";
import type { ContractRow, ContractAiProvenanceResult } from "@/app/actions/contracts";
import type { CanonicalProduct } from "@/lib/client-portfolio/canonical-contract-read";
import { ContractPendingFieldsGuard } from "./ContractPendingFieldsGuard";
import { ContractProvenanceLine } from "@/app/components/aidvisora/ContractProvenanceLine";
import { ZpRatingBadge } from "@/app/components/aidvisora/ZpRatingBadge";
import { advisorPrimaryAmountPresentation } from "./advisor-product-overview-format";
import {
  canonicalPortfolioDetailRows,
  resolvePortalFundLogoPath,
} from "@/lib/client-portfolio/portal-portfolio-display";
import {
  Building2,
  Briefcase,
  Car,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileCheck,
  FileText,
  Home,
  Landmark,
  PiggyBank,
  Plane,
  Shield,
  TrendingUp,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function personRoleLabelCs(role: string): string {
  const m: Record<string, string> = {
    policyholder: "Pojistník",
    insured: "Pojištěný",
    beneficiary: "Oprávněná osoba",
    child: "Dítě",
    other: "Osoba",
  };
  return m[role] ?? "Osoba";
}

function AccordionRow({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: ElementType;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface-muted)]/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)] min-h-[44px]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-indigo-500" aria-hidden />
          <span className="truncate">{title}</span>
        </span>
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
      </button>
      {open ? (
        <div className="px-3 pb-3 pt-0 text-sm text-[color:var(--wp-text)] space-y-2 border-t border-[color:var(--wp-border-muted)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function productIcon(segment: string): LucideIcon {
  switch (segment) {
    case "INV":
    case "DIP":
      return TrendingUp;
    case "DPS":
      return PiggyBank;
    case "HYPO":
    case "UVER":
      return CreditCard;
    case "ZP":
      return Shield;
    case "MAJ":
    case "ODP":
      return Home;
    case "AUTO_PR":
    case "AUTO_HAV":
      return Car;
    case "CEST":
      return Plane;
    case "FIRMA_POJ":
      return Building2;
    default:
      return Briefcase;
  }
}

function initialsFromPartner(product: CanonicalProduct): string {
  return (product.partnerName ?? product.productName ?? "?")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export type CanonicalProductAdvisorOverviewCardProps = {
  contactId: string;
  contract: ContractRow;
  product: CanonicalProduct;
  provenance: ContractAiProvenanceResult | undefined;
  variant: "published" | "pending";
  onEdit: () => void;
  onDelete: () => void;
  onApproveForClient?: () => void;
  publishBusy?: boolean;
};

export function CanonicalProductAdvisorOverviewCard({
  contactId,
  contract,
  product,
  provenance,
  variant,
  onEdit,
  onDelete,
  onApproveForClient,
  publishBusy,
}: CanonicalProductAdvisorOverviewCardProps) {
  const primary = advisorPrimaryAmountPresentation(product, contract);
  const logoPath = resolvePortalFundLogoPath(product);
  const LeadIcon = productIcon(contract.segment);
  const logoAlt =
    product.segmentDetail?.kind === "investment" && product.segmentDetail.fundName
      ? `Logo fondu ${product.segmentDetail.fundName}`
      : "Logo instituce";
  const d = product.segmentDetail;
  const detailRows = !d ? canonicalPortfolioDetailRows(product) : [];

  const life = d?.kind === "life_insurance" ? d : null;
  const inv = d?.kind === "investment" ? d : null;
  const pen = d?.kind === "pension" ? d : null;
  const veh = d?.kind === "vehicle" ? d : null;
  const prop = d?.kind === "property" ? d : null;
  const loan = d?.kind === "loan" ? d : null;

  return (
    <article className="rounded-[var(--wp-radius-lg)] border border-[color:var(--wp-border)] bg-[color:var(--wp-surface)] p-4 shadow-sm flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        {logoPath ? (
          <div className="size-11 rounded-xl bg-[color:var(--wp-surface-muted)] border border-[color:var(--wp-border)] flex items-center justify-center shrink-0 overflow-hidden">
            <Image src={logoPath} alt={logoAlt} width={44} height={44} className="object-contain p-1" />
          </div>
        ) : (
          <div
            className="size-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black shrink-0"
            aria-hidden
          >
            {initialsFromPartner(product)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-md bg-[color:var(--wp-surface-muted)] text-[color:var(--wp-text-secondary)] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
              {product.segmentLabel}
            </span>
            <LeadIcon className="size-4 text-[color:var(--wp-text-muted)] shrink-0" aria-hidden />
          </span>
          <h3 className="font-bold text-[color:var(--wp-text)] leading-tight mt-1 line-clamp-2">
            {contract.productName?.trim() || product.productName?.trim() || "Produkt neuveden"}
          </h3>
          <p className="text-sm text-[color:var(--wp-text-muted)] flex items-center gap-1.5 mt-0.5">
            <Building2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{contract.partnerName?.trim() || "—"}</span>
            {contract.partnerName ? (
              <ZpRatingBadge
                partnerName={contract.partnerName}
                productName={contract.productName ?? undefined}
                segment={contract.segment}
              />
            ) : null}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">{primary.label}</dt>
          <dd className="font-bold text-[color:var(--wp-text)] tabular-nums">{primary.value}</dd>
        </div>
        {contract.contractNumber ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Číslo smlouvy</dt>
            <dd className="font-mono tabular-nums">{contract.contractNumber}</dd>
          </div>
        ) : null}
        {life?.paymentAccountDisplay ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Účet</dt>
            <dd className="font-mono text-xs break-all">{life.paymentAccountDisplay}</dd>
          </div>
        ) : null}
        {life?.paymentFrequencyLabel ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Frekvence</dt>
            <dd>{life.paymentFrequencyLabel}</dd>
          </div>
        ) : null}
        {life?.paymentVariableSymbol ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Variabilní symbol</dt>
            <dd className="font-mono tabular-nums">{life.paymentVariableSymbol}</dd>
          </div>
        ) : null}
        {life?.extraPaymentAccountDisplay ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Další účet</dt>
            <dd className="font-mono text-xs break-all">{life.extraPaymentAccountDisplay}</dd>
          </div>
        ) : null}
        {veh?.vehicleRegistration ? (
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">SPZ / vozidlo</dt>
            <dd>{veh.vehicleRegistration}</dd>
          </div>
        ) : null}
        {prop?.propertyAddress ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--wp-text-muted)]">Adresa / předmět</dt>
            <dd>{prop.propertyAddress}</dd>
          </div>
        ) : null}
      </dl>

      {life && (life.investmentStrategy || life.investmentPremiumLabel) ? (
        <div className="rounded-[var(--wp-radius)] border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900 mb-1">Investiční složka</p>
          {life.investmentStrategy ? (
            <p className="text-emerald-950">
              <span className="text-emerald-800/80">Strategie: </span>
              {life.investmentStrategy}
            </p>
          ) : null}
          {life.investmentPremiumLabel ? (
            <p className="text-emerald-950 mt-1">
              <span className="text-emerald-800/80">Investiční pojistné: </span>
              {life.investmentPremiumLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="text-[11px] text-[color:var(--wp-text-muted)] flex flex-wrap gap-x-2 gap-y-1">
        <span>
          {contract.visibleToClient === false ? "Skryto v klientské zóně" : "V klientské zóně"}
          {contract.portfolioStatus && contract.portfolioStatus !== "active" ? ` · ${contract.portfolioStatus}` : ""}
        </span>
        <ContractProvenanceLine
          sourceKind={contract.sourceKind}
          sourceDocumentId={contract.sourceDocumentId}
          sourceContractReviewId={contract.sourceContractReviewId}
          advisorConfirmedAt={contract.advisorConfirmedAt}
        />
      </div>

      <div className="space-y-2">
        {inv ? (
          <AccordionRow title="Investice / DIP — parametry" icon={TrendingUp} defaultOpen>
            <ul className="space-y-1.5 text-sm">
              {inv.fundName ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Fond / třída: </span>
                  {inv.fundName}
                  {inv.fundAllocation ? ` (${inv.fundAllocation})` : ""}
                </li>
              ) : null}
              {inv.investmentStrategy ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Strategie: </span>
                  {inv.investmentStrategy}
                </li>
              ) : null}
              {inv.investmentHorizon ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Horizont: </span>
                  {inv.investmentHorizon}
                </li>
              ) : null}
              {inv.monthlyContribution != null && inv.monthlyContribution > 0 ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Příspěvek: </span>
                  {inv.monthlyContribution.toLocaleString("cs-CZ")} Kč / měsíc
                </li>
              ) : null}
              {inv.targetAmount ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Cíl / částka: </span>
                  {inv.targetAmount}
                </li>
              ) : null}
              {!inv.fundName &&
              !inv.investmentStrategy &&
              !inv.investmentHorizon &&
              !(inv.monthlyContribution != null && inv.monthlyContribution > 0) &&
              !inv.targetAmount ? (
                <li className="text-[color:var(--wp-text-muted)]">Žádné další parametry v evidenci.</li>
              ) : null}
            </ul>
          </AccordionRow>
        ) : null}

        {pen ? (
          <AccordionRow title="Penze — parametry" icon={PiggyBank} defaultOpen>
            <ul className="space-y-1.5 text-sm">
              {pen.company ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Společnost: </span>
                  {pen.company}
                </li>
              ) : null}
              {pen.participantContribution ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Účastník: </span>
                  {pen.participantContribution}
                </li>
              ) : null}
              {pen.employerContribution ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Zaměstnavatel: </span>
                  {pen.employerContribution}
                </li>
              ) : null}
              {pen.stateContributionEstimate ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Státní příspěvek (odhad): </span>
                  {pen.stateContributionEstimate}
                </li>
              ) : null}
              {pen.investmentStrategy ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Strategie: </span>
                  {pen.investmentStrategy}
                </li>
              ) : null}
              {product.fvReadiness.investmentHorizon ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Horizont: </span>
                  {product.fvReadiness.investmentHorizon}
                </li>
              ) : null}
              {!pen.company &&
              !pen.participantContribution &&
              !pen.employerContribution &&
              !pen.stateContributionEstimate &&
              !pen.investmentStrategy &&
              !product.fvReadiness.investmentHorizon ? (
                <li className="text-[color:var(--wp-text-muted)]">Žádné další parametry v evidenci.</li>
              ) : null}
            </ul>
          </AccordionRow>
        ) : null}

        {life && life.risks.length > 0 ? (
          <AccordionRow title="Životní pojištění — rizika" icon={Shield} defaultOpen>
            <ul className="space-y-2">
              {life.risks.map((r, i) => (
                <li key={`${r.label}-${i}`} className="rounded-md bg-[color:var(--wp-surface-muted)] px-2 py-1.5">
                  <span className="font-medium">{r.label}</span>
                  {r.amount ? <span className="text-[color:var(--wp-text-muted)]"> · {r.amount}</span> : null}
                  {r.coverageEnd ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">Do {r.coverageEnd}</span>
                  ) : null}
                  {r.monthlyRiskPremium ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">Měsíční rizikové: {r.monthlyRiskPremium}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}

        {life && life.persons.length > 0 ? (
          <AccordionRow title="Životní pojištění — osoby" icon={User}>
            <ul className="space-y-2">
              {life.persons.map((p, i) => (
                <li key={`${p.name ?? ""}-${i}`} className="rounded-md bg-[color:var(--wp-surface-muted)] px-2 py-1.5">
                  <span className="font-medium">{p.name ?? "—"}</span>
                  <span className="text-[color:var(--wp-text-muted)]"> · {personRoleLabelCs(p.role)}</span>
                  {p.birthDate ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">Nar.: {p.birthDate}</span>
                  ) : null}
                  {p.personalId ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">RČ: {p.personalId}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}

        {(veh && veh.coverageLines.length > 0) || (prop && prop.coverageLines.length > 0) ? (
          <AccordionRow title="Majetek / vozidlo — limity a připojištění" icon={veh ? Car : Home} defaultOpen>
            <ul className="space-y-2">
              {(veh?.coverageLines ?? prop?.coverageLines ?? []).map((line, i) => (
                <li key={`cov-${i}`} className="rounded-md bg-[color:var(--wp-surface-muted)] px-2 py-1.5 text-sm">
                  <span className="font-medium">{line.label ?? "Položka"}</span>
                  {line.amount ? <span> · {line.amount}</span> : null}
                  {line.description ? (
                    <span className="block text-xs text-[color:var(--wp-text-muted)]">{line.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}

        {prop?.sumInsured ? (
          <AccordionRow title="Majetek — pojistná částka / limit" icon={Home}>
            <p className="text-sm">{prop.sumInsured}</p>
          </AccordionRow>
        ) : null}

        {loan ? (
          <AccordionRow title="Úvěr — parametry" icon={Landmark} defaultOpen>
            <ul className="space-y-1.5 text-sm">
              {loan.lender ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Věřitel: </span>
                  {loan.lender}
                </li>
              ) : null}
              {loan.loanPrincipal ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Jistina: </span>
                  {loan.loanPrincipal}
                </li>
              ) : null}
              {loan.monthlyPayment != null && loan.monthlyPayment > 0 ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Splátka: </span>
                  {loan.monthlyPayment.toLocaleString("cs-CZ")} Kč / měsíc
                </li>
              ) : null}
              {loan.fixationUntil ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Fixace do: </span>
                  {loan.fixationUntil}
                </li>
              ) : null}
              {loan.maturityDate ? (
                <li>
                  <span className="text-[color:var(--wp-text-muted)]">Splatnost: </span>
                  {loan.maturityDate}
                </li>
              ) : null}
            </ul>
          </AccordionRow>
        ) : null}

        {!d && detailRows.length > 0 ? (
          <AccordionRow title="Podrobnosti produktu" icon={FileText} defaultOpen>
            <ul className="space-y-2">
              {detailRows.map((row) => (
                <li key={row.label} className="flex justify-between gap-3 text-xs">
                  <span className="text-[color:var(--wp-text-muted)] font-semibold shrink-0">{row.label}</span>
                  <span className="text-[color:var(--wp-text)] font-medium text-right">{row.value}</span>
                </li>
              ))}
            </ul>
          </AccordionRow>
        ) : null}

        {contract.note?.trim() ? (
          <AccordionRow title="Poznámka v evidenci" icon={FileText}>
            <p className="text-sm whitespace-pre-wrap">{contract.note.trim()}</p>
          </AccordionRow>
        ) : null}
      </div>

      {provenance !== undefined ? (
        provenance?.supportingDocumentGuard ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 leading-none">
            <FileCheck className="w-3 h-3 text-slate-400" aria-hidden />
            Podkladový dokument — evidenční záznam bez potvrzovacího toku
          </span>
        ) : (
          <ContractPendingFieldsGuard contractId={contract.id} provenance={provenance} />
        )
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-[color:var(--wp-border-muted)]">
        {variant === "pending" && onApproveForClient ? (
          <button
            type="button"
            onClick={() => void onApproveForClient()}
            disabled={publishBusy}
            className="rounded-[var(--wp-radius)] bg-emerald-600 text-white px-3 py-2 text-sm font-semibold min-h-[44px] hover:bg-emerald-700 disabled:opacity-60"
          >
            {publishBusy ? "Zveřejňuji…" : "Schválit pro klienta"}
          </button>
        ) : null}
        <Link
          href={`/portal/terminations/new?contactId=${encodeURIComponent(contactId)}&contractId=${encodeURIComponent(contract.id)}`}
          className="inline-flex items-center justify-center rounded-[var(--wp-radius)] border border-[color:var(--wp-border)] px-3 py-2 text-sm font-semibold text-[color:var(--wp-text)] hover:bg-[color:var(--wp-surface-muted)] min-h-[44px]"
        >
          Výpověď
        </Link>
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-2 rounded-[var(--wp-radius)] text-[var(--wp-accent)] font-medium hover:bg-[color:var(--wp-surface-muted)] min-h-[44px] border border-[color:var(--wp-border)]"
        >
          Upravit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-2 rounded-[var(--wp-radius)] text-red-600 font-medium hover:bg-red-50 min-h-[44px]"
        >
          Smazat
        </button>
      </div>
    </article>
  );
}
