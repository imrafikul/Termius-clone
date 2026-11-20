import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw, Sparkles, X, ArrowUpCircle, Download } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('Universal WebUI for Network Engineer ready to work offline.');
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          const intervalId = setInterval(() => {
            registration.update().catch(() => {});
          }, 20 * 1000);

          const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          };
          document.addEventListener('visibilitychange', onVisibilityChange);

          return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
          };
        }
      },
      onRegisterError(error) {
        console.warn('SW registration error:', error);
      },
    });

    setUpdateFunction(() => updateSW);
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    if (updateFunction) {
      await updateFunction();
    } else {
      window.location.reload();
    }
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full">
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl text-black">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 text-black border border-slate-200 shrink-0">
            <ArrowUpCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-bold text-sm text-black">
              <Sparkles className="w-4 h-4 text-black" />
              <span>নতুন আপডেট এসেছে! (Update Available)</span>
            </div>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              অ্যাপের সর্বশেষ তথ্য ও ফিচার আপডেট করা হয়েছে। ইনস্টল করা অ্যাপটি এখনই আপডেট করুন।
            </p>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-black hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span>{isUpdating ? 'আপডেট হচ্ছে...' : 'এখনই আপডেট করুন'}</span>
                </button>
                <button
                  onClick={() => setNeedRefresh(false)}
                  className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-black transition cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <a
                href="https://github.com/imrafikul/Termius-clone/releases"
                target="_blank"
                rel="noreferrer"
                className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>নতুন APK ডাউনলোড করুন (Click to Download)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
