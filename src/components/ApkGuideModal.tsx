import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Key,
  Globe,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Github,
  ArrowRight,
  PackageCheck,
  Check,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose }) => {
  const [repoInput, setRepoInput] = useState('imrafikul/Termius-clone');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  // Clean GitHub repo path if user pasted full URL or username/repo
  const cleanRepo = repoInput
    .replace('https://github.com/', '')
    .replace('http://github.com/', '')
    .replace('.git', '')
    .trim() || 'imrafikul/Termius-clone';

  const actionsUrl = `https://github.com/${cleanRepo}/actions`;
  const releasesUrl = `https://github.com/${cleanRepo}/releases`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-2xl p-6 my-8 text-left max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  APK ডাউনলোড ও Git Push নির্দেশিকা
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Click to Download
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                আপনার রিপোজিটরি: <code className="text-cyan-400 font-mono font-bold">imrafikul/Termius-clone</code>
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

        {/* 1-Click Direct Download Action Bar */}
        <div className="my-5 p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 via-slate-950 to-blue-950/60 border border-cyan-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>সরাসরি APK ডাউনলোড লিংক (Click to Download):</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400">Ready</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <a
              href={releasesUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>GitHub Releases থেকে APK নামান</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={actionsUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>Actions Tab (Built Artifacts)</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>রিপোজিটরি পরিবর্তন করতে চাইলে:</span>
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="username/repo"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-cyan-300 font-mono w-44 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {cleanRepo && (
            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
              <span>Direct Link:</span>
              <span className="text-cyan-400 truncate">{actionsUrl}</span>
            </div>
          )}
        </div>

        {/* Step by Step Visual Guide to Download from GitHub */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>GitHub থেকে APK নামানোর ৩টি সহজ ধাপ:</span>
          </div>

          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30">
              ১
            </span>
            <div className="text-xs text-slate-300">
              <p className="font-bold text-white mb-1">
                GitHub-এ আপনার রিপোজিটরির <span className="text-cyan-400 font-mono">Actions</span> ট্যাবে ক্লিক করুন
              </p>
              <p className="text-slate-400 leading-relaxed">
                আপনার রিপোজিটরির উপরের মেনুতে (Code, Issues, Pull Requests এর পাশে) <strong>Actions</strong> লেখা অপশন দেখতে পাবেন। সেখানে ক্লিক করুন।
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30">
              ২
            </span>
            <div className="text-xs text-slate-300">
              <p className="font-bold text-white mb-1">
                সবচেয়ে উপরের <span className="text-emerald-400 font-mono">&quot;Build Android PPTP Solution APK&quot;</span> রানটিতে ক্লিক করুন
              </p>
              <p className="text-slate-400 leading-relaxed">
                আপনি Git Push করার সাথে সাথে GitHub Actions স্বয়ংক্রিয়ভাবে একটি বিল্ড শুরু করে। পাশে সবুজ টিকচিহ্ন (<span className="text-emerald-400 font-bold">✓</span>) আসলে সেই বিল্ড টাইটেলে ক্লিক করুন।
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-xs">
              ৩
            </span>
            <div className="text-xs text-slate-200">
              <p className="font-bold text-emerald-300 mb-1">
                পেজের একদম নিচে Artifacts সেকশনে <span className="font-mono bg-emerald-900/60 px-1.5 py-0.5 rounded text-white">pptp-solution-apk</span> এ ক্লিক করুন
              </p>
              <p className="text-slate-300 leading-relaxed">
                পেজের নিচে <strong>Artifacts</strong> নামের একটি টেবিল দেখতে পাবেন। সেখানে <code className="text-emerald-400 font-mono font-bold">pptp-solution-apk</code> লিংকে ক্লিক করলেই সাথে সাথে আপনার ফোনের জন্য তৈরি রেডি <strong>app-release.apk</strong> ডাউনলোড শুরু হবে!
              </p>
            </div>
          </div>
        </div>

        {/* Alternative: GitHub Release Link */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-950 border border-blue-500/30 mb-6">
          <div className="flex items-center gap-2 text-blue-300 font-bold text-xs mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>GitHub Releases থেকে ১ ক্লিকে ডাউনলোড:</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            আমরা ওয়ার্কফ্লো ফাইলে অটো-রিলিজ যোগ করেছি। আপনার রিপোজিটরির ডান পাশের <strong>&quot;Releases&quot;</strong> সেকশনে গিয়ে <code className="text-cyan-300 font-mono">app-release.apk</code>-তে চাপ দিলে কোনো জিপ ফাইল ছাড়াই সরাসরি ফোনের ব্রাউজার থেকেই ১ ক্লিকে APK নামানো যাবে।
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="/api/download-zip"
              download="pptp_solution_android_flutter.zip"
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Full Source (.ZIP)</span>
            </a>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            ধাপগুলো বুঝেছি
          </button>
        </div>
      </div>
    </div>
  );
};
