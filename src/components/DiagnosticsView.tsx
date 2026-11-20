import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Play,
  Square,
  Clock,
  Layers,
  Search,
  Server,
  Zap,
  Gauge,
  Route,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  PortCheckResult,
  PingProbeResult,
  SpeedPingProbe,
  SpeedPingResult,
  TracerouteResult,
  VpnProfile,
} from '../types/vpn';
import {
  checkRouterPorts,
  runPingProbe,
  runSpeedPing,
  runTraceroute,
  probeTelnet,
  isPrivateIp,
  JumpGatewayConfig,
} from '../services/api';

interface DiagnosticsViewProps {
  activeProfile: VpnProfile | null;
  isConnected: boolean;
  initialTab?: DiagTab;
  onLaunchTerminal?: (host: string, port: number, protocol: 'SSH' | 'Telnet') => void;
}

type DiagTab = 'ping' | 'speed-ping' | 'traceroute' | 'ports-telnet';

function calculateClientStats(probes: SpeedPingProbe[]) {
  const successful = probes.filter((p) => p.success);
  const latencies = successful.map((p) => p.latencyMs);
  const transmitted = probes.length;
  const received = successful.length;
  const packetLossPercent =
    transmitted > 0 ? Math.round(((transmitted - received) / transmitted) * 1000) / 10 : 0;

  if (latencies.length === 0) {
    return {
      transmitted,
      received,
      packetLossPercent,
      min: 0,
      avg: 0,
      max: 0,
      p95: 0,
      jitter: 0,
      grade: 'POOR' as const,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;
  const avg = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10;
  const p95 = Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] * 10) / 10;

  let jitter = 0;
  if (latencies.length > 1) {
    let diff = 0;
    for (let i = 1; i < latencies.length; i++) {
      diff += Math.abs(latencies[i] - latencies[i - 1]);
    }
    jitter = Math.round((diff / (latencies.length - 1)) * 10) / 10;
  }

  let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
  if (packetLossPercent === 0 && avg < 45 && jitter < 12) {
    grade = 'EXCELLENT';
  } else if (packetLossPercent <= 2 && avg < 110 && jitter < 30) {
    grade = 'GOOD';
  } else if (packetLossPercent <= 10 && avg < 220) {
    grade = 'FAIR';
  }

  return { transmitted, received, packetLossPercent, min, avg, max, p95, jitter, grade };
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  activeProfile,
  isConnected,
  initialTab = 'ping',
  onLaunchTerminal,
}) => {
  const defaultRouter = activeProfile?.server || '192.168.88.1';

  const [activeTab, setActiveTab] = useState<DiagTab>(initialTab);
  const [sharedHost, setSharedHost] = useState('8.8.8.8');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // --- 1. Standard Ping state ---
  const [pingCount, setPingCount] = useState(5);
  const [pingMode, setPingMode] = useState<'auto' | 'icmp' | 'tcp'>('auto');
  const [pingPort, setPingPort] = useState(80);
  const [useJumpGateway, setUseJumpGateway] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  const [pingData, setPingData] = useState<PingProbeResult | null>(null);

  const canUseMikrotikJump = Boolean(!isConnected && activeProfile?.server && !isPrivateIp(activeProfile.server));

  useEffect(() => {
    if (isConnected) {
      setUseJumpGateway(false);
      return;
    }
    if (canUseMikrotikJump && isPrivateIp(sharedHost)) {
      setUseJumpGateway(true);
    } else if (!isPrivateIp(sharedHost)) {
      setUseJumpGateway(false);
    }
  }, [sharedHost, canUseMikrotikJump, isConnected]);

  // --- 2. Speed Ping state ---
  const [speedBurstMode, setSpeedBurstMode] = useState<'20' | '50' | 'live'>('20');
  const [speedIntervalMs, setSpeedIntervalMs] = useState<50 | 100 | 250>(100);
  const [speedPort, setSpeedPort] = useState(80);
  const [isSpeedPinging, setIsSpeedPinging] = useState(false);
  const [speedError, setSpeedError] = useState<string | null>(null);
  const [speedProbes, setSpeedProbes] = useState<SpeedPingProbe[]>([]);
  const [speedMeta, setSpeedMeta] = useState<{
    host: string;
    resolvedIp?: string;
    method: 'icmp' | 'tcp';
    packetsPerSec: number;
    durationMs: number;
  } | null>(null);
  const stopSpeedRef = useRef(false);

  // --- 3. Traceroute state ---
  const [maxHops, setMaxHops] = useState(16);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<TracerouteResult | null>(null);

  // --- 4. Port Scanner & Telnet state ---
  const [customPort, setCustomPort] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [portResults, setPortResults] = useState<PortCheckResult[]>([]);

  const [telnetPort, setTelnetPort] = useState(23);
  const [isTestingTelnet, setIsTestingTelnet] = useState(false);
  const [telnetResult, setTelnetResult] = useState<{
    host: string;
    port: number;
    connected: boolean;
    latencyMs: number;
    banner?: string | null;
    error?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      stopSpeedRef.current = true;
    };
  }, []);

  const handleRunPing = async () => {
    const host = sharedHost.trim();
    if (!host) return;
    setIsPinging(true);
    setPingError(null);
    try {
      const jumpCfg: JumpGatewayConfig | undefined =
        useJumpGateway && activeProfile?.server && !isPrivateIp(activeProfile.server)
          ? {
              host: activeProfile.server,
              port: 23,
              username: activeProfile.username || 'admin',
              password: activeProfile.password || '',
            }
          : undefined;
      const result = await runPingProbe(host, pingPort, pingCount, pingMode, jumpCfg);
      setPingData(result);
    } catch (err: any) {
      setPingError(err.message || 'Ping request failed');
    } finally {
      setIsPinging(false);
    }
  };

  const handleStopSpeedPing = () => {
    stopSpeedRef.current = true;
    setIsSpeedPinging(false);
  };

  const handleStartSpeedPing = async () => {
    const host = sharedHost.trim();
    if (!host) return;

    stopSpeedRef.current = false;
    setIsSpeedPinging(true);
    setSpeedError(null);
    setSpeedProbes([]);
    setSpeedMeta(null);

    try {
      if (speedBurstMode !== 'live') {
        const count = parseInt(speedBurstMode, 10);
        const result: SpeedPingResult = await runSpeedPing(host, {
          count,
          intervalMs: speedIntervalMs,
          port: speedPort,
        });
        if (!stopSpeedRef.current) {
          setSpeedProbes(result.probes);
          setSpeedMeta({
            host: result.host,
            resolvedIp: result.resolvedIp,
            method: result.method,
            packetsPerSec: result.packetsPerSec,
            durationMs: result.durationMs,
          });
        }
      } else {
        const startTs = Date.now();
        let allProbes: SpeedPingProbe[] = [];
        let seqOffset = 0;

        while (!stopSpeedRef.current) {
          const batch = await runSpeedPing(host, {
            count: 6,
            intervalMs: speedIntervalMs,
            port: speedPort,
          });
          if (stopSpeedRef.current) break;

          const renumbered = batch.probes.map((p, idx) => ({
            ...p,
            seq: seqOffset + idx + 1,
          }));
          seqOffset += renumbered.length;
          allProbes = [...allProbes, ...renumbered].slice(-120);

          const elapsed = Math.max(1, Date.now() - startTs);
          const pps = Math.round((seqOffset / (elapsed / 1000)) * 10) / 10;

          setSpeedProbes(allProbes);
          setSpeedMeta({
            host: batch.host,
            resolvedIp: batch.resolvedIp,
            method: batch.method,
            packetsPerSec: pps,
            durationMs: elapsed,
          });
        }
      }
    } catch (err: any) {
      setSpeedError(err.message || 'Speed Ping failed');
    } finally {
      setIsSpeedPinging(false);
    }
  };

  const handleRunTraceroute = async () => {
    const host = sharedHost.trim();
    if (!host) return;
    setIsTracing(true);
    setTraceError(null);
    try {
      const result = await runTraceroute(host, maxHops, 1);
      setTraceData(result);
    } catch (err: any) {
      setTraceError(err.message || 'Traceroute failed');
    } finally {
      setIsTracing(false);
    }
  };

  const handleRunPortScan = async () => {
    const host = sharedHost.trim();
    if (!host) return;
    setIsScanning(true);
    const standardPorts = [8291, 22, 23, 80, 443, 8728, 1723];
    if (customPort.trim()) {
      const parsed = parseInt(customPort.trim(), 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535 && !standardPorts.includes(parsed)) {
        standardPorts.push(parsed);
      }
    }

    const results = await checkRouterPorts(host, standardPorts);
    const annotated = results.map((r) => {
      let serviceName = `Port ${r.port}`;
      if (r.port === 8291) serviceName = 'MikroTik Winbox';
      if (r.port === 22) serviceName = 'SSH Terminal';
      if (r.port === 23) serviceName = 'Telnet Terminal';
      if (r.port === 80) serviceName = 'HTTP WebFig';
      if (r.port === 443) serviceName = 'HTTPS WebFig';
      if (r.port === 8728) serviceName = 'RouterOS API';
      if (r.port === 1723) serviceName = 'PPTP Control';
      return { ...r, serviceName };
    });

    setPortResults(annotated);
    setIsScanning(false);
  };

  const handleTestTelnet = async () => {
    const host = sharedHost.trim();
    if (!host) return;
    setIsTestingTelnet(true);
    const res = await probeTelnet(host, telnetPort);
    setTelnetResult({
      host,
      port: telnetPort,
      connected: res.connected,
      latencyMs: res.latencyMs,
      banner: res.banner,
      error: res.error,
    });
    setIsTestingTelnet(false);
  };

  const speedStats = calculateClientStats(speedProbes);
  const sparklineProbes = speedProbes.slice(-50);
  const maxSparkLatency = Math.max(
    50,
    ...sparklineProbes.filter((p) => p.success).map((p) => p.latencyMs)
  );

  const gradeBadgeStyle = (grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR') => {
    switch (grade) {
      case 'EXCELLENT':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'GOOD':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'FAIR':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      default:
        return 'bg-red-50 text-red-800 border-red-300';
    }
  };

  const barColorForLatency = (ms: number, success: boolean) => {
    if (!success) return 'bg-red-600';
    if (ms < 35) return 'bg-emerald-600';
    if (ms < 85) return 'bg-blue-600';
    if (ms < 160) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-5">
      {/* Shared Target Host Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-black tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-black" />
              <span>Network Diagnostics Suite</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ping, Speed Ping (High-Frequency Burst &amp; Live Jitter), Multi-Hop Traceroute, TCP Port Scanner &amp; Telnet Probe.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={sharedHost}
                onChange={(e) => setSharedHost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (activeTab === 'ping') handleRunPing();
                    else if (activeTab === 'speed-ping' && !isSpeedPinging) handleStartSpeedPing();
                    else if (activeTab === 'traceroute') handleRunTraceroute();
                    else if (activeTab === 'ports-telnet') handleRunPortScan();
                  }
                }}
                placeholder="Target IP or Host (e.g. 8.8.8.8)"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              {['8.8.8.8', '1.1.1.1', 'google.com', defaultRouter].map((preset, idx) => (
                <button
                  key={`${preset}-${idx}`}
                  onClick={() => setSharedHost(preset)}
                  className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                    sharedHost === preset
                      ? 'bg-black text-white border-black font-semibold'
                      : 'bg-white text-black border-slate-300 hover:border-black'
                  }`}
                >
                  {idx === 3 ? `Router (${preset})` : preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MikroTik Jump-Gateway Toggle for Private/Local LAN IP Ping */}
        {canUseMikrotikJump && activeProfile && (
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <label className="flex items-center gap-2 font-semibold text-black cursor-pointer">
              <input
                type="checkbox"
                checked={useJumpGateway}
                onChange={(e) => setUseJumpGateway(e.target.checked)}
                className="accent-black rounded"
              />
              <span>
                Local IP Ping via MikroTik Jump-Gateway (
                <span className="font-mono">{activeProfile.server}</span>)
              </span>
            </label>
            <span className="text-[11px] font-mono text-slate-600">
              {useJumpGateway
                ? `Runs /ping ${sharedHost || '<LAN-IP>'} directly inside your MikroTik`
                : 'Auto-enables for private LAN IPs (192.168.x.x / 10.x.x.x / 172.16.x.x)'}
            </span>
          </div>
        )}

        {/* 4-Tool Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => setActiveTab('ping')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'ping'
                ? 'bg-black text-white border-black'
                : 'bg-slate-50 text-black border-slate-200 hover:border-black'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Ping</span>
          </button>

          <button
            onClick={() => setActiveTab('speed-ping')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'speed-ping'
                ? 'bg-black text-white border-black'
                : 'bg-slate-50 text-black border-slate-200 hover:border-black'
            }`}
          >
            <Gauge className="w-4 h-4" />
            <span>Speed Ping</span>
            {isSpeedPinging && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('traceroute')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'traceroute'
                ? 'bg-black text-white border-black'
                : 'bg-slate-50 text-black border-slate-200 hover:border-black'
            }`}
          >
            <Route className="w-4 h-4" />
            <span>Traceroute</span>
          </button>

          <button
            onClick={() => setActiveTab('ports-telnet')}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'ports-telnet'
                ? 'bg-black text-white border-black'
                : 'bg-slate-50 text-black border-slate-200 hover:border-black'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Port Scan &amp; Telnet</span>
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: STANDARD PING ==================== */}
      {activeTab === 'ping' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-slate-100 text-black border border-slate-200">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-black font-mono">
                  ICMP / TCP Latency Ping Runner
                </h3>
                <p className="text-xs text-slate-600">
                  Tests reachability, TTL, round-trip latency, packet loss, and jitter to{' '}
                  <span className="text-black font-semibold font-mono">{sharedHost || '—'}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pingMode}
                onChange={(e) => setPingMode(e.target.value as 'auto' | 'icmp' | 'tcp')}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              >
                <option value="auto">Auto (ICMP / TCP)</option>
                <option value="icmp">ICMP Echo</option>
                <option value="tcp">TCP SYN Ping</option>
              </select>

              {pingMode === 'tcp' && (
                <input
                  type="number"
                  value={pingPort}
                  onChange={(e) => setPingPort(parseInt(e.target.value, 10) || 80)}
                  placeholder="Port"
                  className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
                />
              )}

              <select
                value={pingCount}
                onChange={(e) => setPingCount(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              >
                <option value={4}>4 Packets</option>
                <option value={5}>5 Packets</option>
                <option value={10}>10 Packets</option>
              </select>

              <button
                onClick={handleRunPing}
                disabled={isPinging}
                className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPinging ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Pinging...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Ping</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pingError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{pingError}</span>
            </div>
          )}

          {!pingData ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Zap className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-mono">
                Enter a host IP or domain above and click <strong className="text-black">Run Ping</strong> to start measuring RTT &amp; jitter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Min RTT</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-1 tabular-nums">
                    {pingData.stats.min} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Avg RTT</div>
                  <div className="text-base font-bold text-black font-mono mt-1 tabular-nums">
                    {pingData.stats.avg} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Max RTT</div>
                  <div className="text-base font-bold text-amber-700 font-mono mt-1 tabular-nums">
                    {pingData.stats.max} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Jitter</div>
                  <div className="text-base font-bold text-purple-800 font-mono mt-1 tabular-nums">
                    {pingData.stats.jitter} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Packet Loss</div>
                  <div
                    className={`text-base font-bold font-mono mt-1 tabular-nums ${
                      pingData.packetLossPercent === 0
                        ? 'text-emerald-700'
                        : pingData.packetLossPercent < 50
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {pingData.packetLossPercent}%
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs space-y-2 text-black">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 text-[11px] text-slate-700">
                  <span className="font-semibold text-black">
                    PING {pingData.host} ({pingData.resolvedIp || pingData.host}) — {pingData.transmitted} packets
                  </span>
                  <span className="font-bold text-black uppercase text-[10px]">
                    {pingData.method === 'icmp' ? 'ICMP ECHO' : `TCP PORT ${pingData.port}`}
                  </span>
                </div>

                {pingData.probes.map((p) => {
                  const pct = p.success
                    ? Math.min(100, Math.max(6, (p.latencyMs / Math.max(50, pingData.stats.max || 100)) * 100))
                    : 100;
                  return (
                    <div
                      key={p.seq}
                      className="grid grid-cols-12 items-center gap-2 py-1 text-black"
                    >
                      <span className="col-span-2 text-slate-600">seq={p.seq}</span>
                      <span className="col-span-4 truncate">
                        from {pingData.resolvedIp || pingData.host}
                        {p.ttl ? ` ttl=${p.ttl}` : ''}
                      </span>
                      <div className="col-span-3 h-2 bg-slate-200 rounded overflow-hidden">
                        <div
                          className={`h-full rounded ${barColorForLatency(p.latencyMs, p.success)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <span
                          className={`font-bold tabular-nums ${
                            p.success ? 'text-black' : 'text-red-700'
                          }`}
                        >
                          {p.success ? `${p.latencyMs} ms` : 'TIMEOUT'}
                        </span>
                        {p.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-700 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2.5 border-t border-slate-200 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {pingData.transmitted} transmitted, {pingData.received} received,{' '}
                    {pingData.packetLossPercent}% packet loss
                  </span>
                  <span>
                    rtt min/avg/max/jitter = {pingData.stats.min}/{pingData.stats.avg}/{pingData.stats.max}/{pingData.stats.jitter} ms
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SPEED PING ==================== */}
      {activeTab === 'speed-ping' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-slate-100 text-black border border-slate-200">
                <Gauge className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-black font-mono">
                  Speed Ping — High-Frequency Rapid Burst &amp; Jitter Monitor
                </h3>
                <p className="text-xs text-slate-600">
                  Stress-tests link stability, spike detection (P95), jitter variance &amp; packet drop rate at up to 20 packets/sec.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={speedBurstMode}
                disabled={isSpeedPinging}
                onChange={(e) => setSpeedBurstMode(e.target.value as '20' | '50' | 'live')}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black disabled:opacity-50"
              >
                <option value="20">20 Burst</option>
                <option value="50">50 Burst</option>
                <option value="live">Continuous Live</option>
              </select>

              <select
                value={speedIntervalMs}
                disabled={isSpeedPinging}
                onChange={(e) => setSpeedIntervalMs(parseInt(e.target.value, 10) as 50 | 100 | 250)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black disabled:opacity-50"
              >
                <option value={50}>50ms (Turbo)</option>
                <option value={100}>100ms (Fast)</option>
                <option value={250}>250ms (Normal)</option>
              </select>

              <input
                type="number"
                value={speedPort}
                disabled={isSpeedPinging}
                onChange={(e) => setSpeedPort(parseInt(e.target.value, 10) || 80)}
                title="Fallback TCP Port"
                placeholder="Port"
                className="w-20 bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black disabled:opacity-50"
              />

              {!isSpeedPinging ? (
                <button
                  onClick={handleStartSpeedPing}
                  className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Speed Ping</span>
                </button>
              ) : (
                <button
                  onClick={handleStopSpeedPing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          </div>

          {speedError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{speedError}</span>
            </div>
          )}

          {speedProbes.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Gauge className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-mono">
                {isSpeedPinging
                  ? `Running rapid speed probes against ${sharedHost}...`
                  : 'Select burst size or Continuous Live mode and click Start Speed Ping to graph real-time latency spikes.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                  <span className="text-black font-bold">
                    {speedMeta?.host} ({speedMeta?.resolvedIp || speedMeta?.host})
                  </span>
                  <span className="text-slate-700 font-semibold uppercase text-[11px]">
                    · {speedMeta?.method === 'icmp' ? 'ICMP' : `TCP:${speedPort}`}
                  </span>
                  <span className="text-slate-700">
                    · {speedStats.received}/{speedStats.transmitted} OK ·{' '}
                    <span className="text-emerald-700 font-bold">
                      {speedMeta?.packetsPerSec ?? 0} pkt/s
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-600 uppercase">Link Stability:</span>
                  <span
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono font-bold tracking-wide ${gradeBadgeStyle(
                      speedStats.grade
                    )}`}
                  >
                    {speedStats.grade}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Min</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5 tabular-nums">
                    {speedStats.min} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Avg</div>
                  <div className="text-base font-bold text-black font-mono mt-0.5 tabular-nums">
                    {speedStats.avg} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">P95 Spike</div>
                  <div className="text-base font-bold text-blue-700 font-mono mt-0.5 tabular-nums">
                    {speedStats.p95} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Max</div>
                  <div className="text-base font-bold text-amber-700 font-mono mt-0.5 tabular-nums">
                    {speedStats.max} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Jitter</div>
                  <div className="text-base font-bold text-purple-800 font-mono mt-0.5 tabular-nums">
                    {speedStats.jitter} ms
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <div className="text-[10px] font-mono text-slate-600 uppercase">Loss %</div>
                  <div
                    className={`text-base font-bold font-mono mt-0.5 tabular-nums ${
                      speedStats.packetLossPercent === 0
                        ? 'text-emerald-700'
                        : speedStats.packetLossPercent < 5
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {speedStats.packetLossPercent}%
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-700 mb-3 gap-2">
                  <span className="font-semibold text-black">
                    Live Latency Graph (Last {sparklineProbes.length} Probes)
                  </span>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-emerald-600" /> &lt;35ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-blue-600" /> &lt;85ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-amber-500" /> &lt;160ms
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-red-600" /> High/Loss
                    </span>
                  </div>
                </div>

                <div className="h-36 flex items-end gap-1 pt-2 border-b border-slate-300 pb-1">
                  {sparklineProbes.map((probe) => {
                    const heightPct = probe.success
                      ? Math.max(8, Math.min(100, Math.round((probe.latencyMs / maxSparkLatency) * 100)))
                      : 100;
                    return (
                      <div
                        key={probe.seq}
                        title={`seq=${probe.seq} | ${probe.success ? `${probe.latencyMs} ms` : 'LOST'}`}
                        className="flex-1 h-full flex items-end group relative"
                      >
                        <div
                          className={`w-full rounded-t transition-all duration-150 ${barColorForLatency(
                            probe.latencyMs,
                            probe.success
                          )}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 mt-2">
                  <span>seq #{sparklineProbes[0]?.seq ?? 1}</span>
                  <span>Peak scale: {maxSparkLatency} ms</span>
                  <span>seq #{sparklineProbes[sparklineProbes.length - 1]?.seq ?? 1}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: LIVE TRACEROUTE ==================== */}
      {activeTab === 'traceroute' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-slate-100 text-black border border-slate-200">
                <Route className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-black font-mono">
                  Live Multi-Hop Traceroute &amp; MTR Path Analyzer
                </h3>
                <p className="text-xs text-slate-600">
                  Traces every L3 router hop with TTL progression, reverse DNS, packet loss, and per-hop RTT stats.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={maxHops}
                disabled={isTracing}
                onChange={(e) => setMaxHops(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              >
                <option value={12}>Max 12 Hops</option>
                <option value={16}>Max 16 Hops</option>
                <option value={24}>Max 24 Hops</option>
                <option value={30}>Max 30 Hops</option>
              </select>

              <button
                onClick={handleRunTraceroute}
                disabled={isTracing}
                className="px-4 py-2 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTracing ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Tracing Hops...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Run Traceroute</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {traceError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
              <span>{traceError}</span>
            </div>
          )}

          {!traceData ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Route className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-mono">
                {isTracing
                  ? `Probing intermediate hops to ${sharedHost} (TTL 1 → ${maxHops})...`
                  : 'Click Run Traceroute to trace every gateway hop from source to destination.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-black font-bold">
                    Target: {traceData.host} ({traceData.resolvedIp})
                  </span>
                  <span className="text-slate-700 text-[11px] uppercase font-semibold">
                    · {traceData.method === 'icmp' ? 'ICMP TTL TRACE' : 'TCP REACHABILITY'}
                  </span>
                </div>
                <span
                  className={`font-bold ${
                    traceData.reached ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {traceData.reached
                    ? `✓ Destination Reached (${traceData.hops.length} hops)`
                    : `Partial Trace (${traceData.hops.length} hops)`}
                </span>
              </div>

              {traceData.note && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                  {traceData.note}
                </div>
              )}

              <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl p-4">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="pb-2.5 pr-3 font-semibold">Hop</th>
                      <th className="pb-2.5 pr-3 font-semibold">IP Address</th>
                      <th className="pb-2.5 pr-3 font-semibold">Hostname</th>
                      <th className="pb-2.5 pr-3 font-semibold text-right">Loss %</th>
                      <th className="pb-2.5 pr-3 font-semibold text-right">Last</th>
                      <th className="pb-2.5 pr-3 font-semibold text-right">Avg</th>
                      <th className="pb-2.5 pr-3 font-semibold text-right">Best</th>
                      <th className="pb-2.5 pr-3 font-semibold text-right">Worst</th>
                      <th className="pb-2.5 font-semibold text-right">StDev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {traceData.hops.map((h) => {
                      const isTimeout = h.ip === '*';
                      const isTarget = h.ip === traceData.resolvedIp;
                      return (
                        <tr
                          key={h.hop}
                          className={isTarget ? 'bg-emerald-50 text-black' : 'text-black'}
                        >
                          <td className="py-2.5 pr-3 font-bold">{h.hop}</td>
                          <td className="py-2.5 pr-3 font-semibold">
                            {isTimeout ? (
                              <span className="text-slate-500">* * *</span>
                            ) : (
                              <span className={isTarget ? 'text-emerald-800 font-bold' : 'text-black'}>
                                {h.ip}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-600 max-w-[220px] truncate">
                            {h.hostname}
                          </td>
                          <td
                            className={`py-2.5 pr-3 text-right font-bold ${
                              h.lossPercent === 0
                                ? 'text-emerald-700'
                                : h.lossPercent < 100
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }`}
                          >
                            {h.lossPercent}%
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {isTimeout ? '—' : `${h.lastMs} ms`}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold">
                            {isTimeout ? '—' : `${h.avgMs} ms`}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">
                            {isTimeout ? '—' : `${h.bestMs} ms`}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-amber-700">
                            {isTimeout ? '—' : `${h.worstMs} ms`}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-slate-600">
                            {isTimeout ? '—' : h.stDev}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: PORT SCAN & TELNET ==================== */}
      {activeTab === 'ports-telnet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Full TCP Port Scanner */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <Server className="w-4 h-4 text-black" />
                  <span>Full TCP Port Scanner</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Winbox (8291), SSH (22), Telnet (23), WebFig (80/443), API (8728), PPTP (1723)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value)}
                placeholder="Custom port (optional)"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <button
                onClick={handleRunPortScan}
                disabled={isScanning}
                className="px-4 py-2 rounded-lg bg-black hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Scan {sharedHost}</span>
                  </>
                )}
              </button>
            </div>

            {portResults.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-700 font-mono">
                Click <strong className="text-black">Scan {sharedHost}</strong> to check open management ports.
              </div>
            ) : (
              <div className="space-y-2">
                {portResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.status === 'OPEN'
                            ? 'bg-emerald-600'
                            : item.status === 'CLOSED'
                            ? 'bg-slate-400'
                            : 'bg-amber-600'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold text-black flex items-center gap-2">
                          <span>{item.serviceName}</span>
                          <span className="text-[11px] font-mono text-slate-700">:{item.port}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                          {item.message || 'Probed via TCP socket connect'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-slate-700 tabular-nums">
                        {item.latencyMs} ms
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          item.status === 'OPEN'
                            ? 'text-emerald-700'
                            : item.status === 'CLOSED'
                            ? 'text-slate-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Multi-Vendor Telnet Troubleshooter */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-black" />
                  <span>Multi-Vendor Telnet Probe (RFC 854)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Cisco, Huawei, BDCOM, VSOL, MikroTik &amp; Palo Alto banner &amp; IAC handshake check.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700">
                TELNET
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                value={telnetPort}
                onChange={(e) => setTelnetPort(parseInt(e.target.value, 10) || 23)}
                placeholder="Port"
                className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-black focus:outline-none focus:border-black"
              />
              <button
                onClick={handleTestTelnet}
                disabled={isTestingTelnet}
                className="flex-1 px-4 py-2 bg-black hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTestingTelnet ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Probing Telnet...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Test Telnet on {sharedHost}:{telnetPort}</span>
                  </>
                )}
              </button>
            </div>

            {onLaunchTerminal && (
              <div className="flex gap-2">
                <button
                  onClick={() => onLaunchTerminal(sharedHost.trim(), telnetPort, 'Telnet')}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Open Telnet Console</span>
                </button>
                <button
                  onClick={() => onLaunchTerminal(sharedHost.trim(), 22, 'SSH')}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-black text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Open SSH Console</span>
                </button>
              </div>
            )}

            {telnetResult ? (
              <div
                className={`p-3.5 rounded-lg border text-xs font-mono ${
                  telnetResult.connected
                    ? 'bg-emerald-50 border-emerald-300 text-black'
                    : 'bg-red-50 border-red-300 text-black'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1.5">
                  <span className={telnetResult.connected ? 'text-emerald-800' : 'text-red-800'}>
                    {telnetResult.connected
                      ? `✓ Connected to ${telnetResult.host}:${telnetResult.port} (${telnetResult.latencyMs} ms)`
                      : `✕ Telnet Failed on ${telnetResult.host}:${telnetResult.port}`}
                  </span>
                  <button
                    onClick={handleTestTelnet}
                    className="text-slate-700 hover:text-black cursor-pointer"
                    title="Retry"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <pre className="text-[11px] text-black whitespace-pre-wrap break-words font-mono bg-white p-2.5 rounded border border-slate-200">
                  {telnetResult.connected
                    ? telnetResult.banner || 'Telnet RFC 854 session ready.'
                    : telnetResult.error || 'Connection timed out or refused.'}
                </pre>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-700 font-mono">
                Test RFC 854 Telnet negotiation &amp; device login banner directly from here.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
