import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Share2, HelpCircle, X, ChevronDown, Package } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'header' | 'banner' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // If already installed and running standalone
  if (isInstalled && variant === 'header') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
        <span>App Installed</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Ambient fallback on desktop or unsupported browser
      setShowMenu(true);
    }
  };

  if (variant === 'banner') {
    if (isInstalled) return null;
    return (
      <div className={`relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-950 p-4 shadow-xl ${className}`}>
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 shrink-0">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-100 text-sm sm:text-base">
                  Install PPTP Solution on Android / Mobile
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Ready To Use
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                এক ক্লিকে আপনার ফোনে ইনস্টল করুন। ব্যাকগ্রাউন্ড VPN এবং রুটলেস স্প্লিট-টানেল সাপোর্ট।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isIOS ? 'Install on iPhone' : 'Install App (Ready to Use)'}</span>
            </button>
            <a
              href="/api/download-zip"
              className="px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition"
              title="Download Android Kotlin/Flutter Source (.zip)"
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Source ZIP</span>
            </a>
          </div>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-100">iPhone / iPad এ ইনস্টল করুন</h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                    1
                  </span>
                  <div>
                    Safari ব্রাউজারের নিচের <Share2 className="w-3.5 h-3.5 inline mx-1 text-cyan-400" /> <strong>Share</strong> বাটনে ট্যাপ করুন।
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                    2
                  </span>
                  <div>
                    নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> (হোম স্ক্রিনে যোগ করুন) সিলেক্ট করুন।
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                    3
                  </span>
                  <div>
                    উপরে <strong>&quot;Add&quot;</strong> এ চাপুন। এরপর ফোনের হোম স্ক্রিন থেকে ফুল-স্ক্রিন অ্যাপ হিসেবে চালু করুন।
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
              >
                ঠিক আছে, বুঝতে পেরেছি
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Header Variant
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition cursor-pointer"
          title="Install App directly on your Phone or Desktop"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-800 text-slate-300 hover:text-white transition"
          title="App installation options"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Options */}
      {showMenu && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl z-50 text-xs"
          onMouseLeave={() => setShowMenu(false)}
        >
          <div className="px-3 py-2 border-b border-slate-800 mb-1">
            <p className="font-semibold text-slate-200">PPTP Solution Installer</p>
            <p className="text-[11px] text-slate-400">মোবাইল ও পিসিতে ব্যবহারের উপায়</p>
          </div>

          <button
            onClick={() => {
              setShowMenu(false);
              handleInstallClick();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5 text-slate-200 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="font-medium text-cyan-300">1-Click Mobile App (PWA)</div>
              <div className="text-[11px] text-slate-400">ফোনের হোমস্ক্রিনে অ্যাপ ইনস্টল করুন</div>
            </div>
          </button>

          <a
            href="/api/download-zip"
            onClick={() => setShowMenu(false)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2.5 text-slate-200"
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-medium text-emerald-300">Android Native & Flutter Source</div>
              <div className="text-[11px] text-slate-400">Download complete project (.zip)</div>
            </div>
          </a>

          <div className="mt-1 pt-1 border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-500">
            Tip: Chrome / Edge ব্রাউজারে &quot;Install app&quot; আইকন থাকে।
          </div>
        </div>
      )}

      {/* iOS Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="font-semibold text-slate-100">iPhone / iPad এ ইনস্টল করুন</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                  1
                </span>
                <div>
                  Safari ব্রাউজারের নিচের <strong>Share</strong> বাটনে ট্যাপ করুন।
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                  2
                </span>
                <div>
                  নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> চাপুন।
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[11px]">
                  3
                </span>
                <div>
                  উপরের ডান কোণে <strong>&quot;Add&quot;</strong> চাপুন।
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
