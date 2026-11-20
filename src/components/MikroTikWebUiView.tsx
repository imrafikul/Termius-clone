import React, { useState, useRef } from 'react';
import {
  Router,
  Users,
  Network,
  Route,
  Gauge,
  Shield,
  Sliders,
  BookOpen,
  Plus,
  Trash2,
  Power,
  Check,
  Send,
  Search,
  Save,
  Activity,
  Edit3,
  X,
} from 'lucide-react';
import {
  MikroTikModel,
  MIKROTIK_DATASHEETS,
  MIKROTIK_OFFICIAL_CHEATSHEET,
  detectMikroTikPrompt,
} from '../services/vendorDatasheets';
import { LiveVendorTelnetConsole, TelnetBridgeHandle, ConsoleLine } from './LiveVendorTelnetConsole';

type MtTab = 'ppp' | 'interfaces' | 'routing' | 'queues' | 'firewall' | 'system' | 'cheatsheet';

interface MtPppSecret {
  id: string;
  name: string;
  password: string;
  service: 'any' | 'pppoe' | 'pptp' | 'l2tp' | 'sstp';
  profile: string;
  remoteAddress: string;
  disabled: boolean;
}

interface MtIpAddress {
  id: string;
  address: string;
  interface: string;
  comment: string;
}

interface MtRoute {
  id: string;
  dstAddress: string;
  gateway: string;
  distance: number;
  comment: string;
}

interface MtSimpleQueue {
  id: string;
  name: string;
  target: string;
  maxLimit: string;
  priority: string;
}

interface MtFirewallRule {
  id: string;
  table: 'filter' | 'nat';
  chain: string;
  action: string;
  detail: string;
  comment: string;
}

export const MikroTikWebUiView: React.FC<{ defaultHostIp?: string }> = ({ defaultHostIp }) => {
  const [model, setModel] = useState<MikroTikModel>('CCR2116-12G-4S+');
  const [tab, setTab] = useState<MtTab>('ppp');
  const [identity, setIdentity] = useState('MikroTik-CCR2116-CORE');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const [disabledPorts, setDisabledPorts] = useState<Record<string, boolean>>({});
  const [selectedPort, setSelectedPort] = useState<string>('sfp-sfpplus1');

  // PPP Secrets
  const [pppSecrets, setPppSecrets] = useState<MtPppSecret[]>([
    { id: 'p1', name: 'noc-admin-vpn', password: '******', service: 'any', profile: 'default-encryption', remoteAddress: '10.99.0.50', disabled: false },
    { id: 'p2', name: 'pppoe-rafikul', password: '******', service: 'pppoe', profile: 'pkg-50M', remoteAddress: '100.64.10.21', disabled: false },
    { id: 'p3', name: 'corp-dhaka-01', password: '******', service: 'pppoe', profile: 'pkg-200M', remoteAddress: '103.112.44.10', disabled: false },
  ]);
  const [newPppName, setNewPppName] = useState('client-new-01');
  const [newPppPass, setNewPppPass] = useState('Pass@1234');
  const [newPppService, setNewPppService] = useState<MtPppSecret['service']>('pppoe');
  const [newPppProfile, setNewPppProfile] = useState('default-encryption');
  const [newPppRemoteIp, setNewPppRemoteIp] = useState('100.64.10.55');
  const [editingPpp, setEditingPpp] = useState<MtPppSecret | null>(null);

  // Interfaces / IP / Bridge VLAN
  const [ipAddrs, setIpAddrs] = useState<MtIpAddress[]>([
    { id: 'ip1', address: '103.112.44.2/30', interface: 'sfp-sfpplus1', comment: 'IIG Upstream' },
    { id: 'ip2', address: '10.99.0.1/24', interface: 'vlan100-olt-mgmt', comment: 'OLT Management Gateway' },
    { id: 'ip3', address: '192.168.88.1/24', interface: 'bridge-core', comment: 'LAN / NOC Gateway' },
  ]);
  const [newIpAddr, setNewIpAddr] = useState('10.10.20.1/24');
  const [newIpIface, setNewIpIface] = useState('vlan200-corp');
  const [newIpComment, setNewIpComment] = useState('Corporate VLAN');
  const [bridgeName, setBridgeName] = useState('bridge-core');
  const [vlanId, setVlanId] = useState('100');
  const [vlanName, setVlanName] = useState('vlan100-olt');
  const [vlanTagged, setVlanTagged] = useState('bridge-core,sfp-sfpplus3');

  // Routes, BGP v7 & OSPF
  const [routes, setRoutes] = useState<MtRoute[]>([
    { id: 'r1', dstAddress: '0.0.0.0/0', gateway: '103.112.44.1', distance: 1, comment: 'Primary IIG Default Route' },
    { id: 'r2', dstAddress: '10.99.10.0/24', gateway: '10.99.0.10', distance: 1, comment: 'Huawei OLT Subnets' },
  ]);
  const [newRouteDst, setNewRouteDst] = useState('172.16.0.0/16');
  const [newRouteGw, setNewRouteGw] = useState('10.99.0.10');
  const [newRouteDist, setNewRouteDist] = useState('1');
  const [bgpName, setBgpName] = useState('ISP-IIG-PEER');
  const [bgpLocalAs, setBgpLocalAs] = useState('139999');
  const [bgpRouterId, setBgpRouterId] = useState('103.112.44.2');
  const [bgpRemoteIp, setBgpRemoteIp] = useState('103.112.44.1');
  const [bgpRemoteAs, setBgpRemoteAs] = useState('58715');

  // Simple Queues
  const [queues, setQueues] = useState<MtSimpleQueue[]>([
    { id: 'q1', name: 'Corp-Link-50M', target: '103.112.44.10/32', maxLimit: '50M/50M', priority: '4/4' },
    { id: 'q2', name: 'Office-LAN-100M', target: '192.168.88.0/24', maxLimit: '100M/100M', priority: '6/6' },
  ]);
  const [newQName, setNewQName] = useState('Client-30M');
  const [newQTarget, setNewQTarget] = useState('192.168.88.50/32');
  const [newQLimit, setNewQLimit] = useState('30M/30M');
  const [newQPrio, setNewQPrio] = useState('8/8');

  // Firewall & NAT
  const [fwRules, setFwRules] = useState<MtFirewallRule[]>([
    { id: 'f1', table: 'nat', chain: 'srcnat', action: 'masquerade', detail: 'out-interface=sfp-sfpplus1', comment: 'Default WAN Masquerade' },
    { id: 'f2', table: 'filter', chain: 'forward', action: 'fasttrack-connection', detail: 'connection-state=established,related hw-offload=yes', comment: 'Hardware FastTrack' },
  ]);
  const [natOutIface, setNatOutIface] = useState('sfp-sfpplus1');
  const [dstNatPort, setDstNatPort] = useState('8080');
  const [dstNatToIp, setDstNatToIp] = useState('192.168.88.100');
  const [dstNatToPort, setDstNatToPort] = useState('80');

  // System & Tools
  const [dnsServers, setDnsServers] = useState('1.1.1.1,8.8.8.8');
  const [ntpServers, setNtpServers] = useState('162.159.200.1');
  const [pingTarget, setPingTarget] = useState('8.8.8.8');

  // Datasheet Cheat Sheet
  const [cheatSearch, setCheatSearch] = useState('');
  const [cheatCat, setCheatCat] = useState('ALL');

  const bridgeRef = useRef<TelnetBridgeHandle | null>(null);
  const spec = MIKROTIK_DATASHEETS[model];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const push = async (title: string, script: string, force = false) => {
    if (bridgeRef.current) {
      await bridgeRef.current.pushScript(title, script, force);
    }
  };

  // Bidirectional Live Telnet Parser for RouterOS v7
  const handleLiveOutput = (chunk: string) => {
    const det = detectMikroTikPrompt(chunk);
    if (det.identity) setIdentity(det.identity);

    // Parse `/ip address print` lines like: `0   10.99.0.1/24  10.99.0.0  vlan100`
    const ipMatches = [
      ...chunk.matchAll(/^\s*\d+\s+[A-Z]*\s*(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})\s+\d{1,3}(?:\.\d{1,3}){3}\s+(\S+)/gm),
    ];
    if (ipMatches.length > 0) {
      setIpAddrs(
        ipMatches.map((m, idx) => ({
          id: `live_ip_${idx}_${m[1]}`,
          address: m[1],
          interface: m[2],
          comment: 'Synced from Live RouterOS',
        }))
      );
    }
  };

  const handleLocalCommand = (cmd: string): ConsoleLine[] | null => {
    const lower = cmd.toLowerCase();
    if (lower.startsWith('/system identity set')) {
      const m = cmd.match(/name="?([^"\s]+)"?/i);
      if (m) setIdentity(m[1]);
      return [{ id: `mt_id_${Date.now()}`, type: 'success', text: `  Identity updated to ${m?.[1] || identity}` }];
    }
    if (lower.includes('/ppp secret print')) {
      return [
        {
          id: `mt_ps_${Date.now()}`,
          type: 'output',
          text: pppSecrets
            .map((p, i) => `  ${i} ${p.disabled ? 'X' : ' '} name="${p.name}" service=${p.service} profile=${p.profile} remote-address=${p.remoteAddress}`)
            .join('\n'),
        },
      ];
    }
    if (lower.includes('/ip address print')) {
      return [
        {
          id: `mt_ip_${Date.now()}`,
          type: 'output',
          text: ipAddrs.map((a, i) => `  ${i}  ${a.address.padEnd(20)} ${a.interface.padEnd(18)} ; ${a.comment}`).join('\n'),
        },
      ];
    }
    if (lower.includes('/queue simple print')) {
      return [
        {
          id: `mt_q_${Date.now()}`,
          type: 'output',
          text: queues.map((q, i) => `  ${i}  name="${q.name}" target=${q.target} max-limit=${q.maxLimit} priority=${q.priority}`).join('\n'),
        },
      ];
    }
    return null;
  };

  // Actions -> Live RouterOS v7 CLI
  const handlePortToggle = async (portName: string) => {
    const isOff = Boolean(disabledPorts[portName]);
    setDisabledPorts((prev) => ({ ...prev, [portName]: !isOff }));
    await push(
      `${isOff ? 'Enable' : 'Disable'} ${portName}`,
      `/interface set [find name="${portName}"] disabled=${isOff ? 'no' : 'yes'}`
    );
  };

  const handleAddPppSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPppName.trim()) return;
    const item: MtPppSecret = {
      id: `p_${Date.now()}`,
      name: newPppName.trim(),
      password: newPppPass,
      service: newPppService,
      profile: newPppProfile.trim() || 'default-encryption',
      remoteAddress: newPppRemoteIp.trim(),
      disabled: false,
    };
    setPppSecrets((prev) => [item, ...prev]);
    const remotePart = item.remoteAddress ? ` remote-address=${item.remoteAddress}` : '';
    await push(
      `Add PPP Secret "${item.name}"`,
      `/ppp secret add name="${item.name}" password="${item.password}" service=${item.service} profile="${item.profile}"${remotePart}`
    );
  };

  const handleSaveEditPpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPpp) return;
    setPppSecrets((prev) => prev.map((p) => (p.id === editingPpp.id ? editingPpp : p)));
    const remotePart = editingPpp.remoteAddress ? ` remote-address=${editingPpp.remoteAddress}` : '';
    await push(
      `Modify PPP Secret "${editingPpp.name}"`,
      `/ppp secret set [find name="${editingPpp.name}"] service=${editingPpp.service} profile="${editingPpp.profile}"${remotePart}`
    );
    setEditingPpp(null);
  };

  const handleTogglePpp = async (p: MtPppSecret) => {
    const nextDisabled = !p.disabled;
    setPppSecrets((prev) => prev.map((x) => (x.id === p.id ? { ...x, disabled: nextDisabled } : x)));
    await push(
      `${nextDisabled ? 'Disable' : 'Enable'} PPP "${p.name}"`,
      `/ppp secret set [find name="${p.name}"] disabled=${nextDisabled ? 'yes' : 'no'}`
    );
  };

  const handleDeletePpp = async (p: MtPppSecret) => {
    setPppSecrets((prev) => prev.filter((x) => x.id !== p.id));
    await push(`Remove PPP Secret "${p.name}"`, `/ppp secret remove [find name="${p.name}"]`);
  };

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpAddr.trim() || !newIpIface.trim()) return;
    const item: MtIpAddress = {
      id: `ip_${Date.now()}`,
      address: newIpAddr.trim(),
      interface: newIpIface.trim(),
      comment: newIpComment.trim(),
    };
    setIpAddrs((prev) => [item, ...prev]);
    await push(
      `Add IP ${item.address} on ${item.interface}`,
      `/ip address add address=${item.address} interface=${item.interface} comment="${item.comment}"`
    );
  };

  const handleDeleteIp = async (ip: MtIpAddress) => {
    setIpAddrs((prev) => prev.filter((x) => x.id !== ip.id));
    await push(`Remove IP ${ip.address}`, `/ip address remove [find address="${ip.address}"]`);
  };

  const handleAddBridgeVlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      `/interface bridge add name=${bridgeName} vlan-filtering=yes`,
      `/interface bridge vlan add bridge=${bridgeName} tagged=${vlanTagged} vlan-ids=${vlanId}`,
      `/interface vlan add name=${vlanName} interface=${bridgeName} vlan-id=${vlanId}`,
    ].join('\n');
    await push(`Configure Bridge VLAN ${vlanId} (${vlanName})`, cli);
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    const r: MtRoute = {
      id: `r_${Date.now()}`,
      dstAddress: newRouteDst.trim(),
      gateway: newRouteGw.trim(),
      distance: parseInt(newRouteDist, 10) || 1,
      comment: 'Static Route',
    };
    setRoutes((prev) => [...prev, r]);
    await push(
      `Add Route ${r.dstAddress} -> ${r.gateway}`,
      `/ip route add dst-address=${r.dstAddress} gateway=${r.gateway} distance=${r.distance}`
    );
  };

  const handleDeleteRoute = async (r: MtRoute) => {
    setRoutes((prev) => prev.filter((x) => x.id !== r.id));
    await push(
      `Remove Route ${r.dstAddress}`,
      `/ip route remove [find dst-address="${r.dstAddress}" gateway="${r.gateway}"]`
    );
  };

  const handlePushBgpV7 = async (e: React.FormEvent) => {
    e.preventDefault();
    const cli = [
      `/routing bgp instance add name=bgp-main as=${bgpLocalAs} router-id=${bgpRouterId}`,
      `/routing bgp connection add name="${bgpName}" instance=bgp-main local.role=ebgp local.as=${bgpLocalAs} remote.address=${bgpRemoteIp} remote.as=${bgpRemoteAs} address-families=ipv4`,
    ].join('\n');
    await push(`Create RouterOS v7 BGP Peer ${bgpName} (AS${bgpRemoteAs})`, cli);
  };

  const handleAddQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    const q: MtSimpleQueue = {
      id: `q_${Date.now()}`,
      name: newQName.trim() || 'Queue',
      target: newQTarget.trim(),
      maxLimit: newQLimit.trim() || '20M/20M',
      priority: newQPrio.trim() || '8/8',
    };
    setQueues((prev) => [q, ...prev]);
    await push(
      `Add Simple Queue "${q.name}" (${q.maxLimit})`,
      `/queue simple add name="${q.name}" target=${q.target} max-limit=${q.maxLimit} priority=${q.priority}`
    );
  };

  const handleDeleteQueue = async (q: MtSimpleQueue) => {
    setQueues((prev) => prev.filter((x) => x.id !== q.id));
    await push(`Remove Queue "${q.name}"`, `/queue simple remove [find name="${q.name}"]`);
  };

  const handleAddMasquerade = async () => {
    const rule: MtFirewallRule = {
      id: `f_${Date.now()}`,
      table: 'nat',
      chain: 'srcnat',
      action: 'masquerade',
      detail: `out-interface=${natOutIface}`,
      comment: `Masquerade ${natOutIface}`,
    };
    setFwRules((prev) => [rule, ...prev]);
    await push(
      `Add Src-NAT Masquerade on ${natOutIface}`,
      `/ip firewall nat add chain=srcnat action=masquerade out-interface=${natOutIface} comment="${rule.comment}"`
    );
  };

  const handleAddDstNat = async (e: React.FormEvent) => {
    e.preventDefault();
    const rule: MtFirewallRule = {
      id: `f_${Date.now()}`,
      table: 'nat',
      chain: 'dstnat',
      action: 'dst-nat',
      detail: `protocol=tcp dst-port=${dstNatPort} -> ${dstNatToIp}:${dstNatToPort}`,
      comment: `PortFwd-${dstNatPort}`,
    };
    setFwRules((prev) => [rule, ...prev]);
    await push(
      `Add Dst-NAT Port Forward ${dstNatPort} -> ${dstNatToIp}:${dstNatToPort}`,
      `/ip firewall nat add chain=dstnat action=dst-nat protocol=tcp dst-port=${dstNatPort} in-interface=${natOutIface} to-addresses=${dstNatToIp} to-ports=${dstNatToPort} comment="${rule.comment}"`
    );
  };

  const handleIspHardening = async () => {
    const cli = [
      `/ip firewall filter add chain=input action=accept connection-state=established,related comment="Allow Established"`,
      `/ip firewall filter add chain=input action=drop connection-state=invalid comment="Drop Invalid"`,
      `/ip firewall filter add chain=input action=accept protocol=icmp comment="Allow ICMP"`,
      `/ip firewall filter add chain=input action=drop in-interface=${natOutIface} comment="Drop WAN Input"`,
    ].join('\n');
    await push('Apply RouterOS v7 Input Hardening Rules', cli);
  };

  const cheatCats = ['ALL', ...Array.from(new Set(MIKROTIK_OFFICIAL_CHEATSHEET.map((c) => c.category)))];
  const filteredCheat = MIKROTIK_OFFICIAL_CHEATSHEET.filter((item) => {
    if (cheatCat !== 'ALL' && item.category !== cheatCat) return false;
    const q = cheatSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.command.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-black tracking-tight flex items-center gap-2">
            <Router className="w-5 h-5 text-black shrink-0" />
            <span>MikroTik RouterOS v7 Full WebUI &amp; Bidirectional Live Telnet</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {spec.series} · {spec.cpu} · {spec.ram} · {spec.portsSummary} · {spec.throughput}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={model}
            onChange={(e) => {
              const m = e.target.value as MikroTikModel;
              setModel(m);
              setSelectedPort(MIKROTIK_DATASHEETS[m].defaultPorts[0]?.name || 'ether1');
              showToast(`Loaded MikroTik ${m}`);
            }}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-black"
          >
            {(Object.keys(MIKROTIK_DATASHEETS) as MikroTikModel[]).map((m) => (
              <option key={m} value={m}>
                MikroTik {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => push('Export RouterOS Config', '/export compact')}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            /export
          </button>

          <button
            type="button"
            onClick={() => push('Save Binary Backup', '/system backup save name=noc-auto-backup')}
            className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Backup</span>
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
        {/* BOX 1: MIKROTIK GRAPHICAL WEBUI */}
        <section className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-black font-mono">
                {identity} <span className="text-xs text-slate-500 font-normal">({model})</span>
              </div>
              <div className="text-[11px] font-mono text-slate-600 tabular-nums mt-0.5">
                PPP Secrets: <strong className="text-black">{pppSecrets.length}</strong> · IPs:{' '}
                <strong className="text-black">{ipAddrs.length}</strong> · Routes:{' '}
                <strong className="text-black">{routes.length}</strong> · Queues:{' '}
                <strong className="text-black">{queues.length}</strong>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-600">
              {isLiveConnected ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  Live RouterOS Synced
                </span>
              ) : (
                'Offline ROS v7 Builder'
              )}
            </div>
          </div>

          {/* Interactive Port Strip */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500 mr-1">Ports:</span>
                {spec.defaultPorts.map((p) => {
                  const isSel = selectedPort === p.name;
                  const isDown = Boolean(disabledPorts[p.name]);
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSelectedPort(p.name)}
                      className={`px-2 py-1 rounded text-[11px] font-mono border cursor-pointer whitespace-nowrap ${
                        isSel
                          ? 'bg-black text-white border-black font-bold'
                          : isDown
                          ? 'bg-red-50 text-red-700 border-red-200 line-through'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {p.name} ({p.speed})
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => push(`Monitor ${selectedPort}`, `/interface ethernet monitor ${selectedPort} once`)}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  SFP/Link Monitor
                </button>
                <button
                  type="button"
                  onClick={() => handlePortToggle(selectedPort)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                    disabledPorts[selectedPort]
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-600 hover:text-white'
                  }`}
                >
                  {disabledPorts[selectedPort] ? 'Enable Port' : 'Disable Port'}
                </button>
              </div>
            </div>
          </div>

          {/* 7 Tabs */}
          <div className="px-3 pt-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'ppp', label: 'PPP & VPN', icon: Users },
                { id: 'interfaces', label: 'IP & Bridge VLAN', icon: Network },
                { id: 'routing', label: 'Routes & BGP v7', icon: Route },
                { id: 'queues', label: 'Queues & QoS', icon: Gauge },
                { id: 'firewall', label: 'Firewall & NAT', icon: Shield },
                { id: 'system', label: 'System & Tools', icon: Sliders },
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
            {/* TAB 1: PPP SECRETS & VPN SERVERS */}
            {tab === 'ppp' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                  <span className="font-bold text-black">VPN &amp; PPPoE Server Quick Controls:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => push('Enable PPTP/L2TP/SSTP Servers', '/interface pptp-server server set enabled=yes\n/interface l2tp-server server set enabled=yes\n/interface sstp-server server set enabled=yes')}
                      className="px-2.5 py-1 rounded bg-black text-white font-bold cursor-pointer"
                    >
                      Enable PPTP/L2TP/SSTP
                    </button>
                    <button
                      type="button"
                      onClick={() => push('Show Active PPP Sessions', '/ppp active print')}
                      className="px-2.5 py-1 rounded bg-white border border-slate-300 text-black font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      /ppp active print
                    </button>
                  </div>
                </div>

                {editingPpp && (
                  <form onSubmit={handleSaveEditPpp} className="p-3 rounded-lg bg-slate-50 border border-slate-300 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-bold text-black font-mono">
                      <span>Edit PPP Secret: {editingPpp.name}</span>
                      <button type="button" onClick={() => setEditingPpp(null)} className="cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={editingPpp.service}
                        onChange={(e) => setEditingPpp({ ...editingPpp, service: e.target.value as MtPppSecret['service'] })}
                        className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono"
                      >
                        <option value="any">any</option>
                        <option value="pppoe">pppoe</option>
                        <option value="pptp">pptp</option>
                        <option value="l2tp">l2tp</option>
                        <option value="sstp">sstp</option>
                      </select>
                      <input
                        type="text"
                        value={editingPpp.profile}
                        onChange={(e) => setEditingPpp({ ...editingPpp, profile: e.target.value })}
                        className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono"
                        placeholder="Profile"
                      />
                      <input
                        type="text"
                        value={editingPpp.remoteAddress}
                        onChange={(e) => setEditingPpp({ ...editingPpp, remoteAddress: e.target.value })}
                        className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono"
                        placeholder="Remote IP"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="submit" className="px-3 py-1.5 rounded bg-black text-white font-bold cursor-pointer">
                        Push Edit to MikroTik
                      </button>
                    </div>
                  </form>
                )}

                <form onSubmit={handleAddPppSecret} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-bold text-black">Add PPPoE / PPTP / L2TP / SSTP User (`/ppp secret add`)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input type="text" value={newPppName} onChange={(e) => setNewPppName(e.target.value)} placeholder="Username" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" required />
                    <input type="text" value={newPppPass} onChange={(e) => setNewPppPass(e.target.value)} placeholder="Password" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" required />
                    <select value={newPppService} onChange={(e) => setNewPppService(e.target.value as MtPppSecret['service'])} className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono">
                      <option value="pppoe">pppoe</option>
                      <option value="pptp">pptp</option>
                      <option value="l2tp">l2tp</option>
                      <option value="sstp">sstp</option>
                      <option value="any">any</option>
                    </select>
                    <input type="text" value={newPppProfile} onChange={(e) => setNewPppProfile(e.target.value)} placeholder="Profile" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newPppRemoteIp} onChange={(e) => setNewPppRemoteIp(e.target.value)} placeholder="Remote IP" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add PPP Secret</span>
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">Username</th>
                        <th className="py-2 px-3">Service</th>
                        <th className="py-2 px-3">Profile</th>
                        <th className="py-2 px-3">Remote IP</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pppSecrets.map((p) => (
                        <tr key={p.id} className={p.disabled ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'}>
                          <td className="py-2 px-3 font-bold text-black">{p.name}</td>
                          <td className="py-2 px-3 text-slate-700">{p.service}</td>
                          <td className="py-2 px-3 text-slate-700">{p.profile}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{p.remoteAddress || 'pool'}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => setEditingPpp(p)} className="p-1.5 rounded bg-slate-100 hover:bg-black text-black hover:text-white border border-slate-200 cursor-pointer" title="Edit Secret">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleTogglePpp(p)} className="p-1.5 rounded bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 cursor-pointer" title={p.disabled ? 'Enable' : 'Disable'}>
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDeletePpp(p)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer" title="Delete Secret">
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

            {/* TAB 2: IP ADDRESSES & BRIDGE VLAN FILTERING */}
            {tab === 'interfaces' && (
              <div className="space-y-4">
                <form onSubmit={handleAddIp} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-bold text-black">Assign IPv4 Address (`/ip address add`)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input type="text" value={newIpAddr} onChange={(e) => setNewIpAddr(e.target.value)} placeholder="10.10.20.1/24" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newIpIface} onChange={(e) => setNewIpIface(e.target.value)} placeholder="Interface" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newIpComment} onChange={(e) => setNewIpComment(e.target.value)} placeholder="Comment" className="bg-white border border-slate-300 rounded px-2 py-1.5" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Add IP Address
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">Address/CIDR</th>
                        <th className="py-2 px-3">Interface</th>
                        <th className="py-2 px-3">Comment</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ipAddrs.map((ip) => (
                        <tr key={ip.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{ip.address}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{ip.interface}</td>
                          <td className="py-2 px-3 font-sans text-slate-600">{ip.comment}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleDeleteIp(ip)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form onSubmit={handleAddBridgeVlan} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-bold text-black">RouterOS v7 Hardware Bridge VLAN Filtering</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" value={bridgeName} onChange={(e) => setBridgeName(e.target.value)} placeholder="Bridge Name" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="number" value={vlanId} onChange={(e) => setVlanId(e.target.value)} placeholder="VLAN ID" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={vlanName} onChange={(e) => setVlanName(e.target.value)} placeholder="L3 VLAN Name" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={vlanTagged} onChange={(e) => setVlanTagged(e.target.value)} placeholder="Tagged Ports" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Push Bridge VLAN Config
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: ROUTES & ROUTEROS v7 BGP */}
            {tab === 'routing' && (
              <div className="space-y-4">
                <form onSubmit={handleAddRoute} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-bold text-black">Static IPv4 Route (`/ip route add`)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input type="text" value={newRouteDst} onChange={(e) => setNewRouteDst(e.target.value)} placeholder="Dst CIDR" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newRouteGw} onChange={(e) => setNewRouteGw(e.target.value)} placeholder="Gateway IP" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="number" value={newRouteDist} onChange={(e) => setNewRouteDist(e.target.value)} placeholder="Distance" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Add Route
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">Destination</th>
                        <th className="py-2 px-3">Gateway</th>
                        <th className="py-2 px-3">Distance</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {routes.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{r.dstAddress}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{r.gateway}</td>
                          <td className="py-2 px-3 text-slate-700">{r.distance}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleDeleteRoute(r)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <form onSubmit={handlePushBgpV7} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black">RouterOS v7 BGP Peer Builder (`/routing bgp connection`)</span>
                    <button type="button" onClick={() => push('Check BGP Sessions', '/routing bgp session print')} className="px-2 py-1 rounded bg-white border border-slate-300 font-mono text-[11px] cursor-pointer">
                      session print
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input type="text" value={bgpName} onChange={(e) => setBgpName(e.target.value)} placeholder="Peer Name" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={bgpLocalAs} onChange={(e) => setBgpLocalAs(e.target.value)} placeholder="Local AS" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={bgpRouterId} onChange={(e) => setBgpRouterId(e.target.value)} placeholder="Router ID" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={bgpRemoteIp} onChange={(e) => setBgpRemoteIp(e.target.value)} placeholder="Remote IP" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={bgpRemoteAs} onChange={(e) => setBgpRemoteAs(e.target.value)} placeholder="Remote AS" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Push BGP v7 Peer
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: SIMPLE QUEUES */}
            {tab === 'queues' && (
              <div className="space-y-4">
                <form onSubmit={handleAddQueue} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="font-bold text-black">Create Simple Queue Bandwidth Limit (`/queue simple add`)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" value={newQName} onChange={(e) => setNewQName(e.target.value)} placeholder="Queue Name" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newQTarget} onChange={(e) => setNewQTarget(e.target.value)} placeholder="Target IP/CIDR" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newQLimit} onChange={(e) => setNewQLimit(e.target.value)} placeholder="Up/Down e.g. 50M/50M" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={newQPrio} onChange={(e) => setNewQPrio(e.target.value)} placeholder="Priority 8/8" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      Add Queue
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-sans text-slate-600">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Target</th>
                        <th className="py-2 px-3">Max Limit (Up/Down)</th>
                        <th className="py-2 px-3">Priority</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queues.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-black">{q.name}</td>
                          <td className="py-2 px-3 text-slate-700">{q.target}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">{q.maxLimit}</td>
                          <td className="py-2 px-3 text-slate-700">{q.priority}</td>
                          <td className="py-2 px-3 text-right">
                            <button type="button" onClick={() => handleDeleteQueue(q)} className="p-1.5 rounded bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 cursor-pointer">
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

            {/* TAB 5: FIREWALL & NAT */}
            {tab === 'firewall' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-black">WAN Out-Interface:</span>
                    <input type="text" value={natOutIface} onChange={(e) => setNatOutIface(e.target.value)} className="w-32 bg-white border border-slate-300 rounded px-2 py-1 font-mono" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={handleAddMasquerade} className="px-3 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      + Add Masquerade
                    </button>
                    <button type="button" onClick={handleIspHardening} className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-black font-semibold hover:bg-slate-100 cursor-pointer">
                      + Apply Input Hardening
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddDstNat} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="font-bold text-black">Destination NAT / Port Forwarding (`chain=dstnat`)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="number" value={dstNatPort} onChange={(e) => setDstNatPort(e.target.value)} placeholder="External Port" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="text" value={dstNatToIp} onChange={(e) => setDstNatToIp(e.target.value)} placeholder="Internal IP" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <input type="number" value={dstNatToPort} onChange={(e) => setDstNatToPort(e.target.value)} placeholder="Internal Port" className="bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    <button type="submit" className="px-3 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer">
                      + Add Port Forward
                    </button>
                  </div>
                </form>

                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 font-mono">
                  {fwRules.map((f) => (
                    <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-black">[{f.table}/{f.chain}]</span>{' '}
                        <span className="text-emerald-700 font-bold">{f.action}</span> · {f.detail}
                      </div>
                      <span className="text-[11px] font-sans text-slate-500">{f.comment}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SYSTEM & TOOLS */}
            {tab === 'system' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-black">Router Identity, DNS &amp; NTP Client</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <label className="block">
                      <span className="text-[11px] text-slate-600">System Identity</span>
                      <input type="text" value={identity} onChange={(e) => setIdentity(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">DNS Servers</span>
                      <input type="text" value={dnsServers} onChange={(e) => setDnsServers(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-600">NTP Server</span>
                      <input type="text" value={ntpServers} onChange={(e) => setNtpServers(e.target.value)} className="mt-1 w-full bg-white border border-slate-300 rounded px-2 py-1.5 font-mono" />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        push(
                          `Apply System (${identity})`,
                          `/system identity set name="${identity}"\n/ip dns set servers=${dnsServers} allow-remote-requests=yes\n/system ntp client set enabled=yes\n/system ntp client servers add address=${ntpServers}`
                        )
                      }
                      className="px-4 py-1.5 rounded-lg bg-black text-white font-bold cursor-pointer"
                    >
                      Apply System Config
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-black">RouterOS Ping / Trace Target:</span>
                    <input type="text" value={pingTarget} onChange={(e) => setPingTarget(e.target.value)} className="w-36 bg-white border border-slate-300 rounded px-2 py-1 font-mono" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => push(`Ping ${pingTarget}`, `/ping ${pingTarget} count=5`)} className="px-2.5 py-1 rounded bg-black text-white font-bold cursor-pointer">
                      Ping (5)
                    </button>
                    <button type="button" onClick={() => push(`Traceroute ${pingTarget}`, `/tool traceroute ${pingTarget} count=1`)} className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold cursor-pointer">
                      Traceroute
                    </button>
                    <button type="button" onClick={() => push('System Resources & Health', '/system resource print\n/system health print')} className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold cursor-pointer">
                      CPU / Health
                    </button>
                    <button type="button" onClick={() => push('IP Neighbors', '/ip neighbor print')} className="px-2.5 py-1 rounded bg-white border border-slate-300 font-semibold cursor-pointer">
                      Neighbors
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: DATASHEET & 24+ OFFICIAL ROUTEROS v7 COMMANDS */}
            {tab === 'cheatsheet' && (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-black">Official Datasheet: MikroTik {spec.model}</span>
                    <span className="font-mono text-slate-600">{spec.series}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">CPU Architecture</div>
                      <div className="font-mono font-bold text-black">{spec.cpu}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">RAM / Storage</div>
                      <div className="font-mono font-bold text-black">{spec.ram}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Ports</div>
                      <div className="font-mono font-bold text-black">{spec.portsSummary}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Switch / L3HW Offload</div>
                      <div className="font-mono font-bold text-black">{spec.l3HwOffload}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Rated Throughput</div>
                      <div className="font-mono font-bold text-emerald-700">{spec.throughput}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cheatSearch}
                      onChange={(e) => setCheatSearch(e.target.value)}
                      placeholder="Search RouterOS v7 commands (bgp, fasttrack, vlan, pppoe, queue)..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <select value={cheatCat} onChange={(e) => setCheatCat(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                    {cheatCats.map((c) => (
                      <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
                    ))}
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
                          <button type="button" onClick={() => { navigator.clipboard.writeText(item.command); showToast(`Copied: ${item.title}`); }} className="px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer">
                            Copy
                          </button>
                          <button type="button" onClick={() => push(item.title, item.command, true)} className="px-2.5 py-1 rounded bg-black text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer">
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

        {/* BOX 2: LIVE MIKROTIK TELNET CONSOLE */}
        <LiveVendorTelnetConsole
          vendor="MikroTik"
          title="Live MikroTik RouterOS Telnet"
          defaultHost={defaultHostIp || '192.168.88.1'}
          defaultUser="admin"
          defaultPass=""
          promptLabel={`[admin@${identity}] > `}
          promptModeLabel="RouterOS v7"
          promptMode="config"
          syncCommandTitle="Sync MikroTik State"
          syncCommandScript="/system identity print\n/system resource print\n/ip address print\n/ppp active print\n/ip route print"
          prepareLinesForLive={(raw) =>
            raw
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0 && !l.startsWith('#'))
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
