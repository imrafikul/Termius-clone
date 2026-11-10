import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw, Sparkles, X, CheckCircle, ArrowUpCircle } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFunction, setUpdateFunction] = useState<(() => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Register Service Worker with live update detection
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('PPTP Solution ready to work offline.');
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Check for updates every 20 seconds
          const intervalId = setInterval(() => {
            registration.update().catch(() => {});
          }, 20 * 1000);

          // Check for updates when user refocuses the app/tab
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
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-bounce-short">
      <div className="rounded-2xl border border-cyan-500/50 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md text-white">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shrink-0">
            <ArrowUpCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-bold text-sm text-cyan-300">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>নতুন আপডেট এসেছে! (Update Available)</span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              অ্যাপের সর্বশেষ তথ্য ও ফিচার আপডেট করা হয়েছে। ইনস্টল করা অ্যাপটি এখনই আপডেট করুন।
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'আপডেট হচ্ছে...' : 'এখনই আপডেট করুন (Update Now)'}</span>
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
