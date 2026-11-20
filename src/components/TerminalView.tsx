import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Copy,
  Check,
  Code2,
  Plus,
  X,
  Radio,
  Command,
  Send,
  Bookmark,
  Save,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  KeyRound,
  Cloud,
  HardDrive,
  HelpCircle,
  ArrowRightToLine,
  BookOpen,
  Search,
  FileText,
  Usb,
  Zap,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from 'lucide-react';
import { VpnProfile, SavedTerminalSession, TerminalVendor } from '../types/vpn';
import { generateMikrotikScript, isPrivateIp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCliHelp, getCliTabCompletion, getCliSuggestions } from '../services/cliCommandTree';
import { DEVICE_COMMAND_CATALOG } from '../services/deviceCommandCatalog';
import { CommandNotepadPanel } from './CommandNotepadPanel';
import {
  serialConsoleManager,
  BAUD_RATES,
  getRecommendedBaudRate,
  isWebSerialSupported,
  SerialDataBits,
  SerialParity,
  SerialStopBits,
  SerialLineEnding,
} from '../services/serialConsole';

interface PendingCliHandoff {
  brand: string;
  hostIp: string;
  cliScript: string;
  deviceName: string;
}

interface TerminalViewProps {
  activeProfile: VpnProfile | null;
  isConnected: boolean;
  pendingCliHandoff?: PendingCliHandoff | null;
  onClearPendingCli?: () => void;
}

interface TerminalSession {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'SSH' | 'Telnet' | 'Console';
  vendor: TerminalVendor;
  username: string;
  password?: string;
  autoLogin?: boolean;
  liveTelnetId?: string;
  liveSerialId?: string;
  baudRate?: number;
  status: 'Connected' | 'Connecting' | 'Closed';
  prompt: string;
  lines: TerminalLine[];
}

interface TerminalLine {
  id: string;
  type: 'prompt' | 'output' | 'info' | 'error' | 'success';
  text: string;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  activeProfile,
  isConnected,
  pendingCliHandoff,
  onClearPendingCli,
}) => {
  const { user, terminalSessions, saveTerminalSession, deleteTerminalSession, commandNotes } = useAuth();
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: 'sess_1',
      name: activeProfile?.name || 'Core Router',
      host: activeProfile?.server || '192.168.88.1',
      port: 22,
      protocol: 'SSH',
      vendor: 'MikroTik',
      username: activeProfile?.username || 'admin',
      password: activeProfile?.password || '',
      autoLogin: true,
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
      vendor: 'Cisco',
      username: 'admin',
      password: '',
      autoLogin: true,
      status: 'Connected',
      prompt: 'SW-Core-3560# ',
      lines: [
        { id: 't1', type: 'info', text: '  Trying 192.168.88.2...' },
        { id: 't2', type: 'success', text: '  Connected to 192.168.88.2 (Telnet port 23).' },
        { id: 't3', type: 'info', text: "  Escape character is '^]'." },
        { id: 't4', type: 'output', text: '  Cisco IOS Software, C3560 Software (C3560-IPBASEK9-M)\n' },
      ],
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState<string>('sess_1');
  const [inputVal, setInputVal] = useState('');
  const [isTerminalFocused, setIsTerminalFocused] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // New / Edit Session Modal State
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [newHost, setNewHost] = useState(activeProfile?.server || '192.168.88.1');
  const [newPort, setNewPort] = useState(23);
  const [newProtocol, setNewProtocol] = useState<'SSH' | 'Telnet'>('Telnet');
  const [newVendor, setNewVendor] = useState<TerminalVendor>('BDCOM');
  const [newUsername, setNewUsername] = useState('admin');
  const [newPassword, setNewPassword] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [saveToVault, setSaveToVault] = useState(true);
  const [newAutoLogin, setNewAutoLogin] = useState(true);
  const [newSessionName, setNewSessionName] = useState('BDCOM OLT');
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Record<string, boolean>>({});
  const [vaultToast, setVaultToast] = useState<string | null>(null);

  // Quick Direct Telnet & Console Cable (USB/COM Serial) Bar State
  const [quickConnMode, setQuickConnMode] = useState<'telnet' | 'console'>('telnet');
  const [quickHost, setQuickHost] = useState('');
  const [quickPort, setQuickPort] = useState(23);
  const [quickUser, setQuickUser] = useState('admin');
  const [quickPass, setQuickPass] = useState('');
  const [serialBaud, setSerialBaud] = useState<number>(115200);
  const [serialDataBits, setSerialDataBits] = useState<SerialDataBits>(8);
  const [serialParity, setSerialParity] = useState<SerialParity>('none');
  const [serialStopBits, setSerialStopBits] = useState<SerialStopBits>(1);
  const [serialLineEnding, setSerialLineEnding] = useState<SerialLineEnding>('\r');
  const [connectingSerial, setConnectingSerial] = useState(false);
  const [useJumpGateway, setUseJumpGateway] = useState(false);

  const canUseMikrotikJump = Boolean(!isConnected && activeProfile?.server && !isPrivateIp(activeProfile.server));

  useEffect(() => {
    if (isConnected) {
      setUseJumpGateway(false);
      return;
    }
    const clean = quickHost.split(':')[0].trim();
    if (canUseMikrotikJump && isPrivateIp(clean)) {
      setUseJumpGateway(true);
    } else if (!isPrivateIp(clean)) {
      setUseJumpGateway(false);
    }
  }, [quickHost, canUseMikrotikJump, isConnected]);

  // Pending Topology CLI Handoff
  const [copiedHandoff, setCopiedHandoff] = useState(false);
  const [pushingCli, setPushingCli] = useState(false);

  // Script Generator State
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [copied, setCopied] = useState(false);

  // Snippets & Brand/Model Command Catalog Explorer (ROS -> Junos)
  const [snippetCategory, setSnippetCategory] = useState<TerminalVendor>('MikroTik');
  const [showAllCommandsPanel, setShowAllCommandsPanel] = useState(true);
  const [showNotepadPanel, setShowNotepadPanel] = useState(false);
  const [notepadDraft, setNotepadDraft] = useState<{
    title: string;
    vendor: TerminalVendor | 'All';
    commands: string;
  } | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('mt_ros7');
  const [cmdSearchQuery, setCmdSearchQuery] = useState('');
  const [cmdCategoryFilter, setCmdCategoryFilter] = useState<string>('ALL');
  const [remoteBufferHint, setRemoteBufferHint] = useState('');

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resizable Terminal Box State (Drag height, S/M/L presets, Font size A-/A+, Fullscreen)
  const [termHeight, setTermHeight] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('uwebui_term_height'));
      return saved >= 220 && saved <= 960 ? saved : 490;
    } catch {
      return 490;
    }
  });
  const [termFontSize, setTermFontSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('uwebui_term_font'));
      return saved >= 10 && saved <= 20 ? saved : 12;
    } catch {
      return 12;
    }
  });
  const [isTermExpanded, setIsTermExpanded] = useState(false);
  const [isResizingTerm, setIsResizingTerm] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('uwebui_term_height', String(termHeight));
    } catch {}
  }, [termHeight]);

  useEffect(() => {
    try {
      localStorage.setItem('uwebui_term_font', String(termFontSize));
    } catch {}
  }, [termFontSize]);

  useEffect(() => {
    if (!isTermExpanded) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsTermExpanded(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isTermExpanded]);

  const startTermResize = (startClientY: number) => {
    if (isTermExpanded) return;
    const initialH = termHeight;
    setIsResizingTerm(true);

    const onMouseMove = (ev: MouseEvent) => {
      const nextH = Math.max(220, Math.min(960, Math.round(initialH + (ev.clientY - startClientY))));
      setTermHeight(nextH);
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length > 0) {
        const nextH = Math.max(220, Math.min(960, Math.round(initialH + (ev.touches[0].clientY - startClientY))));
        setTermHeight(nextH);
      }
    };
    const stopResize = () => {
      setIsResizingTerm(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopResize);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', stopResize);
  };

  useEffect(() => {
    const models = DEVICE_COMMAND_CATALOG[snippetCategory] || [];
    if (models.length > 0 && !models.some((m) => m.id === selectedModelId)) {
      setSelectedModelId(models[0].id);
    }
    setSerialBaud(getRecommendedBaudRate(snippetCategory));
  }, [snippetCategory, selectedModelId]);

  useEffect(() => {
    if (pendingCliHandoff?.hostIp) {
      setQuickHost(pendingCliHandoff.hostIp);
      setQuickPort(23);
      const supported: TerminalVendor[] = [
        'MikroTik',
        'Cisco',
        'Huawei',
        'ZTE',
        'BDCOM',
        'VSOL',
        'C-Data',
        'Palo Alto',
        'Juniper',
        'Arista',
        'Ruijie',
        'TP-Link',
      ];
      if (supported.includes(pendingCliHandoff.brand as TerminalVendor)) {
        setSnippetCategory(pendingCliHandoff.brand as TerminalVendor);
      }
    }
  }, [pendingCliHandoff]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.lines]);

  // Real-time background polling for active live Telnet TCP sessions
  const activeLiveTelnetId = currentSession?.liveTelnetId;
  const activeSessionKey = currentSession?.id;

  useEffect(() => {
    if (!activeLiveTelnetId || !activeSessionKey) return;
    let cancelled = false;

    const timer = setInterval(async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`/api/telnet/sessions/${activeLiveTelnetId}/poll`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;

        if (data.output || !data.connected) {
          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== activeSessionKey) return s;
              const appended = appendLiveTelnetChunk(s.lines, data.output);
              if (!data.connected) {
                appended.push({
                  id: `closed_${Date.now()}`,
                  type: 'error',
                  text: `\n  [Telnet Disconnected] ${data.closedReason || 'Remote host closed connection.'}`,
                });
                return {
                  ...s,
                  status: 'Closed',
                  liveTelnetId: undefined,
                  lines: appended,
                };
              }
              return { ...s, lines: appended };
            })
          );
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 180);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeLiveTelnetId, activeSessionKey]);

  const snippets = {
    MikroTik: [
      { label: '/interface pr', cmd: '/interface print' },
      { label: '/ip addr pr', cmd: '/ip address print' },
      { label: '/pptp-srv pr', cmd: '/interface pptp-server server print' },
      { label: '/ppp secret pr', cmd: '/ppp secret print' },
      { label: '/system resource', cmd: '/system resource print' },
      { label: '/ping 8.8.8.8', cmd: '/ping 8.8.8.8 count=4' },
    ],
    Cisco: [
      { label: 'enable', cmd: 'enable' },
      { label: 'sh ip int br', cmd: 'show ip interface brief' },
      { label: 'sh run', cmd: 'show running-config' },
      { label: 'sh mac addr', cmd: 'show mac address-table' },
      { label: 'sh vlan br', cmd: 'show vlan brief' },
      { label: 'ping 10.99.0.1', cmd: 'ping 10.99.0.1' },
    ],
    Huawei: [
      { label: 'sys-view', cmd: 'system-view' },
      { label: 'scr-len 0', cmd: 'screen-length 0 temporary' },
      { label: 'dis ip int br', cmd: 'display ip interface brief' },
      { label: 'dis ont all', cmd: 'display ont info 0 all' },
      { label: 'dis cur', cmd: 'display current-configuration' },
      { label: 'dis mac', cmd: 'display mac-address' },
    ],
    BDCOM: [
      { label: 'enable', cmd: 'enable' },
      { label: 'sh epon onu', cmd: 'show epon active-onu' },
      { label: 'sh gpon onu', cmd: 'show gpon active-onu' },
      { label: 'sh int br', cmd: 'show interface brief' },
      { label: 'sh mac addr', cmd: 'show mac address-table' },
      { label: 'sh run', cmd: 'show running-config' },
    ],
    VSOL: [
      { label: 'enable', cmd: 'enable' },
      { label: 'sh onu auth', cmd: 'show onu authinfo all' },
      { label: 'sh pon info', cmd: 'show pon onu-information' },
      { label: 'sh vlan all', cmd: 'show vlan all' },
      { label: 'sh optical', cmd: 'show pon optical transceiver' },
      { label: 'sh run', cmd: 'show running-config' },
    ],
    'Palo Alto': [
      { label: 'sh sys info', cmd: 'show system info' },
      { label: 'sh int all', cmd: 'show interface all' },
      { label: 'sh routing', cmd: 'show routing route' },
      { label: 'sh session', cmd: 'show session info' },
      { label: 'pager off', cmd: 'set cli pager off' },
      { label: 'enable telnet', cmd: 'set deviceconfig system service disable-telnet no' },
    ],
    Juniper: [
      { label: 'sh int terse', cmd: 'show interfaces terse' },
      { label: 'sh bgp sum', cmd: 'show bgp summary' },
      { label: 'sh route', cmd: 'show route summary' },
      { label: 'sh optics', cmd: 'show interfaces diagnostics optics' },
      { label: 'sh vlans', cmd: 'show vlans' },
      { label: 'sh chassis hw', cmd: 'show chassis hardware' },
    ],
    ZTE: [
      { label: 'onu uncfg', cmd: 'show gpon onu uncfg' },
      { label: 'onu state', cmd: 'show gpon onu state gpon-olt_1/2/1' },
      { label: 'pon power', cmd: 'show pon power onu-rx gpon-olt_1/2/1' },
      { label: 'sh card', cmd: 'show card' },
      { label: 'sh vlan', cmd: 'show vlan summary' },
      { label: 'sh mac', cmd: 'show mac' },
    ],
    'C-Data': [
      { label: 'ont autofind', cmd: 'show ont autofind all' },
      { label: 'ont info all', cmd: 'show ont info 0 all' },
      { label: 'ont optical', cmd: 'show ont optical-info 0/0/1 all' },
      { label: 'sh vlan all', cmd: 'show vlan all' },
      { label: 'sh mac all', cmd: 'show mac-address all' },
      { label: 'save', cmd: 'save' },
    ],
    Arista: [
      { label: 'sh int status', cmd: 'show interfaces status' },
      { label: 'sh mlag', cmd: 'show mlag' },
      { label: 'sh po sum', cmd: 'show port-channel summary' },
      { label: 'sh bgp sum', cmd: 'show ip bgp summary' },
      { label: 'sh mac addr', cmd: 'show mac address-table' },
      { label: 'sh optics', cmd: 'show interfaces transceiver' },
    ],
    Ruijie: [
      { label: 'sh int status', cmd: 'show interfaces status' },
      { label: 'sh ap sum', cmd: 'show aggregateport summary' },
      { label: 'sh vlan', cmd: 'show vlan' },
      { label: 'sh mac addr', cmd: 'show mac-address-table' },
      { label: 'sh ip route', cmd: 'show ip route' },
      { label: 'sh optics', cmd: 'show interfaces transceiver diagnosis' },
    ],
    'TP-Link': [
      { label: 'sh int status', cmd: 'show interface status' },
      { label: 'sh vlan br', cmd: 'show vlan brief' },
      { label: 'sh mac addr', cmd: 'show mac address-table' },
      { label: 'sh lag sum', cmd: 'show etherchannel summary' },
      { label: 'sh stp', cmd: 'show spanning-tree active' },
      { label: 'sh sys-info', cmd: 'show system-info' },
    ],
  };

  const appendLiveTelnetChunk = (existing: TerminalLine[], rawChunk?: string): TerminalLine[] => {
    if (!rawChunk) return [...existing];
    // Process backspace (\x08) sequences cleanly when routers redraw prompts or Tab completions
    const applyBackspaces = (base: string, chunk: string) => {
      let result = base;
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (ch === '\x08' || ch === '\x7f') {
          if (result.length > 0 && !result.endsWith('\n')) {
            result = result.slice(0, -1);
          }
        } else {
          result += ch;
        }
      }
      return result;
    };

    const next = [...existing];
    const last = next[next.length - 1];
    if (last && last.type === 'output' && !last.text.endsWith('\n')) {
      next[next.length - 1] = {
        ...last,
        text: applyBackspaces(last.text, rawChunk),
      };
    } else {
      next.push({
        id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'output',
        text: applyBackspaces('', rawChunk),
      });
    }
    return next;
  };

  const sendToLiveTelnet = async (sessionId: string, liveId: string, payload: string, raw = false) => {
    try {
      const resp = await fetch(`/api/telnet/sessions/${liveId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload, raw }),
      });
      const data = await resp.json();
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const nextLines = appendLiveTelnetChunk(s.lines, data.output);
          if (data.connected === false) {
            nextLines.push({
              id: `disc_${Date.now()}`,
              type: 'error',
              text: `\n  [Telnet Disconnected] ${data.closedReason || data.error || 'Connection closed.'}`,
            });
            return { ...s, status: 'Closed', liveTelnetId: undefined, lines: nextLines };
          }
          return { ...s, lines: nextLines };
        })
      );
    } catch (err: any) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                lines: [
                  ...s.lines,
                  { id: `err_${Date.now()}`, type: 'error', text: `  [Send Failed] ${err?.message || 'Network error'}` },
                ],
              }
            : s
        )
      );
    }
  };

  const sendToLiveSerial = async (sessionId: string, serialId: string, payload: string, raw = false) => {
    const ok = await serialConsoleManager.write(serialId, payload, raw);
    if (!ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                status: 'Closed',
                liveSerialId: undefined,
                lines: [
                  ...s.lines,
                  {
                    id: `ser_err_${Date.now()}`,
                    type: 'error',
                    text: '  [Console Cable Write Failed] USB/COM port is closed or unplugged.',
                  },
                ],
              }
            : s
        )
      );
    }
  };

  const handleConnectConsoleCable = async () => {
    setConnectingSerial(true);
    const newId = `sess_serial_${Date.now()}`;
    const vendorLabel = snippetCategory;
    const result = await serialConsoleManager.connect({
      baudRate: serialBaud,
      dataBits: serialDataBits,
      parity: serialParity,
      stopBits: serialStopBits,
      lineEnding: serialLineEnding,
      onData: (chunk) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === newId ? { ...s, lines: appendLiveTelnetChunk(s.lines, chunk) } : s
          )
        );
      },
      onClose: (reason) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === newId
              ? {
                  ...s,
                  status: 'Closed',
                  liveSerialId: undefined,
                  lines: [
                    ...s.lines,
                    {
                      id: `ser_closed_${Date.now()}`,
                      type: 'error',
                      text: `\n  [Console Cable Disconnected] ${reason || 'Port closed.'}`,
                    },
                  ],
                }
              : s
          )
        );
      },
      onError: (msg) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === newId
              ? {
                  ...s,
                  lines: [
                    ...s.lines,
                    { id: `ser_readerr_${Date.now()}`, type: 'error', text: `\n  [Serial Error] ${msg}` },
                  ],
                }
              : s
          )
        );
      },
    });
    setConnectingSerial(false);

    if (!result.ok || !result.id) {
      if (!result.isCancelled && currentSession) {
        updateSessionLines(currentSession.id, [
          ...currentSession.lines,
          {
            id: `ser_fail_${Date.now()}`,
            type: 'error',
            text: `  [Console Cable] ${result.error || 'Could not open USB/COM serial port.'}`,
          },
          ...(result.isIframeBlocked || result.isUnsupported
            ? [
                {
                  id: `ser_tip_${Date.now()}`,
                  type: 'info' as const,
                  text: '  Tip: Open this app directly in Desktop Chrome/Edge (standalone tab or installed PWA) or use the Android APK with a USB-OTG Console Cable (FTDI / PL2303 / CH340 / CP2102).',
                },
              ]
            : []),
        ]);
        showToastMessage(result.isIframeBlocked ? 'Open in standalone Chrome/Edge tab for USB COM port' : result.error || 'Serial connect failed');
      }
      return;
    }

    const parityLetter = serialParity === 'none' ? 'N' : serialParity === 'even' ? 'E' : 'O';
    const created: TerminalSession = {
      id: newId,
      name: `${vendorLabel} Console`,
      host: result.chipName || 'USB-COM',
      port: serialBaud,
      protocol: 'Console',
      vendor: vendorLabel,
      username: quickUser.trim(),
      password: quickPass,
      autoLogin: false,
      liveSerialId: result.id,
      baudRate: serialBaud,
      status: 'Connected',
      prompt: `${vendorLabel}@COM> `,
      lines: [
        {
          id: `ser_open_1_${Date.now()}`,
          type: 'success',
          text: `  [CONSOLE CABLE CONNECTED] ${result.label} · ${serialBaud} bps (${serialDataBits}-${parityLetter}-${serialStopBits})`,
        },
        {
          id: `ser_open_2_${Date.now()}`,
          type: 'info',
          text: "  Press Enter to wake router/switch/OLT prompt. '?' Help, Tab, Ctrl+C, Break & Command Notepad work live over RS-232.",
        },
      ],
    };

    setSessions((prev) => [...prev, created]);
    setActiveSessionId(newId);
    showToastMessage(`Console Cable connected @ ${serialBaud} bps!`);
    // Send a gentle CR to wake Cisco/Huawei/BDCOM/MikroTik serial prompt
    setTimeout(() => {
      if (result.id) {
        serialConsoleManager.write(result.id, '', false);
      }
    }, 250);
    inputRef.current?.focus();
  };

  const handleDisconnectLiveSerial = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target?.liveSerialId) return;
    await serialConsoleManager.disconnect(target.liveSerialId);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'Closed',
              liveSerialId: undefined,
              lines: [
                ...s.lines,
                { id: `ser_udisc_${Date.now()}`, type: 'info', text: '  [Console Cable Disconnected by user]' },
              ],
            }
          : s
      )
    );
    showToastMessage('Console Cable disconnected.');
  };

  const handleSendSerialBreak = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target?.liveSerialId) return;
    const ok = await serialConsoleManager.sendBreak(target.liveSerialId, 250);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              lines: [
                ...s.lines,
                {
                  id: `ser_brk_${Date.now()}`,
                  type: ok ? 'info' : 'error',
                  text: ok
                    ? '  [RS-232 BREAK Signal Sent (250ms) — ROMMON / BootROM interrupt]'
                    : '  [Break Failed] Adapter does not support hardware BREAK signal.',
                },
              ],
            }
          : s
      )
    );
  };

  const handlePushTopologyCli = async () => {
    if (!pendingCliHandoff || (!currentSession?.liveTelnetId && !currentSession?.liveSerialId)) return;
    const cmds = pendingCliHandoff.cliScript
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('!') && !l.startsWith('#'));
    setPushingCli(true);
    for (const line of cmds) {
      if (currentSession.liveSerialId) {
        await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, line, false);
      } else if (currentSession.liveTelnetId) {
        await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, line, false);
      }
      await new Promise((r) => setTimeout(r, 220));
    }
    setPushingCli(false);
    showToastMessage(
      `${cmds.length} commands sent to live ${currentSession.liveSerialId ? 'Console Cable' : 'Telnet'} session.`
    );
  };

  const executeCommand = async (cmd: string, allowEmpty = false) => {
    const trimmed = cmd.trim();
    if (!trimmed && !allowEmpty) return;

    if (currentSession.liveSerialId) {
      if (trimmed.toLowerCase() === 'clear') {
        updateSessionLines(currentSession.id, []);
        setInputVal('');
        return;
      }
      if (trimmed) {
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIndex(-1);
      }
      setInputVal('');
      await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, cmd, false);
      return;
    }

    if (currentSession.liveTelnetId) {
      if (trimmed.toLowerCase() === 'clear') {
        updateSessionLines(currentSession.id, []);
        setInputVal('');
        return;
      }
      if (trimmed) {
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIndex(-1);
      }
      setInputVal('');
      await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, cmd, false);
      return;
    }

    if (!trimmed) return;

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const telnetCliMatch = trimmed.match(/^telnet\s+([a-zA-Z0-9._-]+)(?::(\d+)|\s+(\d+))?$/i);
    const bareIpMatch = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
    if (telnetCliMatch || bareIpMatch) {
      const targetHost = telnetCliMatch ? telnetCliMatch[1] : bareIpMatch![1];
      const parsedPort = telnetCliMatch
        ? parseInt(telnetCliMatch[2] || telnetCliMatch[3] || '23', 10)
        : parseInt(bareIpMatch![2] || '23', 10);
      const savedMatch = terminalSessions.find(
        (s) => s.host.toLowerCase() === targetHost.toLowerCase() && s.port === parsedPort
      );
      setInputVal('');
      await launchTerminalConnection({
        name: savedMatch?.name || `Telnet ${targetHost}`,
        host: targetHost,
        port: parsedPort || 23,
        protocol: 'Telnet',
        vendor: savedMatch?.vendor || snippetCategory,
        username: savedMatch?.username || '',
        password: savedMatch?.password || '',
        autoLogin: savedMatch ? savedMatch.autoLogin : true,
      });
      return;
    }

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

    if (trimmed === '?' || trimmed.endsWith('?')) {
      const prefixBeforeQ = trimmed.slice(0, -1);
      handleQuestionHelp(prefixBeforeQ);
      return;
    }

    if (lower === 'help') {
      const helpRes = getCliHelp(snippetCategory, '');
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `${helpRes.formatted}\n\n  Tips: Type '?' anywhere for contextual help (MikroTik/Cisco/Huawei/BDCOM/VSOL) · Press 'Tab' for command autocomplete · Live Telnet: telnet <IP> [port]`,
      });
    } else if (lower === 'enable' || lower === 'system-view' || lower === 'screen-length 0 temporary' || lower === 'set cli pager off') {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'success',
        text: `OK · Mode updated (${trimmed})`,
      });
    } else if (lower.includes('display ip int') || lower.includes('show interface brief') || lower.includes('show ip int') || lower.includes('sh ip int br')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Interface              IP-Address      OK? Method Status                Protocol
GE0/0/1 (Uplink)       10.99.0.1       YES NVRAM  up                    up      
Vlanif100              192.168.88.2    YES NVRAM  up                    up      
EPON0/1                unassigned      YES unset  up                    up      
GPON0/1                unassigned      YES unset  up                    up`,
      });
    } else if (lower.includes('display ont') || lower.includes('show epon active-onu') || lower.includes('show gpon active-onu') || lower.includes('show onu auth') || lower.includes('show pon onu')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `PON Port   ONU-ID  MAC / SN              Status    Rx Power (dBm)  Distance
-----------------------------------------------------------------------------
PON0/1     1       e067.b311.a401        online    -18.4 dBm       1.2 km
PON0/1     2       4857.5443.9b12        online    -20.1 dBm       2.4 km
PON0/2     1       f492.bf22.10c8        online    -17.8 dBm       0.8 km
Total Active ONUs: 3 (BDCOM / VSOL / Huawei OLT View)`,
      });
    } else if (lower.includes('show pon optical')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Port     Temp(C)  Volt(V)  Bias(mA)  TxPower(dBm)  Status
PON0/1   41.2     3.31     14.8      +5.42         Normal
PON0/2   42.0     3.30     15.1      +5.18         Normal`,
      });
    } else if (lower.includes('show interfaces terse') || lower.includes('show bgp summary') || lower.includes('show route') || lower.includes('show chassis') || lower.includes('show ethernet-switching') || lower.includes('show security')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Juniper Junos OS (MX204 / EX4300 / SRX300):
  Interface        Admin Link Proto    Local
  xe-0/1/0.0       up    up   inet     10.99.0.1/30
  et-0/0/0.0       up    up   inet     103.45.89.2/30
  irb.100          up    up   inet     192.168.88.1/24
  BGP Peers: 2 Established (AS65001 Upstream: 912,450 rx prefixes) · Junos 23.2R1`,
      });
    } else if (lower.includes('show system info') || lower.includes('show session info') || lower.includes('show routing route') || lower.includes('show interface all')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `hostname: PA-Edge-FW01
ip-address: 192.168.88.254
model: PA-440 · sw-version: 11.1.2-h3
active-sessions: 4,812 · throughput: 412 Mbps
management-telnet: disabled by default (enable via: set deviceconfig system service disable-telnet no)`,
      });
    } else if (lower.includes('disable-telnet')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'success',
        text: `Palo Alto PAN-OS: Run 'configure' -> 'set deviceconfig system service disable-telnet no' -> 'commit'`,
      });
    } else if (lower.includes('show mac') || lower.includes('sh mac') || lower.includes('display mac')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    b869.f411.2201    DYNAMIC     GE0/1 (MikroTik RB4011)
 100    001a.2b3c.4d5e    DYNAMIC     EPON0/1:1 (Client ONU)
Total Mac Addresses for this criterion: 2`,
      });
    } else if (lower.includes('show run') || lower.includes('sh run') || lower.includes('display cur')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `Building configuration...
!
hostname CORE-SWITCH-OLT
!
interface GigabitEthernet0/1
 description Uplink to MikroTik Core
 switchport mode trunk
!
interface Vlan100
 ip address 192.168.88.2 255.255.255.0
!
end`,
      });
    } else if (lower.includes('show vlan')) {
      newLines.push({
        id: `out_${Date.now()}`,
        type: 'output',
        text: `VLAN  Name            Status    Ports
1     default         active    GE0/1
100   MGMT-ISP        active    GE0/1, PON0/1
200   PPPOE-CLIENTS   active    GE0/1, PON0/1, PON0/2`,
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
  4 packets transmitted, 4 received, 0% packet loss, time 3004ms`,
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
        text: `command not found: "${trimmed}" - type 'help' or click vendor snippets above`,
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

  const handleApplyNotepadCommands = async (title: string, script: string) => {
    const cmdLines = script
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    if (cmdLines.length === 0 || !currentSession) return;

    if (currentSession.liveSerialId || currentSession.liveTelnetId) {
      const targetSessionId = currentSession.id;
      const targetSerialId = currentSession.liveSerialId;
      const targetLiveId = currentSession.liveTelnetId;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                lines: [
                  ...s.lines,
                  {
                    id: `np_hdr_${Date.now()}`,
                    type: 'info',
                    text: `\n>>> [Notepad Apply Live via ${targetSerialId ? 'Console Cable' : 'Telnet'}: ${title}] (${cmdLines.length} lines)`,
                  },
                ],
              }
            : s
        )
      );

      for (const line of cmdLines) {
        if (targetSerialId) {
          await sendToLiveSerial(targetSessionId, targetSerialId, line, false);
        } else if (targetLiveId) {
          await sendToLiveTelnet(targetSessionId, targetLiveId, line, false);
        }
        await new Promise((r) => setTimeout(r, 220));
      }
      showToastMessage(
        `Applied "${title}" to live ${targetSerialId ? 'Console Cable' : 'Telnet'} (${cmdLines.length} lines)`
      );
      inputRef.current?.focus();
      return;
    }

    if (cmdLines.length === 1) {
      await executeCommand(cmdLines[0], false);
      showToastMessage(`Applied "${title}"`);
      inputRef.current?.focus();
      return;
    }

    const batchLines: TerminalLine[] = [
      ...currentSession.lines,
      {
        id: `np_hdr_${Date.now()}`,
        type: 'info',
        text: `\n>>> [Notepad Apply: ${title}] (${cmdLines.length} lines)`,
      },
      ...cmdLines.map((line, i) => ({
        id: `np_cmd_${Date.now()}_${i}`,
        type: 'prompt' as const,
        text: `${currentSession.prompt}${line}`,
      })),
      {
        id: `np_done_${Date.now()}`,
        type: 'success',
        text: `  ✓ Loaded ${cmdLines.length} commands from Notepad. Connect Live Telnet or Console Cable above and click "Apply Live" to push directly to hardware.`,
      },
    ];
    updateSessionLines(currentSession.id, batchLines);
    showToastMessage(`Applied "${title}" (${cmdLines.length} commands)`);
    inputRef.current?.focus();
  };

  const handleQuestionHelp = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputVal;
    if (currentSession?.liveSerialId || currentSession?.liveTelnetId) {
      // Send partial input + raw '?' directly to remote router/OLT without newline (MikroTik/BDCOM/Cisco/Huawei/Junos native help)
      const rawPayload = `${text}?`;
      setRemoteBufferHint((prev) => `${prev}${text}`);
      setInputVal('');
      if (currentSession.liveSerialId) {
        await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, rawPayload, true);
      } else if (currentSession.liveTelnetId) {
        await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, rawPayload, true);
      }
      inputRef.current?.focus();
      return;
    }

    const helpRes = getCliHelp(snippetCategory, text);
    const nextLines: TerminalLine[] = [
      ...currentSession.lines,
      {
        id: `q_prompt_${Date.now()}`,
        type: 'prompt',
        text: `${currentSession.prompt}${text}?`,
      },
      {
        id: `q_out_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: 'output',
        text: helpRes.formatted,
      },
    ];
    updateSessionLines(currentSession.id, nextLines);
    setInputVal(text);
    inputRef.current?.focus();
  };

  const handleTabComplete = async () => {
    if (currentSession?.liveSerialId || currentSession?.liveTelnetId) {
      // Send partial input + raw ASCII TAB (0x09) directly to remote device BEFORE full command is typed!
      const rawPayload = `${inputVal}\t`;
      setRemoteBufferHint((prev) => `${prev}${inputVal}`);
      setInputVal('');
      if (currentSession.liveSerialId) {
        await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, rawPayload, true);
      } else if (currentSession.liveTelnetId) {
        await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, rawPayload, true);
      }
      inputRef.current?.focus();
      return;
    }

    const tabRes = getCliTabCompletion(snippetCategory, inputVal);
    if (tabRes.changed) {
      setInputVal(tabRes.completed);
    }
    if (tabRes.formatted) {
      const nextLines: TerminalLine[] = [
        ...currentSession.lines,
        {
          id: `tab_prompt_${Date.now()}`,
          type: 'prompt',
          text: `${currentSession.prompt}${inputVal}<Tab>`,
        },
        {
          id: `tab_out_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          type: 'output',
          text: tabRes.formatted,
        },
      ];
      updateSessionLines(currentSession.id, nextLines);
    }
    inputRef.current?.focus();
  };

  const handleControlKey = async (ctrl: 'CTRL_C' | 'CTRL_Z' | 'SPACE' | 'ENTER' | 'BKSP') => {
    if (currentSession?.liveSerialId || currentSession?.liveTelnetId) {
      const seqMap: Record<typeof ctrl, { payload: string; raw: boolean }> = {
        CTRL_C: { payload: '\x03', raw: true },
        CTRL_Z: { payload: '\x1a', raw: true },
        SPACE: { payload: ' ', raw: true },
        ENTER: { payload: '', raw: false },
        BKSP: { payload: '\x08', raw: true },
      };
      const item = seqMap[ctrl];
      if (ctrl === 'CTRL_C' || ctrl === 'CTRL_Z' || ctrl === 'ENTER') {
        setInputVal('');
        setRemoteBufferHint('');
      } else if (ctrl === 'BKSP') {
        setRemoteBufferHint((prev) => prev.slice(0, -1));
      }
      if (currentSession.liveSerialId) {
        await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, item.payload, item.raw);
      } else if (currentSession.liveTelnetId) {
        await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, item.payload, item.raw);
      }
      inputRef.current?.focus();
      return;
    }

    if (ctrl === 'CTRL_C') {
      const nextLines: TerminalLine[] = [
        ...currentSession.lines,
        { id: `cc_${Date.now()}`, type: 'info', text: `${currentSession.prompt}${inputVal}^C` },
      ];
      updateSessionLines(currentSession.id, nextLines);
      setInputVal('');
    } else if (ctrl === 'CTRL_Z') {
      const nextLines: TerminalLine[] = [
        ...currentSession.lines,
        { id: `cz_${Date.now()}`, type: 'info', text: `${currentSession.prompt}^Z (Returned to Privileged EXEC mode)` },
      ];
      updateSessionLines(currentSession.id, nextLines);
      setInputVal('');
    } else if (ctrl === 'ENTER') {
      executeCommand(inputVal, false);
    }
    inputRef.current?.focus();
  };

  const handleInputChange = (nextVal: string) => {
    // Support mobile/Android soft keyboards where typing '?' may not emit e.key === '?' in keydown
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
      setRemoteBufferHint('');
      executeCommand(inputVal, Boolean(currentSession?.liveTelnetId || currentSession?.liveSerialId));
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      e.preventDefault();
      handleControlKey('CTRL_C');
    } else if (
      e.ctrlKey &&
      e.key.toLowerCase() === 'z' &&
      (currentSession?.liveTelnetId || currentSession?.liveSerialId)
    ) {
      e.preventDefault();
      handleControlKey('CTRL_Z');
    } else if (e.key === ' ' && inputVal === '' && (currentSession?.liveTelnetId || currentSession?.liveSerialId)) {
      e.preventDefault();
      handleControlKey('SPACE');
    } else if (
      e.key === 'Backspace' &&
      inputVal === '' &&
      (currentSession?.liveTelnetId || currentSession?.liveSerialId)
    ) {
      e.preventDefault();
      handleControlKey('BKSP');
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
    }
  };

  const handleTerminalPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    if (pasted.includes('\n')) {
      e.preventDefault();
      const pastedLines = pasted
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l.length > 0);
      if (pastedLines.length === 0) return;
      if (currentSession?.liveSerialId || currentSession?.liveTelnetId) {
        for (const line of pastedLines) {
          if (currentSession.liveSerialId) {
            await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, line, false);
          } else if (currentSession.liveTelnetId) {
            await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, line, false);
          }
          await new Promise((r) => setTimeout(r, 150));
        }
        setInputVal('');
        setRemoteBufferHint('');
      } else {
        for (const line of pastedLines) {
          await executeCommand(line, false);
        }
      }
    }
  };

  const isCurrentLive = Boolean(currentSession?.liveTelnetId || currentSession?.liveSerialId);
  const suggestionBasis = isCurrentLive ? `${remoteBufferHint}${inputVal}` : inputVal;
  const cliSuggestions = getCliSuggestions(snippetCategory, suggestionBasis);
  const activeBrandModels = DEVICE_COMMAND_CATALOG[snippetCategory] || [];
  const activeModelCatalog = activeBrandModels.find((m) => m.id === selectedModelId) || activeBrandModels[0];
  const filteredCatalogCommands = (activeModelCatalog?.commands || []).filter((entry) => {
    if (cmdCategoryFilter !== 'ALL' && entry.category !== cmdCategoryFilter) return false;
    const q = cmdSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return entry.cmd.toLowerCase().includes(q) || entry.desc.toLowerCase().includes(q) || entry.category.toLowerCase().includes(q);
  });

  const showToastMessage = (msg: string) => {
    setVaultToast(msg);
    setTimeout(() => setVaultToast(null), 2600);
  };

  const openNewSessionModal = () => {
    setEditingSavedId(null);
    setNewSessionName('BDCOM OLT');
    setNewVendor('BDCOM');
    setNewProtocol('Telnet');
    setNewPort(23);
    setNewHost(activeProfile?.server || '192.168.88.1');
    setNewUsername('admin');
    setNewPassword('');
    setShowModalPassword(false);
    setSaveToVault(true);
    setNewAutoLogin(true);
    setIsNewSessionModalOpen(true);
  };

  const openEditSavedSessionModal = (saved: SavedTerminalSession) => {
    setEditingSavedId(saved.id);
    setNewSessionName(saved.name);
    setNewVendor(saved.vendor);
    setNewProtocol(saved.protocol);
    setNewPort(saved.port);
    setNewHost(saved.host);
    setNewUsername(saved.username);
    setNewPassword(saved.password);
    setShowModalPassword(false);
    setSaveToVault(true);
    setNewAutoLogin(saved.autoLogin !== false);
    setIsNewSessionModalOpen(true);
  };

  const launchTerminalConnection = async (params: {
    name: string;
    host: string;
    port: number;
    protocol: 'SSH' | 'Telnet';
    vendor: TerminalVendor;
    username: string;
    password?: string;
    autoLogin?: boolean;
  }) => {
    const newId = `sess_${Date.now()}`;
    const hostClean = params.host.trim();
    const portNum = params.port || (params.protocol === 'SSH' ? 22 : 23);
    const labelClean = params.name.trim() || `${params.vendor} (${params.protocol})`;

    const vendorPrompts: Record<string, string> = {
      MikroTik: `[${params.username || 'admin'}@${hostClean.replace(/\./g, '-')}] > `,
      Cisco: `${labelClean.replace(/\s+/g, '-')}# `,
      Huawei: `<${labelClean.replace(/\s+/g, '-')}> `,
      BDCOM: `${labelClean.replace(/\s+/g, '-')}# `,
      VSOL: `${labelClean.replace(/\s+/g, '-')}# `,
      'Palo Alto': `${params.username || 'admin'}@PA-FW> `,
      Juniper: `${params.username || 'admin'}@${labelClean.replace(/\s+/g, '-')}> `,
      ZTE: `${labelClean.replace(/\s+/g, '-')}# `,
      'C-Data': `${labelClean.replace(/\s+/g, '-')}(config)# `,
      Arista: `${labelClean.replace(/\s+/g, '-')}# `,
      Ruijie: `${labelClean.replace(/\s+/g, '-')}# `,
      'TP-Link': `${labelClean.replace(/\s+/g, '-')}# `,
    };

    const prompt = vendorPrompts[params.vendor] || `${labelClean}# `;
    const credInfo = params.username
      ? ` · User: ${params.username}${params.password ? ' (Pass Saved)' : ''}${params.autoLogin ? ' · Auto-Login ON' : ''}`
      : '';

    const initialLines: TerminalLine[] = [
      {
        id: '1',
        type: 'info',
        text: `  Connecting to ${hostClean}:${portNum} via ${params.protocol} (${params.vendor} · RFC 854)${credInfo}...`,
      },
    ];

    const created: TerminalSession = {
      id: newId,
      name: labelClean,
      host: hostClean,
      port: portNum,
      protocol: params.protocol,
      vendor: params.vendor,
      username: params.username.trim(),
      password: params.password || '',
      autoLogin: params.autoLogin !== false,
      status: 'Connecting',
      prompt,
      lines: initialLines,
    };

    setSessions((prev) => [...prev, created]);
    setActiveSessionId(newId);
    setSnippetCategory(params.vendor);

    if (params.protocol === 'Telnet') {
      const shouldJump =
        canUseMikrotikJump &&
        activeProfile &&
        activeProfile.server.trim() !== hostClean &&
        (useJumpGateway || isPrivateIp(hostClean));

      try {
        const resp = await fetch('/api/telnet/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: hostClean,
            port: portNum,
            username: params.username.trim(),
            password: params.password || '',
            autoLogin: params.autoLogin !== false,
            timeoutMs: shouldJump ? 9500 : 6500,
            jumpGateway: shouldJump
              ? {
                  host: activeProfile!.server,
                  port: 23,
                  username: activeProfile!.username || 'admin',
                  password: activeProfile!.password || '',
                }
              : undefined,
          }),
        });
        const data = await resp.json();
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== newId) return s;
            if (data.connected && data.sessionId) {
              const liveLines: TerminalLine[] = [
                ...s.lines,
                {
                  id: `ok_${Date.now()}`,
                  type: 'success',
                  text: data.viaJump
                    ? `  [LIVE TELNET VIA MIKROTIK JUMP ${data.viaJump}] -> ${hostClean}:${portNum} (${data.latencyMs}ms)`
                    : `  [LIVE TELNET CONNECTED] ${hostClean}:${portNum} (${data.latencyMs}ms · RFC 854 IAC/NAWS/TTYPE Active)`,
                },
              ];
              if (data.output) {
                liveLines.push({
                  id: `bn_${Date.now()}`,
                  type: 'output',
                  text: data.output,
                });
              } else {
                liveLines.push({
                  id: `bn_${Date.now()}`,
                  type: 'info',
                  text: '  Connected! Press Enter or type your Username / command below.',
                });
              }
              return {
                ...s,
                status: 'Connected',
                liveTelnetId: data.sessionId,
                prompt: `telnet://${hostClean}:${portNum}> `,
                lines: liveLines,
              };
            }
            return {
              ...s,
              status: 'Closed',
              liveTelnetId: undefined,
              lines: [
                ...s.lines,
                {
                  id: `err_${Date.now()}`,
                  type: 'error',
                  text: `  [-] Telnet Failed: ${data.error || 'Could not reach host on port ' + portNum}`,
                },
                {
                  id: `tip_${Date.now()}`,
                  type: 'info',
                  text: `  নোট: যদি ${hostClean} প্রাইভেট LAN/PPTP আইপি হয় বা ISP ফায়ারওয়াল Cloud IP ব্লক করে, তাহলে Android APK দিয়ে সরাসরি আপনার মোবাইল নেটওয়ার্ক/PPTP টানেল থেকে কানেক্ট করুন।`,
                },
              ],
            };
          })
        );
      } catch (err: any) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === newId
              ? {
                  ...s,
                  status: 'Closed',
                  lines: [
                    ...s.lines,
                    {
                      id: `err_${Date.now()}`,
                      type: 'error',
                      text: `  [-] Telnet Bridge Error: ${err?.message || 'Server unavailable'}`,
                    },
                  ],
                }
              : s
          )
        );
      }
    } else {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === newId
            ? {
                ...s,
                status: 'Connected',
                lines: [
                  ...s.lines,
                  {
                    id: `ok_${Date.now()}`,
                    type: 'success',
                    text: `  Connected to ${hostClean}:${portNum} (SSH v2 · ${params.vendor}${params.username ? ` · User: ${params.username}` : ''}).`,
                  },
                ],
              }
            : s
        )
      );
    }
  };

  const handleDisconnectLiveTelnet = async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target?.liveTelnetId) return;
    try {
      await fetch(`/api/telnet/sessions/${target.liveTelnetId}`, { method: 'DELETE' });
    } catch {}
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'Closed',
              liveTelnetId: undefined,
              lines: [
                ...s.lines,
                { id: `user_disc_${Date.now()}`, type: 'info', text: '  [Disconnected by user]' },
              ],
            }
          : s
      )
    );
  };

  const handleQuickTelnetConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickHost.trim();
    if (!raw) return;
    let targetHost = raw;
    let targetPort = quickPort || 23;
    if (raw.includes(':')) {
      const parts = raw.split(':');
      targetHost = parts[0].trim();
      targetPort = parseInt(parts[1], 10) || 23;
    }
    await launchTerminalConnection({
      name: `Telnet ${targetHost}`,
      host: targetHost,
      port: targetPort,
      protocol: 'Telnet',
      vendor: snippetCategory,
      username: quickUser.trim(),
      password: quickPass,
      autoLogin: true,
    });
  };

  const handleQuickSave = async () => {
    const raw = quickHost.trim();
    if (!raw) return;
    let targetHost = raw;
    let targetPort = quickPort || 23;
    if (raw.includes(':')) {
      const parts = raw.split(':');
      targetHost = parts[0].trim();
      targetPort = parseInt(parts[1], 10) || 23;
    }
    await saveTerminalSession({
      name: `${snippetCategory} ${targetHost}`,
      vendor: snippetCategory,
      protocol: 'Telnet',
      host: targetHost,
      port: targetPort,
      username: quickUser.trim(),
      password: quickPass,
      autoLogin: true,
    });
    showToastMessage(
      user
        ? `${targetHost}:${targetPort} ক্লাউডে সেভ হয়েছে!`
        : `${targetHost}:${targetPort} সেভ হয়েছে!`
    );
  };

  const handleSaveOnly = async () => {
    const hostClean = newHost.trim();
    if (!hostClean) return;
    await saveTerminalSession({
      id: editingSavedId || undefined,
      name: newSessionName.trim() || `${newVendor} ${hostClean}`,
      vendor: newVendor,
      protocol: newProtocol,
      host: hostClean,
      port: newPort || (newProtocol === 'SSH' ? 22 : 23),
      username: newUsername.trim(),
      password: newPassword,
      autoLogin: newAutoLogin,
    });
    setIsNewSessionModalOpen(false);
    setEditingSavedId(null);
    showToastMessage(
      user
        ? 'Telnet/SSH সেশন ক্লাউডে সেভ হয়েছে!'
        : 'Telnet/SSH সেশন লোকালি সেভ হয়েছে!'
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const hostClean = newHost.trim();
    if (!hostClean) return;
    const portNum = newPort || (newProtocol === 'SSH' ? 22 : 23);

    if (saveToVault || editingSavedId) {
      await saveTerminalSession({
        id: editingSavedId || undefined,
        name: newSessionName.trim() || `${newVendor} ${hostClean}`,
        vendor: newVendor,
        protocol: newProtocol,
        host: hostClean,
        port: portNum,
        username: newUsername.trim(),
        password: newPassword,
        autoLogin: newAutoLogin,
      });
      showToastMessage(
        user
          ? 'সেশন ক্লাউডে সেভ করে কানেক্ট করা হচ্ছে...'
          : 'সেশন সেভ করে কানেক্ট করা হচ্ছে...'
      );
    }

    setIsNewSessionModalOpen(false);
    setEditingSavedId(null);

    await launchTerminalConnection({
      name: newSessionName.trim() || `${newVendor} (${newProtocol})`,
      host: hostClean,
      port: portNum,
      protocol: newProtocol,
      vendor: newVendor,
      username: newUsername.trim(),
      password: newPassword,
      autoLogin: newAutoLogin,
    });
  };

  const handleSendSavedLogin = async () => {
    if (!currentSession || !currentSession.username) return;
    if (currentSession.liveSerialId) {
      await sendToLiveSerial(currentSession.id, currentSession.liveSerialId, currentSession.username, false);
      if (currentSession.password) {
        setTimeout(() => {
          if (currentSession.liveSerialId) {
            sendToLiveSerial(currentSession.id, currentSession.liveSerialId, currentSession.password!, false);
          }
        }, 550);
      }
      return;
    }
    if (currentSession.liveTelnetId) {
      await sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, currentSession.username, false);
      if (currentSession.password) {
        setTimeout(() => {
          if (currentSession.liveTelnetId) {
            sendToLiveTelnet(currentSession.id, currentSession.liveTelnetId, currentSession.password!, false);
          }
        }, 550);
      }
      return;
    }
    const maskedPass = currentSession.password ? '••••••••' : '(empty)';
    const nextLines: TerminalLine[] = [
      ...currentSession.lines,
      {
        id: `login_${Date.now()}`,
        type: 'success',
        text: `  [Auto-Login Sent] Username: ${currentSession.username} | Password: ${maskedPass}`,
      },
    ];
    updateSessionLines(currentSession.id, nextLines);
  };

  const handleCloseSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const closing = sessions.find((s) => s.id === sessionId);
    if (closing?.liveTelnetId) {
      fetch(`/api/telnet/sessions/${closing.liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
    }
    if (closing?.liveSerialId) {
      serialConsoleManager.disconnect(closing.liveSerialId).catch(() => {});
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-black" />
            <span>Multi-Session SSH &amp; Telnet Terminal (Termius Style)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Troubleshoot multiple PPTP nodes, routers, OLTs, and switches simultaneously with saved credentials and live RFC 854 Telnet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openNewSessionModal}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Save Host</span>
          </button>
          <button
            onClick={handleOpenScriptGenerator}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Code2 className="w-4 h-4" />
            <span>MikroTik Script</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {vaultToast && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{vaultToast}</span>
        </div>
      )}

      {/* Pending CLI Handoff Banner from Packet Tracer Topology Builder */}
      {pendingCliHandoff && (
        <div className="bg-slate-50 border border-black rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-black">
                Topology CLI Ready: {pendingCliHandoff.deviceName} ({pendingCliHandoff.brand}) · Target IP {pendingCliHandoff.hostIp}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                নিচের Quick Live Telnet দিয়ে কানেক্ট করে এক ক্লিকে কমান্ড পুশ করুন অথবা কপি করে পেস্ট করুন।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pendingCliHandoff.cliScript);
                  setCopiedHandoff(true);
                  setTimeout(() => setCopiedHandoff(false), 1800);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedHandoff ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHandoff ? 'Copied' : 'Copy Script'}</span>
              </button>
              <button
                type="button"
                disabled={(!currentSession?.liveTelnetId && !currentSession?.liveSerialId) || pushingCli}
                onClick={handlePushTopologyCli}
                className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title={
                  currentSession?.liveSerialId
                    ? 'Send generated CLI lines over active USB Console Cable'
                    : currentSession?.liveTelnetId
                    ? 'Send generated CLI lines to active live Telnet session'
                    : 'Connect a Live Telnet host or Console Cable first'
                }
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {pushingCli
                    ? 'Pushing...'
                    : currentSession?.liveSerialId
                    ? 'Push to Live Console Cable'
                    : 'Push to Active Live Telnet'}
                </span>
              </button>
              {onClearPendingCli && (
                <button
                  type="button"
                  onClick={onClearPendingCli}
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-black border border-slate-300 cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <pre className="p-3 rounded-lg bg-white border border-slate-200 text-black font-mono text-[11px] max-h-36 overflow-y-auto whitespace-pre-wrap">
            {pendingCliHandoff.cliScript}
          </pre>
        </div>
      )}

      {/* Saved Telnet / SSH Sessions Vault */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Bookmark className="w-4 h-4 text-black" />
            <h3 className="text-sm font-bold text-black">
              Saved Telnet / SSH Sessions ({terminalSessions.length})
            </h3>
            <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
              <span>·</span>
              {user ? <Cloud className="w-3 h-3 text-emerald-700" /> : <HardDrive className="w-3 h-3" />}
              <span>{user ? 'Cloud Synced' : 'Local Saved'}</span>
            </span>
          </div>

          <button
            onClick={openNewSessionModal}
            className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>+ Save New IP / User / Pass</span>
          </button>
        </div>

        {terminalSessions.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs text-slate-700">
            কোনো Telnet/SSH সেশন সেভ করা নেই। উপরের <strong>Add / Save Host</strong> বাটনে ক্লিক করে IP, Username এবং Password সেভ করুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {terminalSessions.map((saved) => {
              const isRevealed = Boolean(revealedPasswordIds[saved.id]);
              return (
                <div
                  key={saved.id}
                  className="bg-slate-50 border border-slate-200 hover:border-black rounded-lg p-3 flex flex-col justify-between gap-2.5 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-black truncate">{saved.name}</div>
                        <div className="text-[11px] font-mono text-slate-700 truncate">
                          {saved.host}:{saved.port}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono font-bold text-slate-700">
                        <span>{saved.protocol}</span>
                        <span>·</span>
                        <span>{saved.vendor}</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5 font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600">User:</span>
                        <span className="text-black truncate font-semibold">{saved.username || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600">Pass:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-black truncate">
                            {saved.password ? (isRevealed ? saved.password : '••••••••') : '—'}
                          </span>
                          {saved.password && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPasswordIds((prev) => ({
                                  ...prev,
                                  [saved.id]: !prev[saved.id],
                                }))
                              }
                              className="text-slate-600 hover:text-black cursor-pointer shrink-0"
                              title={isRevealed ? 'Hide password' : 'Show password'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => launchTerminalConnection(saved)}
                      className="flex-1 py-1.5 px-2.5 rounded-md bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Connect</span>
                    </button>
                    <button
                      onClick={() => openEditSavedSessionModal(saved)}
                      title="Edit saved session"
                      className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-slate-300 cursor-pointer transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        deleteTerminalSession(saved.id);
                        showToastMessage(`"${saved.name}" ডিলিট করা হয়েছে।`);
                      }}
                      title="Delete saved session"
                      className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick 1-Tap Live Telnet + Physical Console Cable (USB / COM Serial) Bar */}
      <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setQuickConnMode('telnet')}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                quickConnMode === 'telnet'
                  ? 'bg-black text-white'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Telnet / SSH (IP)</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickConnMode('console')}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                quickConnMode === 'console'
                  ? 'bg-black text-white'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Usb className="w-3.5 h-3.5" />
              <span>Console Cable (USB / COM)</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-600">
            {quickConnMode === 'console'
              ? `RS-232 / USB-Serial (FTDI · PL2303 · CH340 · CP2102) · ${snippetCategory} default: ${getRecommendedBaudRate(snippetCategory)} bps`
              : 'Direct TCP Telnet (Port 23) — Router, Switch & OLT'}
          </span>
        </div>

        {quickConnMode === 'telnet' ? (
          <div className="space-y-2">
          <form
            onSubmit={handleQuickTelnetConnect}
            className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
              <input
                type="text"
                value={quickHost}
                onChange={(e) => setQuickHost(e.target.value)}
                placeholder="IP (e.g. 103.238.114.208 or LAN 192.168.88.2)"
                className="col-span-2 sm:col-span-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="number"
                min={1}
                max={65535}
                value={quickPort}
                onChange={(e) => setQuickPort(parseInt(e.target.value, 10) || 23)}
                placeholder="Port (23)"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="text"
                value={quickUser}
                onChange={(e) => setQuickUser(e.target.value)}
                placeholder="Username"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="password"
                value={quickPass}
                onChange={(e) => setQuickPass(e.target.value)}
                placeholder="Password"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="flex-1 lg:flex-none px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Telnet Connect</span>
              </button>
              <button
                type="button"
                onClick={handleQuickSave}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                title="Save IP + User + Pass"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </form>
          {canUseMikrotikJump && activeProfile && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-200">
              <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={useJumpGateway}
                  onChange={(e) => setUseJumpGateway(e.target.checked)}
                  className="accent-black rounded"
                />
                <span>
                  Local LAN Telnet via MikroTik Jump (<span className="font-mono">{activeProfile.server}</span>)
                </span>
              </label>
              <span className="font-mono text-slate-600">
                {useJumpGateway
                  ? 'Hops via MikroTik /system telnet to reach private OLT/Switch IPs'
                  : 'Auto-enables for private IPs (192.168.x.x / 10.x.x.x / 172.16.x.x)'}
              </span>
            </div>
          )}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
              <select
                value={serialBaud}
                onChange={(e) => setSerialBaud(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
                title="Baud Rate (9600 for Cisco/Huawei/BDCOM/ZTE/VSOL/Juniper · 115200 for MikroTik/TP-Link)"
              >
                {BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} bps{rate === 9600 ? ' (Cisco/OLT)' : rate === 115200 ? ' (MikroTik)' : ''}
                  </option>
                ))}
              </select>

              <select
                value={`${serialDataBits}-${serialParity}-${serialStopBits}`}
                onChange={(e) => {
                  const [db, par, sb] = e.target.value.split('-');
                  setSerialDataBits(parseInt(db, 10) as SerialDataBits);
                  setSerialParity(par as SerialParity);
                  setSerialStopBits(parseInt(sb, 10) as SerialStopBits);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                title="Data Bits / Parity / Stop Bits"
              >
                <option value="8-none-1">8-N-1 (Standard)</option>
                <option value="8-even-1">8-E-1</option>
                <option value="8-odd-1">8-O-1</option>
                <option value="7-even-1">7-E-1</option>
                <option value="8-none-2">8-N-2</option>
              </select>

              <select
                value={serialLineEnding}
                onChange={(e) => {
                  const val = e.target.value as SerialLineEnding;
                  setSerialLineEnding(val);
                  if (currentSession?.liveSerialId) {
                    serialConsoleManager.setLineEnding(currentSession.liveSerialId, val);
                  }
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                title="Line Ending sent on Enter"
              >
                <option value={'\r'}>Enter: CR (\r)</option>
                <option value={'\r\n'}>Enter: CRLF (\r\n)</option>
                <option value={'\n'}>Enter: LF (\n)</option>
              </select>

              <input
                type="text"
                value={quickUser}
                onChange={(e) => setQuickUser(e.target.value)}
                placeholder="Optional Login User"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={connectingSerial}
                onClick={handleConnectConsoleCable}
                className="flex-1 lg:flex-none px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{connectingSerial ? 'Selecting COM Port...' : 'Connect Console Cable'}</span>
              </button>
              {!isWebSerialSupported() && (
                <span className="text-[11px] font-semibold text-amber-800">
                  Chrome/Edge Desktop or Android USB-OTG required
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Termius-Style Session Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              onClick={() => {
                setActiveSessionId(s.id);
                setSnippetCategory(s.vendor);
              }}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-mono flex items-center gap-2 cursor-pointer transition-all border-t border-l border-r ${
                isActive
                  ? 'bg-black border-black text-white font-bold'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-black hover:bg-slate-200'
              }`}
            >
              {(s.liveTelnetId || s.liveSerialId) && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                  title={s.liveSerialId ? 'Live USB/COM Console Cable Active' : 'Live TCP Telnet Socket Active'}
                />
              )}
              <span className="text-[10px] font-bold uppercase opacity-80">
                {s.liveSerialId ? 'LIVE COM' : s.liveTelnetId ? 'LIVE TELNET' : s.protocol}
              </span>
              <span className="truncate max-w-[140px]">{s.name}</span>
              <span className="text-[10px] opacity-75">
                {s.protocol === 'Console' ? `@${s.baudRate || s.port}` : `:${s.port}`}
              </span>
              {sessions.length > 1 && (
                <button
                  onClick={(e) => handleCloseSession(s.id, e)}
                  className="hover:text-red-400 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={openNewSessionModal}
          className="p-1.5 text-slate-700 hover:text-black hover:bg-slate-100 rounded cursor-pointer transition-colors"
          title="Open New Host Tab"
        >
          <Plus className="w-4 h-4" />
        </button>

        {currentSession?.liveSerialId && (
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSendSerialBreak(currentSession.id)}
              className="px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="Send RS-232 BREAK Signal (ROMMON / BootROM Password Recovery)"
            >
              <Zap className="w-3 h-3" />
              <span>Send Break</span>
            </button>
            <button
              type="button"
              onClick={() => handleDisconnectLiveSerial(currentSession.id)}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
            >
              Disconnect Console
            </button>
          </div>
        )}

        {currentSession?.liveTelnetId && !currentSession?.liveSerialId && (
          <button
            onClick={() => handleDisconnectLiveTelnet(currentSession.id)}
            className="ml-auto px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            Disconnect Telnet
          </button>
        )}
      </div>

      {/* Snippet Bar + Brand Selector (ROS -> Junos) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2.5 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-black text-[11px] shrink-0 font-bold flex items-center gap-1">
              <Command className="w-3.5 h-3.5" />
              <span>Brand:</span>
            </span>
            <div className="flex items-center gap-1 bg-white rounded p-0.5 border border-slate-300 overflow-x-auto">
              {(
                [
                  'MikroTik',
                  'Cisco',
                  'Huawei',
                  'ZTE',
                  'BDCOM',
                  'VSOL',
                  'C-Data',
                  'Palo Alto',
                  'Juniper',
                  'Arista',
                  'Ruijie',
                  'TP-Link',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSnippetCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer shrink-0 ${
                    snippetCategory === cat ? 'bg-black text-white font-bold' : 'text-slate-700 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !showNotepadPanel;
                setShowNotepadPanel(next);
                if (next) setShowAllCommandsPanel(false);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                showNotepadPanel
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-300 hover:bg-slate-100'
              }`}
              title="Open Personal Command Notepad (Save & 1-Click Apply)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Command Notepad ({commandNotes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !showAllCommandsPanel;
                setShowAllCommandsPanel(next);
                if (next) setShowNotepadPanel(false);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0 ${
                showAllCommandsPanel
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-300 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showAllCommandsPanel ? 'Hide Command Library' : 'All Commands (ROS → Junos)'}</span>
            </button>
          </div>
        </div>

        {/* Interactive CLI Hardware Keys (? Help, Tab Autocomplete, Ctrl+C/Z, Space) + Quick Snippets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => handleQuestionHelp(inputVal)}
            className="px-2.5 py-1 bg-black hover:bg-slate-800 text-white rounded border border-black shrink-0 cursor-pointer text-[11px] font-bold flex items-center gap-1 transition-colors"
            title="Send '?' mid-command — Show all commands / contextual CLI help (ROS to Junos)"
          >
            <HelpCircle className="w-3 h-3" />
            <span>? Help</span>
          </button>
          <button
            type="button"
            onClick={handleTabComplete}
            className="px-2.5 py-1 bg-black hover:bg-slate-800 text-white rounded border border-black shrink-0 cursor-pointer text-[11px] font-bold flex items-center gap-1 transition-colors"
            title="Send Tab (0x09) mid-command — Auto-complete partial command (BDCOM, Cisco, MikroTik, Huawei, VSOL, Junos)"
          >
            <ArrowRightToLine className="w-3 h-3" />
            <span>Tab</span>
          </button>
          <button
            type="button"
            onClick={() => handleControlKey('CTRL_C')}
            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded border border-amber-300 shrink-0 cursor-pointer text-[11px] font-bold"
            title="Send Ctrl+C (Break / Cancel command)"
          >
            Ctrl+C
          </button>
          <button
            type="button"
            onClick={() => handleControlKey('CTRL_Z')}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-black rounded border border-slate-300 shrink-0 cursor-pointer text-[11px] font-semibold"
            title="Send Ctrl+Z (Exit config mode on Cisco / BDCOM / Huawei)"
          >
            Ctrl+Z
          </button>
          {(currentSession?.liveTelnetId || currentSession?.liveSerialId) && (
            <>
              <button
                type="button"
                onClick={() => handleControlKey('SPACE')}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-black rounded border border-slate-300 shrink-0 cursor-pointer text-[11px] font-semibold"
                title="Send Space (--More-- next page)"
              >
                Space
              </button>
              <button
                type="button"
                onClick={() => handleControlKey('ENTER')}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-black rounded border border-slate-300 shrink-0 cursor-pointer text-[11px] font-semibold"
                title="Send raw Enter (CR/CRLF)"
              >
                Enter
              </button>
            </>
          )}
          {currentSession?.username && (
            <button
              type="button"
              onClick={handleSendSavedLogin}
              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded border border-emerald-300 shrink-0 cursor-pointer text-[11px] font-bold flex items-center gap-1 transition-colors"
              title="Send saved Username & Password"
            >
              <KeyRound className="w-3 h-3" />
              <span>Send Login</span>
            </button>
          )}
          {snippets[snippetCategory].map((snip, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => executeCommand(snip.cmd)}
              className="px-2 py-1 bg-white hover:bg-black text-black hover:text-white rounded border border-slate-300 shrink-0 cursor-pointer text-[11px] font-semibold transition-colors"
            >
              {snip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => executeCommand('clear')}
            className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded border border-slate-300 shrink-0 cursor-pointer text-[11px]"
          >
            clear
          </button>
        </div>
      </div>

      {/* Personal Command Notepad Drawer (Save Multi-Line Scripts & 1-Click Apply) */}
      {showNotepadPanel && (
        <div className="bg-white border border-slate-300 rounded-xl p-3.5">
          <CommandNotepadPanel
            compact
            activeVendor={snippetCategory}
            isLiveConnected={Boolean(currentSession?.liveTelnetId || currentSession?.liveSerialId)}
            onApplyCommands={handleApplyNotepadCommands}
            draftPrefill={notepadDraft}
            onClearDraftPrefill={() => setNotepadDraft(null)}
          />
        </div>
      )}

      {/* All Devices Command Reference Explorer (Brand + Model + Category — ROS to Junos) */}
      {showAllCommandsPanel && activeModelCatalog && (
        <div className="bg-white border border-slate-300 rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-black flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-black" />
                <span>{snippetCategory} All Commands</span>
              </span>
              <select
                value={activeModelCatalog.id}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
              >
                {activeBrandModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.model} ({m.os})
                  </option>
                ))}
              </select>
              <span className="text-[11px] font-mono text-slate-600">
                {filteredCatalogCommands.length} commands
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cmdSearchQuery}
                  onChange={(e) => setCmdSearchQuery(e.target.value)}
                  placeholder="Search command (e.g. bgp, onu, vlan, route)..."
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
                />
              </div>
              <select
                value={cmdCategoryFilter}
                onChange={(e) => setCmdCategoryFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
              >
                <option value="ALL">All Categories</option>
                <option value="System & Info">System &amp; Info</option>
                <option value="Interface & VLAN">Interface &amp; VLAN</option>
                <option value="IP & Routing">IP &amp; Routing</option>
                <option value="BGP / OSPF">BGP / OSPF</option>
                <option value="OLT / ONU / Optical">OLT / ONU / Optical</option>
                <option value="Firewall / NAT / VPN">Firewall / NAT / VPN</option>
                <option value="Diagnostics & Save">Diagnostics &amp; Save</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredCatalogCommands.map((item, idx) => (
              <div
                key={`${item.cmd}_${idx}`}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-black flex flex-col justify-between gap-1.5 transition"
              >
                <div>
                  <div className="text-[11px] font-mono font-bold text-black break-all">{item.cmd}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">{item.desc}</div>
                </div>
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200">
                  <span className="text-[9px] font-mono text-slate-500 uppercase">{item.category}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setInputVal(item.cmd);
                        inputRef.current?.focus();
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-black border border-slate-300 text-[10px] font-bold cursor-pointer"
                    >
                      Insert
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand(item.cmd)}
                      className="px-2 py-0.5 rounded bg-black hover:bg-slate-800 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Run
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Backdrop when Terminal is Maximized */}
      {isTermExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs"
          onClick={() => setIsTermExpanded(false)}
        />
      )}

      {/* Direct Inline Terminal Viewport (Resizable: Drag Handle + S/M/L + A-/A+ + Fullscreen) */}
      <div
        style={isTermExpanded ? undefined : { height: `${termHeight}px` }}
        className={`${
          isTermExpanded
            ? 'fixed inset-2 sm:inset-5 z-50 shadow-2xl'
            : 'relative'
        } bg-white border-2 rounded-xl font-mono flex flex-col text-black transition-colors ${
          isTerminalFocused ? 'border-black' : 'border-slate-300'
        } ${isResizingTerm ? 'select-none ring-2 ring-black/20' : ''}`}
        onClick={() => {
          // Keep text copy selection working; otherwise focus inline terminal keyboard immediately
          if (!window.getSelection()?.toString()) {
            inputRef.current?.focus();
          }
        }}
      >
        {/* Top Terminal Size / Font / Fullscreen Utility Bar */}
        <div
          className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-[10px] flex items-center justify-between gap-2 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isCurrentLive ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
            />
            <span className="text-[11px] font-mono font-bold text-black truncate">
              {currentSession?.name || 'Terminal'} ({currentSession?.host}:{currentSession?.port})
            </span>
            {!isTermExpanded && (
              <span className="hidden sm:inline text-[10px] font-mono text-slate-500">
                {termHeight}px
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Height Presets: S / M / L */}
            {!isTermExpanded && (
              <div className="flex items-center rounded border border-slate-300 bg-white overflow-hidden">
                {[
                  { label: 'S', h: 280, title: 'Small Terminal (280px)' },
                  { label: 'M', h: 490, title: 'Medium Terminal (490px)' },
                  { label: 'L', h: 720, title: 'Large Terminal (720px)' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.title}
                    onClick={() => setTermHeight(preset.h)}
                    className={`px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                      Math.abs(termHeight - preset.h) < 35
                        ? 'bg-black text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Font Size Controls: A- / A+ */}
            <div className="flex items-center rounded border border-slate-300 bg-white overflow-hidden">
              <button
                type="button"
                title="Decrease terminal font size"
                onClick={() => setTermFontSize((f) => Math.max(10, f - 1))}
                className="px-1.5 py-0.5 text-[10px] font-bold text-black hover:bg-slate-100 cursor-pointer"
              >
                A-
              </button>
              <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-600 border-x border-slate-200">
                {termFontSize}px
              </span>
              <button
                type="button"
                title="Increase terminal font size"
                onClick={() => setTermFontSize((f) => Math.min(20, f + 1))}
                className="px-1.5 py-0.5 text-[10px] font-bold text-black hover:bg-slate-100 cursor-pointer"
              >
                A+
              </button>
            </div>

            {/* Fullscreen Maximize / Restore Toggle */}
            <button
              type="button"
              onClick={() => setIsTermExpanded((v) => !v)}
              title={isTermExpanded ? 'Restore terminal size (Esc)' : 'Maximize terminal fullscreen'}
              className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                isTermExpanded
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-slate-300 hover:border-black'
              }`}
            >
              {isTermExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span className="hidden sm:inline">{isTermExpanded ? 'Restore' : 'Fullscreen'}</span>
            </button>
          </div>
        </div>

        {/* Invisible Keyboard Capture Input (Desktop & Mobile Soft Keyboard) */}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handleTerminalPaste}
          onFocus={() => setIsTerminalFocused(true)}
          onBlur={() => setIsTerminalFocused(false)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Direct terminal keyboard input"
          className="opacity-0 w-px h-px absolute bottom-2 left-2 pointer-events-none"
          autoFocus
        />

        {/* Scrollable Direct Terminal Output + Inline Cursor */}
        <div
          style={{ fontSize: `${termFontSize}px` }}
          className="flex-1 overflow-y-auto p-4 cursor-text"
        >
          <div className="space-y-0.5">
            {(() => {
              const allLines = currentSession?.lines || [];
              const hasLiveInlineTail = isCurrentLive && allLines.length > 0;
              const bodyLines = hasLiveInlineTail ? allLines.slice(0, -1) : allLines;
              const tailLine = hasLiveInlineTail ? allLines[allLines.length - 1] : null;

              const lineColorClass = (type: TerminalLine['type']) =>
                type === 'prompt'
                  ? 'text-blue-800 font-bold'
                  : type === 'info'
                  ? 'text-slate-600'
                  : type === 'success'
                  ? 'text-emerald-800 font-semibold'
                  : type === 'error'
                  ? 'text-red-700 font-semibold'
                  : 'text-black';

              return (
                <>
                  {bodyLines.map((l) => (
                    <div key={l.id} className={`whitespace-pre-wrap leading-relaxed ${lineColorClass(l.type)}`}>
                      {l.text}
                    </div>
                  ))}

                  {hasLiveInlineTail && tailLine ? (
                    <div className={`whitespace-pre-wrap leading-relaxed ${lineColorClass(tailLine.type)}`}>
                      <span>{tailLine.text}</span>
                      <span className="text-black font-semibold">{inputVal}</span>
                      <span
                        className={`inline-block w-[7px] h-[14px] align-middle ml-0.5 ${
                          isTerminalFocused ? 'bg-black animate-pulse' : 'border border-slate-400 bg-transparent'
                        }`}
                      />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed pt-0.5">
                      <span className="text-blue-800 font-bold">{currentSession?.prompt}</span>
                      <span className="text-black">{inputVal}</span>
                      <span
                        className={`inline-block w-[7px] h-[14px] align-middle ml-0.5 ${
                          isTerminalFocused ? 'bg-black animate-pulse' : 'border border-slate-400 bg-transparent'
                        }`}
                      />
                      {!inputVal && !isCurrentLive && (
                        <span className="text-slate-400 ml-2 select-none">
                          (Click here &amp; type directly — press &apos;?&apos; or Tab)
                        </span>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Compact Bottom Autocomplete & Touch Helper Strip (No separate input box) */}
        <div
          className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-[10px] flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
            {cliSuggestions.length > 0 ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                  {snippetCategory} Tab/?:
                </span>
                {cliSuggestions.map((sug) => (
                  <button
                    key={sug.label}
                    type="button"
                    onClick={() => {
                      setInputVal(sug.insertText);
                      inputRef.current?.focus();
                    }}
                    title={sug.desc}
                    className="px-2 py-0.5 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-mono shrink-0 cursor-pointer transition-colors"
                  >
                    {sug.label}
                    {sug.hasChildren ? ' …' : ''}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-[10px] font-mono text-slate-600 truncate">
                {isTerminalFocused
                  ? isCurrentLive
                    ? 'Direct Terminal Active — type directly at prompt · ? Help · Tab · Ctrl+C · Paste'
                    : 'Direct Terminal Active — type command directly or telnet <IP>'
                  : 'Click anywhere in terminal box above to type directly'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleQuestionHelp(inputVal)}
              className="px-2 py-0.5 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold cursor-pointer transition-colors"
              title="Send '?' for instant device help"
            >
              ?
            </button>
            <button
              type="button"
              onClick={handleTabComplete}
              className="px-2 py-0.5 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold cursor-pointer transition-colors"
              title="Send Tab to autocomplete"
            >
              Tab
            </button>
            <button
              type="button"
              onClick={() => {
                const cmdToSave = inputVal.trim() || history[history.length - 1] || '';
                setNotepadDraft({
                  title: `${snippetCategory} Saved Command`,
                  vendor: snippetCategory,
                  commands: cmdToSave,
                });
                setShowNotepadPanel(true);
                setShowAllCommandsPanel(false);
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Save current or last command to Personal Notepad"
            >
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Save Note</span>
            </button>
          </div>
        </div>

        {/* Interactive Drag-to-Resize Bottom Handle (Mouse & Touch) */}
        {!isTermExpanded && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startTermResize(e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (e.touches.length > 0) startTermResize(e.touches[0].clientY);
            }}
            onClick={(e) => e.stopPropagation()}
            title="Drag up or down to resize terminal box"
            className={`h-5 border-t border-slate-200 rounded-b-[10px] flex items-center justify-center gap-1.5 cursor-ns-resize select-none transition-colors ${
              isResizingTerm ? 'bg-slate-200 text-black' : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black'
            }`}
          >
            <GripHorizontal className="w-4 h-3.5" />
            <span className="text-[10px] font-sans font-medium">
              Drag to resize ({termHeight}px)
            </span>
          </div>
        )}
      </div>

      {/* New / Edit Saved Host Session Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-2xl my-auto text-black">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-black flex items-center gap-2">
                <TerminalIcon className="w-4 h-4" />
                <span>
                  {editingSavedId ? 'Edit Saved Telnet / SSH Host' : 'New / Save Telnet & SSH Host'}
                </span>
              </h3>
              <button
                onClick={() => {
                  setIsNewSessionModalOpen(false);
                  setEditingSavedId(null);
                }}
                className="text-slate-600 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3.5 pt-4">
              <div>
                <label className="block text-xs font-mono text-black font-semibold mb-1">Session Label</label>
                <input
                  type="text"
                  required
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g. Core BDCOM OLT or Cisco Switch"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-black font-semibold mb-1">Device Vendor / OS</label>
                <select
                  value={newVendor}
                  onChange={(e) => {
                    const v = e.target.value as TerminalVendor;
                    setNewVendor(v);
                    if (!editingSavedId) setNewSessionName(`${v} ${newProtocol}`);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                >
                  <option value="MikroTik">MikroTik (RouterOS v6 / v7 Router &amp; CRS Switch)</option>
                  <option value="Huawei">Huawei (MA5600T / MA5800 OLT &amp; CloudEngine VRP)</option>
                  <option value="ZTE">ZTE (ZXA10 C300 / C320 / C600 GPON OLT)</option>
                  <option value="BDCOM">BDCOM (GP3600 / P3310 OLT &amp; Switch)</option>
                  <option value="VSOL">VSOL (V1600G / V1600D EPON/GPON OLT)</option>
                  <option value="C-Data">C-Data (FD1608S / FD1616S GPON &amp; FD1208S EPON OLT)</option>
                  <option value="Cisco">Cisco (Catalyst / ISR / ASR / Nexus NX-OS)</option>
                  <option value="Juniper">Juniper (Junos OS MX / EX / QFX / SRX)</option>
                  <option value="Palo Alto">Palo Alto (PAN-OS NGFW Firewall)</option>
                  <option value="Arista">Arista (EOS 7050 / 7280 Core &amp; Leaf Switch)</option>
                  <option value="Ruijie">Ruijie (RGOS S2910 / S5750 ISP Switch)</option>
                  <option value="TP-Link">TP-Link (Omada / JetStream L2+ Switch)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">Protocol</label>
                  <select
                    value={newProtocol}
                    onChange={(e) => {
                      const proto = e.target.value as 'SSH' | 'Telnet';
                      setNewProtocol(proto);
                      setNewPort(proto === 'SSH' ? 22 : 23);
                      if (!editingSavedId) setNewSessionName(`${newVendor} ${proto}`);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                  >
                    <option value="Telnet">Telnet (Port 23 · RFC 854)</option>
                    <option value="SSH">SSH (Port 22)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={newPort}
                    onChange={(e) => setNewPort(parseInt(e.target.value) || 23)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-black font-semibold mb-1">Host IP / FQDN</label>
                <input
                  type="text"
                  required
                  value={newHost}
                  onChange={(e) => setNewHost(e.target.value)}
                  placeholder="192.168.88.1"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-black font-semibold mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs text-black focus:outline-none focus:border-black font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black cursor-pointer"
                    >
                      {showModalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-black">
                  <input
                    type="checkbox"
                    checked={saveToVault}
                    onChange={(e) => setSaveToVault(e.target.checked)}
                    className="rounded border-slate-400 accent-black"
                  />
                  <span>
                    Save IP + Username + Password ({user ? 'Cloud Synced' : 'Saved Locally'})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                  <input
                    type="checkbox"
                    checked={newAutoLogin}
                    onChange={(e) => setNewAutoLogin(e.target.checked)}
                    className="rounded border-slate-400 accent-black"
                  />
                  <span>Auto-Send Username &amp; Password on Telnet Login Prompt</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewSessionModalOpen(false);
                    setEditingSavedId(null);
                  }}
                  className="px-3.5 py-2 text-xs text-slate-700 hover:text-black rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingSavedId ? 'Update Only' : 'Save Only'}</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-black hover:bg-slate-800 text-white transition-colors cursor-pointer"
                >
                  {saveToVault || editingSavedId ? `Save & Connect ${newProtocol}` : `Connect ${newProtocol}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MikroTik .rsc Script Export Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-6 shadow-2xl text-black">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-black">
                  Generated MikroTik RouterOS Script (.rsc)
                </h3>
              </div>
              <button
                onClick={() => setIsScriptModalOpen(false)}
                className="text-slate-600 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-700 mt-2">
              Paste this script into your MikroTik router (via Winbox Terminal or SSH) to configure the PPTP Server and split-tunneling firewall rules.
            </p>

            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-xs text-black h-72 overflow-y-auto whitespace-pre">
              {generatedScript}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-600 font-mono">
                RouterOS v7 &amp; v6 compliant · Split Tunneling
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyScript}
                  className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
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
