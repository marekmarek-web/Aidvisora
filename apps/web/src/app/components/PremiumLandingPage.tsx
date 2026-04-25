"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BellRing,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronUp,
  Database,
  Download,
  FileBox,
  FileText,
  Info,
  Layers,
  LayoutGrid,
  Lock,
  Mail,
  Maximize,
  MessageSquare,
  Minus,
  MoreVertical,
  PieChart,
  PlayCircle,
  Plus,
  RotateCw,
  Scale,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  StickyNote,
  User,
  Users,
  X,
  XCircle,
  Check,
} from "lucide-react";

import { LANDING_FAQS } from "@/data/landing-faq";
import { LEGAL_PODPORA_EMAIL, LEGAL_SECURITY_EMAIL } from "@/app/legal/legal-meta";
import {
  ANNUAL_BILLING_DISCOUNT_PERCENT,
  annualSavingsVersusTwelveMonthly,
  effectiveMonthlyKcWhenBilledAnnually,
  formatPublicPriceKc,
  PUBLIC_MONTHLY_PRICE_KC,
  PUBLIC_TRIAL_DURATION_DAYS,
  yearlyTotalKcFromMonthlyList,
} from "@/lib/billing/public-pricing";
import {
  PUBLIC_PLAN_INCLUDES,
  PUBLIC_PLAN_START_EXCLUDES,
  PUBLIC_PLAN_TAGLINE,
} from "@/lib/billing/plan-public-marketing";

import { CalendarDemo } from "@/app/components/landing/demos/CalendarDemo";
import { ClientDetailDemo } from "@/app/components/landing/demos/ClientDetailDemo";
import { ClientPortalDemo } from "@/app/components/landing/demos/ClientPortalDemo";
import { ClientRequestDemo } from "@/app/components/landing/demos/ClientRequestDemo";
import { EmailCampaignDemo } from "@/app/components/landing/demos/EmailCampaignDemo";
import { NotesBoardDemo } from "@/app/components/landing/demos/NotesBoardDemo";
import { AiAssistantBrandIcon } from "@/app/components/AiAssistantBrandIcon";

/**
 * Landing dema importujeme staticky.
 *
 * Důvod: kombinace `next/dynamic`, `ssr: false`, HMR a server-renderované
 * marketing stránky dělala ve webpack dev režimu hydration missmatche
 * ("server rendered HTML didn't match the client"). Pro homepage je teď
 * priorita stabilita a 1:1 vykreslení nad splitováním chunků.
 */

const DEMO_BOOKING_MAILTO = `mailto:${LEGAL_PODPORA_EMAIL}?subject=${encodeURIComponent(
  "Demo Aidvisora (cca 20 min)",
)}`;

const FAQS = LANDING_FAQS;

/**
 * Jemný scroll-reveal. IO + fallback pro elementy už ve viewportu.
 * Vyhovuje prefers-reduced-motion (pouze rychlý fade, žádný slide).
 */
function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const rect = node.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (inViewport) {
      const t = window.setTimeout(() => setVisible(true), delay);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none ${className} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

type ShowcaseDef = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  benefits: readonly string[];
  icon: React.ComponentType<{ size?: number; className?: string }>;
  Demo: React.ComponentType;
};

const SHOWCASE: ShowcaseDef[] = [
  {
    id: "ukazka-zapisky",
    eyebrow: "Zápisky u klienta",
    title: "Poznámky a strukturované zápisky u klienta.",
    description:
      "Zápisky ze schůzek, nápady, domluvené kroky i důležité informace zůstávají přímo u klienta. Poradce se nemusí vracet do poznámkových bloků, e-mailů nebo chatu.",
    benefits: [
      "zápis ze schůzky u klienta",
      "další kroky na jednom místě",
      "návaznost na produkty, úkoly a dokumenty",
    ],
    icon: StickyNote,
    Demo: NotesBoardDemo,
  },
  {
    id: "ukazka-pozadavek",
    eyebrow: "Klientské požadavky",
    title: "Klient pošle podklad nebo zprávu — poradce ví, co má udělat dál.",
    description:
      "Požadavky z klientské zóny se neztratí v e-mailu. Poradce vidí klienta, přílohy, kontext a může z požadavku rovnou vytvořit úkol, obchod nebo další krok.",
    benefits: [
      "požadavky z portálu",
      "přílohy u správného klienta",
      "rychlá návaznost pro poradce nebo backoffice",
    ],
    icon: MessageSquare,
    Demo: ClientRequestDemo,
  },
  {
    id: "ukazka-kalendar",
    eyebrow: "Kalendář",
    title: "Schůzky, hovory a follow-upy v jednom přehledu.",
    description:
      "Kalendář pomáhá poradci vidět pracovní týden, plánované schůzky a návazné kroky. Cílem není jen zapsat událost, ale propojit ji s klientem, úkolem nebo obchodem.",
    benefits: [
      "přehled týdne",
      "follow-up po schůzce",
      "návaznost na klienta",
      "Google Calendar sync podle tarifu a nastavení",
    ],
    icon: Calendar,
    Demo: CalendarDemo,
  },
  {
    id: "ukazka-email",
    eyebrow: "E-mailové kampaně",
    title: "E-mailové šablony a kampaně pro servis klientů.",
    description:
      "Přání k narozeninám, pozvánky na revizi, newsletter nebo žádost o doplnění podkladů nemusí poradce psát pokaždé od nuly. Aidvisora pomáhá připravit opakovatelnou komunikaci v jednotném stylu.",
    benefits: [
      "šablony zpráv",
      "náhled před odesláním",
      "servisní komunikace klientům",
      "dostupnost podle tarifu a aktuálního nastavení",
    ],
    icon: Mail,
    Demo: EmailCampaignDemo,
  },
  {
    id: "ukazka-detail-klienta",
    eyebrow: "CRM a karta klienta",
    title: "Karta klienta: smlouvy, kontakty, dokumenty a úkoly pohromadě.",
    description:
      "Jedna obrazovka pro rychlou orientaci před schůzkou i při servisu klienta. Poradce vidí kontakty, produkty, dokumenty, poznámky, požadavky a další kroky bez přeskakování mezi složkami.",
    benefits: [
      "kompletní profil klienta",
      "produkty a dokumenty",
      "úkoly a požadavky",
      "rychlejší příprava na schůzku",
    ],
    icon: Users,
    Demo: ClientDetailDemo,
  },
  {
    id: "ukazka-portal",
    eyebrow: "Klientský portál",
    title: "Bezpečnější podklady a zprávy pro klienta i poradce.",
    description:
      "Klient má vlastní prostor, kde může nahrát dokument, poslat požadavek nebo najít důležité podklady. Poradce díky tomu nemusí lovit přílohy v e-mailu a ví, ke kterému klientovi dokument patří.",
    benefits: [
      "nahrávání dokumentů",
      "klientské požadavky",
      "zprávy a podklady",
      "méně chaosu v e-mailu",
    ],
    icon: PieChart,
    Demo: ClientPortalDemo,
  },
];

type CoverageBadge = "Dostupné" | "V rozvoji" | "Podle tarifu" | "Připravujeme";

type CoverageLogo = { src: string; alt: string };

type CoverageItem = {
  id: number;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  badge: CoverageBadge;
  bullets: readonly string[];
  /** Jedno logo (např. BankID) */
  logoSrc?: string;
  logoAlt?: string;
  /** Více log na bílém podkladu (např. Google: Kalendář, Gmail, Drive) */
  logos?: readonly CoverageLogo[];
  iconSurface?: "dark" | "white";
};

const COVERAGE_BADGE_CLASS: Record<CoverageBadge, string> = {
  Dostupné: "border-emerald-400/20 bg-emerald-400/10 text-emerald-400",
  "V rozvoji": "border-blue-400/20 bg-blue-400/10 text-blue-400",
  "Podle tarifu": "border-purple-400/20 bg-purple-400/10 text-purple-400",
  Připravujeme: "border-amber-400/20 bg-amber-400/10 text-amber-400",
};

const COVERAGE_ITEMS: readonly CoverageItem[] = [
  {
    id: 1,
    title: "Přihlášení přes BankID",
    icon: ShieldCheck,
    badge: "Připravujeme",
    logoSrc: "/logos/bankid-logo.png",
    logoAlt: "BankID",
    iconSurface: "white",
    bullets: [
      "ověřená identita pro klientský portál",
      "pohodlnější přístup bez dalšího hesla",
      "bezpečnější vstup do citlivých podkladů",
    ],
  },
  {
    id: 2,
    title: "Google Kalendář, Gmail a Drive",
    icon: Calendar,
    badge: "Dostupné",
    iconSurface: "white",
    logos: [
      { src: "/logos/google-calendar.svg", alt: "Google Kalendář" },
      { src: "/logos/gmail.svg", alt: "Gmail" },
      { src: "/logos/google-drive.svg", alt: "Google Drive" },
    ],
    bullets: [
      "Google Calendar sync podle nastavení",
      "Gmail a historie komunikace v CRM",
      "Drive pro dokumenty a podklady podle tarifu",
    ],
  },
  {
    id: 3,
    icon: Mail,
    title: "E-mailové šablony",
    badge: "Dostupné",
    bullets: [
      "konec přepisování stejných zpráv",
      "rychlé žádosti o chybějící podklady",
      "jednotný styl servisní komunikace",
    ],
  },
  {
    id: 4,
    icon: CheckSquare,
    title: "Úkoly z klientské zóny",
    badge: "Dostupné",
    bullets: [
      "požadavky padají rovnou z portálu",
      "upozornění na nahraný dokument",
      "přímá vazba na klienta a poradce",
    ],
  },
  {
    id: 5,
    icon: BarChart3,
    title: "Produkce a výsledky",
    badge: "Dostupné",
    bullets: [
      "rychlý přehled rozpracovaných případů",
      "sledování obchodního plánu",
      "osobní a týmová výkonnost bez tabulek",
    ],
  },
  {
    id: 6,
    icon: Database,
    title: "Importy a pořádek",
    badge: "Dostupné",
    bullets: [
      "sjednocení dat do jednoho zdroje",
      "hromadné nahrávání klientů a portfolií",
      "pořádek ve smlouvách a podkladech",
    ],
  },
  {
    id: 7,
    icon: BellRing,
    title: "Připomínky a upozornění",
    badge: "V rozvoji",
    bullets: [
      "hlídání důležitých termínů",
      "notifikace na nové klientské požadavky",
      "interní upozornění pro poradce a tým",
    ],
  },
  {
    id: 8,
    icon: FileBox,
    title: "PDF výstupy pro klienta",
    badge: "Podle tarifu",
    bullets: [
      "profesionální vzhled vybraných reportů",
      "uložení výstupu ke správnému klientovi",
      "jednotný vizuál a firemní brand",
    ],
  },
  {
    id: 9,
    icon: Users,
    title: "Týmové role a přístupy",
    badge: "Podle tarifu",
    bullets: [
      "oddělené přístupy pro asistenta i poradce",
      "bezpečné sdílení klientů v týmu",
      "rychlý manažerský přehled",
    ],
  },
] as const;

const HERO_CHECKLIST = [
  { text: "Klientská karta a historie", icon: User, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  { text: "Zápisky, úkoly a další kroky", icon: CheckSquare, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { text: "Smlouvy, PDF a podklady", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { text: "Požadavky z klientské zóny", icon: Bell, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { text: "Schůzky, follow-upy a e-maily", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
] as const;

export default function PremiumLandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAnnualPricing, setIsAnnualPricing] = useState(false);
  const [isCoverageRevealed, setIsCoverageRevealed] = useState(false);
  const [isAiReviewStarted, setIsAiReviewStarted] = useState(false);
  const [activeAiReviewTab, setActiveAiReviewTab] = useState("Shrnutí");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const priceStart = PUBLIC_MONTHLY_PRICE_KC.starter;
  const pricePro = PUBLIC_MONTHLY_PRICE_KC.pro;
  const priceMgmt = PUBLIC_MONTHLY_PRICE_KC.team;
  const trialDaysLabel = `${PUBLIC_TRIAL_DURATION_DAYS} dní`;
  const faqSplitIndex = Math.ceil(FAQS.length / 2);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    /** Hysteréze: změna výšky navu (py-5 → py-3) posouvá layout; u jednoho prahu
     *  hrozí kmitání scrollY a nekonečné re-rendery. Sepnout až ve 48px, vypnout do 16px. */
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => {
        if (prev) return y < 16 ? false : true;
        return y > 48;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!isHydrated) {
    return <div className="min-h-screen bg-[#0a0f29]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0f29] font-inter text-slate-300 selection:bg-indigo-500 selection:text-white overflow-x-hidden relative">
      <style>{`
        .font-inter { font-family: var(--font-primary), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .font-jakarta { font-family: var(--font-jakarta), var(--font-primary), -apple-system, BlinkMacSystemFont, sans-serif; }

        .bg-grid-pattern {
          background-size: 50px 50px;
          background-image: linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
          mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
        }

        .glass-nav {
          background: rgba(10, 15, 41, 0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .hero-gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 50%, #c7d2fe 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .pro-pricing-wrapper {
          position: relative;
          border-radius: 34px;
          padding: 2px;
          background: linear-gradient(135deg, #4f46e5 0%, #8b5cf6 50%, #ec4899 100%);
        }
        .pro-pricing-inner {
          position: relative;
          background: #0a0f29;
          border-radius: 31px;
          height: 100%;
        }

        .glass-panel {
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
        }

        .check-item {
          opacity: 0;
          transform: translateX(-10px);
        }

        .loaded .check-item {
          animation: slideRightFade 0.5s ease-out forwards;
        }

        @keyframes slideRightFade {
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .feature-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(99, 102, 241, 0.3);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px -10px rgba(99, 102, 241, 0.15);
        }

        .stagger-card {
          opacity: 0;
          transform: translateY(40px) scale(0.95);
        }

        .reveal-active .stagger-card {
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUpFade {
          0% { opacity: 0; transform: translateY(40px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .glow-btn-wrapper {
          position: relative;
          display: inline-block;
        }

        .glow-btn-wrapper::before {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 9999px;
          background: linear-gradient(90deg, #5a4bff, #10b981, #5a4bff);
          background-size: 200% 200%;
          z-index: -1;
          filter: blur(16px);
          opacity: 0.6;
          animation: glowPulse 3s linear infinite;
          transition: opacity 0.3s;
        }

        .glow-btn-wrapper:hover::before {
          opacity: 1;
        }

        @keyframes glowPulse {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .landing-scanner-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: #5a4bff;
          box-shadow: 0 0 20px 4px rgba(90, 75, 255, 0.35);
          animation: landingScan 4s ease-in-out infinite;
          pointer-events: none;
          z-index: 20;
        }

        .landing-scanner-glow {
          position: absolute;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(to bottom, rgba(90,75,255,0.12), transparent);
          animation: landingScan 4s ease-in-out infinite;
          pointer-events: none;
          z-index: 19;
        }

        @keyframes landingScan {
          0% { top: 5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }

        html { scroll-behavior: smooth; }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
        }
      `}</style>

      {/* === NAV === */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-nav py-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)]" : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center min-h-[44px] min-w-[44px]">
            <Image
              src="/logos/Aidvisora%20logo%20new.png"
              alt="Aidvisora"
              width={220}
              height={48}
              priority
              fetchPriority="high"
              sizes="(max-width: 640px) 55vw, 220px"
              className="h-9 w-auto max-w-[min(220px,55vw)] object-contain object-left brightness-0 invert sm:h-10"
            />
          </Link>

          <div className="hidden lg:flex items-center gap-8 font-inter text-xl font-semibold text-slate-400">
            <a href="#showcase" className="hover:text-white transition-colors">Ukázky</a>
            <a href="#vyhody" className="hover:text-white transition-colors">Funkce a ekosystém</a>
            <a href="#cenik" className="hover:text-white transition-colors">Ceník</a>
            <Link href="/bezpecnost" className="hover:text-white transition-colors">Bezpečnost</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/prihlaseni?register=1"
              className="hidden sm:inline-flex items-center min-h-[44px] px-5 py-2 bg-indigo-600 text-white rounded-full text-lg font-bold hover:bg-indigo-500 transition-colors"
            >
              Založit účet
            </Link>
            <Link
              href="/prihlaseni"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 bg-white text-[#0a0f29] rounded-full text-lg font-bold hover:bg-slate-200 transition-colors"
            >
              Přihlásit se <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* === HERO === */}
      <section className={`relative z-10 mx-auto max-w-[1400px] px-6 pb-20 pt-24 lg:px-10 lg:pb-32 lg:pt-32 ${isHydrated ? "loaded" : ""}`}>
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20">
          <ScrollReveal>
            <div className="flex flex-col items-start text-left">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 font-jakarta text-[16px] font-bold uppercase tracking-widest text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <ShieldCheck size={16} />
                CRM a pracovní systém pro finanční poradce
              </div>

              <h1 className="mb-8 font-jakarta text-5xl font-extrabold leading-[1.1] tracking-tight text-white lg:text-[64px]">
                Klienti, smlouvy a servis.
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                  Konečně v jednom systému.
                </span>
              </h1>

              <p className="mb-12 max-w-2xl text-lg font-medium leading-relaxed text-slate-400 lg:text-xl">
                Aidvisora spojuje CRM, dokumenty, kalendář, e-maily, klientskou zónu a AI Review smluv. Méně přepisování, víc času na klienty.
              </p>

              <div className="flex w-full flex-col items-center gap-5 sm:w-auto sm:flex-row">
                <Link
                  href="/prihlaseni?register=1"
                  className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#f4f6fb] px-10 py-5 font-jakarta text-[17px] font-extrabold text-[#0b1021] shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all hover:scale-105 hover:bg-white sm:w-auto"
                >
                  Založit účet — {trialDaysLabel} zdarma
                  <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href={DEMO_BOOKING_MAILTO}
                  className="flex w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-10 py-5 font-jakarta text-[17px] font-extrabold text-white transition-all hover:bg-white/10 sm:w-auto"
                >
                  Domluvit demo
                </a>
              </div>
              <p className="mt-5 text-[18px] font-semibold text-slate-500">
                14 dní zdarma bez platební karty · Data v EU · Výstupy potvrzuje poradce
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
              <div className="glass-panel relative overflow-hidden rounded-[32px] border border-white/10 p-8 shadow-[0_0_50px_rgba(90,75,255,0.15)] lg:p-10 lg:animate-[float_6s_ease-in-out_infinite]">
                <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-500/20 blur-[80px]" aria-hidden />
                <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]" aria-hidden />

                <div className="relative z-10 mb-8 flex items-start justify-between">
                  <div>
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="font-jakarta text-[14px] font-extrabold uppercase tracking-widest text-slate-300">Aktivní prostředí</p>
                    </div>
                    <h3 className="font-jakarta text-2xl font-extrabold leading-tight text-white">Vše na svém místě</h3>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 shadow-inner">
                    <LayoutGrid size={24} />
                  </div>
                </div>

                <div className="relative z-10 space-y-3">
                  {HERO_CHECKLIST.map((item, i) => (
                    <div
                      key={item.text}
                      className="check-item group flex cursor-default items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:scale-[1.02] hover:border-white/10 hover:bg-white/10"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${item.bg} ${item.color} ${item.border} group-hover:bg-white/10`}>
                          <item.icon size={18} strokeWidth={2.5} />
                        </div>
                        <span className="text-[18px] font-semibold text-slate-200">{item.text}</span>
                      </div>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-slate-500 transition-colors group-hover:bg-emerald-400/10 group-hover:text-emerald-400">
                        <CheckCircle2 size={14} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* === AI REVIEW SUBHERO === */}
      <section className="relative z-20 mx-auto max-w-[1500px] border-t border-white/10 px-6 py-24 lg:px-10 lg:py-32">
        <div className="mx-auto">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <div
                className="mb-6 inline-flex items-center gap-3 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-b from-purple-50/95 to-indigo-50/90 px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] ring-1 ring-white/25 sm:gap-3.5 sm:px-5 sm:py-3"
                role="group"
                aria-label="AI Review smluv"
              >
                <AiAssistantBrandIcon size={32} variant="colorOnWhite" className="shrink-0" />
                <span className="bg-gradient-to-r from-fuchsia-600 to-indigo-600 bg-clip-text text-left text-sm font-black tracking-wide text-transparent sm:text-base">
                  AI Review smluv
                </span>
              </div>
              <h2 className="mb-6 font-jakarta text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
                Smlouva se promění v data, která můžete zkontrolovat a propsat.
              </h2>
              <p className="text-lg font-medium leading-relaxed text-slate-400 md:text-xl">
                Aidvisora vytěží klienta, produkt, instituci, platby, rizika a důležitá data. Poradce výsledek zkontroluje a jedním krokem ho propíše do CRM nebo naváže další akcí.
              </p>
            </div>
          </ScrollReveal>

          {!isAiReviewStarted ? (
            <ScrollReveal delay={80}>
              <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-white/10 bg-white/5 p-3 shadow-[0_30px_100px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-5">
                <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1021] px-6 py-12 text-center md:px-10 md:py-16">
                  <div className="absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[80px]" aria-hidden />
                  <div className="relative z-10 mx-auto max-w-2xl">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
                      <FileText size={28} />
                    </div>
                    <h3 className="mb-4 font-jakarta text-2xl font-extrabold text-white md:text-3xl">
                      Nahrajte smlouvu a spusťte AI Review.
                    </h3>
                    <p className="mx-auto mb-8 max-w-xl text-[18px] font-medium leading-relaxed text-slate-400 md:text-xl">
                      Ukázka nejdřív simuluje nahrání PDF. Až potom se otevře review panel s extrahovanými poli a náhledem smlouvy.
                    </p>
                    <div className="glow-btn-wrapper">
                      <button
                        type="button"
                        onClick={() => setIsAiReviewStarted(true)}
                        className="group relative flex items-center gap-3 rounded-full border border-white/10 bg-[#0b1021] px-8 py-5 font-jakarta text-lg font-bold text-white transition-all duration-300 hover:bg-white hover:text-[#0b1021]"
                      >
                        <Sparkles className="text-indigo-400 transition-transform group-hover:rotate-12 group-hover:text-indigo-600" size={22} />
                        Začít AI Review
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ) : (
          <ScrollReveal delay={80}>
            <div className="relative mx-auto w-full max-w-[1300px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 p-3 shadow-[0_30px_100px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-5">
              <div className="flex items-center gap-2 px-4 pb-4 pt-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <div className="mx-auto hidden items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-medium text-slate-400 sm:flex">
                  <ShieldCheck size={12} /> app.aidvisora.cz/ai-review
                </div>
              </div>

              <div className="h-[800px] w-full overflow-x-auto overflow-y-hidden rounded-[2rem] border border-slate-200/50 bg-[#f4f6fb] text-slate-800 shadow-inner">
                <div className="flex h-full min-w-[1000px] flex-col">
                  <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
                    <div className="flex items-center gap-4 font-jakarta text-sm font-bold text-slate-600">
                      <ArrowLeft size={16} className="cursor-pointer transition-colors hover:text-[#5a4bff]" />
                      <span className="cursor-pointer transition-colors hover:text-[#5a4bff]">Seznam revizí</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-[#0b1021]">AI Review — detail dokumentu</span>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-1.5 font-jakarta text-sm font-bold text-slate-600 transition-colors hover:text-[#5a4bff]" type="button">
                      <LayoutGrid size={16} /> Portál
                    </button>
                  </header>

                  <div className="flex flex-1 overflow-hidden">
                  <div className="relative z-10 flex w-[480px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-xl 2xl:w-[550px]">
                    <div className="space-y-4 p-4 pb-0 md:p-5 md:pb-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900" type="button">
                          <ArrowLeft size={16} /> Zpět
                        </button>
                        <button className="inline-flex items-center gap-2 text-sm font-bold text-[#5a4bff] transition-colors hover:text-indigo-800" type="button">
                          <Download size={16} /> Stáhnout PDF
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-2 text-[10px] font-extrabold uppercase text-rose-600 transition-colors hover:bg-rose-50" type="button">
                          <X size={13} strokeWidth={3} /> Zamítnout
                        </button>
                        <button className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 text-[10px] font-extrabold uppercase text-slate-700 transition-colors hover:bg-slate-50" type="button">
                          <Check size={13} strokeWidth={3} /> Jen schválit
                        </button>
                        <button className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#5a4bff] px-2 text-[10px] font-extrabold uppercase text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-[#4a3de0]" type="button">
                          <Send size={13} strokeWidth={3} /> Propsat
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-5 overflow-x-auto border-b border-slate-100 px-5">
                      {["Shrnutí", "Přehled AI", "Pole k ověření", "Diagnostika"].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveAiReviewTab(tab)}
                          className={`whitespace-nowrap border-b-2 pb-3 text-[10px] font-extrabold uppercase tracking-widest transition-colors ${
                            activeAiReviewTab === tab
                              ? "border-[#5a4bff] text-[#5a4bff]"
                              : "border-transparent text-slate-400 hover:text-slate-700"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 md:p-5">
                      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                            <FileText size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-jakarta text-lg font-extrabold text-[#0b1021]">Jan Novák — Uniqa.pdf</h3>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                              <span className="rounded bg-indigo-100/60 px-1.5 py-0.5 text-indigo-700">návrh smlouvy</span>
                              <span className="rounded bg-emerald-100/60 px-1.5 py-0.5 text-emerald-700">životní pojištění</span>
                              <span className="inline-flex items-center gap-1 text-slate-500"><Users size={12} /> Jan Novák</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-sm font-bold text-indigo-700">
                            Jistota AI: 99 %
                          </div>
                          <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-sm font-bold text-amber-700">
                            K revizi
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-widest text-[#0b1021]">
                            <Sparkles size={14} className="text-indigo-500" /> Shrnutí dokumentu
                          </h4>
                          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed text-slate-600 shadow-sm">
                            Rozpoznán návrh pojistné smlouvy. Produkt: životní pojištění Život & radost od instituce UNIQA pojišťovna, a.s. Klient: Jan Novák. Dokument obsahuje platební instrukce a údaje potřebné ke kontrole.
                          </p>
                        </div>

                        <div>
                          <h4 className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-widest text-[#0b1021]">
                            <Activity size={14} className="text-indigo-500" /> Přehled AI
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              ["36/36", "Nalezeno polí", "text-indigo-600", "border-indigo-100"],
                              ["100 %", "Pokrytí dat", "text-emerald-500", "border-emerald-100"],
                              ["0", "K ručnímu ověření", "text-amber-500", "border-amber-100"],
                              ["0", "Chyb extrakce", "text-rose-500", "border-rose-100"],
                            ].map(([value, label, color, border]) => (
                              <div key={label} className={`rounded-xl border ${border} bg-white p-4 text-center shadow-sm`}>
                                <p className={`mb-1 font-jakarta text-2xl font-black ${color}`}>{value}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-widest text-[#0b1021]">
                            <CheckCircle2 size={14} className="text-emerald-500" /> Pole k ověření
                          </h4>
                          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                                <Users size={14} />
                              </div>
                              <span className="text-xs font-bold text-slate-800">Klient</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                              {[
                                ["Jméno a příjmení", "Jan Novák"],
                                ["Rodné číslo", "751102/1234"],
                                ["E-mail", "jan.novak.test@email.cz"],
                                ["Telefon", "+420 777 123 456"],
                              ].map(([label, value]) => (
                                <label key={label} className="flex flex-col gap-1">
                                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">{label}</span>
                                  <input className="rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[13px] font-semibold text-[#0b1021] outline-none focus:border-indigo-400 focus:bg-white" defaultValue={value} />
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-extrabold uppercase tracking-widest text-[#0b1021]">
                            <Info size={14} className="text-blue-500" /> Diagnostika
                          </h4>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed text-slate-600 shadow-sm">
                            Data jsou konzistentní s očekávaným standardem návrhů pro danou instituci. Výsledek je připravený ke kontrole poradcem.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-0 flex flex-1 flex-col bg-[#2c313b]">
                    <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-4">
                      <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
                        <Minus size={16} />
                        <span>100 %</span>
                        <Plus size={16} />
                      </div>
                      <div className="flex items-center gap-3 text-slate-300">
                        <Maximize size={16} />
                        <RotateCw size={16} />
                        <MoreVertical size={16} />
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto bg-[#1e232b] p-5 md:p-7">
                      <div className="relative mx-auto mb-10 w-full max-w-[640px] overflow-hidden rounded bg-white p-8 text-slate-800 shadow-2xl md:p-10">
                        <div className="landing-scanner-glow" aria-hidden />
                        <div className="landing-scanner-line" aria-hidden />
                        <div className="mb-8 flex items-start justify-between border-b-2 border-indigo-600 pb-4">
                          <div>
                            <h3 className="text-3xl font-black tracking-tighter text-indigo-700">UNIQA</h3>
                            <p className="mt-1 text-[10px] font-medium text-slate-500">pojišťovna, a.s.</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-slate-700">Životní pojištění</p>
                            <p className="text-xs font-semibold text-indigo-600">Život & radost</p>
                            <p className="mt-1 font-mono text-[9px] text-slate-400">Návrh smlouvy č. 8801965412</p>
                          </div>
                        </div>

                        <div className="space-y-6 text-sm">
                          <section>
                            <h4 className="mb-2 text-sm font-bold text-indigo-700">Kdo smlouvu uzavírá?</h4>
                            <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                              UNIQA pojišťovna, a.s., Evropská 810/136, Praha 6, IČO: 49240480.
                            </p>
                            <div className="grid grid-cols-[130px_1fr] gap-y-1.5 text-xs">
                              <span className="font-semibold text-slate-500">Jméno:</span>
                              <span className="font-bold">Jan Novák</span>
                              <span className="font-semibold text-slate-500">Rodné číslo:</span>
                              <span className="font-bold">751102/1234</span>
                              <span className="font-semibold text-slate-500">E-mail:</span>
                              <span className="font-bold">jan.novak.test@email.cz</span>
                            </div>
                          </section>

                          <section className="border-t border-slate-200 pt-4">
                            <h4 className="mb-2 text-sm font-bold text-indigo-700">Základní údaje o pojištění</h4>
                            <div className="grid gap-4 text-xs sm:grid-cols-2">
                              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                                <span className="font-semibold text-slate-500">Počátek:</span>
                                <span className="font-bold">01.06.2026</span>
                                <span className="font-semibold text-slate-500">Konec:</span>
                                <span className="font-bold">01.06.2046</span>
                                <span className="font-semibold text-slate-500">Doba:</span>
                                <span className="font-bold">20 let</span>
                              </div>
                              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                                <span className="font-semibold text-slate-500">Platba:</span>
                                <span className="font-bold">měsíčně</span>
                                <span className="font-semibold text-slate-500">Pojistné:</span>
                                <span className="font-bold">2 142 Kč</span>
                                <span className="font-semibold text-slate-500">Produkt:</span>
                                <span className="font-bold">Život & radost</span>
                              </div>
                            </div>
                          </section>

                          <section className="border-t border-slate-200 pt-4">
                            <h4 className="mb-2 text-sm font-bold text-indigo-700">Přehled sjednaných rizik</h4>
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
                                  <th className="p-2 font-semibold">Riziko</th>
                                  <th className="p-2 font-semibold">Částka</th>
                                  <th className="p-2 text-right font-semibold">Pojistné</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                <tr><td className="p-2">Smrt z jakýchkoliv příčin</td><td className="p-2 font-bold">1 000 000 Kč</td><td className="p-2 text-right">450 Kč</td></tr>
                                <tr><td className="p-2">Invalidita 3. stupně</td><td className="p-2 font-bold">2 000 000 Kč</td><td className="p-2 text-right">820 Kč</td></tr>
                                <tr><td className="p-2">Trvalé následky úrazu</td><td className="p-2 font-bold">1 500 000 Kč</td><td className="p-2 text-right">380 Kč</td></tr>
                              </tbody>
                            </table>
                          </section>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </ScrollReveal>
          )}
        </div>
      </section>

      {/* === PRODUCT SHOWCASE === */}
      <section
        id="showcase"
        className="scroll-mt-24 border-t border-white/10 bg-[#060918] px-5 pb-20 pt-28 md:px-8 md:pb-28 md:pt-32"
      >
        <div className="mx-auto max-w-[1400px]">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-300">
                <Sparkles size={13} /> Ukázky z aplikace
              </div>
              <h2 className="mb-4 font-jakarta text-3xl font-bold leading-tight text-white md:text-5xl">
                Podívejte se, co Aidvisora umí
              </h2>
              <p className="text-base leading-relaxed text-slate-400 md:text-lg">
                Ukázky z reálných částí aplikace: klienti, zápisky, požadavky, kalendář, e-maily, dokumenty a klientská zóna v jednom pracovním systému.
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-20 md:space-y-28">
            {SHOWCASE.map((s, idx) => {
              /**
               * Portál klienta a Detail klienta jsou obsahově bohatší — zabírají
               * plnou šířku kontejneru, text stojí jako narrow intro bar nahoře.
               * Zbytek zachovává 2-column split s alternující stranou.
               */
              const wide = s.id === "ukazka-portal" || s.id === "ukazka-detail-klienta";
              const enlargedCanvas =
                s.id === "ukazka-pozadavek" ||
                s.id === "ukazka-kalendar" ||
                s.id === "ukazka-zapisky" ||
                s.id === "ukazka-email";
              const reversed = idx % 2 === 1 && !wide;
              const Icon = s.icon;
              const enlargedCanvasGrid = reversed
                ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:gap-12"
                : "lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] lg:gap-12";

              if (wide) {
                return (
                  <div key={s.id} id={s.id} className="scroll-mt-24">
                    <ScrollReveal>
                      <div className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
                        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                          <Icon size={12} className="text-indigo-300" />
                          {s.eyebrow}
                        </div>
                        <h3 className="mb-3 font-jakarta text-2xl font-bold leading-tight text-white md:text-3xl">
                          {s.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-400 md:text-base">{s.description}</p>
                        <ul className="mt-5 flex flex-wrap justify-center gap-2">
                          {s.benefits.map((benefit) => (
                            <li
                              key={benefit}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300"
                            >
                              <Check size={13} className="text-emerald-400" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </ScrollReveal>
                    <ScrollReveal delay={80}>
                      <div className="mx-auto w-full">
                        <s.Demo />
                      </div>
                    </ScrollReveal>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  id={s.id}
                  className={`grid scroll-mt-24 grid-cols-1 items-center gap-8 ${
                    enlargedCanvas ? enlargedCanvasGrid : "lg:grid-cols-2 lg:gap-14"
                  }`}
                >
                  <ScrollReveal className={reversed ? "lg:order-2 lg:justify-self-end" : "lg:justify-self-start"}>
                    <div className="mx-auto max-w-md lg:mx-0">
                      <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        <Icon size={12} className="text-indigo-300" />
                        {s.eyebrow}
                      </div>
                      <h3 className="mb-3 font-jakarta text-2xl font-bold leading-tight text-white md:text-3xl">
                        {s.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-400 md:text-base">{s.description}</p>
                      <ul className="mt-5 space-y-2.5">
                        {s.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2.5 text-sm font-medium text-slate-300">
                            <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ScrollReveal>

                  <ScrollReveal delay={80} className={reversed ? "lg:order-1" : ""}>
                    <s.Demo />
                  </ScrollReveal>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden border-t border-white/10 bg-[#0b1021]">
        <div className="absolute inset-0 bg-grid-pattern opacity-80" aria-hidden />
        <div className="absolute left-1/2 top-32 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[120px]" aria-hidden />

        {/* === COVERAGE GRID === */}
        <section id="vyhody" className="relative z-10 scroll-mt-24 overflow-hidden px-6 py-24 md:py-32">
          <div className="absolute bottom-0 left-0 h-[520px] w-[520px] rounded-full bg-emerald-600/5 blur-[150px]" aria-hidden />
          <div className="absolute right-0 top-0 h-[560px] w-[560px] rounded-full bg-indigo-600/10 blur-[150px]" aria-hidden />
          <div className="relative z-10 mx-auto max-w-[1400px]">
            <ScrollReveal>
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Ekosystém Aidvisory</span>
                </div>
                <h2 className="mb-6 font-jakarta text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                  A tím Aidvisora nekončí.
                </h2>
                <p className="text-lg font-medium leading-relaxed text-slate-400 md:text-xl">
                  Spojujeme vše, co řešíte každý den: CRM pro finanční poradce propojuje klienty, dokumenty, e-maily, úkoly, obchody i automatizaci do jednoho plynulého celku.
                </p>
              </div>
            </ScrollReveal>

            <div
              className={`text-center transition-all duration-500 ease-in-out ${
                isCoverageRevealed ? "mb-0 h-0 scale-95 overflow-hidden opacity-0" : "mb-20 h-auto scale-100 opacity-100 md:mb-24"
              }`}
            >
              <div className="glow-btn-wrapper">
                <button
                  type="button"
                  onClick={() => setIsCoverageRevealed(true)}
                  className="group relative flex items-center gap-3 rounded-full border border-white/10 bg-[#0b1021] px-8 py-5 font-jakarta text-lg font-bold text-white transition-all duration-300 hover:bg-white hover:text-[#0b1021]"
                >
                  <Layers className="text-indigo-400 transition-transform group-hover:rotate-12 group-hover:text-indigo-600" size={24} />
                  Zjistit, co vše ještě umíme
                </button>
              </div>
            </div>

            <div
              className={`grid transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isCoverageRevealed ? "grid-rows-[1fr] opacity-100 reveal-active" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-1 gap-6 pb-12 pt-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                  {COVERAGE_ITEMS.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.id}
                        className="feature-card stagger-card flex h-full flex-col rounded-3xl p-8"
                        style={{ animationDelay: `${index * 0.08}s` }}
                      >
                        <div className="mb-6 flex items-start justify-between gap-4">
                          {feature.logos && feature.logos.length > 0 ? (
                            <div className="flex shrink-0 items-center gap-2">
                              {feature.logos.map((logo) => (
                                <div
                                  key={logo.src}
                                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/90 bg-white p-2 shadow-sm"
                                >
                                  <Image
                                    src={logo.src}
                                    alt={logo.alt}
                                    width={32}
                                    height={32}
                                    unoptimized
                                    className="h-8 w-8 object-contain"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                                feature.iconSurface === "white"
                                  ? "border-white bg-white p-2"
                                  : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
                              }`}
                            >
                              {feature.logoSrc ? (
                                <Image
                                  src={feature.logoSrc}
                                  alt={feature.logoAlt ?? feature.title}
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 object-contain"
                                />
                              ) : (
                                <Icon className="text-indigo-400" size={24} strokeWidth={2} />
                              )}
                            </div>
                          )}
                          <span
                            className={`whitespace-nowrap rounded-full border px-3 py-1 font-jakarta text-[10px] font-bold uppercase tracking-widest ${COVERAGE_BADGE_CLASS[feature.badge]}`}
                          >
                            {feature.badge}
                          </span>
                        </div>

                        <div>
                          <h3 className="mb-4 font-jakarta text-xl font-bold leading-tight text-white">{feature.title}</h3>
                          <ul className="space-y-3">
                            {feature.bullets.map((bullet) => (
                              <li key={bullet} className="flex items-start gap-2.5 text-sm font-medium text-slate-400">
                                <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-indigo-500" />
                                <span className="leading-snug">{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pb-20 text-center md:pb-24">
                  <button
                    type="button"
                    onClick={() => setIsCoverageRevealed(false)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-jakarta text-sm font-bold text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <ChevronUp size={16} />
                    Skrýt další funkce
                  </button>
                </div>
              </div>
            </div>

            <ScrollReveal delay={100}>
              <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-indigo-500/20 bg-gradient-to-br from-indigo-900/40 to-[#0b1021] p-10 text-center shadow-2xl shadow-indigo-900/20 md:p-14">
                <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden />
                <div className="relative z-10">
                  <h3 className="mb-8 font-jakarta text-2xl font-extrabold text-white md:text-3xl">
                    Připraveni posunout svoje poradenství na novou úroveň?
                  </h3>
                  <div className="flex flex-col items-center justify-center gap-4 md:flex-row md:gap-6">
                    <Link
                      href="/prihlaseni?register=1"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-jakarta text-base font-bold text-[#0b1021] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105 hover:bg-indigo-50 sm:w-auto"
                    >
                      Vyzkoušet zdarma na {trialDaysLabel} <ArrowRight size={18} />
                    </Link>
                    <a
                      href={DEMO_BOOKING_MAILTO}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-jakarta text-base font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
                    >
                      <PlayCircle size={18} className="text-indigo-400" />
                      Ukázka z praxe
                    </a>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <div className="mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-slate-800 to-transparent" aria-hidden />

        {/* === TRUST / BEZPEČNOST (copy z marketing RTF) === */}
        <section aria-labelledby="trust-heading" className="relative z-10 px-6 py-32">
          <div className="mx-auto max-w-6xl">
            <ScrollReveal>
              <div className="flex flex-col items-center gap-20 lg:flex-row">
                <div className="lg:w-1/2">
                  <h2
                    id="trust-heading"
                    className="mb-8 font-jakarta text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl"
                  >
                    Střízlivě
                    <br />
                    o bezpečnosti.
                  </h2>
                  <p className="mb-8 max-w-xl text-lg font-medium leading-relaxed text-slate-400">
                    Aidvisora pracuje s citlivými klientskými daty, proto musí být jasné, kdo co vidí a kdo co může upravit. Držíme se doložitelných věcí: data v EU, role a oprávnění, dohledatelnost akcí a oddělené prostory pro firmy a týmy. Více popisujeme na stránce{" "}
                    <Link
                      href="/bezpecnost"
                      className="text-indigo-300 hover:text-indigo-200 underline underline-offset-4 decoration-indigo-400/30 transition-colors"
                    >
                      Bezpečnost
                    </Link>
                    .
                  </p>
                  <p className="text-sm text-slate-500">
                    Kontakt pro bezpečnostní dotazy:{" "}
                    <a
                      href={`mailto:${LEGAL_SECURITY_EMAIL}`}
                      className="hover:text-slate-300 transition-colors"
                    >
                      {LEGAL_SECURITY_EMAIL}
                    </a>
                  </p>
                </div>

                <div className="w-full space-y-4 lg:w-1/2">
                  <TrustRow
                    icon={Server}
                    tone="emerald"
                    title="Hosting v EU"
                    desc="Poskytovatelé v EU, šifrování při přenosu i uložení."
                  />
                  <TrustRow
                    icon={Lock}
                    tone="indigo"
                    title="Role a audit stopa"
                    desc="Oddělené prostory pro firmy a týmy, role Manažer / Poradce / Asistent, záznam citlivých akcí."
                  />
                  <TrustRow
                    icon={Scale}
                    tone="emerald"
                    title="Česká s.r.o., CZ právo"
                    desc="Fakturace v CZK, DPA, VOP a Zásady zpracování v češtině."
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </div>

      {/* === PRICING === */}
      <section id="cenik" className="py-20 md:py-28 px-5 md:px-8 bg-[#060918] border-t border-white/10 scroll-mt-24">
        <div className="max-w-[1200px] mx-auto">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="font-jakarta text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
                Tarify Start, Pro a Management
              </h2>
              <p className="text-base md:text-lg text-slate-400 leading-relaxed">
                Rozdíl je hlavně v rozsahu klientského portálu, AI práce s PDF, Google napojení podle nastavení a v týmových přehledech. Tarif můžete měnit podle vývoje praxe.
              </p>

              <div className="inline-flex bg-white/5 border border-white/10 rounded-full p-1 mt-8">
                <button
                  type="button"
                  className={`min-h-[40px] px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                    !isAnnualPricing ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setIsAnnualPricing(false)}
                >
                  Měsíčně
                </button>
                <button
                  type="button"
                  className={`min-h-[40px] px-5 py-2 rounded-full text-sm font-bold inline-flex items-center gap-2 transition-colors ${
                    isAnnualPricing ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setIsAnnualPricing(true)}
                >
                  Ročně{" "}
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full tracking-wider">
                    −{ANNUAL_BILLING_DISCOUNT_PERCENT}&nbsp;%
                  </span>
                </button>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-7 items-stretch">
            <PricingCard
              name="Start"
              tagline={PUBLIC_PLAN_TAGLINE.start}
              monthly={priceStart}
              annual={isAnnualPricing}
              includes={PUBLIC_PLAN_INCLUDES.start}
              excludes={PUBLIC_PLAN_START_EXCLUDES}
              trialDaysLabel={trialDaysLabel}
            />
            <PricingCard
              featured
              name="Pro"
              tagline={PUBLIC_PLAN_TAGLINE.pro}
              monthly={pricePro}
              annual={isAnnualPricing}
              includes={PUBLIC_PLAN_INCLUDES.pro}
              trialDaysLabel={trialDaysLabel}
            />
            <PricingCard
              name="Management"
              tagline={PUBLIC_PLAN_TAGLINE.management}
              monthly={priceMgmt}
              annual={isAnnualPricing}
              includes={PUBLIC_PLAN_INCLUDES.management}
              trialDaysLabel={trialDaysLabel}
            />
          </div>

          <ScrollReveal delay={100}>
            <div className="mt-10 max-w-3xl mx-auto text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ceny jsou konečné za jednu organizaci v systému. Zkušební verze {trialDaysLabel} v úrovni Pro.
                Rozsah seatů u větších týmů{" "}
                <a href={DEMO_BOOKING_MAILTO} className="text-indigo-300 hover:text-white underline underline-offset-2">
                  doladíme na demu
                </a>
                .
              </p>
              <p className="text-[11px] text-slate-500 mt-2">Nejsme plátci DPH.</p>
              <p className="text-[11px] text-slate-600 mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <Link href="/cookies" className="hover:text-slate-400 underline-offset-4 hover:underline">Cookies</Link>
                <span aria-hidden>·</span>
                <Link href="/subprocessors" className="hover:text-slate-400 underline-offset-4 hover:underline">Subdodavatelé</Link>
                <span aria-hidden>·</span>
                <Link href="/legal/ai-disclaimer" className="hover:text-slate-400 underline-offset-4 hover:underline">AI disclaimer</Link>
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* === FAQ === */}
      <section id="faq" className="scroll-mt-24 border-t border-white/10 bg-[#0a0f29] px-6 py-24">
        <div className="relative z-10 mx-auto max-w-[1140px]">
          <ScrollReveal>
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-300 mb-6">
                <Sparkles size={13} className="text-indigo-400" />
                Nápověda k platformě
              </div>
              <h2 className="font-jakarta text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                Časté otázky
              </h2>
              <p className="text-slate-400 text-sm md:text-lg max-w-xl mx-auto font-medium">
                Vše, co typicky chcete vědět před spuštěním.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              {FAQS.slice(0, faqSplitIndex).map((faq) => (
                <FaqAccordionItem
                  key={faq.id}
                  faq={faq}
                  expanded={openFaq === faq.id}
                  onToggle={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {FAQS.slice(faqSplitIndex).map((faq) => (
                <FaqAccordionItem
                  key={faq.id}
                  faq={faq}
                  expanded={openFaq === faq.id}
                  onToggle={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm sm:flex-row">
            <div className="text-center sm:text-left">
              <h3 className="text-lg md:text-xl font-jakarta font-bold text-white mb-2">Nenašli jste svou odpověď?</h3>
              <p className="text-sm text-slate-400 font-medium">Náš tým je připraven vám se vším poradit.</p>
            </div>
            <a
              href={`mailto:${LEGAL_PODPORA_EMAIL}?subject=${encodeURIComponent("Dotaz z webu — Aidvisora")}`}
              className="inline-flex shrink-0 items-center gap-2 min-h-[48px] px-6 py-3.5 bg-white text-[#0a0f29] rounded-xl text-sm font-jakarta font-bold transition-colors hover:bg-indigo-50"
            >
              <MessageSquare size={16} aria-hidden />
              Napište nám
            </a>
          </div>
        </div>
      </section>

      {/* === FOOTER CTA === */}
      <section className="relative overflow-hidden py-20 md:py-28 px-5 md:px-8 border-t border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-900/10 to-indigo-900/25 pointer-events-none" aria-hidden />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <ScrollReveal>
            <h2 className="font-jakarta text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-5">
              Otevřete Aidvisoru a rozhodněte se sami.
            </h2>
            <p className="text-base md:text-lg text-slate-400 leading-relaxed mb-8">
              {trialDaysLabel} zdarma, žádná karta dopředu. Stejné prostředí jako po přihlášení poradce — CRM,
              portál i kalendář.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                href="/prihlaseni?register=1"
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3.5 bg-white text-[#0a0f29] rounded-full text-base font-bold hover:bg-slate-100 transition-colors shadow-[0_10px_40px_-10px_rgba(255,255,255,0.3)]"
              >
                Založit účet — {trialDaysLabel} zdarma <ArrowRight size={16} />
              </Link>
              <a
                href={DEMO_BOOKING_MAILTO}
                className="inline-flex items-center justify-center min-h-[48px] px-7 py-3.5 border border-white/20 text-white rounded-full text-base font-bold hover:bg-white/10 transition-colors"
              >
                Domluvit demo
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="bg-[#060918] text-slate-500 py-14 px-5 md:px-8 border-t border-white/10">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center mb-5">
              <Image
                src="/logos/Aidvisora%20logo%20new.png"
                alt="Aidvisora"
                width={220}
                height={48}
                loading="lazy"
                sizes="(max-width: 768px) 50vw, 220px"
                className="h-9 w-auto max-w-[200px] object-contain object-left brightness-0 invert"
              />
            </Link>
            <p className="text-sm max-w-sm leading-relaxed mb-3">
              Pracovní systém pro finanční poradce a týmy. CRM, klientský portál a další kroky na jednom místě.
            </p>
            <p className="text-xs">
              <a href={`mailto:${LEGAL_PODPORA_EMAIL}`} className="hover:text-white transition-colors">
                {LEGAL_PODPORA_EMAIL}
              </a>
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 font-jakarta text-sm tracking-wide">Produkt</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#showcase" className="hover:text-white transition-colors">Ukázky z aplikace</a></li>
              <li><a href="#cenik" className="hover:text-white transition-colors">Ceník a tarify</a></li>
              <li><Link href="/o-nas" className="hover:text-white transition-colors">O nás</Link></li>
              <li><Link href="/pro-brokery" className="hover:text-white transition-colors">Pro brokery a firmy</Link></li>
              <li><Link href="/prihlaseni" className="hover:text-white transition-colors">Přihlášení</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 font-jakarta text-sm tracking-wide">Právní a podpora</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/bezpecnost" className="hover:text-white transition-colors">Bezpečnost</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Obchodní podmínky</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Zásady ochrany (GDPR)</Link></li>
              <li><Link href="/legal/zpracovatelska-smlouva" className="hover:text-white transition-colors">DPA</Link></li>
              <li><Link href="/legal/ai-disclaimer" className="hover:text-white transition-colors">AI disclaimer</Link></li>
              <li><Link href="/subprocessors" className="hover:text-white transition-colors">Subdodavatelé</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
              <li><Link href="/kontakt" className="hover:text-white transition-colors">Kontakt</Link></li>
              <li><Link href="/status" className="hover:text-white transition-colors">Provozní stav</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Aidvisora. Všechna práva vyhrazena.</p>
          <p className="text-center md:text-right">
            Vytvořila{" "}
            <a
              href="https://www.m2digitalagency.cz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white underline-offset-2 hover:underline font-semibold"
            >
              M2DigitalAgency
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// === Lokalní helpery (mimo hlavní komponentu pro čitelnost) ===

type LandingFaqItem = (typeof LANDING_FAQS)[number];

function FaqAccordionItem({
  faq,
  expanded,
  onToggle,
}: {
  faq: LandingFaqItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all duration-300 ${
        expanded
          ? "border border-indigo-500/30 bg-[#131B2F]/80 shadow-[0_8px_30px_rgba(90,75,255,0.1)]"
          : "border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
      }`}
    >
      <button
        type="button"
        id={`faq-q-${faq.id}`}
        aria-expanded={expanded}
        aria-controls={`faq-p-${faq.id}`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
      >
        <span
          className={`pr-2 font-jakarta text-[15px] font-bold leading-snug ${
            expanded ? "text-indigo-300" : "text-slate-200"
          }`}
        >
          {faq.q}
        </span>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            expanded ? "rotate-180 bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {expanded ? <Minus size={16} strokeWidth={2.5} aria-hidden /> : <Plus size={16} strokeWidth={2.5} aria-hidden />}
        </div>
      </button>
      <div
        id={`faq-p-${faq.id}`}
        role="region"
        aria-labelledby={`faq-q-${faq.id}`}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <p
            className={`px-6 text-sm font-medium leading-relaxed text-slate-400 ${
              expanded ? "pb-6 opacity-100" : "pb-0 opacity-0"
            }`}
          >
            {faq.a}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustRow({
  icon: Icon,
  tone,
  title,
  desc,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: "emerald" | "indigo";
  title: string;
  desc: string;
}) {
  const toneMap = {
    emerald: "text-emerald-400",
    indigo: "text-indigo-400",
  } as const;
  return (
    <div className="flex items-start gap-5 rounded-2xl border border-white/[0.05] bg-slate-900/40 p-6 transition-all duration-300 hover:border-white/10 hover:bg-slate-800/60">
      <div className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center ${toneMap[tone]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="mb-1 font-jakarta text-base font-bold text-white">{title}</p>
        <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  tagline,
  monthly,
  annual,
  includes,
  excludes,
  featured,
  trialDaysLabel,
}: {
  name: string;
  tagline: string;
  monthly: number;
  annual: boolean;
  includes: readonly string[];
  excludes?: readonly string[];
  featured?: boolean;
  trialDaysLabel: string;
}) {
  const displayedPrice = annual ? effectiveMonthlyKcWhenBilledAnnually(monthly) : monthly;
  const yearlyTotal = yearlyTotalKcFromMonthlyList(monthly);
  const yearlySavings = annualSavingsVersusTwelveMonthly(monthly);

  const card = (
    <div
      className={`relative h-full rounded-[28px] p-7 md:p-8 flex flex-col ${
        featured ? "bg-[#0a0f29]" : "bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition-colors"
      }`}
    >
      {featured ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
          Nejvyužívanější
        </div>
      ) : null}

      <h3 className="font-jakarta text-xl md:text-2xl font-bold text-white mb-1">{name}</h3>
      <p className="text-sm text-slate-400 mb-5">{tagline}</p>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl md:text-5xl font-black text-white tabular-nums">
          {formatPublicPriceKc(displayedPrice)}
        </span>
        <span className="text-sm text-slate-500 font-medium">Kč / měs.</span>
      </div>
      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-1">
        {annual ? "Ekvivalent při roční fakturaci" : "Fakturováno měsíčně"}
      </p>
      {annual ? (
        <p className="text-[11px] text-slate-500 mb-5">
          Celkem {formatPublicPriceKc(yearlyTotal)} Kč / rok · úspora {formatPublicPriceKc(yearlySavings)} Kč
        </p>
      ) : (
        <div className="mb-5" />
      )}

      <Link
        href="/prihlaseni?register=1"
        className={`w-full inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-xl text-sm font-bold transition-colors mb-2 ${
          featured
            ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)]"
            : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
        }`}
      >
        Založit účet — {trialDaysLabel} zdarma
      </Link>
      <Link
        href="/prihlaseni"
        className={`block w-full py-2.5 text-sm font-medium text-center transition-colors mb-6 ${
          featured ? "text-indigo-200/90 hover:text-white" : "text-slate-400 hover:text-white"
        }`}
      >
        Už mám účet — přihlásit se
      </Link>

      <ul className="space-y-2.5 mb-5">
        {includes.map((line) => (
          <li key={line} className={`flex items-start gap-2.5 text-sm ${featured ? "text-white font-medium" : "text-slate-300"}`}>
            <Check size={17} className={`shrink-0 mt-0.5 ${featured ? "text-emerald-400" : "text-indigo-400"}`} />
            {line}
          </li>
        ))}
      </ul>

      {excludes && excludes.length > 0 ? (
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">V ceně Start nejsou</p>
          <ul className="space-y-1.5">
            {excludes.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-xs text-slate-500">
                <XCircle size={14} className="text-slate-600 shrink-0 mt-0.5" /> {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  if (featured) {
    return (
      <div className="pro-pricing-wrapper md:scale-[1.02] shadow-[0_30px_60px_-30px_rgba(139,92,246,0.45)]">
        <div className="pro-pricing-inner">{card}</div>
      </div>
    );
  }
  return card;
}