import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Terminal as TerminalIcon,
  Activity,
  Copy,
  Check,
  Send,
  HelpCircle,
  ArrowRightToLine,
  KeyRound,
  GripHorizontal,
} from 'lucide-react';
import { TerminalVendor } from '../types/vpn';
import { getCliHelp, getCliTabCompletion, getCliSuggestions } from '../services/cliCommandTree';
import { VendorPromptMode } from '../services/vendorDatasheets';

export interface ConsoleLine {
  id: string;
  type: 'prompt' | 'output' | 'info' | 'success' | 'error';
  text: string;
}

export interface TelnetBridgeHandle {
  isConnected: boolean;
  pushScript: (title: string, script: string, forcePush?: boolean) => Promise<void>;
  appendLocalOutput: (lines: ConsoleLine[]) => void;
}

interface LiveVendorTelnetConsoleProps {
  vendor: TerminalVendor;
  title: string;
  defaultHost?: string;
  defaultUser: string;
  defaultPass: string;
  promptLabel: string;
  promptModeLabel?: string;
  promptMode: VendorPromptMode;
  syncCommandTitle: string;
  syncCommandScript: string;
  prepareLinesForLive: (rawScript: string, mode: VendorPromptMode, isLive: boolean) => string[];
  onLiveOutputChunk: (chunk: string, sessionId: string) => void;
  onLocalCommand?: (cmd: string) => ConsoleLine[] | null;
  onBridgeReady: (handle: TelnetBridgeHandle) => void;
  onToast?: (msg: string) => void;
}

function appendRawChunk(existing: ConsoleLine[], rawChunk?: string): ConsoleLine[] {
  if (!rawChunk) return [...existing];
  const applyBksp = (base: string, chunk: string) => {
    let out = base;
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (ch === '\x08' || ch === '\x7f') {
        if (out.length > 0 && !out.endsWith('\n')) out = out.slice(0, -1);
      } else {
        out += ch;
      }
    }
    return out;
  };
  const next = [...existing];
  const last = next[next.length - 1];
  if (last && last.type === 'output' && !last.text.endsWith('\n')) {
    next[next.length - 1] = { ...last, text: applyBksp(last.text, rawChunk) };
  } else {
    next.push({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'output',
      text: applyBksp('', rawChunk),
    });
  }
  return next;
}

export const LiveVendorTelnetConsole: React.FC<LiveVendorTelnetConsoleProps> = ({
  vendor,
  title,
  defaultHost,
  defaultUser,
  defaultPass,
  promptLabel,
  promptModeLabel,
  promptMode,
  syncCommandTitle,
  syncCommandScript,
  prepareLinesForLive,
  onLiveOutputChunk,
  onLocalCommand,
  onBridgeReady,
  onToast,
}) => {
  const [telnetHost, setTelnetHost] = useState(defaultHost || '192.168.88.1');
  const [telnetPort, setTelnetPort] = useState(23);
  const [telnetUser, setTelnetUser] = useState(defaultUser);
  const [telnetPass, setTelnetPass] = useState(defaultPass);
  const [autoPushGui, setAutoPushGui] = useState(true);
  const [liveTelnetId, setLiveTelnetId] = useState<string | null>(null);
  const [telnetConnecting, setTelnetConnecting] = useState(false);
  const [pushingCli, setPushingCli] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const [lastGeneratedTitle, setLastGeneratedTitle] = useState(`${vendor} Ready`);
  const [lastGeneratedCli, setLastGeneratedCli] = useState(syncCommandScript);
  const [consoleHeight, setConsoleHeight] = useState<number>(470);
  const [consoleFontSize, setConsoleFontSize] = useState<number>(12);
  const resizingRef = useRef<{ startY: number; startH: number } | null>(null);

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    {
      id: 'init_1',
      type: 'info',
      text: `  ${title} — Bidirectional WebUI <-> Live Telnet (RFC 854)`,
    },
    {
      id: 'init_2',
      type: 'success',
      text: `  Auto-Push GUI ON · Mid-command '?' Help & 'Tab' Autocomplete Ready.`,
    },
    {
      id: 'init_3',
      type: 'info',
      text: `  বাম পাশের ওয়েব ইন্টারফেসে যেকোনো পরিবর্তন করলে সাথে সাথে এখানে আসল ${vendor} CLI তৈরি হয়ে লাইভ Telnet-এ পুশ হবে।`,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [remoteBufferHint, setRemoteBufferHint] = useState('');

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const liveTelnetIdRef = useRef<string | null>(null);
  const autoPushRef = useRef<boolean>(true);
  const promptModeRef = useRef<VendorPromptMode>(promptMode);
  const promptLabelRef = useRef<string>(promptLabel);

  useEffect(() => {
    liveTelnetIdRef.current = liveTelnetId;
  }, [liveTelnetId]);
  useEffect(() => {
    autoPushRef.current = autoPushGui;
  }, [autoPushGui]);
  useEffect(() => {
    promptModeRef.current = promptMode;
  }, [promptMode]);
  useEffect(() => {
    promptLabelRef.current = promptLabel;
  }, [promptLabel]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientY - resizingRef.current.startY;
      setConsoleHeight(Math.max(260, Math.min(820, resizingRef.current.startH + delta)));
    };
    const onUp = () => {
      resizingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const sendRawToLiveOlt = async (payload: string, raw = false) => {
    const sid = liveTelnetIdRef.current;
    if (!sid) return;
    try {
      const resp = await fetch(`/api/telnet/sessions/${sid}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload, raw }),
      });
      const data = await resp.json();
      if (data.output) {
        onLiveOutputChunk(data.output, sid);
        setConsoleLines((prev) => appendRawChunk(prev, data.output));
      }
      if (data.connected === false) {
        setLiveTelnetId(null);
        setRemoteBufferHint('');
        setConsoleLines((prev) => [
          ...prev,
          {
            id: `disc_${Date.now()}`,
            type: 'error',
            text: `\n  [Telnet Disconnected] ${data.closedReason || data.error || 'Connection closed.'}`,
          },
        ]);
      }
    } catch (err: any) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, type: 'error', text: `  [Send Failed] ${err?.message || 'Network error'}` },
      ]);
    }
  };

  // Expose stable bridge handle to parent WebUI
  const pushScript = async (actionTitle: string, script: string, forcePush = false) => {
    setLastGeneratedTitle(actionTitle);
    setLastGeneratedCli(script);

    const sid = liveTelnetIdRef.current;
    const isLive = Boolean(sid);
    const prepared = prepareLinesForLive(script, promptModeRef.current, isLive);

    if (sid && (autoPushRef.current || forcePush)) {
      setPushingCli(true);
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `push_hdr_${Date.now()}`,
          type: 'info',
          text: `\n  >>> [Live Push: ${actionTitle}] (${prepared.length} cmds)`,
        },
      ]);
      for (const cmd of prepared) {
        await sendRawToLiveOlt(cmd, false);
        await new Promise((r) => setTimeout(r, 230));
      }
      setPushingCli(false);
      onToast?.(`Live Pushed: ${actionTitle}`);
    } else {
      const displayLines = script
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `gen_hdr_${Date.now()}`,
          type: 'success',
          text: `\n  [WebUI -> ${vendor} CLI Generated: ${actionTitle}]`,
        },
        {
          id: `gen_body_${Date.now()}`,
          type: 'output',
          text: displayLines.map((l) => `  ${promptLabelRef.current}${l}`).join('\n'),
        },
      ]);
      onToast?.(`${actionTitle} — ${vendor} CLI ready`);
    }
  };

  useEffect(() => {
    onBridgeReady({
      isConnected: Boolean(liveTelnetId),
      pushScript,
      appendLocalOutput: (lines) => setConsoleLines((prev) => [...prev, ...lines]),
    });
  }, [liveTelnetId, promptMode, promptLabel, autoPushGui]);

  // 300ms real-time Telnet poller
  useEffect(() => {
    if (!liveTelnetId) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`/api/telnet/sessions/${liveTelnetId}/poll`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        if (data.output) {
          onLiveOutputChunk(data.output, liveTelnetId);
          // Auto-advance --More-- / ---- More ---- paging
          if (/--\s*More\s*--/i.test(data.output)) {
            fetch(`/api/telnet/sessions/${liveTelnetId}/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ input: ' ', raw: true }),
            }).catch(() => {});
          }
          setConsoleLines((prev) => appendRawChunk(prev, data.output));
        }
        if (data.connected === false) {
          setLiveTelnetId(null);
          setRemoteBufferHint('');
          setConsoleLines((prev) => [
            ...prev,
            {
              id: `disc_${Date.now()}`,
              type: 'error',
              text: `\n  [Telnet Disconnected] ${data.closedReason || 'Remote device closed session.'}`,
            },
          ]);
        }
      } catch {
        // ignore transient glitch
      }
    }, 300);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveTelnetId]);

  const handleConnectTelnet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hostClean = telnetHost.trim();
    if (!hostClean) return;

    if (liveTelnetId) {
      await fetch(`/api/telnet/sessions/${liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
      setLiveTelnetId(null);
    }

    setTelnetConnecting(true);
    setRemoteBufferHint('');
    setConsoleLines((prev) => [
      ...prev,
      {
        id: `conn_${Date.now()}`,
        type: 'info',
        text: `  Connecting to ${vendor} ${hostClean}:${telnetPort} via RFC 854 Telnet (User: ${telnetUser || 'manual'})...`,
      },
    ]);

    try {
      const resp = await fetch('/api/telnet/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: hostClean,
          port: telnetPort || 23,
          username: telnetUser.trim(),
          password: telnetPass,
          autoLogin: true,
          timeoutMs: 6500,
        }),
      });
      const data = await resp.json();
      if (data.connected && data.sessionId) {
        setLiveTelnetId(data.sessionId);
        if (data.output) onLiveOutputChunk(data.output, data.sessionId);
        setConsoleLines((prev) => {
          const next: ConsoleLine[] = [
            ...prev,
            {
              id: `ok_${Date.now()}`,
              type: 'success',
              text: `  [LIVE ${vendor.toUpperCase()} CONNECTED] ${hostClean}:${telnetPort} (${data.latencyMs}ms · Bidirectional Sync Ready)`,
            },
          ];
          return data.output ? appendRawChunk(next, data.output) : next;
        });
        onToast?.(`Connected to Live ${vendor} ${hostClean}`);
      } else {
        setConsoleLines((prev) => [
          ...prev,
          {
            id: `fail_${Date.now()}`,
            type: 'error',
            text: `  [-] Telnet Failed: ${data.error || 'Unreachable on port ' + telnetPort}`,
          },
          {
            id: `tip_${Date.now()}`,
            type: 'info',
            text: `  টিপস: প্রাইভেট LAN/PPTP আইপি (${hostClean}) হলে Desktop App বা VPN দিয়ে কানেক্ট করুন; আর অফলাইন মোডেও বাম পাশের WebUI থেকে আসল ${vendor} CLI তৈরি ও কপি করতে পারবেন।`,
          },
        ]);
      }
    } catch (err: any) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, type: 'error', text: `  [-] Bridge Error: ${err?.message || 'Server error'}` },
      ]);
    } finally {
      setTelnetConnecting(false);
    }
  };

  const handleDisconnectTelnet = async () => {
    if (!liveTelnetId) return;
    await fetch(`/api/telnet/sessions/${liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
    setLiveTelnetId(null);
    setRemoteBufferHint('');
    setConsoleLines((prev) => [
      ...prev,
      { id: `u_disc_${Date.now()}`, type: 'info', text: `  [Disconnected from ${vendor}]` },
    ]);
  };

  const handleQuestionHelp = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputVal;
    if (liveTelnetId) {
      setRemoteBufferHint((prev) => `${prev}${text}`);
      setInputVal('');
      await sendRawToLiveOlt(`${text}?`, true);
      inputRef.current?.focus();
      return;
    }
    const helpRes = getCliHelp(vendor, text);
    setConsoleLines((prev) => [
      ...prev,
      { id: `qp_${Date.now()}`, type: 'prompt', text: `${promptLabel}${text}?` },
      { id: `qo_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type: 'output', text: helpRes.formatted },
    ]);
    setInputVal(text);
    inputRef.current?.focus();
  };

  const handleTabComplete = async () => {
    if (liveTelnetId) {
      setRemoteBufferHint((prev) => `${prev}${inputVal}`);
      setInputVal('');
      await sendRawToLiveOlt(`${inputVal}\t`, true);
      inputRef.current?.focus();
      return;
    }
    const tabRes = getCliTabCompletion(vendor, inputVal);
    if (tabRes.changed) setInputVal(tabRes.completed);
    if (tabRes.formatted) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `tp_${Date.now()}`, type: 'prompt', text: `${promptLabel}${inputVal}<Tab>` },
        { id: `to_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type: 'output', text: tabRes.formatted! },
      ]);
    }
    inputRef.current?.focus();
  };

  const handleControlKey = async (ctrl: 'CTRL_C' | 'CTRL_Z' | 'SPACE' | 'ENTER' | 'BKSP') => {
    if (liveTelnetId) {
      const map: Record<typeof ctrl, { payload: string; raw: boolean }> = {
        CTRL_C: { payload: '\x03', raw: true },
        CTRL_Z: { payload: '\x1a', raw: true },
        SPACE: { payload: ' ', raw: true },
        ENTER: { payload: '', raw: false },
        BKSP: { payload: '\x08', raw: true },
      };
      if (ctrl === 'CTRL_C' || ctrl === 'CTRL_Z' || ctrl === 'ENTER') {
        setInputVal('');
        setRemoteBufferHint('');
      } else if (ctrl === 'BKSP') {
        setRemoteBufferHint((prev) => prev.slice(0, -1));
      }
      await sendRawToLiveOlt(map[ctrl].payload, map[ctrl].raw);
      inputRef.current?.focus();
      return;
    }
    if (ctrl === 'CTRL_C') {
      setConsoleLines((prev) => [...prev, { id: `cc_${Date.now()}`, type: 'info', text: `${promptLabel}${inputVal}^C` }]);
      setInputVal('');
    } else if (ctrl === 'CTRL_Z') {
      setConsoleLines((prev) => [...prev, { id: `cz_${Date.now()}`, type: 'info', text: `${promptLabel}^Z` }]);
      setInputVal('');
    } else if (ctrl === 'ENTER') {
      executeConsoleCommand(inputVal);
    }
    inputRef.current?.focus();
  };

  const executeConsoleCommand = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (liveTelnetId) {
      if (trimmed.toLowerCase() === 'clear') {
        setConsoleLines([]);
        setInputVal('');
        setRemoteBufferHint('');
        return;
      }
      if (trimmed) {
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIdx(-1);
      }
      setInputVal('');
      setRemoteBufferHint('');
      await sendRawToLiveOlt(rawCmd, false);
      return;
    }

    if (!trimmed) return;
    if (trimmed === '?' || trimmed.endsWith('?')) {
      handleQuestionHelp(trimmed.slice(0, -1));
      return;
    }
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
    setInputVal('');
    if (trimmed.toLowerCase() === 'clear') {
      setConsoleLines([]);
      return;
    }

    const appended: ConsoleLine[] = [
      { id: `p_${Date.now()}`, type: 'prompt', text: `${promptLabel}${trimmed}` },
    ];
    const customOut = onLocalCommand?.(trimmed);
    if (customOut && customOut.length > 0) {
      appended.push(...customOut);
    } else {
      const hint = getCliHelp(vendor, trimmed);
      appended.push({
        id: `hint_${Date.now()}`,
        type: 'info',
        text:
          hint.matches.length > 0
            ? `  Matching ${vendor} subcommands:\n${hint.formatted}`
            : `  Command queued: "${trimmed}" — Connect live Telnet or press '?' / 'Tab' for ${vendor} CLI help.`,
      });
    }
    setConsoleLines((prev) => [...prev, ...appended]);
  };

  const handleInputChange = (nextVal: string) => {
    if (nextVal.length === inputVal.length + 1 && nextVal.endsWith('?')) {
      handleQuestionHelp(nextVal.slice(0, -1));
      return;
    }
    setInputVal(nextVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '?') {
      e.preventDefault();
      handleQuestionHelp(inputVal);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTabComplete();
    } else if (e.key === 'Enter') {
      executeConsoleCommand(inputVal);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      handleControlKey('CTRL_C');
    } else if (e.ctrlKey && e.key.toLowerCase() === 'z' && liveTelnetId) {
      e.preventDefault();
      handleControlKey('CTRL_Z');
    } else if (e.key === 'Backspace' && inputVal === '' && liveTelnetId) {
      e.preventDefault();
      handleControlKey('BKSP');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx + 1 < history.length ? historyIdx + 1 : historyIdx;
        setHistoryIdx(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      } else {
        setHistoryIdx(-1);
        setInputVal('');
      }
    }
  };

  const suggestionBasis = liveTelnetId ? `${remoteBufferHint}${inputVal}` : inputVal;
  const suggestions = getCliSuggestions(vendor, suggestionBasis);

  return (
    <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Live Telnet Connect Bar */}
      <form onSubmit={handleConnectTelnet} className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-black">
            <Radio className={`w-4 h-4 ${liveTelnetId ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{title}</span>
            {liveTelnetId && promptModeLabel && (
              <span className="text-[11px] font-mono font-normal text-emerald-700">
                · {promptModeLabel}
              </span>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-black cursor-pointer">
            <input
              type="checkbox"
              checked={autoPushGui}
              onChange={(e) => setAutoPushGui(e.target.checked)}
              className="accent-black"
            />
            <span>Auto-Push GUI</span>
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <input
            type="text"
            value={telnetHost}
            onChange={(e) => setTelnetHost(e.target.value)}
            placeholder="Device IP"
            className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
          <input
            type="number"
            value={telnetPort}
            onChange={(e) => setTelnetPort(parseInt(e.target.value, 10) || 23)}
            placeholder="23"
            className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
          <input
            type="text"
            value={telnetUser}
            onChange={(e) => setTelnetUser(e.target.value)}
            placeholder="Username"
            className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
          <input
            type="password"
            value={telnetPass}
            onChange={(e) => setTelnetPass(e.target.value)}
            placeholder="Password"
            className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!liveTelnetId ? (
            <button
              type="submit"
              disabled={telnetConnecting}
              className="flex-1 py-1.5 px-3 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>{telnetConnecting ? 'Connecting...' : `Connect ${vendor} Telnet`}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => pushScript(syncCommandTitle, syncCommandScript, true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Sync Live State</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectTelnet}
                className="py-1.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </form>

      {/* Queue + Console Size/Font Controls */}
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-black truncate block">Queue: {lastGeneratedTitle}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setConsoleFontSize((s) => Math.max(10, s - 1))}
            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => setConsoleFontSize((s) => Math.min(16, s + 1))}
            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => setConsoleHeight((h) => (h < 420 ? 480 : h < 600 ? 640 : 340))}
            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
          >
            {consoleHeight < 420 ? 'S' : consoleHeight < 580 ? 'M' : 'L'}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(lastGeneratedCli);
              setCopiedCli(true);
              setTimeout(() => setCopiedCli(false), 1600);
            }}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            {copiedCli ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
            <span>{copiedCli ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            disabled={!liveTelnetId || pushingCli}
            onClick={() => pushScript(lastGeneratedTitle, lastGeneratedCli, true)}
            className="px-2.5 py-0.5 rounded bg-black hover:bg-slate-800 text-white disabled:opacity-40 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>{pushingCli ? 'Pushing...' : 'Push Live'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Keys Bar */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleQuestionHelp(inputVal)}
          className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-3 h-3" />
          <span>? Help</span>
        </button>
        <button
          type="button"
          onClick={handleTabComplete}
          className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <ArrowRightToLine className="w-3 h-3" />
          <span>Tab</span>
        </button>
        <button
          type="button"
          onClick={() => handleControlKey('CTRL_C')}
          className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0 cursor-pointer"
        >
          Ctrl+C
        </button>
        <button
          type="button"
          onClick={() => handleControlKey('CTRL_Z')}
          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold shrink-0 cursor-pointer"
        >
          Ctrl+Z
        </button>
        <button
          type="button"
          onClick={() => handleControlKey('SPACE')}
          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold shrink-0 cursor-pointer"
        >
          Space
        </button>
        <button
          type="button"
          onClick={() => handleControlKey('ENTER')}
          className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold shrink-0 cursor-pointer"
        >
          Enter
        </button>
        {liveTelnetId && telnetUser && (
          <button
            type="button"
            onClick={async () => {
              await sendRawToLiveOlt(telnetUser, false);
              if (telnetPass) setTimeout(() => sendRawToLiveOlt(telnetPass, false), 500);
            }}
            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <KeyRound className="w-3 h-3" />
            <span>Login</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setConsoleLines([])}
          className="px-2 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] shrink-0 cursor-pointer"
        >
          clear
        </button>
      </div>

      {/* Console Viewport */}
      <div
        style={{ height: `${consoleHeight}px`, fontSize: `${consoleFontSize}px` }}
        className="bg-white p-3.5 font-mono overflow-y-auto flex flex-col justify-between text-black"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="space-y-1">
          {consoleLines.map((l) => (
            <div
              key={l.id}
              className={`whitespace-pre-wrap leading-relaxed ${
                l.type === 'prompt'
                  ? 'text-blue-800 font-bold'
                  : l.type === 'info'
                  ? 'text-slate-600'
                  : l.type === 'success'
                  ? 'text-emerald-800 font-semibold'
                  : l.type === 'error'
                  ? 'text-red-700 font-semibold'
                  : 'text-black'
              }`}
            >
              {l.text}
            </div>
          ))}
          <div ref={consoleEndRef} />
        </div>

        <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 bg-white sticky bottom-0">
          {suggestions.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">Tab/?:</span>
              {suggestions.map((sug) => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInputVal(sug.insertText);
                    inputRef.current?.focus();
                  }}
                  title={sug.desc}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-mono shrink-0 cursor-pointer transition-colors"
                >
                  {sug.label}
                  {sug.hasChildren ? ' …' : ''}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-blue-800 font-bold">
            <span className="shrink-0 max-w-[150px] truncate">{promptLabel}</span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Type ${vendor} cmd then Tab or ?...`}
              className="flex-1 min-w-0 bg-transparent text-black focus:outline-none font-mono caret-black placeholder:text-slate-400 font-normal"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleQuestionHelp(inputVal);
              }}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold cursor-pointer shrink-0"
            >
              ?
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTabComplete();
              }}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold cursor-pointer shrink-0"
            >
              Tab
            </button>
            <button
              type="button"
              onClick={() => executeConsoleCommand(inputVal)}
              className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Drag-to-Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          resizingRef.current = { startY: e.clientY, startH: consoleHeight };
        }}
        className="h-5 bg-slate-50 border-t border-slate-200 flex items-center justify-center cursor-ns-resize hover:bg-slate-100 select-none"
        title="Drag to resize Telnet console height"
      >
        <GripHorizontal className="w-4 h-4 text-slate-400" />
      </div>
    </section>
  );
};
