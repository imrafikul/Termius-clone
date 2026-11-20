import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Server,
  Activity,
  Layers,
  Play,
  Square,
  Clock,
  Sliders,
  Cpu,
  Plus,
  Download,
  Terminal,
  Lock,
  Globe,
  RefreshCw,
  Sparkles,
  HelpCircle,
  Key,
  Zap,
  Gauge,
  Route,
  LogOut,
  Share2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ConnectionState, ConnectionStats, NetworkLogEntry, VpnProfile } from '../types/vpn';
import { PWAInstallButton } from './PWAInstallButton';
import { ApkGuideModal } from './ApkGuideModal';
import { useAuth } from '../context/AuthContext';
import { fetchRealClientIp } from '../services/api';

interface DashboardViewProps {
  profiles: VpnProfile[];
  activeProfile: VpnProfile | null;
  setActiveProfileId: (id: string) => void;
  connectionState: ConnectionState;
  connectionStats: ConnectionStats;
  logs: NetworkLogEntry[];
  onToggleConnect: () => void;
  onNavigateToTab: (tab: 'profiles' | 'terminal' | 'webui' | 'huawei-olt' | 'topology' | 'diagnostics' | 'source' | 'admin') => void;
  onOpenDiagnosticTool?: (tool: 'ping' | 'speed-ping' | 'traceroute' | 'ports-telnet') => void;
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
  onOpenDiagnosticTool,
  onOpenAddProfile,
}) => {
  const { user, loginWithGoogle, logout, license, updateProfile } = useAuth();
  const [testIpInput, setTestIpInput] = useState('8.8.8.8');
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [realVisitorIp, setRealVisitorIp] = useState<string>('Checking...');
  const [testResult, setTestResult] = useState<{
    routeMatched: string;
    targetInterface: 'tun0 (PPTP VPN)' | 'wlan0/LTE (Normal Internet)';
    isSplit: boolean;
    reason: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetchRealClientIp()
      .then((res) => {
        if (active) setRealVisitorIp(res.ip || 'Unavailable');
      })
      .catch(() => {
        if (active) setRealVisitorIp('Unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  const isVpnConnected = connectionState === 'CONNECTED';
  const isGatewayReady = connectionState === 'GATEWAY_READY';
  const isError = connectionState === 'ERROR';
  const isPending =
    connectionState === 'CONNECTING_TCP' ||
    connectionState === 'PPTP_HANDSHAKE' ||
    connectionState === 'PPP_LCP' ||
    connectionState === 'AUTHENTICATING' ||
    connectionState === 'IPCP_CONFIG';

  const activeProtocol = activeProfile?.protocol || 'l2tp';

  const isFullTunnel =
    activeProfile?.routingMode === 'full' ||
    Boolean(activeProfile?.remoteSubnets.includes('0.0.0.0/0'));

  const handleSelectProtocol = async (proto: 'l2tp' | 'sstp' | 'pptp') => {
    if (!activeProfile || isVpnConnected || isPending) return;
    const defaultPort = proto === 'sstp' ? 443 : proto === 'l2tp' ? 1701 : 1723;
    await updateProfile({
      ...activeProfile,
      protocol: proto,
      port: defaultPort,
    });
  };

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
        reason: `APK/OS প্রোফাইল প্রিভিউ: Full VPN মোডে Android APK দিয়ে কানেক্ট করলে গন্তব্য ${ip} সহ সব ট্রাফিক tun0 দিয়ে যাবে (ওয়েব ব্রাউজারে নয়)।`,
      });
      return;
    }

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

      {/* 0.25 Universal All-Device WebUI Hero Launcher */}
      <button
        onClick={() => onNavigateToTab('webui')}
        className="w-full text-left p-4 sm:p-5 rounded-xl bg-white hover:bg-slate-50 border-2 border-black transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-black text-white shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-extrabold text-black tracking-tight">
                Multi-Vendor OLT, Router &amp; Switch WebUI
              </span>
              <span className="text-xs font-mono text-slate-600">
                · 12 Brands · OLTs · Core Routers · Managed Switches
              </span>
            </div>
            <p className="text-xs text-slate-700 mt-1">
              Huawei, ZTE, BDCOM, VSOL, C-Data OLT · MikroTik, Cisco, Juniper, Palo Alto · Arista, Ruijie, TP-Link Switch — Access/Trunk, LACP, STP, BGP/OSPF, ONU Optical/Reboot ও ফুল কমান্ড লাইব্রেরি এক জায়গায়।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-xs font-bold shrink-0 self-start sm:self-center group-hover:bg-slate-800 transition">
          <span>Open Device WebUI</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* 0.5 Quick Network Tools Launcher (Ping, Speed Ping, Traceroute, Telnet/SSH, Huawei OLT GUI, Packet Tracer) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => (onOpenDiagnosticTool ? onOpenDiagnosticTool('ping') : onNavigateToTab('diagnostics'))}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
              <Zap className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Ping Tool</div>
          <div className="text-[11px] text-slate-600 mt-0.5">ICMP / TCP RTT, TTL &amp; Loss</div>
        </button>

        <button
          onClick={() => (onOpenDiagnosticTool ? onOpenDiagnosticTool('speed-ping') : onNavigateToTab('diagnostics'))}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Gauge className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Speed Ping</div>
          <div className="text-[11px] text-slate-600 mt-0.5">50ms Burst, Live Graph &amp; Jitter</div>
        </button>

        <button
          onClick={() => (onOpenDiagnosticTool ? onOpenDiagnosticTool('traceroute') : onNavigateToTab('diagnostics'))}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              <Route className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Traceroute</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Hop-by-Hop L3 Path &amp; MTR</div>
        </button>

        <button
          onClick={() => onNavigateToTab('terminal')}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Terminal className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Telnet / SSH</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Cisco, Huawei, BDCOM, VSOL</div>
        </button>

        <button
          onClick={() => onNavigateToTab('huawei-olt')}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200">
              <Server className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Huawei OLT GUI</div>
          <div className="text-[11px] text-slate-600 mt-0.5">ONU Add/Del, SN/MAC, Routes</div>
        </button>

        <button
          onClick={() => onNavigateToTab('topology')}
          className="text-left p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-black transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="p-2 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200">
              <Share2 className="w-4 h-4" />
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-black group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-sm font-bold text-black">Packet Tracer CLI</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Graphical IP to Brand/OS CLI</div>
        </button>
      </div>

      {/* GitHub APK Download Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-black">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-black">GitHub থেকে আসল APK ডাউনলোড করার নিয়ম: </span>
            <span className="text-slate-700">
              যেহেতু আপনি Git Push করেছেন, GitHub Actions আপনার ফোনের জন্য <strong>app-release.apk</strong> তৈরি করে রেখেছে। স্ট্যাটাস বারে চাবি (🔑) আইকন ও আসল আইপি চেঞ্জের জন্য এপিকে নামিয়ে নিন।
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://github.com/imrafikul/Termius-clone/releases"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Click to Download APK</span>
          </a>
          <button
            onClick={() => setShowApkGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 font-semibold text-xs transition cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-700" />
            <span>নিয়মাবলী</span>
          </button>
        </div>
      </div>

      {/* Account Isolation & 1-Month Trial Status */}
      {!user ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs text-black">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-100 text-black shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-black">১ মাসের ফ্রি ট্রায়াল ও ডাটা সুরক্ষা: </span>
              <span className="text-slate-700">
                Google অ্যাকাউন্ট দিয়ে লগইন করলে কোনো কার্ড ছাড়াই সাথে সাথে ১ মাসের ফুল ট্রায়াল পাবেন এবং আপনার PPTP তথ্য ক্লাউডে সম্পূর্ণ সুরক্ষিত থাকবে।
              </span>
            </div>
          </div>
          <button
            onClick={loginWithGoogle}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer whitespace-nowrap"
          >
            Google লগইন (Free Trial)
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-black">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>1 Month Free Trial Active:</strong> আপনার অ্যাকাউন্টে {license?.daysRemaining || 30} দিন বাকি রয়েছে (কোনো পেমেন্ট তথ্য ছাড়া চালু)।
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-emerald-900 font-mono text-[11px] bg-white px-2 py-1 rounded border border-emerald-200">
              {user.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Real L2TP/SSTP VPN Tunnel & Honest PPTP Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1 text-xs font-mono text-slate-600">
                <span>Real MikroTik VPN Controller</span>
                <span>·</span>
                <span>Zero MikroTik Admin Login Needed</span>
              </div>
              <h2 className="text-2xl font-bold text-black tracking-tight flex items-center gap-2">
                <span>{activeProfile ? activeProfile.name : 'Select a Profile'}</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-mono">
                Server: {activeProfile?.server || '—'} · Protocol: {activeProtocol.toUpperCase()} · PPP User: {activeProfile?.username || '—'}
              </p>
            </div>

            {/* Profile Dropdown & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onOpenAddProfile}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Profile</span>
              </button>

              <select
                value={activeProfile?.id || ''}
                onChange={(e) => setActiveProfileId(e.target.value)}
                disabled={isVpnConnected || isGatewayReady || isPending}
                className="bg-white border border-slate-300 text-xs text-black rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-black cursor-pointer"
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
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  isVpnConnected || isGatewayReady
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : isPending
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-black text-white hover:bg-slate-800'
                }`}
              >
                {isVpnConnected ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Disconnect VPN</span>
                  </>
                ) : isGatewayReady ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Jump-GW</span>
                  </>
                ) : isPending ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{activeProtocol === 'pptp' ? 'Probe PPTP' : `Connect ${activeProtocol.toUpperCase()} VPN`}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 1-Click VPN Protocol Selector (L2TP / SSTP work REAL from Web without MikroTik Admin Login!) */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                {
                  id: 'l2tp',
                  title: 'L2TP (UDP 1701)',
                  badge: 'Web Live ✓',
                  desc: 'একই /ppp secret · MikroTik লগইন ছাড়াই Direct Ping/Trace/Telnet',
                },
                {
                  id: 'sstp',
                  title: 'SSTP (TCP 443)',
                  badge: 'Web Live ✓',
                  desc: 'TLS টানেল · একই /ppp secret · ফায়ারওয়াল ফ্রেন্ডলি',
                },
                {
                  id: 'pptp',
                  title: 'PPTP (TCP 1723)',
                  badge: 'APK / PC Only',
                  desc: 'GRE 47 ওয়েবে ব্লকড · আসল PPTP-র জন্য Android APK ব্যবহার করুন',
                },
              ] as const
            ).map((item) => {
              const selected = activeProtocol === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isVpnConnected || isPending || !activeProfile}
                  onClick={() => void handleSelectProtocol(item.id)}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer disabled:opacity-60 ${
                    selected
                      ? item.id === 'pptp'
                        ? 'bg-amber-50 border-amber-500 text-black'
                        : 'bg-emerald-50 border-emerald-600 text-black'
                      : 'bg-white border-slate-200 hover:border-black text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold font-mono text-black">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold font-mono ${
                        item.id === 'pptp' ? 'text-amber-800' : 'text-emerald-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-700 mt-1 leading-snug">{item.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Setup Tip for 1-line MikroTik Enable (No Admin Login Needed from Website!) */}
          {!isVpnConnected && (
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-black space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-black text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {activeProtocol === 'l2tp'
                    ? 'MikroTik-এ শুধু একবার L2TP Server অন রাখলেই হবে (একই PPTP ইউজার/পাসওয়ার্ড দিয়ে কানেক্ট হবে):'
                    : activeProtocol === 'sstp'
                    ? 'MikroTik-এ শুধু একবার SSTP Server অন রাখলেই হবে (একই PPTP ইউজার/পাসওয়ার্ড দিয়ে কানেক্ট হবে):'
                    : 'ওয়েবে PPTP GRE 47 ব্লকড — সরাসরি Private IP Ping/Telnet করতে উপরে L2TP বা SSTP সিলেক্ট করুন, অথবা Android APK ইনস্টল করুন।'}
                </span>
              </div>
              {activeProtocol === 'l2tp' && (
                <code className="block text-[11px] font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-black select-all">
                  /interface l2tp-server server set enabled=yes use-ipsec=no
                </code>
              )}
              {activeProtocol === 'sstp' && (
                <code className="block text-[11px] font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-black select-all">
                  /interface sstp-server server set enabled=yes
                </code>
              )}
            </div>
          )}

          {/* Live Error Banner if Connection Failed */}
          {isError && connectionStats.lastError && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-300 text-xs text-red-900 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-mono text-[11px] break-all">{connectionStats.lastError}</div>
            </div>
          )}

          {/* 100% Real Live Tunnel Metrics Strip (Zero Fake Values) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>VPN Tunnel Status</span>
                {isVpnConnected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                )}
              </div>
              <div className={`text-sm font-bold font-mono mt-1 ${isVpnConnected ? 'text-emerald-700' : 'text-red-700'}`}>
                {isVpnConnected ? `ONLINE (${(connectionStats.activeProtocol || 'l2tp').toUpperCase()})` : 'OFFLINE'}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {isVpnConnected ? `IF: ${connectionStats.iface || 'vpn0'} · /ppp active ✓` : 'Not Connected'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>Assigned PPP IP</span>
                <Server className="w-3.5 h-3.5 text-black" />
              </div>
              <div className="text-sm font-bold text-black font-mono mt-1 tabular-nums">
                {isVpnConnected && connectionStats.assignedTunnelIp ? connectionStats.assignedTunnelIp : '—'}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">
                GW: {isVpnConnected ? connectionStats.remoteGatewayIp : '—'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>Real Traffic</span>
                <Activity className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <div className="text-sm font-bold text-black font-mono mt-1 tabular-nums">
                {isVpnConnected ? `↓ ${formatBytes(connectionStats.bytesIn)}` : '0 B'}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5 tabular-nums">
                ↑ {isVpnConnected ? formatBytes(connectionStats.bytesOut) : '0 B'} ({connectionStats.packetsIn + connectionStats.packetsOut} pkts)
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                <span>Tunnel Uptime</span>
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="text-sm font-bold text-black font-mono mt-1 tabular-nums">
                {isVpnConnected ? formatSeconds(connectionStats.uptimeSeconds) : '00:00:00'}
              </div>
              <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                {isVpnConnected ? 'Private Ping/Trace/Telnet ✓' : 'Idle'}
              </div>
            </div>
          </div>

          {/* Quick Actions Footer */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-mono">
              <Cpu className="w-3.5 h-3.5 text-black" />
              <span>
                {isVpnConnected
                  ? `Direct Tunnel Active (${connectionStats.iface || 'vpn0'}): ${connectionStats.activeRoutes.join(', ')}`
                  : 'Connect L2TP/SSTP for direct private IP Ping, Traceroute & Telnet'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onNavigateToTab('webui')}
                className="px-2.5 py-1 rounded bg-black hover:bg-slate-800 text-white font-mono text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Open WebUI
              </button>
              <button
                onClick={() => onNavigateToTab('terminal')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Direct Telnet
              </button>
              <button
                onClick={() => onNavigateToTab('diagnostics')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Direct Ping / Trace
              </button>
              <button
                onClick={() => onNavigateToTab('topology')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 font-mono text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Topology CLI
              </button>
            </div>
          </div>
        </div>

        {/* 2. REAL VISITOR IP & LIVE TUNNEL AUDIT BOX (ZERO HARDCODED FAKE IPs) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-700 mb-2">
              <Globe className="w-4 h-4 text-black" />
              <span>Real Network &amp; Tunnel Audit</span>
            </div>
            <h3 className="text-lg font-bold text-black tracking-tight">
              আসল আইপি ও VPN টানেল স্ট্যাটাস
            </h3>
            <p className="text-xs text-slate-700 mt-2 leading-relaxed">
              L2TP বা SSTP কানেক্ট হলে সার্ভার সরাসরি আপনার MikroTik-এ লগইন করে <strong>/ppp active</strong>-এ Online হবে এবং যেকোনো Private IP-তে সরাসরি Ping, Traceroute ও Telnet কাজ করবে।
            </p>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-mono text-slate-600 mb-1">
                  আপনার বর্তমান আসল পাবলিক আইপি (Detected):
                </div>
                <div className="font-mono text-sm font-bold text-black break-all">
                  {realVisitorIp}
                </div>
                <div className="text-[10px] text-slate-600 font-sans mt-0.5">
                  সরাসরি আপনার কানেকশন থেকে পাওয়া আসল আইপি
                </div>
              </div>

              <div
                className={`p-3 rounded-lg border text-black ${
                  isVpnConnected ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="text-[10px] font-mono mb-1 flex items-center justify-between">
                  <span>সার্ভার VPN টানেল (vpn0):</span>
                  <span className={`text-[10px] font-bold ${isVpnConnected ? 'text-emerald-700' : 'text-red-700'}`}>
                    {isVpnConnected ? 'ONLINE ✓' : 'OFFLINE'}
                  </span>
                </div>
                <div className={`font-mono text-xs font-bold ${isVpnConnected ? 'text-emerald-900' : 'text-red-800'}`}>
                  {isVpnConnected
                    ? `${connectionStats.assignedTunnelIp} → ${connectionStats.remoteGatewayIp}`
                    : 'Not Connected'}
                </div>
                <div className="text-[10px] mt-1 font-sans text-slate-800">
                  {isVpnConnected
                    ? `✓ MikroTik /ppp active-এ Online! এখন MikroTik-এ লগইন ছাড়াই Private IP Ping, Traceroute ও Telnet করুন।`
                    : 'L2TP/SSTP দিয়ে কানেক্ট করলে এখানে আসল Assigned PPP IP দেখাবে। আসল PPTP-র জন্য Android APK ব্যবহার করুন।'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200">
            <button
              onClick={toggleActiveProfileRoutingMode}
              disabled={isVpnConnected || isPending}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-black border border-slate-300 disabled:opacity-60"
              title="Toggle Full Private LAN Routing vs Specific Split Subnets"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Routes: {isFullTunnel ? 'All Private LANs (10/172/192)' : 'Custom Split Subnets'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Interactive Split Route Simulator & Active Routing Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Tester */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-2">
                <Sliders className="w-4 h-4 text-black" />
                <span>টানেল রুট সিমুলেটর (Route Dispatch Simulator)</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                যেকোনো আইপিতে প্যাকেট পাঠালে তা ভিপিএন দিয়ে যাবে নাকি সরাসরি মোবাইলে থাকবে তা পরীক্ষা করুন।
              </p>
            </div>
          </div>

          <form onSubmit={handleTestRoute} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-700 mb-1.5">
                Destination IP to Test:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testIpInput}
                  onChange={(e) => setTestIpInput(e.target.value)}
                  placeholder="e.g. 8.8.8.8 or 192.168.88.1"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  Evaluate Route
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 text-[11px]">Presets:</span>
              <button
                type="button"
                onClick={() => setTestIpInput('8.8.8.8')}
                className="text-blue-700 hover:underline font-mono text-[11px] cursor-pointer font-semibold"
              >
                8.8.8.8 (Google)
              </button>
              <span className="text-slate-400">·</span>
              <button
                type="button"
                onClick={() => setTestIpInput('192.168.88.1')}
                className="text-slate-700 hover:underline font-mono text-[11px] cursor-pointer font-semibold"
              >
                192.168.88.1 (Router)
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-lg border text-xs ${
                  testResult.isSplit
                    ? 'bg-blue-50 border-blue-200 text-black'
                    : 'bg-emerald-50 border-emerald-200 text-black'
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold mb-1">
                  <span>Target Interface:</span>
                  <span className={testResult.isSplit ? 'text-blue-700' : 'text-emerald-700'}>
                    {testResult.targetInterface}
                  </span>
                </div>
                <p className="text-[11px] text-slate-800 leading-relaxed font-sans">
                  {testResult.reason}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Active Route Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-black" />
                  <span>Android TUN রাউটিং টেবিল</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  ভিপিএন কানেক্ট করার সাথে সাথে ফোনে যে রাউটিং রুল ইনজেক্ট হয়।
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="pb-2 font-semibold">Destination CIDR</th>
                    <th className="pb-2 font-semibold">Gateway</th>
                    <th className="pb-2 font-semibold">Interface</th>
                    <th className="pb-2 font-semibold text-right">Policy (APK Preview)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isFullTunnel ? (
                    <tr className="text-black">
                      <td className="py-2 font-bold">0.0.0.0/0</td>
                      <td className="py-2 text-slate-700">{activeProfile?.server || 'Configured PPTP Peer'}</td>
                      <td className="py-2 text-slate-800">tun0 (Android APK)</td>
                      <td className="py-2 text-right font-bold text-blue-700">
                        FULL VPN (APK ONLY)
                      </td>
                    </tr>
                  ) : (
                    <>
                      {activeProfile?.remoteSubnets.map((subnet, idx) => (
                        <tr key={idx} className="text-black">
                          <td className="py-2 font-bold">{subnet}</td>
                          <td className="py-2 text-slate-700">{activeProfile?.server || 'Configured PPTP Peer'}</td>
                          <td className="py-2 text-slate-800">tun0 (Android APK)</td>
                          <td className="py-2 text-right font-bold text-cyan-800">
                            SPLIT TUNNEL (APK)
                          </td>
                        </tr>
                      ))}
                      <tr className="text-slate-700">
                        <td className="py-2">0.0.0.0/0</td>
                        <td className="py-2">Default Gateway</td>
                        <td className="py-2">wlan0 / rmnet0</td>
                        <td className="py-2 text-right font-bold text-emerald-700">
                          BYPASS (FAST)
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-700 font-mono">
            Preview only on Web — OS-level tun0 routing applies only when connected via the native Android APK or OS PPTP client.
          </div>
        </div>
      </div>

      {/* 4. Live PPTP Control & Protocol Handshake Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-black tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-black" />
              <span>PPTP RFC 2637 &amp; PPP Handshake ইভেন্ট লগ</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              কন্ট্রোল কানেকশন, GRE টানেল এবং আইপি পরিবর্তন ইভেন্টসমূহ।
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-700 font-mono">
              Status: <span className="text-black font-bold">{connectionState}</span>
            </span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs text-black h-64 overflow-y-auto border border-slate-200 space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3">
              <span className="text-slate-500 shrink-0 text-[11px] tabular-nums">{log.timestamp}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-bold ${
                  log.component === 'CONTROL'
                    ? 'bg-blue-100 text-blue-800'
                    : log.component === 'PPP'
                    ? 'bg-purple-100 text-purple-800'
                    : log.component === 'GRE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : log.component === 'ROUTE'
                    ? 'bg-cyan-100 text-cyan-900'
                    : 'bg-slate-200 text-black'
                }`}
              >
                [{log.component}]
              </span>
              <span
                className={`flex-1 break-all ${
                  log.level === 'ERROR'
                    ? 'text-red-700 font-semibold'
                    : log.level === 'WARN'
                    ? 'text-amber-800'
                    : 'text-black'
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
