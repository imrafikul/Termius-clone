import React, { useState } from 'react';
import { Network, ShieldCheck, Globe, Layers, ExternalLink, Lock, Send } from 'lucide-react';

interface PublicHomeScreenProps {
  onLoginWithGoogle: () => Promise<void>;
  authLoading: boolean;
}

const VENDOR_GROUPS = [
  {
    category: 'OLT Platforms',
    vendors: 'Huawei · ZTE · BDCOM · VSOL · C-Data',
  },
  {
    category: 'Core Routers',
    vendors: 'MikroTik · Cisco · Juniper · Palo Alto',
  },
  {
    category: 'Managed Switches',
    vendors: 'Arista · Ruijie · TP-Link',
  },
];

export const PublicHomeScreen: React.FC<PublicHomeScreenProps> = ({
  onLoginWithGoogle,
  authLoading,
}) => {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (signingIn || authLoading) return;
    setSigningIn(true);
    try {
      await onLoginWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-950 flex flex-col font-sans">
      {/* Minimal 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            className="flex items-center gap-2.5 text-slate-950 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-md"
          >
            <span className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-950 shrink-0">
              <Network className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-sm sm:text-base font-bold tracking-tight">
              Universal WebUI for Network Engineer
            </span>
          </a>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#unified-interface"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Unified Interface
            </a>
            <a
              href="#multi-vendor-webui"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Multi-Vendor WebUI
            </a>
            <a
              href="https://t.me/merafikul"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 font-mono text-xs"
            >
              t.me/merafikul
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn || authLoading}
              className="px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <span>{signingIn ? 'Signing in...' : 'Login with Google'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Public Content — Strictly Unified Web Interface + Multi-Vendor OLT, Router & Switch WebUI */}
      <main className="flex-1 flex flex-col justify-center">
        <section
          aria-labelledby="hero-heading"
          className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-14 sm:py-20"
        >
          <div className="max-w-3xl space-y-6">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Unified Web Interface</span>
              <span aria-hidden="true">·</span>
              <span>Multi-Vendor OLT, Router &amp; Switch WebUI</span>
            </p>

            <h1
              id="hero-heading"
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.12] text-balance"
            >
              Universal WebUI for Network Engineer
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
              A single unified web interface built for ISP and enterprise network engineers to
              manage multi-vendor OLTs, core routers, and managed switches from one secure
              workspace.
            </p>

            {/* Primary Authentication Action + Firebase Security Proof */}
            <div className="pt-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={signingIn || authLoading}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {authLoading
                      ? 'Checking Google Session...'
                      : signingIn
                      ? 'Signing in with Google...'
                      : 'Login with Google Account'}
                  </span>
                </button>

                <a
                  href="https://t.me/merafikul"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <Send className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs sm:text-sm">t.me/merafikul</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                </a>
              </div>

              {/* Secured by Google Firebase Trust Strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 pt-1">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>Secured by Google Firebase</span>
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  <span>Sign in with your Google Account to access your private workspace</span>
                </span>
              </div>
            </div>
          </div>

          {/* Two Core Architecture Blocks — Unified Web Interface + Multi-Vendor OLT, Router & Switch WebUI */}
          <div className="mt-14 pt-10 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <article
              id="unified-interface"
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Layers className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <h2 className="text-base font-bold tracking-tight">
                    01. Unified Web Interface
                  </h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Operate your entire ISP and core network from one clean browser console. Every
                  change made inside the graphical WebUI translates directly into vendor-accurate
                  CLI execution.
                </p>
              </div>
              <p className="text-xs text-slate-500 pt-3 border-t border-slate-200">
                Single sign-in workspace · Isolated per Google account · Secured by Google Firebase
              </p>
            </article>

            <article
              id="multi-vendor-webui"
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900">
                  <Globe className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <h2 className="text-base font-bold tracking-tight">
                    02. Multi-Vendor OLT, Router &amp; Switch WebUI
                  </h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Dedicated graphical management tailored to official hardware datasheets across
                  12 leading networking brands.
                </p>
              </div>

              <dl className="space-y-2 pt-3 border-t border-slate-200 text-xs">
                {VENDOR_GROUPS.map((group) => (
                  <div
                    key={group.category}
                    className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4"
                  >
                    <dt className="font-semibold text-slate-800 whitespace-nowrap">
                      {group.category}
                    </dt>
                    <dd className="font-mono text-slate-600 sm:text-right">{group.vendors}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </section>
      </main>

      {/* Quiet Semantic Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 sm:px-6 text-xs text-slate-600">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-semibold text-slate-900">
              Universal WebUI for Network Engineer
            </span>
            <span aria-hidden="true">·</span>
            <span>Secured by Google Firebase</span>
          </div>
          <a
            href="https://t.me/merafikul"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-slate-800 hover:text-black underline underline-offset-4 whitespace-nowrap"
          >
            t.me/merafikul
          </a>
        </div>
      </footer>
    </div>
  );
};
