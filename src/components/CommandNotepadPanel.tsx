import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Send,
  Copy,
  Check,
  Pencil,
  Trash2,
  Pin,
  Save,
  X,
  Download,
  Cloud,
  HardDrive,
} from 'lucide-react';
import { SavedCommandNote, TerminalVendor } from '../types/vpn';
import { useAuth } from '../context/AuthContext';

const ALL_NOTE_VENDORS: (TerminalVendor | 'All')[] = [
  'All',
  'MikroTik',
  'Huawei',
  'ZTE',
  'BDCOM',
  'VSOL',
  'C-Data',
  'Cisco',
  'Juniper',
  'Palo Alto',
  'Arista',
  'Ruijie',
  'TP-Link',
];

const NOTE_CATEGORIES = [
  'OLT / ONU',
  'Router / IP',
  'Switch / VLAN',
  'BGP / OSPF',
  'Firewall / NAT',
  'Diagnostics',
  'General',
];

interface CommandNotepadPanelProps {
  activeVendor?: TerminalVendor;
  isLiveConnected?: boolean;
  onApplyCommands: (title: string, commands: string) => void | Promise<void>;
  /** Optional prefill draft (e.g. clicking "Save to Notepad" from Generated CLI or Terminal) */
  draftPrefill?: { title: string; vendor: TerminalVendor | 'All'; commands: string } | null;
  onClearDraftPrefill?: () => void;
  compact?: boolean;
}

export const CommandNotepadPanel: React.FC<CommandNotepadPanelProps> = ({
  activeVendor,
  isLiveConnected = false,
  onApplyCommands,
  draftPrefill,
  onClearDraftPrefill,
  compact = false,
}) => {
  const { user, commandNotes, saveCommandNote, deleteCommandNote } = useAuth();

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState<'ALL_NOTES' | 'CURRENT' | TerminalVendor | 'All'>('ALL_NOTES');
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [vendor, setVendor] = useState<TerminalVendor | 'All'>(activeVendor || 'All');
  const [category, setCategory] = useState('OLT / ONU');
  const [commands, setCommands] = useState('');
  const [description, setDescription] = useState('');
  const [pinned, setPinned] = useState(false);

  // Quick-Edit-Before-Apply inline state
  const [quickEditNoteId, setQuickEditNoteId] = useState<string | null>(null);
  const [quickEditText, setQuickEditText] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    if (draftPrefill && draftPrefill.commands.trim()) {
      setEditingId(null);
      setTitle(draftPrefill.title || `${draftPrefill.vendor} Saved Script`);
      setVendor(draftPrefill.vendor || activeVendor || 'All');
      setCategory('General');
      setCommands(draftPrefill.commands);
      setDescription('WebUI / Terminal থেকে সরাসরি সেভ করা কমান্ড।');
      setPinned(false);
      setIsEditorOpen(true);
      onClearDraftPrefill?.();
    }
  }, [draftPrefill, activeVendor, onClearDraftPrefill]);

  const openCreateEditor = () => {
    setEditingId(null);
    setTitle('');
    setVendor(activeVendor || 'All');
    setCategory('OLT / ONU');
    setCommands('');
    setDescription('');
    setPinned(false);
    setIsEditorOpen(true);
  };

  const openEditEditor = (note: SavedCommandNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setVendor(note.vendor);
    setCategory(note.category);
    setCommands(note.commands);
    setDescription(note.description || '');
    setPinned(Boolean(note.pinned));
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !commands.trim()) return;
    await saveCommandNote({
      id: editingId || undefined,
      title: title.trim(),
      vendor,
      category,
      commands: commands.trim(),
      description: description.trim(),
      pinned,
    });
    setIsEditorOpen(false);
    setEditingId(null);
  };

  const handleTogglePin = async (note: SavedCommandNote) => {
    await saveCommandNote({
      ...note,
      pinned: !note.pinned,
    });
  };

  const handleApply = async (noteId: string, noteTitle: string, script: string) => {
    await onApplyCommands(noteTitle, script);
    setAppliedId(noteId);
    setTimeout(() => setAppliedId(null), 1800);
  };

  const handleExportTxt = () => {
    const content = commandNotes
      .map(
        (n) =>
          `=== ${n.title} [${n.vendor} · ${n.category}] ===\n${n.description ? `# ${n.description}\n` : ''}${n.commands}\n`
      )
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `command-notepad-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredNotes = commandNotes.filter((n) => {
    if (pinnedOnly && !n.pinned) return false;
    if (vendorFilter === 'CURRENT' && activeVendor) {
      if (n.vendor !== activeVendor && n.vendor !== 'All') return false;
    } else if (vendorFilter !== 'ALL_NOTES' && vendorFilter !== 'CURRENT') {
      if (n.vendor !== vendorFilter) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.commands.toLowerCase().includes(q) ||
      n.description.toLowerCase().includes(q) ||
      n.vendor.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3.5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-black">
            <FileText className="w-4 h-4 text-black" />
            <span>Personal Command Notepad ({commandNotes.length})</span>
            <span className="text-[11px] font-mono font-normal text-slate-600 flex items-center gap-1">
              <span>·</span>
              {user ? <Cloud className="w-3 h-3 text-emerald-700" /> : <HardDrive className="w-3 h-3" />}
              <span>{user ? 'Cloud Synced' : 'Local Saved'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            কমান্ড ভুলে যাওয়ার ভয় নেই — Notepad-এর মতো নিজের সব কমান্ড লিখে সেভ রাখুন, দরকার হলে দেখে ১ ক্লিকে <strong>Apply</strong> দিলেই সরাসরি কাজ করবে।
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {commandNotes.length > 0 && (
            <button
              type="button"
              onClick={handleExportTxt}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Download all notes as .txt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .TXT</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (isEditorOpen ? setIsEditorOpen(false) : openCreateEditor())}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {isEditorOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isEditorOpen ? 'Close Editor' : '+ New Command Note'}</span>
          </button>
        </div>
      </div>

      {/* Notepad Editor Form */}
      {isEditorOpen && (
        <form
          onSubmit={handleSaveNote}
          className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-black">
              {editingId ? 'Edit Saved Command Note' : 'Write New Command in Notepad'}
            </span>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-black cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="accent-black"
              />
              <span>Pin to Top</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Huawei ONU Add VLAN 200)"
              className="sm:col-span-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-black focus:outline-none focus:border-black"
            />
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value as TerminalVendor | 'All')}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
            >
              {ALL_NOTE_VENDORS.map((v) => (
                <option key={v} value={v}>
                  Brand: {v}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
            >
              {NOTE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-700 mb-1">
              CLI Commands (একাধিক লাইন লিখতে পারবেন · # দিয়ে কমেন্ট লিখলে Apply করার সময় বাদ যাবে):
            </label>
            <textarea
              required
              rows={6}
              maxLength={8000}
              value={commands}
              onChange={(e) => setCommands(e.target.value)}
              placeholder={`enable\nconfig\ninterface gpon 0/1\nont add 0 5 sn-auth "48575443..." ...\nsave`}
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs font-mono text-black focus:outline-none focus:border-black leading-relaxed"
            />
          </div>

          <input
            type="text"
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="মনে রাখার নোট (যেমন: কোন পোর্ট বা ক্লায়েন্টের জন্য ব্যবহার করবেন...)"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditorOpen(false);
                setEditingId(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Update Note' : 'Save to Notepad'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved commands by title, brand, keyword (e.g. onu, vlan, nat, bgp)..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          >
            <option value="ALL_NOTES">All Saved Brands</option>
            {activeVendor && <option value="CURRENT">Current ({activeVendor})</option>}
            {ALL_NOTE_VENDORS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setPinnedOnly(!pinnedOnly)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer transition ${
              pinnedOnly
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-slate-300 hover:bg-slate-100'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </button>
        </div>
      </div>

      {/* Notes Grid / List */}
      {filteredNotes.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-300 space-y-2">
          <div className="text-xs font-bold text-black">কোনো সেভ করা কমান্ড পাওয়া যায়নি</div>
          <p className="text-xs text-slate-600">
            উপরের <strong>+ New Command Note</strong> বাটনে ক্লিক করে আপনার দরকারি CLI কমান্ড Notepad-এ সেভ করুন।
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-2' : 'xl:grid-cols-2'} gap-3`}>
          {filteredNotes.map((note) => {
            const isQuickEditing = quickEditNoteId === note.id;
            const lineCount = note.commands
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith('#')).length;

            return (
              <div
                key={note.id}
                className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 transition flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-2">
                  {/* Note Title & Metadata (Zero-Pill clean typography) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-black flex items-center gap-1.5">
                        {note.pinned && <Pin className="w-3 h-3 text-black shrink-0 fill-black" />}
                        <span className="truncate">{note.title}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 mt-0.5 tabular-nums">
                        <span>{note.vendor}</span>
                        <span className="mx-1.5">·</span>
                        <span>{note.category}</span>
                        <span className="mx-1.5">·</span>
                        <span>{lineCount} line{lineCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(note)}
                        className={`p-1 rounded border cursor-pointer transition ${
                          note.pinned
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-slate-600 hover:text-black border-slate-200'
                        }`}
                        title={note.pinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditEditor(note)}
                        className="p-1 rounded bg-white hover:bg-slate-100 text-slate-700 hover:text-black border border-slate-200 cursor-pointer"
                        title="Edit Note"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCommandNote(note.id)}
                        className="p-1 rounded bg-white hover:bg-red-600 text-red-700 hover:text-white border border-slate-200 cursor-pointer"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {note.description && (
                    <p className="text-[11px] text-slate-700 leading-snug">{note.description}</p>
                  )}

                  {/* Notepad Command Body or Quick-Edit Box */}
                  {isQuickEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        rows={5}
                        value={quickEditText}
                        onChange={(e) => setQuickEditText(e.target.value)}
                        className="w-full bg-slate-50 border border-black rounded-lg p-2.5 text-[11px] font-mono text-black focus:outline-none leading-relaxed"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickEditNoteId(null)}
                          className="px-2.5 py-1 rounded bg-white border border-slate-300 text-black text-[11px] font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleApply(note.id, note.title, quickEditText);
                            setQuickEditNoteId(null);
                          }}
                          className="px-3 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Apply Edited Now</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-black max-h-36 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                      {note.commands}
                    </pre>
                  )}
                </div>

                {/* Bottom Action Strip */}
                {!isQuickEditing && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(note.commands);
                          setCopiedId(note.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === note.id ? (
                          <Check className="w-3 h-3 text-emerald-700" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === note.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickEditNoteId(note.id);
                          setQuickEditText(note.commands);
                        }}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                        title="Edit IP / VLAN / SN quickly before applying"
                      >
                        Edit &amp; Apply
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApply(note.id, note.title, note.commands)}
                      className="px-3.5 py-1.5 rounded-md bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      title={
                        isLiveConnected
                          ? 'Push all lines directly to Live Telnet session'
                          : 'Apply / load commands into console'
                      }
                    >
                      {appliedId === note.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Applied!</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{isLiveConnected ? 'Apply Live' : 'Apply'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
