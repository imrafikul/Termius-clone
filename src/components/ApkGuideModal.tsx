import React from 'react';
import {
  X,
  Smartphone,
  ShieldCheck,
  Key,
  Globe,
  Download,
  Terminal,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl p-6 my-8 text-left max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  ফোনে আসল VPN ও Public IP পরিবর্তনের নিয়ম
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  অ্যান্ড্রয়েড সিকিউরিটি গাইড
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                কেন ওয়েব অ্যাপে আইকন আসে না এবং কিভাবে Native APK দিয়ে আসল ভিপিএন চালাবেন
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Explanation Box */}
        <div className="my-5 p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>ওয়েব ব্রাউজার / PWA এর সীমাবদ্ধতা (কেন ফোনের আইপি চেঞ্জ হয়নি?):</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Google Android অপারেটিং সিস্টেমের সিকিউরিটি পলিসি অনুযায়ী কোনো সাধারণ ওয়েব ব্রাউজার বা ব্রাউজার থেকে ইনস্টল করা ওয়েব অ্যাপ (PWA) ফোনের ভেতরের নেটওয়ার্ক সকেট বা অন্য অ্যাপের (যেমন: Chrome, YouTube, Facebook) ট্রাফিক নিয়ন্ত্রণ করতে পারে না। ব্রাউজার কোনো অবস্থাতেই সিস্টেমের <strong>VpnService</strong> চালাতে পারে না।
          </p>
          <p className="text-xs text-amber-200/90 leading-relaxed font-semibold">
            👉 তাই ফোনের স্ট্যাটাস বারে আসল চাবি আইকন (🔑) দেখতে এবং পুরো ফোনের আসল Public IP পরিবর্তন করতে হলে <strong>Android Native APK (.apk)</strong> ইনস্টল করতে হবে।
          </p>
        </div>

        {/* Two Halves: What Web Does vs What Native APK Does */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4" />
              <span>ওয়েব অ্যাপের কাজ (Cloud Console):</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>Google Login দিয়ে প্রতিটি ইউজারের নিজস্ব প্রোফাইল ক্লাউডে সুরক্ষিত রাখা।</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>এডমিন প্যানেলে লাইসেন্স তৈরি ও ১ মাসের ফ্রি ট্রায়াল কন্ট্রোল।</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>MikroTik SSH টার্মিনাল, Telnet ও Ping/Port ডায়াগনস্টিক।</span>
              </li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/30">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4" />
              <span>Android Native APK (.apk) এর কাজ:</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>ফোনের স্ট্যাটাস বারে আসল ভিপিএন চাবি (🔑) আইকন দেখানো।</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Full VPN বা Split-Tunnelিং করে ফোনের আসল Public IP পরিবর্তন করা।</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Foreground Service চালু রেখে 24/7 ব্যাকগ্রাউন্ডে কানেকশন সচল রাখা।</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 3 Step Guide to Get the APK */}
        <div className="space-y-3 mb-6">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            কিভাবে সরাসরি আপনার ফোনে Native APK তৈরি ও ইনস্টল করবেন?
          </h4>

          {/* Option 1: Automated GitHub Actions (Easiest, No PC needed) */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950 font-bold text-xs">
                  ১
                </span>
                <span className="text-sm font-bold text-cyan-300">
                  অটোমেটিক বিল্ড (পিসিতে কোনো সফটওয়্যার ছাড়াই - সবচেয়ে সহজ)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                2 মিনিট
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              আমরা ইতিমধ্যে <code className="text-cyan-400 font-mono">.github/workflows/build-apk.yml</code> রেডি করে রেখেছি। নিচে থেকে সোর্স কোড ডাউনলোড করে আপনার ফ্রি GitHub অ্যাকাউন্টে আপলোড করলেই GitHub Actions অটোমেটিক APK তৈরি করে আপনাকে ডাউনলোড লিংক দিয়ে দিবে!
            </p>
          </div>

          {/* Option 2: Download Full Project ZIP */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-200 font-bold text-xs">
                ২
              </span>
              <span className="text-sm font-bold text-slate-200">
                প্রোজেক্ট জিপ ফাইল ডাউনলোড করুন
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              &quot;Download Project (.ZIP)&quot; বাটনে চাপলে সব Kotlin Native কোড, Android Manifest, Flutter UI এবং Gradle ফাইল সহ একটি ফুল প্রোজেক্ট জিপ পেয়ে যাবেন।
            </p>
          </div>

          {/* Option 3: Flutter / Android Studio Build */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-slate-200 font-bold text-xs">
                ৩
              </span>
              <span className="text-sm font-bold text-slate-200">
                কম্পিউটার থেকে ১ লাইনে APK তৈরি:
              </span>
            </div>
            <div className="mt-2 p-2.5 rounded-lg bg-black/90 font-mono text-xs text-emerald-400 border border-slate-800">
              flutter build apk --release
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              আউটপুট: <code className="text-slate-300">build/app/outputs/flutter-apk/app-release.apk</code>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href="/api/download-zip"
            download="pptp_solution_android_flutter.zip"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Project (.ZIP) - Full Code</span>
          </a>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer"
          >
            বুঝেছি, উইন্ডো বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
