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
  Edit3,
  Power,
  Layers,
  BookOpen,
  ShieldAlert,
  Gauge,
  X,
  GripHorizontal,
  Cable,
} from 'lucide-react';
import { getCliHelp, getCliTabCompletion, getCliSuggestions } from '../services/cliCommandTree';
import {
  HuaweiOltModel,
  HuaweiPonMode,
  HuaweiPromptMode,
  HUAWEI_OLT_DATASHEETS,
  HUAWEI_OFFICIAL_CHEATSHEET,
  detectHuaweiPromptMode,
  prepareHuaweiScriptForPrompt,
  huaweiCommandNeedsCrConfirm,
} from '../services/huaweiOltCommands';

type Box1Tab =
  | 'onus'
  | 'add-onu'
  | 'service-ports'
  | 'profiles'
  | 'vlans'
  | 'system'
  | 'cheatsheet';

interface ChassisSlot {
  slot: number;
  board: string;
  role: string;
  mode: 'CTRL' | 'GPON' | 'EPON' | 'XGS-PON' | 'UPLINK';
  ports: number;
  status: 'Normal' | 'Active_normal' | 'Auto_find' | 'Offline';
}

interface HuaweiOnu {
  id: string;
  frame: number;
  slot: number;
  port: number;
  ontId: number;
  mode: HuaweiPonMode;
  sn: string;
  mac: string;
  desc: string;
  lineProfile: number;
  srvProfile: number;
  vlan: number;
  gemPort: number;
  status: 'online' | 'offline' | 'los' | 'deactivated';
  rxPowerDbm: number;
  distanceM: number;
}

interface AutoFindOnu {
  id: string;
  frame: number;
  slot: number;
  port: number;
  mode: HuaweiPonMode;
  sn: string;
  mac: string;
  vendor: string;
  equipmentId: string;
  foundAt: string;
}

interface HuaweiServicePort {
  index: number;
  vlan: number;
  innerVlan?: number;
  mode: 'gpon' | 'epon' | 'xgpon';
  fsp: string;
  ontId: number;
  gemPort: number;
  userVlan: string;
  tagTransform: 'translate' | 'transparent' | 'add-double';
  rxTrafficIdx: number;
  txTrafficIdx: number;
  state: 'up' | 'down';
}

interface HuaweiVlanItem {
  id: number;
  type: 'smart' | 'mux' | 'standard' | 'super';
  qinq: boolean;
  desc: string;
  uplinkTagged: string;
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
    slot: 2,
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
    slot: 2,
    port: 1,
    mode: 'EPON',
    sn: 'F492BF2210C8',
    mac: 'f492-bf22-10c8',
    vendor: 'BDCOM / XPON',
    equipmentId: 'EPON-1GE',
    foundAt: '4m ago',
  },
];

const INITIAL_SERVICE_PORTS: HuaweiServicePort[] = [
  {
    index: 100,
    vlan: 100,
    mode: 'gpon',
    fsp: '0/1/0',
    ontId: 0,
    gemPort: 1,
    userVlan: '100',
    tagTransform: 'translate',
    rxTrafficIdx: 10,
    txTrafficIdx: 10,
    state: 'up',
  },
  {
    index: 101,
    vlan: 200,
    mode: 'gpon',
    fsp: '0/1/0',
    ontId: 1,
    gemPort: 1,
    userVlan: '200',
    tagTransform: 'translate',
    rxTrafficIdx: 20,
    txTrafficIdx: 20,
    state: 'up',
  },
  {
    index: 102,
    vlan: 500,
    innerVlan: 100,
    mode: 'gpon',
    fsp: '0/1/1',
    ontId: 0,
    gemPort: 1,
    userVlan: '100',
    tagTransform: 'add-double',
    rxTrafficIdx: 10,
    txTrafficIdx: 10,
    state: 'down',
  },
];

const INITIAL_VLANS: HuaweiVlanItem[] = [
  { id: 100, type: 'smart', qinq: false, desc: 'PPPoE-Residential', uplinkTagged: '0/0 0' },
  { id: 200, type: 'smart', qinq: false, desc: 'Corporate-Dedicated', uplinkTagged: '0/0 0' },
  { id: 500, type: 'smart', qinq: true, desc: 'QinQ-S-VLAN-ISP', uplinkTagged: '0/0 0' },
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

function ponModeToCliInterface(mode: HuaweiPonMode): 'gpon' | 'epon' | 'xgpon' {
  if (mode === 'EPON') return 'epon';
  if (mode === 'XG-PON' || mode === 'XGS-PON') return 'xgpon';
  return 'gpon';
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

export const HuaweiOltView: React.FC<HuaweiOltViewProps> = ({ defaultHostIp }) => {
  // Model & Chassis State
  const [oltModel, setOltModel] = useState<HuaweiOltModel>('MA5608T');
  const [chassisSlots, setChassisSlots] = useState<ChassisSlot[]>(
    HUAWEI_OLT_DATASHEETS['MA5608T'].defaultSlots
  );
  const [box1Tab, setBox1Tab] = useState<Box1Tab>('onus');
  const [selectedPortFilter, setSelectedPortFilter] = useState<string>('ALL');
  const [selectedSlotNum, setSelectedSlotNum] = useState<number>(1);
  const [shutdownPorts, setShutdownPorts] = useState<Record<string, boolean>>({});

  // System / Hostname / Mgmt IP / NTP
  const [sysname, setSysname] = useState('HUAWEI-MA5608T-CORE');
  const [mgmtVlan, setMgmtVlan] = useState('100');
  const [mgmtIp, setMgmtIp] = useState(defaultHostIp || '10.99.0.10');
  const [mgmtMask, setMgmtMask] = useState('255.255.255.0');
  const [uplinkPort, setUplinkPort] = useState('0/0 0');
  const [ntpServer, setNtpServer] = useState('162.159.200.1');

  // ONUs & Auto-Find & Live Edit Modal
  const [onus, setOnus] = useState<HuaweiOnu[]>(INITIAL_ONUS);
  const [autoFindList, setAutoFindList] = useState<AutoFindOnu[]>(INITIAL_AUTOFIND);
  const [findQuery, setFindQuery] = useState('');
  const [findBy, setFindBy] = useState<'all' | 'sn' | 'mac'>('all');
  const [editingOnu, setEditingOnu] = useState<HuaweiOnu | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editLineProf, setEditLineProf] = useState('10');
  const [editSrvProf, setEditSrvProf] = useState('10');
  const [editEthPort, setEditEthPort] = useState('1');
  const [editEthVlan, setEditEthVlan] = useState('100');
  const [editEthPrio, setEditEthPrio] = useState('0');
  const [editEthAdmin, setEditEthAdmin] = useState<'on' | 'off'>('on');

  // Add ONU Form State
  const [addMode, setAddMode] = useState<HuaweiPonMode>('GPON');
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
  const [addTrafficIn, setAddTrafficIn] = useState('10');
  const [addTrafficOut, setAddTrafficOut] = useState('10');
  const [addNativeEth, setAddNativeEth] = useState(true);
  const [addUseQinq, setAddUseQinq] = useState(false);
  const [addInnerVlan, setAddInnerVlan] = useState('100');

  // Service-Ports State
  const [servicePorts, setServicePorts] = useState<HuaweiServicePort[]>(INITIAL_SERVICE_PORTS);
  const [spVlan, setSpVlan] = useState('100');
  const [spMode, setSpMode] = useState<'gpon' | 'epon' | 'xgpon'>('gpon');
  const [spFsp, setSpFsp] = useState('0/1/0');
  const [spOntId, setSpOntId] = useState('0');
  const [spGem, setSpGem] = useState('1');
  const [spUserVlan, setSpUserVlan] = useState('100');
  const [spTagTransform, setSpTagTransform] = useState<'translate' | 'transparent' | 'add-double'>('translate');
  const [spInnerVlan, setSpInnerVlan] = useState('100');
  const [spRxIdx, setSpRxIdx] = useState('10');
  const [spTxIdx, setSpTxIdx] = useState('10');
  const [editingSpIdx, setEditingSpIdx] = useState<number | null>(null);
  const [editSpRx, setEditSpRx] = useState('10');
  const [editSpTx, setEditSpTx] = useState('10');

  // Profiles & QoS State
  const [profileSubTab, setProfileSubTab] = useState<'dba' | 'line' | 'srv' | 'traffic'>('dba');
  const [dbaId, setDbaId] = useState('10');
  const [dbaName, setDbaName] = useState('DBA_1G_MAX');
  const [dbaType, setDbaType] = useState<'1' | '2' | '3' | '4' | '5'>('4');
  const [dbaFix, setDbaFix] = useState('10240');
  const [dbaAssure, setDbaAssure] = useState('51200');
  const [dbaMax, setDbaMax] = useState('1024000');

  const [lpMode, setLpMode] = useState<'gpon' | 'epon'>('gpon');
  const [lpId, setLpId] = useState('10');
  const [lpName, setLpName] = useState('LINE_PPPOE_100');
  const [lpTcont, setLpTcont] = useState('1');
  const [lpDbaRef, setLpDbaRef] = useState('10');
  const [lpGem, setLpGem] = useState('1');
  const [lpVlanList, setLpVlanList] = useState('100');

  const [srvMode, setSrvMode] = useState<'gpon' | 'epon'>('gpon');
  const [srvId, setSrvId] = useState('10');
  const [srvName, setSrvName] = useState('SRV_ETH4_PPPOE');
  const [srvEthCount, setSrvEthCount] = useState('4');
  const [srvPotsCount, setSrvPotsCount] = useState('0');
  const [srvPortMode, setSrvPortMode] = useState<'transparent' | 'translation'>('translation');
  const [srvVlan, setSrvVlan] = useState('100');

  const [ttIndex, setTtIndex] = useState('10');
  const [ttName, setTtName] = useState('PKG_100M');
  const [ttCir, setTtCir] = useState('51200');
  const [ttPir, setTtPir] = useState('102400');
  const [ttPriority, setTtPriority] = useState('0');

  // VLANs & Uplink State
  const [vlans, setVlans] = useState<HuaweiVlanItem[]>(INITIAL_VLANS);
  const [newVlanId, setNewVlanId] = useState('300');
  const [newVlanType, setNewVlanType] = useState<'smart' | 'mux' | 'standard' | 'super'>('smart');
  const [newVlanQinq, setNewVlanQinq] = useState(false);
  const [newVlanDesc, setNewVlanDesc] = useState('FTTH-VLAN-300');
  const [newVlanUplink, setNewVlanUplink] = useState('0/0 0');
  const [uplinkEthSlot, setUplinkEthSlot] = useState('0/0');
  const [uplinkEthPort, setUplinkEthPort] = useState('0');

  // Routes State
  const [routes, setRoutes] = useState<OltIpRoute[]>(INITIAL_ROUTES);
  const [newRouteDst, setNewRouteDst] = useState('172.16.0.0');
  const [newRouteMask, setNewRouteMask] = useState('255.255.0.0');
  const [newRouteGw, setNewRouteGw] = useState('10.99.0.1');
  const [newRoutePref, setNewRoutePref] = useState('60');
  const [newRouteComment, setNewRouteComment] = useState('POP Distribution Route');

  // Datasheet / Cheat Sheet Search State
  const [cheatSearch, setCheatSearch] = useState('');
  const [cheatCat, setCheatCat] = useState<string>('ALL');

  // Box 2: Live Bidirectional Telnet + Console State
  const [telnetHost, setTelnetHost] = useState(defaultHostIp || '10.99.0.10');
  const [telnetPort, setTelnetPort] = useState(23);
  const [telnetUser, setTelnetUser] = useState('root');
  const [telnetPass, setTelnetPass] = useState('admin');
  const [autoPushGui, setAutoPushGui] = useState(true);
  const [autoConfirmCr, setAutoConfirmCr] = useState(true);
  const [liveTelnetId, setLiveTelnetId] = useState<string | null>(null);
  const [promptMode, setPromptMode] = useState<HuaweiPromptMode>('unknown');
  const [telnetConnecting, setTelnetConnecting] = useState(false);
  const [pushingCli, setPushingCli] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lastOpticalTarget, setLastOpticalTarget] = useState<{ f: number; s: number; p: number; ontId: number } | null>(null);

  // Console Resizable Height & Font Size
  const [consoleHeight, setConsoleHeight] = useState<number>(460);
  const [consoleFontSize, setConsoleFontSize] = useState<number>(12);
  const resizingRef = useRef<{ startY: number; startH: number } | null>(null);

  const [lastGeneratedTitle, setLastGeneratedTitle] = useState('Huawei SmartAX OLT Ready');
  const [lastGeneratedCli, setLastGeneratedCli] = useState<string>(
    `enable\nscroll\nconfig\ndisplay board 0\ndisplay ont autofind all\ndisplay ont info 0 all\ndisplay ip routing-table`
  );

  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    {
      id: 'init_1',
      type: 'info',
      text: '  Huawei SmartAX MA5600T / MA5800 Bidirectional WebUI <-> Live Telnet Console',
    },
    {
      id: 'init_2',
      type: 'success',
      text: "  Auto-Push GUI ON · Auto-Confirm { <cr> } ON · Mid-command 'Tab' & '?' Ready.",
    },
    {
      id: 'init_3',
      type: 'info',
      text: '  ওয়েব ইন্টারফেসে কোনো ONU/Board/Service-Port/Profile/VLAN/Route পরিবর্তন করলে সাথে সাথেই লাইভ Telnet-এ পরিবর্তন হবে এবং OLT-এর আসল আউটপুট GUI-তে সিঙ্ক হবে।',
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [remoteBufferHint, setRemoteBufferHint] = useState('');

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const promptModeRef = useRef<HuaweiPromptMode>('unknown');
  const lastOpticalTargetRef = useRef<{ f: number; s: number; p: number; ontId: number } | null>(null);

  useEffect(() => {
    promptModeRef.current = promptMode;
  }, [promptMode]);

  useEffect(() => {
    lastOpticalTargetRef.current = lastOpticalTarget;
  }, [lastOpticalTarget]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  // Console drag-to-resize handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientY - resizingRef.current.startY;
      const nextH = Math.max(260, Math.min(820, resizingRef.current.startH + delta));
      setConsoleHeight(nextH);
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

  const handleModelSwitch = (nextModel: HuaweiOltModel) => {
    setOltModel(nextModel);
    const spec = HUAWEI_OLT_DATASHEETS[nextModel];
    setChassisSlots(spec.defaultSlots);
    const firstPon = spec.defaultSlots.find((s) => s.mode === 'GPON' || s.mode === 'EPON' || s.mode === 'XGS-PON');
    if (firstPon) {
      setSelectedSlotNum(firstPon.slot);
      setAddSlot(String(firstPon.slot));
    }
    const uplink = spec.defaultSlots.find((s) => s.mode === 'UPLINK' || s.mode === 'CTRL');
    if (uplink) {
      setUplinkPort(`0/${uplink.slot} 0`);
      setUplinkEthSlot(`0/${uplink.slot}`);
      setNewVlanUplink(`0/${uplink.slot} 0`);
    }
    setSelectedPortFilter('ALL');
    showToast(`Loaded ${nextModel} (${spec.series} · ${spec.switchingCapacity})`);
  };

  // =========================================================================
  // BIDIRECTIONAL LIVE TELNET OUTPUT PARSER (Real OLT -> WebUI Tables)
  // =========================================================================
  const tryParseLiveHuaweiOutput = (chunk: string) => {
    if (!chunk) return;
    const clean = chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

    // 1. Detect live Huawei prompt mode & sysname
    const detected = detectHuaweiPromptMode(clean);
    if (detected.mode) {
      setPromptMode(detected.mode);
      promptModeRef.current = detected.mode;
    }
    if (detected.sysname) {
      setSysname(detected.sysname);
    }

    // 2. Auto-handle Huawei "---- More ( Press 'Q' to break ) ----" paging
    if (/----\s*More\s*\(/i.test(clean) && liveTelnetId) {
      fetch(`/api/telnet/sessions/${liveTelnetId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: ' ', raw: true }),
      }).catch(() => {});
    }

    // 3. Auto-confirm "{ <cr>|... }:" interactive prompt if enabled
    if (autoConfirmCr && /\{\s*<cr>[^}]*\}\s*:/i.test(clean) && liveTelnetId) {
      fetch(`/api/telnet/sessions/${liveTelnetId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: '', raw: false }),
      }).catch(() => {});
    }

    // 4. Parse "display board 0" rows -> live chassis board sync
    const boardMatches = [
      ...clean.matchAll(
        /^\s*(\d{1,2})\s+([A-Z0-9]{3,12})\s+(Normal|Active_normal|Standby_normal|Auto_find|Failed|Offline)/gm
      ),
    ];
    if (boardMatches.length >= 2) {
      const parsedSlots: ChassisSlot[] = boardMatches.map((m) => {
        const slot = parseInt(m[1], 10);
        const board = m[2].toUpperCase();
        const rawStatus = m[3];
        const status: ChassisSlot['status'] =
          rawStatus === 'Active_normal'
            ? 'Active_normal'
            : rawStatus === 'Auto_find'
            ? 'Auto_find'
            : rawStatus === 'Normal' || rawStatus === 'Standby_normal'
            ? 'Normal'
            : 'Offline';
        let mode: ChassisSlot['mode'] = 'GPON';
        let role = 'PON Board';
        let ports = 8;
        if (/MCU|SCU|MPL/.test(board)) {
          mode = 'CTRL';
          role = 'Main Control';
          ports = 4;
        } else if (/X2CS|GIC|NXED|CIUA/.test(board)) {
          mode = 'UPLINK';
          role = '10G/100G Uplink';
          ports = 2;
        } else if (/EP/.test(board)) {
          mode = 'EPON';
          role = 'EPON Board';
          ports = 8;
        } else if (/XGH|CGH/.test(board)) {
          mode = 'XGS-PON';
          role = 'XGS-PON Board';
          ports = 8;
        } else {
          mode = 'GPON';
          role = 'GPON Board';
          ports = 8;
        }
        return { slot, board, role, mode, ports, status };
      });
      setChassisSlots(parsedSlots);
    }

    // 5. Parse "display ont autofind all"
    if (/Ont\s+SN\s*:/i.test(clean) && /F\/S\/P\s*:/i.test(clean)) {
      const fspMatches = [...clean.matchAll(/F\/S\/P\s*:\s*(\d+)\/(\d+)\/(\d+)/gi)];
      const snMatches = [...clean.matchAll(/Ont\s+SN\s*:\s*([A-Fa-f0-9]+)/gi)];
      const eqMatches = [...clean.matchAll(/Ont\s+EquipmentID\s*:\s*([^\r\n]+)/gi)];
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
          return [...parsed.filter((p) => !existingSns.has(p.sn)), ...prev];
        });
      }
    }

    // 6. Parse "display ont info 0 all" table rows -> sync real registered ONUs
    const ontRowMatches = [
      ...clean.matchAll(
        /^\s*(\d+)\/\s*(\d+)\/(\d+)\s+(\d+)\s+([A-Fa-f0-9-]{12,20})\s+(active|deactivated)\s+(online|offline)\s+/gm
      ),
    ];
    if (ontRowMatches.length > 0) {
      const liveOnus: HuaweiOnu[] = ontRowMatches.map((m) => {
        const frame = parseInt(m[1], 10);
        const slot = parseInt(m[2], 10);
        const port = parseInt(m[3], 10);
        const ontId = parseInt(m[4], 10);
        const sn = m[5].toUpperCase();
        const ctrlFlag = m[6].toLowerCase();
        const runState = m[7].toLowerCase();
        return {
          id: `live_onu_${frame}_${slot}_${port}_${ontId}`,
          frame,
          slot,
          port,
          ontId,
          mode: sn.includes('-') ? 'EPON' : 'GPON',
          sn,
          mac: sn.slice(-12).replace(/(.{4})(?=.)/g, '$1-').toLowerCase(),
          desc: `Live-ONT-${frame}/${slot}/${port}:${ontId}`,
          lineProfile: 10,
          srvProfile: 10,
          vlan: 100,
          gemPort: 1,
          status: ctrlFlag === 'deactivated' ? 'deactivated' : runState === 'online' ? 'online' : 'offline',
          rxPowerDbm: -19.5,
          distanceM: 1000,
        };
      });
      setOnus((prev) => {
        const map = new Map<string, HuaweiOnu>();
        prev.forEach((o) => map.set(`${o.frame}/${o.slot}/${o.port}:${o.ontId}`, o));
        liveOnus.forEach((lo) => {
          const key = `${lo.frame}/${lo.slot}/${lo.port}:${lo.ontId}`;
          const existing = map.get(key);
          map.set(key, existing ? { ...existing, sn: lo.sn, status: lo.status } : lo);
        });
        return Array.from(map.values());
      });
    }

    // 7. Parse "display ont optical-info" Rx dBm -> live update ONU optical power
    const rxMatch = clean.match(/Rx\s+optical\s+power\(dBm\)\s*:\s*([+-]?\d+(?:\.\d+)?)/i);
    if (rxMatch && lastOpticalTargetRef.current) {
      const rxVal = parseFloat(rxMatch[1]);
      const t = lastOpticalTargetRef.current;
      if (!Number.isNaN(rxVal)) {
        setOnus((prev) =>
          prev.map((o) =>
            o.frame === t.f && o.slot === t.s && o.port === t.p && o.ontId === t.ontId
              ? { ...o, rxPowerDbm: rxVal }
              : o
          )
        );
      }
    }

    // 8. Parse "display ip routing-table" Static routes
    const routeMatches = [
      ...clean.matchAll(
        /^\s*(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})\s+Static\s+(\d+)\s+\d+\s+\S+\s+(\d{1,3}(?:\.\d{1,3}){3})/gm
      ),
    ];
    if (routeMatches.length > 0) {
      const cidrToMask = (bits: number) => {
        if (bits <= 0) return '0.0.0.0';
        const mask = (~((1 << (32 - bits)) - 1)) >>> 0;
        return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join('.');
      };
      const parsedRoutes: OltIpRoute[] = routeMatches.map((m, idx) => ({
        id: `live_rt_${m[1]}_${m[2]}_${idx}`,
        destination: m[1],
        mask: cidrToMask(parseInt(m[2], 10)),
        preference: parseInt(m[3], 10) || 60,
        gateway: m[4],
        comment: 'Synced from Live OLT',
      }));
      setRoutes(parsedRoutes);
    }
  };

  // Real-time 300ms Telnet polling
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
          setPromptMode('unknown');
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
  }, [liveTelnetId, autoConfirmCr]);

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
        setPromptMode('unknown');
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
    setPromptMode('unknown');
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
        if (data.output) tryParseLiveHuaweiOutput(data.output);
        setConsoleLines((prev) => {
          const next: ConsoleLine[] = [
            ...prev,
            {
              id: `ok_${Date.now()}`,
              type: 'success',
              text: `  [LIVE HUAWEI OLT CONNECTED] ${hostClean}:${telnetPort} (${data.latencyMs}ms · Prompt Auto-Sync & { <cr> } Ready)`,
            },
          ];
          return data.output ? appendRawChunk(next, data.output) : next;
        });
        showToast(`Connected to Live Huawei OLT ${hostClean}`);
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
            text: `  টিপস: প্রাইভেট LAN/PPTP আইপি (${hostClean}) হলে Desktop App বা Android APK দিয়ে VPN চালু করে কানেক্ট করুন; আর অফলাইন মোডেও বাম পাশের GUI ও ডান পাশের CLI টেস্ট করতে পারবেন।`,
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
    setPromptMode('unknown');
    setRemoteBufferHint('');
    setConsoleLines((prev) => [
      ...prev,
      { id: `u_disc_${Date.now()}`, type: 'info', text: '  [Disconnected from Huawei OLT]' },
    ]);
  };

  /**
   * Core WebUI -> Live Telnet Execution Engine:
   * - Adapts commands cleanly to current live OLT prompt mode (user > / priv # / config / subview)
   * - Auto-sends extra <CR> for Huawei `{ <cr>|... }:` prompts when Auto-Confirm is ON
   */
  const pushCliScriptToOlt = async (title: string, script: string, forcePush = false) => {
    setLastGeneratedTitle(title);
    setLastGeneratedCli(script);

    const isLive = Boolean(liveTelnetId);
    const preparedLines = prepareHuaweiScriptForPrompt(script, promptModeRef.current, isLive);

    if (liveTelnetId && (autoPushGui || forcePush)) {
      setPushingCli(true);
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `push_hdr_${Date.now()}`,
          type: 'info',
          text: `\n  >>> [Live Push: ${title}] (${preparedLines.length} cmds · mode: ${promptModeRef.current})`,
        },
      ]);
      for (const cmd of preparedLines) {
        await sendRawToLiveOlt(cmd, false);
        await new Promise((r) => setTimeout(r, 260));
        // Auto-confirm Huawei `{ <cr>|... }:` interactive prompt
        if (autoConfirmCr && huaweiCommandNeedsCrConfirm(cmd)) {
          await sendRawToLiveOlt('', false);
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      setPushingCli(false);
      showToast(`Live Pushed: ${title}`);
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
          text: `\n  [WebUI -> Huawei CLI Generated: ${title}]`,
        },
        {
          id: `gen_body_${Date.now()}`,
          type: 'output',
          text: displayLines.map((l) => `  ${sysname}(config)# ${l}`).join('\n'),
        },
      ]);
      showToast(`${title} — Huawei CLI ready`);
    }
  };

  // =========================================================================
  // BOARD & PON PORT LIVE TELNET ACTIONS
  // =========================================================================
  const handleBoardAction = async (slot: ChassisSlot, action: 'confirm' | 'reset' | 'rogue') => {
    if (action === 'confirm') {
      setChassisSlots((prev) =>
        prev.map((s) => (s.slot === slot.slot ? { ...s, status: 'Normal' } : s))
      );
      await pushCliScriptToOlt(
        `Confirm Board 0/${slot.slot} (${slot.board})`,
        `enable\nconfig\nboard confirm 0/${slot.slot}`
      );
    } else if (action === 'reset') {
      await pushCliScriptToOlt(
        `Reset Board 0/${slot.slot} (${slot.board})`,
        `enable\nconfig\nboard reset 0/${slot.slot}`
      );
    } else if (action === 'rogue') {
      const modeStr = slot.mode === 'EPON' ? 'epon' : 'gpon';
      await pushCliScriptToOlt(
        `Rogue ONT Scan 0/${slot.slot}`,
        `enable\nconfig\ndisplay rogue-ont ${modeStr} 0/${slot.slot}`
      );
    }
  };

  const handlePonPortAction = async (
    slot: ChassisSlot,
    portNum: number,
    action: 'autofind' | 'ddm' | 'bulk-optical' | 'toggle-shutdown'
  ) => {
    const fsp = `0/${slot.slot}/${portNum}`;
    const iface = slot.mode === 'EPON' ? 'epon' : slot.mode === 'XGS-PON' ? 'xgpon' : 'gpon';
    if (action === 'autofind') {
      await pushCliScriptToOlt(
        `Enable Auto-Find on ${fsp}`,
        `enable\nconfig\ninterface ${iface} 0/${slot.slot}\nport ${portNum} ont-auto-find enable\nquit`
      );
    } else if (action === 'ddm') {
      await pushCliScriptToOlt(
        `OLT SFP DDM Info ${fsp}`,
        `enable\nconfig\ninterface ${iface} 0/${slot.slot}\ndisplay port ddm-info ${portNum}\nquit`
      );
    } else if (action === 'bulk-optical') {
      await pushCliScriptToOlt(
        `Bulk Optical Power Audit ${fsp}`,
        `enable\nconfig\ninterface ${iface} 0/${slot.slot}\ndisplay ont optical-info ${portNum} all\nquit`
      );
    } else if (action === 'toggle-shutdown') {
      const isDown = Boolean(shutdownPorts[fsp]);
      setShutdownPorts((prev) => ({ ...prev, [fsp]: !isDown }));
      const cmd = isDown ? `undo shutdown ${portNum}` : `shutdown ${portNum}`;
      await pushCliScriptToOlt(
        `${isDown ? 'Enable (No Shutdown)' : 'Shutdown'} PON Port ${fsp}`,
        `enable\nconfig\ninterface ${iface} 0/${slot.slot}\n${cmd}\nquit`
      );
    }
  };

  // =========================================================================
  // ONU PROVISIONING, LIVE EDIT, ACTIVATE/DEACTIVATE, FACTORY RESTORE, DELETE
  // =========================================================================
  const buildAddOnuCli = () => {
    const f = parseInt(addFrame, 10) || 0;
    const s = parseInt(addSlot, 10) || 1;
    const p = parseInt(addPort, 10) || 0;
    const ontIdToken = addOntId.trim().toLowerCase() === 'auto' || !addOntId.trim() ? '' : ` ${addOntId.trim()}`;
    const targetOntRef = ontIdToken.trim() || '0';
    const cleanId = addSnOrMac.trim().toUpperCase();
    const safeDesc = (addDesc.trim() || 'Client-ONU').replace(/\s+/g, '_');
    const lp = parseInt(addLineProfile, 10) || 10;
    const sp = parseInt(addSrvProfile, 10) || 10;
    const gem = parseInt(addGemPort, 10) || 1;
    const vlanId = parseInt(addVlan, 10) || 100;
    const inIdx = parseInt(addTrafficIn, 10) || 10;
    const outIdx = parseInt(addTrafficOut, 10) || 10;
    const iface = ponModeToCliInterface(addMode);

    const lines = ['enable', 'config', `interface ${iface} ${f}/${s}`];

    if (addMode === 'EPON') {
      const cleanMac = addSnOrMac.trim().toLowerCase();
      lines.push(
        `ont add ${p}${ontIdToken} mac-auth ${cleanMac} oam ont-lineprofile-id ${lp} ont-srvprofile-id ${sp} desc "${safeDesc}"`
      );
      if (addNativeEth) {
        lines.push(`ont port native-vlan ${p} ${targetOntRef} eth 1 vlan ${vlanId}`);
      }
      lines.push('quit');
      const spLine = addUseQinq
        ? `service-port vlan ${vlanId} epon ${f}/${s}/${p} ont ${targetOntRef} multi-service user-vlan ${addInnerVlan} tag-transform add-double inner-vlan ${addInnerVlan} inbound traffic-table index ${inIdx} outbound traffic-table index ${outIdx}`
        : `service-port vlan ${vlanId} epon ${f}/${s}/${p} ont ${targetOntRef} multi-service user-vlan ${vlanId} tag-transform translate inbound traffic-table index ${inIdx} outbound traffic-table index ${outIdx}`;
      lines.push(spLine);
    } else {
      lines.push(
        `ont add ${p}${ontIdToken} sn-auth "${cleanId}" omci ont-lineprofile-id ${lp} ont-srvprofile-id ${sp} desc "${safeDesc}"`
      );
      if (addNativeEth) {
        lines.push(`ont port native-vlan ${p} ${targetOntRef} eth 1 vlan ${vlanId} priority 0`);
      }
      lines.push('quit');
      const spLine = addUseQinq
        ? `service-port vlan ${vlanId} ${iface} ${f}/${s}/${p} ont ${targetOntRef} gemport ${gem} multi-service user-vlan ${addInnerVlan} tag-transform add-double inner-vlan ${addInnerVlan} inbound traffic-table index ${inIdx} outbound traffic-table index ${outIdx}`
        : `service-port vlan ${vlanId} ${iface} ${f}/${s}/${p} ont ${targetOntRef} gemport ${gem} multi-service user-vlan ${vlanId} tag-transform translate inbound traffic-table index ${inIdx} outbound traffic-table index ${outIdx}`;
      lines.push(spLine);
    }

    return lines.join('\n');
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
      sn: addMode === 'EPON' ? cleanVal.replace(/[:-]/g, '').toUpperCase() : cleanVal.toUpperCase(),
      mac:
        addMode === 'EPON'
          ? cleanVal.toLowerCase()
          : cleanVal.slice(-12).replace(/(.{4})(?=.)/g, '$1-').toLowerCase(),
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
    setAutoFindList((prev) =>
      prev.filter(
        (af) =>
          af.sn.toUpperCase() !== newOnu.sn.toUpperCase() &&
          af.mac.toLowerCase() !== newOnu.mac.toLowerCase()
      )
    );

    const nextSpIndex = servicePorts.length > 0 ? Math.max(...servicePorts.map((x) => x.index)) + 1 : 100;
    setServicePorts((prev) => [
      {
        index: nextSpIndex,
        vlan: parseInt(addVlan, 10) || 100,
        innerVlan: addUseQinq ? parseInt(addInnerVlan, 10) || 100 : undefined,
        mode: ponModeToCliInterface(addMode),
        fsp: `${f}/${s}/${p}`,
        ontId: nextOntId,
        gemPort: parseInt(addGemPort, 10) || 1,
        userVlan: addUseQinq ? addInnerVlan : addVlan,
        tagTransform: addUseQinq ? 'add-double' : 'translate',
        rxTrafficIdx: parseInt(addTrafficIn, 10) || 10,
        txTrafficIdx: parseInt(addTrafficOut, 10) || 10,
        state: 'up',
      },
      ...prev,
    ]);

    const cli = buildAddOnuCli();
    await pushCliScriptToOlt(`Add ${addMode} ONU ${f}/${s}/${p}:${nextOntId} (${newOnu.desc})`, cli);
    setBox1Tab('onus');
  };

  const openEditOnu = (onu: HuaweiOnu) => {
    setEditingOnu(onu);
    setEditDesc(onu.desc);
    setEditLineProf(String(onu.lineProfile));
    setEditSrvProf(String(onu.srvProfile));
    setEditEthPort('1');
    setEditEthVlan(String(onu.vlan));
    setEditEthPrio('0');
    setEditEthAdmin('on');
  };

  const handleSaveEditOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOnu) return;
    const safeDesc = (editDesc.trim() || editingOnu.desc).replace(/\s+/g, '_');
    const lp = parseInt(editLineProf, 10) || editingOnu.lineProfile;
    const sp = parseInt(editSrvProf, 10) || editingOnu.srvProfile;
    const ethVlan = parseInt(editEthVlan, 10) || editingOnu.vlan;
    const iface = ponModeToCliInterface(editingOnu.mode);

    setOnus((prev) =>
      prev.map((o) =>
        o.id === editingOnu.id
          ? { ...o, desc: safeDesc, lineProfile: lp, srvProfile: sp, vlan: ethVlan }
          : o
      )
    );

    const cli = [
      'enable',
      'config',
      `interface ${iface} ${editingOnu.frame}/${editingOnu.slot}`,
      `ont modify ${editingOnu.port} ${editingOnu.ontId} desc "${safeDesc}"`,
      `ont modify ${editingOnu.port} ${editingOnu.ontId} ont-lineprofile-id ${lp}`,
      `ont modify ${editingOnu.port} ${editingOnu.ontId} ont-srvprofile-id ${sp}`,
      `ont port native-vlan ${editingOnu.port} ${editingOnu.ontId} eth ${editEthPort} vlan ${ethVlan} priority ${editEthPrio}`,
      `ont port attribute ${editingOnu.port} ${editingOnu.ontId} eth ${editEthPort} operational-state ${editEthAdmin}`,
      'quit',
    ].join('\n');

    await pushCliScriptToOlt(
      `Modify ONU ${editingOnu.frame}/${editingOnu.slot}/${editingOnu.port}:${editingOnu.ontId} (${safeDesc})`,
      cli
    );
    setEditingOnu(null);
  };

  const handleToggleOnuActive = async (onu: HuaweiOnu) => {
    const iface = ponModeToCliInterface(onu.mode);
    const isDeactivated = onu.status === 'deactivated';
    const nextStatus = isDeactivated ? 'online' : 'deactivated';
    setOnus((prev) => prev.map((o) => (o.id === onu.id ? { ...o, status: nextStatus } : o)));
    const cmd = isDeactivated
      ? `ont activate ${onu.port} ${onu.ontId}`
      : `ont deactivate ${onu.port} ${onu.ontId}`;
    await pushCliScriptToOlt(
      `${isDeactivated ? 'Activate' : 'Deactivate'} ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`,
      `enable\nconfig\ninterface ${iface} ${onu.frame}/${onu.slot}\n${cmd}\nquit`
    );
  };

  const handleDeleteOnu = async (onu: HuaweiOnu) => {
    setOnus((prev) => prev.filter((x) => x.id !== onu.id));
    const iface = ponModeToCliInterface(onu.mode);
    const cli = [
      'enable',
      'config',
      `undo service-port port ${onu.frame}/${onu.slot}/${onu.port} ont ${onu.ontId}`,
      `interface ${iface} ${onu.frame}/${onu.slot}`,
      `ont delete ${onu.port} ${onu.ontId}`,
      'quit',
    ].join('\n');
    await pushCliScriptToOlt(`Delete ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId} (${onu.sn})`, cli);
  };

  const handleOnuQuickAction = async (
    onu: HuaweiOnu,
    action: 'optical' | 'mac' | 'ports' | 'reboot' | 'factory-restore'
  ) => {
    const iface = ponModeToCliInterface(onu.mode);
    if (action === 'optical') {
      setLastOpticalTarget({ f: onu.frame, s: onu.slot, p: onu.port, ontId: onu.ontId });
      const cli = `enable\nconfig\ninterface ${iface} ${onu.frame}/${onu.slot}\ndisplay ont optical-info ${onu.port} ${onu.ontId}\nquit`;
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
    } else if (action === 'ports') {
      const cli = `enable\nconfig\ninterface ${iface} ${onu.frame}/${onu.slot}\ndisplay ont port state ${onu.port} ${onu.ontId} eth-port all\nquit`;
      await pushCliScriptToOlt(`UNI ETH Port State ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
    } else if (action === 'mac') {
      const cli = `display mac-address port ${onu.frame}/${onu.slot}/${onu.port} ont ${onu.ontId}`;
      await pushCliScriptToOlt(`MAC Table ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
      if (!liveTelnetId) {
        setConsoleLines((prev) => [
          ...prev,
          {
            id: `mac_${Date.now()}`,
            type: 'output',
            text: `  SRV-P  VLAN  MAC-Address     PORT-TYPE  F/S/P    ONT-ID\n  102    ${onu.vlan}   ${onu.mac}  ${iface}       ${onu.frame}/${onu.slot}/${onu.port}    ${onu.ontId}`,
          },
        ]);
      }
    } else if (action === 'reboot') {
      const cli = `enable\nconfig\ninterface ${iface} ${onu.frame}/${onu.slot}\nont reset ${onu.port} ${onu.ontId}\nquit`;
      await pushCliScriptToOlt(`Reboot ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
    } else if (action === 'factory-restore') {
      const cli = `enable\nconfig\ninterface ${iface} ${onu.frame}/${onu.slot}\nont factory-setting-restore ${onu.port} ${onu.ontId}\nquit`;
      await pushCliScriptToOlt(`Factory Restore ONU ${onu.frame}/${onu.slot}/${onu.port}:${onu.ontId}`, cli);
    }
  };

  const handleRunAutoFindScan = async () => {
    await pushCliScriptToOlt('Scan Unregistered ONUs (Auto-Find)', 'display ont autofind all');
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
    setAddSnOrMac(af.mode === 'EPON' ? af.mac : af.sn);
    setAddDesc(`${af.equipmentId}-${af.sn.slice(-4)}`);
    setBox1Tab('add-onu');
    showToast(`Loaded ${af.sn} into Add ONU form`);
  };

  // =========================================================================
  // SERVICE-PORTS, PROFILES, VLANS, SYSTEM & ROUTES LIVE TELNET HANDLERS
  // =========================================================================
  const handleCreateServicePort = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextIdx = servicePorts.length > 0 ? Math.max(...servicePorts.map((x) => x.index)) + 1 : 100;
    const item: HuaweiServicePort = {
      index: nextIdx,
      vlan: parseInt(spVlan, 10) || 100,
      innerVlan: spTagTransform === 'add-double' ? parseInt(spInnerVlan, 10) || 100 : undefined,
      mode: spMode,
      fsp: spFsp.trim() || '0/1/0',
      ontId: parseInt(spOntId, 10) || 0,
      gemPort: parseInt(spGem, 10) || 1,
      userVlan: spUserVlan.trim() || '100',
      tagTransform: spTagTransform,
      rxTrafficIdx: parseInt(spRxIdx, 10) || 10,
      txTrafficIdx: parseInt(spTxIdx, 10) || 10,
      state: 'up',
    };
    setServicePorts((prev) => [item, ...prev]);

    const gemPart = item.mode === 'epon' ? '' : ` gemport ${item.gemPort}`;
    const transformPart =
      item.tagTransform === 'add-double'
        ? `tag-transform add-double inner-vlan ${item.innerVlan || item.userVlan}`
        : `tag-transform ${item.tagTransform}`;
    const cli = [
      'enable',
      'config',
      `service-port vlan ${item.vlan} ${item.mode} ${item.fsp} ont ${item.ontId}${gemPart} multi-service user-vlan ${item.userVlan} ${transformPart} inbound traffic-table index ${item.rxTrafficIdx} outbound traffic-table index ${item.txTrafficIdx}`,
    ].join('\n');
    await pushCliScriptToOlt(`Create Service-Port VLAN ${item.vlan} (${item.fsp}:${item.ontId})`, cli);
  };

  const handleModifyServicePortTraffic = async (sp: HuaweiServicePort) => {
    const rx = parseInt(editSpRx, 10) || sp.rxTrafficIdx;
    const tx = parseInt(editSpTx, 10) || sp.txTrafficIdx;
    setServicePorts((prev) =>
      prev.map((x) => (x.index === sp.index ? { ...x, rxTrafficIdx: rx, txTrafficIdx: tx } : x))
    );
    setEditingSpIdx(null);
    const cli = [
      'enable',
      'config',
      `service-port ${sp.index} inbound traffic-table index ${rx} outbound traffic-table index ${tx}`,
    ].join('\n');
    await pushCliScriptToOlt(`Update Service-Port #${sp.index} QoS (In:${rx}/Out:${tx})`, cli);
  };

  const handleDeleteServicePort = async (sp: HuaweiServicePort) => {
    setServicePorts((prev) => prev.filter((x) => x.index !== sp.index));
    await pushCliScriptToOlt(
      `Delete Service-Port #${sp.index}`,
      `enable\nconfig\nundo service-port ${sp.index}`
    );
  };

  const handlePushDbaProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    let bwArgs = `max ${dbaMax}`;
    if (dbaType === '1') bwArgs = `fix ${dbaFix}`;
    else if (dbaType === '2') bwArgs = `assure ${dbaAssure}`;
    else if (dbaType === '3') bwArgs = `assure ${dbaAssure} max ${dbaMax}`;
    else if (dbaType === '4') bwArgs = `max ${dbaMax}`;
    else if (dbaType === '5') bwArgs = `fix ${dbaFix} assure ${dbaAssure} max ${dbaMax}`;

    const cli = [
      'enable',
      'config',
      `dba-profile add profile-id ${dbaId} profile-name "${dbaName.trim() || 'DBA_PROF'}" type${dbaType} ${bwArgs}`,
    ].join('\n');
    await pushCliScriptToOlt(`Create DBA Profile #${dbaId} (Type ${dbaType})`, cli);
  };

  const handlePushLineProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli =
      lpMode === 'gpon'
        ? [
            'enable',
            'config',
            `ont-lineprofile gpon profile-id ${lpId} profile-name "${lpName.trim() || 'LINE_PROF'}"`,
            `tcont ${lpTcont} dba-profile-id ${lpDbaRef}`,
            `gem add ${lpGem} eth tcont ${lpTcont}`,
            `gem mapping ${lpGem} 0 vlan ${lpVlanList.trim() || '100'}`,
            'commit',
            'quit',
          ].join('\n')
        : [
            'enable',
            'config',
            `ont-lineprofile epon profile-id ${lpId} profile-name "${lpName.trim() || 'EPON_LINE'}"`,
            `llid dba-profile-id ${lpDbaRef}`,
            'commit',
            'quit',
          ].join('\n');
    await pushCliScriptToOlt(`Create ${lpMode.toUpperCase()} Line Profile #${lpId}`, cli);
  };

  const handlePushSrvProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const portVlanLine =
      srvPortMode === 'transparent'
        ? `port vlan eth 1 transparent`
        : `port vlan eth 1 translation ${srvVlan} user-vlan ${srvVlan}`;
    const cli = [
      'enable',
      'config',
      `ont-srvprofile ${srvMode} profile-id ${srvId} profile-name "${srvName.trim() || 'SRV_PROF'}"`,
      `ont-port eth ${srvEthCount} pots ${srvPotsCount}`,
      portVlanLine,
      'commit',
      'quit',
    ].join('\n');
    await pushCliScriptToOlt(`Create ${srvMode.toUpperCase()} Service Profile #${srvId}`, cli);
  };

  const handlePushTrafficTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      'enable',
      'config',
      `traffic table ip index ${ttIndex} name "${ttName.trim() || 'TRAFFIC_IP'}" cir ${ttCir} pir ${ttPir} priority ${ttPriority} priority-policy local-setting`,
    ].join('\n');
    await pushCliScriptToOlt(`Create IP Traffic Table #${ttIndex} (${ttPir} kbps)`, cli);
  };

  const handleCreateVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const vid = parseInt(newVlanId, 10);
    if (!vid || vid < 1 || vid > 4094) return;
    const item: HuaweiVlanItem = {
      id: vid,
      type: newVlanType,
      qinq: newVlanQinq,
      desc: newVlanDesc.trim() || `VLAN-${vid}`,
      uplinkTagged: newVlanUplink.trim() || '0/0 0',
    };
    setVlans((prev) => [item, ...prev.filter((v) => v.id !== vid)]);
    const lines = ['enable', 'config', `vlan ${vid} ${item.type}`];
    if (item.qinq) lines.push(`vlan attrib ${vid} q-in-q`);
    lines.push(`vlan desc ${vid} description "${item.desc}"`);
    if (item.uplinkTagged) lines.push(`port vlan ${vid} ${item.uplinkTagged}`);
    await pushCliScriptToOlt(`Create VLAN ${vid} (${item.type}${item.qinq ? ' QinQ' : ''})`, lines.join('\n'));
  };

  const handleDeleteVlan = async (v: HuaweiVlanItem) => {
    setVlans((prev) => prev.filter((x) => x.id !== v.id));
    const lines = ['enable', 'config'];
    if (v.uplinkTagged) lines.push(`undo port vlan ${v.id} ${v.uplinkTagged}`);
    lines.push(`undo vlan ${v.id}`);
    await pushCliScriptToOlt(`Delete VLAN ${v.id}`, lines.join('\n'));
  };

  const handleUplinkAdmin = async (state: 'up' | 'down') => {
    const cmd = state === 'down' ? `shutdown ${uplinkEthPort}` : `undo shutdown ${uplinkEthPort}`;
    await pushCliScriptToOlt(
      `Uplink ETH ${uplinkEthSlot}/${uplinkEthPort} -> ${state.toUpperCase()}`,
      `enable\nconfig\ninterface eth ${uplinkEthSlot}\n${cmd}\nquit`
    );
  };

  const handleApplyHostnameAndIp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sysname.trim().replace(/\s+/g, '-') || 'HUAWEI-OLT';
    setSysname(cleanName);
    const lines = [
      'enable',
      'config',
      `sysname ${cleanName}`,
      `vlan ${mgmtVlan} smart`,
      `port vlan ${mgmtVlan} ${uplinkPort}`,
      `interface vlanif ${mgmtVlan}`,
      `ip address ${mgmtIp.trim()} ${mgmtMask.trim()}`,
      'quit',
    ];
    if (ntpServer.trim()) {
      lines.push(`ntp-service unicast-server ${ntpServer.trim()}`);
    }
    lines.push('save');
    await pushCliScriptToOlt(`Apply System (${cleanName} / ${mgmtIp})`, lines.join('\n'));
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
    await pushCliScriptToOlt(
      `Delete IP Route ${route.destination}`,
      `enable\nconfig\nundo ip route-static ${route.destination} ${route.mask} ${route.gateway}`
    );
  };

  // =========================================================================
  // BOX 2: INTERACTIVE MID-COMMAND '?' HELP & 'Tab' AUTOCOMPLETE ENGINE
  // =========================================================================
  const activePrompt = liveTelnetId
    ? `${sysname}${promptMode === 'config' ? '(config)#' : promptMode === 'subview' ? '(config-if)#' : promptMode === 'priv' ? '#' : '>'} `
    : `${sysname}(config)# `;

  const handleQuestionHelp = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputVal;
    if (liveTelnetId) {
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
      const rawPayload = `${inputVal}\t`;
      setRemoteBufferHint((prev) => `${prev}${inputVal}`);
      setInputVal('');
      await sendRawToLiveOlt(rawPayload, true);
      inputRef.current?.focus();
      return;
    }

    const tabRes = getCliTabCompletion('Huawei', inputVal);
    if (tabRes.changed) setInputVal(tabRes.completed);
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
            : `  F/S/P   ID  Mode    SN / MAC              Rx(dBm)  Status       Description\n  --------------------------------------------------------------------------------\n` +
              filtered
                .map(
                  (o) =>
                    `  ${o.frame}/${o.slot}/${o.port}   ${String(o.ontId).padEnd(3)} ${o.mode.padEnd(7)} ${(o.mode === 'EPON' ? o.mac : o.sn).padEnd(21)} ${o.rxPowerDbm.toFixed(2).padEnd(8)} ${o.status.padEnd(12)} ${o.desc}`
                )
                .join('\n'),
      });
    } else if (lower.includes('display service-port')) {
      appended.push({
        id: `sp_${Date.now()}`,
        type: 'output',
        text:
          `  INDEX  VLAN  F/S/P  ONT  GEM  USER-VLAN  TRANSFORM   RX/TX  STATE\n  -----------------------------------------------------------------\n` +
          servicePorts
            .map(
              (s) =>
                `  ${String(s.index).padEnd(6)} ${String(s.vlan).padEnd(5)} ${s.fsp.padEnd(6)} ${String(s.ontId).padEnd(4)} ${String(s.gemPort).padEnd(4)} ${s.userVlan.padEnd(10)} ${s.tagTransform.padEnd(11)} ${s.rxTrafficIdx}/${s.txTrafficIdx}  ${s.state}`
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
          chassisSlots
            .map((s) => `  ${String(s.slot).padEnd(7)} ${s.board.padEnd(10)} ${s.status.padEnd(15)} ${s.role}`)
            .join('\n'),
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
        appended.push({
          id: `r_ok_${Date.now()}`,
          type: 'success',
          text: `  Static route ${created.destination} -> ${created.gateway} added to graphical IP Routes table.`,
        });
      }
    } else if (lower === 'save') {
      appended.push({ id: `sv_${Date.now()}`, type: 'success', text: '  Configuration saved to flash successfully.' });
    } else {
      const hint = getCliHelp('Huawei', trimmed);
      appended.push({
        id: `unk_${Date.now()}`,
        type: 'info',
        text:
          hint.matches.length > 0
            ? `  Matching Huawei OLT subcommands:\n${hint.formatted}`
            : `  Command sent: "${trimmed}" — Press '?' or 'Tab' mid-command for Huawei OLT CLI help.`,
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

  // Derived data
  const activeSpec = HUAWEI_OLT_DATASHEETS[oltModel];
  const activeSlotObj = chassisSlots.find((s) => s.slot === selectedSlotNum) || chassisSlots[0];
  const selectedPortNumber =
    selectedPortFilter !== 'ALL' ? parseInt(selectedPortFilter.split('/')[2] || '0', 10) : null;

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

  const cheatCategories = [
    'ALL',
    ...Array.from(new Set(HUAWEI_OFFICIAL_CHEATSHEET.map((c) => c.category))),
  ];
  const filteredCheatSheet = HUAWEI_OFFICIAL_CHEATSHEET.filter((item) => {
    if (cheatCat !== 'ALL' && item.category !== cheatCat) return false;
    const q = cheatSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.command.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const suggestionBasis = liveTelnetId ? `${remoteBufferHint}${inputVal}` : inputVal;
  const huaweiSuggestions = getCliSuggestions('Huawei', suggestionBasis);
  const onlineCount = onus.filter((o) => o.status === 'online').length;
  const issueCount = onus.filter((o) => o.status !== 'online').length;

  const promptModeLabel: Record<HuaweiPromptMode, string> = {
    unknown: 'Detecting',
    user: 'User >',
    priv: 'Priv #',
    config: 'Config (config)#',
    subview: 'Sub-View (config-if)#',
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Model Selector + Datasheet Metrics + Quick Save */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-black tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-black shrink-0" />
            <span>Huawei SmartAX OLT WebUI &amp; Bidirectional Live Telnet</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {activeSpec.series} · {activeSpec.heightU} · {activeSpec.controlBoard} · Max {activeSpec.maxOnts} · {activeSpec.switchingCapacity}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={oltModel}
            onChange={(e) => handleModelSwitch(e.target.value as HuaweiOltModel)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
          >
            {(Object.keys(HUAWEI_OLT_DATASHEETS) as HuaweiOltModel[]).map((m) => (
              <option key={m} value={m}>
                Huawei {m} ({HUAWEI_OLT_DATASHEETS[m].heightU})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              pushCliScriptToOlt(
                'Confirm All Auto-Find Boards',
                'enable\nconfig\nboard confirm 0'
              )
            }
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Confirm Boards</span>
          </button>

          <button
            type="button"
            onClick={() => pushCliScriptToOlt('Save OLT Configuration to Flash', 'save')}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Flash</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* DUAL-BOX WORKBENCH: BOX 1 (WEBUI) + BOX 2 (LIVE BIDIRECTIONAL TELNET) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ================================================================= */}
        {/* BOX 1: HUAWEI OLT FULL GRAPHICAL WEB INTERFACE                    */}
        {/* ================================================================= */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Identity & Inline KPI Strip */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-black flex items-center gap-2 truncate">
                <span className="font-mono">{sysname}</span>
                <span className="text-xs font-mono text-slate-500 font-normal">({oltModel})</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 mt-0.5 tabular-nums">
                Vlanif{mgmtVlan}: <strong className="text-black">{mgmtIp}</strong> · Online:{' '}
                <strong className="text-emerald-700">{onlineCount}</strong> · Offline/LOS:{' '}
                <strong className="text-red-700">{issueCount}</strong> · Auto-Find:{' '}
                <strong className="text-amber-700">{autoFindList.length}</strong> · Srv-Ports:{' '}
                <strong className="text-black">{servicePorts.length}</strong>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-600 flex items-center gap-2 shrink-0">
              {liveTelnetId ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  Live Telnet Synced
                </span>
              ) : (
                <span className="text-slate-500">Offline CLI Builder</span>
              )}
            </div>
          </div>

          {/* Interactive Chassis Slots & PON Port Live Control Strip */}
          <div className="px-4 py-3 border-b border-slate-200 space-y-2.5 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                  Chassis 0:
                </span>
                {chassisSlots.map((slot) => {
                  const isSel = slot.slot === selectedSlotNum;
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      onClick={() => {
                        setSelectedSlotNum(slot.slot);
                        if (slot.mode === 'GPON' || slot.mode === 'EPON' || slot.mode === 'XGS-PON') {
                          setAddSlot(String(slot.slot));
                          setAddMode(slot.mode === 'XGS-PON' ? 'XGS-PON' : slot.mode);
                        }
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition border whitespace-nowrap ${
                        isSel
                          ? 'bg-black text-white border-black font-bold'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      0/{slot.slot} {slot.board}
                      <span className={`ml-1 text-[10px] ${isSel ? 'text-slate-300' : 'text-slate-500'}`}>
                        ({slot.status === 'Active_normal' ? 'ACT' : slot.status === 'Auto_find' ? 'NEW' : 'OK'})
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeSlotObj && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleBoardAction(activeSlotObj, 'confirm')}
                    className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-slate-100 text-black border border-slate-300 whitespace-nowrap cursor-pointer"
                    title={`board confirm 0/${activeSlotObj.slot}`}
                  >
                    Confirm 0/{activeSlotObj.slot}
                  </button>
                  {(activeSlotObj.mode === 'GPON' || activeSlotObj.mode === 'EPON' || activeSlotObj.mode === 'XGS-PON') && (
                    <button
                      type="button"
                      onClick={() => handleBoardAction(activeSlotObj, 'rogue')}
                      className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 whitespace-nowrap cursor-pointer"
                      title={`display rogue-ont gpon 0/${activeSlotObj.slot}`}
                    >
                      Rogue Scan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleBoardAction(activeSlotObj, 'reset')}
                    className="px-2 py-1 rounded text-[11px] font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 whitespace-nowrap cursor-pointer"
                    title={`board reset 0/${activeSlotObj.slot}`}
                  >
                    Reset Board
                  </button>
                </div>
              )}
            </div>

            {/* Clickable PON Ports for Selected Slot + Live Port Controls */}
            {activeSlotObj && activeSlotObj.ports > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPortFilter('ALL')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer ${
                      selectedPortFilter === 'ALL'
                        ? 'bg-black text-white border-black font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    All Ports
                  </button>
                  {Array.from({ length: activeSlotObj.ports }).map((_, pIdx) => {
                    const fsp = `0/${activeSlotObj.slot}/${pIdx}`;
                    const count = onus.filter((o) => `${o.frame}/${o.slot}/${o.port}` === fsp).length;
                    const isDown = Boolean(shutdownPorts[fsp]);
                    const isActive = selectedPortFilter === fsp;
                    return (
                      <button
                        key={fsp}
                        type="button"
                        onClick={() => {
                          setSelectedPortFilter(fsp);
                          setAddSlot(String(activeSlotObj.slot));
                          setAddPort(String(pIdx));
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border cursor-pointer transition ${
                          isActive
                            ? 'bg-black text-white border-black font-bold'
                            : isDown
                            ? 'bg-red-50 text-red-700 border-red-200 line-through'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        P{pIdx} ({count})
                      </button>
                    );
                  })}
                </div>

                {selectedPortNumber !== null &&
                  (activeSlotObj.mode === 'GPON' || activeSlotObj.mode === 'EPON' || activeSlotObj.mode === 'XGS-PON') && (
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePonPortAction(activeSlotObj, selectedPortNumber, 'autofind')}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 cursor-pointer whitespace-nowrap"
                      >
                        Auto-Find ON
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePonPortAction(activeSlotObj, selectedPortNumber, 'ddm')}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 cursor-pointer whitespace-nowrap"
                      >
                        SFP DDM
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePonPortAction(activeSlotObj, selectedPortNumber, 'bulk-optical')}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 cursor-pointer whitespace-nowrap"
                      >
                        Port Optics
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePonPortAction(activeSlotObj, selectedPortNumber, 'toggle-shutdown')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                          shutdownPorts[selectedPortFilter]
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        {shutdownPorts[selectedPortFilter] ? 'No Shutdown' : 'Shutdown'}
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* 7 Clean Graphical Management Tabs */}
          <div className="px-3 pt-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'onus', label: 'ONUs & Edit', icon: Wifi },
                { id: 'add-onu', label: '+ Add ONU', icon: Plus },
                { id: 'service-ports', label: 'Service-Ports', icon: Layers },
                { id: 'profiles', label: 'Profiles & QoS', icon: Gauge },
                { id: 'vlans', label: 'VLANs & Uplink', icon: Cable },
                { id: 'system', label: 'System & Routes', icon: Route },
                { id: 'cheatsheet', label: 'Datasheet & CLI', icon: BookOpen },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = box1Tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBox1Tab(t.id)}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer transition ${
                    active
                      ? 'border-black text-black bg-white rounded-t-md'
                      : 'border-transparent text-slate-600 hover:text-black'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT BODY */}
          <div className="p-4">
            {/* ============================================================= */}
            {/* TAB 1: REGISTERED ONUS, AUTO-FIND QUEUE & LIVE EDIT MODAL     */}
            {/* ============================================================= */}
            {box1Tab === 'onus' && (
              <div className="space-y-4">
                {/* Search / Find by SN or MAC + Auto-Find Scan */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={findQuery}
                      onChange={(e) => setFindQuery(e.target.value)}
                      placeholder="Find ONU by SN, MAC, Description, or 0/1/0..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <select
                    value={findBy}
                    onChange={(e) => setFindBy(e.target.value as 'all' | 'sn' | 'mac')}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-black"
                  >
                    <option value="all">All</option>
                    <option value="sn">By SN</option>
                    <option value="mac">By MAC</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleFindBySnOrMacCli}
                    className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Find on OLT
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAutoFindScan}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Find</span>
                  </button>
                </div>

                {/* Live Edit ONU Panel (When Editing an ONU) */}
                {editingOnu && (
                  <form
                    onSubmit={handleSaveEditOnu}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-300 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-black font-mono">
                        Live Edit ONU {editingOnu.frame}/{editingOnu.slot}/{editingOnu.port}:{editingOnu.ontId} ({editingOnu.sn})
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingOnu(null)}
                        className="p-1 text-slate-500 hover:text-black cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <label className="col-span-2 block">
                        <span className="text-[11px] font-semibold text-slate-600">Description (ont modify desc)</span>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">Line Profile ID</span>
                        <input
                          type="number"
                          value={editLineProf}
                          onChange={(e) => setEditLineProf(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">Srv Profile ID</span>
                        <input
                          type="number"
                          value={editSrvProf}
                          onChange={(e) => setEditSrvProf(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">UNI ETH Port</span>
                        <select
                          value={editEthPort}
                          onChange={(e) => setEditEthPort(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        >
                          <option value="1">ETH 1</option>
                          <option value="2">ETH 2</option>
                          <option value="3">ETH 3</option>
                          <option value="4">ETH 4</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">Native VLAN</span>
                        <input
                          type="number"
                          value={editEthVlan}
                          onChange={(e) => setEditEthVlan(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">802.1p Priority</span>
                        <input
                          type="number"
                          min={0}
                          max={7}
                          value={editEthPrio}
                          onChange={(e) => setEditEthPrio(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600">ETH Admin State</span>
                        <select
                          value={editEthAdmin}
                          onChange={(e) => setEditEthAdmin(e.target.value as 'on' | 'off')}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        >
                          <option value="on">ON (Enabled)</option>
                          <option value="off">OFF (Shutdown)</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingOnu(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Apply Changes to Live Telnet</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Auto-Find Discovered Queue */}
                {autoFindList.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-amber-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-950">
                        Unregistered ONTs in Auto-Find Queue ({autoFindList.length})
                      </span>
                      <span className="text-[11px] font-mono text-amber-800">display ont autofind all</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {autoFindList.map((af) => (
                        <div
                          key={af.id}
                          className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50"
                        >
                          <div className="font-mono text-slate-800">
                            <strong className="text-black">{af.frame}/{af.slot}/{af.port}</strong> · {af.mode} ·{' '}
                            <strong className="text-black">{af.mode === 'EPON' ? af.mac : af.sn}</strong> ·{' '}
                            <span className="text-slate-600">{af.equipmentId} ({af.foundAt})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePrefillFromAutoFind(af)}
                            className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold whitespace-nowrap cursor-pointer"
                          >
                            + Register ONU
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registered ONUs Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 font-semibold">
                        <th className="py-2 px-2.5">F/S/P:ID</th>
                        <th className="py-2 px-2.5">SN / MAC &amp; Desc</th>
                        <th className="py-2 px-2.5">Profiles / VLAN</th>
                        <th className="py-2 px-2.5">Rx Power</th>
                        <th className="py-2 px-2.5">State</th>
                        <th className="py-2 px-2.5 text-right">Live Telnet Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                      {filteredOnus.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                            No ONUs match this filter. Click &ldquo;Sync Live OLT&rdquo; or &ldquo;+ Add ONU&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredOnus.map((onu) => {
                          const rxColor =
                            onu.rxPowerDbm <= -28
                              ? 'text-red-700 font-bold'
                              : onu.rxPowerDbm <= -24
                              ? 'text-amber-700 font-bold'
                              : 'text-emerald-700 font-bold';
                          return (
                            <tr key={onu.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                <div className="font-bold text-black">
                                  {onu.frame}/{onu.slot}/{onu.port}:{onu.ontId}
                                </div>
                                <div className="text-[10px] text-slate-500">{onu.mode}</div>
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="font-bold text-black">{onu.mode === 'EPON' ? onu.mac : onu.sn}</div>
                                <div className="text-[11px] font-sans text-slate-600">{onu.desc}</div>
                              </td>
                              <td className="py-2 px-2.5 text-[11px] text-slate-700 whitespace-nowrap">
                                LP:{onu.lineProfile} · SP:{onu.srvProfile}
                                <div className="text-black font-semibold">VLAN {onu.vlan}</div>
                              </td>
                              <td className={`py-2 px-2.5 whitespace-nowrap ${rxColor}`}>
                                {onu.rxPowerDbm.toFixed(2)} dBm
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap font-sans font-semibold">
                                <span
                                  className={
                                    onu.status === 'online'
                                      ? 'text-emerald-700'
                                      : onu.status === 'deactivated'
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                  }
                                >
                                  {onu.status === 'online'
                                    ? 'Online'
                                    : onu.status === 'deactivated'
                                    ? 'Deactivated'
                                    : onu.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditOnu(onu)}
                                    title="Edit ONU (ont modify, native-vlan, eth admin)"
                                    className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleOnuActive(onu)}
                                    title={onu.status === 'deactivated' ? 'ont activate' : 'ont deactivate'}
                                    className={`p-1.5 rounded border cursor-pointer ${
                                      onu.status === 'deactivated'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white'
                                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-600 hover:text-white'
                                    }`}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'optical')}
                                    title="Read Optical Power (display ont optical-info)"
                                    className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'ports')}
                                    title="UNI ETH Port State (display ont port state)"
                                    className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"
                                  >
                                    <Network className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'mac')}
                                    title="Learned MAC (display mac-address port)"
                                    className="px-1.5 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 text-[10px] font-bold cursor-pointer"
                                  >
                                    MAC
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'reboot')}
                                    title="Reboot ONU (ont reset)"
                                    className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOnuQuickAction(onu, 'factory-restore')}
                                    title="Factory Restore (ont factory-setting-restore)"
                                    className="p-1.5 rounded bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 cursor-pointer"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOnu(onu)}
                                    title="Delete Service-Port & ONU (undo service-port + ont delete)"
                                    className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: + ADD ONU (GPON / EPON / XG-PON / XGS-PON + QinQ)      */}
            {/* ============================================================= */}
            {box1Tab === 'add-onu' && (
              <form onSubmit={handleAddOnuSubmit} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">PON Technology</span>
                    <select
                      value={addMode}
                      onChange={(e) => setAddMode(e.target.value as HuaweiPonMode)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono font-bold text-black"
                    >
                      <option value="GPON">GPON (sn-auth)</option>
                      <option value="EPON">EPON (mac-auth)</option>
                      <option value="XG-PON">XG-PON (10G)</option>
                      <option value="XGS-PON">XGS-PON (10G Sym)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Frame / Slot / Port</span>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        value={addFrame}
                        onChange={(e) => setAddFrame(e.target.value)}
                        className="w-1/3 bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 font-mono text-black text-center"
                      />
                      <input
                        type="number"
                        value={addSlot}
                        onChange={(e) => setAddSlot(e.target.value)}
                        className="w-1/3 bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 font-mono text-black text-center"
                      />
                      <input
                        type="number"
                        value={addPort}
                        onChange={(e) => setAddPort(e.target.value)}
                        className="w-1/3 bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 font-mono text-black text-center"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">ONT ID (auto / 0-127)</span>
                    <input
                      type="text"
                      value={addOntId}
                      onChange={(e) => setAddOntId(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">
                      {addMode === 'EPON' ? 'ONU MAC Address' : 'ONT Serial (16 Hex)'}
                    </span>
                    <input
                      type="text"
                      value={addSnOrMac}
                      onChange={(e) => setAddSnOrMac(e.target.value)}
                      required
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>

                  <label className="col-span-2 block">
                    <span className="text-[11px] font-semibold text-slate-600">Customer Description</span>
                    <input
                      type="text"
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Line Profile ID</span>
                    <input
                      type="number"
                      value={addLineProfile}
                      onChange={(e) => setAddLineProfile(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Srv Profile ID</span>
                    <input
                      type="number"
                      value={addSrvProfile}
                      onChange={(e) => setAddSrvProfile(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Service VLAN (S-VLAN)</span>
                    <input
                      type="number"
                      value={addVlan}
                      onChange={(e) => setAddVlan(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">GEM Port</span>
                    <input
                      type="number"
                      value={addGemPort}
                      onChange={(e) => setAddGemPort(e.target.value)}
                      disabled={addMode === 'EPON'}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black disabled:bg-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Inbound Traffic Idx</span>
                    <input
                      type="number"
                      value={addTrafficIn}
                      onChange={(e) => setAddTrafficIn(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-600">Outbound Traffic Idx</span>
                    <input
                      type="number"
                      value={addTrafficOut}
                      onChange={(e) => setAddTrafficOut(e.target.value)}
                      className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-black"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addNativeEth}
                      onChange={(e) => setAddNativeEth(e.target.checked)}
                      className="accent-black"
                    />
                    <span>Set ETH 1 Native VLAN</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addUseQinq}
                      onChange={(e) => setAddUseQinq(e.target.checked)}
                      className="accent-black"
                    />
                    <span>Enable QinQ (add-double)</span>
                  </label>
                  {addUseQinq && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-600">Inner C-VLAN:</span>
                      <input
                        type="number"
                        value={addInnerVlan}
                        onChange={(e) => setAddInnerVlan(e.target.value)}
                        className="w-20 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs text-black"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-slate-600 mb-1.5">
                    Live Huawei CLI Preview (Pushed on Submit):
                  </div>
                  <pre className="text-[11px] font-mono text-black whitespace-pre-wrap leading-relaxed">
                    {buildAddOnuCli()}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add ONU &amp; Push Live to Telnet</span>
                  </button>
                </div>
              </form>
            )}

            {/* ============================================================= */}
            {/* TAB 3: SERVICE-PORTS & QINQ MANAGER                           */}
            {/* ============================================================= */}
            {box1Tab === 'service-ports' && (
              <div className="space-y-4">
                <form
                  onSubmit={handleCreateServicePort}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-black">
                      Create Service-Port (Translate / Transparent / QinQ Double-Tag)
                    </span>
                    <button
                      type="button"
                      onClick={() => pushCliScriptToOlt('Display All Service-Ports', 'display service-port all')}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                    >
                      display service-port all
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <label className="block">
                      <span className="text-[11px] text-slate-600">S-VLAN</span>
                      <input
                        type="number"
                        value={spVlan}
                        onChange={(e) => setSpVlan(e.target.value)}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">PON Mode</span>
                      <select
                        value={spMode}
                        onChange={(e) => setSpMode(e.target.value as 'gpon' | 'epon' | 'xgpon')}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      >
                        <option value="gpon">gpon</option>
                        <option value="epon">epon</option>
                        <option value="xgpon">xgpon</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">F/S/P</span>
                      <input
                        type="text"
                        value={spFsp}
                        onChange={(e) => setSpFsp(e.target.value)}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">ONT ID</span>
                      <input
                        type="number"
                        value={spOntId}
                        onChange={(e) => setSpOntId(e.target.value)}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">GEM Port</span>
                      <input
                        type="number"
                        value={spGem}
                        onChange={(e) => setSpGem(e.target.value)}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">User VLAN</span>
                      <input
                        type="text"
                        value={spUserVlan}
                        onChange={(e) => setSpUserVlan(e.target.value)}
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      />
                    </label>
                    <label className="col-span-2 block">
                      <span className="text-[11px] text-slate-600">Tag Transform</span>
                      <select
                        value={spTagTransform}
                        onChange={(e) =>
                          setSpTagTransform(e.target.value as 'translate' | 'transparent' | 'add-double')
                        }
                        className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                      >
                        <option value="translate">translate (Standard VLAN)</option>
                        <option value="transparent">transparent (Pass-Through)</option>
                        <option value="add-double">add-double (802.1ad QinQ)</option>
                      </select>
                    </label>
                    {spTagTransform === 'add-double' && (
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Inner VLAN</span>
                        <input
                          type="number"
                          value={spInnerVlan}
                          onChange={(e) => setSpInnerVlan(e.target.value)}
                          className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="text-[11px] text-slate-600">RX / TX Traffic Idx</span>
                      <div className="mt-1 flex gap-1">
                        <input
                          type="number"
                          value={spRxIdx}
                          onChange={(e) => setSpRxIdx(e.target.value)}
                          className="w-1/2 bg-white border border-slate-300 rounded px-1.5 py-1.5 font-mono text-black"
                        />
                        <input
                          type="number"
                          value={spTxIdx}
                          onChange={(e) => setSpTxIdx(e.target.value)}
                          className="w-1/2 bg-white border border-slate-300 rounded px-1.5 py-1.5 font-mono text-black"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create &amp; Push Service-Port</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 font-sans font-semibold">
                        <th className="py-2 px-2.5">Idx</th>
                        <th className="py-2 px-2.5">VLAN</th>
                        <th className="py-2 px-2.5">Port : ONT</th>
                        <th className="py-2 px-2.5">Transform</th>
                        <th className="py-2 px-2.5">RX / TX QoS</th>
                        <th className="py-2 px-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {servicePorts.map((sp) => (
                        <tr key={sp.index} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-bold text-black">{sp.index}</td>
                          <td className="py-2 px-2.5">
                            <span className="font-bold text-black">{sp.vlan}</span>
                            {sp.innerVlan && <span className="text-slate-500"> / C:{sp.innerVlan}</span>}
                          </td>
                          <td className="py-2 px-2.5">
                            {sp.mode} {sp.fsp}:{sp.ontId} (G{sp.gemPort})
                          </td>
                          <td className="py-2 px-2.5 text-slate-700">{sp.tagTransform}</td>
                          <td className="py-2 px-2.5">
                            {editingSpIdx === sp.index ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editSpRx}
                                  onChange={(e) => setEditSpRx(e.target.value)}
                                  className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs"
                                />
                                <span>/</span>
                                <input
                                  type="number"
                                  value={editSpTx}
                                  onChange={(e) => setEditSpTx(e.target.value)}
                                  className="w-12 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleModifyServicePortTraffic(sp)}
                                  className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-sans font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <span>
                                In:{sp.rxTrafficIdx} · Out:{sp.txTrafficIdx}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSpIdx(sp.index);
                                  setEditSpRx(String(sp.rxTrafficIdx));
                                  setEditSpTx(String(sp.txTrafficIdx));
                                }}
                                title="Modify QoS Traffic Table Index"
                                className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteServicePort(sp)}
                                title={`undo service-port ${sp.index}`}
                                className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 4: PROFILES & QOS (DBA / LINE / SRV / TRAFFIC TABLE)      */}
            {/* ============================================================= */}
            {box1Tab === 'profiles' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'dba', label: 'DBA Profile' },
                        { id: 'line', label: 'Line Profile' },
                        { id: 'srv', label: 'Service Profile' },
                        { id: 'traffic', label: 'Traffic Table IP' },
                      ] as const
                    ).map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setProfileSubTab(sub.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          profileSubTab === sub.id
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-black'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const map = {
                        dba: 'display dba-profile all',
                        line: 'display ont-lineprofile gpon all',
                        srv: 'display ont-srvprofile gpon all',
                        traffic: 'display traffic table ip from-index 0',
                      };
                      pushCliScriptToOlt(`Show ${profileSubTab.toUpperCase()} Profiles`, map[profileSubTab]);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-xs font-mono cursor-pointer"
                  >
                    display all
                  </button>
                </div>

                {profileSubTab === 'dba' && (
                  <form onSubmit={handlePushDbaProfile} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-black">Huawei DBA Profile Builder (Types 1–5 Upstream T-CONT Bandwidth)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile ID</span>
                        <input type="number" value={dbaId} onChange={(e) => setDbaId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile Name</span>
                        <input type="text" value={dbaName} onChange={(e) => setDbaName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">DBA Type</span>
                        <select value={dbaType} onChange={(e) => setDbaType(e.target.value as '1' | '2' | '3' | '4' | '5')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black">
                          <option value="1">Type 1 (Fixed)</option>
                          <option value="2">Type 2 (Assured)</option>
                          <option value="3">Type 3 (Assured + Max)</option>
                          <option value="4">Type 4 (Best Effort Max)</option>
                          <option value="5">Type 5 (Fix + Assure + Max)</option>
                        </select>
                      </label>
                      {(dbaType === '1' || dbaType === '5') && (
                        <label className="block">
                          <span className="text-[11px] text-slate-600">Fixed (kbps)</span>
                          <input type="number" value={dbaFix} onChange={(e) => setDbaFix(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                        </label>
                      )}
                      {(dbaType === '2' || dbaType === '3' || dbaType === '5') && (
                        <label className="block">
                          <span className="text-[11px] text-slate-600">Assured (kbps)</span>
                          <input type="number" value={dbaAssure} onChange={(e) => setDbaAssure(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                        </label>
                      )}
                      {(dbaType === '3' || dbaType === '4' || dbaType === '5') && (
                        <label className="block">
                          <span className="text-[11px] text-slate-600">Max (kbps)</span>
                          <input type="number" value={dbaMax} onChange={(e) => setDbaMax(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                        </label>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                        Push DBA Profile to Telnet
                      </button>
                    </div>
                  </form>
                )}

                {profileSubTab === 'line' && (
                  <form onSubmit={handlePushLineProfile} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-black">ONT Line Profile Builder (T-CONT, GEM Port &amp; VLAN Mapping)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Mode</span>
                        <select value={lpMode} onChange={(e) => setLpMode(e.target.value as 'gpon' | 'epon')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black">
                          <option value="gpon">GPON</option>
                          <option value="epon">EPON</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile ID</span>
                        <input type="number" value={lpId} onChange={(e) => setLpId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile Name</span>
                        <input type="text" value={lpName} onChange={(e) => setLpName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">T-CONT ID</span>
                        <input type="number" value={lpTcont} onChange={(e) => setLpTcont(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">DBA Profile Ref</span>
                        <input type="number" value={lpDbaRef} onChange={(e) => setLpDbaRef(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">GEM Port / VLAN</span>
                        <div className="mt-1 flex gap-1">
                          <input type="number" value={lpGem} onChange={(e) => setLpGem(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                          <input type="text" value={lpVlanList} onChange={(e) => setLpVlanList(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                        </div>
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                        Push &amp; Commit Line Profile
                      </button>
                    </div>
                  </form>
                )}

                {profileSubTab === 'srv' && (
                  <form onSubmit={handlePushSrvProfile} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-black">ONT Service Profile Builder (ETH / POTS UNI Ports)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Mode</span>
                        <select value={srvMode} onChange={(e) => setSrvMode(e.target.value as 'gpon' | 'epon')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black">
                          <option value="gpon">GPON</option>
                          <option value="epon">EPON</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile ID</span>
                        <input type="number" value={srvId} onChange={(e) => setSrvId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Profile Name</span>
                        <input type="text" value={srvName} onChange={(e) => setSrvName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">ETH / POTS Ports</span>
                        <div className="mt-1 flex gap-1">
                          <input type="number" value={srvEthCount} onChange={(e) => setSrvEthCount(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                          <input type="number" value={srvPotsCount} onChange={(e) => setSrvPotsCount(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">ETH 1 VLAN Mode</span>
                        <select value={srvPortMode} onChange={(e) => setSrvPortMode(e.target.value as 'transparent' | 'translation')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black">
                          <option value="translation">translation</option>
                          <option value="transparent">transparent</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">VLAN ID</span>
                        <input type="number" value={srvVlan} onChange={(e) => setSrvVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                        Push &amp; Commit Service Profile
                      </button>
                    </div>
                  </form>
                )}

                {profileSubTab === 'traffic' && (
                  <form onSubmit={handlePushTrafficTable} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-black">IP Traffic Table (CIR / PIR Speed Package Limiting)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Index</span>
                        <input type="number" value={ttIndex} onChange={(e) => setTtIndex(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Name</span>
                        <input type="text" value={ttName} onChange={(e) => setTtName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">CIR (kbps)</span>
                        <input type="number" value={ttCir} onChange={(e) => setTtCir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">PIR (kbps)</span>
                        <input type="number" value={ttPir} onChange={(e) => setTtPir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Priority (0-7)</span>
                        <input type="number" min={0} max={7} value={ttPriority} onChange={(e) => setTtPriority(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                        Push Traffic Table to Telnet
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 5: VLANS & UPLINK ETHERNET MANAGER                        */}
            {/* ============================================================= */}
            {box1Tab === 'vlans' && (
              <div className="space-y-4">
                <form onSubmit={handleCreateVlan} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-black">Create VLAN &amp; Tag on 10G Uplink Port</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] text-slate-600">VLAN ID (2–4093)</span>
                      <input type="number" value={newVlanId} onChange={(e) => setNewVlanId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">VLAN Type</span>
                      <select value={newVlanType} onChange={(e) => setNewVlanType(e.target.value as HuaweiVlanItem['type'])} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black">
                        <option value="smart">smart</option>
                        <option value="mux">mux</option>
                        <option value="standard">standard</option>
                        <option value="super">super</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Uplink Port (f/s p)</span>
                      <input type="text" value={newVlanUplink} onChange={(e) => setNewVlanUplink(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Description</span>
                      <input type="text" value={newVlanDesc} onChange={(e) => setNewVlanDesc(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                      <input type="checkbox" checked={newVlanQinq} onChange={(e) => setNewVlanQinq(e.target.checked)} className="accent-black" />
                      <span>Set QinQ Stacking Attribute (`vlan attrib &lt;id&gt; q-in-q`)</span>
                    </label>
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                      Create &amp; Tag VLAN
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">VLAN ID</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Uplink Port</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vlans.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{v.id}</td>
                          <td className="py-2 px-3 text-slate-700">
                            {v.type}
                            {v.qinq ? ' · QinQ' : ''}
                          </td>
                          <td className="py-2 px-3 text-slate-800">{v.uplinkTagged}</td>
                          <td className="py-2 px-3 font-sans text-slate-600">{v.desc}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteVlan(v)}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"
                              title={`undo vlan ${v.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Uplink Ethernet Admin Controls */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-black">Uplink ETH:</span>
                    <input
                      type="text"
                      value={uplinkEthSlot}
                      onChange={(e) => setUplinkEthSlot(e.target.value)}
                      className="w-16 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-black"
                      title="Frame/Slot e.g. 0/0 or 0/9"
                    />
                    <input
                      type="text"
                      value={uplinkEthPort}
                      onChange={(e) => setUplinkEthPort(e.target.value)}
                      className="w-12 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-black"
                      title="Port Number"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => pushCliScriptToOlt(`Show Uplink ETH ${uplinkEthSlot}`, `display interface eth ${uplinkEthSlot}`)}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 font-semibold cursor-pointer"
                    >
                      Status
                    </button>
                    <button
                      type="button"
                      onClick={() => pushCliScriptToOlt('Show LACP / Link-Aggregation', 'display link-aggregation all')}
                      className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 font-semibold cursor-pointer"
                    >
                      LACP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUplinkAdmin('up')}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      No Shutdown
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUplinkAdmin('down')}
                      className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                    >
                      Shutdown
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 6: SYSTEM, HOSTNAME, MGMT IP, NTP & STATIC ROUTES         */}
            {/* ============================================================= */}
            {box1Tab === 'system' && (
              <div className="space-y-4">
                <form onSubmit={handleApplyHostnameAndIp} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-black flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>OLT Hostname, Management Vlanif IP &amp; NTP</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => pushCliScriptToOlt('Audit CPU / Memory / Temp', 'display cpu 0/0\ndisplay mem 0/0\ndisplay temperature 0')}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        CPU/Temp
                      </button>
                      <button
                        type="button"
                        onClick={() => pushCliScriptToOlt('Active OLT Alarms', 'display alarm active all')}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Alarms
                      </button>
                      <button
                        type="button"
                        onClick={() => pushCliScriptToOlt('Version & Uptime', 'display version')}
                        className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Version
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Sysname</span>
                      <input type="text" value={sysname} onChange={(e) => setSysname(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Mgmt VLAN ID</span>
                      <input type="number" value={mgmtVlan} onChange={(e) => setMgmtVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Uplink Port (f/s p)</span>
                      <input type="text" value={uplinkPort} onChange={(e) => setUplinkPort(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Mgmt IP Address</span>
                      <input type="text" value={mgmtIp} onChange={(e) => setMgmtIp(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Subnet Mask</span>
                      <input type="text" value={mgmtMask} onChange={(e) => setMgmtMask(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">NTP Server IP</span>
                      <input type="text" value={ntpServer} onChange={(e) => setNtpServer(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold cursor-pointer">
                      Apply System Config to Telnet
                    </button>
                  </div>
                </form>

                {/* Static IP Routes */}
                <form onSubmit={handleAddIpRoute} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-black">Static IPv4 Routes (`ip route-static`)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" value={newRouteDst} onChange={(e) => setNewRouteDst(e.target.value)} placeholder="Destination" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    <input type="text" value={newRouteMask} onChange={(e) => setNewRouteMask(e.target.value)} placeholder="Subnet Mask" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    <input type="text" value={newRouteGw} onChange={(e) => setNewRouteGw(e.target.value)} placeholder="Next-Hop GW" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono text-black" />
                    <input type="text" value={newRouteComment} onChange={(e) => setNewRouteComment(e.target.value)} placeholder="Comment" className="bg-white border border-slate-300 rounded px-2 py-1.5 text-black" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-600">Preference:</span>
                      <input type="number" value={newRoutePref} onChange={(e) => setNewRoutePref(e.target.value)} className="w-16 bg-white border border-slate-300 rounded px-2 py-1 font-mono text-black" />
                    </div>
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add IP Route</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">Destination</th>
                        <th className="py-2 px-3">Mask</th>
                        <th className="py-2 px-3">Next-Hop GW</th>
                        <th className="py-2 px-3">Pref</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {routes.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">
                            <div>{r.destination}</div>
                            <div className="text-[10px] font-sans font-normal text-slate-500">{r.comment}</div>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{r.mask}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">{r.gateway}</td>
                          <td className="py-2 px-3 text-slate-700">{r.preference}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteIpRoute(r)}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"
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

            {/* ============================================================= */}
            {/* TAB 7: OFFICIAL HUAWEI DATASHEET & 35+ COMMAND CHEAT SHEET    */}
            {/* ============================================================= */}
            {box1Tab === 'cheatsheet' && (
              <div className="space-y-4">
                {/* Active Model Hardware Datasheet Summary */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-black">
                      Official Hardware Datasheet: Huawei {activeSpec.model} ({activeSpec.series})
                    </span>
                    <span className="font-mono text-slate-600">{activeSpec.heightU}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 p-3 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">Control Board</div>
                      <div className="font-mono font-bold text-black">{activeSpec.controlBoard}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Service Slots / Max PON</div>
                      <div className="font-mono font-bold text-black">
                        {activeSpec.serviceSlots} Slots · {activeSpec.maxPonPorts}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Switching Capacity</div>
                      <div className="font-mono font-bold text-black">{activeSpec.switchingCapacity}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Max ONT Capacity</div>
                      <div className="font-mono font-bold text-black">{activeSpec.maxOnts}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Supported Uplink &amp; PON Boards</div>
                      <div className="font-mono text-[11px] text-slate-800">
                        {activeSpec.uplinkBoards} · {activeSpec.ponBoards.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Searchable 35+ Official Huawei Commands */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cheatSearch}
                      onChange={(e) => setCheatSearch(e.target.value)}
                      placeholder="Search official Huawei commands (e.g. rogue, ddm, q-in-q, dba, optical)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-black focus:outline-none focus:border-black"
                    />
                  </div>
                  <select
                    value={cheatCat}
                    onChange={(e) => setCheatCat(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-black"
                  >
                    {cheatCategories.map((c) => (
                      <option key={c} value={c}>
                        {c === 'ALL' ? 'All Categories (35)' : c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto">
                  {filteredCheatSheet.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-slate-50 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-black">{item.title}</span>
                          <span className="text-[11px] text-slate-500 ml-2">· {item.category}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.command);
                              showToast(`Copied: ${item.title}`);
                            }}
                            className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              pushCliScriptToOlt(
                                item.title,
                                item.requiresConfig ? `enable\nconfig\n${item.command}` : item.command,
                                true
                              )
                            }
                            className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Run on Telnet</span>
                          </button>
                        </div>
                      </div>
                      <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-black whitespace-pre-wrap">
                        {item.command}
                      </pre>
                      <p className="text-[11px] text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* BOX 2: LIVE BIDIRECTIONAL TELNET & RESIZABLE CLI CONSOLE          */}
        {/* ================================================================= */}
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {/* Telnet Connection & Sync Bar */}
          <form onSubmit={handleConnectTelnet} className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                <Radio className={`w-4 h-4 ${liveTelnetId ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span>Live Huawei Telnet Console</span>
                {liveTelnetId && (
                  <span className="text-[11px] font-mono font-normal text-emerald-700">
                    · {promptModeLabel[promptMode]}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] font-semibold text-black">
                <label className="flex items-center gap-1 cursor-pointer" title="Automatically push every WebUI change live to Telnet">
                  <input
                    type="checkbox"
                    checked={autoPushGui}
                    onChange={(e) => setAutoPushGui(e.target.checked)}
                    className="accent-black"
                  />
                  <span>Auto-Push GUI</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer" title="Automatically press Enter for Huawei { <cr>|... }: prompts">
                  <input
                    type="checkbox"
                    checked={autoConfirmCr}
                    onChange={(e) => setAutoConfirmCr(e.target.checked)}
                    className="accent-black"
                  />
                  <span>Auto &#123;&lt;cr&gt;&#125;</span>
                </label>
              </div>
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
                        'Sync Full Huawei OLT State',
                        'enable\nscroll\nconfig\ndisplay board 0\ndisplay ont autofind all\ndisplay ont info 0 all\ndisplay ip routing-table',
                        true
                      )
                    }
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Sync Full OLT State</span>
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

          {/* Latest Generated CLI Queue + Size / Font Controls */}
          <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="min-w-0 flex-1">
              <span className="font-bold text-black truncate block">Queue: {lastGeneratedTitle}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setConsoleFontSize((s) => Math.max(10, s - 1))}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
                title="Decrease Console Font"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setConsoleFontSize((s) => Math.min(16, s + 1))}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
                title="Increase Console Font"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => setConsoleHeight((h) => (h < 420 ? 480 : h < 600 ? 640 : 340))}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-mono cursor-pointer"
                title="Cycle Console Height (S / M / L)"
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
                onClick={() => pushCliScriptToOlt(lastGeneratedTitle, lastGeneratedCli, true)}
                className="px-2.5 py-0.5 rounded bg-black hover:bg-slate-800 text-white disabled:opacity-40 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{pushingCli ? 'Pushing...' : 'Push Live'}</span>
              </button>
            </div>
          </div>

          {/* Hardware CLI Keys Bar */}
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

          {/* Live Telnet Output Console Viewport */}
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

            {/* Sticky Suggestions + Prompt Input */}
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
                <span className="shrink-0 max-w-[140px] truncate">{activePrompt}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputVal}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type partial cmd (e.g. dis ont, board c) then Tab or ?..."
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

          {/* Drag-to-Resize Bottom Handle */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              resizingRef.current = { startY: e.clientY, startH: consoleHeight };
            }}
            className="h-5 bg-slate-50 border-t border-slate-200 flex items-center justify-center cursor-ns-resize hover:bg-slate-100 select-none"
            title="Drag up or down to resize Telnet console height"
          >
            <GripHorizontal className="w-4 h-4 text-slate-400" />
          </div>
        </section>
      </div>
    </div>
  );
};
