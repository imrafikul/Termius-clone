import React, { useState, useRef } from 'react';
import {
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  Cable,
  MousePointer2,
  Terminal,
  RotateCcw,
  Layers,
  Power,
  AlertCircle,
  Route as RouteIcon,
} from 'lucide-react';
import {
  BRAND_CATALOG,
  TopologyBrand,
  TopologyNode,
  TopologyLink,
  DeviceRole,
  cidrToSubnetMask,
  isValidIpv4,
  generateDeviceCli,
  getScriptExtension,
} from '../services/cliGenerator';

interface TopologyBuilderViewProps {
  onSendToTerminal?: (payload: {
    brand: TopologyBrand;
    hostIp: string;
    cliScript: string;
    deviceName: string;
  }) => void;
}

const BRAND_LIST: TopologyBrand[] = [
  'Cisco',
  'MikroTik',
  'Huawei',
  'BDCOM',
  'VSOL',
  'Palo Alto',
  'Juniper',
];

const INITIAL_ISP_TOPOLOGY: { nodes: TopologyNode[]; links: TopologyLink[] } = {
  nodes: [
    {
      id: 'node_core_mt',
      hostname: 'CORE-CCR2004',
      brand: 'MikroTik',
      model: 'CCR2004-1G-12S+2XS',
      osVersion: 'RouterOS v7.15',
      role: 'router',
      x: 170,
      y: 120,
      interfaces: [
        {
          id: 'if_1',
          name: 'sfp-sfpplus1',
          ipAddress: '103.238.114.2',
          cidr: 30,
          description: 'Upstream BGP Peering',
          enabled: true,
        },
        {
          id: 'if_2',
          name: 'sfp-sfpplus2',
          ipAddress: '10.99.0.1',
          cidr: 24,
          vlanId: '100',
          description: 'OLT & Switch Management',
          enabled: true,
        },
      ],
      routes: [
        { id: 'rt_1', destination: '0.0.0.0', cidr: 0, gateway: '103.238.114.1' },
      ],
    },
    {
      id: 'node_cisco_sw',
      hostname: 'DIST-C9300-SW1',
      brand: 'Cisco',
      model: 'Catalyst 9300 L3 Switch',
      osVersion: 'IOS-XE 17.9',
      role: 'switch',
      x: 420,
      y: 120,
      interfaces: [
        {
          id: 'if_c1',
          name: 'Vlan100',
          ipAddress: '10.99.0.2',
          cidr: 24,
          vlanId: '100',
          description: 'MGMT-SVI',
          enabled: true,
        },
        {
          id: 'if_c2',
          name: 'TenGigabitEthernet1/1/1',
          ipAddress: '172.16.10.1',
          cidr: 30,
          description: 'Uplink to OLT',
          enabled: true,
        },
      ],
      routes: [
        { id: 'rt_c1', destination: '0.0.0.0', cidr: 0, gateway: '10.99.0.1' },
      ],
    },
    {
      id: 'node_bdcom_olt',
      hostname: 'POP1-BDCOM-OLT',
      brand: 'BDCOM',
      model: 'GP3600-08B GPON OLT',
      osVersion: 'BDROS v3.0 (GPON)',
      role: 'olt',
      x: 295,
      y: 285,
      interfaces: [
        {
          id: 'if_b1',
          name: 'vlan 100',
          ipAddress: '10.99.0.10',
          cidr: 24,
          vlanId: '100',
          description: 'OLT-INBAND-MGMT',
          enabled: true,
        },
      ],
      routes: [
        { id: 'rt_b1', destination: '0.0.0.0', cidr: 0, gateway: '10.99.0.1' },
      ],
    },
    {
      id: 'node_huawei_olt',
      hostname: 'POP2-HUAWEI-MA5800',
      brand: 'Huawei',
      model: 'SmartAX MA5800-X7 OLT',
      osVersion: 'MA5800 V100R021',
      role: 'olt',
      x: 545,
      y: 285,
      interfaces: [
        {
          id: 'if_h1',
          name: 'vlanif 100',
          ipAddress: '10.99.0.11',
          cidr: 24,
          vlanId: '100',
          description: 'Huawei-OLT-MGMT',
          enabled: true,
        },
      ],
      routes: [
        { id: 'rt_h1', destination: '0.0.0.0', cidr: 0, gateway: '10.99.0.1' },
      ],
    },
  ],
  links: [
    {
      id: 'lnk_1',
      fromNodeId: 'node_core_mt',
      fromPort: 'sfp-sfpplus2',
      toNodeId: 'node_cisco_sw',
      toPort: 'TenGigabitEthernet1/1/1',
      media: 'fiber',
    },
    {
      id: 'lnk_2',
      fromNodeId: 'node_cisco_sw',
      fromPort: 'Gi1/0/1',
      toNodeId: 'node_bdcom_olt',
      toPort: 'TGigaEthernet0/1',
      media: 'fiber',
    },
    {
      id: 'lnk_3',
      fromNodeId: 'node_cisco_sw',
      fromPort: 'Gi1/0/2',
      toNodeId: 'node_huawei_olt',
      toPort: '0/19/0',
      media: 'fiber',
    },
  ],
};

function DeviceIconSvg({ role, selected }: { role: DeviceRole; selected: boolean }) {
  const stroke = selected ? '#000000' : '#334155';
  const fill = selected ? '#f1f5f9' : '#ffffff';

  if (role === 'router') {
    return (
      <svg viewBox="0 0 64 46" className="w-14 h-10">
        <ellipse cx="32" cy="12" rx="24" ry="8" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M8 12 v18 c0 4.4 10.7 8 24 8 s24 -3.6 24 -8 V12" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M22 10 l5 4 m0 -4 l-5 4 M37 14 l5 -4 m-5 0 l5 4 M20 26 h24 M32 20 v12" stroke="#0369a1" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (role === 'switch') {
    return (
      <svg viewBox="0 0 64 44" className="w-14 h-10">
        <rect x="6" y="10" width="52" height="24" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
        <path d="M16 17 h14 m-4 -3 l4 3 l-4 3" stroke="#047857" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M48 27 h-14 m4 -3 l-4 3 l4 3" stroke="#0369a1" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (role === 'olt') {
    return (
      <svg viewBox="0 0 64 44" className="w-14 h-10">
        <rect x="6" y="8" width="52" height="28" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
        <line x1="6" y1="18" x2="58" y2="18" stroke={stroke} strokeWidth="1.2" />
        <rect x="12" y="23" width="6" height="6" rx="1" fill="#d97706" />
        <rect x="21" y="23" width="6" height="6" rx="1" fill="#d97706" />
        <rect x="30" y="23" width="6" height="6" rx="1" fill="#059669" />
        <rect x="39" y="23" width="6" height="6" rx="1" fill="#059669" />
        <circle cx="51" cy="26" r="2.5" fill="#0284c7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 44" className="w-14 h-10">
      <rect x="8" y="8" width="48" height="28" rx="3" fill={fill} stroke={stroke} strokeWidth="2" />
      <line x1="8" y1="17" x2="56" y2="17" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="8" y1="27" x2="56" y2="27" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="24" y1="8" x2="24" y2="17" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="40" y1="8" x2="40" y2="17" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="32" y1="17" x2="32" y2="27" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="24" y1="27" x2="24" y2="36" stroke="#dc2626" strokeWidth="1.4" />
      <line x1="40" y1="27" x2="40" y2="36" stroke="#dc2626" strokeWidth="1.4" />
    </svg>
  );
}

export const TopologyBuilderView: React.FC<TopologyBuilderViewProps> = ({
  onSendToTerminal,
}) => {
  const [nodes, setNodes] = useState<TopologyNode[]>(INITIAL_ISP_TOPOLOGY.nodes);
  const [links, setLinks] = useState<TopologyLink[]>(INITIAL_ISP_TOPOLOGY.links);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_ISP_TOPOLOGY.nodes[0].id);
  const [toolMode, setToolMode] = useState<'select' | 'cable-fiber' | 'cable-copper'>('select');
  const [pendingCableFrom, setPendingCableFrom] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;
  const generatedCli = selectedNode ? generateDeviceCli(selectedNode) : '';

  const updateSelectedNode = (updater: (node: TopologyNode) => TopologyNode) => {
    if (!selectedNode) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? updater(n) : n)));
  };

  const handleBrandChange = (newBrand: TopologyBrand) => {
    const models = BRAND_CATALOG[newBrand];
    const firstSpec = models[0];
    updateSelectedNode((node) => ({
      ...node,
      brand: newBrand,
      model: firstSpec.model,
      osVersion: firstSpec.osVersions[0],
      role: firstSpec.role,
      interfaces: node.interfaces.map((iface, idx) => ({
        ...iface,
        name: firstSpec.defaultInterfaces[idx] || firstSpec.defaultInterfaces[0],
      })),
    }));
  };

  const handleModelChange = (newModel: string) => {
    if (!selectedNode) return;
    const spec = BRAND_CATALOG[selectedNode.brand].find((m) => m.model === newModel);
    if (!spec) return;
    updateSelectedNode((node) => ({
      ...node,
      model: spec.model,
      osVersion: spec.osVersions[0],
      role: spec.role,
      interfaces: node.interfaces.map((iface, idx) => ({
        ...iface,
        name: spec.defaultInterfaces[idx] || iface.name,
      })),
    }));
  };

  const handleAddDevice = (brand: TopologyBrand, roleHint?: DeviceRole) => {
    const specs = BRAND_CATALOG[brand];
    const chosen = (roleHint ? specs.find((s) => s.role === roleHint) : null) || specs[0];
    const index = nodes.length + 1;
    const newNode: TopologyNode = {
      id: `node_${Date.now()}`,
      hostname: `${brand.toUpperCase().replace(/\s+/g, '')}-${chosen.role.toUpperCase()}-${index}`,
      brand,
      model: chosen.model,
      osVersion: chosen.osVersions[0],
      role: chosen.role,
      x: 120 + ((index * 75) % 460),
      y: 95 + ((index * 55) % 230),
      interfaces: [
        {
          id: `if_${Date.now()}`,
          name: chosen.defaultInterfaces[0],
          ipAddress: `10.99.0.${20 + index}`,
          cidr: 24,
          description: 'Uplink Interface',
          enabled: true,
        },
      ],
      routes: [],
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setToolMode('select');
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => {
      const remaining = prev.filter((n) => n.id !== nodeId);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(remaining[0]?.id || '');
      }
      return remaining;
    });
    setLinks((prev) => prev.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId));
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: TopologyNode) => {
    e.stopPropagation();

    if (toolMode === 'cable-fiber' || toolMode === 'cable-copper') {
      if (!pendingCableFrom) {
        setPendingCableFrom(node.id);
        setSelectedNodeId(node.id);
      } else if (pendingCableFrom !== node.id) {
        const fromNode = nodes.find((n) => n.id === pendingCableFrom);
        const alreadyLinked = links.some(
          (l) =>
            (l.fromNodeId === pendingCableFrom && l.toNodeId === node.id) ||
            (l.fromNodeId === node.id && l.toNodeId === pendingCableFrom)
        );
        if (!alreadyLinked && fromNode) {
          setLinks((prev) => [
            ...prev,
            {
              id: `lnk_${Date.now()}`,
              fromNodeId: fromNode.id,
              fromPort: fromNode.interfaces[0]?.name || 'Port1',
              toNodeId: node.id,
              toPort: node.interfaces[0]?.name || 'Port1',
              media: toolMode === 'cable-fiber' ? 'fiber' : 'copper',
            },
          ]);
        }
        setPendingCableFrom(null);
      }
      return;
    }

    setSelectedNodeId(node.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      nodeId: node.id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nextX = Math.max(52, Math.min(rect.width - 52, e.clientX - rect.left - dragStateRef.current.offsetX));
    const nextY = Math.max(44, Math.min(rect.height - 54, e.clientY - rect.top - dragStateRef.current.offsetY));
    const draggingId = dragStateRef.current.nodeId;
    setNodes((prev) =>
      prev.map((n) => (n.id === draggingId ? { ...n, x: Math.round(nextX), y: Math.round(nextY) } : n))
    );
  };

  const handleCanvasPointerUp = () => {
    dragStateRef.current = null;
  };

  const handleAddInterface = () => {
    if (!selectedNode) return;
    const spec = BRAND_CATALOG[selectedNode.brand].find((m) => m.model === selectedNode.model);
    const existingNames = new Set(selectedNode.interfaces.map((i) => i.name));
    const nextName =
      spec?.defaultInterfaces.find((d) => !existingNames.has(d)) ||
      `interface${selectedNode.interfaces.length + 1}`;
    updateSelectedNode((node) => ({
      ...node,
      interfaces: [
        ...node.interfaces,
        {
          id: `if_${Date.now()}`,
          name: nextName,
          ipAddress: '',
          cidr: 24,
          description: '',
          enabled: true,
        },
      ],
    }));
  };

  const handleAddRoute = () => {
    updateSelectedNode((node) => ({
      ...node,
      routes: [
        ...node.routes,
        { id: `rt_${Date.now()}`, destination: '0.0.0.0', cidr: 0, gateway: '10.99.0.1' },
      ],
    }));
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(generatedCli);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
  };

  const handleDownloadCli = () => {
    if (!selectedNode) return;
    const ext = getScriptExtension(selectedNode.brand);
    const blob = new Blob([generatedCli], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNode.hostname.toLowerCase()}_${selectedNode.brand.toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeModels = selectedNode ? BRAND_CATALOG[selectedNode.brand] : [];
  const activeModelSpec = selectedNode
    ? activeModels.find((m) => m.model === selectedNode.model) || activeModels[0]
    : null;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight">
            Packet Tracer Topology &amp; Auto-CLI Compiler
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            গ্রাফিক্যাল ক্যানভাসে ডিভাইস সিলেক্ট করে IP, Subnet, VLAN বা Route বসালেই সাথে সাথে Brand, Model এবং OS Version অনুযায়ী আসল CLI কমান্ড তৈরি হয়ে যাবে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setNodes(INITIAL_ISP_TOPOLOGY.nodes);
              setLinks(INITIAL_ISP_TOPOLOGY.links);
              setSelectedNodeId(INITIAL_ISP_TOPOLOGY.nodes[0].id);
            }}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ISP Lab</span>
          </button>
          <button
            onClick={() => {
              setNodes([]);
              setLinks([]);
              setSelectedNodeId('');
            }}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-black border border-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Clear Canvas
          </button>
        </div>
      </div>

      {/* Device Palette & Cable Tools Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-700 font-semibold mr-1">Add Device:</span>
          {BRAND_LIST.map((brand) => (
            <button
              key={brand}
              onClick={() => handleAddDevice(brand)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-black text-black hover:text-white border border-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>{brand}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start xl:self-auto">
          <button
            onClick={() => {
              setToolMode('select');
              setPendingCableFrom(null);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
              toolMode === 'select'
                ? 'bg-black text-white'
                : 'text-slate-700 hover:text-black'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>Select / Move</span>
          </button>
          <button
            onClick={() => {
              setToolMode('cable-fiber');
              setPendingCableFrom(null);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
              toolMode === 'cable-fiber'
                ? 'bg-amber-600 text-white'
                : 'text-slate-700 hover:text-black'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>Fiber Link</span>
          </button>
          <button
            onClick={() => {
              setToolMode('cable-copper');
              setPendingCableFrom(null);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
              toolMode === 'cable-copper'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:text-black'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>Copper UTP</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Packet Tracer Style Interactive Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <div className="text-black font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>Logical Network Canvas</span>
                <span className="text-slate-600 font-mono">
                  · {nodes.length} devices · {links.length} links
                </span>
              </div>
              {toolMode !== 'select' && (
                <span className="text-amber-800 font-semibold">
                  {pendingCableFrom
                    ? 'Click destination device to finish link'
                    : 'Click source device to start cable'}
                </span>
              )}
            </div>

            <div
              ref={canvasRef}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
              className="relative h-[430px] w-full bg-white select-none overflow-hidden touch-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(15, 23, 42, 0.16) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            >
              {/* SVG Cable Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {links.map((link) => {
                  const a = nodes.find((n) => n.id === link.fromNodeId);
                  const b = nodes.find((n) => n.id === link.toNodeId);
                  if (!a || !b) return null;
                  const strokeColor = link.media === 'fiber' ? '#d97706' : '#0284c7';
                  const midX = (a.x + b.x) / 2;
                  const midY = (a.y + b.y) / 2;
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  const ux = dx / len;
                  const uy = dy / len;
                  return (
                    <g key={link.id}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={strokeColor}
                        strokeWidth={link.media === 'fiber' ? 2.5 : 2}
                        strokeDasharray={link.media === 'fiber' ? 'none' : '5 3'}
                      />
                      <circle cx={a.x + ux * 36} cy={a.y + uy * 36} r="4" fill="#16a34a" />
                      <circle cx={b.x - ux * 36} cy={b.y - uy * 36} r="4" fill="#16a34a" />
                      <text
                        x={midX}
                        y={midY - 6}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="monospace"
                      >
                        {link.media === 'fiber' ? 'SFP+' : 'UTP'}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Empty State */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                  <p className="text-sm font-semibold text-black">Canvas is empty</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    উপরের Add Device বার থেকে Cisco, MikroTik, Huawei, BDCOM, VSOL বা Palo Alto ডিভাইস যোগ করুন।
                  </p>
                </div>
              )}

              {/* Draggable Device Nodes */}
              {nodes.map((node) => {
                const isSelected = node.id === selectedNode?.id;
                const isCableOrigin = node.id === pendingCableFrom;
                const primaryIp = node.interfaces.find((i) => i.ipAddress.trim());

                return (
                  <div
                    key={node.id}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    style={{
                      transform: `translate(${node.x}px, ${node.y}px) translate(-50%, -50%)`,
                    }}
                    className={`absolute top-0 left-0 flex flex-col items-center cursor-grab active:cursor-grabbing group ${
                      isSelected ? 'z-20' : 'z-10'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl border-2 transition-colors ${
                        isCableOrigin
                          ? 'bg-amber-50 border-amber-500 shadow-md'
                          : isSelected
                          ? 'bg-slate-50 border-black shadow-md'
                          : 'bg-white border-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <DeviceIconSvg role={node.role} selected={isSelected} />
                    </div>

                    <div className="mt-1.5 text-center pointer-events-none bg-white/90 px-1.5 py-0.5 rounded">
                      <div className="text-[11px] font-bold font-mono leading-tight text-black">
                        {node.hostname}
                      </div>
                      <div className="text-[10px] text-slate-600 leading-tight">
                        {node.brand} · {node.osVersion}
                      </div>
                      {primaryIp && (
                        <div className="text-[10px] font-mono tabular-nums text-emerald-700 font-semibold leading-tight mt-0.5">
                          {primaryIp.ipAddress}/{primaryIp.cidr}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Transformed CLI Output Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-black flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>
                    Transformed CLI Commands
                    {selectedNode ? ` · ${selectedNode.brand} ${selectedNode.model}` : ''}
                  </span>
                </div>
                {selectedNode && (
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                    Target OS: {selectedNode.osVersion} · Auto-updates live as you edit IP / Brand / Model
                  </div>
                )}
              </div>

              {selectedNode && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={handleCopyCli}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {copiedCli ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCli ? 'Copied' : 'Copy CLI'}</span>
                  </button>
                  <button
                    onClick={handleDownloadCli}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .{getScriptExtension(selectedNode.brand)}</span>
                  </button>
                  {onSendToTerminal && (
                    <button
                      onClick={() =>
                        onSendToTerminal({
                          brand: selectedNode.brand,
                          hostIp:
                            selectedNode.interfaces.find((i) => i.ipAddress.trim())?.ipAddress ||
                            '192.168.88.1',
                          cliScript: generatedCli,
                          deviceName: selectedNode.hostname,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Open in Telnet</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <pre className="p-4 bg-slate-50 text-black font-mono text-xs leading-relaxed overflow-x-auto max-h-72 overflow-y-auto tabular-nums">
              {selectedNode ? generatedCli : '! Select or add a device on the canvas to generate CLI commands.'}
            </pre>
          </div>
        </div>

        {/* RIGHT: Graphical Device Configurator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {!selectedNode ? (
            <div className="py-16 text-center text-xs text-slate-600">
              কনফিগার করার জন্য ক্যানভাস থেকে যেকোনো ডিভাইস সিলেক্ট করুন।
            </div>
          ) : (
            <>
              {/* Device Identity Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-black">Device Properties &amp; OS</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Brand, Model বা OS Version বদলালেই নিচের IP কনফিগ নতুন CLI-তে রূপান্তর হবে।
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  title="Remove Device"
                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Hostname + Brand + Model + OS Version */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-700 font-semibold mb-1">
                    Hostname
                  </label>
                  <input
                    type="text"
                    value={selectedNode.hostname}
                    onChange={(e) =>
                      updateSelectedNode((n) => ({ ...n, hostname: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-700 font-semibold mb-1">
                    Brand / Vendor
                  </label>
                  <select
                    value={selectedNode.brand}
                    onChange={(e) => handleBrandChange(e.target.value as TopologyBrand)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black font-bold focus:outline-none focus:border-black"
                  >
                    {BRAND_LIST.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-700 font-semibold mb-1">
                    Hardware Model
                  </label>
                  <select
                    value={selectedNode.model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                  >
                    {activeModels.map((m) => (
                      <option key={m.id} value={m.model}>
                        {m.model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-700 font-semibold mb-1">
                    OS Version
                  </label>
                  <select
                    value={selectedNode.osVersion}
                    onChange={(e) =>
                      updateSelectedNode((n) => ({ ...n, osVersion: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-emerald-800 font-semibold focus:outline-none focus:border-black"
                  >
                    {(activeModelSpec?.osVersions || []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Graphical Interface IP Assignment */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-black">
                    Interfaces &amp; IP Addresses ({selectedNode.interfaces.length})
                  </h4>
                  <button
                    onClick={handleAddInterface}
                    className="px-2.5 py-1 rounded-md bg-black hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Interface / IP</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {selectedNode.interfaces.map((iface) => {
                    const ipTrimmed = iface.ipAddress.trim();
                    const ipInvalid = ipTrimmed.length > 0 && !isValidIpv4(ipTrimmed);
                    return (
                      <div
                        key={iface.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={iface.name}
                            onChange={(e) =>
                              updateSelectedNode((n) => ({
                                ...n,
                                interfaces: n.interfaces.map((item) =>
                                  item.id === iface.id ? { ...item, name: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder="Interface name (e.g. GigabitEthernet0/0)"
                            className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-black font-semibold focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedNode((n) => ({
                                ...n,
                                interfaces: n.interfaces.map((item) =>
                                  item.id === iface.id
                                    ? { ...item, enabled: !item.enabled }
                                    : item
                                ),
                              }))
                            }
                            className={`px-2 py-1.5 rounded text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                              iface.enabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                            title="Toggle Port Up / Shutdown"
                          >
                            <Power className="w-3 h-3" />
                            <span>{iface.enabled ? 'UP' : 'SHUT'}</span>
                          </button>
                          {selectedNode.interfaces.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  interfaces: n.interfaces.filter((item) => item.id !== iface.id),
                                }))
                              }
                              className="p-1.5 text-slate-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-7">
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              IPv4 Address
                            </label>
                            <input
                              type="text"
                              value={iface.ipAddress}
                              onChange={(e) =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  interfaces: n.interfaces.map((item) =>
                                    item.id === iface.id
                                      ? { ...item, ipAddress: e.target.value }
                                      : item
                                  ),
                                }))
                              }
                              placeholder="192.168.88.1"
                              className={`w-full bg-white border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-black focus:outline-none ${
                                ipInvalid
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-slate-300 focus:border-black'
                              }`}
                            />
                          </div>
                          <div className="col-span-5">
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Prefix / Mask
                            </label>
                            <select
                              value={iface.cidr}
                              onChange={(e) =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  interfaces: n.interfaces.map((item) =>
                                    item.id === iface.id
                                      ? { ...item, cidr: parseInt(e.target.value, 10) }
                                      : item
                                  ),
                                }))
                              }
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-mono tabular-nums text-black focus:outline-none focus:border-black"
                            >
                              {[32, 30, 29, 28, 27, 26, 25, 24, 23, 22, 16, 8].map((bits) => (
                                <option key={bits} value={bits}>
                                  /{bits} ({cidrToSubnetMask(bits)})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {ipInvalid && (
                          <div className="flex items-center gap-1 text-[11px] text-red-700 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Invalid IPv4 format (e.g. 10.99.0.1)</span>
                          </div>
                        )}

                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              VLAN ID (opt)
                            </label>
                            <input
                              type="text"
                              value={iface.vlanId || ''}
                              onChange={(e) =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  interfaces: n.interfaces.map((item) =>
                                    item.id === iface.id
                                      ? { ...item, vlanId: e.target.value.replace(/[^\d]/g, '') }
                                      : item
                                  ),
                                }))
                              }
                              placeholder="100"
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
                            />
                          </div>
                          <div className="col-span-8">
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Description / Comment
                            </label>
                            <input
                              type="text"
                              value={iface.description || ''}
                              onChange={(e) =>
                                updateSelectedNode((n) => ({
                                  ...n,
                                  interfaces: n.interfaces.map((item) =>
                                    item.id === iface.id
                                      ? { ...item, description: e.target.value }
                                      : item
                                  ),
                                }))
                              }
                              placeholder="e.g. Uplink to Core"
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Graphical Static Routes / Default Gateway */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-black flex items-center gap-1.5">
                    <RouteIcon className="w-3.5 h-3.5" />
                    <span>Static Routes / Gateway ({selectedNode.routes.length})</span>
                  </h4>
                  <button
                    onClick={handleAddRoute}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Route</span>
                  </button>
                </div>

                {selectedNode.routes.map((rt) => (
                  <div
                    key={rt.id}
                    className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <input
                      type="text"
                      value={rt.destination}
                      onChange={(e) =>
                        updateSelectedNode((n) => ({
                          ...n,
                          routes: n.routes.map((r) =>
                            r.id === rt.id ? { ...r, destination: e.target.value } : r
                          ),
                        }))
                      }
                      placeholder="0.0.0.0"
                      className="col-span-4 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-black"
                    />
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={rt.cidr}
                      onChange={(e) =>
                        updateSelectedNode((n) => ({
                          ...n,
                          routes: n.routes.map((r) =>
                            r.id === rt.id
                              ? { ...r, cidr: Math.max(0, Math.min(32, parseInt(e.target.value, 10) || 0)) }
                              : r
                          ),
                        }))
                      }
                      className="col-span-2 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono text-black"
                      title="CIDR prefix"
                    />
                    <input
                      type="text"
                      value={rt.gateway}
                      onChange={(e) =>
                        updateSelectedNode((n) => ({
                          ...n,
                          routes: n.routes.map((r) =>
                            r.id === rt.id ? { ...r, gateway: e.target.value } : r
                          ),
                        }))
                      }
                      placeholder="Gateway IP"
                      className="col-span-5 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-emerald-800 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedNode((n) => ({
                          ...n,
                          routes: n.routes.filter((r) => r.id !== rt.id),
                        }))
                      }
                      className="col-span-1 text-slate-500 hover:text-red-700 flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
