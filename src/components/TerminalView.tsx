import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Download,
  Copy,
  Check,
  Code2,
  ChevronRight,
  Plus,
  X,
  Radio,
  Server,
  Layers,
  Sparkles,
  Command,
  Sliders,
  Send,
} from 'lucide-react';
import { VpnProfile } from '../types/vpn';
import { generateMikrotikScript } from '../services/api';

interface TerminalViewProps {
  activeProfile: VpnProfile | null;
  isConnected: boolean;
}

interface TerminalSession {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'SSH' | 'Telnet';
  username: string;
  status: 'Connected' | 'Connecting' | 'Closed';
  prompt: string;
  lines: TerminalLine[];
}

interface TerminalLine {
  id: string;
  type: 'prompt' | 'output' | 'info' | 'error' | 'success';
  text: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ activeProfile, isConnected }) => {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: 'sess_1',
      name: activeProfile?.name || 'Core Router',
      host: activeProfile?.server || '192.168.88.1',
      port: 22,
      protocol: 'SSH',
      username: activeProfile?.username || 'admin',
      status: 'Connected',
      prompt: `[admin@${activeProfile ? activeProfile.name.split('·')[0].trim().replace(/\s+/g, '-') : 'MikroTik'}] > `,
      lines: [
        { id: 'l1', type: 'info', text: '  MikroTik RouterOS v7.14.3 SSH Terminal (Termius Mode)' },
        { id: 'l2', type: 'info', text: `  Target: ${activeProfile?.server || '192.168.88.1'}:22 (SSH v2) · Architecture: ARM64` },
        { id: 'l3', type: 'success', text: `  Tunnel: PPTP Isolated Route [${activeProfile?.remoteSubnets.join(', ') || '192.168.88.0/24'}]` },
        { id: 'l4', type: 'info', text: "  Type 'help' for RouterOS commands or click snippets below.\n" },
      ],
    },
    {
      id: 'sess_2',
      name: 'Distribution Switch',
      host: '192.168.88.2',
      port: 23,
      protocol: 'Telnet',
      username: 'admin',
      status: 'Connected',
      prompt: 'SW-Core-3560# ',
      lines: [
        { id: 't1', type: 'info', text: '  Trying 192.168.88.2...' },
        { id: 't2', type: 'success', text: '  Connected to 192.168.88.2 (Telnet port 23).' },
        { id: 't3', type: 'info', text: '  Escape character is \'^]\'.' },
        { id: 't4', type: 'output', text: '  Cisco IOS Software, C3560 Software (C3560-IPBASEK9-M)\n' },
      ],
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>('sess_1');
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // New Session Modal State
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newHost, setNewHost] = useState(activeProfile?.server || '192.168.88.1');
  const [newPort, setNewPort] = useState(22);
  const [newProtocol, setNewProtocol] = useState<'SSH' | 'Telnet'>('SSH');
  const [newUsername, setNewUsername] = useState('admin');
  const [newSessionName, setNewSessionName] = useState('New Session');

  // Script Generator State
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [copied, setCopied] = useState(false);

  // Snippets Filter
  const [snippetCategory, setSnippetCategory] = useState<'MikroTik' | 'Cisco' | 'Linux'>('MikroTik');

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.lines]);

  const snippets = {
    MikroTik: [
      { label: '/interface pr', cmd: '/interface print' },
      { label: '/ip addr pr', cmd: '/ip address print' },
      { label: '/pptp-srv pr', cmd: '/interface pptp-server server print' },
      { label: '/ppp secret pr', cmd: '/ppp secret print' },
      { label: '/ip route pr', cmd: '/ip route print' },
      { label: '/firewall pr', cmd: '/ip firewall filter print' },
      { label: '/system resource', cmd: '/system resource print' },
      { label: '/ping 8.8.8.8', cmd: '/ping 8.8.8.8 count=4' },
      { label: '/tool torch', cmd: '/tool torch interface=bridge-lan' },
    ],
    Cisco: [
      { label: 'sh ip int br', cmd: 'show ip interface brief' },
      { label: 'sh run', cmd: 'show running-config' },
      { label: 'sh mac addr', cmd: 'show mac address-table' },
      { label: 'sh vlan br', cmd: 'show vlan brief' },
      { label: 'sh ip route', cmd: 'show ip route' },
      { label: 'ping 10.99.0.1', cmd: 'ping 10.99.0.1' },
      { label: 'traceroute 8.8.8.8', cmd: 'traceroute 8.8.8.8' },
    ],
    Linux: [
      { label: 'ip a', cmd: 'ip a' },
      { label: 'ip route', cmd: 'ip route' },
      { label: 'ping -c 4', cmd: 'ping -c 4 1.1.1.1' },
      { label: 'mtr 8.8.8.8', cmd: 'mtr -n -c 5 8.8.8.8' },
      { label: 'netstat -tuln', cmd: 'netstat -tuln' },
      { label: 'tcpdump pptp', cmd: 'tcpdump -nn -i any port 1723' },
    ],
  };

  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const promptText = currentSession.prompt;
    const newLines = [...currentSession.lines];

    newLines.push({
      id: `cmd_${Date.now()}`,
      type: 'prompt',
      text: `${promptText}${trimmed}`,
    });

    const lower = trimmed.toLowerCase();

    if (lower === 'clear') {
      updateSessionLines(currentSession.id, []);
      setInputVal('');
      return;
    }

    if (lower === 'help') {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Termius-Style Terminal Console (${currentSession.protocol} Mode):
  MikroTik: /interface print, /ip address print, /ppp secret print, /system resource print
  Cisco:    show ip interface brief, show running-config, show mac address-table
  Linux:    ip a, ip route, ping -c 4 <ip>, traceroute <ip>
  General:  clear, help, exit`,
      });
    } else if (lower.includes('show ip int') || lower.includes('sh ip int br')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Interface              IP-Address      OK? Method Status                Protocol
FastEthernet0/1        192.168.88.2    YES NVRAM  up                    up      
FastEthernet0/2        unassigned      YES unset  up                    up      
Vlan1                  192.168.88.2    YES NVRAM  up                    up      
Tunnel0                10.99.0.2       YES unset  up                    up`,
      });
    } else if (lower.includes('show mac') || lower.includes('sh mac')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    b869.f411.2201    DYNAMIC     Fa0/1 (MikroTik RB4011)
   1    001a.2b3c.4d5e    DYNAMIC     Fa0/2 (Server Host)
Total Mac Addresses for this criterion: 2`,
      });
    } else if (lower.includes('show run') || lower.includes('sh run')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Building configuration...
Current configuration : 1842 bytes
!
version 15.0
service timestamps debug datetime msec
hostname SW-Core-3560
!
interface FastEthernet0/1
 description Trunk to MikroTik Gateway
 switchport mode trunk
!
interface Vlan1
 ip address 192.168.88.2 255.255.255.0
!
end`,
      });
    } else if (lower.includes('ip a') && currentSession.protocol === 'SSH') {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN 
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP 
    inet 192.168.88.10/24 brd 192.168.88.255 scope global eth0
3: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1400 qdisc pfifo_fast state UP
    inet 10.99.0.2 peer 10.99.0.1/32 scope global tun0`,
      });
    } else if (lower.includes('pptp-server') && lower.includes('print')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Flags: X - disabled, D - dynamic, R - running
  #   NAME           SERVICE  MAX-MTU  MAX-MRU  AUTHENTICATION    DEFAULT-PROFILE
  0 R pptp-server    pptp     1400     1400     mschap2,mschap1   pptp-split-profile
      enabled: yes
      keepalive-timeout: 30s
      split-tunneling-enforced: yes (0.0.0.0/0 denied)
      gre-proto-47-forwarding: enabled`,
      });
    } else if (lower.includes('/ip address') || lower.includes('/ip addr')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Flags: X - disabled, I - invalid, D - dynamic
  #   ADDRESS            NETWORK         INTERFACE
  0   192.168.88.1/24    192.168.88.0    bridge-lan
  1   10.99.0.1/32       10.99.0.2       <pptp-noc_admin>
  2 D 103.45.89.12/28    103.45.89.0     ether1-WAN`,
      });
    } else if (lower.includes('ppp secret') || lower.includes('ppp sec')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Flags: X - disabled
  #   NAME        SERVICE  CALLER-ID  PASSWORD    PROFILE             REMOTE-ADDRESS
  0   noc_admin   pptp                ********    pptp-split-profile  10.99.0.2
  1   backup_eng  pptp                ********    default-encryption  10.99.0.3`,
      });
    } else if (lower.includes('ping')) {
      const target = trimmed.split(' ')[1] || '8.8.8.8';
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `  PING ${target} 56(84) bytes of data.
  64 bytes from ${target}: icmp_seq=1 ttl=58 time=14.2 ms
  64 bytes from ${target}: icmp_seq=2 ttl=58 time=13.8 ms
  64 bytes from ${target}: icmp_seq=3 ttl=58 time=15.1 ms
  64 bytes from ${target}: icmp_seq=4 ttl=58 time=13.9 ms
  --- ${target} ping statistics ---
  4 packets transmitted, 4 received, 0% packet loss, time 3004ms
  rtt min/avg/max/mdev = 13.8/14.2/15.1/0.5 ms`,
      });
    } else if (lower.includes('system resource') || lower.includes('/system res')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `                   uptime: 42d 18h 33m 14s
                  version: 7.14.3 (stable)
              free-memory: 814.2MiB
             total-memory: 1024.0MiB
                      cpu: ARM64 Cortex-A72 (4 cores)
                 cpu-load: 6%
               board-name: RB4011iGS+`,
      });
    } else {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'error',
        text: `command not found: "${trimmed}" - type 'help' for command reference`,
      });
    }

    updateSessionLines(currentSession.id, newLines);
    setInputVal('');
  };

  const updateSessionLines = (sessionId: string, newLines: TerminalLine[]) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, lines: newLines } : s))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(inputVal);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIndex + 1 < history.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      } else {
        setHistoryIndex(-1);
        setInputVal('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (inputVal.startsWith('/ip')) {
        setInputVal('/ip address print');
      } else if (inputVal.startsWith('/int')) {
        setInputVal('/interface pptp-server server print');
      } else if (inputVal.startsWith('sh ip')) {
        setInputVal('show ip interface brief');
      }
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `sess_${Date.now()}`;
    const prompt =
      newProtocol === 'SSH'
        ? `[admin@${newHost.replace(/\./g, '-')}] > `
        : `${newSessionName}# `;

    const created: TerminalSession = {
      id: newId,
      name: newSessionName || `${newProtocol} ${newHost}`,
      host: newHost.trim(),
      port: newPort || (newProtocol === 'SSH' ? 22 : 23),
      protocol: newProtocol,
      username: newUsername.trim(),
      status: 'Connected',
      prompt,
      lines: [
        { id: '1', type: 'info', text: `  Connecting to ${newHost}:${newPort} via ${newProtocol}...` },
        { id: '2', type: 'success', text: `  Connected to ${newHost} (${newProtocol} session established).` },
      ],
    };

    setSessions((prev) => [...prev, created]);
    setActiveSessionId(newId);
    setIsNewSessionModalOpen(false);
  };

  const handleCloseSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const handleOpenScriptGenerator = async () => {
    const script = await generateMikrotikScript({
      profileName: activeProfile?.name || 'isp-pptp',
      serverIp: activeProfile?.server || '192.168.88.1',
      remoteSubnets: activeProfile?.remoteSubnets || ['192.168.88.0/24'],
      username: activeProfile?.username || 'pptp-admin',
      password: activeProfile?.password || 'ChangeMeSecurely!',
      mppe: activeProfile?.encryption || 'mppe-128',
      routerOsVersion: 'v7',
    });
    setGeneratedScript(script);
    setIsScriptModalOpen(true);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-cyan-400" />
            <span>Multi-Session SSH &amp; Telnet Terminal (Termius Style)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Troubleshoot multiple PPTP nodes, routers, and switches simultaneously with tabbed sessions and quick command snippets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewSessionModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Host Session</span>
          </button>
          <button
            onClick={handleOpenScriptGenerator}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span>MikroTik Script</span>
          </button>
        </div>
      </div>

      {/* Termius-Style Session Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800/80">
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-mono flex items-center gap-2 cursor-pointer transition-all border-t border-l border-r ${
                isActive
                  ? 'bg-slate-900 border-slate-700 text-cyan-300 font-bold shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                  s.protocol === 'SSH' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-purple-950 text-purple-400 border border-purple-800'
                }`}
              >
                {s.protocol}
              </span>
              <span className="truncate max-w-[140px]">{s.name}</span>
              <span className="text-[10px] text-slate-500">:{s.port}</span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => handleCloseSession(s.id, e)}
                  className="hover:text-red-400 ml-1 text-slate-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => setIsNewSessionModalOpen(true)}
          className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded cursor-pointer transition-colors"
          title="Open New Host Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Snippet Bar (Termius Quick Snippets) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px] shrink-0 font-bold flex items-center gap-1">
            <Command className="w-3.5 h-3.5 text-cyan-400" />
            <span>Snippets:</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-950 rounded p-0.5 border border-slate-800">
            {(['MikroTik', 'Cisco', 'Linux'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSnippetCategory(cat)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  snippetCategory === cat ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Snippet Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {snippets[snippetCategory].map((snip, idx) => (
            <button
              key={idx}
              onClick={() => executeCommand(snip.cmd)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 rounded border border-slate-700/80 shrink-0 cursor-pointer text-[11px] transition-colors"
            >
              {snip.label}
            </button>
          ))}
          <button
            onClick={() => executeCommand('clear')}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 shrink-0 cursor-pointer text-[11px]"
          >
            clear
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-xs shadow-inner h-[460px] overflow-y-auto flex flex-col justify-between"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="space-y-1">
          {currentSession?.lines.map((l) => (
            <div
              key={l.id}
              className={`whitespace-pre-wrap leading-relaxed ${
                l.type === 'prompt'
                  ? 'text-cyan-400 font-bold'
                  : l.type === 'info'
                  ? 'text-slate-400'
                  : l.type === 'success'
                  ? 'text-emerald-400'
                  : l.type === 'error'
                  ? 'text-red-400'
                  : 'text-slate-200'
              }`}
            >
              {l.text}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Input Prompt */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-900 mt-2 text-cyan-400 font-bold">
          <span>{currentSession?.prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`type ${currentSession?.protocol} command (e.g. /ip address print or show ip int brief)...`}
            className="flex-1 bg-transparent text-white focus:outline-none font-mono text-xs caret-cyan-400 placeholder:text-slate-700"
            autoFocus
          />
        </div>
      </div>

      {/* New Session Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-cyan-400" />
                <span>Open New Terminal Session</span>
              </h3>
              <button
                onClick={() => setIsNewSessionModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Session Label</label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Distribution Switch or Core RB4011"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Protocol</label>
                  <select
                    value={newProtocol}
                    onChange={(e: any) => {
                      const proto = e.target.value as 'SSH' | 'Telnet';
                      setNewProtocol(proto);
                      setNewPort(proto === 'SSH' ? 22 : 23);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="SSH">SSH (Port 22)</option>
                    <option value="Telnet">Telnet (Port 23)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value) || 22)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Host IP / FQDN</label>
                <input
                  type="text"
                  required
                  value={newHost}
                  onChange={(e) => setNewHost(e.target.value)}
                  placeholder="192.168.88.1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors cursor-pointer shadow-sm"
                >
                  Connect {newProtocol}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MikroTik .rsc Script Export Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Generated MikroTik RouterOS Script (.rsc)
                </h3>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              Paste this script into your MikroTik router (via Winbox Terminal or SSH) to configure the PPTP Server and split-tunneling firewall rules.
            </p>

            <div className="mt-3 bg-black/90 border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-200 h-72 overflow-y-auto whitespace-pre">
              {generatedScript}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                RouterOS v7 &amp; v6 compliant · Split Tunneling
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
