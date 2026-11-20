import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Github,
  PackageCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose }) => {
  const [repoInput, setRepoInput] = useState('imrafikul/Termius-clone');

  if (!isOpen) return null;

  const cleanRepo =
    repoInput
      .replace('https://github.com/', '')
      .replace('http://github.com/', '')
      .replace('.git', '')
      .trim() || 'imrafikul/Termius-clone';

  const actionsUrl = `https://github.com/${cleanRepo}/actions`;
  const releasesUrl = `https://github.com/${cleanRepo}/releases`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 my-8 text-left text-black max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-300 text-black">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-black tracking-tight">
                APK ডাউনলোড ও Git Push নির্দেশিকা
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                আপনার রিপোজিটরি: <code className="text-black font-mono font-bold">imrafikul/Termius-clone</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-black hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Direct Download Action Bar */}
        <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-black" />
              <span>সরাসরি APK ডাউনলোড লিংক (Click to Download):</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-700 font-semibold">Ready</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-lg bg-black hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>GitHub Releases থেকে APK নামান</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={actionsUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-black font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Terminal className="w-4 h-4" />
              <span>Actions Tab (Built Artifacts)</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
            </a>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-700">
            <span>রিপোজিটরি পরিবর্তন করতে চাইলে:</span>
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="username/repo"
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-black font-mono w-44 focus:outline-none focus:border-black"
            />
          </div>

          {cleanRepo && (
            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-700">
              <span>Direct Link:</span>
              <span className="text-blue-700 truncate">{actionsUrl}</span>
            </div>
          )}
        </div>

        {/* Step by Step Guide */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-black font-bold">
            <PackageCheck className="w-4 h-4 text-emerald-700" />
            <span>GitHub থেকে APK নামানোর ৩টি সহজ ধাপ:</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-xs">
              ১
            </span>
            <div className="text-xs text-slate-800">
              <p className="font-bold text-black mb-1">
                GitHub-এ আপনার রিপোজিটরির <span className="font-mono">Actions</span> ট্যাবে ক্লিক করুন
              </p>
              <p className="text-slate-700 leading-relaxed">
                আপনার রিপোজিটরির উপরের মেনুতে (Code, Issues, Pull Requests এর পাশে) <strong>Actions</strong> লেখা অপশন দেখতে পাবেন। সেখানে ক্লিক করুন।
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-white font-bold text-xs">
              ২
            </span>
            <div className="text-xs text-slate-800">
              <p className="font-bold text-black mb-1">
                সবচেয়ে উপরের <span className="text-emerald-800 font-mono">&quot;Build Android PPTP Solution APK&quot;</span> রানটিতে ক্লিক করুন
              </p>
              <p className="text-slate-700 leading-relaxed">
                আপনি Git Push করার সাথে সাথে GitHub Actions স্বয়ংক্রিয়ভাবে একটি বিল্ড শুরু করে। পাশে সবুজ টিকচিহ্ন (<span className="text-emerald-700 font-bold">✓</span>) আসলে সেই বিল্ড টাইটেলে ক্লিক করুন।
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-xs">
              ৩
            </span>
            <div className="text-xs text-black">
              <p className="font-bold text-emerald-900 mb-1">
                পেজের একদম নিচে Artifacts সেকশনে <span className="font-mono bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-black">pptp-solution-apk</span> এ ক্লিক করুন
              </p>
              <p className="text-slate-800 leading-relaxed">
                পেজের নিচে <strong>Artifacts</strong> নামের একটি টেবিল দেখতে পাবেন। সেখানে <code className="text-emerald-800 font-mono font-bold">pptp-solution-apk</code> লিংকে ক্লিক করলেই সাথে সাথে আপনার ফোনের জন্য তৈরি রেডি <strong>app-release.apk</strong> ডাউনলোড শুরু হবে!
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
          <div className="flex items-center gap-2 text-black font-bold text-xs mb-1">
            <Sparkles className="w-4 h-4" />
            <span>GitHub Releases থেকে ১ ক্লিকে ডাউনলোড:</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            আমরা ওয়ার্কফ্লো ফাইলে অটো-রিলিজ যোগ করেছি। আপনার রিপোজিটরির ডান পাশের <strong>&quot;Releases&quot;</strong> সেকশনে গিয়ে <code className="text-black font-mono font-semibold">app-release.apk</code>-তে চাপ দিলে কোনো জিপ ফাইল ছাড়াই সরাসরি ফোনের ব্রাউজার থেকেই ১ ক্লিকে APK নামানো যাবে।
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="/api/download-zip"
              download="pptp_solution_android_flutter.zip"
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-black text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 border border-slate-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full Source (.ZIP)</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            ধাপগুলো বুঝেছি
          </button>
        </div>
      </div>
    </div>
  );
};
