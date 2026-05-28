import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-white shrink-0">
            X
          </div>
          <span className="font-bold text-lg tracking-tight uppercase text-white">XANDA</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link href="/sign-up" className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-400 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500" />
              </span>
              All your messages in one place
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white leading-tight">
              One inbox for<br />
              <span className="text-indigo-400">every conversation</span>
            </h1>
            <p className="text-xl text-slate-400 max-w-lg mx-auto">
              Connect WhatsApp, Gmail, LinkedIn and more. Xanda Cross brings all your messages together with AI-powered assistance.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors">
              Start for free
            </Link>
            <Link href="/sign-in" className="text-slate-300 hover:text-white px-8 py-3 rounded-lg font-semibold text-base border border-slate-700 hover:border-slate-600 transition-colors">
              Sign in
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-slate-500">
            {["WhatsApp", "Gmail", "LinkedIn", "Telegram", "Instagram"].map((p) => (
              <span key={p} className="font-medium">{p}</span>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Xanda Cross. All rights reserved.
      </footer>
    </div>
  );
}
