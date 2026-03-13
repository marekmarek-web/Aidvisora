export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] animate-pulse">
      <header className="bg-white/80 border-b border-slate-100 px-4 sm:px-6 md:px-8 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-10 w-36 bg-slate-200 rounded-xl" />
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 flex flex-col md:flex-row gap-6">
          <div className="h-24 w-24 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-100 space-y-4">
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-12 bg-slate-100 rounded-xl" />
            <div className="h-12 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
