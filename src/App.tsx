import React, { useState, useEffect, useMemo } from 'react';
import { Globe, Terminal, Server, Layers, Activity, ShieldCheck, ExternalLink, Copy, Check, X } from 'lucide-react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProfilesView } from './components/ProfilesView';
import { TerminalView } from './components/TerminalView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { NativeExplorerView } from './components/NativeExplorerView';
import { AdminPanelView } from './components/AdminPanelView';
import { TopologyBuilderView } from './components/TopologyBuilderView';
import ProVendorWebUiHub, { ProVendorId } from './components/ProVendorWebUiHub';
import { DeviceWebUiView } from './components/DeviceWebUiView';
import { PublicHomeScreen } from './components/PublicHomeScreen';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConnectionState, ConnectionStats, NetworkLogEntry, VpnProfile, VpnProtocol } from './types/vpn';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FIREBASE_PROJECT_ID, signInWithGoogleForDesktopBridge } from './services/firebase';
import {
  isPrivateIp,
  connectRealVpnTunnel,
  disconnectRealVpnTunnel,
  getRealVpnStatus,
  fetchSystemRuntime,
} from './services/api';

const AUTHORIZED_CLOUD_PROD_URL = 'https://ais-pre-asqdovr5velabzynznrur2-605117365928.asia-southeast1.run.app';
const AUTHORIZED_CLOUD_DEV_URL = 'https://ais-dev-asqdovr5velabzynznrur2-605117365928.asia-southeast1.run.app';

function getSafeLocalhostCallbackOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('desktop_auth_callback');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.origin;
    }
  } catch {
    return null;
  }
  return null;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'terminal' | 'webui' | 'huawei-olt' | 'topology' | 'diagnostics' | 'source' | 'admin'>('dashboard');
  const [diagSubTab, setDiagSubTab] = useState<'ping' | 'speed-ping' | 'traceroute' | 'ports-telnet'>('ping');
  const [proVendorTarget, setProVendorTarget] = useState<ProVendorId>('huawei');
  const [pendingTopologyCli, setPendingTopologyCli] = useState<{
    brand: string;
    hostIp: string;
    cliScript: string;
    deviceName: string;
  } | null>(null);
  const {
    user,
    loading: authLoading,
    loginWithGoogle,
    profiles,
    activeProfileId,
    setActiveProfileId,
    addProfile,
    updateProfile,
    deleteProfile,
    errorMessage,
    clearError,
    unauthorizedDomainHost,
    dismissUnauthorizedDomain,
  } = useAuth();

  const desktopAuthCallbackOrigin = useMemo(() => getSafeLocalhostCallbackOrigin(), []);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const handleDesktopBridgeSignIn = async () => {
    if (!desktopAuthCallbackOrigin) return;
    setBridgeBusy(true);
    setBridgeError(null);
    try {
      const tokens = await signInWithGoogleForDesktopBridge();
      if (!tokens) {
        setBridgeBusy(false);
        return;
      }
      if (!tokens.idToken && !tokens.accessToken) {
        throw new Error('Google OAuth token was not returned by provider.');
      }
      const hashParams = new URLSearchParams();
      if (tokens.idToken) hashParams.set('desktop_auth_id_token', tokens.idToken);
      if (tokens.accessToken) hashParams.set('desktop_auth_access_token', tokens.accessToken);
      window.location.href = `${desktopAuthCallbackOrigin}/#${hashParams.toString()}`;
    } catch (err: unknown) {
      setBridgeError(err instanceof Error ? err.message : String(err));
      setBridgeBusy(false);
    }
  };

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

  // Disconnect active VPN tunnel immediately if user signs out
  useEffect(() => {
    if (!user && (connectionState === 'CONNECTED' || connectionState === 'GATEWAY_READY')) {
      void disconnectSequence();
    }
  }, [user]);

  // Real PPTP (RFC 2637 TCP 1723 + GRE 47 / Windows RAS), L2TPv2 (UDP 1701) & MS-SSTP (TCP 443)
  const startConnectionSequence = async (targetProfile?: VpnProfile, overrideProtocol?: VpnProtocol) => {
    if (!user) {
      setActiveTab('profiles');
      return;
    }
    const profile = targetProfile || activeProfile;
    if (!profile) return;

    const serverHost = profile.server.trim();
    const selectedProto: VpnProtocol = overrideProtocol || profile.protocol || 'pptp';

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
      setConnectionState(selectedProto === 'pptp' ? 'PPTP_HANDSHAKE' : 'AUTHENTICATING');
      const res = await connectRealVpnTunnel({
        protocol: selectedProto,
        host: serverHost,
        port: targetPort,
        username: profile.username,
        password: profile.password,
        subnets: profile.remoteSubnets,
      });

      if (Array.isArray(res.logs)) {
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
    if (user) {
      setOpenAddModalFlag(true);
    }
  };

  if (desktopAuthCallbackOrigin) {
    return (
      <div className="min-h-screen bg-slate-50 text-black flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-black text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black">Desktop App Google Sign-In</h1>
              <p className="text-xs text-slate-600 font-mono">{desktopAuthCallbackOrigin}</p>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            আপনার লোকাল Desktop App (<span className="font-mono font-semibold">{desktopAuthCallbackOrigin}</span>)-এ আপনার নিজস্ব Google অ্যাকাউন্ট লগইন করতে নিচের বাটনে ক্লিক করুন। লগইন সফল হলে অটোমেটিক Desktop App-এ ফিরে যাবে।
          </p>

          {bridgeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {bridgeError}
            </div>
          )}

          <button
            type="button"
            disabled={bridgeBusy}
            onClick={handleDesktopBridgeSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm transition cursor-pointer"
          >
            {bridgeBusy ? 'Signing in with Google...' : 'Sign in with Google & Return to Desktop App'}
          </button>

          <a
            href={desktopAuthCallbackOrigin}
            className="block text-center text-xs text-slate-600 hover:text-black underline"
          >
            Cancel &amp; return to Desktop App
          </a>
        </div>
      </div>
    );
  }

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;
  const prodBridgeUrl = `${AUTHORIZED_CLOUD_PROD_URL}/?desktop_auth_callback=${encodeURIComponent(currentOrigin)}`;
  const devBridgeUrl = `${AUTHORIZED_CLOUD_DEV_URL}/?desktop_auth_callback=${encodeURIComponent(currentOrigin)}`;

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

      {unauthorizedDomainHost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-black space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-black shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-black">
                    Localhost / Desktop Google Login
                  </h3>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Domain: {unauthorizedDomainHost}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissUnauthorizedDomain}
                className="p-1 text-slate-500 hover:text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(unauthorizedDomainHost === 'localhost' || unauthorizedDomainHost === '127.0.0.1') && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-emerald-950">
                  ১-ক্লিকে সরাসরি লগইন করুন (Firebase Console ছাড়াই)
                </p>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Authorized Cloud Portal-এর মাধ্যমে Google সাইন-ইন করে অটোমেটিক আপনার লোকাল Desktop App-এ ফিরে আসুন।
                </p>
                <a
                  href={prodBridgeUrl}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-black hover:bg-slate-800 text-white font-semibold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Sign in with Google (Cloud Bridge)</span>
                </a>
                <a
                  href={devBridgeUrl}
                  className="block text-center text-[11px] text-emerald-800 hover:text-black underline font-medium"
                >
                  অথবা Dev Portal দিয়ে লগইন করুন
                </a>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
              <p className="text-xs font-bold text-black">
                অথবা Firebase Console-এ স্থায়ীভাবে যোগ করুন:
              </p>
              <ol className="text-[11px] text-slate-700 space-y-1 list-decimal list-inside">
                <li>নিচের বাটনে ক্লিক করে Firebase Authentication Settings খুলুন</li>
                <li>
                  <strong>Authorized domains → Add domain</strong>-এ গিয়ে{' '}
                  <code className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-black">
                    {unauthorizedDomainHost}
                  </code>{' '}
                  যোগ করুন
                </li>
                <li>এরপর এখানে ফিরে এসে আবার <strong>Google Login</strong> দিন</li>
              </ol>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={firebaseAuthSettingsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-black bg-white hover:bg-slate-100 text-black font-semibold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Firebase Console</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(unauthorizedDomainHost);
                    setCopiedDomain(true);
                    setTimeout(() => setCopiedDomain(false), 1800);
                  }}
                  className="flex items-center gap-1 py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-black font-mono text-xs cursor-pointer"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!user ? (
        <PublicHomeScreen
          onLoginWithGoogle={loginWithGoogle}
          authLoading={authLoading}
        />
      ) : (
        <>
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
            onOpenProVendor={(vendor) => {
              setProVendorTarget(vendor);
              setActiveTab('huawei-olt');
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
          <ProVendorWebUiHub
            defaultHostIp={activeProfile?.server}
            initialVendor={proVendorTarget}
          />
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
              { id: 'huawei-olt', label: 'Pro GUI', icon: Server },
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
        </>
      )}
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
