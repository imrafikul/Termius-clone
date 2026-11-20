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
  VsolOltModel,
  VSOL_DATASHEETS,
  VSOL_OFFICIAL_CHEATSHEET,
  VendorPromptMode,
  detectVsolPromptMode,
  prepareCiscoStyleScriptForPrompt,
} from '../services/vendorDatasheets';
import { LiveVendorTelnetConsole, TelnetBridgeHandle, ConsoleLine } from './LiveVendorTelnetConsole';

type VsolTab = 'onus' | 'add-onu' | 'profiles' | 'vlans' | 'optics' | 'system' | 'cheatsheet';

interface VsolOnu {
  id: string;
  tech: 'EPON' | 'GPON';
  ponPort: number;
  onuId: number;
  macOrSn: string;
  desc: string;
  vlan: number;
  lineProfile: number;
  srvProfile: number;
  status: 'online' | 'offline' | 'los';
  rxPowerDbm: number;
}

interface VsolAutoFind {
  id: string;
  ponPort: number;
  macOrSn: string;
  vendor: string;
}

interface VsolVlan {
  id: number;
  desc: string;
  uplinkPort: string;
}

export const VsolOltView: React.FC<{ defaultHostIp?: string }> = ({ defaultHostIp }) => {
  const [model, setModel] = useState<VsolOltModel>('V1600G1-B');
  const [tab, setTab] = useState<VsolTab>('onus');
  const [hostname, setHostname] = useState('VSOL-V1600G1-CORE');
  const [promptMode, setPromptMode] = useState<VendorPromptMode>('unknown');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [selectedPonPort, setSelectedPonPort] = useState<number | 'ALL'>('ALL');
  const [shutdownPorts, setShutdownPorts] = useState<Record<number, boolean>>({});
  const [lastOpticTarget, setLastOpticTarget] = useState<{ pon: number; onuId: number } | null>(null);

  const [onus, setOnus] = useState<VsolOnu[]>([
    { id: 'v1', tech: 'GPON', ponPort: 1, onuId: 1, macOrSn: '48575443A1B2C301', desc: 'FTTH-Dhanmondi-01', vlan: 100, lineProfile: 10, srvProfile: 10, status: 'online', rxPowerDbm: -18.75 },
    { id: 'v2', tech: 'GPON', ponPort: 1, onuId: 2, macOrSn: '56534F4C8812AB34', desc: 'VSOL-Client-02', vlan: 100, lineProfile: 10, srvProfile: 10, status: 'online', rxPowerDbm: -20.42 },
    { id: 'v3', tech: 'GPON', ponPort: 2, onuId: 1, macOrSn: '5A544547B411009A', desc: 'Corp-Gulshan', vlan: 200, lineProfile: 20, srvProfile: 20, status: 'los', rxPowerDbm: -34.0 },
  ]);
  const [autoFind, setAutoFind] = useState<VsolAutoFind[]>([
    { id: 'vaf1', ponPort: 1, macOrSn: '56534F4C99AA1122', vendor: 'VSOL V2801SG' },
    { id: 'vaf2', ponPort: 2, macOrSn: '48575443BBCC3344', vendor: 'HWTC HG8245H' },
  ]);
  const [searchQ, setSearchQ] = useState('');

  // Live Edit ONU
  const [editingOnu, setEditingOnu] = useState<VsolOnu | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editEthPort, setEditEthPort] = useState('1');
  const [editVlanMode, setEditVlanMode] = useState<'tag' | 'transparent'>('tag');
  const [editVlan, setEditVlan] = useState('100');
  const [editRateKbps, setEditRateKbps] = useState('51200');
  const [editEthShutdown, setEditEthShutdown] = useState(false);

  // Register ONU Form
  const [addPonPort, setAddPonPort] = useState('1');
  const [addOnuId, setAddOnuId] = useState('3');
  const [addMacOrSn, setAddMacOrSn] = useState('56534F4C99AA1122');
  const [addDesc, setAddDesc] = useState('VSOL-FTTH-Client');
  const [addLineProf, setAddLineProf] = useState('10');
  const [addSrvProf, setAddSrvProf] = useState('10');
  const [addVlan, setAddVlan] = useState('100');

  // DBA / Line / Srv Profile Form
  const [profSub, setProfSub] = useState<'dba' | 'line' | 'srv'>('dba');
  const [dbaId, setDbaId] = useState('10');
  const [dbaName, setDbaName] = useState('DBA_1G');
  const [dbaMax, setDbaMax] = useState('1024000');
  const [lpId, setLpId] = useState('10');
  const [lpName, setLpName] = useState('LINE_100');
  const [lpVlan, setLpVlan] = useState('100');
  const [spId, setSpId] = useState('10');
  const [spName, setSpName] = useState('SRV_ETH4');
  const [spEthCnt, setSpEthCnt] = useState('4');
  const [spVlan, setSpVlan] = useState('100');

  // VLANs & Uplink
  const [vlans, setVlans] = useState<VsolVlan[]>([
    { id: 100, desc: 'PPPoE-Customers', uplinkPort: 'tengigabitethernet 0/1' },
    { id: 200, desc: 'Corporate-DIA', uplinkPort: 'tengigabitethernet 0/1' },
  ]);
  const [newVlanId, setNewVlanId] = useState('300');
  const [newVlanDesc, setNewVlanDesc] = useState('FTTH-VLAN-300');
  const [uplinkIface, setUplinkIface] = useState('tengigabitethernet 0/1');
  const [trunkRange, setTrunkRange] = useState('100-300');

  // System & Routes
  const [mgmtVlan, setMgmtVlan] = useState('100');
  const [mgmtIp, setMgmtIp] = useState(defaultHostIp || '192.168.8.200');
  const [mgmtMask, setMgmtMask] = useState('255.255.255.0');
  const [defaultGw, setDefaultGw] = useState('192.168.8.1');

  // Cheat Sheet
  const [cheatSearch, setCheatSearch] = useState('');
  const [cheatCat, setCheatCat] = useState('ALL');

  const bridgeRef = useRef<TelnetBridgeHandle | null>(null);
  const spec = VSOL_DATASHEETS[model];
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

  const handleModelChange = (m: VsolOltModel) => {
    setModel(m);
    const nextSpec = VSOL_DATASHEETS[m];
    setSelectedPonPort('ALL');
    setAddMacOrSn(nextSpec.tech === 'GPON' ? '56534F4C99AA1122' : 'e0:67:b3:11:a4:01');
    showToast(`Loaded VSOL ${m} (${nextSpec.tech} · ${nextSpec.ponPorts} PON Ports)`);
  };

  // Bidirectional Live Telnet Parser for VSOL OLT
  const handleLiveOutput = (chunk: string) => {
    const det = detectVsolPromptMode(chunk);
    if (det.mode) setPromptMode(det.mode);
    if (det.hostname) setHostname(det.hostname);

    // Parse "show onu status all" rows like: GPON0/1:1  online  48575443A1B2C301
    const rows = [
      ...chunk.matchAll(/(?:GPON|EPON)0\/(\d+):(\d+)\s+(online|offline|los)\s+([0-9a-fA-F.:-]{12,20})/gi),
    ];
    if (rows.length > 0) {
      setOnus((prev) => {
        const map = new Map<string, VsolOnu>();
        prev.forEach((o) => map.set(`${o.ponPort}:${o.onuId}`, o));
        rows.forEach((m) => {
          const ponPort = parseInt(m[1], 10);
          const onuId = parseInt(m[2], 10);
          const status = m[3].toLowerCase() as VsolOnu['status'];
          const macOrSn = m[4];
          const key = `${ponPort}:${onuId}`;
          const existing = map.get(key);
          map.set(
            key,
            existing
              ? { ...existing, macOrSn, status }
              : {
                  id: `live_vs_${key}`,
                  tech: spec.tech,
                  ponPort,
                  onuId,
                  macOrSn,
                  desc: `Live-VSOL-0/${ponPort}:${onuId}`,
                  vlan: 100,
                  lineProfile: 10,
                  srvProfile: 10,
                  status,
                  rxPowerDbm: -19.5,
                }
          );
        });
        return Array.from(map.values());
      });
    }

    // Parse OPM Rx power
    const rxM = chunk.match(/Rx\s*(?:optical)?\s*power[^-\d+]*([+-]?\d+(?:\.\d+)?)/i);
    if (rxM && lastOpticTarget) {
      const val = parseFloat(rxM[1]);
      if (!Number.isNaN(val)) {
        setOnus((prev) =>
          prev.map((o) =>
            o.ponPort === lastOpticTarget.pon && o.onuId === lastOpticTarget.onuId
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
      return [{ id: `vs_hn_${Date.now()}`, type: 'success', text: `  Hostname updated to ${n}` }];
    }
    if (lower.includes('show onu status') || lower.includes('show onu authinfo')) {
      return [
        {
          id: `vs_st_${Date.now()}`,
          type: 'output',
          text:
            `  PON:ID     SN / MAC            VLAN  Rx(dBm)  Status   Description\n  ---------------------------------------------------------------------\n` +
            onus
              .map(
                (o) =>
                  `  ${ifaceTech}0/${o.ponPort}:${String(o.onuId).padEnd(3)} ${o.macOrSn.padEnd(19)} ${String(o.vlan).padEnd(5)} ${o.rxPowerDbm.toFixed(2).padEnd(8)} ${o.status.padEnd(8)} ${o.desc}`
              )
              .join('\n'),
        },
      ];
    }
    if (lower === 'write' || lower === 'save') {
      return [{ id: `vs_wr_${Date.now()}`, type: 'success', text: '  Configuration saved to flash memory.' }];
    }
    return null;
  };

  const handlePonToggle = async (pNum: number) => {
    const isDown = Boolean(shutdownPorts[pNum]);
    setShutdownPorts((prev) => ({ ...prev, [pNum]: !isDown }));
    await push(
      `${isDown ? 'Enable' : 'Shutdown'} VSOL ${ifaceTech} 0/${pNum}`,
      `enable\nconfigure terminal\ninterface ${ifaceTech} 0/${pNum}\n${isDown ? 'no shutdown' : 'shutdown'}\nexit`
    );
  };

  const buildAddOnuCli = () => {
    const p = parseInt(addPonPort, 10) || 1;
    const id = parseInt(addOnuId, 10) || 1;
    const safeDesc = (addDesc.trim() || 'VSOL-ONU').replace(/\s+/g, '_');
    if (spec.tech === 'GPON') {
      return [
        'enable',
        'configure terminal',
        `interface gpon 0/${p}`,
        `ont add ${p} ${id} sn-auth ${addMacOrSn.trim().toUpperCase()} ont-lineprofile-id ${addLineProf} ont-srvprofile-id ${addSrvProf}`,
        `onu ${id} description ${safeDesc}`,
        `onu ${id} eth 1 vlan mode tag ${addVlan}`,
        'exit',
        'write',
      ].join('\n');
    }
    return [
      'enable',
      'configure terminal',
      `interface epon 0/${p}`,
      `onu add ${id} mac ${addMacOrSn.trim().toLowerCase()}`,
      `onu ${id} description ${safeDesc}`,
      `onu ${id} eth 1 vlan mode tag ${addVlan}`,
      'exit',
      'write',
    ].join('\n');
  };

  const handleAddOnuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(addPonPort, 10) || 1;
    const id = parseInt(addOnuId, 10) || 1;
    const item: VsolOnu = {
      id: `v_${Date.now()}`,
      tech: spec.tech,
      ponPort: p,
      onuId: id,
      macOrSn: addMacOrSn.trim(),
      desc: addDesc.trim() || `VSOL-0/${p}:${id}`,
      vlan: parseInt(addVlan, 10) || 100,
      lineProfile: parseInt(addLineProf, 10) || 10,
      srvProfile: parseInt(addSrvProf, 10) || 10,
      status: 'online',
      rxPowerDbm: -19.4,
    };
    setOnus((prev) => [item, ...prev]);
    setAutoFind((prev) => prev.filter((a) => a.macOrSn.toUpperCase() !== item.macOrSn.toUpperCase()));
    await push(`Register VSOL ${spec.tech} ONU 0/${p}:${id}`, buildAddOnuCli());
    setTab('onus');
  };

  const openEditOnu = (onu: VsolOnu) => {
    setEditingOnu(onu);
    setEditDesc(onu.desc);
    setEditEthPort('1');
    setEditVlanMode('tag');
    setEditVlan(String(onu.vlan));
    setEditRateKbps('51200');
    setEditEthShutdown(false);
  };

  const handleSaveEditOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOnu) return;
    const safeDesc = (editDesc.trim() || editingOnu.desc).replace(/\s+/g, '_');
    const v = parseInt(editVlan, 10) || editingOnu.vlan;
    setOnus((prev) => prev.map((o) => (o.id === editingOnu.id ? { ...o, desc: safeDesc, vlan: v } : o)));
    const lines = [
      'enable',
      'configure terminal',
      `interface ${ifaceTech} 0/${editingOnu.ponPort}`,
      `onu ${editingOnu.onuId} description ${safeDesc}`,
      editVlanMode === 'transparent'
        ? `onu ${editingOnu.onuId} eth ${editEthPort} vlan mode transparent`
        : `onu ${editingOnu.onuId} eth ${editEthPort} vlan mode tag ${v}`,
      `onu ${editingOnu.onuId} eth ${editEthPort} rate-limit ${editRateKbps}`,
      editEthShutdown ? `onu ${editingOnu.onuId} eth ${editEthPort} shutdown` : `no onu ${editingOnu.onuId} eth ${editEthPort} shutdown`,
      'exit',
    ];
    await push(`Edit VSOL ONU 0/${editingOnu.ponPort}:${editingOnu.onuId}`, lines.join('\n'));
    setEditingOnu(null);
  };

  const handleOnuAction = async (onu: VsolOnu, action: 'optical' | 'mac' | 'reboot' | 'delete') => {
    if (action === 'optical') {
      setLastOpticTarget({ pon: onu.ponPort, onuId: onu.onuId });
      const cli =
        spec.tech === 'GPON'
          ? `enable\nconfigure terminal\ninterface gpon 0/${onu.ponPort}\nshow onu ${onu.onuId} optical-info\nexit`
          : `enable\nconfigure terminal\ninterface epon 0/${onu.ponPort}\nshow onu ${onu.onuId} ctc opm_diag\nexit`;
      await push(`OPM Optical Info 0/${onu.ponPort}:${onu.onuId}`, cli);
    } else if (action === 'mac') {
      await push(`MAC Table 0/${onu.ponPort}:${onu.onuId}`, `show mac address-table ${ifaceTech} 0/${onu.ponPort} onu ${onu.onuId}`);
    } else if (action === 'reboot') {
      await push(
        `Reboot VSOL ONU 0/${onu.ponPort}:${onu.onuId}`,
        `enable\nconfigure terminal\ninterface ${ifaceTech} 0/${onu.ponPort}\nonu ${onu.onuId} reboot\nexit`
      );
    } else if (action === 'delete') {
      setOnus((prev) => prev.filter((x) => x.id !== onu.id));
      await push(
        `Delete VSOL ONU 0/${onu.ponPort}:${onu.onuId}`,
        `enable\nconfigure terminal\ninterface ${ifaceTech} 0/${onu.ponPort}\nno onu ${onu.onuId}\nexit`
      );
    }
  };

  const handlePushProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profSub === 'dba') {
      await push(
        `Create VSOL DBA Profile #${dbaId}`,
        `enable\nconfigure terminal\ndba-profile add profile-id ${dbaId} profile-name "${dbaName}" type4 max ${dbaMax}`
      );
    } else if (profSub === 'line') {
      await push(
        `Create VSOL Line Profile #${lpId}`,
        `enable\nconfigure terminal\nont-lineprofile gpon profile-id ${lpId} profile-name "${lpName}"\ntcont 1 dba-profile-id ${dbaId}\ngem add 1 eth tcont 1\ngem mapping 1 0 vlan ${lpVlan}\ncommit\nquit`
      );
    } else {
      await push(
        `Create VSOL Service Profile #${spId}`,
        `enable\nconfigure terminal\nont-srvprofile gpon profile-id ${spId} profile-name "${spName}"\nont-port eth ${spEthCnt} pots 0\nport vlan eth 1 translation ${spVlan} user-vlan ${spVlan}\ncommit\nquit`
      );
    }
  };

  const handleAddVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const vid = parseInt(newVlanId, 10);
    if (!vid) return;
    setVlans((prev) => [{ id: vid, desc: newVlanDesc.trim() || `VLAN-${vid}`, uplinkPort: uplinkIface }, ...prev.filter((v) => v.id !== vid)]);
    const cli = [
      'enable',
      'configure terminal',
      `vlan ${vid}`,
      `description ${newVlanDesc.trim() || `VLAN-${vid}`}`,
      'exit',
      `interface ${uplinkIface}`,
      'switchport mode trunk',
      `switchport trunk vlan ${trunkRange}`,
      'no shutdown',
      'exit',
    ].join('\n');
    await push(`Create VSOL VLAN ${vid} & Trunk ${uplinkIface}`, cli);
  };

  const handleDeleteVlan = async (v: VsolVlan) => {
    setVlans((prev) => prev.filter((x) => x.id !== v.id));
    await push(`Delete VSOL VLAN ${v.id}`, `enable\nconfigure terminal\nno vlan ${v.id}`);
  };

  const handleApplySystem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      'enable',
      'configure terminal',
      `hostname ${hostname.trim()}`,
      `vlan ${mgmtVlan}`,
      'exit',
      `interface vlan ${mgmtVlan}`,
      `ip address ${mgmtIp.trim()} ${mgmtMask.trim()}`,
      'exit',
      `ip route 0.0.0.0/0 ${defaultGw.trim()}`,
      'write',
    ].join('\n');
    await push(`Apply VSOL System (${hostname} / ${mgmtIp})`, cli);
  };

  const filteredOnus = onus.filter((o) => {
    if (selectedPonPort !== 'ALL' && o.ponPort !== selectedPonPort) return false;
    const q = searchQ.trim().toLowerCase();
    if (!q) return true;
    return o.macOrSn.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q) || `${o.ponPort}:${o.onuId}`.includes(q);
  });

  const cheatCats = ['ALL', ...Array.from(new Set(VSOL_OFFICIAL_CHEATSHEET.map((c) => c.category)))];
  const filteredCheat = VSOL_OFFICIAL_CHEATSHEET.filter((item) => {
    if (cheatCat !== 'ALL' && item.category !== cheatCat) return false;
    const q = cheatSearch.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.command.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const promptLabel =
    promptMode === 'config'
      ? `${hostname}(config)# `
      : promptMode === 'subview'
      ? `${hostname}(config-pon)# `
      : `${hostname}(config)# `;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-black tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-black shrink-0" />
            <span>VSOL EPON / GPON OLT Full WebUI &amp; Bidirectional Live Telnet</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {spec.heightU} · {spec.ponPorts}x {spec.tech} PON · {spec.uplinkSummary} · Max {spec.maxOnus} · {spec.backplane}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value as VsolOltModel)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black"
          >
            {(Object.keys(VSOL_DATASHEETS) as VsolOltModel[]).map((m) => (
              <option key={m} value={m}>
                VSOL {m} ({VSOL_DATASHEETS[m].tech} {VSOL_DATASHEETS[m].ponPorts}P)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => push('Save VSOL Config (write)', 'write')}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>write</span>
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
                Mgmt: <strong className="text-black">{mgmtIp}</strong> · ONUs:{' '}
                <strong className="text-black">{onus.length}</strong> · Auto-Find:{' '}
                <strong className="text-amber-700">{autoFind.length}</strong> · Default: <span className="text-slate-500">{spec.defaultCreds}</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-600">
              {isLiveConnected ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  Live VSOL Synced
                </span>
              ) : (
                'Offline VSOL Builder'
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
                        setAddPonPort(String(pNum));
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
                    onClick={() =>
                      push(
                        `Auto-Learn Port 0/${selectedPonPort}`,
                        spec.tech === 'GPON'
                          ? `enable\nconfigure terminal\ninterface gpon 0/${selectedPonPort}\nshow onu auto-learn\nexit`
                          : 'show onu auto-find'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    Auto-Find
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      push(
                        `Port OPM Optics 0/${selectedPonPort}`,
                        `enable\nconfigure terminal\ninterface ${ifaceTech} 0/${selectedPonPort}\nshow onu opm-diag\nexit`
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                  >
                    OPM Optics
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePonToggle(selectedPonPort)}
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
                { id: 'add-onu', label: '+ Register ONU', icon: Plus },
                { id: 'profiles', label: 'DBA / Line / Srv', icon: Gauge },
                { id: 'vlans', label: 'VLANs & SFP+', icon: Cable },
                { id: 'optics', label: 'OPM & MAC', icon: Activity },
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
                    <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search SN, MAC, Description..." className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono" />
                  </div>
                  <button type="button" onClick={() => push('Scan Auto-Find ONUs', spec.tech === 'GPON' ? 'enable\nconfigure terminal\ninterface gpon 0/1\nshow onu auto-learn\nexit' : 'show onu auto-find')} className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold flex items-center gap-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Find</span>
                  </button>
                  <button type="button" onClick={() => push('Show All ONU Status', 'show onu status all')} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-black text-xs font-semibold cursor-pointer">
                    Status All
                  </button>
                </div>

                {editingOnu && (
                  <form onSubmit={handleSaveEditOnu} className="p-3.5 rounded-lg bg-slate-50 border border-slate-300 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-bold text-black font-mono">
                      <span>Live Edit VSOL {ifaceTech} 0/{editingOnu.ponPort}:{editingOnu.onuId} ({editingOnu.macOrSn})</span>
                      <button type="button" onClick={() => setEditingOnu(null)} className="cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="col-span-2 block">
                        <span className="text-[11px] text-slate-600">Description</span>
                        <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">UNI ETH Port</span>
                        <select value={editEthPort} onChange={(e) => setEditEthPort(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono">
                          <option value="1">ETH 1</option>
                          <option value="2">ETH 2</option>
                          <option value="3">ETH 3</option>
                          <option value="4">ETH 4</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">VLAN Mode</span>
                        <select value={editVlanMode} onChange={(e) => setEditVlanMode(e.target.value as 'tag' | 'transparent')} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono">
                          <option value="tag">tag</option>
                          <option value="transparent">transparent</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">VLAN ID</span>
                        <input type="number" value={editVlan} onChange={(e) => setEditVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                      <label className="block">
                        <span className="text-[11px] text-slate-600">Rate Limit (kbps)</span>
                        <input type="number" value={editRateKbps} onChange={(e) => setEditRateKbps(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 font-semibold text-black cursor-pointer">
                        <input type="checkbox" checked={editEthShutdown} onChange={(e) => setEditEthShutdown(e.target.checked)} className="accent-black" />
                        <span>Shutdown ETH Port</span>
                      </label>
                      <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold flex items-center gap-1 cursor-pointer">
                        <Send className="w-3.5 h-3.5" />
                        <span>Push Live to Telnet</span>
                      </button>
                    </div>
                  </form>
                )}

                {autoFind.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-amber-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-950">Auto-Find Unregistered Queue ({autoFind.length})</span>
                      <span className="text-[11px] font-mono text-amber-800">{spec.tech === 'GPON' ? 'show onu auto-learn' : 'show onu auto-find'}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {autoFind.map((af) => (
                        <div key={af.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-slate-50">
                          <div className="font-mono">
                            <strong className="text-black">PON 0/{af.ponPort}</strong> · <strong className="text-black">{af.macOrSn}</strong> · <span className="text-slate-600">{af.vendor}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAddPonPort(String(af.ponPort));
                              setAddMacOrSn(af.macOrSn);
                              setAddDesc(`${af.vendor.replace(/\s+/g, '-')}`);
                              setTab('add-onu');
                            }}
                            className="px-2.5 py-1 rounded bg-black text-white text-[11px] font-bold cursor-pointer"
                          >
                            + Register
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-2.5">PON:ID</th>
                        <th className="py-2 px-2.5">SN / MAC &amp; Desc</th>
                        <th className="py-2 px-2.5">VLAN / Prof</th>
                        <th className="py-2 px-2.5">Rx dBm</th>
                        <th className="py-2 px-2.5">State</th>
                        <th className="py-2 px-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOnus.map((onu) => (
                        <tr key={onu.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-bold text-black">{ifaceTech}0/{onu.ponPort}:{onu.onuId}</td>
                          <td className="py-2 px-2.5">
                            <div className="font-bold text-black">{onu.macOrSn}</div>
                            <div className="text-[11px] font-sans text-slate-600">{onu.desc}</div>
                          </td>
                          <td className="py-2 px-2.5 text-[11px]">
                            <div className="font-bold text-black">VLAN {onu.vlan}</div>
                            <div className="text-slate-500">LP:{onu.lineProfile} · SP:{onu.srvProfile}</div>
                          </td>
                          <td className={`py-2 px-2.5 font-bold ${onu.rxPowerDbm <= -28 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {onu.rxPowerDbm.toFixed(2)} dBm
                          </td>
                          <td className="py-2 px-2.5 font-sans font-semibold">
                            <span className={onu.status === 'online' ? 'text-emerald-700' : 'text-red-700'}>{onu.status}</span>
                          </td>
                          <td className="py-2 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => openEditOnu(onu)} title="Edit ETH VLAN / Rate / Desc" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'optical')} title="OPM Optical Info" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"><Zap className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'mac')} title="MAC Table" className="px-1.5 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 text-[10px] font-bold cursor-pointer">MAC</button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'reboot')} title="Reboot ONU" className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer"><RotateCw className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => handleOnuAction(onu, 'delete')} title="Delete ONU" className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: + REGISTER ONU */}
            {tab === 'add-onu' && (
              <form onSubmit={handleAddOnuSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block">
                    <span className="text-[11px] text-slate-600">PON Port (1–{spec.ponPorts})</span>
                    <input type="number" min={1} max={spec.ponPorts} value={addPonPort} onChange={(e) => setAddPonPort(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">ONU / ONT ID</span>
                    <input type="number" min={1} max={128} value={addOnuId} onChange={(e) => setAddOnuId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">{spec.tech === 'GPON' ? 'ONT Serial Number' : 'ONU MAC Address'}</span>
                    <input type="text" value={addMacOrSn} onChange={(e) => setAddMacOrSn(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" required />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">Description</span>
                    <input type="text" value={addDesc} onChange={(e) => setAddDesc(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-600">ETH 1 VLAN</span>
                    <input type="number" value={addVlan} onChange={(e) => setAddVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                  </label>
                  {spec.tech === 'GPON' && (
                    <label className="block">
                      <span className="text-[11px] text-slate-600">Line / Srv Profile</span>
                      <div className="mt-1 flex gap-1">
                        <input type="number" value={addLineProf} onChange={(e) => setAddLineProf(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                        <input type="number" value={addSrvProf} onChange={(e) => setAddSrvProf(e.target.value)} className="w-1/2 bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono" />
                      </div>
                    </label>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-slate-600 mb-1">Live VSOL CLI Preview:</div>
                  <pre className="text-[11px] font-mono text-black whitespace-pre-wrap">{buildAddOnuCli()}</pre>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 rounded-lg bg-black text-white font-bold flex items-center gap-1.5 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>Register ONU &amp; Push Live</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: DBA / LINE / SRV PROFILES */}
            {tab === 'profiles' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-1.5">
                  {(['dba', 'line', 'srv'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setProfSub(s)} className={`px-3 py-1.5 rounded-lg font-semibold border cursor-pointer ${profSub === s ? 'bg-black text-white border-black' : 'bg-white text-slate-700 border-slate-300'}`}>
                      {s === 'dba' ? 'DBA Profile' : s === 'line' ? 'Line Profile' : 'Service Profile'}
                    </button>
                  ))}
                </div>
                <form onSubmit={handlePushProfile} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  {profSub === 'dba' && (
                    <div className="grid grid-cols-3 gap-2.5">
                      <label className="block"><span className="text-[11px] text-slate-600">DBA ID</span><input type="number" value={dbaId} onChange={(e) => setDbaId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">Name</span><input type="text" value={dbaName} onChange={(e) => setDbaName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">Max BW (kbps)</span><input type="number" value={dbaMax} onChange={(e) => setDbaMax(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                    </div>
                  )}
                  {profSub === 'line' && (
                    <div className="grid grid-cols-3 gap-2.5">
                      <label className="block"><span className="text-[11px] text-slate-600">Line Profile ID</span><input type="number" value={lpId} onChange={(e) => setLpId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">Name</span><input type="text" value={lpName} onChange={(e) => setLpName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">GEM Map VLAN</span><input type="number" value={lpVlan} onChange={(e) => setLpVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                    </div>
                  )}
                  {profSub === 'srv' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <label className="block"><span className="text-[11px] text-slate-600">Srv ID</span><input type="number" value={spId} onChange={(e) => setSpId(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">Name</span><input type="text" value={spName} onChange={(e) => setSpName(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">ETH Ports</span><input type="number" value={spEthCnt} onChange={(e) => setSpEthCnt(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                      <label className="block"><span className="text-[11px] text-slate-600">VLAN</span><input type="number" value={spVlan} onChange={(e) => setSpVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Push &amp; Commit Profile
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: VLANS & UPLINK SFP+ */}
            {tab === 'vlans' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleAddVlan} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="font-bold text-black">Create VSOL VLAN &amp; Tag on 10G SFP+ Uplink</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="number" value={newVlanId} onChange={(e) => setNewVlanId(e.target.value)} placeholder="VLAN ID" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newVlanDesc} onChange={(e) => setNewVlanDesc(e.target.value)} placeholder="Description" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={uplinkIface} onChange={(e) => setUplinkIface(e.target.value)} placeholder="tengigabitethernet 0/1" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={trunkRange} onChange={(e) => setTrunkRange(e.target.value)} placeholder="100-300" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Create &amp; Trunk VLAN
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">VLAN</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3">Uplink SFP+</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vlans.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{v.id}</td>
                          <td className="py-2 px-3 text-slate-700">{v.desc}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{v.uplinkPort}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleDeleteVlan(v)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: OPM & MAC */}
            {tab === 'optics' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { title: 'All ONU Optical Power (OPM)', cmd: 'show onu opm-diag all', desc: 'Bulk Rx/Tx dBm power across every connected VSOL ONU.' },
                  { title: 'OLT PON SFP Transceiver', cmd: 'show pon optical transceiver', desc: 'Read OLT SFP Tx power, temperature & supply voltage.' },
                  { title: 'Learned MAC Table', cmd: 'show mac address-table', desc: 'Inspect customer MACs behind ONUs and SFP+ uplinks.' },
                  { title: 'Authenticated ONU List', cmd: 'show onu authinfo all', desc: 'Audit every authorized SN/MAC and assigned profile.' },
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
                  <span className="font-bold text-black">VSOL Hostname, Mgmt VLAN IP &amp; Static Route</span>
                  <button type="button" onClick={() => push('VSOL System Info', 'show system\nshow version\nshow ip route')} className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold cursor-pointer">
                    System Info
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="block"><span className="text-[11px] text-slate-600">Hostname</span><input type="text" value={hostname} onChange={(e) => setHostname(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                  <label className="block"><span className="text-[11px] text-slate-600">Mgmt VLAN</span><input type="number" value={mgmtVlan} onChange={(e) => setMgmtVlan(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                  <label className="block"><span className="text-[11px] text-slate-600">Mgmt IP</span><input type="text" value={mgmtIp} onChange={(e) => setMgmtIp(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                  <label className="block"><span className="text-[11px] text-slate-600">Subnet Mask</span><input type="text" value={mgmtMask} onChange={(e) => setMgmtMask(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                  <label className="block"><span className="text-[11px] text-slate-600">Default Gateway</span><input type="text" value={defaultGw} onChange={(e) => setDefaultGw(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" /></label>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                    Apply System &amp; write
                  </button>
                </div>
              </form>
            )}

            {/* TAB 7: DATASHEET & CLI CHEAT SHEET */}
            {tab === 'cheatsheet' && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-black">Official Datasheet: VSOL {spec.model}</span>
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
                      <div className="text-[11px] text-slate-500">Backplane</div>
                      <div className="font-mono font-bold text-black">{spec.backplane}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Uplinks</div>
                      <div className="font-mono text-black">{spec.uplinkSummary}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Factory Default</div>
                      <div className="font-mono text-[11px] text-slate-700">{spec.defaultCreds}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={cheatSearch} onChange={(e) => setCheatSearch(e.target.value)} placeholder="Search VSOL commands (opm-diag, auto-find, dba, lineprofile, write)..." className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs" />
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
                          <button type="button" onClick={() => push(item.title, item.requiresConfig ? `enable\nconfigure terminal\n${item.command}` : item.command, true)} className="px-2.5 py-1 rounded bg-black text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer">
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
          vendor="VSOL"
          title="Live VSOL OLT Telnet"
          defaultHost={defaultHostIp || '192.168.8.200'}
          defaultUser="admin"
          defaultPass="Xpon@Olt9417#"
          promptLabel={promptLabel}
          promptModeLabel={promptMode === 'unknown' ? 'VSOL OLT' : promptMode}
          promptMode={promptMode}
          syncCommandTitle="Sync Live VSOL OLT"
          syncCommandScript={`enable\nshow onu status all\nshow onu opm-diag all\nshow vlan all`}
          prepareLinesForLive={(raw, mode, isLive) =>
            prepareCiscoStyleScriptForPrompt(raw, mode, isLive, 'configure terminal')
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
