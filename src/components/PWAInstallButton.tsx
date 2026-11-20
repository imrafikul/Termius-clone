import React, { useState, useRef } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle,
  Share2,
  X,
  ChevronDown,
  Package,
  Copy,
  Check,
  Monitor,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'header' | 'banner' | 'card';
  className?: string;
}

interface DownloadProgressState {
  active: boolean;
  label: string;
  percent: number;
  downloadedMB: string;
  totalMB: string;
  stage: 'downloading' | 'extracting' | 'done' | 'error';
  error?: string;
}

function triggerBlobSave(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 5000);
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dlState, setDlState] = useState<DownloadProgressState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Chunked same-origin fetch downloader (4MB gzipped chunks -> bypasses Cloud Run 32MB limit & proxy 403!)
  const startChunkedBinaryDownload = async (target: 'win64' | 'linux64') => {
    if (dlState?.active) return;
    setShowMenu(false);
    const controller = new AbortController();
    abortRef.current = controller;

    const label = target === 'win64' ? 'Windows App (.exe)' : 'Linux x64 Binary';
    setDlState({
      active: true,
      label,
      percent: 0,
      downloadedMB: '0.0',
      totalMB: '...',
      stage: 'downloading',
    });

    try {
      const metaResp = await fetch(`/api/pkg/${target}/meta`, {
        credentials: 'include',
        signal: controller.signal,
      });
      if (!metaResp.ok) {
        throw new Error(`Server returned HTTP ${metaResp.status}`);
      }
      const meta = (await metaResp.json()) as {
        filename: string;
        compressedBytes: number;
        rawBytes: number;
        totalChunks: number;
      };

      const totalMB = (meta.compressedBytes / (1024 * 1024)).toFixed(1);
      const chunks: BlobPart[] = [];
      let receivedBytes = 0;

      for (let i = 0; i < meta.totalChunks; i++) {
        let partBuf: ArrayBuffer | null = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const resp = await fetch(`/api/pkg/${target}/part/${i}`, {
              credentials: 'include',
              signal: controller.signal,
            });
            if (!resp.ok) throw new Error(`Chunk ${i + 1} HTTP ${resp.status}`);
            partBuf = await resp.arrayBuffer();
            break;
          } catch (err: any) {
            if (err?.name === 'AbortError') throw err;
            lastErr = err;
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
        if (!partBuf) {
          throw lastErr || new Error(`Failed to fetch chunk ${i + 1}`);
        }
        chunks.push(partBuf);
        receivedBytes += partBuf.byteLength;
        const pct = Math.min(99, Math.round((receivedBytes / meta.compressedBytes) * 100));
        setDlState({
          active: true,
          label,
          percent: pct,
          downloadedMB: (receivedBytes / (1024 * 1024)).toFixed(1),
          totalMB,
          stage: 'downloading',
        });
      }

      setDlState({
        active: true,
        label,
        percent: 99,
        downloadedMB: totalMB,
        totalMB,
        stage: 'extracting',
      });

      const gzBlob = new Blob(chunks, { type: 'application/gzip' });
      let finalBlob: Blob;
      let finalName = meta.filename;

      if (typeof DecompressionStream !== 'undefined') {
        const decompressedStream = gzBlob.stream().pipeThrough(new DecompressionStream('gzip'));
        finalBlob = await new Response(decompressedStream, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }).blob();
      } else {
        finalBlob = gzBlob;
        finalName = `${meta.filename}.gz`;
      }

      triggerBlobSave(finalBlob, finalName);

      setDlState({
        active: false,
        label,
        percent: 100,
        downloadedMB: totalMB,
        totalMB,
        stage: 'done',
      });
      setTimeout(() => setDlState(null), 5000);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setDlState(null);
        return;
      }
      setDlState({
        active: false,
        label,
        percent: 0,
        downloadedMB: '0.0',
        totalMB: '0.0',
        stage: 'error',
        error: err?.message || 'Download failed',
      });
    } finally {
      abortRef.current = null;
    }
  };

  // Same-origin fetch download for small ZIP packages (Android/Flutter ZIP) to prevent 403 tab navigation
  const startSimpleZipDownload = async (endpoint: string, filename: string, label: string) => {
    if (dlState?.active) return;
    setShowMenu(false);
    setDlState({
      active: true,
      label,
      percent: 40,
      downloadedMB: '...',
      totalMB: '...',
      stage: 'downloading',
    });
    try {
      const resp = await fetch(endpoint, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const mb = (blob.size / (1024 * 1024)).toFixed(2);
      triggerBlobSave(blob, filename);
      setDlState({
        active: false,
        label,
        percent: 100,
        downloadedMB: mb,
        totalMB: mb,
        stage: 'done',
      });
      setTimeout(() => setDlState(null), 3500);
    } catch (err: any) {
      setDlState({
        active: false,
        label,
        percent: 0,
        downloadedMB: '0',
        totalMB: '0',
        stage: 'error',
        error: err?.message || 'Download failed',
      });
    }
  };

  const cancelDownload = () => {
    abortRef.current?.abort();
    setDlState(null);
  };

  const renderProgressOverlay = () => {
    if (!dlState) return null;
    return (
      <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-black bg-white p-3.5 shadow-2xl text-black">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {dlState.stage === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
            ) : dlState.stage === 'done' ? (
              <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
            )}
            <span className="text-xs font-bold truncate">{dlState.label}</span>
          </div>
          <button
            type="button"
            onClick={dlState.active ? cancelDownload : () => setDlState(null)}
            className="text-slate-500 hover:text-black cursor-pointer"
            title={dlState.active ? 'Cancel download' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {dlState.stage === 'error' ? (
          <p className="text-[11px] text-red-700 font-mono">{dlState.error}</p>
        ) : dlState.stage === 'done' ? (
          <p className="text-[11px] text-emerald-800 font-semibold">
            ডাউনলোড সম্পূর্ণ! আপনার Downloads ফোল্ডার থেকে ফাইলটি ওপেন করুন।
          </p>
        ) : (
          <>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-1.5">
              <div
                className="h-full bg-black transition-all duration-200"
                style={{ width: `${dlState.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
              <span>
                {dlState.stage === 'extracting'
                  ? 'Building ready-to-run .exe...'
                  : `${dlState.downloadedMB} MB / ${dlState.totalMB} MB`}
              </span>
              <span className="font-bold text-black">{dlState.percent}%</span>
            </div>
          </>
        )}
      </div>
    );
  };

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
    return (
      <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-slate-300 text-black shrink-0">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-black text-sm sm:text-base">
                  Download Universal WebUI for Network Engineer — Ready-to-Use App
                </h4>
                <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                  · Direct .exe (No Setup · 55 MB Download)
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-0.5">
                সরাসরি এখান থেকে Windows `.exe` ডাউনলোড করে ডাবল-ক্লিক করলেই চলবে — কোনো Node.js বা সেটআপ লাগবে না! আসল PPTP/L2TP/SSTP, Private LAN Ping/Tracert/Telnet ও USB Console Cable ১০০% ওয়ার্কিং।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <button
              type="button"
              disabled={dlState?.active}
              onClick={() => startChunkedBinaryDownload('win64')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-black hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              title="Download Ready-to-Use Standalone Windows 64-bit .exe (No Node.js Required)"
            >
              {dlState?.active && dlState.label.includes('Windows') ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
              <span>
                {dlState?.active && dlState.label.includes('Windows')
                  ? `Downloading ${dlState.percent}%`
                  : 'Download Windows App (.exe)'}
              </span>
            </button>
            {!isInstalled ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-black bg-white hover:bg-slate-100 text-black font-semibold text-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isIOS ? 'Install iPhone' : 'Install Mobile App'}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span>PWA Installed</span>
              </span>
            )}
            <button
              type="button"
              disabled={dlState?.active}
              onClick={() =>
                startSimpleZipDownload(
                  '/api/download-zip',
                  'universal_webui_network_engineer_app.zip',
                  'Android / Flutter App ZIP'
                )
              }
              className="px-3 py-2 rounded-lg border border-slate-300 hover:border-black bg-white hover:bg-slate-100 text-black text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              title="Download Android Kotlin/Flutter App Source + Auto APK Builder (.zip)"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Android ZIP</span>
            </button>
          </div>
        </div>

        {renderProgressOverlay()}

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
                    নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot;</strong> সিলেক্ট করুন।
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
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs active:scale-95 transition cursor-pointer whitespace-nowrap"
          title="Download Windows .exe, Linux Binary, Android App, or Install Mobile PWA"
        >
          {dlState?.active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">
            {dlState?.active ? `${dlState.percent}%` : 'Download App'}
          </span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Options */}
      {showMenu && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-xs text-black"
          onMouseLeave={() => setShowMenu(false)}
        >
          <div className="px-3 py-2 border-b border-slate-200 mb-1">
            <p className="font-bold text-black">Universal WebUI for Network Engineer</p>
            <p className="text-[11px] text-slate-600">রেডি-টু-ইউজ অ্যাপ্লিকেশন ডাউনলোড করুন</p>
          </div>

          <button
            type="button"
            disabled={dlState?.active}
            onClick={() => startChunkedBinaryDownload('win64')}
            className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-2.5 text-black mb-1 cursor-pointer"
          >
            <Monitor className="w-4 h-4 text-black shrink-0" />
            <div>
              <div className="font-bold text-black">Windows App (.exe) — Ready to Run</div>
              <div className="text-[11px] text-slate-600">55 MB ডাউনলোড · ডাবল-ক্লিক করলেই চলবে</div>
            </div>
          </button>

          <button
            type="button"
            disabled={dlState?.active}
            onClick={() => startChunkedBinaryDownload('linux64')}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black cursor-pointer"
          >
            <Monitor className="w-4 h-4 text-blue-700 shrink-0" />
            <div>
              <div className="font-semibold text-black">Linux x64 Binary — Ready to Run</div>
              <div className="text-[11px] text-slate-600">Standalone Linux executable (No Node.js)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              handleInstallClick();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-black shrink-0" />
            <div>
              <div className="font-semibold text-black">1-Click Mobile App (PWA)</div>
              <div className="text-[11px] text-slate-600">ফোনের হোমস্ক্রিনে অ্যাপ ইনস্টল করুন</div>
            </div>
          </button>

          <button
            type="button"
            disabled={dlState?.active}
            onClick={() =>
              startSimpleZipDownload(
                '/api/download-zip',
                'universal_webui_network_engineer_app.zip',
                'Android / Flutter App ZIP'
              )
            }
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-2.5 text-black cursor-pointer"
          >
            <Package className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <div className="font-semibold text-black">Android / Flutter App (.zip)</div>
              <div className="text-[11px] text-slate-600">Native Android VpnService + Auto APK Builder</div>
            </div>
          </button>

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
              <div className="text-[11px] text-slate-600">Chrome/Edge-এ খুলে ব্যবহার করুন</div>
            </div>
          </button>

          <div className="mt-1 pt-1 border-t border-slate-200 px-3 py-1.5 text-[10px] text-slate-600">
            সরাসরি অ্যাপের ভেতর থেকে ডাউনলোড হয় (4 MB chunked), তাই কোনো 403 এরর হবে না।
          </div>
        </div>
      )}

      {renderProgressOverlay()}

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
