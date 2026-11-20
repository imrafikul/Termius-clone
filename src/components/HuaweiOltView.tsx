import React, { useState, useRef, useEffect } from 'react';
import {
  Server,
  Radio,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Terminal as TerminalIcon,
  Copy,
  Check,
  Send,
  HelpCircle,
  ArrowRightToLine,
  Network,
  Route,
  Sliders,
  Zap,
  Activity,
  RotateCw,
  Save,
  KeyRound,
  Cpu,
  Wifi,
} from 'lucide-react';
import { getCliHelp, getCliTabCompletion, getCliSuggestions } from '../services/cliCommandTree';

type OltModel = 'MA5608T' | 'MA5683T' | 'MA5600T' | 'MA5800-X7' | 'MA5800-X15';
type PonMode = 'GPON' | 'EPON';
type Box1Tab = 'onus' | 'add-onu' | 'system' | 'routes';

interface HuaweiOnu {
  id: string;
  frame: number;
  slot: number;
  port: number;
  ontId: number;
  mode: PonMode;
  sn: string;
  mac: string;
  desc: string;
  lineProfile: number;
  srvProfile: number;
  vlan: number;
  gemPort: number;
  status: 'online' | 'offline' | 'los';
  rxPowerDbm: number;
  distanceM: number;
}

interface AutoFindOnu {
  id: string;
  frame: number;
  slot: number;
  port: number;
  mode: PonMode;
  sn: string;
  mac: string;
  vendor: string;
  equipmentId: string;
  foundAt: string;
}

interface OltIpRoute {
  id: string;
  destination: string;
  mask: string;
  gateway: string;
  preference: number;
  comment: string;
}

interface ConsoleLine {
  id: string;
  type: 'prompt' | 'output' | 'info' | 'success' | 'error';
  text: string;
}

interface HuaweiOltViewProps {
  defaultHostIp?: string;
}

const INITIAL_ONUS: HuaweiOnu[] = [
  {
    id: 'onu_1',
    frame: 0,
    slot: 1,
    port: 0,
    ontId: 0,
    mode: 'GPON',
    sn: '48575443A1B2C301',
    mac: '4857-5443-c301',
    desc: 'PPPoE-Rafikul-Home',
    lineProfile: 10,
    srvProfile: 10,
    vlan: 100,
    gemPort: 1,
    status: 'online',
    rxPowerDbm: -18.42,
    distanceM: 1240,
  },
  {
    id: 'onu_2',
    frame: 0,
    slot: 1,
    port: 0,
    ontId: 1,
    mode: 'GPON',
    sn: '485754439F8E7712',
    mac: '4857-5443-7712',
    desc: 'Corporate-Link-Dhaka',
    lineProfile: 20,
    srvProfile: 20,
    vlan: 200,
    gemPort: 1,
    status: 'online',
    rxPowerDbm: -20.15,
    distanceM: 2380,
  },
  {
    id: 'onu_3',
    frame: 0,
    slot: 1,
    port: 1,
    ontId: 0,
    mode: 'GPON',
    sn: '5A544547B411009A',
    mac: '5a54-4547-009a',
    desc: 'ISP-POP-Mirpur-02',
    lineProfile: 10,
    srvProfile: 10,
    vlan: 100,
    gemPort: 1,
    status: 'los',
    rxPowerDbm: -34.0,
    distanceM: 3100,
  },
  {
    id: 'onu_4',
    frame: 0,
    slot: 3,
    port: 0,
    ontId: 0,
    mode: 'EPON',
    sn: 'E067B311A401',
    mac: 'e067-b311-a401',
    desc: 'EPON-Client-Uttara',
    lineProfile: 15,
    srvProfile: 15,
    vlan: 105,
    gemPort: 1,
    status: 'online',
    rxPowerDbm: -22.64,
    distanceM: 1650,
  },
];

const INITIAL_AUTOFIND: AutoFindOnu[] = [
  {
    id: 'af_1',
    frame: 0,
    slot: 1,
    port: 0,
    mode: 'GPON',
    sn: '48575443D9E04488',
    mac: '4857-5443-4488',
    vendor: 'HWTC (Huawei)',
    equipmentId: 'HG8245H5',
    foundAt: 'Just now',
  },
  {
    id: 'af_2',
    frame: 0,
    slot: 1,
    port: 2,
    mode: 'GPON',
    sn: '56534F4C8812AB34',
    mac: '5653-4f4c-ab34',
    vendor: 'VSOL (XPON)',
    equipmentId: 'V2801SG',
    foundAt: '2m ago',
  },
  {
    id: 'af_3',
    frame: 0,
    slot: 3,
    port: 1,
    mode: 'EPON',
    sn: 'F492BF2210C8',
    mac: 'f492-bf22-10c8',
    vendor: 'BDCOM / XPON',
    equipmentId: 'EPON-1GE',
    foundAt: '4m ago',
  },
];

const INITIAL_ROUTES: OltIpRoute[] = [
  {
    id: 'rt_1',
    destination: '0.0.0.0',
    mask: '0.0.0.0',
    gateway: '10.99.0.1',
    preference: 60,
    comment: 'Default Gateway to Core MikroTik',
  },
  {
    id: 'rt_2',
    destination: '192.168.88.0',
    mask: '255.255.255.0',
    gateway: '10.99.0.1',
    preference: 60,
    comment: 'NOC Management Subnet',
  },
];

const CHASSIS_SLOTS = [
  { slot: 0, board: 'MCUD1', role: 'Control', mode: 'CTRL' as const, ports: 0 },
  { slot: 1, board: 'GPFD', role: '16P GPON', mode: 'GPON' as const, ports: 8 },
  { slot: 2, board: 'GPBD', role: '8P GPON', mode: 'GPON' as const, ports: 4 },
  { slot: 3, board: 'EPBD', role: '8P EPON', mode: 'EPON' as const, ports: 4 },
  { slot: 9, board: 'H801X2CS', role: '2x10G Uplink', mode: 'UPLINK' as const, ports: 2 },
];

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

export const HuaweiOltView: React.FC<HuaweiOltViewProps> = ({ defaultHostIp }) => {
  // Box 1: Graphical Huawei OLT State
  const [oltModel, setOltModel] = useState<OltModel>('MA5608T');
  const [box1Tab, setBox1Tab] = useState<Box1Tab>('onus');
  const [selectedPortFilter, setSelectedPortFilter] = useState<string>('ALL');

  // System / Hostname / Mgmt IP
  const [sysname, setSysname] = useState('HUAWEI-MA5608T-CORE');
  const [mgmtVlan, setMgmtVlan] = useState('100');
  const [mgmtIp, setMgmtIp] = useState(defaultHostIp || '10.99.0.10');
  const [mgmtMask, setMgmtMask] = useState('255.255.255.0');
  const [uplinkPort, setUplinkPort] = useState('0/9 0');

  // ONUs & Auto-Find
  const [onus, setOnus] = useState<HuaweiOnu[]>(INITIAL_ONUS);
  const [autoFindList, setAutoFindList] = useState<AutoFindOnu[]>(INITIAL_AUTOFIND);
  const [findQuery, setFindQuery] = useState('');
  const [findBy, setFindBy] = useState<'all' | 'sn' | 'mac'>('all');

  // Add ONU Form State
  const [addMode, setAddMode] = useState<PonMode>('GPON');
  const [addFrame, setAddFrame] = useState('0');
  const [addSlot, setAddSlot] = useState('1');
  const [addPort, setAddPort] = useState('0');
  const [addOntId, setAddOntId] = useState('auto');
  const [addSnOrMac, setAddSnOrMac] = useState('48575443D9E04488');
  const [addDesc, setAddDesc] = useState('ISP-Client-01');
  const [addLineProfile, setAddLineProfile] = useState('10');
  const [addSrvProfile, setAddSrvProfile] = useState('10');
  const [addGemPort, setAddGemPort] = useState('1');
  const [addVlan, setAddVlan] = useState('100');
  const [addNativeEth, setAddNativeEth] = useState(true);

  // IP Routes State
  const [routes, setRoutes] = useState<OltIpRoute[]>(INITIAL_ROUTES);
  const [newRouteDst, setNewRouteDst] = useState('172.16.0.0');
  const [newRouteMask, setNewRouteMask] = useState('255.255.0.0');
  const [newRouteGw, setNewRouteGw] = useState('10.99.0.1');
  const [newRoutePref, setNewRoutePref] = useState('60');
  const [newRouteComment, setNewRouteComment] = useState('POP Distribution Route');

  // Box 2: Live Telnet + Generated CLI + Mid-Command Tab/? Console State
  const [telnetHost, setTelnetHost] = useState(defaultHostIp || '10.99.0.10');
  const [telnetPort, setTelnetPort] = useState(23);
  const [telnetUser, setTelnetUser] = useState('root');
  const [telnetPass, setTelnetPass] = useState('admin');
  const [autoPushGui, setAutoPushGui] = useState(true);
  const [liveTelnetId, setLiveTelnetId] = useState<string | null>(null);
  const [telnetConnecting, setTelnetConnecting] = useState(false);
  const [pushingCli, setPushingCli] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [lastGeneratedTitle, setLastGeneratedTitle] = useState('Huawei OLT Ready');
  const [lastGeneratedCli, setLastGeneratedCli] = useState<string>(
    `enable\nconfig\ndisplay board 0\ndisplay ont autofind all\ndisplay ip routing-table`
  );

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    {
      id: 'init_1',
      type: 'info',
      text: '  Huawei SmartAX MA5600T / MA5800 Dual-Pane OLT Console (RFC 854 Live Telnet)',
    },
    {
      id: 'init_2',
      type: 'success',
      text: "  Tip: কমান্ড পুরো লেখার আগেই 'Tab' অথবা '?' চাপুন (যেমন: dis + Tab, dis o + ?, ont a + Tab, ip r + Tab)",
    },
    {
      id: 'init_3',
      type: 'info',
      text: '  বাম পাশের Graphical Box থেকে ONU Add/Delete, SN/MAC Find, Hostname ও IP Route পরিবর্তন করলে এখানে সাথে সাথে CLI তৈরি ও পুশ হবে।',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  // Tracks the partial command sitting on the remote OLT prompt when Tab/? sends raw bytes mid-command
  const [remoteBufferHint, setRemoteBufferHint] = useState('');

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  // Parse live Huawei OLT output to auto-sync discovered autofind ONUs & sysname if present
  const tryParseLiveHuaweiOutput = (chunk: string) => {
    if (!chunk) return;
    // Detect Huawei sysname from prompt e.g. "MA5608T(config)#" or "HUAWEI-OLT>"
    const promptMatch = chunk.match(/([A-Za-z0-9_-]{3,28})(?:\([^)]+\))?[#>]\s*$/m);
    if (promptMatch && promptMatch[1] && !['User', 'Password'].includes(promptMatch[1])) {
      setSysname(promptMatch[1]);
    }

    // Parse "display ont autofind all" blocks if returned by real OLT
    if (/Ont\s+SN\s*:/i.test(chunk) && /F\/S\/P\s*:/i.test(chunk)) {
      const fspMatches = [...chunk.matchAll(/F\/S\/P\s*:\s*(\d+)\/(\d+)\/(\d+)/gi)];
      const snMatches = [...chunk.matchAll(/Ont\s+SN\s*:\s*([A-Fa-f0-9]+)/gi)];
      const eqMatches = [...chunk.matchAll(/Ont\s+EquipmentID\s*:\s*([^\r\n]+)/gi)];
      if (fspMatches.length > 0 && snMatches.length > 0) {
        const parsed: AutoFindOnu[] = snMatches.map((snM, idx) => {
          const fsp = fspMatches[idx] || fspMatches[0];
          const sn = snM[1].toUpperCase();
          return {
            id: `live_af_${sn}_${idx}`,
            frame: parseInt(fsp[1], 10) || 0,
            slot: parseInt(fsp[2], 10) || 1,
            port: parseInt(fsp[3], 10) || 0,
            mode: 'GPON',
            sn,
            mac: sn.slice(-12).replace(/(.{4})(?=.)/g, '$1-').toLowerCase(),
            vendor: sn.startsWith('48575443') ? 'HWTC (Huawei)' : 'Auto-Found ONT',
            equipmentId: eqMatches[idx]?.[1]?.trim() || 'GPON-ONT',
            foundAt: 'Live OLT',
          };
        });
        setAutoFindList((prev) => {
          const existingSns = new Set(prev.map((x) => x.sn));
          const merged = [...parsed.filter((p) => !existingSns.has(p.sn)), ...prev];
          return merged;
        });
      }
    }
  };

  // Real-time 300ms Telnet polling for crisp mid-command Tab / ? response
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
          tryParseLiveHuaweiOutput(data.output);
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
              text: `\n  [Telnet Disconnected] ${data.closedReason || 'Remote Huawei OLT closed connection.'}`,
            },
          ]);
        }
      } catch {
        // ignore transient poll glitch
      }
    }, 300);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveTelnetId]);

  const sendRawToLiveOlt = async (payload: string, raw = false) => {
    if (!liveTelnetId) return;
    try {
      const resp = await fetch(`/api/telnet/sessions/${liveTelnetId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload, raw }),
      });
      const data = await resp.json();
      if (data.output) {
        tryParseLiveHuaweiOutput(data.output);
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
        text: `  Connecting to Huawei OLT ${hostClean}:${telnetPort} via RFC 854 Telnet (User: ${telnetUser || 'manual'})...`,
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
        setConsoleLines((prev) => {
          const next: ConsoleLine[] = [
            ...prev,
            {
              id: `ok_${Date.now()}`,
              type: 'success',
              text: `  [LIVE HUAWEI OLT CONNECTED] ${hostClean}:${telnetPort} (${data.latencyMs}ms · Raw ? & Tab Ready)`,
            },
          ];
          return data.output ? appendRawChunk(next, data.output) : next;
        });
        showToast(`Connected to Huawei OLT ${hostClean}`);
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
            text: `  টিপস: প্রাইভেট LAN/PPTP আইপি (${hostClean}) হলে Android APK দিয়ে VPN চালু করে কানেক্ট করুন; আর এখন অফলাইন মোডেই বাম পাশের GUI ও ডান পাশের Tab/? CLI টেস্ট করতে পারবেন।`,
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
      { id: `u_disc_${Date.now()}`, type: 'info', text: '  [Disconnected from Huawei OLT]' },
    ]);
  };

  const pushCliScriptToOlt = async (title: string, script: string, forcePush = false) => {
    setLastGeneratedTitle(title);
    setLastGeneratedCli(script);

    const lines = script
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('!'));

    if (liveTelnetId && (autoPushGui || forcePush)) {
      setPushingCli(true);
      setConsoleLines((prev) => [
        ...prev,
        { id: `push_hdr_${Date.now()}`, type: 'info', text: `\n  >>> [Pushing GUI Action: ${title}] (${lines.length} lines)` },
      ]);
      for (const cmd of lines) {
        await sendRawToLiveOlt(cmd, false);
        await new Promise((r) => setTimeout(r, 240));
      }
      setPushingCli(false);
      showToast(`Pushed "${title}" to Live Huawei OLT!`);
    } else {
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `gen_hdr_${Date.now()}`,
          type: 'success',
          text: `\n  [GUI -> Huawei CLI Generated: ${title}]`,
        },
        {
          id: `gen_body_${Date.now()}`,
          type: 'output',
          text: lines.map((l) => `  ${sysname}(config)# ${l}`).join('\n'),
        },
      ]);
      showToast(`${title} — Huawei CLI generated!`);
    }
  };

  // =========================================================================
  // BOX 1 GRAPHICAL ACTIONS -> EXACT HUAWEI MA5600T / MA5800 CLI GENERATION
  // =========================================================================

  const buildAddOnuCli = () => {
    const f = parseInt(addFrame, 10) || 0;
    const s = parseInt(addSlot, 10) || 1;
    const p = parseInt(addPort, 10) || 0;
    const ontIdToken = addOntId.trim().toLowerCase() === 'auto' || !addOntId.trim() ? '' : ` ${addOntId.trim()}`;
    const cleanId = addSnOrMac.trim().toUpperCase();
    const safeDesc = (addDesc.trim() || 'Client-ONU').replace(/\s+/g, '_');
    const lp = parseInt(addLineProfile, 10) || 10;
    const sp = parseInt(addSrvProfile, 10) || 10;
    const gem = parseInt(addGemPort, 10) || 1;
    const vlanId = parseInt(addVlan, 10) || 100;

    if (addMode === 'GPON') {
      const targetOntRef = ontIdToken.trim() || '0';
      const lines = [
        'enable',
        'config',
        `interface gpon ${f}/${s}`,
        `ont add ${p}${ontIdToken} sn-auth "${cleanId}" omci ont-lineprofile-id ${lp} ont-srvprofile-id ${sp} desc "${safeDesc}"`,
      ];
      if (addNativeEth) {
        lines.push(`ont port native-vlan ${p} ${targetOntRef} eth 1 vlan ${vlanId} priority 0`);
      }
      lines.push(
        'quit',
        `service-port vlan ${vlanId} gpon ${f}/${s}/${p} ont ${targetOntRef} gemport ${gem} multi-service user-vlan ${vlanId} tag-transform translate`
      );
      return lines.join('\n');
    } else {
      const targetOntRef = ontIdToken.trim() || '0';
      const cleanMac = addSnOrMac.trim().toLowerCase();
      const lines = [
        'enable',
        'config',
        `interface epon ${f}/${s}`,
        `ont add ${p}${ontIdToken} mac-auth ${cleanMac} oam ont-lineprofile-id ${lp} ont-srvprofile-id ${sp} desc "${safeDesc}"`,
      ];
      if (addNativeEth) {
        lines.push(`ont port native-vlan ${p} ${targetOntRef} eth 1 vlan ${vlanId}`);
      }
      lines.push(
        'quit',
        `service-port vlan ${vlanId} epon ${f}/${s}/${p} ont ${targetOntRef} multi-service user-vlan ${vlanId} tag-transform translate`
      );
      return lines.join('\n');
    }
  };

  const handleAddOnuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseInt(addFrame, 10) || 0;
    const s = parseInt(addSlot, 10) || 1;
    const p = parseInt(addPort, 10) || 0;
    const portOnus = onus.filter((o) => o.frame === f && o.slot === s && o.port === p);
    const nextOntId =
      addOntId.trim().toLowerCase() === 'auto' || addOntId.trim() === ''
        ? portOnus.length > 0
          ? Math.max(...portOnus.map((o) => o.ontId)) + 1
          : 0
        : parseInt(addOntId, 10) || 0;

    const cleanVal = addSnOrMac.trim();
    if (!cleanVal) return;

    const newOnu: HuaweiOnu = {
      id: `onu_${Date.now()}`,
      frame: f,
      slot: s,
      port: p,
      ontId: nextOntId,
      mode: addMode,
      sn: addMode === 'GPON' ? cleanVal.toUpperCase() : cleanVal.replace(/[:-]/g, '').toUpperCase(),
      mac: addMode === 'EPON' ? cleanVal.toLowerCase() : cleanVal.slice(-12).replace(/(.{4})(?=.)/g, '$1-').toLowerCase(),
      desc: addDesc.trim() || `ONU-${f}-${s}-${p}-${nextOntId}`,
      lineProfile: parseInt(addLineProfile, 10) || 10,
      srvProfile: parseInt(addSrvProfile, 10) || 10,
      vlan: parseInt(addVlan, 10) || 100,
      gemPort: parseInt(addGemPort, 10) || 1,
      status: 'online',
      rxPowerDbm: -19.2,
      distanceM: 1420,
    };

    setOnus((prev) => [newOnu, ...prev]);
    // Remove from autofind queue if matching SN or MAC
    setAutoFindList((prev) =>
      prev.filter(
        (af) =>
          af.sn.toUpperCase() !== newOnu.sn.toUpperCase() &&
          af.mac.toLowerCase() !== newOnu.mac.toLowerCase()
      )
    );

    const cli = buildAddOnuCli();
    await pushCliScriptToOlt(`Add ${addMode} ONU ${f}/${s}/${p}:${nextOntId} (${newOnu.desc})`, cli);
    setBox1Tab('onus');
  };

  const handleDeleteOnu = async (onu: HuaweiOnu) => {
    setOnus((prev) => prev.filter((x) => x.id !== onu.id));
    const ifaceType = onu.mode === 'GPON' ? 'gpon' : 'epon';
    const cli = [
      'enable',
      'config',
      `undo service-port port ${onu.frame}/${onu.slot}/${onu.port} ont ${onu.ontId}`,
      `interface ${ifaceType} ${onu.frame}/${onu.slot}`,
      `ont delete ${onu.port} ${onu.ontId}`,
      'quit',
    ].join('\n');
    await pushCliScriptToOlt(`Delete ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId} (${onu.sn})`, cli);
  };

  const handleOnuQuickAction = async (onu: HuaweiOnu, action: 'optical' | 'mac' | 'reboot') => {
    const ifaceType = onu.mode === 'GPON' ? 'gpon' : 'epon';
    if (action === 'optical') {
      const cli = `interface ${ifaceType} ${onu.frame}/${onu.slot}\ndisplay ont optical-info ${onu.port} ${onu.ontId}\nquit`;
      await pushCliScriptToOlt(`Optical Info ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
      if (!liveTelnetId) {
        setConsoleLines((prev) => [
          ...prev,
          {
            id: `opt_${Date.now()}`,
            type: 'output',
            text: `  ---------------------------------------------------------------------\n  ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId} (${onu.desc}) Optical Diagnostics\n  Rx optical power(dBm)          : ${onu.rxPowerDbm.toFixed(2)}\n  Tx optical power(dBm)          : +2.35\n  OLT Rx ONT optical power(dBm)  : ${(onu.rxPowerDbm - 1.4).toFixed(2)}\n  Temperature(C)                 : 43\n  Voltage(V)                     : 3.28\n  ---------------------------------------------------------------------`,
          },
        ]);
      }
    } else if (action === 'mac') {
      const cli = `display mac-address port ${onu.frame}/${onu.slot}/${onu.port} ont ${onu.ontId}`;
      await pushCliScriptToOlt(`MAC Table ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
      if (!liveTelnetId) {
        setConsoleLines((prev) => [
          ...prev,
          {
            id: `mac_${Date.now()}`,
            type: 'output',
            text: `  SRV-P  VLAN  MAC-Address     PORT-TYPE  F/S/P    ONT-ID\n  102    ${onu.vlan}   ${onu.mac}  ${ifaceType}       ${onu.frame}/${onu.slot}/${onu.port}    ${onu.ontId}`,
          },
        ]);
      }
    } else if (action === 'reboot') {
      const cli = `interface ${ifaceType} ${onu.frame}/${onu.slot}\nont reset ${onu.port} ${onu.ontId}\nquit`;
      await pushCliScriptToOlt(`Reboot ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
    }
  };

  const handleRunAutoFindScan = async () => {
    const cli = 'display ont autofind all';
    await pushCliScriptToOlt('Scan Unregistered ONUs (Auto-Find)', cli);
    if (!liveTelnetId) {
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `af_scan_${Date.now()}`,
          type: 'output',
          text: autoFindList
            .map(
              (a, i) =>
                `  Number ${i + 1}: F/S/P: ${a.frame}/${a.slot}/${a.port} | Mode: ${a.mode} | SN: ${a.sn} | MAC: ${a.mac} | Model: ${a.equipmentId}`
            )
            .join('\n'),
        },
      ]);
    }
  };

  const handleFindBySnOrMacCli = async () => {
    const q = findQuery.trim();
    if (!q) {
      await handleRunAutoFindScan();
      return;
    }
    const looksLikeMac = findBy === 'mac' || q.includes('-') || q.includes(':');
    const cli = looksLikeMac
      ? `display ont info by-mac ${q}`
      : `display ont info by-sn ${q.toUpperCase()}`;
    await pushCliScriptToOlt(`Find ONU (${looksLikeMac ? 'MAC' : 'SN'}: ${q})`, cli);
  };

  const handlePrefillFromAutoFind = (af: AutoFindOnu) => {
    setAddMode(af.mode);
    setAddFrame(String(af.frame));
    setAddSlot(String(af.slot));
    setAddPort(String(af.port));
    setAddOntId('auto');
    setAddSnOrMac(af.mode === 'GPON' ? af.sn : af.mac);
    setAddDesc(`${af.equipmentId}-${af.sn.slice(-4)}`);
    setBox1Tab('add-onu');
    showToast(`Loaded ${af.sn} into Add ONU form`);
  };

  const handleApplyHostnameAndIp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sysname.trim().replace(/\s+/g, '-') || 'HUAWEI-OLT';
    setSysname(cleanName);
    const cli = [
      'enable',
      'config',
      `sysname ${cleanName}`,
      `vlan ${mgmtVlan} smart`,
      `port vlan ${mgmtVlan} ${uplinkPort}`,
      `interface vlanif ${mgmtVlan}`,
      `ip address ${mgmtIp.trim()} ${mgmtMask.trim()}`,
      'quit',
      'save',
    ].join('\n');
    await pushCliScriptToOlt(`Set Hostname (${cleanName}) & Mgmt IP (${mgmtIp})`, cli);
  };

  const handleAddIpRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteDst.trim() || !newRouteMask.trim() || !newRouteGw.trim()) return;
    const route: OltIpRoute = {
      id: `rt_${Date.now()}`,
      destination: newRouteDst.trim(),
      mask: newRouteMask.trim(),
      gateway: newRouteGw.trim(),
      preference: parseInt(newRoutePref, 10) || 60,
      comment: newRouteComment.trim() || 'Static Route',
    };
    setRoutes((prev) => [...prev, route]);
    const cli = [
      'enable',
      'config',
      `ip route-static ${route.destination} ${route.mask} ${route.gateway}${route.preference !== 60 ? ` preference ${route.preference}` : ''}`,
      'save',
    ].join('\n');
    await pushCliScriptToOlt(`Add IP Route ${route.destination} -> ${route.gateway}`, cli);
  };

  const handleDeleteIpRoute = async (route: OltIpRoute) => {
    setRoutes((prev) => prev.filter((r) => r.id !== route.id));
    const cli = [
      'enable',
      'config',
      `undo ip route-static ${route.destination} ${route.mask} ${route.gateway}`,
    ].join('\n');
    await pushCliScriptToOlt(`Delete IP Route ${route.destination}`, cli);
  };

  // =========================================================================
  // BOX 2: INTERACTIVE MID-COMMAND '?' HELP & 'Tab' AUTOCOMPLETE ENGINE
  // Works BEFORE finishing the command in BOTH Live Telnet and Local OLT Mode
  // =========================================================================

  const activePrompt = liveTelnetId ? `${sysname}@${telnetHost}> ` : `${sysname}(config)# `;

  const handleQuestionHelp = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputVal;
    if (liveTelnetId) {
      // Send partial buffer + raw '?' directly to Huawei OLT socket (NO Enter / newline!)
      const rawPayload = `${text}?`;
      setRemoteBufferHint((prev) => `${prev}${text}`);
      setInputVal('');
      await sendRawToLiveOlt(rawPayload, true);
      inputRef.current?.focus();
      return;
    }

    const helpRes = getCliHelp('Huawei', text);
    setConsoleLines((prev) => [
      ...prev,
      { id: `qp_${Date.now()}`, type: 'prompt', text: `${activePrompt}${text}?` },
      { id: `qo_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type: 'output', text: helpRes.formatted },
    ]);
    setInputVal(text);
    inputRef.current?.focus();
  };

  const handleTabComplete = async () => {
    if (liveTelnetId) {
      // Send partial text + raw ASCII TAB (0x09) directly to Huawei OLT before command finishes!
      const rawPayload = `${inputVal}\t`;
      setRemoteBufferHint((prev) => `${prev}${inputVal}`);
      setInputVal('');
      await sendRawToLiveOlt(rawPayload, true);
      inputRef.current?.focus();
      return;
    }

    const tabRes = getCliTabCompletion('Huawei', inputVal);
    if (tabRes.changed) {
      setInputVal(tabRes.completed);
    }
    if (tabRes.formatted) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `tp_${Date.now()}`, type: 'prompt', text: `${activePrompt}${inputVal}<Tab>` },
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
      setConsoleLines((prev) => [...prev, { id: `cc_${Date.now()}`, type: 'info', text: `${activePrompt}${inputVal}^C` }]);
      setInputVal('');
    } else if (ctrl === 'CTRL_Z') {
      setConsoleLines((prev) => [...prev, { id: `cz_${Date.now()}`, type: 'info', text: `${activePrompt}^Z (Returned to # mode)` }]);
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

    const lower = trimmed.toLowerCase();
    if (lower === 'clear') {
      setConsoleLines([]);
      return;
    }

    const appended: ConsoleLine[] = [
      { id: `p_${Date.now()}`, type: 'prompt', text: `${activePrompt}${trimmed}` },
    ];

    if (lower === 'help') {
      appended.push({ id: `h_${Date.now()}`, type: 'output', text: getCliHelp('Huawei', '').formatted });
    } else if (lower.startsWith('sysname ')) {
      const nextName = trimmed.split(/\s+/)[1];
      if (nextName) setSysname(nextName);
      appended.push({ id: `sn_${Date.now()}`, type: 'success', text: `  Hostname updated graphically to: ${nextName}` });
    } else if (lower.includes('display ont autofind')) {
      appended.push({
        id: `af_${Date.now()}`,
        type: 'output',
        text:
          autoFindList.length === 0
            ? '  No unregistered ONTs found.'
            : autoFindList
                .map((a, i) => `  [${i + 1}] F/S/P: ${a.frame}/${a.slot}/${a.port}  Mode: ${a.mode}  SN: ${a.sn}  MAC: ${a.mac}  Model: ${a.equipmentId}`)
                .join('\n'),
      });
    } else if (lower.includes('display ont info')) {
      const filtered = onus.filter((o) => {
        if (lower.includes('by-sn ')) {
          const sn = trimmed.split(/\s+/).pop()?.toUpperCase() || '';
          return o.sn.includes(sn);
        }
        if (lower.includes('by-mac ')) {
          const mac = trimmed.split(/\s+/).pop()?.toLowerCase() || '';
          return o.mac.includes(mac);
        }
        return true;
      });
      appended.push({
        id: `oi_${Date.now()}`,
        type: 'output',
        text:
          filtered.length === 0
            ? '  Failure: The required ONT does not exist.'
            : `  F/S/P   ID  Mode  SN / MAC              Rx(dBm)  Status   Description\n  ----------------------------------------------------------------------------\n` +
              filtered
                .map(
                  (o) =>
                    `  ${o.frame}/${o.slot}/${o.port}   ${String(o.ontId).padEnd(3)} ${o.mode.padEnd(5)} ${(o.mode === 'GPON' ? o.sn : o.mac).padEnd(21)} ${o.rxPowerDbm.toFixed(2).padEnd(8)} ${o.status.padEnd(8)} ${o.desc}`
                )
                .join('\n'),
      });
    } else if (lower.includes('display ip routing-table')) {
      appended.push({
        id: `rt_${Date.now()}`,
        type: 'output',
        text:
          `  Destination/Mask          Proto   Pre  NextHop          Comment\n  ---------------------------------------------------------------------\n` +
          routes
            .map(
              (r) =>
                `  ${`${r.destination}/${r.mask}`.padEnd(25)} Static  ${String(r.preference).padEnd(4)} ${r.gateway.padEnd(16)} ${r.comment}`
            )
            .join('\n'),
      });
    } else if (lower.includes('display board')) {
      appended.push({
        id: `bd_${Date.now()}`,
        type: 'output',
        text:
          `  SlotID  BoardName  Status          SubType0\n  ---------------------------------------------\n` +
          CHASSIS_SLOTS.map((s) => `  ${String(s.slot).padEnd(7)} ${s.board.padEnd(10)} Active_normal   ${s.role}`).join('\n'),
      });
    } else if (lower.startsWith('ip route-static ')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 5) {
        const created: OltIpRoute = {
          id: `rt_cli_${Date.now()}`,
          destination: parts[2],
          mask: parts[3],
          gateway: parts[4],
          preference: 60,
          comment: 'Added via CLI',
        };
        setRoutes((prev) => [...prev, created]);
        appended.push({ id: `r_ok_${Date.now()}`, type: 'success', text: `  Static route ${created.destination} -> ${created.gateway} added to graphical IP Routes table.` });
      }
    } else if (lower === 'save') {
      appended.push({ id: `sv_${Date.now()}`, type: 'success', text: '  Configuration saved to flash successfully.' });
    } else {
      // If user typed a partial command and hit enter, show helpful ? hint
      const hint = getCliHelp('Huawei', trimmed);
      appended.push({
        id: `unk_${Date.now()}`,
        type: 'info',
        text:
          hint.matches.length > 0
            ? `  Command executed or incomplete. Matching Huawei subcommands:\n${hint.formatted}`
            : `  Command sent: "${trimmed}" — Press '?' or 'Tab' mid-command for Huawei OLT CLI help.`,
      });
    }

    setConsoleLines((prev) => [...prev, ...appended]);
  };

  const handleInputChange = (nextVal: string) => {
    // Instant '?' trigger on mobile Android/iOS soft keyboards BEFORE finishing the command!
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

  // Filtered ONUs for Box 1 Graphical Table
  const filteredOnus = onus.filter((o) => {
    const fspKey = `${o.frame}/${o.slot}/${o.port}`;
    if (selectedPortFilter !== 'ALL' && fspKey !== selectedPortFilter) return false;
    const q = findQuery.trim().toLowerCase();
    if (!q) return true;
    if (findBy === 'sn') return o.sn.toLowerCase().includes(q);
    if (findBy === 'mac') return o.mac.toLowerCase().includes(q);
    return (
      o.sn.toLowerCase().includes(q) ||
      o.mac.toLowerCase().includes(q) ||
      o.desc.toLowerCase().includes(q) ||
      fspKey.includes(q) ||
      String(o.ontId) === q
    );
  });

  // Live Huawei CLI suggestions based on partial typing (even 1-2 letters before finishing command!)
  const suggestionBasis = liveTelnetId ? `${remoteBufferHint}${inputVal}` : inputVal;
  const huaweiSuggestions = getCliSuggestions('Huawei', suggestionBasis);

  const onlineCount = onus.filter((o) => o.status === 'online').length;
  const losCount = onus.filter((o) => o.status !== 'online').length;

  return (
    <div className="space-y-4">
      {/* Top Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-black" />
            <span>Huawei OLT Full Graphical Management &amp; Live Telnet Workbench</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            বাম বক্সে ফুল গ্রাফিক্যাল Huawei OLT (ONU Add/Delete, SN/MAC Find, Hostname, VLAN IP, IP Route) · ডান বক্সে লাইভ Telnet ও মিড-কমান্ড <strong>Tab / ?</strong> হেল্প।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={oltModel}
            onChange={(e) => setOltModel(e.target.value as OltModel)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
          >
            <option value="MA5608T">Huawei MA5608T</option>
            <option value="MA5683T">Huawei MA5683T</option>
            <option value="MA5600T">Huawei MA5600T</option>
            <option value="MA5800-X7">Huawei MA5800-X7</option>
            <option value="MA5800-X15">Huawei MA5800-X15</option>
          </select>

          <button
            type="button"
            onClick={() => pushCliScriptToOlt('Save OLT Configuration to Flash', 'save')}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save OLT Config</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* DUAL-BOX LAYOUT: BOX 1 (LEFT - FULL GRAPHICAL HUAWEI OLT) + BOX 2 (RIGHT - LIVE TELNET & MID-COMMAND TAB/?) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ================================================================= */}
        {/* BOX 1: HUAWEI OLT FULL GRAPHICAL MANAGEMENT INTERFACE             */}
        {/* ================================================================= */}
        <section className="xl:col-span-7 bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs">
          {/* Box 1 Header: OLT Identity & Live KPIs */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-mono text-xs font-bold">
                HW
              </span>
              <div>
                <div className="text-sm font-bold text-black flex items-center gap-2">
                  <span>{sysname}</span>
                  <span className="text-[11px] font-mono text-slate-600 font-normal">({oltModel})</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Mgmt Vlanif{mgmtVlan}: <strong className="text-black">{mgmtIp}</strong> · Routes: <strong className="text-black">{routes.length}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <div className="px-2 py-1 rounded bg-white border border-slate-200">
                <span className="text-slate-600">Online: </span>
                <strong className="text-emerald-700">{onlineCount}</strong>
              </div>
              <div className="px-2 py-1 rounded bg-white border border-slate-200">
                <span className="text-slate-600">LOS: </span>
                <strong className="text-red-700">{losCount}</strong>
              </div>
              <div className="px-2 py-1 rounded bg-white border border-slate-200">
                <span className="text-slate-600">Auto-Find: </span>
                <strong className="text-amber-700">{autoFindList.length}</strong>
              </div>
            </div>
          </div>

          {/* Graphical OLT Chassis & Clickable PON Ports Visualizer */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-black" />
                <span>Graphical Chassis Frame 0 — Click PON Port to Filter</span>
              </span>
              {selectedPortFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedPortFilter('ALL')}
                  className="text-[11px] font-bold text-black underline cursor-pointer"
                >
                  Show All Ports ({onus.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CHASSIS_SLOTS.filter((s) => s.ports > 0 && s.mode !== 'UPLINK').map((slot) => (
                <div key={slot.slot} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span className="font-bold text-black">
                      Slot 0/{slot.slot} · {slot.board}
                    </span>
                    <span className="text-slate-600">{slot.mode}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {Array.from({ length: slot.ports }).map((_, portIdx) => {
                      const fsp = `0/${slot.slot}/${portIdx}`;
                      const count = onus.filter((o) => `${o.frame}/${o.slot}/${o.port}` === fsp).length;
                      const afCount = autoFindList.filter((a) => `${a.frame}/${a.slot}/${a.port}` === fsp).length;
                      const isSelected = selectedPortFilter === fsp;
                      return (
                        <button
                          key={fsp}
                          type="button"
                          onClick={() => {
                            setSelectedPortFilter(isSelected ? 'ALL' : fsp);
                            setAddSlot(String(slot.slot));
                            setAddPort(String(portIdx));
                            if (slot.mode === 'GPON' || slot.mode === 'EPON') {
                              setAddMode(slot.mode);
                            }
                          }}
                          title={`PON ${fsp} (${slot.mode}) — ${count} Registered, ${afCount} Auto-Find`}
                          className={`px-1 py-1 rounded border text-[10px] font-mono transition cursor-pointer flex flex-col items-center ${
                            isSelected
                              ? 'bg-black text-white border-black font-bold'
                              : count > 0
                              ? 'bg-white text-black border-slate-300 hover:border-black'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-black'
                          }`}
                        >
                          <span>P{portIdx}</span>
                          <span className={`text-[9px] ${isSelected ? 'text-emerald-300' : count > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                            {count}{afCount > 0 ? `+${afCount}` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Box 1 Sub-Navigation Tabs */}
          <div className="px-4 pt-3 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'onus', label: `ONUs & SN/MAC Find (${onus.length})`, icon: Wifi },
              { id: 'add-onu', label: '+ Add ONU (GPON/EPON)', icon: Plus },
              { id: 'system', label: 'Hostname & Mgmt IP', icon: Sliders },
              { id: 'routes', label: `IP Routes (${routes.length})`, icon: Route },
            ].map((t) => {
              const Icon = t.icon;
              const active = box1Tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBox1Tab(t.id as Box1Tab)}
                  className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap border-t border-l border-r ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Box 1 Body */}
          <div className="p-4 space-y-4">
            {/* TAB 1: ONUs & SN/MAC FIND + AUTO-FIND QUEUE */}
            {box1Tab === 'onus' && (
              <>
                {/* SN / MAC Search & Find Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={findQuery}
                      onChange={(e) => setFindQuery(e.target.value)}
                      placeholder="Find ONU by SN (48575443...), MAC (e067-b311...), Desc or F/S/P..."
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <select
                    value={findBy}
                    onChange={(e) => setFindBy(e.target.value as 'all' | 'sn' | 'mac')}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono font-semibold text-black focus:outline-none focus:border-black"
                  >
                    <option value="all">Auto (SN / MAC)</option>
                    <option value="sn">GPON SN Only</option>
                    <option value="mac">EPON MAC Only</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleFindBySnOrMacCli}
                    className="px-3 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Find on OLT</span>
                  </button>
                </div>

                {/* Unregistered ONU Auto-Find Queue */}
                <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-black">
                        Auto-Find Unregistered ONUs ({autoFindList.length})
                      </span>
                      <span className="text-[11px] font-mono text-slate-600 hidden sm:inline">
                        display ont autofind all
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAutoFindScan}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Scan Auto-Find</span>
                    </button>
                  </div>

                  {autoFindList.length === 0 ? (
                    <div className="text-[11px] text-slate-600 bg-white rounded-lg p-2.5 border border-slate-200 text-center">
                      কোনো নতুন Unregistered ONU পাওয়া যায়নি। &ldquo;Scan Auto-Find&rdquo; চাপুন।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {autoFindList.map((af) => (
                        <div
                          key={af.id}
                          className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 font-mono">
                            <div className="text-[11px] font-bold text-black truncate">
                              {af.mode === 'GPON' ? af.sn : af.mac}
                            </div>
                            <div className="text-[10px] text-slate-600 truncate">
                              Port {af.frame}/{af.slot}/{af.port} · {af.mode} · {af.equipmentId}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePrefillFromAutoFind(af)}
                            className="px-2.5 py-1.5 rounded-md bg-black hover:bg-slate-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Registered ONUs Graphical Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono text-slate-700">
                        <th className="py-2 px-3">F/S/P:ID</th>
                        <th className="py-2 px-3">SN / MAC &amp; Customer</th>
                        <th className="py-2 px-3">VLAN / Prof</th>
                        <th className="py-2 px-3">Rx Optical</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredOnus.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-600 font-mono text-xs">
                            No matching ONUs found for this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredOnus.map((onu) => {
                          const rxColor =
                            onu.status !== 'online' || onu.rxPowerDbm <= -28
                              ? 'text-red-700 font-bold'
                              : onu.rxPowerDbm <= -25
                              ? 'text-amber-700 font-bold'
                              : 'text-emerald-700 font-bold';
                          return (
                            <tr key={onu.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                <div className="font-bold text-black">
                                  {onu.frame}/{onu.slot}/{onu.port}:{onu.ontId}
                                </div>
                                <div className="text-[10px] text-slate-600">{onu.mode}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <div className="font-bold text-black text-[11px]">
                                  {onu.mode === 'GPON' ? onu.sn : onu.mac}
                                </div>
                                <div className="text-[11px] text-slate-600 font-sans truncate max-w-[170px]">
                                  {onu.desc}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap text-[11px]">
                                <div className="text-black font-semibold">VLAN {onu.vlan}</div>
                                <div className="text-[10px] text-slate-600">
                                  L:{onu.lineProfile} / S:{onu.srvProfile}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono whitespace-nowrap text-[11px]">
                                <div className={rxColor}>
                                  {onu.status === 'online' ? `${onu.rxPowerDbm.toFixed(2)} dBm` : 'LOS / Offline'}
                                </div>
                                <div className="text-[10px] text-slate-600">{onu.distanceM}m</div>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'optical')}
                                    title="Check Optical Power (display ont optical-info)"
                                    className="px-2 py-1 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[10px] font-bold cursor-pointer transition"
                                  >
                                    Opt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'mac')}
                                    title="Show MAC Table behind ONU"
                                    className="px-2 py-1 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[10px] font-bold cursor-pointer transition"
                                  >
                                    MAC
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'reboot')}
                                    title="Reboot ONU (ont reset)"
                                    className="p-1 rounded bg-white hover:bg-amber-100 text-black border border-slate-300 cursor-pointer transition"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOnu(onu)}
                                    title="Delete ONU & Service-Port"
                                    className="p-1 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* TAB 2: ADD ONU (GPON SN / EPON MAC PROVISIONING) */}
            {box1Tab === 'add-onu' && (
              <form onSubmit={handleAddOnuSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-black">
                    Provision New Huawei ONU ({addMode === 'GPON' ? 'SN-Auth OMCI' : 'MAC-Auth OAM'})
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-300">
                    {(['GPON', 'EPON'] as PonMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setAddMode(m);
                          if (m === 'EPON' && addSlot === '1') setAddSlot('3');
                          if (m === 'GPON' && addSlot === '3') setAddSlot('1');
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                          addMode === m ? 'bg-black text-white' : 'text-slate-700 hover:text-black'
                        }`}
                      >
                        {m} ({m === 'GPON' ? 'SN' : 'MAC'})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Frame</label>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      value={addFrame}
                      onChange={(e) => setAddFrame(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Slot</label>
                    <input
                      type="number"
                      min={0}
                      max={16}
                      value={addSlot}
                      onChange={(e) => setAddSlot(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">PON Port</label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={addPort}
                      onChange={(e) => setAddPort(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">ONU ID</label>
                    <input
                      type="text"
                      value={addOntId}
                      onChange={(e) => setAddOntId(e.target.value)}
                      placeholder="auto or 0-127"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      {addMode === 'GPON' ? 'GPON Serial Number (SN)' : 'EPON MAC Address'}
                    </label>
                    <input
                      type="text"
                      required
                      value={addSnOrMac}
                      onChange={(e) => setAddSnOrMac(e.target.value)}
                      placeholder={addMode === 'GPON' ? '48575443D9E04488' : 'e067-b311-a401'}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Customer Description</label>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      placeholder="PPPoE-User-Name"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Line Profile</label>
                    <input
                      type="number"
                      value={addLineProfile}
                      onChange={(e) => setAddLineProfile(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Srv Profile</label>
                    <input
                      type="number"
                      value={addSrvProfile}
                      onChange={(e) => setAddSrvProfile(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">Service VLAN</label>
                    <input
                      type="number"
                      value={addVlan}
                      onChange={(e) => setAddVlan(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">GEM Port</label>
                    <input
                      type="number"
                      value={addGemPort}
                      onChange={(e) => setAddGemPort(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addNativeEth}
                    onChange={(e) => setAddNativeEth(e.target.checked)}
                    className="accent-black rounded"
                  />
                  <span>Auto-configure Native VLAN on ONU ETH 1 port (`ont port native-vlan ... eth 1 vlan {addVlan}`)</span>
                </label>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Live Huawei CLI Preview
                  </div>
                  <pre className="text-[11px] font-mono text-black whitespace-pre-wrap leading-relaxed">
                    {buildAddOnuCli()}
                  </pre>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{liveTelnetId && autoPushGui ? 'Add ONU & Push Live to OLT' : 'Add ONU & Generate CLI'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: HOSTNAME & MANAGEMENT VLAN / IP */}
            {box1Tab === 'system' && (
              <form onSubmit={handleApplyHostnameAndIp} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      OLT Hostname (`sysname`)
                    </label>
                    <input
                      type="text"
                      required
                      value={sysname}
                      onChange={(e) => setSysname(e.target.value)}
                      placeholder="HUAWEI-MA5608T-CORE"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      Management VLAN ID (`vlan &lt;id&gt; smart`)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      value={mgmtVlan}
                      onChange={(e) => setMgmtVlan(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      Vlanif{mgmtVlan} IP Address
                    </label>
                    <input
                      type="text"
                      required
                      value={mgmtIp}
                      onChange={(e) => setMgmtIp(e.target.value)}
                      placeholder="10.99.0.10"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      Subnet Mask
                    </label>
                    <input
                      type="text"
                      required
                      value={mgmtMask}
                      onChange={(e) => setMgmtMask(e.target.value)}
                      placeholder="255.255.255.0"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-black mb-1">
                      Uplink Port (`port vlan`)
                    </label>
                    <input
                      type="text"
                      value={uplinkPort}
                      onChange={(e) => setUplinkPort(e.target.value)}
                      placeholder="0/9 0"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono text-[11px] text-black whitespace-pre-wrap">
                  {`enable\nconfig\nsysname ${sysname}\nvlan ${mgmtVlan} smart\nport vlan ${mgmtVlan} ${uplinkPort}\ninterface vlanif ${mgmtVlan}\nip address ${mgmtIp} ${mgmtMask}\nquit\nsave`}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>{liveTelnetId && autoPushGui ? 'Apply & Push to Live OLT' : 'Apply Hostname & IP'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: GRAPHICAL STATIC IP ROUTES */}
            {box1Tab === 'routes' && (
              <div className="space-y-4">
                <form
                  onSubmit={handleAddIpRoute}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5"
                >
                  <div className="text-xs font-bold text-black flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    <span>Add Static IP Route (`ip route-static`)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      required
                      value={newRouteDst}
                      onChange={(e) => setNewRouteDst(e.target.value)}
                      placeholder="Destination (0.0.0.0)"
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                    <input
                      type="text"
                      required
                      value={newRouteMask}
                      onChange={(e) => setNewRouteMask(e.target.value)}
                      placeholder="Mask (255.255.255.0)"
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                    <input
                      type="text"
                      required
                      value={newRouteGw}
                      onChange={(e) => setNewRouteGw(e.target.value)}
                      placeholder="Next-Hop Gateway"
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                    <input
                      type="text"
                      value={newRouteComment}
                      onChange={(e) => setNewRouteComment(e.target.value)}
                      placeholder="Comment"
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600">
                      <span>Pref:</span>
                      <input
                        type="number"
                        min={1}
                        max={255}
                        value={newRoutePref}
                        onChange={(e) => setNewRoutePref(e.target.value)}
                        className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-black"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add IP Route</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                        <th className="py-2 px-3">Destination</th>
                        <th className="py-2 px-3">Mask</th>
                        <th className="py-2 px-3">Next-Hop GW</th>
                        <th className="py-2 px-3">Pref</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {routes.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">
                            <div>{r.destination}</div>
                            <div className="text-[10px] font-sans font-normal text-slate-600">{r.comment}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-800">{r.mask}</td>
                          <td className="py-2 px-3 font-bold text-emerald-800">{r.gateway}</td>
                          <td className="py-2 px-3 text-slate-700">{r.preference}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteIpRoute(r)}
                              title="Delete Route (undo ip route-static)"
                              className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* BOX 2: LIVE HUAWEI OLT TELNET & MID-COMMAND TAB / ? HELP CONSOLE  */}
        {/* ================================================================= */}
        <section className="xl:col-span-5 bg-white border-2 border-slate-300 rounded-xl overflow-hidden flex flex-col shadow-xs">
          {/* Box 2 Top: Live Telnet Connection Form */}
          <form onSubmit={handleConnectTelnet} className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                <Radio className={`w-4 h-4 ${liveTelnetId ? 'text-emerald-600 animate-pulse' : 'text-slate-600'}`} />
                <span>Box 2: Live Huawei OLT Telnet &amp; Tab / ? CLI</span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPushGui}
                  onChange={(e) => setAutoPushGui(e.target.checked)}
                  className="accent-black rounded"
                />
                <span>Auto-Push GUI</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <input
                type="text"
                value={telnetHost}
                onChange={(e) => setTelnetHost(e.target.value)}
                placeholder="OLT IP"
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
                placeholder="root"
                className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="password"
                value={telnetPass}
                onChange={(e) => setTelnetPass(e.target.value)}
                placeholder="admin"
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
                  <span>{telnetConnecting ? 'Connecting...' : 'Connect Huawei Telnet'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      pushCliScriptToOlt(
                        'Sync Live Huawei OLT State',
                        'enable\nscroll\ndisplay board 0\ndisplay ont autofind all\ndisplay ip routing-table',
                        true
                      )
                    }
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Sync Live OLT</span>
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

          {/* Latest Generated GUI CLI Queue Bar */}
          <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
            <div className="min-w-0">
              <span className="font-bold text-black truncate block">CLI Queue: {lastGeneratedTitle}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lastGeneratedCli);
                  setCopiedCli(true);
                  setTimeout(() => setCopiedCli(false), 1600);
                }}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedCli ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCli ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                disabled={!liveTelnetId || pushingCli}
                onClick={() => pushCliScriptToOlt(lastGeneratedTitle, lastGeneratedCli, true)}
                className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white disabled:opacity-40 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{pushingCli ? 'Pushing...' : 'Push Live'}</span>
              </button>
            </div>
          </div>

          {/* Hardware CLI Keys Bar (? Help, Tab, Ctrl+C, Ctrl+Z, Space, Enter) */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => handleQuestionHelp(inputVal)}
              className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              title="Send '?' mid-command — Huawei OLT shows all matching commands immediately"
            >
              <HelpCircle className="w-3 h-3" />
              <span>? Help</span>
            </button>
            <button
              type="button"
              onClick={handleTabComplete}
              className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              title="Send Tab (0x09) mid-command — Auto-completes partial command immediately"
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
              title="Send Space for ---- More ---- paging"
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
                  if (telnetPass) {
                    setTimeout(() => sendRawToLiveOlt(telnetPass, false), 500);
                  }
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

          {/* Live Telnet Output Console Viewport */}
          <div
            className="bg-white p-3.5 font-mono text-xs h-[420px] overflow-y-auto flex flex-col justify-between text-black"
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

            {/* Sticky Mid-Command Autocomplete Suggestions + Prompt Input */}
            <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 bg-white sticky bottom-0">
              {huaweiSuggestions.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 shrink-0">
                    Tab/?:
                  </span>
                  {huaweiSuggestions.map((sug) => (
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
                <span className="shrink-0 max-w-[130px] truncate">{activePrompt}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type partial cmd (e.g. dis o) then Tab or ?..."
                  className="flex-1 min-w-0 bg-transparent text-black focus:outline-none font-mono text-xs caret-black placeholder:text-slate-400 font-normal"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuestionHelp(inputVal);
                  }}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-bold cursor-pointer shrink-0"
                  title="Send ? immediately before finishing command"
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
                  title="Send Tab immediately before finishing command"
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
        </section>
      </div>
    </div>
  );
};
