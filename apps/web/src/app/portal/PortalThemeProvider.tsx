"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useRef, type ReactNode } from "react";

const STORAGE_KEY = "aidvisora-theme";
const LEGACY_KEYS = ["theme", "color-theme", "aidvisora-color-mode"] as const;
function normalizeStoredTheme(raw: string | null | undefined): "light" | "dark" | "system" | null {
  if (raw == null || raw === "") return null;
  const t = raw.trim().toLowerCase();
  if (t === "light" || t === "white" || t === "svetly" || t === "světlý") return "light";
  if (t === "dark" || t === "tmavy" || t === "tmavý" || t === "night") return "dark";
  if (t === "system" || t === "auto") return "system";
  return null;
}

/** Zkopíruje motiv ze starých klíčů do aidvisora-theme. */
function ThemeLegacyKeysMigrate() {
  const { setTheme } = useTheme();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    try {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        const n = normalizeStoredTheme(legacy);
        if (n != null) {
          localStorage.setItem(STORAGE_KEY, n);
          setTheme(n);
          return;
        }
      }
      const primary = localStorage.getItem(STORAGE_KEY);
      const again = normalizeStoredTheme(primary);
      if (again == null && primary != null && primary !== "") {
        localStorage.setItem(STORAGE_KEY, "system");
        setTheme("system");
      }
    } catch {
      /* noop */
    }
  }, [setTheme]);

  return null;
}

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={STORAGE_KEY}
      themes={["light", "dark", "system"]}
      disableTransitionOnChange
    >
      <ThemeLegacyKeysMigrate />
      {children}
    </ThemeProvider>
  );
}
