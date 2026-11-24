export type ConnectionState =
  | 'DISCONNECTED'
  | 'RESOLVING'
  | 'CONNECTING_TCP'
  | 'PPTP_HANDSHAKE'
  | 'PPP_LCP'
  | 'AUTHENTICATING'
  | 'IPCP_CONFIG'
  | 'GATEWAY_READY'
  | 'CONNECTED'
  | 'DISCONNECTING'
  | 'ERROR';

export type RoutingMode = 'full' | 'split';
export type VpnProtocol = 'l2tp' | 'sstp' | 'pptp';

export interface VpnProfile {
  id: string;
  name: string;
  protocol?: VpnProtocol; // 'l2tp' (UDP 1701) & 'sstp' (TCP 443) connect LIVE from Web & APK; 'pptp' (TCP 1723) for Android APK / Native OS
  server: string;
  port: number;
  username: string;
  password: string;
  routingMode?: RoutingMode; // 'full' = routes 0.0.0.0/0 (Changes device IP like commercial VPN) | 'split' = routes specific subnets
  remoteSubnets: string[]; // e.g. ["0.0.0.0/0"] for full tunnel, or ["192.168.88.0/24", "10.0.0.0/8"]
  mtu: number;
  mru: number;
  encryption: 'mppe-128' | 'mppe-40' | 'none';
  keepaliveInterval: number; // in seconds
  autoReconnect: boolean;
  dnsServers: string[];
  tags: string[];
  lastConnected?: string;
}

export interface ConnectionStats {
  uptimeSeconds: number;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  rateInKbps: number;
  rateOutKbps: number;
  assignedTunnelIp: string;
  remoteGatewayIp: string;
  activeRoutes: string[];
  greCallId: number;
  rttMs: number;
  packetLossPercent: number;
  virtualPublicIp?: string;
  activeProtocol?: VpnProtocol | null;
  iface?: string;
  dnsIp?: string;
  pptpTunnelConnected: boolean;
  pptpPortVerified: boolean;
  jumpGatewayReady: boolean;
  mikrotikIdentity?: string;
  lastError?: string;
}

export interface NetworkLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'PACKET';
  component: 'CONTROL' | 'PPP' | 'GRE' | 'TUN' | 'ROUTE' | 'SYSTEM';
  message: string;
  rawHex?: string;
}

export interface PortCheckResult {
  host: string;
  port: number;
  status: 'OPEN' | 'CLOSED' | 'FILTERED' | 'ERROR';
  latencyMs: number;
  message?: string;
  serviceName?: string;
}

export interface PingProbeResult {
  host: string;
  resolvedIp?: string;
  port: number;
  method?: 'icmp' | 'tcp';
  transmitted: number;
  received: number;
  packetLossPercent: number;
  stats: {
    min: number;
    avg: number;
    max: number;
    jitter: number;
  };
  probes: {
    seq: number;
    latencyMs: number;
    success: boolean;
    ttl?: number | null;
    message?: string;
  }[];
  timestamp: string;
}

export interface SpeedPingProbe {
  seq: number;
  latencyMs: number;
  success: boolean;
  ttl?: number | null;
  timestamp: string;
}

export interface SpeedPingResult {
  host: string;
  resolvedIp?: string;
  port: number;
  method: 'icmp' | 'tcp';
  transmitted: number;
  received: number;
  packetLossPercent: number;
  durationMs: number;
  packetsPerSec: number;
  stats: {
    min: number;
    avg: number;
    max: number;
    p95: number;
    jitter: number;
  };
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  probes: SpeedPingProbe[];
  timestamp: string;
}

export interface MtrHop {
  hop: number;
  ip: string;
  hostname: string;
  sent: number;
  lossPercent: number;
  lastMs: number;
  avgMs: number;
  bestMs: number;
  worstMs: number;
  stDev: number;
}

export interface TracerouteResult {
  host: string;
  resolvedIp: string;
  method: 'icmp' | 'tcp-fallback';
  reached: boolean;
  note?: string;
  hops: MtrHop[];
  timestamp: string;
}

// 1-Month Free Trial & License System
export interface UserLicense {
  tier: 'free_trial' | 'pro_engineer' | 'enterprise';
  status: 'active' | 'expired' | 'extended';
  trialStartedAt: string;
  trialExpiresAt: string;
  daysRemaining: number;
  planName: string;
  deviceLimit: number;
}

// Admin Panel Records
export interface AdminUserRecord {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'engineer';
  licenseTier: 'free_trial' | 'pro_engineer' | 'enterprise';
  licenseStatus: 'active' | 'expired' | 'extended';
  trialStartedAt: string;
  trialExpiresAt: string;
  daysRemaining: number;
  profilesCount: number;
  createdAt: string;
  updatedAt: string;
}

// Live IP Detection and VPN Change Tracker
export interface IpAuditInfo {
  realPublicIp: string;
  activePublicIp: string;
  country: string;
  city: string;
  isp: string;
  isIpChanged: boolean;
}

export type TerminalVendor =
  | 'MikroTik'
  | 'Cisco'
  | 'Huawei'
  | 'ZTE'
  | 'BDCOM'
  | 'VSOL'
  | 'C-Data'
  | 'Palo Alto'
  | 'Juniper'
  | 'Arista'
  | 'Ruijie'
  | 'TP-Link';

export interface SavedTerminalSession {
  id: string;
  name: string;
  vendor: TerminalVendor;
  protocol: 'Telnet' | 'SSH';
  host: string;
  port: number;
  username: string;
  password: string;
  autoLogin: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedCommandNote {
  id: string;
  title: string;
  vendor: TerminalVendor | 'All';
  category: string;
  commands: string;
  description: string;
  pinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CloudVmOsType =
  | 'ubuntu-chrome-novnc'
  | 'android-redroid'
  | 'kasm-webrtc'
  | 'windows-novnc'
  | 'custom';

export type CloudVmStreamProtocol = 'novnc' | 'webrtc' | 'ws-scrcpy';

export interface CloudVmNode {
  id: string;
  name: string;
  osType: CloudVmOsType;
  streamProtocol: CloudVmStreamProtocol;
  streamUrl: string;
  hostIp: string;
  port: number;
  pptpProfileId?: string;
  resolution?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
