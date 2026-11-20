import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  LayoutDashboard,
  Network,
  Layers,
  Route,
  Wifi,
  Shield,
  Sliders,
  Radio,
  Terminal as TerminalIcon,
  Save,
  Plus,
  Trash2,
  Power,
  Check,
  Copy,
  Send,
  HelpCircle,
  ArrowRightToLine,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Search,
  Pencil,
  KeyRound,
  GitBranch,
  Cpu,
  Activity,
  FileText,
  Usb,
  Zap,
} from 'lucide-react';
import { TerminalVendor, VpnProfile } from '../types/vpn';
import { isPrivateIp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  INITIAL_WEBUI_PRESETS,
  DeviceCategory,
  WebUiDevicePreset,
  WebUiInterface,
  WebUiVlan,
  WebUiRoute,
  WebUiOnu,
  WebUiPolicyOrPpp,
  cidrToMask,
  maskToCidr,
  genHostnameCli,
  genInterfaceToggleCli,
  genInterfaceIpCli,
  genVlanAddCli,
  genVlanDeleteCli,
  genRouteAddCli,
  genRouteDeleteCli,
  genOnuAddCli,
  genOnuDeleteCli,
  genOltDiagnosticCli,
  genPolicyOrPppAddCli,
  genSaveConfigCli,
} from '../services/universalWebUiCli';
import { getCliHelp, getCliTabCompletion, getCliSuggestions } from '../services/cliCommandTree';
import { SwitchL2Panel, BgpOspfPanel, CommandCenterPanel } from './WebUiSwitchRoutingPanels';
import { CommandNotepadPanel } from './CommandNotepadPanel';
import {
  serialConsoleManager,
  BAUD_RATES,
  getRecommendedBaudRate,
  isWebSerialSupported,
  SerialLineEnding,
} from '../services/serialConsole';

type WebUiSection =
  | 'dashboard'
  | 'interfaces'
  | 'switch-l2'
  | 'vlans'
  | 'routing'
  | 'bgp-ospf'
  | 'olt-onus'
  | 'security-ppp'
  | 'notepad'
  | 'commands'
  | 'system';

interface ConsoleLine {
  id: string;
  type: 'prompt' | 'output' | 'info' | 'success' | 'error';
  text: string;
}

const ALL_BRANDS: TerminalVendor[] = [
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

function appendRawOutput(existing: ConsoleLine[], chunk?: string): ConsoleLine[] {
  if (!chunk) return [...existing];
  const applyBksp = (base: string, c: string) => {
    let out = base;
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
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
    next[next.length - 1] = { ...last, text: applyBksp(last.text, chunk) };
  } else {
    next.push({
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'output',
      text: applyBksp('', chunk),
    });
  }
  return next;
}

interface DeviceWebUiViewProps {
  activeProfile?: VpnProfile | null;
}

export const DeviceWebUiView: React.FC<DeviceWebUiViewProps> = ({ activeProfile }) => {
  const { commandNotes } = useAuth();

  // Store independent editable WebUI state for all 12 OLT, Router & Switch brands
  const [devices, setDevices] = useState<Record<TerminalVendor, WebUiDevicePreset>>(INITIAL_WEBUI_PRESETS);
  const [roleFilter, setRoleFilter] = useState<'ALL' | DeviceCategory>('ALL');
  const [activeBrand, setActiveBrand] = useState<TerminalVendor>('MikroTik');
  const [selectedModel, setSelectedModel] = useState<string>(INITIAL_WEBUI_PRESETS.MikroTik.defaultModel);
  const [activeSection, setActiveSection] = useState<WebUiSection>('dashboard');
  const [showCliDrawer, setShowCliDrawer] = useState<boolean>(true);
  const [notepadDraft, setNotepadDraft] = useState<{
    title: string;
    vendor: TerminalVendor | 'All';
    commands: string;
  } | null>(null);

  const currentDevice = devices[activeBrand];

  // Live Telnet & Physical Console Cable (USB / COM Serial) State
  const [connMode, setConnMode] = useState<'telnet' | 'console'>('telnet');
  const [telnetHost, setTelnetHost] = useState(currentDevice.mgmtIp);
  const [telnetPort, setTelnetPort] = useState(23);
  const [telnetUser, setTelnetUser] = useState(currentDevice.defaultUser);
  const [telnetPass, setTelnetPass] = useState(currentDevice.defaultPass);
  const [liveTelnetId, setLiveTelnetId] = useState<string | null>(null);
  const [serialBaud, setSerialBaud] = useState<number>(getRecommendedBaudRate('MikroTik'));
  const [serialLineEnding, setSerialLineEnding] = useState<SerialLineEnding>('\r');
  const [liveSerialId, setLiveSerialId] = useState<string | null>(null);
  const [liveSerialLabel, setLiveSerialLabel] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [autoPush, setAutoPush] = useState(true);
  const [pushing, setPushing] = useState(false);

  // CLI Queue & Interactive Mid-Command Tab / ? Console
  const [lastActionTitle, setLastActionTitle] = useState('WebUI Ready — Click any setting to generate CLI');
  const [lastCliScript, setLastCliScript] = useState('# Select any interface, switchport, VLAN, route, BGP/OSPF, ONU, or command on the left WebUI.');
  const [copiedCli, setCopiedCli] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    {
      id: 'w1',
      type: 'info',
      text: '  Multi-Vendor OLT · Router · Switch WebUI (12 Brands: Huawei · ZTE · BDCOM · VSOL · C-Data · MikroTik · Cisco · Juniper · Palo Alto · Arista · Ruijie · TP-Link)',
    },
    {
      id: 'w2',
      type: 'success',
      text: '  বাম পাশে যেকোনো OLT, Router বা Switch আসল WebUI-এর মতো কনফিগার করুন — ডান পাশে সাথে সাথে আসল CLI তৈরি ও লাইভ Telnet-এ পুশ হবে।',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isConsoleFocused, setIsConsoleFocused] = useState(false);
  const [remoteBufferHint, setRemoteBufferHint] = useState('');

  // Editable Forms State
  const [editingIfaceId, setEditingIfaceId] = useState<string | null>(null);
  const [editIfaceIp, setEditIfaceIp] = useState('');
  const [editIfaceMask, setEditIfaceMask] = useState('/24');
  const [editIfaceDesc, setEditIfaceDesc] = useState('');

  const [newIfaceName, setNewIfaceName] = useState('');
  const [newIfaceIp, setNewIfaceIp] = useState('');
  const [newIfaceMask, setNewIfaceMask] = useState('/24');
  const [newIfaceDesc, setNewIfaceDesc] = useState('');

  const [newVlanId, setNewVlanId] = useState('300');
  const [newVlanName, setNewVlanName] = useState('CLIENT-VLAN300');
  const [newVlanPorts, setNewVlanPorts] = useState('');

  const [newRouteDst, setNewRouteDst] = useState('10.200.0.0');
  const [newRouteMask, setNewRouteMask] = useState('255.255.255.0');
  const [newRouteGw, setNewRouteGw] = useState('10.99.0.1');
  const [newRouteComment, setNewRouteComment] = useState('Branch Route');

  const [onuSearch, setOnuSearch] = useState('');
  const [newOnuPort, setNewOnuPort] = useState('0/1/0');
  const [newOnuId, setNewOnuId] = useState('3');
  const [newOnuMode, setNewOnuMode] = useState<'GPON' | 'EPON'>('GPON');
  const [newOnuSn, setNewOnuSn] = useState('48575443BBCC1122');
  const [newOnuDesc, setNewOnuDesc] = useState('New-FTTH-Client');
  const [newOnuVlan, setNewOnuVlan] = useState('200');

  const [newPolName, setNewPolName] = useState('New-Rule');
  const [newPolSrc, setNewPolSrc] = useState('client_user_02');
  const [newPolDst, setNewPolDst] = useState('default-encryption');
  const [newPolAction, setNewPolAction] = useState('pppoe');
  const [newPolComment, setNewPolComment] = useState('Added from WebUI');

  const [hostnameInput, setHostnameInput] = useState(currentDevice.hostname);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  const handleSelectBrand = (brand: TerminalVendor) => {
    setActiveBrand(brand);
    const preset = devices[brand];
    setSelectedModel(preset.defaultModel);
    setHostnameInput(preset.hostname);
    if (!liveTelnetId && !liveSerialId) {
      setTelnetHost(preset.mgmtIp);
      setTelnetUser(preset.defaultUser);
      setTelnetPass(preset.defaultPass);
      setSerialBaud(getRecommendedBaudRate(brand));
    }
    if (brand === 'BDCOM') {
      setNewOnuMode('EPON');
      setNewOnuPort('0/1');
      setNewOnuSn('e067.b311.cc99');
    } else if (brand === 'Huawei') {
      setNewOnuMode('GPON');
      setNewOnuPort('0/1/0');
      setNewOnuSn('48575443BBCC1122');
    } else if (brand === 'ZTE') {
      setNewOnuMode('GPON');
      setNewOnuPort('1/2/1');
      setNewOnuSn('ZTEGC55443322');
    } else if (brand === 'C-Data') {
      setNewOnuMode('GPON');
      setNewOnuPort('0/0/1');
      setNewOnuSn('CDAT88776655');
    } else if (brand === 'VSOL') {
      setNewOnuMode('GPON');
      setNewOnuPort('0/1');
      setNewOnuSn('56534F4C9988AA11');
    }
    if (brand === 'MikroTik') {
      setNewPolSrc('user_pppoe');
      setNewPolDst('50Mbps-Pkg');
      setNewPolAction('pppoe');
    } else if (brand === 'Palo Alto') {
      setNewPolSrc('TRUST');
      setNewPolDst('UNTRUST');
      setNewPolAction('allow');
    } else if (brand === 'Juniper') {
      setNewPolSrc('192.168.88.0/24');
      setNewPolDst('any');
      setNewPolAction('accept');
    } else {
      setNewPolSrc('192.168.88.0/24');
      setNewPolDst('any');
      setNewPolAction('permit ip');
    }
    if (activeSection === 'olt-onus' && !preset.isOlt) {
      setActiveSection('dashboard');
    } else if (activeSection === 'switch-l2' && !preset.supportsSwitchL2) {
      setActiveSection('dashboard');
    } else if (activeSection === 'bgp-ospf' && !preset.supportsDynamicRouting) {
      setActiveSection('dashboard');
    }
  };

  // Real-time 300ms Live Telnet Poll
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
          setConsoleLines((prev) => appendRawOutput(prev, data.output));
        }
        if (data.connected === false) {
          setLiveTelnetId(null);
          setRemoteBufferHint('');
          setConsoleLines((prev) => [
            ...prev,
            { id: `disc_${Date.now()}`, type: 'error', text: `\n  [Telnet Disconnected] ${data.closedReason || 'Connection closed.'}` },
          ]);
        }
      } catch {}
    }, 180);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveTelnetId]);

  const isLiveBridgeConnected = Boolean(liveTelnetId || liveSerialId);

  const sendRawTelnet = async (payload: string, raw = false) => {
    if (liveSerialId) {
      const ok = await serialConsoleManager.write(liveSerialId, payload, raw);
      if (!ok) {
        setLiveSerialId(null);
        setLiveSerialLabel('');
        setRemoteBufferHint('');
        setConsoleLines((prev) => [
          ...prev,
          { id: `ser_err_${Date.now()}`, type: 'error', text: '\n  [Console Cable Disconnected] Port closed or unplugged.' },
        ]);
      }
      return;
    }
    if (!liveTelnetId) return;
    try {
      const resp = await fetch(`/api/telnet/sessions/${liveTelnetId}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: payload, raw }),
      });
      const data = await resp.json();
      if (data.output) setConsoleLines((prev) => appendRawOutput(prev, data.output));
      if (data.connected === false) {
        setLiveTelnetId(null);
        setRemoteBufferHint('');
      }
    } catch {}
  };

  const handleConnectSerial = async () => {
    if (liveTelnetId) {
      await fetch(`/api/telnet/sessions/${liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
      setLiveTelnetId(null);
    }
    if (liveSerialId) {
      await serialConsoleManager.disconnect(liveSerialId);
      setLiveSerialId(null);
      setLiveSerialLabel('');
    }
    setConnecting(true);
    setRemoteBufferHint('');
    setShowCliDrawer(true);
    const res = await serialConsoleManager.connect({
      baudRate: serialBaud,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      lineEnding: serialLineEnding,
      onData: (chunk) => {
        setConsoleLines((prev) => appendRawOutput(prev, chunk));
      },
      onClose: (reason) => {
        setLiveSerialId(null);
        setLiveSerialLabel('');
        setRemoteBufferHint('');
        setConsoleLines((prev) => [
          ...prev,
          { id: `sdisc_${Date.now()}`, type: 'error', text: `\n  [Console Cable Disconnected] ${reason || 'Port closed.'}` },
        ]);
      },
      onError: (msg) => {
        setConsoleLines((prev) => [
          ...prev,
          { id: `serr_${Date.now()}`, type: 'error', text: `\n  [Serial Error] ${msg}` },
        ]);
      },
    });
    setConnecting(false);

    if (res.ok && res.id) {
      setLiveSerialId(res.id);
      setLiveSerialLabel(`${res.chipName || 'COM'} @ ${serialBaud}`);
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `sok_${Date.now()}`,
          type: 'success',
          text: `  [CONSOLE CABLE LIVE] ${activeBrand} via ${res.label} (${serialBaud} bps 8-N-1)`,
        },
        {
          id: `stip_${Date.now()}`,
          type: 'info',
          text: '  WebUI changes now push directly over USB Console Cable. Press Enter to wake device prompt.',
        },
      ]);
      showToast(`Console Cable connected to ${activeBrand} @ ${serialBaud} bps`);
      setTimeout(() => {
        if (res.id) serialConsoleManager.write(res.id, '', false);
      }, 250);
    } else if (!res.isCancelled) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `sfail_${Date.now()}`, type: 'error', text: `  [-] Console Cable: ${res.error || 'Failed to open COM port.'}` },
      ]);
      showToast(res.isIframeBlocked ? 'Open in standalone Chrome/Edge tab for USB COM port' : res.error || 'Serial failed');
    }
  };

  const handleDisconnectSerial = async () => {
    if (!liveSerialId) return;
    await serialConsoleManager.disconnect(liveSerialId);
    setLiveSerialId(null);
    setLiveSerialLabel('');
    setRemoteBufferHint('');
    setConsoleLines((prev) => [...prev, { id: `sud_${Date.now()}`, type: 'info', text: '  [Console Cable Disconnected by user]' }]);
  };

  const handleSendSerialBreak = async () => {
    if (!liveSerialId) return;
    const ok = await serialConsoleManager.sendBreak(liveSerialId, 250);
    setConsoleLines((prev) => [
      ...prev,
      {
        id: `sbrk_${Date.now()}`,
        type: ok ? 'info' : 'error',
        text: ok ? '  [RS-232 BREAK Signal Sent (250ms)]' : '  [Break not supported by this USB adapter]',
      },
    ]);
  };

  const handleConnectTelnet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (connMode === 'console') {
      await handleConnectSerial();
      return;
    }
    const hostClean = telnetHost.trim();
    if (!hostClean) return;
    if (liveSerialId) {
      await serialConsoleManager.disconnect(liveSerialId);
      setLiveSerialId(null);
      setLiveSerialLabel('');
    }
    if (liveTelnetId) {
      await fetch(`/api/telnet/sessions/${liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
      setLiveTelnetId(null);
    }
    const shouldJump = Boolean(
      activeProfile?.server &&
        !isPrivateIp(activeProfile.server) &&
        activeProfile.server.trim() !== hostClean &&
        isPrivateIp(hostClean)
    );
    setConnecting(true);
    setRemoteBufferHint('');
    setShowCliDrawer(true);
    setConsoleLines((prev) => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        type: 'info',
        text: shouldJump
          ? `  Connecting ${activeBrand} WebUI Bridge to LAN ${hostClean}:${telnetPort} via MikroTik Jump (${activeProfile!.server})...`
          : `  Connecting ${activeBrand} WebUI Bridge to ${hostClean}:${telnetPort}...`,
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
      if (data.connected && data.sessionId) {
        setLiveTelnetId(data.sessionId);
        setConsoleLines((prev) => {
          const next: ConsoleLine[] = [
            ...prev,
            { id: `ok_${Date.now()}`, type: 'success', text: `  [LIVE CONNECTED] ${activeBrand} @ ${hostClean}:${telnetPort} (${data.latencyMs}ms)` },
          ];
          return data.output ? appendRawOutput(next, data.output) : next;
        });
        showToast(`Connected to ${activeBrand} (${hostClean})`);
      } else {
        setConsoleLines((prev) => [
          ...prev,
          { id: `f_${Date.now()}`, type: 'error', text: `  [-] Telnet Failed: ${data.error || 'Host unreachable'}` },
        ]);
      }
    } catch (err: any) {
      setConsoleLines((prev) => [...prev, { id: `e_${Date.now()}`, type: 'error', text: `  [-] Error: ${err?.message}` }]);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectTelnet = async () => {
    if (liveSerialId) {
      await handleDisconnectSerial();
      return;
    }
    if (!liveTelnetId) return;
    await fetch(`/api/telnet/sessions/${liveTelnetId}`, { method: 'DELETE' }).catch(() => {});
    setLiveTelnetId(null);
    setRemoteBufferHint('');
    setConsoleLines((prev) => [...prev, { id: `ud_${Date.now()}`, type: 'info', text: '  [Disconnected by user]' }]);
  };

  const emitWebUiCli = async (title: string, cli: string, forcePush = false) => {
    setLastActionTitle(`${activeBrand}: ${title}`);
    setLastCliScript(cli);
    const lines = cli
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if ((liveTelnetId || liveSerialId) && (autoPush || forcePush)) {
      setPushing(true);
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `ph_${Date.now()}`,
          type: 'info',
          text: `\n  >>> [WebUI Push via ${liveSerialId ? 'Console Cable' : 'Telnet'}: ${title}]`,
        },
      ]);
      for (const cmd of lines) {
        await sendRawTelnet(cmd, false);
        await new Promise((r) => setTimeout(r, 220));
      }
      setPushing(false);
      showToast(`Applied "${title}" live on ${activeBrand} (${liveSerialId ? 'Console Cable' : 'Telnet'})!`);
    } else {
      setConsoleLines((prev) => [
        ...prev,
        { id: `gh_${Date.now()}`, type: 'success', text: `\n  [WebUI -> ${activeBrand} CLI: ${title}]` },
        { id: `gb_${Date.now()}`, type: 'output', text: lines.map((l) => `  ${l}`).join('\n') },
      ]);
      showToast(`${title} — ${activeBrand} CLI ready`);
    }
  };

  const updateCurrentDevice = (updater: (prev: WebUiDevicePreset) => WebUiDevicePreset) => {
    setDevices((prev) => ({
      ...prev,
      [activeBrand]: updater(prev[activeBrand]),
    }));
  };

  // =========================================================================
  // WEBUI GRAPHICAL MUTATION HANDLERS
  // =========================================================================

  const handleTogglePort = async (iface: WebUiInterface) => {
    const nextUp = !iface.adminUp;
    updateCurrentDevice((d) => ({
      ...d,
      interfaces: d.interfaces.map((item) =>
        item.id === iface.id ? { ...item, adminUp: nextUp, linkUp: nextUp } : item
      ),
    }));
    await emitWebUiCli(
      `${nextUp ? 'Enable' : 'Disable'} ${iface.name}`,
      genInterfaceToggleCli(activeBrand, iface.name, nextUp)
    );
  };

  const handleSaveEditedIface = async (iface: WebUiInterface) => {
    const updated: WebUiInterface = {
      ...iface,
      ip: editIfaceIp.trim() || iface.ip,
      maskOrCidr: editIfaceMask.trim() || iface.maskOrCidr,
      desc: editIfaceDesc.trim(),
    };
    updateCurrentDevice((d) => ({
      ...d,
      interfaces: d.interfaces.map((i) => (i.id === iface.id ? updated : i)),
    }));
    setEditingIfaceId(null);
    await emitWebUiCli(`Update IP on ${updated.name}`, genInterfaceIpCli(activeBrand, updated));
  };

  const handleAddInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIfaceName.trim() || !newIfaceIp.trim()) return;
    const created: WebUiInterface = {
      id: `if_${Date.now()}`,
      name: newIfaceName.trim(),
      type: newIfaceName.toLowerCase().includes('vlan') || newIfaceName.toLowerCase().includes('irb') ? 'VLAN/IRB' : 'Ethernet',
      ip: newIfaceIp.trim(),
      maskOrCidr: newIfaceMask.trim() || '/24',
      speed: '1Gbps',
      adminUp: true,
      linkUp: true,
      desc: newIfaceDesc.trim() || 'Added via WebUI',
    };
    updateCurrentDevice((d) => ({ ...d, interfaces: [...d.interfaces, created] }));
    setNewIfaceName('');
    setNewIfaceIp('');
    setNewIfaceDesc('');
    await emitWebUiCli(`Assign IP ${created.ip} to ${created.name}`, genInterfaceIpCli(activeBrand, created));
  };

  const handleAddVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const vid = parseInt(newVlanId, 10);
    if (isNaN(vid) || vid < 1 || vid > 4094) return;
    const created: WebUiVlan = {
      id: `vl_${Date.now()}`,
      vlanId: vid,
      name: newVlanName.trim() || `VLAN${vid}`,
      taggedPorts: newVlanPorts.trim() || (activeBrand === 'Huawei' ? '0/9 0' : currentDevice.interfaces[0]?.name || ''),
      untaggedPorts: '',
    };
    updateCurrentDevice((d) => ({ ...d, vlans: [...d.vlans, created] }));
    await emitWebUiCli(`Create VLAN ${created.vlanId} (${created.name})`, genVlanAddCli(activeBrand, created));
  };

  const handleDeleteVlan = async (vlan: WebUiVlan) => {
    updateCurrentDevice((d) => ({ ...d, vlans: d.vlans.filter((v) => v.id !== vlan.id) }));
    await emitWebUiCli(`Delete VLAN ${vlan.vlanId}`, genVlanDeleteCli(activeBrand, vlan));
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteDst.trim() || !newRouteGw.trim()) return;
    const cidr = maskToCidr(newRouteMask);
    const mask = cidrToMask(cidr);
    const created: WebUiRoute = {
      id: `rt_${Date.now()}`,
      destination: newRouteDst.trim(),
      mask,
      cidr,
      gateway: newRouteGw.trim(),
      comment: newRouteComment.trim() || 'WebUI Route',
    };
    updateCurrentDevice((d) => ({ ...d, routes: [...d.routes, created] }));
    await emitWebUiCli(`Add Route ${created.destination}/${created.cidr} -> ${created.gateway}`, genRouteAddCli(activeBrand, created));
  };

  const handleDeleteRoute = async (r: WebUiRoute) => {
    updateCurrentDevice((d) => ({ ...d, routes: d.routes.filter((x) => x.id !== r.id) }));
    await emitWebUiCli(`Delete Route ${r.destination}/${r.cidr}`, genRouteDeleteCli(activeBrand, r));
  };

  const handleAddOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOnuSn.trim()) return;
    const created: WebUiOnu = {
      id: `onu_${Date.now()}`,
      port: newOnuPort.trim() || '0/1/0',
      onuId: parseInt(newOnuId, 10) || 0,
      mode: newOnuMode,
      snOrMac: newOnuSn.trim(),
      desc: newOnuDesc.trim() || 'Client-ONU',
      vlan: parseInt(newOnuVlan, 10) || 200,
      lineProfile: 10,
      srvProfile: 10,
      rxDbm: -19.1,
      status: 'online',
    };
    updateCurrentDevice((d) => ({ ...d, onus: [created, ...d.onus] }));
    setNewOnuId(String(created.onuId + 1));
    await emitWebUiCli(`Add ${created.mode} ONU ${created.port}:${created.onuId}`, genOnuAddCli(activeBrand, created));
  };

  const handleDeleteOnu = async (onu: WebUiOnu) => {
    updateCurrentDevice((d) => ({ ...d, onus: d.onus.filter((x) => x.id !== onu.id) }));
    await emitWebUiCli(`Delete ONU ${onu.port}:${onu.onuId}`, genOnuDeleteCli(activeBrand, onu));
  };

  const handleAddPolicyOrPpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolSrc.trim()) return;
    const created: WebUiPolicyOrPpp = {
      id: `pol_${Date.now()}`,
      kind: activeBrand === 'MikroTik' && (newPolAction === 'pppoe' || newPolAction === 'pptp') ? 'ppp' : 'firewall',
      name: newPolName.trim() || newPolSrc.trim(),
      srcOrUser: newPolSrc.trim(),
      dstOrProfile: newPolDst.trim() || 'any',
      actionOrService: newPolAction.trim() || 'allow',
      enabled: true,
      comment: newPolComment.trim() || 'WebUI Entry',
    };
    updateCurrentDevice((d) => ({ ...d, policies: [created, ...d.policies] }));
    await emitWebUiCli(`Add ${created.kind === 'ppp' ? 'PPP User' : 'Rule'} ${created.name}`, genPolicyOrPppAddCli(activeBrand, created));
  };

  const handleApplyHostname = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = hostnameInput.trim().replace(/\s+/g, '-') || currentDevice.hostname;
    setHostnameInput(h);
    updateCurrentDevice((d) => ({ ...d, hostname: h }));
    await emitWebUiCli(`Change Hostname to ${h}`, genHostnameCli(activeBrand, h));
  };

  // =========================================================================
  // RIGHT DRAWER: MID-COMMAND TAB & '?' HELP ENGINE
  // =========================================================================

  const activePrompt = liveSerialId
    ? `${activeBrand}@COM> `
    : liveTelnetId
    ? `${activeBrand}@${telnetHost}> `
    : `${currentDevice.hostname}# `;

  const handleQuestionHelp = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputVal;
    if (isLiveBridgeConnected) {
      setRemoteBufferHint((p) => `${p}${text}`);
      setInputVal('');
      await sendRawTelnet(`${text}?`, true);
      inputRef.current?.focus();
      return;
    }
    const helpRes = getCliHelp(activeBrand, text);
    setConsoleLines((prev) => [
      ...prev,
      { id: `qp_${Date.now()}`, type: 'prompt', text: `${activePrompt}${text}?` },
      { id: `qo_${Date.now()}`, type: 'output', text: helpRes.formatted },
    ]);
    setInputVal(text);
    inputRef.current?.focus();
  };

  const handleTabComplete = async () => {
    if (isLiveBridgeConnected) {
      setRemoteBufferHint((p) => `${p}${inputVal}`);
      setInputVal('');
      await sendRawTelnet(`${inputVal}\t`, true);
      inputRef.current?.focus();
      return;
    }
    const tabRes = getCliTabCompletion(activeBrand, inputVal);
    if (tabRes.changed) setInputVal(tabRes.completed);
    if (tabRes.formatted) {
      setConsoleLines((prev) => [
        ...prev,
        { id: `tp_${Date.now()}`, type: 'prompt', text: `${activePrompt}${inputVal}<Tab>` },
        { id: `to_${Date.now()}`, type: 'output', text: tabRes.formatted! },
      ]);
    }
    inputRef.current?.focus();
  };

  const handleConsoleSubmit = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (isLiveBridgeConnected) {
      if (trimmed.toLowerCase() === 'clear') {
        setConsoleLines([]);
        setInputVal('');
        setRemoteBufferHint('');
        return;
      }
      setInputVal('');
      setRemoteBufferHint('');
      await sendRawTelnet(cmd, false);
      return;
    }
    if (!trimmed) return;
    if (trimmed === '?' || trimmed.endsWith('?')) {
      handleQuestionHelp(trimmed.slice(0, -1));
      return;
    }
    setInputVal('');
    if (trimmed.toLowerCase() === 'clear') {
      setConsoleLines([]);
      return;
    }
    const helpHint = getCliHelp(activeBrand, trimmed);
    setConsoleLines((prev) => [
      ...prev,
      { id: `cp_${Date.now()}`, type: 'prompt', text: `${activePrompt}${trimmed}` },
      {
        id: `co_${Date.now()}`,
        type: 'output',
        text:
          trimmed.toLowerCase() === 'help'
            ? getCliHelp(activeBrand, '').formatted
            : helpHint.matches.length > 0
            ? `  [${activeBrand}] Executed "${trimmed}". Related subcommands:\n${helpHint.formatted}`
            : `  [${activeBrand}] Sent "${trimmed}" (Connect Live Telnet above to execute directly on hardware).`,
      },
    ]);
  };

  const suggestionBasis = liveTelnetId ? `${remoteBufferHint}${inputVal}` : inputVal;
  const cliSuggestions = getCliSuggestions(activeBrand, suggestionBasis);
  const filteredOnus = currentDevice.onus.filter((o) => {
    const q = onuSearch.trim().toLowerCase();
    if (!q) return true;
    return o.snOrMac.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q) || o.port.includes(q);
  });

  const visibleBrands =
    roleFilter === 'ALL' ? ALL_BRANDS : ALL_BRANDS.filter((b) => devices[b].category === roleFilter);

  const navItems: { id: WebUiSection; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'interfaces', label: 'Interfaces & IPs', icon: Network, badge: currentDevice.interfaces.length },
    ...(currentDevice.supportsSwitchL2
      ? [{ id: 'switch-l2' as WebUiSection, label: 'Switch & L2 Ports', icon: Cpu, badge: currentDevice.switchPorts.length }]
      : []),
    { id: 'vlans', label: 'VLANs', icon: Layers, badge: currentDevice.vlans.length },
    { id: 'routing', label: 'IP Routing', icon: Route, badge: currentDevice.routes.length },
    ...(currentDevice.supportsDynamicRouting
      ? [{ id: 'bgp-ospf' as WebUiSection, label: 'BGP & OSPF', icon: GitBranch, badge: currentDevice.bgpPeers.length + currentDevice.ospfEntries.length }]
      : []),
    ...(currentDevice.isOlt
      ? [{ id: 'olt-onus' as WebUiSection, label: 'OLT & ONUs (SN/MAC)', icon: Wifi, badge: currentDevice.onus.length }]
      : []),
    ...(!currentDevice.isOlt
      ? [
          {
            id: 'security-ppp' as WebUiSection,
            label: activeBrand === 'MikroTik' ? 'PPP / Firewall / NAT' : 'Firewall / Security',
            icon: Shield,
            badge: currentDevice.policies.length,
          },
        ]
      : []),
    { id: 'notepad', label: 'Command Notepad', icon: FileText, badge: commandNotes.length },
    { id: 'commands', label: 'Command Center', icon: TerminalIcon },
    { id: 'system', label: 'System & Hostname', icon: Sliders },
  ];

  return (
    <div className="space-y-4">
      {/* Top Universal WebUI Header + Role Filter + 12-Brand Switcher */}
      <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-black tracking-tight flex items-center gap-2">
              <Globe className="w-5 h-5 text-black" />
              <span>Multi-Vendor OLT, Router &amp; Switch WebUI</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              ১২টি ব্র্যান্ড (OLT · Router · Managed Switch) সরাসরি আসল WebUI-এর মতো গ্রাফিক্যালি কন্ট্রোল করুন — প্রতিটি অ্যাকশন সাথে সাথে আসল CLI বানিয়ে লাইভ Telnet-এ পুশ করবে।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => emitWebUiCli('Save Configuration', genSaveConfigCli(activeBrand))}
              className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save / Commit</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCliDrawer(!showCliDrawer)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {showCliDrawer ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span>{showCliDrawer ? 'Full-Screen WebUI' : 'Show Live Telnet'}</span>
            </button>
          </div>
        </div>

        {/* Device Role Segmented Filter + Brand Tabs + Model Selector */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'All (12)' },
                  { id: 'OLT', label: 'OLTs (5)' },
                  { id: 'Router / Firewall', label: 'Routers & Firewalls (4)' },
                  { id: 'Switch', label: 'Switches (3)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRoleFilter(tab.id);
                    if (tab.id !== 'ALL' && devices[activeBrand].category !== tab.id) {
                      const firstMatch = ALL_BRANDS.find((b) => devices[b].category === tab.id);
                      if (firstMatch) handleSelectBrand(firstMatch);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                    roleFilter === tab.id ? 'bg-white text-black shadow-xs' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-slate-600">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
              >
                {currentDevice.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {visibleBrands.map((brand) => {
              const active = brand === activeBrand;
              const catShort = devices[brand].category === 'OLT' ? 'OLT' : devices[brand].category === 'Switch' ? 'SW' : 'RTR';
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => handleSelectBrand(brand)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition border flex items-center gap-1.5 ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-slate-50 text-black border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>{brand}</span>
                  <span className={`text-[10px] font-mono ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                    {catShort}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Telnet & Physical Console Cable (USB / COM) Bridge Bar */}
        <form
          onSubmit={handleConnectTelnet}
          className="pt-2 border-t border-slate-200 flex flex-col xl:flex-row items-stretch xl:items-center gap-2"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex items-center bg-slate-100 border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setConnMode('telnet')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                  connMode === 'telnet' ? 'bg-black text-white' : 'text-slate-700 hover:text-black'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>Telnet IP</span>
              </button>
              <button
                type="button"
                onClick={() => setConnMode('console')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition ${
                  connMode === 'console' ? 'bg-black text-white' : 'text-slate-700 hover:text-black'
                }`}
              >
                <Usb className="w-3 h-3" />
                <span>Console Cable</span>
              </button>
            </div>
            {isLiveBridgeConnected && (
              <span className="text-[11px] font-mono font-bold text-emerald-700">
                LIVE: {liveSerialId ? liveSerialLabel : telnetHost}
              </span>
            )}
          </div>

          {connMode === 'telnet' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-1">
              <input
                type="text"
                value={telnetHost}
                onChange={(e) => setTelnetHost(e.target.value)}
                placeholder="Device IP"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="number"
                value={telnetPort}
                onChange={(e) => setTelnetPort(parseInt(e.target.value, 10) || 23)}
                placeholder="23"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="text"
                value={telnetUser}
                onChange={(e) => setTelnetUser(e.target.value)}
                placeholder="Username"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="password"
                value={telnetPass}
                onChange={(e) => setTelnetPass(e.target.value)}
                placeholder="Password"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 flex-1 items-center">
              <select
                value={serialBaud}
                onChange={(e) => setSerialBaud(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
              >
                {BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} bps{rate === 9600 ? ' (Cisco/OLT)' : rate === 115200 ? ' (MikroTik)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={serialLineEnding}
                onChange={(e) => {
                  const val = e.target.value as SerialLineEnding;
                  setSerialLineEnding(val);
                  if (liveSerialId) serialConsoleManager.setLineEnding(liveSerialId, val);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              >
                <option value={'\r'}>8-N-1 · CR (\r)</option>
                <option value={'\r\n'}>8-N-1 · CRLF (\r\n)</option>
              </select>
              <span className="col-span-2 sm:col-span-1 text-[11px] font-mono text-slate-600 truncate">
                {isWebSerialSupported()
                  ? 'FTDI / PL2303 / CH340 / CP2102 USB-COM'
                  : 'Use Chrome/Edge Desktop or Android USB-OTG'}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-black cursor-pointer">
              <input
                type="checkbox"
                checked={autoPush}
                onChange={(e) => setAutoPush(e.target.checked)}
                className="accent-black rounded"
              />
              <span>Auto-Push</span>
            </label>
            {!isLiveBridgeConnected ? (
              <button
                type="submit"
                disabled={connecting}
                className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {connMode === 'console' && <Usb className="w-3.5 h-3.5" />}
                <span>
                  {connecting
                    ? 'Connecting...'
                    : connMode === 'console'
                    ? 'Connect Console'
                    : 'Connect Live'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnectTelnet}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>
      </div>

      {toast && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* MAIN WEBUI WORKSPACE + OPTIONAL LIVE TELNET SPLIT DRAWER */}
      <div className={`grid grid-cols-1 gap-5 items-start ${showCliDrawer ? 'xl:grid-cols-12' : ''}`}>
        {/* NATIVE WEBUI WINDOW */}
        <div className={`${showCliDrawer ? 'xl:col-span-8' : 'w-full'} bg-white border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs`}>
          {/* WebUI Top Window Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-black text-white font-mono text-[10px] font-bold uppercase">
                {activeBrand}
              </span>
              <span className="text-sm font-bold text-black">{currentDevice.webUiTitle}</span>
              <span className="text-[11px] font-mono text-slate-600 hidden sm:inline">
                · {currentDevice.hostname} ({currentDevice.osLabel})
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-700">
              {liveTelnetId ? `● Connected to ${telnetHost}` : '● Interactive WebUI Ready'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
            {/* Native Left Sidebar Menu */}
            <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-2.5 flex md:flex-col gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 whitespace-nowrap cursor-pointer transition ${
                      active
                        ? 'bg-black text-white'
                        : 'text-black hover:bg-slate-200/80'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          active ? 'bg-white/20 text-white' : 'bg-white border border-slate-300 text-black'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </aside>

            {/* WebUI Main Content Pane */}
            <div className="md:col-span-9 p-4 space-y-4">
              {/* SECTION 1: DASHBOARD OVERVIEW + VISUAL FRONT-PANEL PORTS */}
              {activeSection === 'dashboard' && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-600">Hostname</div>
                      <div className="text-xs font-bold font-mono text-black mt-1 truncate">{currentDevice.hostname}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-600">Interfaces UP</div>
                      <div className="text-sm font-bold font-mono text-emerald-700 mt-1">
                        {currentDevice.interfaces.filter((i) => i.adminUp).length} / {currentDevice.interfaces.length}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-600">Active VLANs</div>
                      <div className="text-sm font-bold font-mono text-black mt-1">{currentDevice.vlans.length}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-mono uppercase text-slate-600">
                        {currentDevice.isOlt ? 'Registered ONUs' : 'IP Routes'}
                      </div>
                      <div className="text-sm font-bold font-mono text-black mt-1">
                        {currentDevice.isOlt ? currentDevice.onus.length : currentDevice.routes.length}
                      </div>
                    </div>
                  </div>

                  {/* Visual Interactive Front-Panel Port LEDs */}
                  <div className="rounded-xl border border-slate-300 bg-white p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black">
                        Visual Front-Panel Ports ({selectedModel}) — Click any Port to Toggle UP / DOWN
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">Real-Time CLI Sync</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {currentDevice.interfaces.map((iface) => (
                        <button
                          key={iface.id}
                          type="button"
                          onClick={() => handleTogglePort(iface)}
                          className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                            iface.adminUp
                              ? 'bg-emerald-50/70 border-emerald-400 hover:border-black'
                              : 'bg-slate-100 border-slate-300 opacity-75 hover:border-black'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-mono font-bold text-black truncate">{iface.name}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                iface.adminUp ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <div className="text-[10px] font-mono text-slate-700 mt-1 truncate">
                            {iface.ip !== 'unassigned' ? `${iface.ip} ${iface.maskOrCidr}` : iface.speed}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">{iface.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Summary Shortcuts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="text-xs font-bold text-black">Active Static IP Routes</div>
                      {currentDevice.routes.map((r) => (
                        <div key={r.id} className="text-[11px] font-mono bg-white px-2.5 py-1.5 rounded border border-slate-200 flex justify-between">
                          <span className="font-bold text-black">{r.destination}/{r.cidr}</span>
                          <span className="text-emerald-800">via {r.gateway}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="text-xs font-bold text-black">
                        {currentDevice.isOlt ? 'Optical PON / ONU Health' : 'Firewall / PPP Summary'}
                      </div>
                      {currentDevice.isOlt
                        ? currentDevice.onus.slice(0, 3).map((o) => (
                            <div key={o.id} className="text-[11px] font-mono bg-white px-2.5 py-1.5 rounded border border-slate-200 flex justify-between">
                              <span className="truncate font-bold text-black">{o.port}:{o.onuId} {o.desc}</span>
                              <span className={o.status === 'online' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                                {o.status === 'online' ? `${o.rxDbm} dBm` : 'LOS'}
                              </span>
                            </div>
                          ))
                        : currentDevice.policies.slice(0, 3).map((p) => (
                            <div key={p.id} className="text-[11px] font-mono bg-white px-2.5 py-1.5 rounded border border-slate-200 flex justify-between">
                              <span className="truncate font-bold text-black">{p.name}</span>
                              <span className="text-emerald-700 font-bold uppercase">{p.actionOrService}</span>
                            </div>
                          ))}
                    </div>
                  </div>
                </>
              )}

              {/* SECTION 2: INTERFACES & IP ADDRESSES */}
              {activeSection === 'interfaces' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddInterface} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-black">+ Assign IP / Add Interface ({activeBrand})</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        required
                        value={newIfaceName}
                        onChange={(e) => setNewIfaceName(e.target.value)}
                        placeholder={activeBrand === 'Juniper' ? 'xe-0/1/1.0' : activeBrand === 'MikroTik' ? 'ether3' : 'Vlan200'}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        required
                        value={newIfaceIp}
                        onChange={(e) => setNewIfaceIp(e.target.value)}
                        placeholder="IP (10.10.10.1)"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        value={newIfaceMask}
                        onChange={(e) => setNewIfaceMask(e.target.value)}
                        placeholder="/24 or 255.255.255.0"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        value={newIfaceDesc}
                        onChange={(e) => setNewIfaceDesc(e.target.value)}
                        placeholder="Description"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Apply IP to Interface</span>
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-700">
                          <th className="py-2 px-3">Interface</th>
                          <th className="py-2 px-3">IP / Mask</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Control</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentDevice.interfaces.map((iface) => {
                          const isEditing = editingIfaceId === iface.id;
                          return (
                            <tr key={iface.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono">
                                <div className="font-bold text-black">{iface.name}</div>
                                <div className="text-[10px] text-slate-600">{iface.desc}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                {isEditing ? (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <input
                                      type="text"
                                      value={editIfaceIp}
                                      onChange={(e) => setEditIfaceIp(e.target.value)}
                                      className="w-28 bg-white border border-black rounded px-1.5 py-0.5 text-xs"
                                    />
                                    <input
                                      type="text"
                                      value={editIfaceMask}
                                      onChange={(e) => setEditIfaceMask(e.target.value)}
                                      className="w-24 bg-white border border-black rounded px-1.5 py-0.5 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditedIface(iface)}
                                      className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-black font-semibold">
                                    {iface.ip} {iface.maskOrCidr}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span className={iface.adminUp ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                                  {iface.adminUp ? 'UP' : 'DOWN'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingIfaceId(isEditing ? null : iface.id);
                                      setEditIfaceIp(iface.ip === 'unassigned' ? '' : iface.ip);
                                      setEditIfaceMask(iface.maskOrCidr || '/24');
                                      setEditIfaceDesc(iface.desc);
                                    }}
                                    className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Edit IP</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePort(iface)}
                                    className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer border ${
                                      iface.adminUp
                                        ? 'bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border-red-200'
                                        : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-300'
                                    }`}
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>{iface.adminUp ? 'Disable' : 'Enable'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 3: VLANS */}
              {activeSection === 'vlans' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddVlan} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-black">+ Create VLAN ({activeBrand})</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number"
                        min={1}
                        max={4094}
                        required
                        value={newVlanId}
                        onChange={(e) => setNewVlanId(e.target.value)}
                        placeholder="VLAN ID (e.g. 300)"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        value={newVlanName}
                        onChange={(e) => setNewVlanName(e.target.value)}
                        placeholder="VLAN Name"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        value={newVlanPorts}
                        onChange={(e) => setNewVlanPorts(e.target.value)}
                        placeholder={activeBrand === 'Huawei' ? 'Uplink (0/9 0)' : 'Parent / Trunk Port'}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create VLAN</span>
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                          <th className="py-2 px-3">VLAN ID</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Tagged / Parent Port</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentDevice.vlans.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-black">{v.vlanId}</td>
                            <td className="py-2 px-3 text-black">{v.name}</td>
                            <td className="py-2 px-3 text-slate-700">{v.taggedPorts || '—'}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteVlan(v)}
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

              {/* SECTION 4: IP ROUTING */}
              {activeSection === 'routing' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddRoute} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-black">+ Add Static IP Route ({activeBrand})</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        required
                        value={newRouteDst}
                        onChange={(e) => setNewRouteDst(e.target.value)}
                        placeholder="Dst Network (0.0.0.0)"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <input
                        type="text"
                        required
                        value={newRouteMask}
                        onChange={(e) => setNewRouteMask(e.target.value)}
                        placeholder="Mask / CIDR"
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
                    <div className="flex justify-end">
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Static Route</span>
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                          <th className="py-2 px-3">Destination</th>
                          <th className="py-2 px-3">Mask</th>
                          <th className="py-2 px-3">Gateway</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentDevice.routes.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-black">
                              <div>{r.destination}/{r.cidr}</div>
                              <div className="text-[10px] font-sans font-normal text-slate-600">{r.comment}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-700">{r.mask}</td>
                            <td className="py-2 px-3 font-bold text-emerald-800">{r.gateway}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteRoute(r)}
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

              {/* SECTION 4.5: SWITCH & L2 PORTS (ACCESS/TRUNK, LACP/LAG, STP, MAC FINDER) */}
              {activeSection === 'switch-l2' && (
                <SwitchL2Panel
                  brand={activeBrand}
                  device={currentDevice}
                  onUpdateDevice={updateCurrentDevice}
                  onEmitCli={emitWebUiCli}
                />
              )}

              {/* SECTION 4.8: BGP & OSPF DYNAMIC ROUTING */}
              {activeSection === 'bgp-ospf' && (
                <BgpOspfPanel
                  brand={activeBrand}
                  device={currentDevice}
                  onUpdateDevice={updateCurrentDevice}
                  onEmitCli={emitWebUiCli}
                />
              )}

              {/* SECTION 5: MULTI-VENDOR OLT & ONUs (HUAWEI / ZTE / BDCOM / VSOL / C-DATA) */}
              {activeSection === 'olt-onus' && (
                <div className="space-y-4">
                  {/* 1-Click Live OLT Diagnostics Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs font-bold text-black">
                      {activeBrand} Live OLT Diagnostics:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          emitWebUiCli(
                            `${activeBrand} Auto-Find Unregistered ONUs`,
                            genOltDiagnosticCli(activeBrand, 'autofind')
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-black hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Auto-Find ONUs
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          emitWebUiCli(
                            `${activeBrand} Check All Optical Power`,
                            genOltDiagnosticCli(activeBrand, 'optical-all')
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-[11px] font-bold cursor-pointer"
                      >
                        Check All Optics (dBm)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          emitWebUiCli(
                            `${activeBrand} Show OLT MAC Table`,
                            genOltDiagnosticCli(activeBrand, 'mac-all')
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-[11px] font-bold cursor-pointer"
                      >
                        OLT MAC Table
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleAddOnu} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-black">+ Add ONU ({activeBrand} {newOnuMode})</span>
                      <div className="flex items-center gap-1">
                        {(['GPON', 'EPON'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setNewOnuMode(m)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              newOnuMode === m ? 'bg-black text-white' : 'bg-white text-black border border-slate-300'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={newOnuPort}
                        onChange={(e) => setNewOnuPort(e.target.value)}
                        placeholder="Port (0/1/0)"
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="number"
                        value={newOnuId}
                        onChange={(e) => setNewOnuId(e.target.value)}
                        placeholder="ONU ID"
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="text"
                        required
                        value={newOnuSn}
                        onChange={(e) => setNewOnuSn(e.target.value)}
                        placeholder={newOnuMode === 'GPON' ? 'GPON SN' : 'EPON MAC'}
                        className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="number"
                        value={newOnuVlan}
                        onChange={(e) => setNewOnuVlan(e.target.value)}
                        placeholder="VLAN"
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newOnuDesc}
                        onChange={(e) => setNewOnuDesc(e.target.value)}
                        placeholder="Customer Name / PPPoE ID"
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
                      />
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add ONU</span>
                      </button>
                    </div>
                  </form>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={onuSearch}
                      onChange={(e) => setOnuSearch(e.target.value)}
                      placeholder="Find ONU by SN, MAC, Port or Customer Description..."
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                          <th className="py-2 px-3">Port:ID</th>
                          <th className="py-2 px-3">SN / MAC &amp; Desc</th>
                          <th className="py-2 px-3">VLAN</th>
                          <th className="py-2 px-3">Optical Rx</th>
                          <th className="py-2 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredOnus.map((onu) => {
                          const isLos = onu.status !== 'online';
                          const isWarn = !isLos && onu.rxDbm < -24.5;
                          return (
                            <tr key={onu.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-black tabular-nums">
                                {onu.port}:{onu.onuId}
                                <div className="text-[10px] text-slate-600">{onu.mode}</div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-bold text-black text-[11px]">{onu.snOrMac}</div>
                                <div className="text-[10px] font-sans text-slate-600">{onu.desc}</div>
                              </td>
                              <td className="py-2 px-3 text-black tabular-nums">{onu.vlan}</td>
                              <td
                                className={`py-2 px-3 font-bold tabular-nums ${
                                  isLos ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-emerald-700'
                                }`}
                              >
                                {isLos ? 'LOS (Offline)' : `${onu.rxDbm} dBm · ${isWarn ? 'Weak' : 'Good'}`}
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      emitWebUiCli(
                                        `Check Optical ${onu.port}:${onu.onuId}`,
                                        genOltDiagnosticCli(activeBrand, 'onu-optical', onu)
                                      )
                                    }
                                    className="p-1 rounded bg-white hover:bg-slate-200 text-black border border-slate-300 cursor-pointer"
                                    title="Read ONU Optical Power"
                                  >
                                    <Activity className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      emitWebUiCli(
                                        `Reboot ONU ${onu.port}:${onu.onuId}`,
                                        genOltDiagnosticCli(activeBrand, 'onu-reboot', onu)
                                      )
                                    }
                                    className="p-1 rounded bg-white hover:bg-amber-100 text-black border border-slate-300 cursor-pointer"
                                    title="Reboot ONU"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOnu(onu)}
                                    className="p-1 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"
                                    title="Delete ONU"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 5.4: PERSONAL COMMAND NOTEPAD (SAVE & 1-CLICK APPLY) */}
              {activeSection === 'notepad' && (
                <CommandNotepadPanel
                  activeVendor={activeBrand}
                  isLiveConnected={isLiveBridgeConnected}
                  onApplyCommands={(title, cmds) => emitWebUiCli(title, cmds, true)}
                  draftPrefill={notepadDraft}
                  onClearDraftPrefill={() => setNotepadDraft(null)}
                />
              )}

              {/* SECTION 5.5: FULL MULTI-VENDOR COMMAND CENTER */}
              {activeSection === 'commands' && (
                <CommandCenterPanel brand={activeBrand} onEmitCli={emitWebUiCli} />
              )}

              {/* SECTION 6: PPP / FIREWALL / NAT / SECURITY POLICIES */}
              {activeSection === 'security-ppp' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddPolicyOrPpp} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-bold text-black">
                      + Add {activeBrand === 'MikroTik' ? 'PPP Secret / NAT Rule' : 'Security Policy / ACL'} ({activeBrand})
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={newPolName}
                        onChange={(e) => setNewPolName(e.target.value)}
                        placeholder="Rule / Account Name"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="text"
                        required
                        value={newPolSrc}
                        onChange={(e) => setNewPolSrc(e.target.value)}
                        placeholder={activeBrand === 'MikroTik' ? 'Username / Src CIDR' : 'Source Zone / IP'}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="text"
                        value={newPolDst}
                        onChange={(e) => setNewPolDst(e.target.value)}
                        placeholder={activeBrand === 'MikroTik' ? 'Profile / Out-Iface' : 'Dest Zone / IP'}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
                      />
                      <input
                        type="text"
                        value={newPolAction}
                        onChange={(e) => setNewPolAction(e.target.value)}
                        placeholder={activeBrand === 'MikroTik' ? 'pppoe / pptp / masquerade' : 'allow / permit / accept'}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Entry</span>
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Source / User</th>
                          <th className="py-2 px-3">Dest / Profile</th>
                          <th className="py-2 px-3">Action / Service</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentDevice.policies.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-black">{p.name}</td>
                            <td className="py-2 px-3 text-black">{p.srcOrUser}</td>
                            <td className="py-2 px-3 text-slate-700">{p.dstOrProfile}</td>
                            <td className="py-2 px-3 font-bold text-emerald-700 uppercase">{p.actionOrService}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 7: SYSTEM & HOSTNAME */}
              {activeSection === 'system' && (
                <div className="space-y-4">
                  <form onSubmit={handleApplyHostname} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-black">System Identity &amp; Hostname ({activeBrand})</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        required
                        value={hostnameInput}
                        onChange={(e) => setHostnameInput(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                      />
                      <button type="submit" className="px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
                        Apply Hostname
                      </button>
                    </div>
                  </form>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => emitWebUiCli('Save / Commit Running Config', genSaveConfigCli(activeBrand))}
                      className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-black flex items-center gap-1.5">
                        <Save className="w-4 h-4" />
                        <span>Save / Commit Configuration</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 mt-1">{genSaveConfigCli(activeBrand)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        emitWebUiCli(
                          'Show System Info',
                          activeBrand === 'MikroTik'
                            ? '/system resource print'
                            : activeBrand === 'Huawei'
                            ? 'display version\ndisplay board 0'
                            : activeBrand === 'Palo Alto'
                            ? 'show system info'
                            : activeBrand === 'Juniper'
                            ? 'show version\nshow chassis hardware'
                            : 'show version'
                        )
                      }
                      className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-black flex items-center gap-1.5">
                        <TerminalIcon className="w-4 h-4" />
                        <span>Fetch System &amp; Hardware Version</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 mt-1">Read live OS version, CPU &amp; uptime</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SPLIT PANEL: LIVE TELNET + GENERATED CLI + MID-COMMAND TAB / ? CONSOLE */}
        {showCliDrawer && (
          <div className="xl:col-span-4 bg-white border-2 border-slate-300 rounded-xl overflow-hidden flex flex-col shadow-xs">
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-black truncate">{lastActionTitle}</div>
                <div className="text-[10px] font-mono text-slate-600">
                  WebUI → {activeBrand} CLI &amp; Live Telnet
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNotepadDraft({
                      title: lastActionTitle.replace(/^WebUI Ready.*$/, `${activeBrand} Saved Script`),
                      vendor: activeBrand,
                      commands: lastCliScript,
                    });
                    setActiveSection('notepad');
                    showToast('Loaded current CLI into Command Notepad — click Save Note to keep it!');
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Save this generated CLI script to Command Notepad"
                >
                  <FileText className="w-3 h-3" />
                  <span>Save Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lastCliScript);
                    setCopiedCli(true);
                    setTimeout(() => setCopiedCli(false), 1600);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedCli ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCli ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  disabled={!isLiveBridgeConnected || pushing}
                  onClick={() => emitWebUiCli(lastActionTitle, lastCliScript, true)}
                  className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white disabled:opacity-40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Push</span>
                </button>
              </div>
            </div>

            {/* Hardware Keys Bar */}
            <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => handleQuestionHelp(inputVal)}
                className="px-2 py-1 rounded bg-black text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                <span>? Help</span>
              </button>
              <button
                type="button"
                onClick={handleTabComplete}
                className="px-2 py-1 rounded bg-black text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowRightToLine className="w-3 h-3" />
                <span>Tab</span>
              </button>
              <button
                type="button"
                onClick={() => (isLiveBridgeConnected ? sendRawTelnet('\x03', true) : setInputVal(''))}
                className="px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0 cursor-pointer"
              >
                Ctrl+C
              </button>
              <button
                type="button"
                onClick={() => isLiveBridgeConnected && sendRawTelnet(' ', true)}
                className="px-2 py-1 rounded bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold shrink-0 cursor-pointer"
              >
                Space
              </button>
              {liveSerialId && (
                <button
                  type="button"
                  onClick={handleSendSerialBreak}
                  className="px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Send RS-232 BREAK signal (ROMMON / BootROM)"
                >
                  <Zap className="w-3 h-3" />
                  <span>Break</span>
                </button>
              )}
              {isLiveBridgeConnected && telnetUser && (
                <button
                  type="button"
                  onClick={async () => {
                    await sendRawTelnet(telnetUser, false);
                    if (telnetPass) setTimeout(() => sendRawTelnet(telnetPass, false), 500);
                  }}
                  className="px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Login</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setConsoleLines([])}
                className="px-2 py-1 rounded bg-white text-slate-700 border border-slate-300 text-[11px] shrink-0 cursor-pointer"
              >
                clear
              </button>
            </div>

            {/* Direct Inline Live Console Output (Type directly inside console box) */}
            <div
              className={`relative bg-white font-mono text-xs h-[460px] flex flex-col text-black ${
                isConsoleFocused ? 'ring-1 ring-inset ring-black' : ''
              }`}
              onClick={() => {
                if (!window.getSelection()?.toString()) {
                  inputRef.current?.focus();
                }
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.length === inputVal.length + 1 && v.endsWith('?')) {
                    handleQuestionHelp(v.slice(0, -1));
                    return;
                  }
                  setInputVal(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === '?') {
                    e.preventDefault();
                    handleQuestionHelp(inputVal);
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    handleTabComplete();
                  } else if (e.key === 'Enter') {
                    handleConsoleSubmit(inputVal);
                  } else if (e.key === ' ' && inputVal === '' && isLiveBridgeConnected) {
                    e.preventDefault();
                    sendRawTelnet(' ', true);
                  } else if (e.key === 'Backspace' && inputVal === '' && isLiveBridgeConnected) {
                    e.preventDefault();
                    sendRawTelnet('\x08', true);
                  } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
                    e.preventDefault();
                    if (isLiveBridgeConnected) sendRawTelnet('\x03', true);
                    setInputVal('');
                  }
                }}
                onPaste={async (e) => {
                  const text = e.clipboardData.getData('text');
                  if (text && text.includes('\n')) {
                    e.preventDefault();
                    const lines = text
                      .replace(/\r\n/g, '\n')
                      .split('\n')
                      .map((l) => l.trimEnd())
                      .filter(Boolean);
                    for (const l of lines) {
                      await handleConsoleSubmit(l);
                      await new Promise((r) => setTimeout(r, 150));
                    }
                  }
                }}
                onFocus={() => setIsConsoleFocused(true)}
                onBlur={() => setIsConsoleFocused(false)}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                aria-label="Direct WebUI console keyboard input"
                className="opacity-0 w-px h-px absolute bottom-2 left-2 pointer-events-none"
              />

              <div className="flex-1 overflow-y-auto p-3 cursor-text">
                <div className="space-y-0.5">
                  {(() => {
                    const hasLiveTail = isLiveBridgeConnected && consoleLines.length > 0;
                    const bodyLines = hasLiveTail ? consoleLines.slice(0, -1) : consoleLines;
                    const tailLine = hasLiveTail ? consoleLines[consoleLines.length - 1] : null;
                    const colorOf = (t: ConsoleLine['type']) =>
                      t === 'prompt'
                        ? 'text-blue-800 font-bold'
                        : t === 'info'
                        ? 'text-slate-600'
                        : t === 'success'
                        ? 'text-emerald-800 font-semibold'
                        : t === 'error'
                        ? 'text-red-700 font-semibold'
                        : 'text-black';

                    return (
                      <>
                        {bodyLines.map((l) => (
                          <div key={l.id} className={`whitespace-pre-wrap leading-relaxed ${colorOf(l.type)}`}>
                            {l.text}
                          </div>
                        ))}
                        {hasLiveTail && tailLine ? (
                          <div className={`whitespace-pre-wrap leading-relaxed ${colorOf(tailLine.type)}`}>
                            <span>{tailLine.text}</span>
                            <span className="text-black font-semibold">{inputVal}</span>
                            <span
                              className={`inline-block w-[7px] h-[14px] align-middle ml-0.5 ${
                                isConsoleFocused ? 'bg-black animate-pulse' : 'border border-slate-400 bg-transparent'
                              }`}
                            />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed pt-0.5">
                            <span className="text-blue-800 font-bold">{activePrompt}</span>
                            <span className="text-black">{inputVal}</span>
                            <span
                              className={`inline-block w-[7px] h-[14px] align-middle ml-0.5 ${
                                isConsoleFocused ? 'bg-black animate-pulse' : 'border border-slate-400 bg-transparent'
                              }`}
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div ref={consoleEndRef} />
                </div>
              </div>

              <div
                className="px-2.5 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                  {cliSuggestions.length > 0 ? (
                    cliSuggestions.slice(0, 6).map((sug) => (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => {
                          setInputVal(sug.insertText);
                          inputRef.current?.focus();
                        }}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-black text-black hover:text-white border border-slate-300 text-[10px] font-mono shrink-0 cursor-pointer"
                      >
                        {sug.label}
                      </button>
                    ))
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600 truncate">
                      {isConsoleFocused ? 'Type directly at prompt · ? · Tab · Paste' : 'Click console above to type directly'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
