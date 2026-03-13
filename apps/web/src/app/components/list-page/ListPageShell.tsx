"use client";

/**
 * Page wrapper for list/overview modules: max-w-[1600px], consistent padding, space-y-6.
 * Children: header, toolbar, content.
 */
export function ListPageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1600px] mx-auto space-y-4 md:space-y-6 p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}
