"use client";

export interface CalculatorCtaBlockProps {
  title: string;
  description: string;
  cta: React.ReactNode;
}

export function CalculatorCtaBlock({ title, description, cta }: CalculatorCtaBlockProps) {
  return (
    <div className="mt-12">
      <div className="bg-gradient-to-r from-[#0a0f29] to-[#1e3a6e] rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#fbbf24] opacity-10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#fbbf24] opacity-10 rounded-full blur-xl -ml-10 -mb-10" />

        <h2 className="text-3xl font-extrabold text-white mb-4 relative z-10">
          {title}
        </h2>
        <p className="text-lg text-blue-100 max-w-3xl mx-auto mb-8 relative z-10">
          {description}
        </p>
        <div className="relative z-10">{cta}</div>
      </div>
    </div>
  );
}
