import React, { useState, useRef } from 'react';
import {
  Server,
  Wifi,
  Plus,
  Trash2,
  Edit3,
  Zap,
  RotateCw,
  Search,
  Cable,
  Gauge,
  Route,
  BookOpen,
  Check,
  Send,
  Save,
  X,
  Activity,
  RefreshCw,
} from 'lucide-react';
import {
  BdcomOltModel,
  BDCOM_DATASHEETS,
  BDCOM_OFFICIAL_CHEATSHEET,
  VendorPromptMode,
  detectBdcomPromptMode,
  prepareCiscoStyleScriptForPrompt,
} from '../services/vendorDatasheets';
import { LiveVendorTelnetConsole, TelnetBridgeHandle, ConsoleLine } from './LiveVendorTelnetConsole';

type BdcomTab = 'onus' | 'bind-onu' | 'sla' | 'vlans' | 'optics' | 'system' | 'cheatsheet';

interface BdcomOnu {
  id: string;
  tech: 'EPON' | 'GPON';
  ponPort: number;
  llid: number;
  macOrSn: string;
  desc: string;
  vlan: number;
  status: 'online' | 'offline' | 'dying-gasp';
  rxPowerDbm: number;
  distanceM: number;
}

interface BdcomVlan {
  id: number;
  name: string;
  uplinkPort: string;
}

export const BdcomOltView: React.FC<{ defaultHostIp?: string }> = ({ defaultHostIp }) => {
  const [model, setModel] = useState<BdcomOltModel>('P3608B');
  const [tab, setTab] = useState<BdcomTab>('onus');
  const [hostname, setHostname] = useState('BDCOM-P3608B-CORE');
  const [promptMode, setPromptMode] = useState<VendorPromptMode>('unknown');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [selectedPonPort, setSelectedPonPort] = useState<number | 'ALL'>('ALL');
  const [shutdownPorts, setShutdownPorts] = useState<Record<number, boolean>>({});
  const [lastOpticTarget, setLastOpticTarget] = useState<{ pon: number; llid: number } | null>(null);

  // ONUs
  const [onus, setOnus] = useState<BdcomOnu[]>([
    { id: 'b1', tech: 'EPON', ponPort: 1, llid: 1, macOrSn: '8479.73ed.02ca', desc: 'PPPoE-Mirpur-01', vlan: 100, status: 'online', rxPowerDbm: -19.12, distanceM: 1120 },
    { id: 'b2', tech: 'EPON', ponPort: 1, llid: 2, macOrSn: 'e067.b311.a401', desc: 'Shop-Uttara-04', vlan: 100, status: 'online', rxPowerDbm: -21.45, distanceM: 1850 },
    { id: 'b3', tech: 'EPON', ponPort: 2, llid: 1, macOrSn: 'f492.bf22.10c8', desc: 'Corp-Banani', vlan: 200, status: 'dying-gasp', rxPowerDbm: -33.2, distanceM: 2600 },
  ]);
  const [searchQ, setSearchQ] = useState('');

  // Live Edit ONU Modal
  const [editingOnu, setEditingOnu] = useState<BdcomOnu | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editEthPort, setEditEthPort] = useState('1');
  const [editVlanMode, setEditVlanMode] = useState<'tag' | 'transparent'>('tag');
  const [editVlan, setEditVlan] = useState('100');
  const [editRateKbps, setEditRateKbps] = useState('51200');
  const [editPortShutdown, setEditPortShutdown] = useState(false);

  // Bind ONU Form
  const [bindPonPort, setBindPonPort] = useState('1');
  const [bindLlid, setBindLlid] = useState('3');
  const [bindMacOrSn, setBindMacOrSn] = useState('8479.73ed.99ab');
  const [bindDesc, setBindDesc] = useState('New-ISP-Client');
  const [bindVlan, setBindVlan] = useState('100');
  const [bindRateKbps, setBindRateKbps] = useState('51200');

  // SLA / GPON Profile Form
  const [slaPon, setSlaPon] = useState('1');
  const [slaLlid, setSlaLlid] = useState('1');
  const [slaUpPir, setSlaUpPir] = useState('100000');
  const [slaUpCir, setSlaUpCir] = useState('10000');
  const [slaDownPir, setSlaDownPir] = useState('100000');
  const [slaDownCir, setSlaDownCir] = useState('10000');

  // VLANs & Uplink Trunk
  const [vlans, setVlans] = useState<BdcomVlan[]>([
    { id: 100, name: 'PPPoE-Clients', uplinkPort: 'tgigaEthernet 0/1' },
    { id: 200, name: 'Corporate-VLAN', uplinkPort: 'tgigaEthernet 0/1' },
  ]);
  const [newVlanId, setNewVlanId] = useState('300');
  const [newVlanName, setNewVlanName] = useState('FTTH-POP-300');
  const [uplinkIface, setUplinkIface] = useState('tgigaEthernet 0/1');
  const [trunkAllowed, setTrunkAllowed] = useState('all');

  // System / Mgmt IP / Default Route
  const [mgmtVlan, setMgmtVlan] = useState('100');
  const [mgmtIp, setMgmtIp] = useState(defaultHostIp || '10.99.0.20');
  const [mgmtMask, setMgmtMask] = useState('255.255.255.0');
  const [defaultGw, setDefaultGw] = useState('10.99.0.1');

  // Datasheet Cheat Sheet
  const [cheatSearch, setCheatSearch] = useState('');
  const [cheatCat, setCheatCat] = useState('ALL');

  const bridgeRef = useRef<TelnetBridgeHandle | null>(null);
  const spec = BDCOM_DATASHEETS[model];
  const ifaceTech = spec.tech === 'GPON' ? 'gpon' : 'epon';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const push = async (title: string, script: string, force = false) => {
    if (bridgeRef.current) {
      await bridgeRef.current.pushScript(title, script, force);
    }
  };

  const handleModelChange = (m: BdcomOltModel) => {
    setModel(m);
    const nextSpec = BDCOM_DATASHEETS[m];
    setUplinkIface(`${nextSpec.uplinkIfacePrefix} 0/1`);
    setSelectedPonPort('ALL');
    setBindMacOrSn(nextSpec.tech === 'GPON' ? 'HWTC1A2B3C4D' : '8479.73ed.99ab');
    showToast(`Loaded BDCOM ${m} (${nextSpec.tech} · ${nextSpec.ponPorts} PON Ports)`);
  };

  // Bidirectional Live Telnet Parser for BDCOM NOS
  const handleLiveOutput = (chunk: string) => {
    const det = detectBdcomPromptMode(chunk);
    if (det.mode) setPromptMode(det.mode);
    if (det.hostname) setHostname(det.hostname);

    // Parse "show epon active-onu" or "show gpon active-onu" rows e.g.:
    // EPON0/1:1    8479.73ed.02ca   auto-configured   1120
    const onuMatches = [
      ...chunk.matchAll(/(?:EPON|GPON)0\/(\d+):(\d+)\s+([0-9a-fA-F.:-]{12,20})/gi),
    ];
    if (onuMatches.length > 0) {
      setOnus((prev) => {
        const map = new Map<string, BdcomOnu>();
        prev.forEach((o) => map.set(`${o.ponPort}:${o.llid}`, o));
        onuMatches.forEach((m) => {
          const ponPort = parseInt(m[1], 10);
          const llid = parseInt(m[2], 10);
          const macOrSn = m[3];
          const key = `${ponPort}:${llid}`;
          const existing = map.get(key);
          map.set(
            key,
            existing
              ? { ...existing, macOrSn, status: 'online' }
              : {
                  id: `live_bd_${key}`,
                  tech: spec.tech,
                  ponPort,
                  llid,
                  macOrSn,
                  desc: `Live-BDCOM-0/${ponPort}:${llid}`,
                  vlan: 100,
                  status: 'online',
                  rxPowerDbm: -20.0,
                  distanceM: 1000,
                }
          );
        });
        return Array.from(map.values());
      });
    }

    // Parse Rx Optical Power from optical-transceiver-diagnosis
    const rxM = chunk.match(/(?:RX\s+Power|Received\s+Power)[^-\d+]*([+-]?\d+(?:\.\d+)?)\s*dBm/i);
    if (rxM && lastOpticTarget) {
      const val = parseFloat(rxM[1]);
      if (!Number.isNaN(val)) {
        setOnus((prev) =>
          prev.map((o) =>
            o.ponPort === lastOpticTarget.pon && o.llid === lastOpticTarget.llid
              ? { ...o, rxPowerDbm: val }
              : o
          )
        );
      }
    }
  };

  const handleLocalCommand = (cmd: string): ConsoleLine[] | null => {
    const lower = cmd.toLowerCase();
    if (lower.startsWith('hostname ')) {
      const n = cmd.split(/\s+/)[1];
      if (n) setHostname(n);
      return [{ id: `bd_hn_${Date.now()}`, type: 'success', text: `  Hostname updated to ${n}` }];
    }
    if (lower.includes('active-onu') || lower.includes('onu-information')) {
      return [
        {
          id: `bd_oa_${Date.now()}`,
          type: 'output',
          text:
            `  Interface      MAC / SN            VLAN  Rx(dBm)  Status       Description\n  ---------------------------------------------------------------------------\n` +
            onus
              .map(
                (o) =>
                  `  ${ifaceTech}0/${o.ponPort}:${String(o.llid).padEnd(3)} ${o.macOrSn.padEnd(19)} ${String(o.vlan).padEnd(5)} ${o.rxPowerDbm.toFixed(2).padEnd(8)} ${o.status.padEnd(12)} ${o.desc}`
              )
              .join('\n'),
        },
      ];
    }
    if (lower === 'write all' || lower === 'wr a') {
      return [{ id: `bd_wr_${Date.now()}`, type: 'success', text: '  Saving current configuration to startup-config... OK!' }];
    }
    return null;
  };

  // PON Port Live Controls
  const handlePonPortToggle = async (portNum: number) => {
    const isDown = Boolean(shutdownPorts[portNum]);
    setShutdownPorts((prev) => ({ ...prev, [portNum]: !isDown }));
    await push(
      `${isDown ? 'Enable' : 'Shutdown'} ${ifaceTech} 0/${portNum}`,
      `enable\nconfig\ninterface ${ifaceTech} 0/${portNum}\n${isDown ? 'no shutdown' : 'shutdown'}\nexit`
    );
  };

  // Bind ONU
  const buildBindOnuCli = () => {
    const p = parseInt(bindPonPort, 10) || 1;
    const l = parseInt(bindLlid, 10) || 1;
    const safeDesc = (bindDesc.trim() || 'Client-ONU').replace(/\s+/g, '_');
    if (spec.tech === 'EPON') {
      return [
        'enable',
        'config',
        `interface epon 0/${p}`,
        `epon bind-onu mac ${bindMacOrSn.trim()} ${l}`,
        'exit',
        `interface epon 0/${p}:${l}`,
        `description ${safeDesc}`,
        `epon onu port 1 ctc vlan mode tag ${bindVlan}`,
        `epon onu port 1 ctc rate-limit ${bindRateKbps} ingress`,
        `epon onu port 1 ctc rate-limit ${bindRateKbps} egress`,
        'exit',
        'write all',
      ].join('\n');
    }
    return [
      'enable',
      'config',
      `interface gpon 0/${p}`,
      `gpon bind-onu sn ${bindMacOrSn.trim().toUpperCase()} ${l}`,
      'exit',
      `interface gpon 0/${p}:${l}`,
      `description ${safeDesc}`,
      `gpon onu uni 1 vlan-mode tag pvid ${bindVlan}`,
      'exit',
      'write all',
    ].join('\n');
  };

  const handleBindSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(bindPonPort, 10) || 1;
    const l = parseInt(bindLlid, 10) || 1;
    const item: BdcomOnu = {
      id: `bd_${Date.now()}`,
      tech: spec.tech,
      ponPort: p,
      llid: l,
      macOrSn: bindMacOrSn.trim(),
      desc: bindDesc.trim() || `ONU-0/${p}:${l}`,
      vlan: parseInt(bindVlan, 10) || 100,
      status: 'online',
      rxPowerDbm: -19.8,
      distanceM: 1250,
    };
    setOnus((prev) => [item, ...prev]);
    await push(`Bind BDCOM ${spec.tech} ONU 0/${p}:${l}`, buildBindOnuCli());
    setTab('onus');
  };

  // Live Edit ONU
  const openEditOnu = (onu: BdcomOnu) => {
    setEditingOnu(onu);
    setEditDesc(onu.desc);
    setEditEthPort('1');
    setEditVlanMode('tag');
    setEditVlan(String(onu.vlan));
    setEditRateKbps('51200');
    setEditPortShutdown(false);
  };

  const handleSaveEditOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOnu) return;
    const safeDesc = (editDesc.trim() || editingOnu.desc).replace(/\s+/g, '_');
    const v = parseInt(editVlan, 10) || editingOnu.vlan;
    setOnus((prev) => prev.map((o) => (o.id === editingOnu.id ? { ...o, desc: safeDesc, vlan: v } : o)));

    const lines = ['enable', 'config', `interface ${ifaceTech} 0/${editingOnu.ponPort}:${editingOnu.llid}`, `description ${safeDesc}`];
    if (spec.tech === 'EPON') {
      lines.push(
        editVlanMode === 'transparent'
          ? `epon onu port ${editEthPort} ctc vlan mode transparent`
          : `epon onu port ${editEthPort} ctc vlan mode tag ${v}`
      );
      lines.push(`epon onu port ${editEthPort} ctc rate-limit ${editRateKbps} ingress`);
      lines.push(`epon onu port ${editEthPort} ctc rate-limit ${editRateKbps} egress`);
      lines.push(editPortShutdown ? `epon onu port ${editEthPort} ctc shutdown` : `no epon onu port ${editEthPort} ctc shutdown`);
    } else {
      lines.push(
        editVlanMode === 'transparent'
          ? `gpon onu uni ${editEthPort} vlan-mode transparent`
          : `gpon onu uni ${editEthPort} vlan-mode tag pvid ${v}`
      );
      lines.push(editPortShutdown ? `gpon onu uni ${editEthPort} shutdown` : `no gpon onu uni ${editEthPort} shutdown`);
    }
    lines.push('exit');
    await push(`Edit BDCOM ONU 0/${editingOnu.ponPort}:${editingOnu.llid}`, lines.join('\n'));
    setEditingOnu(null);
  };

  const handleOnuAction = async (onu: BdcomOnu, action: 'optical' | 'mac' | 'reboot' | 'unbind') => {
    if (action === 'optical') {
      setLastOpticTarget({ pon: onu.ponPort, llid: onu.llid });
      const cmd =
        spec.tech === 'EPON'
          ? `show epon interface epon 0/${onu.ponPort}:${onu.llid} onu ctc optical-transceiver-diagnosis`
          : `show gpon interface gpon 0/${onu.ponPort}:${onu.llid} onu optical-transceiver-diagnosis`;
      await push(`Optical Check 0/${onu.ponPort}:${onu.llid}`, cmd);
    } else if (action === 'mac') {
      await push(`MAC Table 0/${onu.ponPort}:${onu.llid}`, `show mac address-table interface ${ifaceTech} 0/${onu.ponPort}:${onu.llid}`);
    } else if (action === 'reboot') {
      const cmd =
        spec.tech === 'EPON'
          ? `epon reboot onu interface epon 0/${onu.ponPort}:${onu.llid}`
          : `gpon reboot onu interface gpon 0/${onu.ponPort}:${onu.llid}`;
      await push(`Reboot ONU 0/${onu.ponPort}:${onu.llid}`, cmd);
    } else if (action === 'unbind') {
      setOnus((prev) => prev.filter((x) => x.id !== onu.id));
      const cmd =
        spec.tech === 'EPON'
          ? `enable\nconfig\ninterface epon 0/${onu.ponPort}\nno epon bind-onu mac ${onu.macOrSn}\nexit`
          : `enable\nconfig\ninterface gpon 0/${onu.ponPort}\nno gpon bind-onu sn ${onu.macOrSn}\nexit`;
      await push(`Unbind ONU 0/${onu.ponPort}:${onu.llid}`, cmd);
    }
  };

  const handlePushSla = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      'enable',
      'config',
      `interface ${ifaceTech} 0/${slaPon}:${slaLlid}`,
      `epon sla upstream pir ${slaUpPir} cir ${slaUpCir}`,
      `epon sla downstream pir ${slaDownPir} cir ${slaDownCir}`,
      'exit',
    ].join('\n');
    await push(`Set EPON SLA 0/${slaPon}:${slaLlid}`, cli);
  };

  const handleAddVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const vid = parseInt(newVlanId, 10);
    if (!vid) return;
    setVlans((prev) => [{ id: vid, name: newVlanName.trim() || `VLAN-${vid}`, uplinkPort: uplinkIface }, ...prev.filter((v) => v.id !== vid)]);
    const cli = [
      'enable',
      'config',
      `vlan ${vid}`,
      `name ${newVlanName.trim() || `VLAN-${vid}`}`,
      'exit',
      `interface ${uplinkIface}`,
      'no shutdown',
      'switchport mode trunk',
      `switchport trunk vlan-allowed ${trunkAllowed}`,
      'exit',
    ].join('\n');
    await push(`Create VLAN ${vid} & Trunk ${uplinkIface}`, cli);
  };

  const handleDeleteVlan = async (v: BdcomVlan) => {
    setVlans((prev) => prev.filter((x) => x.id !== v.id));
    await push(`Delete VLAN ${v.id}`, `enable\nconfig\nno vlan ${v.id}`);
  };

  const handleApplySystem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      'enable',
      'config',
      `hostname ${hostname.trim()}`,
      `vlan ${mgmtVlan}`,
      'exit',
      `interface vlan ${mgmtVlan}`,
      `ip address ${mgmtIp.trim()} ${mgmtMask.trim()}`,
      'no shutdown',
      'exit',
      `ip route default ${defaultGw.trim()}`,
      'write all',
    ].join('\n');
    await push(`Apply BDCOM System (${hostname} / ${mgmtIp})`, cli);
  };

  const filteredOnus = onus.filter((o) => {
    if (selectedPonPort !== 'ALL' && o.ponPort !== selectedPonPort) return false;
    const q = searchQ.trim().toLowerCase();
    if (!q) return true;
    return o.macOrSn.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q) || `${o.ponPort}:${o.llid}`.includes(q);
  });

  const cheatCats = ['ALL', ...Array.from(new Set(BDCOM_OFFICIAL_CHEATSHEET.map((c) => c.category)))];
  const filteredCheat = BDCOM_OFFICIAL_CHEATSHEET.filter((item) => {
    if (cheatCat !== 'ALL' && item.category !== cheatCat) return false;
    const q = cheatSearch.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.command.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const promptLabel =
    promptMode === 'config'
      ? `${hostname}_config# `
      : promptMode === 'subview'
      ? `${hostname}_config_${ifaceTech}# `
      : promptMode === 'priv'
      ? `${hostname}# `
      : `${hostname}_config# `;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-black tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-black shrink-0" />
            <span>BDCOM EPON / GPON OLT Full WebUI &amp; Bidirectional Live Telnet</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {spec.heightU} · {spec.ponPorts}x {spec.tech} PON · {spec.uplinkSummary} · Max {spec.maxOnus} · {spec.switchingCapacity}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value as BdcomOltModel)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black"
          >
            {(Object.keys(BDCOM_DATASHEETS) as BdcomOltModel[]).map((m) => (
              <option key={m} value={m}>
                BDCOM {m} ({BDCOM_DATASHEETS[m].tech} {BDCOM_DATASHEETS[m].ponPorts}P)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => push('Save BDCOM Config (write all)', 'write all')}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>write all</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-black font-mono">
                {hostname} <span className="text-xs text-slate-500 font-normal">({model} · {spec.tech})</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 tabular-nums mt-0.5">
                Mgmt Vlan{mgmtVlan}: <strong className="text-black">{mgmtIp}</strong> · ONUs:{' '}
                <strong className="text-black">{onus.length}</strong> · Split: <strong className="text-black">{spec.splitRatio}</strong>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-600">
              {isLiveConnected ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  Live BDCOM Synced
                </span>
              ) : (
                'Offline BDCOM NOS Builder'
              )}
            </div>
          </div>

          {/* Interactive PON Front Panel */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPonPort('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer ${
                    selectedPonPort === 'ALL' ? 'bg-black text-white border-black font-bold' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  All PONs
                </button>
                {Array.from({ length: spec.ponPorts }).map((_, i) => {
                  const pNum = i + 1;
                  const cnt = onus.filter((o) => o.ponPort === pNum).length;
                  const isDown = Boolean(shutdownPorts[pNum]);
                  const isSel = selectedPonPort === pNum;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => {
                        setSelectedPonPort(pNum);
                        setBindPonPort(String(pNum));
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border cursor-pointer ${
                        isSel
                          ? 'bg-black text-white border-black font-bold'
                          : isDown
                          ? 'bg-red-50 text-red-700 border-red-200 line-through'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      0/{pNum} ({cnt})
                    </button>
                  );
                })}
              </div>

              {selectedPonPort !== 'ALL' && (
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => push(`Active ONUs 0/${selectedPonPort}`, `show ${ifaceTech} active-onu interface ${ifaceTech} 0/${selectedPonPort}`)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => push(`Inactive ONUs 0/${selectedPonPort}`, `show ${ifaceTech} inactive-onu interface ${ifaceTech} 0/${selectedPonPort}`)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Inactive
                  </button>
                  <button
                    type="button"
                    onClick={() => push(`Port Optics 0/${selectedPonPort}`, `show ${ifaceTech} optical-transceiver-diagnosis interface ${ifaceTech} 0/${selectedPonPort}`)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Port Optics
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePonPortToggle(selectedPonPort)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                      shutdownPorts[selectedPonPort] ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {shutdownPorts[selectedPonPort] ? 'No Shutdown' : 'Shutdown'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 7 Tabs */}
          <div className="px-3 pt-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'onus', label: 'ONUs & Edit', icon: Wifi },
                { id: 'bind-onu', label: '+ Bind ONU', icon: Plus },
                { id: 'sla', label: 'SLA & Bandwidth', icon: Gauge },
                { id: 'vlans', label: 'VLANs & Uplink', icon: Cable },
                { id: 'optics', label: 'Optics & MAC', icon: Activity },
                { id: 'system', label: 'System & Routes', icon: Route },
                { id: 'cheatsheet', label: 'Datasheet & CLI', icon: BookOpen },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'border-black text-black bg-white rounded-t-md' : 'border-transparent text-slate-600 hover:text-black'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4">
            {/* TAB 1: ONUS & LIVE EDIT */}
            {tab === 'onus' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      placeholder="Filter by MAC, SN, Description, or 1:1..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => push('Scan Active ONUs', `show ${ifaceTech} active-onu`)}
                    className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Active ONUs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => push('Scan Inactive ONUs', `show ${ifaceTech} inactive-onu`)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-black text-xs font-semibold cursor-pointer"
                  >
                    Inactive ONUs
                  </button>
                </div>

                {editingOnu && (
                  <form onSubmit={handleSaveEditOnu} className="p-3.5 rounded-lg bg-slate-50 border border-slate-300 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-bold text-black font-mono">
                      <span>Live Edit BDCOM {ifaceTech} 0/{editingOnu.ponPort}:{editingOnu.llid} ({editingOnu.macOrSn})</span>
                      <button type="button" onClick={() => setEditingOnu(null)} className="cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="col-span-2 block">
                        <span className="text-[11px] text-slate-600">Description</span>
                        <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">UNI ETH Port</span>
                        <select value={editEthPort} onChange={(e) => setEditEthPort(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono">
                          <option value="1">Port 1</option>
                          <option value="2">Port 2</option>
                          <option value="3">Port 3</option>
                          <option value="4">Port 4</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">VLAN Mode</span>
                        <select value={editVlanMode} onChange={(e) => setEditVlanMode(e.target.value as 'tag' | 'transparent')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono">
                          <option value="tag">tag (Customer VLAN)</option>
                          <option value="transparent">transparent</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">VLAN ID</span>
                        <input type="number" value={editVlan} onChange={(e) => setEditVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">CTC Rate-Limit (kbps)</span>
                        <input type="number" value={editRateKbps} onChange={(e) => setEditRateKbps(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                        <input type="checkbox" checked={editPortShutdown} onChange={(e) => setEditPortShutdown(e.target.checked)} className="accent-black" />
                        <span>Shutdown UNI ETH Port</span>
                      </label>
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold flex items-center gap-1 cursor-pointer">
                        <Send className="w-3.5 h-3.5" />
                        <span>Apply Live to Telnet</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-2.5">Interface</th>
                        <th className="py-2 px-2.5">MAC / SN &amp; Desc</th>
                        <th className="py-2 px-2.5">VLAN</th>
                        <th className="py-2 px-2.5">Rx Power</th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOnus.map((onu) => (
                        <tr key={onu.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-bold text-black">{ifaceTech}0/{onu.ponPort}:{onu.llid}</td>
                          <td className="py-2 px-2.5">
                            <div className="font-bold text-black">{onu.macOrSn}</div>
                            <div className="text-[11px] font-sans text-slate-600">{onu.desc}</div>
                          </td>
                          <td className="py-2 px-2.5 font-bold text-black">{onu.vlan}</td>
                          <td className={`py-2 px-2.5 font-bold ${onu.rxPowerDbm <= -28 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {onu.rxPowerDbm.toFixed(2)} dBm
                          </td>
                          <td className="py-2 px-2.5 font-sans font-semibold">
                            <span className={onu.status === 'online' ? 'text-emerald-700' : 'text-red-700'}>
                              {onu.status}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => openEditOnu(onu)} title="Edit CTC VLAN / Rate / Desc" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'optical')} title="Read ONU Optical Power" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer">
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'mac')} title="Learned MAC" className="px-1.5 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 text-[10px] font-bold cursor-pointer">
                                MAC
                              </button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'reboot')} title="Reboot ONU" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer">
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'unbind')} title="Unbind ONU" className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer">
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

            {/* TAB 2: + BIND ONU */}
            {tab === 'bind-onu' && (
              <form onSubmit={handleBindSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] text-slate-600">PON Port (1–{spec.ponPorts})</span>
                    <input type="number" min={1} max={spec.ponPorts} value={bindPonPort} onChange={(e) => setBindPonPort(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Logical ONU ID (LLID)</span>
                    <input type="number" min={1} max={128} value={bindLlid} onChange={(e) => setBindLlid(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">{spec.tech === 'GPON' ? 'ONT Serial Number' : 'ONU MAC (xxxx.xxxx.xxxx)'}</span>
                    <input type="text" value={bindMacOrSn} onChange={(e) => setBindMacOrSn(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" required />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Description</span>
                    <input type="text" value={bindDesc} onChange={(e) => setBindDesc(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">ETH 1 Tag VLAN</span>
                    <input type="number" value={bindVlan} onChange={(e) => setBindVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Rate Limit (kbps)</span>
                    <input type="number" value={bindRateKbps} onChange={(e) => setBindRateKbps(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-slate-600 mb-1">Live BDCOM CLI Preview:</div>
                  <pre className="text-[11px] font-mono text-black whitespace-pre-wrap">{buildBindOnuCli()}</pre>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white font-bold flex items-center gap-1.5 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>Bind ONU &amp; Push Live to Telnet</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: SLA & BANDWIDTH */}
            {tab === 'sla' && (
              <form onSubmit={handlePushSla} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-black">BDCOM Upstream / Downstream SLA Bandwidth (PIR / CIR kbps)</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] text-slate-600">PON Port</span>
                    <input type="number" value={slaPon} onChange={(e) => setSlaPon(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">ONU LLID</span>
                    <input type="number" value={slaLlid} onChange={(e) => setSlaLlid(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Upstream PIR (kbps)</span>
                    <input type="number" value={slaUpPir} onChange={(e) => setSlaUpPir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Upstream CIR (kbps)</span>
                    <input type="number" value={slaUpCir} onChange={(e) => setSlaUpCir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Downstream PIR (kbps)</span>
                    <input type="number" value={slaDownPir} onChange={(e) => setSlaDownPir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Downstream CIR (kbps)</span>
                    <input type="number" value={slaDownCir} onChange={(e) => setSlaDownCir(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                    Push SLA to Telnet
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: VLANS & UPLINK TRUNK */}
            {tab === 'vlans' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleAddVlan} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="font-bold text-black">Create VLAN &amp; Configure Uplink Trunk Port</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="number" value={newVlanId} onChange={(e) => setNewVlanId(e.target.value)} placeholder="VLAN ID" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newVlanName} onChange={(e) => setNewVlanName(e.target.value)} placeholder="VLAN Name" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={uplinkIface} onChange={(e) => setUplinkIface(e.target.value)} placeholder="tgigaEthernet 0/1" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={trunkAllowed} onChange={(e) => setTrunkAllowed(e.target.value)} placeholder="all / 100-200" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Create VLAN &amp; Trunk Uplink
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">VLAN</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Uplink Trunk</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vlans.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{v.id}</td>
                          <td className="py-2 px-3 text-slate-700">{v.name}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{v.uplinkPort}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleDeleteVlan(v)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer">
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

            {/* TAB 5: OPTICAL & MAC DIAGNOSTICS */}
            {tab === 'optics' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { title: 'All OLT SFP Optical Power', cmd: `show ${ifaceTech} optical-transceiver-diagnosis`, desc: 'Check Tx/Rx dBm, temp, and voltage on all PON SFPs.' },
                  { title: 'All Learned MAC Addresses', cmd: 'show mac address-table', desc: 'List customer PPPoE/router MACs across PON & uplink ports.' },
                  { title: 'All Interfaces Brief Status', cmd: 'show interface brief', desc: 'Check GE / 10G SFP+ / PON link state & duplex.' },
                  { title: 'All VLAN Memberships', cmd: 'show vlan', desc: 'Audit VLAN IDs and tagged/untagged ports.' },
                ].map((c) => (
                  <div key={c.title} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2">
                    <div>
                      <div className="font-bold text-black">{c.title}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{c.desc}</div>
                      <code className="block mt-1.5 px-2 py-1 rounded bg-white border border-slate-200 font-mono text-[11px] text-black">{c.cmd}</code>
                    </div>
                    <button type="button" onClick={() => push(c.title, c.cmd, true)} className="self-end px-3 py-1 rounded bg-black text-white font-bold cursor-pointer">
                      Run on Telnet
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 6: SYSTEM & ROUTES */}
            {tab === 'system' && (
              <form onSubmit={handleApplySystem} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-black">BDCOM Hostname, Mgmt VLAN IP &amp; Default Gateway</span>
                  <button type="button" onClick={() => push('Check CPU / Memory / Version', 'show version\nshow cpu\nshow memory')} className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold cursor-pointer">
                    Version/CPU
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Hostname</span>
                    <input type="text" value={hostname} onChange={(e) => setHostname(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Mgmt VLAN ID</span>
                    <input type="number" value={mgmtVlan} onChange={(e) => setMgmtVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Mgmt IP</span>
                    <input type="text" value={mgmtIp} onChange={(e) => setMgmtIp(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Subnet Mask</span>
                    <input type="text" value={mgmtMask} onChange={(e) => setMgmtMask(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Default Gateway</span>
                    <input type="text" value={defaultGw} onChange={(e) => setDefaultGw(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                    Apply System &amp; write all
                  </button>
                </div>
              </form>
            )}

            {/* TAB 7: DATASHEET & CLI CHEAT SHEET */}
            {tab === 'cheatsheet' && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-black">Official Datasheet: BDCOM {spec.model}</span>
                    <span className="font-mono text-slate-600">{spec.tech} · {spec.heightU}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">PON Ports</div>
                      <div className="font-mono font-bold text-black">{spec.ponPorts}x {spec.tech}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Split Ratio / Max ONUs</div>
                      <div className="font-mono font-bold text-black">{spec.splitRatio} · {spec.maxOnus}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Switching Capacity</div>
                      <div className="font-mono font-bold text-black">{spec.switchingCapacity}</div>
                    </div>
                    <div className="col-span-3">
                      <div className="text-[11px] text-slate-500">Uplink Ports</div>
                      <div className="font-mono text-black">{spec.uplinkSummary}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={cheatSearch} onChange={(e) => setCheatSearch(e.target.value)} placeholder="Search BDCOM commands (optical, bind-onu, ctc, sla, trunk)..." className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
                  </div>
                  <select value={cheatCat} onChange={(e) => setCheatCat(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                    {cheatCats.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>)}
                  </select>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto">
                  {filteredCheat.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-slate-50 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-black">{item.title}</span>
                          <span className="text-[11px] text-slate-500 ml-2">· {item.category}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => { navigator.clipboard.writeText(item.command); showToast(`Copied: ${item.title}`); }} className="px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer">Copy</button>
                          <button type="button" onClick={() => push(item.title, item.requiresConfig ? `enable\nconfig\n${item.command}` : item.command, true)} className="px-2.5 py-1 rounded bg-black text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                            <Send className="w-3 h-3" />
                            <span>Run on Telnet</span>
                          </button>
                        </div>
                      </div>
                      <pre className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-black whitespace-pre-wrap">{item.command}</pre>
                      <p className="text-[11px] text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <LiveVendorTelnetConsole
          vendor="BDCOM"
          title="Live BDCOM OLT Telnet"
          defaultHost={defaultHostIp || '10.99.0.20'}
          defaultUser="admin"
          defaultPass="admin"
          promptLabel={promptLabel}
          promptModeLabel={promptMode === 'unknown' ? 'BDCOM NOS' : promptMode}
          promptMode={promptMode}
          syncCommandTitle="Sync Live BDCOM OLT"
          syncCommandScript={`enable\nshow ${ifaceTech} active-onu\nshow ${ifaceTech} optical-transceiver-diagnosis\nshow vlan`}
          prepareLinesForLive={(raw, mode, isLive) =>
            prepareCiscoStyleScriptForPrompt(raw, mode, isLive, 'config')
          }
          onLiveOutputChunk={handleLiveOutput}
          onLocalCommand={handleLocalCommand}
          onBridgeReady={(handle) => {
            bridgeRef.current = handle;
            setIsLiveConnected(handle.isConnected);
          }}
          onToast={showToast}
        />
      </div>
    </div>
  );
};
