"use client";

import { use } from "react";
import type { DashboardSecondaryBundle } from "./dashboard-secondary-types";

export function DashboardSecondaryResolver({
  promise,
  children,
}: {
  promise: Promise<DashboardSecondaryBundle>;
  children: (data: DashboardSecondaryBundle) => React.ReactNode;
}) {
  const data = use(promise);
  return <>{children(data)}</>;
}
