"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FundLibrarySetupSnapshot } from "@/lib/fund-library/fund-library-setup-types";

const FundLibraryFaContext = createContext<FundLibrarySetupSnapshot | null>(null);

export function FundLibraryFaProvider({
  snapshot,
  children,
}: {
  snapshot: FundLibrarySetupSnapshot;
  children: ReactNode;
}) {
  return <FundLibraryFaContext.Provider value={snapshot}>{children}</FundLibraryFaContext.Provider>;
}

export function useFundLibraryFaSnapshot(): FundLibrarySetupSnapshot | null {
  return useContext(FundLibraryFaContext);
}
