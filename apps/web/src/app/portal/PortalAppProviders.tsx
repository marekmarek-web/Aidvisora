"use client";

import type { ReactNode } from "react";
import { PortalQueryProvider } from "./PortalQueryProvider";

/** Společné klientské providery pro celý `/portal` (desktop i mobilní UI). */
export function PortalAppProviders({ children }: { children: ReactNode }) {
  return <PortalQueryProvider>{children}</PortalQueryProvider>;
}
