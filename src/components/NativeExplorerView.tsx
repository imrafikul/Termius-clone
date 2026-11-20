import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Search,
  Shield,
  FolderTree,
} from 'lucide-react';
import { NativeFileItem } from '../data/nativeFiles';
import { fetchNativeFiles } from '../services/api';

export const NativeExplorerView: React.FC = () => {
  const [files, setFiles] = useState<NativeFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('vpn_service_kt');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const loaded = await fetchNativeFiles();
      setFiles(loaded);
      setLoading(false);
    }
    load();
  }, []);

  const categories = ['All', 'Android Native', 'Flutter Core', 'Flutter Services', 'Flutter UI', 'Config'];

  const filteredFiles = files.filter((f) => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0];

  const handleCopy = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & ZIP Export Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs font-mono text-slate-600">
              <FolderTree className="w-4 h-4 text-black" />
              <span>Native Source Architecture &amp; Repository Explorer</span>
            </div>
            <h2 className="text-xl font-bold text-black tracking-tight">
              Universal WebUI for Network Engineer — 14 Android (Kotlin) &amp; Flutter (Dart) App Files
            </h2>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              Complete mobile app source including 12-Vendor OLT/Router/Switch WebUI, Live Telnet/SSH with ? Help &amp; Tab, Personal Command Notepad with 1-Tap Apply, user-space PPTP VpnService, and network diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/api/download-zip"
              download="universal_webui_network_engineer_app.zip"
              className="px-4 py-2.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Download Full App (.ZIP)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Code Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* Left Pane: File Tree & Category Filter */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files or symbols..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-black placeholder:text-slate-500 focus:outline-none focus:border-black font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-1 mb-4 pb-3 border-b border-slate-200">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-black text-white font-bold'
                      : 'text-slate-700 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-600 font-mono">
                  Loading source files...
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-600 font-mono">
                  No matching files found.
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = file.id === selectedFile?.id;
                  return (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer block ${
                        isSelected
                          ? 'bg-slate-100 border-black'
                          : 'bg-white border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-black">
                          {file.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 uppercase">
                          {file.language}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono mt-0.5 truncate">
                        {file.path}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-700 font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-black font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Split Tunneling Enforcement:</span>
            </div>
            <p className="text-[10px] text-slate-600 leading-normal">
              <code className="text-black font-semibold">PPTPVpnService.kt</code> calls <code className="text-black font-semibold">builder.addRoute()</code> strictly on isolated subnets and never injects <code className="text-red-700 font-semibold">0.0.0.0/0</code> unless Full VPN is enabled.
            </p>
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col justify-between overflow-hidden">
          {selectedFile ? (
            <>
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileCode className="w-4 h-4 text-black" />
                    <span className="text-sm font-bold text-black font-mono">
                      {selectedFile.path}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600">
                      · {selectedFile.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 font-sans">
                    {selectedFile.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy File</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Code Content with Line Numbers on clean white/slate-50 canvas */}
              <div className="bg-slate-50 p-4 font-mono text-xs text-black overflow-x-auto overflow-y-auto max-h-[580px] leading-relaxed select-text">
                <pre className="table w-full">
                  <code>
                    {selectedFile.content.split('\n').map((line, idx) => (
                      <div key={idx} className="table-row hover:bg-slate-200/60">
                        <span className="table-cell select-none text-slate-500 text-right pr-4 pl-1 text-[11px] tabular-nums w-12 border-r border-slate-200">
                          {idx + 1}
                        </span>
                        <span className="table-cell pl-4 text-black whitespace-pre">
                          {line}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>

              <div className="p-3 bg-white border-t border-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-between">
                <span>
                  Lines: {selectedFile.content.split('\n').length} · Language: {selectedFile.language.toUpperCase()}
                </span>
                <span className="text-emerald-700 font-semibold">Production Ready · No Placeholders</span>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-600 font-mono text-xs">
              Select a file from the repository tree to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
