import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stránka nenalezena — Aidvisora",
  description: "Požadovaná stránka na aidvisora.cz neexistuje nebo byla přesunuta.",
  robots: { index: false, follow: false },
};

/**
 * Globální 404 pro marketing / landing routy (nested segmenty mají vlastní
 * `not-found.tsx` — portal, client, kontakt detail apod.). Bez tohoto souboru
 * Next vrací default 404 bez brandingu, což kazí první dojem a SEO crawlery.
 */
export default function RootNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(180deg, rgba(244, 247, 252, 1) 0%, rgba(255, 255, 255, 1) 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          textAlign: "center",
          padding: "40px 32px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 2px 12px rgba(17, 24, 39, 0.06)",
          border: "1px solid rgba(17, 24, 39, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: "56px",
            fontWeight: 800,
            color: "#0047FF",
            marginBottom: "8px",
            lineHeight: 1,
          }}
          aria-hidden
        >
          404
        </div>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#0F172A",
            margin: "0 0 10px",
          }}
        >
          Stránka nenalezena
        </h1>
        <p
          style={{
            color: "#475569",
            fontSize: "15px",
            lineHeight: 1.55,
            margin: "0 0 28px",
          }}
        >
          Odkaz, který jste otevřeli, už neexistuje nebo byl přesunut. Zkuste
          přejít zpět na úvod, nebo nás kontaktujte na{" "}
          <a
            href="mailto:podpora@aidvisora.cz"
            style={{ color: "#0047FF", textDecoration: "underline" }}
          >
            podpora@aidvisora.cz
          </a>
          .
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              background: "#0047FF",
              textDecoration: "none",
            }}
          >
            Zpět na úvod
          </Link>
          <Link
            href="/pricing"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0F172A",
              background: "rgba(17, 24, 39, 0.05)",
              textDecoration: "none",
            }}
          >
            Ceník
          </Link>
          <Link
            href="/portal/today"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0F172A",
              background: "rgba(17, 24, 39, 0.05)",
              textDecoration: "none",
            }}
          >
            Přihlásit se do CRM
          </Link>
        </div>
      </div>
    </main>
  );
}
