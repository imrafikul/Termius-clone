import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Share2, X, ChevronDown, Package, Copy, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'header' | 'banner' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (isInstalled && variant === 'header') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
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
      setShowMenu(true);
    }
  };

  if (variant === 'banner') {
    if (isInstalled) return null;
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-slate-300 text-black shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-black text-sm sm:text-base">
                  Install Universal WebUI for Network Engineer on Android / Mobile
                </h4>
                <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                  · Ready To Use
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                এক ক্লিকে আপনার ফোনে ইনস্টল করুন। ব্যাকগ্রাউন্ড VPN এবং রুটলেস স্প্লিট-টানেল সাপোর্ট।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleInstallClick}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{isIOS ? 'Install on iPhone' : 'Install App (Ready to Use)'}</span>
            </button>
            <a
              href="/api/download-zip"
              className="px-3 py-2 rounded-lg border border-slate-300 hover:border-black bg-white hover:bg-slate-100 text-black text-xs font-mono font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
              title="Download Android Kotlin/Flutter Source (.zip)"
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Source ZIP</span>
            </a>
          </div>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left text-black">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2 text-black">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-bold text-black">iPhone / iPad এ ইনস্টল করুন</h3>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded text-slate-600 hover:text-black cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-800">
                <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                    1
                  </span>
                  <div>
                    Safari ব্রাউজারের নিচের <Share2 className="w-3.5 h-3.5 inline mx-1 text-black" /> <strong>Share</strong> বাটনে ট্যাপ করুন।
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                    2
                  </span>
                  <div>
                    নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> (হোম স্ক্রিনে যোগ করুন) সিলেক্ট করুন।
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                    3
                  </span>
                  <div>
                    উপরে <strong>&quot;Add&quot;</strong> এ চাপুন। এরপর ফোনের হোম স্ক্রিন থেকে ফুল-স্ক্রিন অ্যাপ হিসেবে চালু করুন।
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full py-2.5 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black font-semibold text-xs active:scale-95 transition cursor-pointer whitespace-nowrap"
          title="Install App directly on your Phone or Desktop"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-lg border border-slate-300 hover:border-black bg-white text-black transition cursor-pointer"
          title="App installation options"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Options */}
      {showMenu && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs text-black"
          onMouseLeave={() => setShowMenu(false)}
        >
          <div className="px-3 py-2 border-b border-slate-200 mb-1">
            <p className="font-bold text-black">Universal WebUI for Network Engineer</p>
            <p className="text-[11px] text-slate-600">মোবাইল ও পিসিতে ব্যবহারের উপায়</p>
          </div>

          <button
            onClick={() => {
              setShowMenu(false);
              handleInstallClick();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-black" />
            <div>
              <div className="font-semibold text-black">1-Click Mobile App (PWA)</div>
              <div className="text-[11px] text-slate-600">ফোনের হোমস্ক্রিনে অ্যাপ ইনস্টল করুন</div>
            </div>
          </button>

          <a
            href="/api/download-zip"
            download="universal-webui-network-engineer.zip"
            onClick={() => setShowMenu(false)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black"
          >
            <Package className="w-4 h-4 text-emerald-700" />
            <div>
              <div className="font-semibold text-black">Download Android / Flutter App (.zip)</div>
              <div className="text-[11px] text-slate-600">Full Source + Auto APK Builder</div>
            </div>
          </a>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 1800);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4 text-slate-700" />}
            <div>
              <div className="font-semibold text-black">{copiedLink ? 'App Link Copied!' : 'Copy Direct App Link'}</div>
              <div className="text-[11px] text-slate-600">Chrome/Edge-এ খুলে Test ও Install করুন</div>
            </div>
          </button>

          <div className="mt-1 pt-1 border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-600">
            Tip: Chrome / Edge ব্রাউজারে &quot;Install app&quot; ও USB Console Cable সরাসরি কাজ করে।
          </div>
        </div>
      )}

      {/* iOS Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left text-black">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-black">
                <Smartphone className="w-5 h-5" />
                <h3 className="font-bold text-black">iPhone / iPad এ ইনস্টল করুন</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded text-slate-600 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-800">
              <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                  1
                </span>
                <div>
                  Safari ব্রাউজারের নিচের <strong>Share</strong> বাটনে ট্যাপ করুন।
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                  2
                </span>
                <div>
                  নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> চাপুন।
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-[11px]">
                  3
                </span>
                <div>
                  উপরের ডান কোণে <strong>&quot;Add&quot;</strong> চাপুন।
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
