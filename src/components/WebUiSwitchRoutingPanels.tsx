import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Send,
  Copy,
  Check,
  GitBranch,
  Layers,
  Shield,
  Terminal as TerminalIcon,
  Network,
} from 'lucide-react';
import { TerminalVendor } from '../types/vpn';
import {
  WebUiDevicePreset,
  WebUiSwitchPort,
  WebUiLagBundle,
  WebUiBgpPeer,
  WebUiOspfEntry,
  genSwitchPortModeCli,
  genLagCreateCli,
  genStpConfigCli,
  genMacLookupCli,
  genBgpPeerCli,
  genOspfNetworkCli,
} from '../services/universalWebUiCli';
import { DEVICE_COMMAND_CATALOG } from '../services/deviceCommandCatalog';

interface SwitchL2PanelProps {
  brand: TerminalVendor;
  device: WebUiDevicePreset;
  onUpdateDevice: (updater: (prev: WebUiDevicePreset) => WebUiDevicePreset) => void;
  onEmitCli: (title: string, cli: string, forcePush?: boolean) => Promise<void>;
}

export const SwitchL2Panel: React.FC<SwitchL2PanelProps> = ({
  brand,
  device,
  onUpdateDevice,
  onEmitCli,
}) => {
  // Switchport Access/Trunk form
  const [portName, setPortName] = useState(device.switchPorts[0]?.portName || device.interfaces[0]?.name || 'GigabitEthernet0/1');
  const [portMode, setPortMode] = useState<'access' | 'trunk'>('trunk');
  const [accessVlan, setAccessVlan] = useState('100');
  const [allowedVlans, setAllowedVlans] = useState('100,200,300');
  const [nativeVlan, setNativeVlan] = useState('1');
  const [stpEdge, setStpEdge] = useState(false);
  const [bpduGuard, setBpduGuard] = useState(false);

  // LACP / LAG form
  const [lagId, setLagId] = useState('1');
  const [lagMode, setLagMode] = useState<'lacp-active' | 'static-on'>('lacp-active');
  const [lagMembers, setLagMembers] = useState(device.lags[0]?.members || 'Ethernet1,Ethernet2');
  const [lagVlans, setLagVlans] = useState('100,200');
  const [lagDesc, setLagDesc] = useState('Core-LACP-Uplink');

  // STP & MAC Lookup
  const [stpMode, setStpMode] = useState<'rstp' | 'mstp'>('rstp');
  const [stpPriority, setStpPriority] = useState('4096');
  const [macQuery, setMacQuery] = useState('');

  useEffect(() => {
    setPortName(device.switchPorts[0]?.portName || device.interfaces[0]?.name || 'GigabitEthernet0/1');
    setLagMembers(device.lags[0]?.members || `${device.interfaces[0]?.name || 'eth0'},${device.interfaces[1]?.name || 'eth1'}`);
  }, [brand, device.interfaces, device.lags, device.switchPorts]);

  const handleApplySwitchPort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portName.trim()) return;
    const item: WebUiSwitchPort = {
      id: `sp_${Date.now()}`,
      portName: portName.trim(),
      mode: portMode,
      accessVlan: parseInt(accessVlan, 10) || 100,
      allowedVlans: allowedVlans.trim() || '100,200',
      nativeVlan: parseInt(nativeVlan, 10) || 1,
      stpEdge,
      bpduGuard,
    };
    onUpdateDevice((d) => {
      const exists = d.switchPorts.some((p) => p.portName === item.portName);
      return {
        ...d,
        switchPorts: exists
          ? d.switchPorts.map((p) => (p.portName === item.portName ? item : p))
          : [item, ...d.switchPorts],
      };
    });
    await onEmitCli(`Switchport ${item.mode.toUpperCase()} on ${item.portName}`, genSwitchPortModeCli(brand, item));
  };

  const handleTogglePortModeQuick = async (sp: WebUiSwitchPort) => {
    const updated: WebUiSwitchPort = {
      ...sp,
      mode: sp.mode === 'trunk' ? 'access' : 'trunk',
    };
    onUpdateDevice((d) => ({
      ...d,
      switchPorts: d.switchPorts.map((p) => (p.id === sp.id ? updated : p)),
    }));
    await onEmitCli(`Switch ${updated.portName} to ${updated.mode.toUpperCase()}`, genSwitchPortModeCli(brand, updated));
  };

  const handleAddLag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lagMembers.trim()) return;
    const item: WebUiLagBundle = {
      id: `lag_${Date.now()}`,
      lagId: parseInt(lagId, 10) || 1,
      mode: lagMode,
      members: lagMembers.trim(),
      allowedVlans: lagVlans.trim() || '100,200',
      desc: lagDesc.trim() || `LAG-${lagId}`,
    };
    onUpdateDevice((d) => ({ ...d, lags: [item, ...d.lags] }));
    await onEmitCli(`Create LACP / LAG #${item.lagId}`, genLagCreateCli(brand, item));
  };

  return (
    <div className="space-y-5">
      {/* 1. Switchport Access / Trunk Builder */}
      <form onSubmit={handleApplySwitchPort} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Network className="w-4 h-4 text-black" />
            <span>Switchport Access / Trunk &amp; STP Edge ({brand})</span>
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-300 rounded-lg">
            {(['access', 'trunk'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPortMode(m)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase cursor-pointer transition ${
                  portMode === m ? 'bg-black text-white' : 'text-slate-700 hover:text-black'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            required
            value={portName}
            onChange={(e) => setPortName(e.target.value)}
            placeholder="Interface (e.g. Gi0/1)"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
          {portMode === 'access' ? (
            <input
              type="number"
              min={1}
              max={4094}
              value={accessVlan}
              onChange={(e) => setAccessVlan(e.target.value)}
              placeholder="Access VLAN (e.g. 100)"
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
            />
          ) : (
            <>
              <input
                type="text"
                value={allowedVlans}
                onChange={(e) => setAllowedVlans(e.target.value)}
                placeholder="Allowed VLANs (100,200)"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <input
                type="number"
                min={1}
                max={4094}
                value={nativeVlan}
                onChange={(e) => setNativeVlan(e.target.value)}
                placeholder="Native VLAN (1)"
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
            </>
          )}
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Apply Switchport</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-black">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={stpEdge} onChange={(e) => setStpEdge(e.target.checked)} className="accent-black" />
            <span>STP PortFast / Edge-Port</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={bpduGuard} onChange={(e) => setBpduGuard(e.target.checked)} className="accent-black" />
            <span>BPDU Guard / Loop Protection</span>
          </label>
        </div>
      </form>

      {/* Switchport Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
              <th className="py-2 px-3">Port</th>
              <th className="py-2 px-3">Mode</th>
              <th className="py-2 px-3">VLAN Assignment</th>
              <th className="py-2 px-3">STP Safeguards</th>
              <th className="py-2 px-3 text-right">Quick Switch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {device.switchPorts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 px-3 text-center text-slate-600 font-sans">
                  No switchports configured yet. Use the form above to assign Access or Trunk VLANs.
                </td>
              </tr>
            ) : (
              device.switchPorts.map((sp) => (
                <tr key={sp.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-black">{sp.portName}</td>
                  <td className="py-2 px-3 font-bold text-black uppercase">{sp.mode}</td>
                  <td className="py-2 px-3 text-slate-700 tabular-nums">
                    {sp.mode === 'trunk'
                      ? `Allowed: ${sp.allowedVlans} · Native ${sp.nativeVlan}`
                      : `PVID / Access VLAN ${sp.accessVlan}`}
                  </td>
                  <td className="py-2 px-3 text-slate-700 font-sans">
                    {[sp.stpEdge ? 'Edge/PortFast' : null, sp.bpduGuard ? 'BPDU-Guard' : null]
                      .filter(Boolean)
                      .join(' · ') || 'Standard'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleTogglePortModeQuick(sp)}
                      className="px-2.5 py-1 rounded bg-white hover:bg-black hover:text-white text-black border border-slate-300 text-[11px] font-bold cursor-pointer transition"
                    >
                      Toggle {sp.mode === 'trunk' ? 'Access' : 'Trunk'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2. LACP / Port-Channel / Eth-Trunk / Bonding Builder */}
      <form onSubmit={handleAddLag} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Layers className="w-4 h-4 text-black" />
            <span>Link Aggregation (LACP / Port-Channel / Eth-Trunk / AggregatePort / Bonding)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-600 tabular-nums">{device.lags.length} active</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input
            type="number"
            min={0}
            max={128}
            value={lagId}
            onChange={(e) => setLagId(e.target.value)}
            placeholder="LAG ID"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <select
            value={lagMode}
            onChange={(e) => setLagMode(e.target.value as 'lacp-active' | 'static-on')}
            className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-black"
          >
            <option value="lacp-active">802.3ad LACP Active</option>
            <option value="static-on">Static / Manual On</option>
          </select>
          <input
            type="text"
            required
            value={lagMembers}
            onChange={(e) => setLagMembers(e.target.value)}
            placeholder="Member Ports (comma sep)"
            className="sm:col-span-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={lagVlans}
            onChange={(e) => setLagVlans(e.target.value)}
            placeholder="Trunk VLANs"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={lagDesc}
            onChange={(e) => setLagDesc(e.target.value)}
            placeholder="Description (e.g. 20G Uplink to Core)"
            className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Build LACP Bundle</span>
          </button>
        </div>

        {device.lags.length > 0 && (
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            {device.lags.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-black">LAG #{l.lagId}</span>
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-slate-700">{l.members}</span>
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-slate-700">VLANs {l.allowedVlans}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase">
                  {l.mode === 'lacp-active' ? 'LACP 802.3ad' : 'Static'}
                </span>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* 3. STP Root Bridge & MAC Address Table Finder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Shield className="w-4 h-4 text-black" />
            <span>Spanning-Tree (RSTP / MSTP) Root Priority</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={stpMode}
              onChange={(e) => setStpMode(e.target.value as 'rstp' | 'mstp')}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
            >
              <option value="rstp">Rapid-STP (RSTP)</option>
              <option value="mstp">Multiple-STP (MSTP)</option>
            </select>
            <select
              value={stpPriority}
              onChange={(e) => setStpPriority(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
            >
              <option value="4096">4096 (Primary Root)</option>
              <option value="8192">8192 (Secondary Root)</option>
              <option value="32768">32768 (Default)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() =>
              onEmitCli(
                `Configure ${stpMode.toUpperCase()} Priority ${stpPriority}`,
                genStpConfigCli(brand, stpMode, parseInt(stpPriority, 10) || 4096)
              )
            }
            className="w-full py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Apply STP Settings
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <Search className="w-4 h-4 text-black" />
            <span>Live MAC Address Table Finder ({brand})</span>
          </div>
          <input
            type="text"
            value={macQuery}
            onChange={(e) => setMacQuery(e.target.value)}
            placeholder="MAC address (leave blank for full MAC table)"
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
          <button
            type="button"
            onClick={() =>
              onEmitCli(
                macQuery.trim() ? `Find MAC ${macQuery.trim()}` : 'Show Full MAC Table',
                genMacLookupCli(brand, macQuery)
              )
            }
            className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-black hover:text-white text-black border border-slate-300 text-xs font-bold cursor-pointer transition"
          >
            Query MAC Table in Telnet
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// DYNAMIC ROUTING PANEL: BGP & OSPF GRAPHICAL BUILDER
// =========================================================================

interface BgpOspfPanelProps {
  brand: TerminalVendor;
  device: WebUiDevicePreset;
  onUpdateDevice: (updater: (prev: WebUiDevicePreset) => WebUiDevicePreset) => void;
  onEmitCli: (title: string, cli: string, forcePush?: boolean) => Promise<void>;
}

export const BgpOspfPanel: React.FC<BgpOspfPanelProps> = ({
  brand,
  device,
  onUpdateDevice,
  onEmitCli,
}) => {
  const [localAsn, setLocalAsn] = useState(String(device.bgpPeers[0]?.localAsn || 139900));
  const [routerId, setRouterId] = useState(device.bgpPeers[0]?.routerId || device.mgmtIp);
  const [peerIp, setPeerIp] = useState('103.45.89.1');
  const [remoteAsn, setRemoteAsn] = useState('45276');
  const [peerDesc, setPeerDesc] = useState('IIG-Transit-Peer');
  const [advPrefix, setAdvPrefix] = useState('103.145.88.0/24');

  const [ospfProc, setOspfProc] = useState('1');
  const [ospfArea, setOspfArea] = useState('0.0.0.0');
  const [ospfNet, setOspfNet] = useState('10.99.0.0/24');
  const [ospfPassive, setOspfPassive] = useState(device.interfaces[0]?.name || 'Loopback0');

  useEffect(() => {
    setLocalAsn(String(device.bgpPeers[0]?.localAsn || 139900));
    setRouterId(device.bgpPeers[0]?.routerId || device.mgmtIp);
    setOspfPassive(device.interfaces[0]?.name || 'Loopback0');
  }, [brand, device.bgpPeers, device.interfaces, device.mgmtIp]);

  const handleAddBgpPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerIp.trim()) return;
    const peer: WebUiBgpPeer = {
      id: `bgp_${Date.now()}`,
      localAsn: parseInt(localAsn, 10) || 65001,
      routerId: routerId.trim() || device.mgmtIp,
      peerIp: peerIp.trim(),
      remoteAsn: parseInt(remoteAsn, 10) || 65002,
      desc: peerDesc.trim().replace(/\s+/g, '-') || 'BGP-Peer',
      advertisePrefix: advPrefix.trim() || '10.0.0.0/24',
    };
    onUpdateDevice((d) => ({ ...d, bgpPeers: [peer, ...d.bgpPeers] }));
    await onEmitCli(`Add BGP Peer ${peer.peerIp} (AS${peer.remoteAsn})`, genBgpPeerCli(brand, peer));
  };

  const handleAddOspf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ospfNet.trim()) return;
    const entry: WebUiOspfEntry = {
      id: `ospf_${Date.now()}`,
      processId: parseInt(ospfProc, 10) || 1,
      area: ospfArea.trim() || '0.0.0.0',
      networkCidr: ospfNet.trim(),
      passiveInterface: ospfPassive.trim(),
    };
    onUpdateDevice((d) => ({ ...d, ospfEntries: [entry, ...d.ospfEntries] }));
    await onEmitCli(`Add OSPF Area ${entry.area} (${entry.networkCidr})`, genOspfNetworkCli(brand, entry));
  };

  return (
    <div className="space-y-5">
      {/* BGP Graphical Builder */}
      <form onSubmit={handleAddBgpPeer} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-black">
            <GitBranch className="w-4 h-4 text-black" />
            <span>BGP Peer &amp; Prefix Advertisement ({brand})</span>
          </div>
          <span className="text-[11px] font-mono text-slate-600 tabular-nums">{device.bgpPeers.length} peers</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input
            type="number"
            value={localAsn}
            onChange={(e) => setLocalAsn(e.target.value)}
            placeholder="Local ASN"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={routerId}
            onChange={(e) => setRouterId(e.target.value)}
            placeholder="Router-ID"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            required
            value={peerIp}
            onChange={(e) => setPeerIp(e.target.value)}
            placeholder="Peer IP"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="number"
            value={remoteAsn}
            onChange={(e) => setRemoteAsn(e.target.value)}
            placeholder="Remote ASN"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={advPrefix}
            onChange={(e) => setAdvPrefix(e.target.value)}
            placeholder="Advertise Prefix (/24)"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={peerDesc}
            onChange={(e) => setPeerDesc(e.target.value)}
            placeholder="Peer Description"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add BGP Neighbor</span>
          </button>
        </div>

        {device.bgpPeers.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-700">
                  <th className="py-1.5 px-3">Peer IP</th>
                  <th className="py-1.5 px-3">AS Path</th>
                  <th className="py-1.5 px-3">Advertised Prefix</th>
                  <th className="py-1.5 px-3 text-right">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {device.bgpPeers.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5 px-3 font-bold text-black tabular-nums">{p.peerIp}</td>
                    <td className="py-1.5 px-3 text-slate-700 tabular-nums">
                      AS{p.localAsn} → AS{p.remoteAsn}
                    </td>
                    <td className="py-1.5 px-3 text-emerald-700 font-semibold tabular-nums">{p.advertisePrefix}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {/* OSPF Graphical Builder */}
      <form onSubmit={handleAddOspf} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-black">OSPFv2 Area &amp; Network Advertisement ({brand})</span>
          <span className="text-[11px] font-mono text-slate-600 tabular-nums">{device.ospfEntries.length} networks</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="number"
            value={ospfProc}
            onChange={(e) => setOspfProc(e.target.value)}
            placeholder="Process ID"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={ospfArea}
            onChange={(e) => setOspfArea(e.target.value)}
            placeholder="Area (0.0.0.0)"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            required
            value={ospfNet}
            onChange={(e) => setOspfNet(e.target.value)}
            placeholder="Network CIDR (10.99.0.0/24)"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
          <input
            type="text"
            value={ospfPassive}
            onChange={(e) => setOspfPassive(e.target.value)}
            placeholder="Passive Interface"
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-black"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add OSPF Network</span>
          </button>
        </div>

        {device.ospfEntries.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {device.ospfEntries.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
              >
                <span className="font-bold text-black">
                  OSPF #{o.processId} · Area {o.area}
                </span>
                <span className="text-slate-700 tabular-nums">{o.networkCidr}</span>
                <span className="text-slate-600">Passive: {o.passiveInterface || 'None'}</span>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

// =========================================================================
// MULTI-VENDOR COMMAND CENTER INSIDE WEBUI (ALL MODELS & CATEGORIES)
// =========================================================================

interface CommandCenterPanelProps {
  brand: TerminalVendor;
  onEmitCli: (title: string, cli: string, forcePush?: boolean) => Promise<void>;
}

export const CommandCenterPanel: React.FC<CommandCenterPanelProps> = ({ brand, onEmitCli }) => {
  const models = DEVICE_COMMAND_CATALOG[brand] || [];
  const [selectedCatalogId, setSelectedCatalogId] = useState(models[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    const nextModels = DEVICE_COMMAND_CATALOG[brand] || [];
    setSelectedCatalogId(nextModels[0]?.id || '');
    setCategoryFilter('ALL');
  }, [brand]);

  const activeCatalog = models.find((m) => m.id === selectedCatalogId) || models[0];
  const categories = activeCatalog
    ? ['ALL', ...Array.from(new Set(activeCatalog.commands.map((c) => c.category)))]
    : ['ALL'];

  const filteredCommands = (activeCatalog?.commands || []).filter((c) => {
    const matchCat = categoryFilter === 'ALL' || c.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const matchText = !q || c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
    return matchCat && matchText;
  });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-bold text-black">
          <TerminalIcon className="w-4 h-4 text-black" />
          <span>{brand} Full Command Library</span>
          {activeCatalog && (
            <span className="text-slate-500 font-mono font-normal">
              · {activeCatalog.os} · {filteredCommands.length} commands
            </span>
          )}
        </div>
        {models.length > 1 && (
          <select
            value={selectedCatalogId}
            onChange={(e) => setSelectedCatalogId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono text-black"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model} ({m.os})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Category Filter + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${brand} commands (e.g. vlan, onu, optical, bgp, mac, route)...`}
            className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-black focus:outline-none focus:border-black"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition border ${
              categoryFilter === cat
                ? 'bg-black text-white border-black'
                : 'bg-slate-50 text-black border-slate-300 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Command Table */}
      <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 max-h-[420px] overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-600">
            No matching commands found for "{search}".
          </div>
        ) : (
          filteredCommands.map((entry, idx) => (
            <div
              key={`${entry.cmd}_${idx}`}
              className="p-2.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold text-black break-all">{entry.cmd}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  <span>{entry.desc}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono text-slate-500">{entry.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(entry.cmd);
                    setCopiedCmd(entry.cmd);
                    setTimeout(() => setCopiedCmd(null), 1500);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-black border border-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedCmd === entry.cmd ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === entry.cmd ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEmitCli(entry.desc, entry.cmd)}
                  className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Run</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
