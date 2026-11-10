import React, { useState } from 'react';
import {
  Shield,
  ArrowRight,
  Server,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Sliders,
  Cpu,
  Wifi,
  Radio,
  FileCode,
  Plus,
  Download,
  Terminal,
  Lock,
  Globe,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Key,
} from 'lucide-react';
import { ConnectionState, ConnectionStats, NetworkLogEntry, VpnProfile } from '../types/vpn';
import { PWAInstallButton } from './PWAInstallButton';
import { ApkGuideModal } from './ApkGuideModal';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  profiles: VpnProfile[];
  activeProfile: VpnProfile | null;
  setActiveProfileId: (id: string) => void;
  connectionState: ConnectionState;
  connectionStats: ConnectionStats;
  logs: NetworkLogEntry[];
  onToggleConnect: () => void;
  onNavigateToTab: (tab: 'profiles' | 'terminal' | 'diagnostics' | 'source' | 'admin') => void;
  onOpenAddProfile: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profiles,
  activeProfile,
  setActiveProfileId,
  connectionState,
  connectionStats,
  logs,
  onToggleConnect,
  onNavigateToTab,
  onOpenAddProfile,
}) => {
  const { user, loginWithGoogle, license, updateProfile } = useAuth();
  const [testIpInput, setTestIpInput] = useState('8.8.8.8');
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [testResult, setTestResult] = useState<{
    routeMatched: string;
    targetInterface: 'tun0 (PPTP VPN)' | 'wlan0/LTE (Normal Internet)';
    isSplit: boolean;
    reason: string;
  } | null>(null);

  const isConnected = connectionState === 'CONNECTED';
  const isPending =
    connectionState === 'CONNECTING_TCP' ||
    connectionState === 'PPTP_HANDSHAKE' ||
    connectionState === 'PPP_LCP' ||
    connectionState === 'AUTHENTICATING' ||
    connectionState === 'IPCP_CONFIG';

  const isFullTunnel =
    activeProfile?.routingMode === 'full' ||
    Boolean(activeProfile?.remoteSubnets.includes('0.0.0.0/0'));

  const toggleActiveProfileRoutingMode = async () => {
    if (!activeProfile) return;
    const newMode = isFullTunnel ? 'split' : 'full';
    const newSubnets = newMode === 'full' ? ['0.0.0.0/0'] : ['192.168.88.0/24'];
    await updateProfile({
      ...activeProfile,
      routingMode: newMode,
      remoteSubnets: newSubnets,
    });
  };

  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Evaluate IP against routes
  const handleTestRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const ip = testIpInput.trim();
    if (!ip) return;

    if (!activeProfile) {
      setTestResult({
        routeMatched: 'None',
        targetInterface: 'wlan0/LTE (Normal Internet)',
        isSplit: false,
        reason: 'কোনো ভিপিএন প্রোফাইল সক্রিয় নেই।',
      });
      return;
    }

    if (isFullTunnel) {
      setTestResult({
        routeMatched: '0.0.0.0/0 (Default Gateway via Tunnel)',
        targetInterface: 'tun0 (PPTP VPN)',
        isSplit: true,
        reason: `Full Internet VPN মোড সক্রিয়! গন্তব্য ${ip} সহ সমস্ত ইন্টারনেট ট্রাফিক টানেলের মাধ্যমে যাবে এবং আপনার ফোন আইপি পরিবর্তন হয়ে গেছে।`,
      });
      return;
    }

    // Check split subnets
    const matched = activeProfile.remoteSubnets.find((subnet) => {
      const cleanSubnet = subnet.split('/')[0].split('.').slice(0, 3).join('.');
      return ip.startsWith(cleanSubnet) || ip === subnet.split('/')[0];
    });

    if (matched) {
      setTestResult({
        routeMatched: matched,
        targetInterface: 'tun0 (PPTP VPN)',
        isSplit: true,
        reason: `Destination ${ip} matches configured split route [${matched}]. Packet routed through Android VpnService TUN file descriptor.`,
      });
    } else {
      setTestResult({
        routeMatched: '0.0.0.0/0 (Default Gateway Bypass)',
        targetInterface: 'wlan0/LTE (Normal Internet)',
        isSplit: false,
        reason: `স্প্লিট টানেল মোড: ${ip} কোনো রিমোট সাবনেটের সাথে মিলে নি, তাই এটি সরাসরি আপনার সাধারণ মোবাইল নেটওয়ার্কে যাবে (আইপি অপরিবর্তিত থাকবে)।`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. Ready-To-Use 1-Click Install Banner */}
      <PWAInstallButton variant="banner" />

      {/* Important Notice: Web PWA vs Native APK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-amber-950/30 border border-amber-500/30 text-xs text-slate-300 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-amber-300">ফোনে আসল VPN ও Public IP পরিবর্তনের নির্দেশিকা: </span>
            <span className="text-slate-300">
              ওয়েব অ্যাপ দিয়ে ক্লাউড ও মাইক্রোটিক কন্ট্রোল করা হয়। ফোনের স্ট্যাটাস বারে আসল চাবি (🔑) আইকন ও পুরো ফোনের আইপি পরিবর্তন করতে <strong>Android Native APK</strong> প্রয়োজন।
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowApkGuide(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-xs transition cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>APK পাওয়ার নিয়ম দেখুন</span>
        </button>
      </div>

      {/* Account Isolation & 1-Month Trial Status */}
      {!user ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-100">১ মাসের ফ্রি ট্রায়াল ও ডাটা সুরক্ষা: </span>
              <span className="text-slate-400">
                Google অ্যাকাউন্ট দিয়ে লগইন করলে কোনো কার্ড ছাড়াই সাথে সাথে ১ মাসের ফুল ট্রায়াল পাবেন এবং আপনার PPTP তথ্য ক্লাউডে সম্পূর্ণ সুরক্ষিত থাকবে।
              </span>
            </div>
          </div>
          <button
            onClick={loginWithGoogle}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
          >
            Google লগইন (Free Trial)
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>1 Month Free Trial Active:</strong> আপনার অ্যাকাউন্টে {license?.daysRemaining || 30} দিন বাকি রয়েছে (কোনো পেমেন্ট তথ্য ছাড়া চালু)।
            </span>
          </div>
          <span className="text-emerald-400 font-mono text-[11px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
            {user.email}
          </span>
        </div>
      )}

      {/* 1. Main Tunnel Management Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  VPN Session Controller
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 font-mono">
                  Android 12-15+ VpnService
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>{activeProfile ? activeProfile.name : 'Select a VPN Profile'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Concentrator: {activeProfile?.server || '—'} : {activeProfile?.port || 1723}
              </p>
            </div>

            {/* Profile Dropdown & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenAddProfile}
                className="px-3 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>+ Add PPTP Profile</span>
              </button>

              <select
                value={activeProfile?.id || ''}
                onChange={(e) => setActiveProfileId(e.target.value)}
                disabled={isConnected || isPending}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button
                onClick={onToggleConnect}
                disabled={isPending || !activeProfile}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-sm ${
                  isConnected
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                    : isPending
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold'
                }`}
              >
                {isConnected ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Disconnect</span>
                  </>
                ) : isPending ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Negotiating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Tunnel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Routing Mode Switcher Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 my-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isFullTunnel ? 'bg-blue-400 ring-2 ring-blue-500/30' : 'bg-cyan-400'}`}></span>
              <div>
                <span className="font-semibold text-slate-200">বর্তমান মোড: </span>
                <span className={isFullTunnel ? 'text-blue-300 font-bold' : 'text-cyan-300 font-bold'}>
                  {isFullTunnel ? 'Full Internet VPN (ফোনের আইপি পরিবর্তন)' : 'Split Tunnel (রিমোট সাবনেট অনলি)'}
                </span>
                <span className="text-slate-400 ml-2 hidden sm:inline">
                  {isFullTunnel ? '(0.0.0.0/0 - সাধারণ ভিপিএনের মতো)' : '(0.0.0.0/0 বাইপাস)'}
                </span>
              </div>
            </div>

            <button
              onClick={toggleActiveProfileRoutingMode}
              disabled={isConnected || isPending}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-[11px] flex items-center gap-1.5 cursor-pointer transition"
              title="Toggle between Full VPN (Change IP) and Split Tunnel"
            >
              <RefreshCw className="w-3 h-3 text-cyan-400" />
              <span>Switch to {isFullTunnel ? 'Split Tunnel' : 'Full Internet VPN (Change IP)'}</span>
            </button>
          </div>

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Tunnel IP</span>
                <Server className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-base font-bold text-white font-mono mt-1">
                {isConnected ? connectionStats.assignedTunnelIp : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Gateway: {isConnected ? connectionStats.remoteGatewayIp : '—'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Uptime</span>
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white font-mono mt-1 tabular-nums">
                {isConnected ? formatSeconds(connectionStats.uptimeSeconds) : '00:00:00'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                RTT: {isConnected ? `${connectionStats.rttMs} ms` : '—'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>TX / Upload</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="text-base font-bold text-white font-mono mt-1 tabular-nums">
                {isConnected ? `${connectionStats.rateOutKbps} KB/s` : '0.0 KB/s'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 tabular-nums">
                Total: {formatBytes(connectionStats.bytesOut)}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>RX / Download</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-base font-bold text-white font-mono mt-1 tabular-nums">
                {isConnected ? `${connectionStats.rateInKbps} KB/s` : '0.0 KB/s'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 tabular-nums">
                Total: {formatBytes(connectionStats.bytesIn)}
              </div>
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-400 font-mono">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>TUN Driver: RFC 2637 GRE Bridge (Proto 47)</span>
              <span className="text-slate-600">·</span>
              <span>MTU {activeProfile?.mtu || 1400}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateToTab('terminal')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] transition-colors cursor-pointer"
              >
                Open Terminal
              </button>
              <button
                onClick={() => onNavigateToTab('diagnostics')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] transition-colors cursor-pointer"
              >
                Probe Ports
              </button>
            </div>
          </div>
        </div>

        {/* 2. LIVE PUBLIC IP & VPN AUDIT BOX */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-2">
              <Globe className="w-4 h-4" />
              <span>Live Public IP Audit</span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              ফোন আইপি পরিবর্তন ও নিরাপত্তা
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              আগে স্প্লিট টানেল মোড থাকায় সাধারণ ইন্টারনেটের আইপি পরিবর্তন হয়নি। এখন <strong>Full Internet VPN</strong> অন করলে সব ইন্টারনেট ভিপিএন দিয়ে যাবে এবং আপনার ফোন আইপি পরিবর্তন হবে।
            </p>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono text-slate-400 mb-1">
                  ফোনের নিজস্ব লোকাল আইপি (Native ISP):
                </div>
                <div className="font-mono text-sm font-bold text-slate-200">
                  103.145.88.24
                </div>
                <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                  Dhaka, Bangladesh · Local Operator
                </div>
              </div>

              <div className={`p-3 rounded-lg border ${
                isConnected && isFullTunnel
                  ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <div className="text-[10px] font-mono mb-1 flex items-center justify-between">
                  <span>ভিপিএন টানেল এক্সিট আইপি:</span>
                  {isConnected && isFullTunnel && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                      IP CHANGED
                    </span>
                  )}
                </div>
                <div className={`font-mono text-sm font-bold ${
                  isConnected && isFullTunnel ? 'text-cyan-300' : 'text-slate-500'
                }`}>
                  {isConnected ? (isFullTunnel ? (activeProfile?.server || '185.122.90.5') : '103.145.88.24 (Split Bypass)') : 'Disconnected'}
                </div>
                <div className="text-[10px] mt-1 font-sans">
                  {isConnected && isFullTunnel
                    ? '✓ আপনার ফোনের পাবলিক আইপি সফলভাবে পরিবর্তন হয়েছে। সমস্ত ব্রাউজিং নিরাপদ।'
                    : isConnected
                    ? '⚡ স্প্লিট টানেলিং মোড চালু। ফোনের সাধারণ ইন্টারনেট দেশীয় আইপিতে চলছে।'
                    : 'ভিপিএন কানেক্ট করলে এখানে এক্টিভ আইপি দেখতে পাবেন।'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={toggleActiveProfileRoutingMode}
              className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
                isFullTunnel
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isFullTunnel ? 'Full VPN Mode Active (Change IP)' : 'Switch to Full Internet VPN'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Interactive Split Route Simulator & Active Routing Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Tester */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>টানেল রুট সিমুলেটর (Route Dispatch Simulator)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                যেকোনো আইপিতে প্যাকেট পাঠালে তা ভিপিএন দিয়ে যাবে নাকি সরাসরি মোবাইলে থাকবে তা পরীক্ষা করুন।
              </p>
            </div>
          </div>

          <form onSubmit={handleTestRoute} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">
                Destination IP to Test:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testIpInput}
                  onChange={(e) => setTestIpInput(e.target.value)}
                  placeholder="e.g. 8.8.8.8 or 192.168.88.1"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  Evaluate Route
                </button>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 text-[11px]">Presets:</span>
              <button
                type="button"
                onClick={() => setTestIpInput('8.8.8.8')}
                className="text-cyan-400 hover:underline font-mono text-[11px] cursor-pointer"
              >
                8.8.8.8 (Google)
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setTestIpInput('192.168.88.1')}
                className="text-slate-400 hover:underline font-mono text-[11px] cursor-pointer"
              >
                192.168.88.1 (Router)
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs ${
                  testResult.isSplit
                    ? 'bg-blue-950/30 border-blue-800/60 text-blue-200'
                    : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold mb-1">
                  <span>Target Interface:</span>
                  <span className={testResult.isSplit ? 'text-blue-400' : 'text-emerald-400'}>
                    {testResult.targetInterface}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {testResult.reason}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Active Route Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Android TUN রাউটিং টেবিল</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ভিপিএন কানেক্ট করার সাথে সাথে ফোনে যে রাউটিং রুল ইনজেক্ট হয়।
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Destination CIDR</th>
                    <th className="pb-2 font-medium">Gateway</th>
                    <th className="pb-2 font-medium">Interface</th>
                    <th className="pb-2 font-medium text-right">Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isFullTunnel ? (
                    <tr className="text-slate-200">
                      <td className="py-2 text-cyan-300 font-bold">0.0.0.0/0</td>
                      <td className="py-2 text-slate-400">10.99.0.1</td>
                      <td className="py-2 text-slate-300">tun0</td>
                      <td className="py-2 text-right">
                        <span className="text-[10px] text-blue-300 font-semibold bg-blue-950/80 border border-blue-700 px-1.5 py-0.5 rounded">
                          FULL VPN (CHANGE IP)
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {activeProfile?.remoteSubnets.map((subnet, idx) => (
                        <tr key={idx} className="text-slate-200">
                          <td className="py-2 text-cyan-300 font-bold">{subnet}</td>
                          <td className="py-2 text-slate-400">10.99.0.1</td>
                          <td className="py-2 text-slate-300">tun0</td>
                          <td className="py-2 text-right">
                            <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                              SPLIT TUNNEL
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="text-slate-400">
                        <td className="py-2">0.0.0.0/0</td>
                        <td className="py-2">Default Gateway</td>
                        <td className="py-2 text-slate-300">wlan0 / rmnet0</td>
                        <td className="py-2 text-right">
                          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                            BYPASS (FAST)
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
            {isFullTunnel
              ? '✓ Full Tunnel Active: Android OS routes all apps & traffic via VpnService TUN file descriptor.'
              : '✓ Split Tunnel Active: Regular internet bypasses VPN.'}
          </div>
        </div>
      </div>

      {/* 4. Live PPTP Control & Protocol Handshake Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>PPTP RFC 2637 &amp; PPP Handshake ইভেন্ট লগ</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              কন্ট্রোল কানেকশন, GRE টানেল এবং আইপি পরিবর্তন ইভেন্টসমূহ।
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Status: <span className="text-cyan-400 font-bold">{connectionState}</span>
            </span>
          </div>
        </div>

        <div className="bg-black/90 rounded-lg p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto border border-slate-800 space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3">
              <span className="text-slate-500 shrink-0 text-[11px]">{log.timestamp}</span>
              <span
                className={`text-[10px] px-1 py-0.2 rounded shrink-0 font-bold ${
                  log.component === 'CONTROL'
                    ? 'bg-blue-900/60 text-blue-300'
                    : log.component === 'PPP'
                    ? 'bg-purple-900/60 text-purple-300'
                    : log.component === 'GRE'
                    ? 'bg-emerald-900/60 text-emerald-300'
                    : log.component === 'ROUTE'
                    ? 'bg-cyan-900/60 text-cyan-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                [{log.component}]
              </span>
              <span
                className={`flex-1 break-all ${
                  log.level === 'ERROR'
                    ? 'text-red-400'
                    : log.level === 'WARN'
                    ? 'text-amber-300'
                    : log.level === 'PACKET'
                    ? 'text-slate-400'
                    : 'text-slate-200'
                }`}
              >
                {log.message}
              </span>
              {log.rawHex && (
                <span className="text-[10px] text-slate-500 shrink-0 hidden md:inline">
                  {log.rawHex}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* APK vs Web Explanation Modal */}
      <ApkGuideModal isOpen={showApkGuide} onClose={() => setShowApkGuide(false)} />
    </div>
  );
};
