import { DriveWorkspace } from "../_components/DriveWorkspace";

export const dynamic = "force-dynamic";

export default function PortalToolsDrivePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
      <DriveWorkspace />
    </div>
  );
}
