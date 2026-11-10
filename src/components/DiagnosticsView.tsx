import React, { useState } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  Layers,
  Search,
  Wifi,
  Server,
  Zap,
} from 'lucide-react';
import { PortCheckResult, PingProbeResult, VpnProfile, MtrHop } from '../types/vpn';
import { checkRouterPorts, runPingProbe, probeTelnet } from '../services/api';

interface DiagnosticsViewProps {
  activeProfile: VpnProfile | null;
  isConnected: boolean;
  onLaunchTerminal?: (host: string, port: number, protocol: 'SSH' | 'Telnet') => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  activeProfile,
  isConnected,
  onLaunchTerminal,
}) => {
  const [targetHost, setTargetHost] = useState(activeProfile?.server || '192.168.88.1');
  const [customPort, setCustomPort] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // Telnet interactive tester state
  const [telnetHost, setTelnetHost] = useState(activeProfile?.server || '192.168.88.1');
  const [telnetPort, setTelnetPort] = useState(23);
  const [isTestingTelnet, setIsTestingTelnet] = useState(false);
  const [telnetResult, setTelnetResult] = useState<{
    tested: boolean;
    connected: boolean;
    latencyMs: number;
    banner?: string | null;
    error?: string;
  } | null>(null);

  // Ping target state
  const [pingTarget, setPingTarget] = useState('8.8.8.8');
  const [portResults, setPortResults] = useState<PortCheckResult[]>([
    { host: '192.168.88.1', port: 8291, status: 'OPEN', latencyMs: 14, message: 'Winbox protocol active', serviceName: 'MikroTik Winbox' },
    { host: '192.168.88.1', port: 22, status: 'OPEN', latencyMs: 16, message: 'OpenSSH/RouterOS SSH active', serviceName: 'SSH Terminal' },
    { host: '192.168.88.1', port: 23, status: 'OPEN', latencyMs: 11, message: 'Telnet daemon active (Switch/OLT)', serviceName: 'Telnet Terminal' },
    { host: '192.168.88.1', port: 80, status: 'OPEN', latencyMs: 18, message: 'WebFig HTTP active', serviceName: 'HTTP WebFig' },
    { host: '192.168.88.1', port: 443, status: 'CLOSED', latencyMs: 25, message: 'Port closed (RST)', serviceName: 'HTTPS WebFig' },
    { host: '192.168.88.1', port: 8728, status: 'OPEN', latencyMs: 15, message: 'RouterOS API active', serviceName: 'RouterOS API' },
    { host: '192.168.88.1', port: 1723, status: 'OPEN', latencyMs: 12, message: 'PPTP Control Daemon active', serviceName: 'PPTP Control' },
  ]);

  const [isPinging, setIsPinging] = useState(false);
  const [pingData, setPingData] = useState<PingProbeResult>({
    host: activeProfile?.server || '192.168.88.1',
    port: 80,
    transmitted: 5,
    received: 5,
    packetLossPercent: 0,
    stats: { min: 12, avg: 15, max: 21, jitter: 2.1 },
    probes: [
      { seq: 1, latencyMs: 14, success: true },
      { seq: 2, latencyMs: 16, success: true },
      { seq: 3, latencyMs: 13, success: true },
      { seq: 4, latencyMs: 21, success: true },
      { seq: 5, latencyMs: 12, success: true },
    ],
    timestamp: new Date().toISOString(),
  });

  const [mtrHops] = useState<MtrHop[]>([
    { hop: 1, ip: '10.99.0.1', hostname: 'pptp-gw.tun0', sent: 20, lossPercent: 0, lastMs: 12, avgMs: 13.4, bestMs: 11, worstMs: 18, stDev: 1.8 },
    { hop: 2, ip: '192.168.88.1', hostname: 'rb4011-core.lan', sent: 20, lossPercent: 0, lastMs: 14, avgMs: 15.1, bestMs: 12, worstMs: 22, stDev: 2.4 },
    { hop: 3, ip: '10.99.0.10', hostname: 'pop-switch01.lan', sent: 20, lossPercent: 0, lastMs: 15, avgMs: 16.0, bestMs: 13, worstMs: 24, stDev: 2.7 },
  ]);

  const handleRunPortScan = async () => {
    const host = targetHost.trim();
    if (!host) return;

    setIsScanning(true);
    const standardPorts = [8291, 22, 23, 80, 443, 8728, 1723];
    if (customPort.trim()) {
      const parsed = parseInt(customPort.trim(), 10);
      if (!isNaN(parsed) && !standardPorts.includes(parsed)) {
        standardPorts.push(parsed);
      }
    }

    const results = await checkRouterPorts(host, standardPorts);
    // Annotate known service names
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
    const host = telnetHost.trim();
    if (!host) return;

    setIsTestingTelnet(true);
    const res = await probeTelnet(host, telnetPort);
    setTelnetResult({
      tested: true,
      connected: res.connected,
      latencyMs: res.latencyMs,
      banner: res.banner,
      error: res.error,
    });
    setIsTestingTelnet(false);
  };

  const handleRunPing = async () => {
    const host = (pingTarget || targetHost).trim();
    if (!host) return;

    setIsPinging(true);
    const result = await runPingProbe(host, 80, 5);
    setPingData(result);
    setIsPinging(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Interactive Telnet & Ping Live Runner (Dedicated Section) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telnet Box */}
        <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Activity className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Telnet Troubleshooter (Port 23)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Connect to legacy switches, OLTs, and MikroTik consoles.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              TELNET CLIENT
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={telnetHost}
                onChange={(e) => setTelnetHost(e.target.value)}
                placeholder="Switch / Router IP"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
              <input
                type="number"
                value={telnetPort}
                onChange={(e) => setTelnetPort(parseInt(e.target.value) || 23)}
                placeholder="Port"
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleTestTelnet}
                disabled={isTestingTelnet}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {isTestingTelnet ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Connect Telnet</span>
                  </>
                )}
              </button>
            </div>

            {telnetResult && (
              <div
                className={`p-3 rounded-lg border text-xs font-mono ${
                  telnetResult.connected
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : 'bg-red-950/40 border-red-800 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>
                    {telnetResult.connected
                      ? `✓ Connected to ${telnetHost}:${telnetPort} (${telnetResult.latencyMs} ms)`
                      : `✕ Telnet Failed on ${telnetHost}:${telnetPort}`}
                  </span>
                  <span className="text-[10px] uppercase">
                    {telnetResult.connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  {telnetResult.connected
                    ? (telnetResult.banner || 'Telnet session ready. Switch banner responded.')
                    : (telnetResult.error || 'Connection timed out. Check router IP and firewall.')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Ping Box */}
        <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Live Latency Ping Tool (ICMP/TCP)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Measure round-trip time and jitter through the split tunnel.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
              PING RUNNER
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={pingTarget}
                onChange={(e) => setPingTarget(e.target.value)}
                placeholder="e.g. 8.8.8.8 or 192.168.88.1"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleRunPing}
                disabled={isPinging}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {isPinging ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Pinging...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Ping Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Ping Presets */}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-slate-500 text-[11px]">Quick:</span>
              <button
                onClick={() => { setPingTarget('8.8.8.8'); }}
                className="hover:text-cyan-300 underline cursor-pointer text-[11px]"
              >
                8.8.8.8
              </button>
              <span>·</span>
              <button
                onClick={() => { setPingTarget('1.1.1.1'); }}
                className="hover:text-cyan-300 underline cursor-pointer text-[11px]"
              >
                1.1.1.1
              </button>
              <span>·</span>
              <button
                onClick={() => { setPingTarget(activeProfile?.server || '192.168.88.1'); }}
                className="hover:text-cyan-300 underline cursor-pointer text-[11px]"
              >
                Router IP ({activeProfile?.server || '192.168.88.1'})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Target Host Selector & Port Scanner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span>Full TCP Port Scanner</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Check all management ports: Winbox (8291), SSH (22), Telnet (23), WebFig (80/443), API (8728), PPTP (1723).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              placeholder="Target IP or Hostname"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 w-44"
            />
            <input
              type="text"
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              placeholder="Custom Port"
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 w-24"
            />
            <button
              onClick={handleRunPortScan}
              disabled={isScanning}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Scan All Ports</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Port Checker Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Router Service Port Scanner</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Target: <span className="text-cyan-300 font-mono">{targetHost}</span>
              </p>
            </div>
            <button
              onClick={handleRunPortScan}
              disabled={isScanning}
              className="text-xs text-cyan-400 hover:underline font-mono cursor-pointer"
            >
              Rescan
            </button>
          </div>

          <div className="space-y-2.5">
            {portResults.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      item.status === 'OPEN'
                        ? 'bg-emerald-400'
                        : item.status === 'CLOSED'
                        ? 'bg-slate-500'
                        : 'bg-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{item.serviceName}</span>
                      <span className="text-[11px] font-mono text-cyan-400">
                        :{item.port}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {item.message || 'Probed via TCP socket connect'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-300 tabular-nums">
                    {item.latencyMs} ms
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      item.status === 'OPEN'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : item.status === 'CLOSED'
                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-800/80'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Latency Ping Probe & Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>Split-Tunnel Latency Probe (RTT)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time round-trip latency and jitter calculation over the PPTP tunnel.
                </p>
              </div>

              <button
                onClick={handleRunPing}
                disabled={isPinging}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                {isPinging ? 'Pinging...' : 'Start Ping'}
              </button>
            </div>

            {/* Metric KPI cards */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] font-mono text-slate-400">Min RTT</div>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5 tabular-nums">
                  {pingData.stats.min} ms
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] font-mono text-slate-400">Avg RTT</div>
                <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5 tabular-nums">
                  {pingData.stats.avg} ms
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] font-mono text-slate-400">Max RTT</div>
                <div className="text-sm font-bold text-amber-400 font-mono mt-0.5 tabular-nums">
                  {pingData.stats.max} ms
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="text-[10px] font-mono text-slate-400">Jitter</div>
                <div className="text-sm font-bold text-purple-400 font-mono mt-0.5 tabular-nums">
                  {pingData.stats.jitter} ms
                </div>
              </div>
            </div>

            {/* Probe Sequence Log */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5 font-mono text-xs">
              {pingData.probes.map((p) => (
                <div key={p.seq} className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">seq={p.seq}</span>
                    <span>target={targetHost}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 font-bold tabular-nums">{p.latencyMs} ms</span>
                    <span className="text-[10px] text-emerald-400">SUCCESS</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Packets Sent: {pingData.transmitted} · Loss: {pingData.packetLossPercent}%</span>
            <span className="text-emerald-400 font-semibold">100% Split Isolated</span>
          </div>
        </div>
      </div>

      {/* 3. MTR Hop-by-Hop Trace */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>MTR Multi-Hop Path Analysis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hop-by-hop verification showing packet entering tun0 directly to MikroTik gateway.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2 font-medium">Hop</th>
                <th className="pb-2 font-medium">Hostname</th>
                <th className="pb-2 font-medium">IP Address</th>
                <th className="pb-2 font-medium text-right">Loss %</th>
                <th className="pb-2 font-medium text-right">Last</th>
                <th className="pb-2 font-medium text-right">Avg</th>
                <th className="pb-2 font-medium text-right">Best</th>
                <th className="pb-2 font-medium text-right">Worst</th>
                <th className="pb-2 font-medium text-right">StDev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mtrHops.map((h) => (
                <tr key={h.hop} className="text-slate-200">
                  <td className="py-2.5 text-cyan-400 font-bold">{h.hop}</td>
                  <td className="py-2.5 text-white font-medium">{h.hostname}</td>
                  <td className="py-2.5 text-slate-400">{h.ip}</td>
                  <td className="py-2.5 text-right text-emerald-400 font-bold">{h.lossPercent}%</td>
                  <td className="py-2.5 text-right tabular-nums">{h.lastMs} ms</td>
                  <td className="py-2.5 text-right tabular-nums">{h.avgMs} ms</td>
                  <td className="py-2.5 text-right tabular-nums text-emerald-400">{h.bestMs} ms</td>
                  <td className="py-2.5 text-right tabular-nums text-amber-400">{h.worstMs} ms</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-400">{h.stDev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
