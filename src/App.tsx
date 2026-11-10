import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProfilesView } from './components/ProfilesView';
import { TerminalView } from './components/TerminalView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { NativeExplorerView } from './components/NativeExplorerView';
import { AdminPanelView } from './components/AdminPanelView';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { ConnectionState, ConnectionStats, NetworkLogEntry, VpnProfile } from './types/vpn';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'terminal' | 'diagnostics' | 'source' | 'admin'>('dashboard');
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    addProfile,
    updateProfile,
    deleteProfile,
    errorMessage,
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
    assignedTunnelIp: '10.99.0.2',
    remoteGatewayIp: '10.99.0.1',
    activeRoutes: ['192.168.88.0/24', '10.99.0.0/16'],
    greCallId: 0x4011,
    rttMs: 14,
    packetLossPercent: 0,
    virtualPublicIp: '103.145.88.24',
  });

  const [logs, setLogs] = useState<NetworkLogEntry[]>([
    {
      id: 'log_init',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      component: 'SYSTEM',
      message: 'PPTP Solution engine ready. Dual Full-Tunnel & Split-Tunnel VpnService driver loaded.',
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

  // Connection Simulator
  const startConnectionSequence = () => {
    if (!activeProfile) return;

    const isFullTunnel = activeProfile.routingMode === 'full' || activeProfile.remoteSubnets.includes('0.0.0.0/0');

    setConnectionState('CONNECTING_TCP');
    addLog('CONTROL', 'INFO', `Connecting TCP socket to PPTP server ${activeProfile.server}:${activeProfile.port}...`);

    setTimeout(() => {
      setConnectionState('PPTP_HANDSHAKE');
      addLog(
        'CONTROL',
        'INFO',
        'Sending Start-Control-Connection-Request (SCCRQ: Type 1, Version 1.0, Framing=Async, Bearer=Any)',
        '009C 0001 1A2B3C4D 0001'
      );

      setTimeout(() => {
        addLog(
          'CONTROL',
          'INFO',
          'Received Start-Control-Connection-Reply (SCCRP: Result=1 Success, Error=0)',
          '009C 0002 1A2B3C4D 0002 0001'
        );
        addLog('CONTROL', 'INFO', 'Sending Outgoing-Call-Request (OCRQ: CallID=0x1234, Subaddress=none)');

        setTimeout(() => {
          setConnectionState('PPP_LCP');
          addLog(
            'CONTROL',
            'INFO',
            'Received Outgoing-Call-Reply (OCRP: ServerCallID=0x4011, Channel=1, Result=1)',
            '00A8 0008 1A2B3C4D 4011'
          );
          addLog('PPP', 'INFO', `Negotiating Link Control Protocol (LCP: MRU=${activeProfile.mtu}, MagicNumber=0x884011)`);

          setTimeout(() => {
            setConnectionState('AUTHENTICATING');
            addLog('PPP', 'INFO', `Authenticating user '${activeProfile.username}' via MS-CHAPv2 / MPPE 128-bit encryption...`);

            setTimeout(() => {
              setConnectionState('IPCP_CONFIG');
              addLog('PPP', 'INFO', 'IPCP Config-Ack received. Assigned Virtual Client IP: 10.99.0.2 / Gateway: 10.99.0.1');

              setTimeout(() => {
                if (isFullTunnel) {
                  addLog('ROUTE', 'INFO', 'Full Internet VPN Mode enabled: Route 0.0.0.0/0 directed through tun0.');
                  addLog('ROUTE', 'INFO', `Phone Public IP changed to VPN Concentrator: ${activeProfile.server}`);
                  addLog('SYSTEM', 'INFO', 'All device apps & internet traffic now fully encrypted and routed through VPN.');
                } else {
                  activeProfile.remoteSubnets.forEach((sub) => {
                    addLog('ROUTE', 'INFO', `Injected split-tunnel route: ${sub} -> tun0 (VpnService)`);
                  });
                  addLog('ROUTE', 'INFO', 'Preserved default gateway: 0.0.0.0/0 -> wlan0/rmnet (Device Internet Untouched)');
                }

                addLog('GRE', 'INFO', 'Enhanced GRE (RFC 2637, IP Protocol 47) encapsulation loop started.');

                setConnectionState('CONNECTED');
                setConnectionStats((prev) => ({
                  ...prev,
                  uptimeSeconds: 0,
                  assignedTunnelIp: '10.99.0.2',
                  remoteGatewayIp: '10.99.0.1',
                  activeRoutes: isFullTunnel ? ['0.0.0.0/0 (All Internet)'] : activeProfile.remoteSubnets,
                  greCallId: 0x4011,
                  rttMs: 14,
                  virtualPublicIp: isFullTunnel ? activeProfile.server : '103.145.88.24',
                }));
              }, 400);
            }, 500);
          }, 450);
        }, 500);
      }, 450);
    }, 500);
  };

  const disconnectSequence = () => {
    addLog('CONTROL', 'INFO', 'Sending Call-Clear-Request (CCR) to PPTP concentrator.');
    addLog('ROUTE', 'INFO', 'Resetting virtual routes. Reverting phone IP to native operator.');
    addLog('SYSTEM', 'INFO', 'PPTP tunnel cleanly terminated.');
    setConnectionState('DISCONNECTED');
    setConnectionStats((prev) => ({
      ...prev,
      rateInKbps: 0,
      rateOutKbps: 0,
      virtualPublicIp: '103.145.88.24',
    }));
  };

  const handleToggleConnect = () => {
    if (connectionState === 'CONNECTED') {
      disconnectSequence();
    } else if (connectionState === 'DISCONNECTED' || connectionState === 'ERROR') {
      startConnectionSequence();
    }
  };

  const handleConnectSpecificProfile = (profile: VpnProfile) => {
    setActiveProfileId(profile.id);
    if (connectionState === 'CONNECTED') {
      disconnectSequence();
      setTimeout(() => startConnectionSequence(), 400);
    } else {
      startConnectionSequence();
    }
  };

  // Uptime and bandwidth simulation while connected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (connectionState === 'CONNECTED') {
      interval = setInterval(() => {
        setConnectionStats((prev) => {
          const rateOut = Math.round((12 + Math.random() * 8) * 10) / 10;
          const rateIn = Math.round((45 + Math.random() * 25) * 10) / 10;
          return {
            ...prev,
            uptimeSeconds: prev.uptimeSeconds + 1,
            rateOutKbps: rateOut,
            rateInKbps: rateIn,
            bytesOut: prev.bytesOut + Math.round(rateOut * 1024),
            bytesIn: prev.bytesIn + Math.round(rateIn * 1024),
            packetsOut: prev.packetsOut + Math.floor(10 + Math.random() * 5),
            packetsIn: prev.packetsIn + Math.floor(30 + Math.random() * 15),
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connectionState]);

  const [openAddModalFlag, setOpenAddModalFlag] = useState(false);

  const handleOpenAddProfile = () => {
    setActiveTab('profiles');
    setOpenAddModalFlag(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {errorMessage && (
        <div className="bg-red-500/20 border-b border-red-500/30 text-red-200 px-4 py-2 text-xs text-center">
          {errorMessage}
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
            isConnected={connectionState === 'CONNECTED'}
            externalOpenAddModal={openAddModalFlag}
            onResetExternalOpenAdd={() => setOpenAddModalFlag(false)}
          />
        )}

        {activeTab === 'terminal' && (
          <TerminalView activeProfile={activeProfile} isConnected={connectionState === 'CONNECTED'} />
        )}

        {activeTab === 'diagnostics' && (
          <DiagnosticsView activeProfile={activeProfile} isConnected={connectionState === 'CONNECTED'} />
        )}

        {activeTab === 'source' && <NativeExplorerView />}

        {activeTab === 'admin' && <AdminPanelView />}
      </main>

      {/* Auto-Update Prompt Toast for Installed App / PWA */}
      <PWAUpdateToast />

      {/* Technical Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>PPTP Solution</span>
            <span>·</span>
            <span>Android VpnService Engine</span>
            <span>·</span>
            <span className="text-emerald-400">Full VPN (Change IP) &amp; Split Tunneling Supported</span>
          </div>
          <div className="flex items-center gap-3">
            <span>1 Month Free Trial Active</span>
            <span>·</span>
            <span>MikroTik RouterOS v6/v7</span>
          </div>
        </div>
      </footer>
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
