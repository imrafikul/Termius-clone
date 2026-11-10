import { VpnProfile } from '../types/vpn';

const STORAGE_KEY_PROFILES = 'pptp_solution_profiles_v1';
const STORAGE_KEY_ACTIVE = 'pptp_solution_active_profile_id';

export const DEFAULT_PROFILES: VpnProfile[] = [
  {
    id: 'prof_rb4011_core',
    name: 'Global Internet VPN · Change Phone IP',
    server: '185.122.90.5',
    port: 1723,
    username: 'vpn_user',
    password: 'PptpSecure2026!',
    routingMode: 'full',
    remoteSubnets: ['0.0.0.0/0'],
    mtu: 1400,
    mru: 1400,
    encryption: 'mppe-128',
    keepaliveInterval: 30,
    autoReconnect: true,
    dnsServers: ['1.1.1.1', '8.8.8.8'],
    tags: ['Full Tunnel', 'Change IP', 'Global VPN'],
    lastConnected: '2026-11-10T07:15:00Z',
  },
  {
    id: 'prof_north_tower',
    name: 'North Tower POP · CCR2004',
    server: '103.45.89.12',
    port: 1723,
    username: 'field_tech',
    password: 'FieldAccess#2026',
    remoteSubnets: ['10.10.40.0/24'],
    mtu: 1400,
    mru: 1400,
    encryption: 'mppe-128',
    keepaliveInterval: 30,
    autoReconnect: true,
    dnsServers: ['10.10.40.1'],
    tags: ['CCR2004', 'Tower Alpha', 'Wireless POP'],
    lastConnected: '2026-11-09T18:42:00Z',
  },
  {
    id: 'prof_branch_office',
    name: 'South Metro Hub · RB750Gr3',
    server: '185.122.90.5',
    port: 1723,
    username: 'metro_eng',
    password: 'MetroPassKey99!',
    remoteSubnets: ['172.16.20.0/24', '172.16.30.0/24'],
    mtu: 1400,
    mru: 1400,
    encryption: 'mppe-128',
    keepaliveInterval: 30,
    autoReconnect: false,
    dnsServers: ['1.1.1.1'],
    tags: ['hEX', 'Fiber Aggregator'],
    lastConnected: '2026-11-08T11:20:00Z',
  },
];

export function getStoredProfiles(): VpnProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (!raw) {
      saveStoredProfiles(DEFAULT_PROFILES);
      return DEFAULT_PROFILES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES;
  } catch (err) {
    return DEFAULT_PROFILES;
  }
}

export function saveStoredProfiles(profiles: VpnProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
  } catch (ignored) {}
}

export function getActiveProfileId(): string {
  try {
    const active = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (active) return active;
  } catch (ignored) {}
  return DEFAULT_PROFILES[0].id;
}

export function setActiveProfileId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE, id);
  } catch (ignored) {}
}
