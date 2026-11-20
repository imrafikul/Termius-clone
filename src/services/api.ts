import { PortCheckResult, PingProbeResult, SpeedPingResult, TracerouteResult } from '../types/vpn';
import { NativeFileItem } from '../data/nativeFiles';

export async function checkRouterPorts(host: string, ports?: number[]): Promise<PortCheckResult[]> {
  try {
    const res = await fetch('/api/diagnostics/port-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, ports, timeoutMs: 3000 }),
    });
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.results || [];
  } catch (err: any) {
    // Client-side fallback if server offline
    const fallbackPorts = ports || [8291, 22, 23, 80, 443, 8728, 1723];
    return fallbackPorts.map((port) => ({
      host,
      port,
      status: 'FILTERED' as const,
      latencyMs: 3000,
      message: `Offline probe (${err.message})`,
    }));
  }
}

export interface JumpGatewayConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
}

export function isPrivateIp(host: string): boolean {
  const h = host.trim();
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(h)
  );
}

export interface PptpProbeResult {
  reachable: boolean;
  pptpVerified: boolean;
  pptpTunnelConnected: boolean;
  resultCode?: number;
  mikrotikHostName?: string;
  mikrotikVendor?: string;
  latencyMs: number;
  greSupportedInCloud: boolean;
  jumpTelnetOpen: boolean;
  jumpTelnetLatencyMs?: number;
  jumpLoginVerified: boolean;
  jumpIdentity?: string;
  jumpLoginError?: string;
  error?: string;
  explanation?: string;
}

export async function probePptpServer(
  host: string,
  port = 1723,
  username?: string,
  password?: string
): Promise<PptpProbeResult> {
  const res = await fetch('/api/pptp/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, username, password }),
  });
  return res.json();
}

export async function fetchRealClientIp(): Promise<{
  ip: string;
  pptpTunnelActive: boolean;
  greSupportedInCloud: boolean;
}> {
  const res = await fetch('/api/network/my-ip');
  if (!res.ok) {
    return { ip: 'Unavailable', pptpTunnelActive: false, greSupportedInCloud: false };
  }
  return res.json();
}

export interface RealVpnStatusResponse {
  connected?: boolean;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  protocol: 'pptp' | 'l2tp' | 'sstp' | null;
  host: string;
  port: number;
  username: string;
  clientIp: string;
  gatewayIp: string;
  dnsIp: string;
  iface: string;
  routes: string[];
  uptimeSeconds: number;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  error?: string | null;
  logs?: { timestamp: string; component: string; level: string; message: string }[];
}

export async function fetchSystemRuntime(): Promise<{
  platform: string;
  nativePptpSupported: boolean;
  standalone: boolean;
}> {
  try {
    const res = await fetch('/api/system/runtime');
    if (res.ok) return res.json();
  } catch {}
  return { platform: 'linux', nativePptpSupported: false, standalone: false };
}

export async function connectRealVpnTunnel(params: {
  protocol: 'pptp' | 'l2tp' | 'sstp';
  host: string;
  port?: number;
  username: string;
  password: string;
  subnets?: string[];
}): Promise<RealVpnStatusResponse> {
  const res = await fetch('/api/vpn/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return {
    ...data,
    connected: Boolean(data.connected && res.ok),
    status: data.connected && res.ok ? 'CONNECTED' : 'ERROR',
  };
}

export async function disconnectRealVpnTunnel(): Promise<void> {
  await fetch('/api/vpn/disconnect', { method: 'POST' });
}

export async function getRealVpnStatus(): Promise<RealVpnStatusResponse> {
  const res = await fetch('/api/vpn/status');
  return res.json();
}

export async function runPingProbe(
  host: string,
  port = 80,
  count = 5,
  mode: 'auto' | 'icmp' | 'tcp' = 'auto',
  jumpGateway?: JumpGatewayConfig
): Promise<PingProbeResult> {
  const res = await fetch('/api/diagnostics/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, count, mode, jumpGateway }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server returned HTTP ${res.status}`);
  }
  return data;
}

export async function runSpeedPing(
  host: string,
  options: { count?: number; intervalMs?: number; port?: number; mode?: 'auto' | 'icmp' | 'tcp' } = {}
): Promise<SpeedPingResult> {
  const { count = 20, intervalMs = 100, port = 80, mode = 'auto' } = options;
  const res = await fetch('/api/diagnostics/speed-ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, count, intervalMs, port, mode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server returned HTTP ${res.status}`);
  }
  return data;
}

export async function runTraceroute(
  host: string,
  maxHops = 16,
  timeoutSec = 1
): Promise<TracerouteResult> {
  const res = await fetch('/api/diagnostics/traceroute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, maxHops, timeoutSec }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Server returned HTTP ${res.status}`);
  }
  return data;
}

export async function generateMikrotikScript(params: any): Promise<string> {
  try {
    const res = await fetch('/api/mikrotik/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.script;
  } catch (err) {
    return `# Fallback MikroTik RouterOS Script
/interface pptp-server server set enabled=yes
/ppp profile add name=pptp-split local-address=10.99.0.1 remote-address=10.99.0.2
`;
  }
}

export async function fetchNativeFiles(): Promise<NativeFileItem[]> {
  try {
    const res = await fetch('/api/native-files');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.files) && data.files.length > 0) {
        return data.files;
      }
    }
  } catch (ignored) {}

  const { NATIVE_FILES } = await import('../data/nativeFiles');
  return NATIVE_FILES;
}

export async function probeTelnet(host: string, port = 23): Promise<{
  host: string;
  port: number;
  connected: boolean;
  latencyMs: number;
  error?: string;
  banner?: string | null;
}> {
  try {
    const res = await fetch('/api/diagnostics/telnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      host,
      port,
      connected: false,
      latencyMs: 3000,
      error: err.message,
      banner: null,
    };
  }
}

export function downloadProjectZipDirect(): void {
  // Direct server attachment download that bypasses iframe blob restrictions
  const link = document.createElement('a');
  link.href = '/api/download-zip';
  link.setAttribute('download', 'pptp_solution_android_flutter.zip');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

