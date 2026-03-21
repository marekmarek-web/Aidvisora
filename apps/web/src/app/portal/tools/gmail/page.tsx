import { GmailWorkspace } from "../_components/GmailWorkspace";

export const dynamic = "force-dynamic";

export default function PortalToolsGmailPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
      <GmailWorkspace />
    </div>
  );
}
