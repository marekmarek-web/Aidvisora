"use client";

import type { ReactNode } from "react";
import type { DeviceClass } from "@/lib/ui/useDeviceClass";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Consistent horizontal padding and max-width per device class.
 * Use inside MobileScreen / MobileAppShell to constrain content width on tablet.
 */
export function MobilePageLayout({
  children,
  deviceClass = "phone",
  className,
}: {
  children: ReactNode;
  deviceClass?: DeviceClass;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "w-full mx-auto",
        deviceClass === "phone" && "max-w-lg px-0",
        deviceClass === "tablet" && "max-w-3xl px-2",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Master-detail layout:
 * - phone: shows master OR detail based on showDetail flag
 * - tablet: shows master (fixed width sidebar) + detail side by side
 */
export function MasterDetailLayout({
  master,
  detail,
  showDetail,
  deviceClass = "phone",
}: {
  master: ReactNode;
  detail: ReactNode | null;
  showDetail: boolean;
  deviceClass?: DeviceClass;
}) {
  if (deviceClass === "phone") {
    return <>{showDetail ? detail : master}</>;
  }

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cx(
          "overflow-y-auto border-r border-[color:var(--wp-border)] flex-shrink-0",
          showDetail ? "w-[320px]" : "flex-1"
        )}
      >
        {master}
      </div>
      {showDetail && detail ? (
        <div className="flex-1 overflow-y-auto">{detail}</div>
      ) : null}
    </div>
  );
}
