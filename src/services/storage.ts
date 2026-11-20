import { VpnProfile, SavedTerminalSession, SavedCommandNote } from '../types/vpn';

const STORAGE_KEY_PROFILES = 'pptp_solution_profiles_v1';
const STORAGE_KEY_ACTIVE = 'pptp_solution_active_profile_id';
const STORAGE_KEY_TERMINAL_SESSIONS = 'pptp_solution_terminal_sessions_v1';
const STORAGE_KEY_COMMAND_NOTES = 'pptp_solution_command_notes_v1';

export const DEFAULT_COMMAND_NOTES: SavedCommandNote[] = [
  {
    id: 'note_huawei_gpon_add',
    title: 'Huawei GPON ONU Add + Service-Port',
    vendor: 'Huawei',
    category: 'OLT / ONU',
    commands: `enable
config
interface gpon 0/1
ont add 0 10 sn-auth "48575443AABBCC11" omci ont-lineprofile-id 10 ont-srvprofile-id 10 desc "Client-Name"
ont port native-vlan 0 10 eth 1 vlan 200 priority 0
quit
service-port vlan 200 gpon 0/1/0 ont 10 gemport 1 multi-service user-vlan 200 tag-transform translate
save`,
    description: 'Huawei MA5608T/MA5800-এ নতুন GPON ONU যোগ ও VLAN 200 সার্ভিস পোর্ট তৈরির রেডি স্ক্রিপ্ট।',
    pinned: true,
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  },
  {
    id: 'note_mikrotik_nat_route',
    title: 'MikroTik Default Route + Masquerade NAT',
    vendor: 'MikroTik',
    category: 'Router / IP',
    commands: `/ip route add dst-address=0.0.0.0/0 gateway=103.45.89.1 comment="Upstream-GW"
/ip firewall nat add chain=srcnat out-interface=ether1-WAN action=masquerade comment="ISP-NAT"
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes`,
    description: 'নতুন MikroTik রাউটারে ডিফল্ট গেটওয়ে, NAT এবং DNS এক ক্লিকে সেট করার কমান্ড।',
    pinned: true,
    createdAt: '2026-11-10T08:05:00Z',
    updatedAt: '2026-11-10T08:05:00Z',
  },
  {
    id: 'note_bdcom_epon_bind',
    title: 'BDCOM EPON ONU Bind + VLAN Tag',
    vendor: 'BDCOM',
    category: 'OLT / ONU',
    commands: `enable
config
interface epon 0/1
epon bind-onu mac e067.b311.a401 1
exit
interface epon 0/1:1
epon onu port 1 ctc vlan mode tag 201
exit
write all`,
    description: 'BDCOM P3310/P3616-এ MAC দিয়ে EPON ONU বাইন্ড ও VLAN ট্যাগ করার কমান্ড।',
    pinned: false,
    createdAt: '2026-11-10T08:10:00Z',
    updatedAt: '2026-11-10T08:10:00Z',
  },
  {
    id: 'note_zte_onu_check',
    title: 'ZTE C320 Uncfg ONU & Optical Check',
    vendor: 'ZTE',
    category: 'OLT / ONU',
    commands: `show gpon onu uncfg
show gpon onu state gpon-olt_1/2/1
show pon power onu-rx gpon-olt_1/2/1`,
    description: 'ZTE OLT-এ নতুন অন-কনফিগার্ড ONU খোঁজা এবং অপটিক্যাল Rx পাওয়ার চেক করার কমান্ড।',
    pinned: false,
    createdAt: '2026-11-10T08:15:00Z',
    updatedAt: '2026-11-10T08:15:00Z',
  },
  {
    id: 'note_cisco_arista_trunk',
    title: 'Cisco / Arista 10G Trunk + LACP Uplink',
    vendor: 'Cisco',
    category: 'Switch / VLAN',
    commands: `enable
configure terminal
interface Port-Channel1
 switchport mode trunk
 switchport trunk allowed vlan 100,200,300
exit
interface TenGigabitEthernet1/1/1
 channel-group 1 mode active
 no shutdown
end
write memory`,
    description: 'সুইচে 10G Trunk পোর্ট এবং LACP Port-Channel আপলিংক সেটআপ।',
    pinned: false,
    createdAt: '2026-11-10T08:20:00Z',
    updatedAt: '2026-11-10T08:20:00Z',
  },
];

export const DEFAULT_TERMINAL_SESSIONS: SavedTerminalSession[] = [
  {
    id: 'term_bdcom_olt_1',
    name: 'Core BDCOM OLT',
    vendor: 'BDCOM',
    protocol: 'Telnet',
    host: '192.168.88.2',
    port: 23,
    username: 'admin',
    password: 'admin',
    autoLogin: true,
    createdAt: '2026-11-10T08:00:00Z',
    updatedAt: '2026-11-10T08:00:00Z',
  },
  {
    id: 'term_mikrotik_core_1',
    name: 'MikroTik RB4011 Core',
    vendor: 'MikroTik',
    protocol: 'SSH',
    host: '192.168.88.1',
    port: 22,
    username: 'admin',
    password: '',
    autoLogin: true,
    createdAt: '2026-11-10T08:05:00Z',
    updatedAt: '2026-11-10T08:05:00Z',
  },
];

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

export function getStoredTerminalSessions(): SavedTerminalSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TERMINAL_SESSIONS);
    if (!raw) {
      saveStoredTerminalSessions(DEFAULT_TERMINAL_SESSIONS);
      return DEFAULT_TERMINAL_SESSIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_TERMINAL_SESSIONS;
  } catch {
    return DEFAULT_TERMINAL_SESSIONS;
  }
}

export function saveStoredTerminalSessions(sessions: SavedTerminalSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TERMINAL_SESSIONS, JSON.stringify(sessions));
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

export function getStoredCommandNotes(): SavedCommandNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMAND_NOTES);
    if (!raw) {
      saveStoredCommandNotes(DEFAULT_COMMAND_NOTES);
      return DEFAULT_COMMAND_NOTES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_COMMAND_NOTES;
  } catch {
    return DEFAULT_COMMAND_NOTES;
  }
}

export function saveStoredCommandNotes(notes: SavedCommandNote[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COMMAND_NOTES, JSON.stringify(notes));
  } catch (ignored) {}
}


