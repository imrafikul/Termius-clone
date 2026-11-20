import React, { useState, useEffect } from 'react';
import { Globe, Terminal, Server, Layers, Activity } from 'lucide-react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProfilesView } from './components/ProfilesView';
import { TerminalView } from './components/TerminalView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { NativeExplorerView } from './components/NativeExplorerView';
import { AdminPanelView } from './components/AdminPanelView';
import { TopologyBuilderView } from './components/TopologyBuilderView';
import { HuaweiOltView } from './components/HuaweiOltView';
import { DeviceWebUiView } from './components/DeviceWebUiView';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConnectionState, ConnectionStats, NetworkLogEntry, VpnProfile, VpnProtocol } from './types/vpn';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  probePptpServer,
  isPrivateIp,
  connectRealVpnTunnel,
  disconnectRealVpnTunnel,
  getRealVpnStatus,
  fetchSystemRuntime,
} from './services/api';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'terminal' | 'webui' | 'huawei-olt' | 'topology' | 'diagnostics' | 'source' | 'admin'>('dashboard');
  const [diagSubTab, setDiagSubTab] = useState<'ping' | 'speed-ping' | 'traceroute' | 'ports-telnet'>('ping');
  const [pendingTopologyCli, setPendingTopologyCli] = useState<{
    brand: string;
    hostIp: string;
    cliScript: string;
    deviceName: string;
  } | null>(null);
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    addProfile,
    updateProfile,
    deleteProfile,
    errorMessage,
    clearError,
  } = useAuth();

  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    uptimeSeconds: 0,
    bytesIn: 0,
    bytesOut: 0,
    packetsIn: 0,
    packetsOut: 0,
    rateInKbps: 0,
    rateOutKbps: 0,
    assignedTunnelIp: '',
    remoteGatewayIp: '',
    activeRoutes: [],
    greCallId: 0,
    rttMs: 0,
    packetLossPercent: 0,
    virtualPublicIp: undefined,
    pptpTunnelConnected: false,
    pptpPortVerified: false,
    jumpGatewayReady: false,
    mikrotikIdentity: undefined,
    lastError: undefined,
  });

  const [logs, setLogs] = useState<NetworkLogEntry[]>([
    {
      id: 'log_init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      component: 'SYSTEM',
      message: 'Universal WebUI for Network Engineer ready. Multi-Vendor OLT/Router/Switch WebUI & VpnService driver loaded.',
    },
  ]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

  const handleSaveProfile = async (profile: VpnProfile) => {
    const exists = profiles.some((p) => p.id === profile.id);
    if (exists) {
      await updateProfile(profile);
    } else {
      await addProfile(profile);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteProfile(id);
  };

  const addLog = (
    component: NetworkLogEntry['component'],
    level: NetworkLogEntry['level'],
    message: string,
    rawHex?: string
  ) => {
    const newEntry: NetworkLogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      component,
      level,
      message,
      rawHex,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 80)]);
  };

  const [nativePptpSupported, setNativePptpSupported] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  useEffect(() => {
    fetchSystemRuntime().then((rt) => {
      setNativePptpSupported(Boolean(rt.nativePptpSupported));
      setIsStandaloneApp(Boolean(rt.standalone));
    });
  }, []);

  // Real L2TPv2 / MS-SSTP (Cloud/Linux) & Native PPTP/L2TP/SSTP (Windows Desktop .exe)
  const startConnectionSequence = async (targetProfile?: VpnProfile, overrideProtocol?: VpnProtocol) => {
    const profile = targetProfile || activeProfile;
    if (!profile) return;

    const serverHost = profile.server.trim();
    const selectedProto: VpnProtocol = overrideProtocol || profile.protocol || (nativePptpSupported ? 'pptp' : 'l2tp');

    if (!isStandaloneApp && !nativePptpSupported && isPrivateIp(serverHost)) {
      const msg = `Cannot reach private LAN IP (${serverHost}) from cloud web server. Enter your MikroTik's PUBLIC IP in the Profile, or run the Windows Desktop App (.exe) locally.`;
      setConnectionState('ERROR');
      setConnectionStats((prev) => ({
        ...prev,
        uptimeSeconds: 0,
        activeProtocol: null,
        pptpTunnelConnected: false,
        pptpPortVerified: false,
        jumpGatewayReady: false,
        lastError: msg,
      }));
      addLog('CONTROL', 'ERROR', msg);
      return;
    }

    // 1. REAL VPN TUNNEL — L2TP/SSTP everywhere + Native PPTP inside Windows Desktop App (.exe)
    if (selectedProto === 'l2tp' || selectedProto === 'sstp' || (selectedProto === 'pptp' && nativePptpSupported)) {
      const defaultPort = selectedProto === 'pptp' ? 1723 : selectedProto === 'sstp' ? 443 : 1701;
      const targetPort =
        selectedProto === 'pptp'
          ? profile.port || 1723
          : profile.port && profile.port !== 1723
          ? profile.port
          : defaultPort;

      setConnectionState('CONNECTING_TCP');
      addLog(
        'CONTROL',
        'INFO',
        `Connecting REAL ${selectedProto.toUpperCase()} VPN tunnel to ${serverHost}:${targetPort} as PPP user "${profile.username}" (no MikroTik admin login required)...`
      );

      try {
        setConnectionState('AUTHENTICATING');
        const res = await connectRealVpnTunnel({
          protocol: selectedProto,
          host: serverHost,
          port: targetPort,
          username: profile.username,
          password: profile.password,
          subnets: profile.remoteSubnets,
        });

        if (Array.isArray(res.logs)) {
          // Append real daemon logs in chronological order
          [...res.logs].reverse().forEach((entry) => {
            addLog(
              (entry.component as NetworkLogEntry['component']) || 'SYSTEM',
              (entry.level as NetworkLogEntry['level']) || 'INFO',
              entry.message
            );
          });
        }

        if (res.connected && res.clientIp) {
          setConnectionState('CONNECTED');
          setConnectionStats((prev) => ({
            ...prev,
            uptimeSeconds: 0,
            bytesIn: res.bytesIn || 0,
            bytesOut: res.bytesOut || 0,
            packetsIn: res.packetsIn || 0,
            packetsOut: res.packetsOut || 0,
            assignedTunnelIp: res.clientIp,
            remoteGatewayIp: res.gatewayIp || serverHost,
            activeRoutes: res.routes || [],
            iface: res.iface || 'vpn0',
            dnsIp: res.dnsIp || '',
            activeProtocol: selectedProto,
            pptpTunnelConnected: true,
            pptpPortVerified: true,
            jumpGatewayReady: false,
            mikrotikIdentity: `${serverHost} (${selectedProto.toUpperCase()})`,
            lastError: undefined,
          }));
          addLog(
            'TUN',
            'INFO',
            `✓ REAL ${selectedProto.toUpperCase()} VPN ONLINE! Assigned IP: ${res.clientIp} · Gateway: ${res.gatewayIp} · MikroTik /ppp active is LIVE! Ping, Traceroute & Telnet to private IPs now route directly via ${res.iface || 'vpn0'}.`
          );
        } else {
          const errMsg =
            res.error ||
            `${selectedProto.toUpperCase()} connection failed on ${serverHost}:${targetPort}.`;
          setConnectionState('ERROR');
          setConnectionStats((prev) => ({
            ...prev,
            uptimeSeconds: 0,
            assignedTunnelIp: '',
            remoteGatewayIp: serverHost,
            activeRoutes: [],
            activeProtocol: null,
            pptpTunnelConnected: false,
            jumpGatewayReady: false,
            lastError: errMsg,
          }));
          addLog('CONTROL', 'ERROR', errMsg);
        }
      } catch (err: any) {
        const msg = `${selectedProto.toUpperCase()} VPN error: ${err?.message || 'Network error'}`;
        setConnectionState('ERROR');
        setConnectionStats((prev) => ({
          ...prev,
          uptimeSeconds: 0,
          activeProtocol: null,
          pptpTunnelConnected: false,
          lastError: msg,
        }));
        addLog('CONTROL', 'ERROR', msg);
      }
      return;
    }

    // 2. PPTP (TCP 1723) — Honest Probe (Web/Cloud blocks GRE 47; real PPTP requires Native APK/OS)
    const pptpPort = profile.port || 1723;
    setConnectionState('CONNECTING_TCP');
    addLog(
      'CONTROL',
      'INFO',
      `Probing PPTP TCP ${pptpPort} & Jump-Gateway on ${serverHost}... (Note: switch protocol to L2TP or SSTP for direct Web VPN without MikroTik login)`
    );

    try {
      setConnectionState('PPTP_HANDSHAKE');
      const probe = await probePptpServer(serverHost, pptpPort, profile.username, profile.password);

      if (probe.pptpVerified) {
        addLog(
          'CONTROL',
          'INFO',
          `✓ PPTP TCP ${pptpPort} replied SCCRP from "${probe.mikrotikHostName || serverHost}" (${probe.latencyMs}ms).`
        );
      } else {
        addLog('CONTROL', 'ERROR', probe.error || `PPTP TCP ${pptpPort} is NOT reachable on ${serverHost}.`);
      }

      addLog(
        'GRE',
        'ERROR',
        'PPTP GRE (Protocol 47) is blocked in Web/Cloud containers. Switch Protocol to L2TP (UDP 1701) or SSTP (TCP 443) for a REAL VPN tunnel from the web using the same /ppp secret, OR install the native Android APK for PPTP.'
      );

      if (probe.jumpLoginVerified) {
        addLog(
          'ROUTE',
          'INFO',
          `✓ MikroTik Jump-Gateway VERIFIED ([${profile.username}@${probe.jumpIdentity || serverHost}]).`
        );
        setConnectionState('GATEWAY_READY');
        setConnectionStats((prev) => ({
          ...prev,
          uptimeSeconds: 0,
          assignedTunnelIp: '',
          remoteGatewayIp: serverHost,
          activeRoutes: profile.remoteSubnets,
          rttMs: probe.jumpTelnetLatencyMs || probe.latencyMs || 0,
          activeProtocol: null,
          pptpTunnelConnected: false,
          pptpPortVerified: probe.pptpVerified,
          jumpGatewayReady: true,
          mikrotikIdentity: probe.jumpIdentity || probe.mikrotikHostName || serverHost,
          lastError: undefined,
        }));
      } else {
        const failReason =
          'PPTP (GRE 47) cannot connect from Web. Select L2TP (UDP 1701) or SSTP (TCP 443) to connect directly with your /ppp secret (no MikroTik admin login needed!), or use Android APK for PPTP.';
        setConnectionState('ERROR');
        setConnectionStats((prev) => ({
          ...prev,
          uptimeSeconds: 0,
          assignedTunnelIp: '',
          remoteGatewayIp: serverHost,
          activeRoutes: [],
          rttMs: probe.latencyMs || 0,
          activeProtocol: null,
          pptpTunnelConnected: false,
          pptpPortVerified: probe.pptpVerified,
          jumpGatewayReady: false,
          mikrotikIdentity: probe.mikrotikHostName || undefined,
          lastError: failReason,
        }));
      }
    } catch (err: any) {
      const msg = `Probe failed: ${err?.message || 'Network error'}`;
      setConnectionState('ERROR');
      setConnectionStats((prev) => ({
        ...prev,
        uptimeSeconds: 0,
        activeProtocol: null,
        pptpTunnelConnected: false,
        jumpGatewayReady: false,
        lastError: msg,
      }));
      addLog('CONTROL', 'ERROR', msg);
    }
  };

  const disconnectSequence = async () => {
    try {
      await disconnectRealVpnTunnel();
    } catch {}
    addLog('CONTROL', 'INFO', 'Disconnected VPN tunnel & cleared routes.');
    setConnectionState('DISCONNECTED');
    setConnectionStats((prev) => ({
      ...prev,
      uptimeSeconds: 0,
      bytesIn: 0,
      bytesOut: 0,
      packetsIn: 0,
      packetsOut: 0,
      rateInKbps: 0,
      rateOutKbps: 0,
      assignedTunnelIp: '',
      activeRoutes: [],
      activeProtocol: null,
      iface: undefined,
      pptpTunnelConnected: false,
      jumpGatewayReady: false,
      mikrotikIdentity: undefined,
      lastError: undefined,
    }));
  };

  const handleToggleConnect = () => {
    if (connectionState === 'CONNECTED' || connectionState === 'GATEWAY_READY') {
      void disconnectSequence();
    } else if (connectionState === 'DISCONNECTED' || connectionState === 'ERROR') {
      void startConnectionSequence();
    }
  };

  const handleConnectSpecificProfile = (profile: VpnProfile) => {
    setActiveProfileId(profile.id);
    if (connectionState === 'CONNECTED' || connectionState === 'GATEWAY_READY') {
      void disconnectSequence().then(() => startConnectionSequence(profile));
    } else {
      void startConnectionSequence(profile);
    }
  };

  // Sync live status from server on initial load & while CONNECTED (real bytes/packets/uptime)
  useEffect(() => {
    let active = true;
    const syncOnce = async () => {
      try {
        const st = await getRealVpnStatus();
        if (!active) return;
        if (st.status === 'CONNECTED' && st.clientIp) {
          setConnectionState('CONNECTED');
          setConnectionStats((prev) => ({
            ...prev,
            uptimeSeconds: st.uptimeSeconds || 0,
            bytesIn: st.bytesIn || 0,
            bytesOut: st.bytesOut || 0,
            packetsIn: st.packetsIn || 0,
            packetsOut: st.packetsOut || 0,
            assignedTunnelIp: st.clientIp,
            remoteGatewayIp: st.gatewayIp || st.host,
            activeRoutes: st.routes || [],
            iface: st.iface || 'vpn0',
            dnsIp: st.dnsIp || '',
            activeProtocol: st.protocol,
            pptpTunnelConnected: true,
            pptpPortVerified: true,
            jumpGatewayReady: false,
            mikrotikIdentity: `${st.host} (${(st.protocol || 'l2tp').toUpperCase()})`,
            lastError: undefined,
          }));
        } else if (connectionState === 'CONNECTED' && st.status !== 'CONNECTED') {
          setConnectionState(st.status === 'ERROR' ? 'ERROR' : 'DISCONNECTED');
          setConnectionStats((prev) => ({
            ...prev,
            uptimeSeconds: 0,
            assignedTunnelIp: '',
            activeRoutes: [],
            activeProtocol: null,
            pptpTunnelConnected: false,
            lastError: st.error || undefined,
          }));
        }
      } catch {}
    };

    void syncOnce();
    const interval = setInterval(() => {
      if (connectionState === 'CONNECTED') {
        void syncOnce();
      } else if (connectionState === 'GATEWAY_READY') {
        setConnectionStats((prev) => ({
          ...prev,
          uptimeSeconds: prev.uptimeSeconds + 2,
        }));
      }
    }, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [connectionState]);

  const [openAddModalFlag, setOpenAddModalFlag] = useState(false);

  const handleOpenAddProfile = () => {
    setActiveTab('profiles');
    setOpenAddModalFlag(true);
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col font-sans">
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2 text-xs font-medium flex items-center justify-center gap-3">
          <span className="text-center">{errorMessage}</span>
          <button
            type="button"
            onClick={clearError}
            className="px-2 py-0.5 rounded border border-red-300 bg-white hover:bg-red-100 text-red-900 font-bold shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3-Zone Top Navigation Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionState={connectionState}
        activeProfile={activeProfile}
        onToggleConnect={handleToggleConnect}
        onOpenAddProfile={handleOpenAddProfile}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            profiles={profiles}
            activeProfile={activeProfile}
            setActiveProfileId={setActiveProfileId}
            connectionState={connectionState}
            connectionStats={connectionStats}
            logs={logs}
            onToggleConnect={handleToggleConnect}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onOpenDiagnosticTool={(tool) => {
              setDiagSubTab(tool);
              setActiveTab('diagnostics');
            }}
            onOpenAddProfile={handleOpenAddProfile}
          />
        )}

        {activeTab === 'profiles' && (
          <ProfilesView
            profiles={profiles}
            activeProfileId={activeProfileId}
            setActiveProfileId={setActiveProfileId}
            onSaveProfile={handleSaveProfile}
            onDeleteProfile={handleDeleteProfile}
            onConnectProfile={handleConnectSpecificProfile}
            isConnected={connectionState === 'CONNECTED' || connectionState === 'GATEWAY_READY'}
            externalOpenAddModal={openAddModalFlag}
            onResetExternalOpenAdd={() => setOpenAddModalFlag(false)}
          />
        )}

        {activeTab === 'terminal' && (
          <TerminalView
            activeProfile={activeProfile}
            isConnected={connectionState === 'CONNECTED'}
            pendingCliHandoff={pendingTopologyCli}
            onClearPendingCli={() => setPendingTopologyCli(null)}
          />
        )}

        {activeTab === 'webui' && <DeviceWebUiView activeProfile={activeProfile} />}

        {activeTab === 'huawei-olt' && (
          <HuaweiOltView defaultHostIp={activeProfile?.server} />
        )}

        {activeTab === 'topology' && (
          <TopologyBuilderView
            onSendToTerminal={(payload) => {
              setPendingTopologyCli(payload);
              setActiveTab('terminal');
            }}
          />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView
            activeProfile={activeProfile}
            isConnected={connectionState === 'CONNECTED'}
            initialTab={diagSubTab}
            onLaunchTerminal={() => setActiveTab('terminal')}
          />
        )}

        {activeTab === 'source' && <NativeExplorerView />}

        {activeTab === 'admin' && <AdminPanelView />}
      </main>

      {/* Auto-Update Prompt Toast & Offline Connectivity Indicator for Installed App / PWA */}
      <PWAUpdateToast />
      <OfflineIndicator />

      {/* Technical Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-4 pb-20 lg:pb-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-700 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-black">Universal WebUI for Network Engineer</span>
            <span>·</span>
            <span>Multi-Vendor OLT, Router &amp; Switch Console</span>
            <span>·</span>
            <span className="text-emerald-700 font-semibold">Live Telnet/SSH · Command Notepad · PPTP VPN</span>
          </div>
          <div className="flex items-center gap-3">
            <span>12 Vendors Supported</span>
            <span>·</span>
            <span>ROS to Junos</span>
          </div>
        </div>
      </footer>

      {/* Native Mobile App Bottom Navigation Bar (Android / iOS Installed PWA) */}
      <nav
        aria-label="Mobile App Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5"
      >
        <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
          {(
            [
              { id: 'webui', label: 'WebUI', icon: Globe },
              { id: 'terminal', label: 'Telnet', icon: Terminal },
              { id: 'huawei-olt', label: 'OLT GUI', icon: Server },
              { id: 'dashboard', label: 'VPN', icon: Layers },
              { id: 'diagnostics', label: 'Ping', icon: Activity },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  active ? 'bg-black text-white' : 'text-slate-700 hover:text-black hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
