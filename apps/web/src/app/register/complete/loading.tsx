import { AidvisoraLogoShimmerLoader } from "@/app/components/AidvisoraLogoShimmerLoader";

export default function RegisterCompleteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060607] p-6">
      <AidvisoraLogoShimmerLoader
        darkSurface
        wideLogo
        caption="Připravujeme váš pracovní prostor…"
        logoSrc="/logos/aidvisora-wordmark-dark.png"
        logoWidth={400}
        logoHeight={104}
      />
    </div>
  );
}
