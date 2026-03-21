import { GmailWorkspace } from "../_components/GmailWorkspace";

export const dynamic = "force-dynamic";

export default function PortalToolsGmailPage() {
  return (
    <div className="h-[calc(100vh-80px)] min-h-[500px] -mx-2 -my-2 md:-mx-4 md:-my-4">
      <GmailWorkspace />
    </div>
  );
}
