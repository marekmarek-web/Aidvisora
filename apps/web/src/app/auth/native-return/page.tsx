"use client";

import { useEffect, useState } from "react";

const DEEP_LINK = "aidvisora://auth/done";
const INTENT_FALLBACK =
  "intent://auth/done#Intent;scheme=aidvisora;package=cz.aidvisor.app;end";

export default function NativeReturnPage() {
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    window.location.href = DEEP_LINK;

    const t1 = setTimeout(() => {
      window.location.href = INTENT_FALLBACK;
    }, 800);

    const t2 = setTimeout(() => setShowManual(true), 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      style={{
        background: "#060918",
        color: "white",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        margin: 0,
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{
            width: 48,
            height: 48,
            border: "3px solid rgba(255,255,255,0.2)",
            borderTopColor: "#818cf8",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 1.5rem",
          }}
        />
        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Přesměrování do aplikace…
        </p>
        <p style={{ fontSize: 14, opacity: 0.5 }}>
          Přihlášení proběhlo úspěšně.
        </p>

        {showManual && (
          <a
            href={DEEP_LINK}
            style={{
              display: "inline-block",
              marginTop: 24,
              padding: "14px 32px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "white",
              borderRadius: 16,
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Otevřít aplikaci
          </a>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
