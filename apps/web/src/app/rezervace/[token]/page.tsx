import { PublicBookingClient } from "./PublicBookingClient";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token?.trim()) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <p className="text-sm text-slate-600">Neplatný odkaz.</p>
      </div>
    );
  }
  return <PublicBookingClient token={token.trim()} />;
}
