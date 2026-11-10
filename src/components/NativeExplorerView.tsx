import React, { useState, useEffect } from 'react';
import {
  Code2,
  FileCode,
  Download,
  Copy,
  Check,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Cpu,
  Smartphone,
  FolderTree,
} from 'lucide-react';
import { NativeFileItem } from '../data/nativeFiles';
import { fetchNativeFiles } from '../services/api';
import { exportProjectZip } from '../services/zipExporter';

export const NativeExplorerView: React.FC = () => {
  const [files, setFiles] = useState<NativeFileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('vpn_service_kt');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const handleDownloadZip = async () => {
    try {
      setIsExporting(true);
      await exportProjectZip(files);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & ZIP Export Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs font-mono text-cyan-400 uppercase tracking-wider">
              <FolderTree className="w-4 h-4" />
              <span>Native Source Architecture &amp; Repository Explorer</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              11 Production-Ready Android (Kotlin) &amp; Flutter (Dart) Source Files
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Complete implementation of user-space PPTP VPN engine, Android TUN interface bridge, strict split-tunneling routing table, reactive MethodChannels, embedded SSH terminal, and network diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/api/download-zip"
              download="pptp_solution_android_flutter.zip"
              className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Project (.ZIP)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Code Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* Left Pane: File Tree & Category Filter */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div>
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files or symbols..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Category Segmented Buttons */}
            <div className="flex flex-wrap gap-1 mb-4 pb-3 border-b border-slate-800">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* File List */}
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  Loading source files...
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
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
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold font-mono ${
                            isSelected ? 'text-cyan-300' : 'text-slate-200'
                          }`}
                        >
                          {file.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {file.language}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        {file.path}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Architecture Callout */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Shield className="w-3.5 h-3.5" />
              <span>Split Tunneling Enforcement:</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              <code className="text-slate-300">PPTPVpnService.kt</code> calls <code className="text-slate-300">builder.addRoute()</code> strictly on isolated subnets and never injects <code className="text-red-400">0.0.0.0/0</code>.
            </p>
          </div>
        </div>

        {/* Right Pane: Code Viewer */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between shadow-sm overflow-hidden">
          {selectedFile ? (
            <>
              {/* File Info Header */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white font-mono">
                      {selectedFile.path}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                      {selectedFile.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    {selectedFile.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
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

              {/* Code Content with Line Numbers */}
              <div className="bg-black/95 p-4 font-mono text-xs text-slate-300 overflow-x-auto overflow-y-auto max-h-[580px] leading-relaxed select-text">
                <pre className="table w-full">
                  <code>
                    {selectedFile.content.split('\n').map((line, idx) => (
                      <div key={idx} className="table-row hover:bg-slate-900/60">
                        <span className="table-cell select-none text-slate-600 text-right pr-4 pl-1 text-[11px] tabular-nums w-12 border-r border-slate-900">
                          {idx + 1}
                        </span>
                        <span className="table-cell pl-4 text-slate-200 whitespace-pre">
                          {line}
                        </span>
                      </div>
                    ))}
                  </code>
                </pre>
              </div>

              {/* Footer status */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>
                  Lines: {selectedFile.content.split('\n').length} · Language: {selectedFile.language.toUpperCase()}
                </span>
                <span className="text-emerald-400">Production Ready · No Placeholders</span>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              Select a file from the repository tree to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
