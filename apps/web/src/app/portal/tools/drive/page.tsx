import { DriveWorkspace } from "../_components/DriveWorkspace";

export const dynamic = "force-dynamic";

export default function PortalToolsDrivePage() {
  return (
    <div className="h-[calc(100vh-80px)] min-h-[500px] -mx-2 -my-2 md:-mx-4 md:-my-4">
      <DriveWorkspace />
    </div>
  );
}
