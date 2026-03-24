"use client";

export function RegisterCompleteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-monday-bg p-4">
      <div className="max-w-md text-center space-y-4">
        <p className="text-red-600 font-medium">Nepodařilo se dokončit registraci.</p>
        {message && (
          <p className="text-sm text-slate-600 bg-slate-100 rounded-lg p-3 font-mono break-all text-left">
            {message}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a href="/" className="text-sm font-semibold text-indigo-600 hover:underline">
            Zpět na přihlášení
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-semibold text-slate-600 hover:underline"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    </div>
  );
}
