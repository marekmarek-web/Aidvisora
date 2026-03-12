"use client";

export interface CalculatorHeroProps {
  title: React.ReactNode;
  subtitle: string;
  /** Left column: e.g. strategy switcher. */
  children?: React.ReactNode;
  /** Optional right column: e.g. rate badge. */
  badge?: React.ReactNode;
}

export function CalculatorHero({ title, subtitle, children, badge }: CalculatorHeroProps) {
  return (
    <div className="bg-gradient-to-br from-[#0a0f29] to-[#1e3a6e] rounded-3xl p-8 md:p-12 text-white mb-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#fbbf24] opacity-10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start gap-8">
        <div className="flex-1">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-blue-100 opacity-90 text-lg mb-8 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
          {children}
        </div>
        {badge && (
          <div className="flex flex-col gap-3 min-w-[240px] shrink-0">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}
