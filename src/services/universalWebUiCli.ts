import { TerminalVendor } from '../types/vpn';

export type DeviceCategory = 'OLT' | 'Router / Firewall' | 'Switch';

export interface WebUiInterface {
  id: string;
  name: string;
  type: 'Ethernet' | 'SFP+' | 'PON' | 'VLAN/IRB' | 'Loopback';
  ip: string;
  maskOrCidr: string;
  vlan?: string;
  speed: string;
  adminUp: boolean;
  linkUp: boolean;
  desc: string;
}

export interface WebUiVlan {
  id: string;
  vlanId: number;
  name: string;
  taggedPorts: string;
  untaggedPorts: string;
}

export interface WebUiRoute {
  id: string;
  destination: string;
  mask: string;
  cidr: number;
  gateway: string;
  comment: string;
}

export interface WebUiOnu {
  id: string;
  port: string;
  onuId: number;
  mode: 'GPON' | 'EPON';
  snOrMac: string;
  desc: string;
  vlan: number;
  lineProfile: number;
  srvProfile: number;
  rxDbm: number;
  status: 'online' | 'los' | 'offline';
}

export interface WebUiPolicyOrPpp {
  id: string;
  kind: 'ppp' | 'firewall';
  name: string;
  srcOrUser: string;
  dstOrProfile: string;
  actionOrService: string;
  enabled: boolean;
  comment: string;
}

export interface WebUiSwitchPort {
  id: string;
  portName: string;
  mode: 'access' | 'trunk';
  accessVlan: number;
  allowedVlans: string;
  nativeVlan: number;
  stpEdge: boolean;
  bpduGuard: boolean;
  lagGroup?: number;
}

export interface WebUiLagBundle {
  id: string;
  lagId: number;
  mode: 'lacp-active' | 'static-on';
  members: string;
  allowedVlans: string;
  desc: string;
}

export interface WebUiBgpPeer {
  id: string;
  localAsn: number;
  routerId: string;
  peerIp: string;
  remoteAsn: number;
  desc: string;
  advertisePrefix: string;
}

export interface WebUiOspfEntry {
  id: string;
  processId: number;
  area: string;
  networkCidr: string;
  passiveInterface: string;
}

export interface WebUiDevicePreset {
  brand: TerminalVendor;
  category: DeviceCategory;
  webUiTitle: string;
  models: string[];
  defaultModel: string;
  osLabel: string;
  hostname: string;
  mgmtIp: string;
  defaultUser: string;
  defaultPass: string;
  isOlt: boolean;
  supportsSwitchL2: boolean;
  supportsDynamicRouting: boolean;
  interfaces: WebUiInterface[];
  vlans: WebUiVlan[];
  routes: WebUiRoute[];
  onus: WebUiOnu[];
  policies: WebUiPolicyOrPpp[];
  switchPorts: WebUiSwitchPort[];
  lags: WebUiLagBundle[];
  bgpPeers: WebUiBgpPeer[];
  ospfEntries: WebUiOspfEntry[];
}

export function cidrToMask(cidr: number): string {
  const c = Math.max(0, Math.min(32, Math.floor(cidr)));
  const mask = c === 0 ? 0 : (~0 << (32 - c)) >>> 0;
  return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join('.');
}

export function maskToCidr(mask: string): number {
  if (/^\d{1,2}$/.test(mask.trim())) return Math.max(0, Math.min(32, parseInt(mask.trim(), 10)));
  const parts = mask.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return 24;
  return parts
    .map((p) => p.toString(2))
    .join('')
    .replace(/0/g, '').length;
}

export function cidrToWildcard(cidr: number): string {
  const m = cidrToMask(cidr).split('.').map((n) => 255 - parseInt(n, 10));
  return m.join('.');
}

export const INITIAL_WEBUI_PRESETS: Record<TerminalVendor, WebUiDevicePreset> = {
  MikroTik: {
    brand: 'MikroTik',
    category: 'Router / Firewall',
    webUiTitle: 'MikroTik WebFig / RouterOS WebUI',
    models: ['CCR2004-1G-12S+2XS (ROS v7)', 'CCR2116-12G-4S+ (ROS v7)', 'RB4011iGS+ (ROS v7)', 'CRS326-24G-2S+ Switch (ROS v7)', 'CCR1036-8G-2S+ (ROS v6)'],
    defaultModel: 'CCR2004-1G-12S+2XS (ROS v7)',
    osLabel: 'RouterOS v7.15',
    hostname: 'MikroTik-Core-CCR',
    mgmtIp: '192.168.88.1',
    defaultUser: 'admin',
    defaultPass: '',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'mt_1', name: 'ether1-WAN', type: 'Ethernet', ip: '103.45.89.12', maskOrCidr: '/28', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Upstream Transit' },
      { id: 'mt_2', name: 'sfp-sfpplus1', type: 'SFP+', ip: '10.99.0.1', maskOrCidr: '/24', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'Downlink to OLT Core' },
      { id: 'mt_3', name: 'bridge-lan', type: 'VLAN/IRB', ip: '192.168.88.1', maskOrCidr: '/24', vlan: '1', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'NOC Management LAN' },
      { id: 'mt_4', name: 'vlan100-olt', type: 'VLAN/IRB', ip: '10.100.0.1', maskOrCidr: '/24', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'OLT Mgmt VLAN' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'vlan100-mgmt', taggedPorts: 'sfp-sfpplus1', untaggedPorts: 'ether2' },
      { id: 'v2', vlanId: 200, name: 'vlan200-pppoe', taggedPorts: 'sfp-sfpplus1', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '103.45.89.1', comment: 'Default Upstream Gateway' },
      { id: 'r2', destination: '172.16.0.0', mask: '255.255.0.0', cidr: 16, gateway: '10.99.0.2', comment: 'POP Distribution' },
    ],
    onus: [],
    policies: [
      { id: 'p1', kind: 'ppp', name: 'noc_admin', srcOrUser: 'noc_admin', dstOrProfile: 'pptp-split-profile', actionOrService: 'pptp', enabled: true, comment: 'ISP Field Admin VPN' },
      { id: 'p2', kind: 'ppp', name: 'client_pppoe_01', srcOrUser: 'rafikul_50mb', dstOrProfile: '50Mbps-Pkg', actionOrService: 'pppoe', enabled: true, comment: 'Home Broadband' },
      { id: 'p3', kind: 'firewall', name: 'NAT-Masquerade', srcOrUser: '192.168.88.0/24', dstOrProfile: 'ether1-WAN', actionOrService: 'masquerade', enabled: true, comment: 'LAN Internet NAT' },
    ],
    switchPorts: [
      { id: 'sp_mt1', portName: 'sfp-sfpplus1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,200,300', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_mt2', portName: 'ether2', mode: 'access', accessVlan: 100, allowedVlans: '100', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_mt1', lagId: 1, mode: 'lacp-active', members: 'sfp-sfpplus1,sfp-sfpplus2', allowedVlans: '100,200', desc: '20G LACP to Core Switch' },
    ],
    bgpPeers: [
      { id: 'bgp_mt1', localAsn: 139900, routerId: '103.45.89.12', peerIp: '103.45.89.1', remoteAsn: 45276, desc: 'IIG-Upstream-1', advertisePrefix: '103.145.88.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_mt1', processId: 1, area: '0.0.0.0', networkCidr: '10.99.0.0/24', passiveInterface: 'bridge-lan' },
    ],
  },

  Huawei: {
    brand: 'Huawei',
    category: 'OLT',
    webUiTitle: 'Huawei SmartAX OLT & VRP Switch/Router WebUI',
    models: ['MA5608T (GPON/EPON OLT)', 'MA5683T (GPON OLT)', 'MA5800-X7 (XGS/GPON OLT)', 'CloudEngine S5735 Switch', 'NetEngine NE40E (VRP v8)'],
    defaultModel: 'MA5608T (GPON/EPON OLT)',
    osLabel: 'MA5600V800R018C10',
    hostname: 'HUAWEI-MA5608T-01',
    mgmtIp: '10.99.0.10',
    defaultUser: 'root',
    defaultPass: 'admin',
    isOlt: true,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'hw_1', name: 'vlanif 100', type: 'VLAN/IRB', ip: '10.99.0.10', maskOrCidr: '255.255.255.0', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'OLT In-Band Management' },
      { id: 'hw_2', name: 'eth 0/9/0', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G Uplink to MikroTik' },
      { id: 'hw_3', name: 'gpon 0/1/0', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G/1.25G', adminUp: true, linkUp: true, desc: 'Zone-A GPON Feeder' },
      { id: 'hw_4', name: 'epon 0/3/0', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '1.25G', adminUp: true, linkUp: true, desc: 'Zone-B EPON Feeder' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'OLT-MGMT', taggedPorts: '0/9 0', untaggedPorts: '' },
      { id: 'v2', vlanId: 200, name: 'PPPOE-USERS', taggedPorts: '0/9 0', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
      { id: 'r2', destination: '192.168.88.0', mask: '255.255.255.0', cidr: 24, gateway: '10.99.0.1', comment: 'NOC Subnet' },
    ],
    onus: [
      { id: 'o1', port: '0/1/0', onuId: 0, mode: 'GPON', snOrMac: '48575443A1B2C301', desc: 'Rafikul-Home', vlan: 200, lineProfile: 10, srvProfile: 10, rxDbm: -18.4, status: 'online' },
      { id: 'o2', port: '0/1/0', onuId: 1, mode: 'GPON', snOrMac: '485754439F8E7712', desc: 'Corporate-Link', vlan: 200, lineProfile: 20, srvProfile: 20, rxDbm: -20.2, status: 'online' },
      { id: 'o3', port: '0/3/0', onuId: 0, mode: 'EPON', snOrMac: 'e067-b311-a401', desc: 'EPON-Client-01', vlan: 200, lineProfile: 15, srvProfile: 15, rxDbm: -26.4, status: 'online' },
    ],
    policies: [],
    switchPorts: [
      { id: 'sp_hw1', portName: 'XGigabitEthernet0/0/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100 200 300', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_hw2', portName: 'GigabitEthernet0/0/2', mode: 'access', accessVlan: 100, allowedVlans: '100', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_hw1', lagId: 1, mode: 'lacp-active', members: '0/9/0,0/9/1', allowedVlans: '100 200', desc: 'Eth-Trunk1 Uplink' },
    ],
    bgpPeers: [
      { id: 'bgp_hw1', localAsn: 65100, routerId: '10.99.0.10', peerIp: '10.99.0.1', remoteAsn: 139900, desc: 'Core-BGP', advertisePrefix: '10.100.0.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_hw1', processId: 1, area: '0.0.0.0', networkCidr: '10.99.0.0/24', passiveInterface: 'vlanif 100' },
    ],
  },

  ZTE: {
    brand: 'ZTE',
    category: 'OLT',
    webUiTitle: 'ZTE ZXA10 C300 / C320 / C600 GPON OLT WebUI',
    models: ['ZXA10 C320 (Compact GPON)', 'ZXA10 C300 (Large Chassis)', 'ZXA10 C600 (Titan XGS/GPON)', 'ZXR10 5950 L3 Switch'],
    defaultModel: 'ZXA10 C320 (Compact GPON)',
    osLabel: 'ZTE ROSNG v2.1.0',
    hostname: 'ZTE-C320-POP2',
    mgmtIp: '10.99.0.15',
    defaultUser: 'zte',
    defaultPass: 'zte',
    isOlt: true,
    supportsSwitchL2: true,
    supportsDynamicRouting: false,
    interfaces: [
      { id: 'zt_1', name: 'vlan 100', type: 'VLAN/IRB', ip: '10.99.0.15', maskOrCidr: '255.255.255.0', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'ZTE Mgmt SVI' },
      { id: 'zt_2', name: 'xgei_1/3/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G SFP+ Uplink' },
      { id: 'zt_3', name: 'gpon-olt_1/2/1', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G/1.25G', adminUp: true, linkUp: true, desc: 'GTGO Slot 2 PON 1' },
      { id: 'zt_4', name: 'gpon-olt_1/2/2', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G/1.25G', adminUp: true, linkUp: true, desc: 'GTGO Slot 2 PON 2' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT-VLAN', taggedPorts: 'xgei_1/3/1', untaggedPorts: '' },
      { id: 'v2', vlanId: 250, name: 'GPON-PPPOE', taggedPorts: 'xgei_1/3/1', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Core Gateway' },
    ],
    onus: [
      { id: 'zo1', port: '1/2/1', onuId: 1, mode: 'GPON', snOrMac: 'ZTEGC12345A1', desc: 'ZTE-Fiber-Client01', vlan: 250, lineProfile: 1, srvProfile: 1, rxDbm: -19.1, status: 'online' },
      { id: 'zo2', port: '1/2/1', onuId: 2, mode: 'GPON', snOrMac: 'ZTEGC98765B4', desc: 'Office-Dedicated', vlan: 250, lineProfile: 2, srvProfile: 2, rxDbm: -21.8, status: 'online' },
      { id: 'zo3', port: '1/2/2', onuId: 1, mode: 'GPON', snOrMac: 'HWTC4411AA09', desc: 'North-Zone-ONU', vlan: 250, lineProfile: 1, srvProfile: 1, rxDbm: -28.9, status: 'los' },
    ],
    policies: [],
    switchPorts: [
      { id: 'sp_zt1', portName: 'xgei_1/3/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,250', nativeVlan: 1, stpEdge: false, bpduGuard: false },
    ],
    lags: [
      { id: 'lag_zt1', lagId: 1, mode: 'lacp-active', members: 'xgei_1/3/1,xgei_1/3/2', allowedVlans: '100,250', desc: 'SmartGroup1 Uplink' },
    ],
    bgpPeers: [],
    ospfEntries: [],
  },

  BDCOM: {
    brand: 'BDCOM',
    category: 'OLT',
    webUiTitle: 'BDCOM OLT & Switch WebUI',
    models: ['BDCOM P3310D (4P EPON)', 'BDCOM P3616-2TE (16P EPON)', 'BDCOM GP3600-08 (GPON)', 'BDCOM S2928E Managed Switch'],
    defaultModel: 'BDCOM P3310D (4P EPON)',
    osLabel: 'BDCOM OS v10.1.0F',
    hostname: 'BDCOM-OLT-POP1',
    mgmtIp: '10.99.0.20',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: true,
    supportsSwitchL2: true,
    supportsDynamicRouting: false,
    interfaces: [
      { id: 'bd_1', name: 'VLAN 100', type: 'VLAN/IRB', ip: '10.99.0.20', maskOrCidr: '255.255.255.0', vlan: '100', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Management SVI' },
      { id: 'bd_2', name: 'tgigaEthernet 0/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G Trunk Uplink' },
      { id: 'bd_3', name: 'epon 0/1', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '1.25G', adminUp: true, linkUp: true, desc: 'EPON Port 1' },
      { id: 'bd_4', name: 'epon 0/2', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '1.25G', adminUp: true, linkUp: true, desc: 'EPON Port 2' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT', taggedPorts: 'tgigaEthernet 0/1', untaggedPorts: '' },
      { id: 'v2', vlanId: 201, name: 'PON1-PPPOE', taggedPorts: 'tgigaEthernet 0/1', untaggedPorts: 'epon 0/1' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
    ],
    onus: [
      { id: 'bo1', port: '0/1', onuId: 1, mode: 'EPON', snOrMac: 'e067.b311.a401', desc: 'Bazar-Client-01', vlan: 201, lineProfile: 1, srvProfile: 1, rxDbm: -19.5, status: 'online' },
      { id: 'bo2', port: '0/1', onuId: 2, mode: 'EPON', snOrMac: 'f492.bf22.10c8', desc: 'School-Link', vlan: 201, lineProfile: 1, srvProfile: 1, rxDbm: -24.8, status: 'online' },
      { id: 'bo3', port: '0/2', onuId: 1, mode: 'EPON', snOrMac: '8479.731a.cc02', desc: 'Tower-Backhaul', vlan: 201, lineProfile: 1, srvProfile: 1, rxDbm: -29.8, status: 'los' },
    ],
    policies: [],
    switchPorts: [
      { id: 'sp_bd1', portName: 'tgigaEthernet 0/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,201-204', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_bd2', portName: 'gigaEthernet 0/2', mode: 'access', accessVlan: 100, allowedVlans: '100', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_bd1', lagId: 1, mode: 'lacp-active', members: 'tgigaEthernet 0/1,tgigaEthernet 0/2', allowedVlans: '100,201', desc: 'Port-Aggregator 1' },
    ],
    bgpPeers: [],
    ospfEntries: [],
  },

  VSOL: {
    brand: 'VSOL',
    category: 'OLT',
    webUiTitle: 'VSOL EPON / GPON OLT WebUI',
    models: ['VSOL V1600G1 (8P GPON)', 'VSOL V1600G2 (16P GPON)', 'VSOL V1600D4 (4P EPON)', 'VSOL V1600D8 (8P EPON)'],
    defaultModel: 'VSOL V1600G1 (8P GPON)',
    osLabel: 'VSOL Firmware v2.03.65',
    hostname: 'VSOL-GPON-OLT',
    mgmtIp: '10.99.0.30',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: true,
    supportsSwitchL2: true,
    supportsDynamicRouting: false,
    interfaces: [
      { id: 'vs_1', name: 'vlan 100', type: 'VLAN/IRB', ip: '10.99.0.30', maskOrCidr: '255.255.255.0', vlan: '100', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'OLT Mgmt Interface' },
      { id: 'vs_2', name: 'xge 0/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G SFP+ Uplink' },
      { id: 'vs_3', name: 'gpon 0/1', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G', adminUp: true, linkUp: true, desc: 'GPON PON 1' },
      { id: 'vs_4', name: 'gpon 0/2', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G', adminUp: true, linkUp: true, desc: 'GPON PON 2' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT-VLAN', taggedPorts: 'xge 0/1', untaggedPorts: '' },
      { id: 'v2', vlanId: 300, name: 'FTTH-INTERNET', taggedPorts: 'xge 0/1', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Core Gateway' },
    ],
    onus: [
      { id: 'vo1', port: '0/1', onuId: 1, mode: 'GPON', snOrMac: '56534F4C8812AB34', desc: 'VSOL-User-101', vlan: 300, lineProfile: 1, srvProfile: 1, rxDbm: -17.9, status: 'online' },
      { id: 'vo2', port: '0/2', onuId: 1, mode: 'GPON', snOrMac: '56534F4C7799DE11', desc: 'VSOL-User-204', vlan: 300, lineProfile: 1, srvProfile: 1, rxDbm: -21.3, status: 'online' },
    ],
    policies: [],
    switchPorts: [
      { id: 'sp_vs1', portName: 'xge 0/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,300', nativeVlan: 1, stpEdge: false, bpduGuard: false },
    ],
    lags: [],
    bgpPeers: [],
    ospfEntries: [],
  },

  'C-Data': {
    brand: 'C-Data',
    category: 'OLT',
    webUiTitle: 'C-Data FD1608S / FD1616S GPON & EPON OLT WebUI',
    models: ['FD1608S-B0 (8P GPON)', 'FD1616S-B0 (16P GPON)', 'FD1208S-R2 (8P EPON)', 'FD1104SN (4P EPON)'],
    defaultModel: 'FD1608S-B0 (8P GPON)',
    osLabel: 'C-Data OS v2.4.12',
    hostname: 'CDATA-FD1608S-01',
    mgmtIp: '10.99.0.35',
    defaultUser: 'root',
    defaultPass: 'admin',
    isOlt: true,
    supportsSwitchL2: true,
    supportsDynamicRouting: false,
    interfaces: [
      { id: 'cd_1', name: 'vlanif 100', type: 'VLAN/IRB', ip: '10.99.0.35', maskOrCidr: '255.255.255.0', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'C-Data Mgmt VLANIF' },
      { id: 'cd_2', name: 'xge 0/0/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G SFP+ Uplink' },
      { id: 'cd_3', name: 'gpon 0/0/1', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G/1.25G', adminUp: true, linkUp: true, desc: 'PON Port 1' },
      { id: 'cd_4', name: 'gpon 0/0/2', type: 'PON', ip: 'unassigned', maskOrCidr: '', speed: '2.5G/1.25G', adminUp: true, linkUp: true, desc: 'PON Port 2' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT', taggedPorts: 'xge 0/0/1', untaggedPorts: '' },
      { id: 'v2', vlanId: 350, name: 'CDATA-FTTH', taggedPorts: 'xge 0/0/1', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
    ],
    onus: [
      { id: 'co1', port: '0/0/1', onuId: 1, mode: 'GPON', snOrMac: 'CDAT12348899', desc: 'CData-Home-01', vlan: 350, lineProfile: 1, srvProfile: 1, rxDbm: -18.7, status: 'online' },
      { id: 'co2', port: '0/0/2', onuId: 1, mode: 'GPON', snOrMac: 'CDAT7788AA22', desc: 'CData-Shop-02', vlan: 350, lineProfile: 1, srvProfile: 1, rxDbm: -23.1, status: 'online' },
    ],
    policies: [],
    switchPorts: [
      { id: 'sp_cd1', portName: 'xge 0/0/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,350', nativeVlan: 1, stpEdge: false, bpduGuard: false },
    ],
    lags: [],
    bgpPeers: [],
    ospfEntries: [],
  },

  Cisco: {
    brand: 'Cisco',
    category: 'Router / Firewall',
    webUiTitle: 'Cisco Catalyst / ISR / Nexus IOS-XE WebUI',
    models: ['Catalyst 9200L / 3560 Switch (IOS-XE)', 'ISR 4331 Router (IOS-XE)', 'ASR 1001-X Core Router', 'Nexus 93180YC (NX-OS)'],
    defaultModel: 'Catalyst 9200L / 3560 Switch (IOS-XE)',
    osLabel: 'Cisco IOS-XE 17.9.4a',
    hostname: 'CISCO-CORE-SW01',
    mgmtIp: '192.168.88.2',
    defaultUser: 'admin',
    defaultPass: 'cisco',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'ci_1', name: 'GigabitEthernet0/1', type: 'Ethernet', ip: '10.99.0.2', maskOrCidr: '255.255.255.252', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'P2P to Core Router' },
      { id: 'ci_2', name: 'TenGigabitEthernet1/1/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'Trunk to Distribution' },
      { id: 'ci_3', name: 'Vlan100', type: 'VLAN/IRB', ip: '192.168.88.2', maskOrCidr: '255.255.255.0', vlan: '100', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Management SVI' },
      { id: 'ci_4', name: 'Loopback0', type: 'Loopback', ip: '10.255.0.2', maskOrCidr: '255.255.255.255', speed: 'Virtual', adminUp: true, linkUp: true, desc: 'OSPF/BGP Router-ID' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT-NOC', taggedPorts: 'Te1/1/1', untaggedPorts: 'Gi0/2' },
      { id: 'v2', vlanId: 200, name: 'SERVERS', taggedPorts: 'Te1/1/1', untaggedPorts: 'Gi0/3-12' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Route' },
    ],
    onus: [],
    policies: [
      { id: 'cp1', kind: 'firewall', name: 'ACL-MGMT-ALLOW', srcOrUser: '192.168.88.0/24', dstOrProfile: 'any', actionOrService: 'permit ip', enabled: true, comment: 'Allow NOC SSH/Telnet' },
    ],
    switchPorts: [
      { id: 'sp_ci1', portName: 'TenGigabitEthernet1/1/1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,200,300', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_ci2', portName: 'GigabitEthernet0/2', mode: 'access', accessVlan: 100, allowedVlans: '100', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_ci1', lagId: 1, mode: 'lacp-active', members: 'TenGigabitEthernet1/1/1-2', allowedVlans: '100,200', desc: 'Po1 Core Uplink' },
    ],
    bgpPeers: [
      { id: 'bgp_ci1', localAsn: 65001, routerId: '10.255.0.2', peerIp: '10.99.0.1', remoteAsn: 139900, desc: 'MikroTik-Core', advertisePrefix: '192.168.88.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_ci1', processId: 1, area: '0', networkCidr: '10.99.0.0/24', passiveInterface: 'Vlan100' },
    ],
  },

  'Palo Alto': {
    brand: 'Palo Alto',
    category: 'Router / Firewall',
    webUiTitle: 'Palo Alto PAN-OS NGFW WebUI',
    models: ['PA-440 (PAN-OS 11.1)', 'PA-820 (PAN-OS 10.2)', 'PA-3220 (PAN-OS 11.0)', 'PA-5220 (PAN-OS 11.1)'],
    defaultModel: 'PA-440 (PAN-OS 11.1)',
    osLabel: 'PAN-OS 11.1.2-h3',
    hostname: 'PA-EDGE-FW01',
    mgmtIp: '192.168.88.254',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: false,
    supportsSwitchL2: false,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'pa_1', name: 'ethernet1/1', type: 'Ethernet', ip: '103.45.89.14', maskOrCidr: '/28', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'UNTRUST-WAN' },
      { id: 'pa_2', name: 'ethernet1/2', type: 'Ethernet', ip: '192.168.88.254', maskOrCidr: '/24', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'TRUST-LAN' },
      { id: 'pa_3', name: 'ethernet1/3', type: 'Ethernet', ip: '10.50.0.1', maskOrCidr: '/24', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'DMZ-SERVERS' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'TRUST-VLAN100', taggedPorts: 'ethernet1/2.100', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '103.45.89.1', comment: 'Default VR Route' },
    ],
    onus: [],
    policies: [
      { id: 'pp1', kind: 'firewall', name: 'Allow-Trust-Internet', srcOrUser: 'TRUST', dstOrProfile: 'UNTRUST', actionOrService: 'allow', enabled: true, comment: 'Outbound Internet Access' },
      { id: 'pp2', kind: 'firewall', name: 'Allow-NOC-Mgmt', srcOrUser: '192.168.88.0/24', dstOrProfile: 'DMZ', actionOrService: 'allow', enabled: true, comment: 'NOC Monitoring' },
    ],
    switchPorts: [],
    lags: [],
    bgpPeers: [
      { id: 'bgp_pa1', localAsn: 65050, routerId: '103.45.89.14', peerIp: '103.45.89.1', remoteAsn: 45276, desc: 'WAN-Upstream', advertisePrefix: '10.50.0.0/24' },
    ],
    ospfEntries: [],
  },

  Juniper: {
    brand: 'Juniper',
    category: 'Router / Firewall',
    webUiTitle: 'Juniper Junos OS / J-Web Interface',
    models: ['MX204 Core Router (Junos 23.2)', 'MX480 Edge Router', 'EX4300 / QFX5120 Switch', 'SRX300 / SRX1500 Firewall'],
    defaultModel: 'MX204 Core Router (Junos 23.2)',
    osLabel: 'Junos OS 23.2R1.13',
    hostname: 'JUNIPER-MX204-CORE',
    mgmtIp: '10.99.0.5',
    defaultUser: 'root',
    defaultPass: '',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'jn_1', name: 'et-0/0/0', type: 'SFP+', ip: '103.45.89.2', maskOrCidr: '/30', speed: '100Gbps', adminUp: true, linkUp: true, desc: 'IIG Upstream BGP' },
      { id: 'jn_2', name: 'xe-0/1/0', type: 'SFP+', ip: '10.99.0.5', maskOrCidr: '/24', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'Core Aggregation' },
      { id: 'jn_3', name: 'irb.100', type: 'VLAN/IRB', ip: '192.168.100.1', maskOrCidr: '/24', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'VLAN 100 Gateway' },
      { id: 'jn_4', name: 'lo0', type: 'Loopback', ip: '10.255.0.5', maskOrCidr: '/32', speed: 'Virtual', adminUp: true, linkUp: true, desc: 'BGP/OSPF Router-ID' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'VLAN100-MGMT', taggedPorts: 'xe-0/1/0', untaggedPorts: '' },
      { id: 'v2', vlanId: 200, name: 'VLAN200-CLIENTS', taggedPorts: 'xe-0/1/0', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '103.45.89.1', comment: 'Default Transit Next-Hop' },
    ],
    onus: [],
    policies: [
      { id: 'jp1', kind: 'firewall', name: 'PROTECT-RE-NOC', srcOrUser: '192.168.88.0/24', dstOrProfile: 'lo0.0', actionOrService: 'accept', enabled: true, comment: 'Allow NOC SSH/Telnet/SNMP' },
    ],
    switchPorts: [
      { id: 'sp_jn1', portName: 'xe-0/1/0', mode: 'trunk', accessVlan: 1, allowedVlans: 'VLAN100-MGMT VLAN200-CLIENTS', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_jn2', portName: 'ge-0/0/1', mode: 'access', accessVlan: 100, allowedVlans: 'VLAN100-MGMT', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_jn1', lagId: 0, mode: 'lacp-active', members: 'xe-0/1/0,xe-0/1/1', allowedVlans: 'all', desc: 'ae0 Core Bundle' },
    ],
    bgpPeers: [
      { id: 'bgp_jn1', localAsn: 139900, routerId: '10.255.0.5', peerIp: '103.45.89.1', remoteAsn: 45276, desc: 'IIG-BGP-TRANSIT', advertisePrefix: '103.145.88.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_jn1', processId: 0, area: '0.0.0.0', networkCidr: '10.99.0.0/24', passiveInterface: 'lo0.0' },
    ],
  },

  Arista: {
    brand: 'Arista',
    category: 'Switch',
    webUiTitle: 'Arista EOS Core / Leaf Switch WebUI',
    models: ['DCS-7050SX3-48YC8 (EOS 4.30)', 'DCS-7280R3-48YC6', 'DCS-7010T-48 (1G/10G)', 'DCS-7060CX-32S (100G Spine)'],
    defaultModel: 'DCS-7050SX3-48YC8 (EOS 4.30)',
    osLabel: 'Arista EOS 4.30.2F',
    hostname: 'ARISTA-LEAF-SW01',
    mgmtIp: '10.99.0.40',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'ar_1', name: 'Management1', type: 'Ethernet', ip: '10.99.0.40', maskOrCidr: '/24', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Out-of-Band Mgmt' },
      { id: 'ar_2', name: 'Ethernet49/1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '100Gbps', adminUp: true, linkUp: true, desc: 'QSFP28 Spine Uplink' },
      { id: 'ar_3', name: 'Ethernet1', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'Downlink to OLT' },
      { id: 'ar_4', name: 'Vlan100', type: 'VLAN/IRB', ip: '10.100.0.40', maskOrCidr: '/24', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'In-Band Mgmt SVI' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT-NOC', taggedPorts: 'Ethernet49/1,Ethernet1', untaggedPorts: '' },
      { id: 'v2', vlanId: 200, name: 'ISP-PPPOE-AGG', taggedPorts: 'Ethernet49/1,Ethernet1', untaggedPorts: '' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
    ],
    onus: [],
    policies: [
      { id: 'ap1', kind: 'firewall', name: 'CONTROL-PLANE-ACL', srcOrUser: '10.99.0.0/24', dstOrProfile: 'any', actionOrService: 'permit ip', enabled: true, comment: 'Allow NOC Access' },
    ],
    switchPorts: [
      { id: 'sp_ar1', portName: 'Ethernet1', mode: 'trunk', accessVlan: 1, allowedVlans: '100,200,300', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_ar2', portName: 'Ethernet2', mode: 'access', accessVlan: 100, allowedVlans: '100', nativeVlan: 100, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_ar1', lagId: 10, mode: 'lacp-active', members: 'Ethernet49/1,Ethernet50/1', allowedVlans: '100,200', desc: 'MLAG Peer/Uplink' },
    ],
    bgpPeers: [
      { id: 'bgp_ar1', localAsn: 65201, routerId: '10.99.0.40', peerIp: '10.99.0.1', remoteAsn: 139900, desc: 'Core-Spine-BGP', advertisePrefix: '10.100.0.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_ar1', processId: 1, area: '0.0.0.0', networkCidr: '10.99.0.0/24', passiveInterface: 'Vlan100' },
    ],
  },

  Ruijie: {
    brand: 'Ruijie',
    category: 'Switch',
    webUiTitle: 'Ruijie RGOS ISP Aggregation Switch WebUI',
    models: ['RG-S5750C-28GT4XS-H (L3 10G)', 'RG-S2910-24GT4XS-E', 'RG-S6120-20XS4VS2QXS', 'RG-N18000 Core'],
    defaultModel: 'RG-S5750C-28GT4XS-H (L3 10G)',
    osLabel: 'Ruijie RGOS 12.5(4)',
    hostname: 'RUIJIE-AGG-SW01',
    mgmtIp: '10.99.0.45',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: true,
    interfaces: [
      { id: 'rj_1', name: 'VLAN 100', type: 'VLAN/IRB', ip: '10.99.0.45', maskOrCidr: '255.255.255.0', vlan: '100', speed: '10Gbps', adminUp: true, linkUp: true, desc: 'Switch Management SVI' },
      { id: 'rj_2', name: 'TenGigabitEthernet 0/25', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G Trunk Uplink' },
      { id: 'rj_3', name: 'GigabitEthernet 0/1', type: 'Ethernet', ip: 'unassigned', maskOrCidr: '', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'POP Distribution Port' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT', taggedPorts: 'TenGigabitEthernet 0/25', untaggedPorts: '' },
      { id: 'v2', vlanId: 220, name: 'ISP-AGG-VLAN', taggedPorts: 'TenGigabitEthernet 0/25', untaggedPorts: 'GigabitEthernet 0/1' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
    ],
    onus: [],
    policies: [],
    switchPorts: [
      { id: 'sp_rj1', portName: 'TenGigabitEthernet 0/25', mode: 'trunk', accessVlan: 1, allowedVlans: '100,220', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_rj2', portName: 'GigabitEthernet 0/1', mode: 'access', accessVlan: 220, allowedVlans: '220', nativeVlan: 220, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_rj1', lagId: 1, mode: 'lacp-active', members: 'TenGigabitEthernet 0/25-26', allowedVlans: '100,220', desc: 'AggregatePort 1' },
    ],
    bgpPeers: [
      { id: 'bgp_rj1', localAsn: 65301, routerId: '10.99.0.45', peerIp: '10.99.0.1', remoteAsn: 139900, desc: 'Core-Router', advertisePrefix: '10.99.0.0/24' },
    ],
    ospfEntries: [
      { id: 'ospf_rj1', processId: 1, area: '0', networkCidr: '10.99.0.0/24', passiveInterface: 'VLAN 100' },
    ],
  },

  'TP-Link': {
    brand: 'TP-Link',
    category: 'Switch',
    webUiTitle: 'TP-Link Omada / JetStream L2+ Switch WebUI',
    models: ['TL-SG3428X (24G + 4x 10G SFP+)', 'TL-SG3452X (48G + 4x 10G)', 'SX3016F (16P 10G Fiber)', 'SG3428XMP (PoE+ 10G)'],
    defaultModel: 'TL-SG3428X (24G + 4x 10G SFP+)',
    osLabel: 'Omada JetStream v1.20',
    hostname: 'TPLINK-SG3428X-POP',
    mgmtIp: '10.99.0.50',
    defaultUser: 'admin',
    defaultPass: 'admin',
    isOlt: false,
    supportsSwitchL2: true,
    supportsDynamicRouting: false,
    interfaces: [
      { id: 'tp_1', name: 'vlan 100', type: 'VLAN/IRB', ip: '10.99.0.50', maskOrCidr: '255.255.255.0', vlan: '100', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Switch Mgmt SVI' },
      { id: 'tp_2', name: 'ten-gigabitEthernet 1/0/25', type: 'SFP+', ip: 'unassigned', maskOrCidr: '', speed: '10Gbps', adminUp: true, linkUp: true, desc: '10G SFP+ Uplink' },
      { id: 'tp_3', name: 'gigabitEthernet 1/0/1', type: 'Ethernet', ip: 'unassigned', maskOrCidr: '', speed: '1Gbps', adminUp: true, linkUp: true, desc: 'Client Access Port' },
    ],
    vlans: [
      { id: 'v1', vlanId: 100, name: 'MGMT-VLAN', taggedPorts: '1/0/25', untaggedPorts: '' },
      { id: 'v2', vlanId: 210, name: 'USERS-VLAN', taggedPorts: '1/0/25', untaggedPorts: '1/0/1' },
    ],
    routes: [
      { id: 'r1', destination: '0.0.0.0', mask: '0.0.0.0', cidr: 0, gateway: '10.99.0.1', comment: 'Default Gateway' },
    ],
    onus: [],
    policies: [],
    switchPorts: [
      { id: 'sp_tp1', portName: 'ten-gigabitEthernet 1/0/25', mode: 'trunk', accessVlan: 1, allowedVlans: '100,210', nativeVlan: 1, stpEdge: false, bpduGuard: false },
      { id: 'sp_tp2', portName: 'gigabitEthernet 1/0/1', mode: 'access', accessVlan: 210, allowedVlans: '210', nativeVlan: 210, stpEdge: true, bpduGuard: true },
    ],
    lags: [
      { id: 'lag_tp1', lagId: 1, mode: 'lacp-active', members: 'ten-gigabitEthernet 1/0/25-26', allowedVlans: '100,210', desc: 'LACP-Uplink' },
    ],
    bgpPeers: [],
    ospfEntries: [],
  },
};

// =========================================================================
// UNIVERSAL WEBUI ACTION -> REAL BRAND-ACCURATE CLI GENERATOR (ALL 12 BRANDS)
// =========================================================================

export function genHostnameCli(brand: TerminalVendor, hostname: string): string {
  const h = hostname.trim().replace(/\s+/g, '-') || 'NET-DEVICE';
  switch (brand) {
    case 'MikroTik':
      return `/system identity set name="${h}"`;
    case 'Cisco':
    case 'Arista':
      return `enable\nconfigure terminal\nhostname ${h}\nend`;
    case 'Ruijie':
      return `enable\nconfigure terminal\nhostname ${h}\nend\nwrite`;
    case 'TP-Link':
      return `enable\nconfigure\nhostname ${h}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\nsysname ${h}\nsave`;
    case 'ZTE':
      return `configure terminal\nhostname ${h}\nexit\nwrite`;
    case 'BDCOM':
      return `enable\nconfig\nhostname ${h}\nwrite all`;
    case 'VSOL':
      return `enable\nconfigure terminal\nhostname ${h}\nwrite`;
    case 'Palo Alto':
      return `configure\nset deviceconfig system hostname ${h}\ncommit`;
    case 'Juniper':
      return `configure\nset system host-name ${h}\ncommit`;
  }
}

export function genInterfaceToggleCli(brand: TerminalVendor, ifaceName: string, enablePort: boolean): string {
  switch (brand) {
    case 'MikroTik':
      return `/interface set [find name="${ifaceName}"] disabled=${enablePort ? 'no' : 'yes'}`;
    case 'Cisco':
    case 'Arista':
    case 'Ruijie':
      return `enable\nconfigure terminal\ninterface ${ifaceName}\n${enablePort ? 'no shutdown' : 'shutdown'}\nend`;
    case 'TP-Link':
      return `enable\nconfigure\ninterface ${ifaceName}\n${enablePort ? 'no shutdown' : 'shutdown'}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\ninterface ${ifaceName}\n${enablePort ? 'undo shutdown' : 'shutdown'}\nquit`;
    case 'ZTE':
      return `configure terminal\ninterface ${ifaceName}\n${enablePort ? 'no shutdown' : 'shutdown'}\nexit`;
    case 'BDCOM':
      return `enable\nconfig\ninterface ${ifaceName}\n${enablePort ? 'no shutdown' : 'shutdown'}\nexit`;
    case 'VSOL':
      return `enable\nconfigure terminal\ninterface ${ifaceName}\n${enablePort ? 'no shutdown' : 'shutdown'}\nexit`;
    case 'Palo Alto':
      return `configure\nset network interface ethernet ${ifaceName} link-state ${enablePort ? 'auto' : 'down'}\ncommit`;
    case 'Juniper':
      return `configure\n${enablePort ? `delete interfaces ${ifaceName} disable` : `set interfaces ${ifaceName} disable`}\ncommit`;
  }
}

export function genInterfaceIpCli(brand: TerminalVendor, iface: WebUiInterface): string {
  const cidr = maskToCidr(iface.maskOrCidr.replace('/', ''));
  const mask = cidrToMask(cidr);
  const ipOnly = iface.ip.trim();
  const safeDesc = iface.desc.trim() || 'Configured-by-WebUI';

  switch (brand) {
    case 'MikroTik':
      return `/interface set [find name="${iface.name}"] comment="${safeDesc}"\n/ip address add address=${ipOnly}/${cidr} interface="${iface.name}" comment="${safeDesc}"`;
    case 'Cisco':
    case 'Ruijie':
      return `enable\nconfigure terminal\ninterface ${iface.name}\n description ${safeDesc}\n ip address ${ipOnly} ${mask}\n no shutdown\nend`;
    case 'Arista':
      return `enable\nconfigure terminal\ninterface ${iface.name}\n description ${safeDesc}\n ip address ${ipOnly}/${cidr}\n no shutdown\nend`;
    case 'TP-Link':
      return `enable\nconfigure\ninterface ${iface.name}\n ip address ${ipOnly} ${mask}\n no shutdown\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\ninterface ${iface.name}\n description ${safeDesc}\n ip address ${ipOnly} ${mask}\n undo shutdown\nquit`;
    case 'ZTE':
      return `configure terminal\ninterface ${iface.name}\n description ${safeDesc}\n ip address ${ipOnly} ${mask}\n no shutdown\nexit`;
    case 'BDCOM':
      return `enable\nconfig\ninterface ${iface.name}\n description ${safeDesc}\n ip address ${ipOnly} ${mask}\n no shutdown\nexit`;
    case 'VSOL':
      return `enable\nconfigure terminal\ninterface ${iface.name}\n ip address ${ipOnly} ${mask}\n no shutdown\nexit`;
    case 'Palo Alto':
      return `configure\nset network interface ethernet ${iface.name} layer3 ip ${ipOnly}/${cidr}\nset network interface ethernet ${iface.name} comment "${safeDesc}"\ncommit`;
    case 'Juniper': {
      const unitSplit = iface.name.includes('.') ? iface.name.split('.') : [iface.name, '0'];
      return `configure\nset interfaces ${unitSplit[0]} unit ${unitSplit[1]} description "${safeDesc}"\nset interfaces ${unitSplit[0]} unit ${unitSplit[1]} family inet address ${ipOnly}/${cidr}\ncommit`;
    }
  }
}

export function genVlanAddCli(brand: TerminalVendor, vlan: WebUiVlan): string {
  switch (brand) {
    case 'MikroTik':
      return `/interface vlan add name="${vlan.name}" vlan-id=${vlan.vlanId} interface="${vlan.taggedPorts || 'sfp-sfpplus1'}"`;
    case 'Cisco':
    case 'Arista':
    case 'Ruijie':
      return `enable\nconfigure terminal\nvlan ${vlan.vlanId}\n name ${vlan.name}\nexit\nend`;
    case 'TP-Link':
      return `enable\nconfigure\nvlan ${vlan.vlanId}\n name ${vlan.name}\nexit\nend`;
    case 'Huawei':
      return `enable\nconfig\nvlan ${vlan.vlanId} smart\nvlan desc ${vlan.vlanId} description "${vlan.name}"\n${vlan.taggedPorts ? `port vlan ${vlan.vlanId} ${vlan.taggedPorts}` : ''}`.trim();
    case 'C-Data':
      return `enable\nconfig\nvlan ${vlan.vlanId}\n desc "${vlan.name}"\nexit`;
    case 'ZTE':
      return `configure terminal\nvlan ${vlan.vlanId}\n name ${vlan.name}\nexit`;
    case 'BDCOM':
      return `enable\nconfig\nvlan ${vlan.vlanId}\n name ${vlan.name}\nexit`;
    case 'VSOL':
      return `enable\nconfigure terminal\nvlan ${vlan.vlanId}\n name ${vlan.name}\nexit`;
    case 'Palo Alto':
      return `configure\nset network interface ethernet ${vlan.taggedPorts || 'ethernet1/2'} layer3 units ${vlan.taggedPorts || 'ethernet1/2'}.${vlan.vlanId} tag ${vlan.vlanId}\ncommit`;
    case 'Juniper':
      return `configure\nset vlans ${vlan.name} vlan-id ${vlan.vlanId}\ncommit`;
  }
}

export function genVlanDeleteCli(brand: TerminalVendor, vlan: WebUiVlan): string {
  switch (brand) {
    case 'MikroTik':
      return `/interface vlan remove [find vlan-id=${vlan.vlanId}]`;
    case 'Cisco':
    case 'Arista':
    case 'Ruijie':
      return `enable\nconfigure terminal\nno vlan ${vlan.vlanId}\nend`;
    case 'TP-Link':
      return `enable\nconfigure\nno vlan ${vlan.vlanId}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\nundo vlan ${vlan.vlanId}`;
    case 'ZTE':
      return `configure terminal\nno vlan ${vlan.vlanId}\nexit`;
    case 'BDCOM':
      return `enable\nconfig\nno vlan ${vlan.vlanId}`;
    case 'VSOL':
      return `enable\nconfigure terminal\nno vlan ${vlan.vlanId}`;
    case 'Palo Alto':
      return `configure\ndelete network interface ethernet ${vlan.taggedPorts || 'ethernet1/2'} layer3 units ${vlan.taggedPorts || 'ethernet1/2'}.${vlan.vlanId}\ncommit`;
    case 'Juniper':
      return `configure\ndelete vlans ${vlan.name}\ncommit`;
  }
}

export function genRouteAddCli(brand: TerminalVendor, r: WebUiRoute): string {
  switch (brand) {
    case 'MikroTik':
      return `/ip route add dst-address=${r.destination}/${r.cidr} gateway=${r.gateway} comment="${r.comment}"`;
    case 'Cisco':
    case 'Ruijie':
      return `enable\nconfigure terminal\nip route ${r.destination} ${r.mask} ${r.gateway}\nend`;
    case 'Arista':
      return `enable\nconfigure terminal\nip route ${r.destination}/${r.cidr} ${r.gateway}\nend`;
    case 'TP-Link':
      return `enable\nconfigure\nip route ${r.destination} ${r.mask} ${r.gateway}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\nip route-static ${r.destination} ${r.mask} ${r.gateway}`;
    case 'ZTE':
      return `configure terminal\nip route ${r.destination} ${r.mask} ${r.gateway}\nexit`;
    case 'BDCOM':
      return r.destination === '0.0.0.0'
        ? `enable\nconfig\nip route default ${r.gateway}`
        : `enable\nconfig\nip route ${r.destination} ${r.mask} ${r.gateway}`;
    case 'VSOL':
      return `enable\nconfigure terminal\nip route ${r.destination} ${r.mask} ${r.gateway}`;
    case 'Palo Alto':
      return `configure\nset network virtual-router default routing-table ip static-route "${r.comment.replace(/\s+/g, '-') || 'WebUI-Route'}" destination ${r.destination}/${r.cidr} nexthop ip-address ${r.gateway}\ncommit`;
    case 'Juniper':
      return `configure\nset routing-options static route ${r.destination}/${r.cidr} next-hop ${r.gateway}\ncommit`;
  }
}

export function genRouteDeleteCli(brand: TerminalVendor, r: WebUiRoute): string {
  switch (brand) {
    case 'MikroTik':
      return `/ip route remove [find dst-address="${r.destination}/${r.cidr}" gateway="${r.gateway}"]`;
    case 'Cisco':
    case 'Ruijie':
      return `enable\nconfigure terminal\nno ip route ${r.destination} ${r.mask} ${r.gateway}\nend`;
    case 'Arista':
      return `enable\nconfigure terminal\nno ip route ${r.destination}/${r.cidr} ${r.gateway}\nend`;
    case 'TP-Link':
      return `enable\nconfigure\nno ip route ${r.destination} ${r.mask} ${r.gateway}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `enable\nconfig\nundo ip route-static ${r.destination} ${r.mask} ${r.gateway}`;
    case 'ZTE':
      return `configure terminal\nno ip route ${r.destination} ${r.mask} ${r.gateway}\nexit`;
    case 'BDCOM':
      return r.destination === '0.0.0.0'
        ? `enable\nconfig\nno ip route default ${r.gateway}`
        : `enable\nconfig\nno ip route ${r.destination} ${r.mask} ${r.gateway}`;
    case 'VSOL':
      return `enable\nconfigure terminal\nno ip route ${r.destination} ${r.mask} ${r.gateway}`;
    case 'Palo Alto':
      return `configure\ndelete network virtual-router default routing-table ip static-route "${r.comment.replace(/\s+/g, '-') || 'WebUI-Route'}"\ncommit`;
    case 'Juniper':
      return `configure\ndelete routing-options static route ${r.destination}/${r.cidr}\ncommit`;
  }
}

// =========================================================================
// MULTI-VENDOR OLT ONU PROVISIONING & DIAGNOSTICS (Huawei / ZTE / BDCOM / VSOL / C-Data)
// =========================================================================

export function genOnuAddCli(brand: TerminalVendor, onu: WebUiOnu): string {
  const safeDesc = onu.desc.replace(/\s+/g, '_') || 'Client-ONU';
  if (brand === 'Huawei') {
    const parts = onu.port.split('/');
    const f = parts[0] || '0';
    const s = parts[1] || '1';
    const p = parts[2] || '0';
    if (onu.mode === 'GPON') {
      return [
        'enable',
        'config',
        `interface gpon ${f}/${s}`,
        `ont add ${p} ${onu.onuId} sn-auth "${onu.snOrMac.toUpperCase()}" omci ont-lineprofile-id ${onu.lineProfile} ont-srvprofile-id ${onu.srvProfile} desc "${safeDesc}"`,
        `ont port native-vlan ${p} ${onu.onuId} eth 1 vlan ${onu.vlan} priority 0`,
        'quit',
        `service-port vlan ${onu.vlan} gpon ${f}/${s}/${p} ont ${onu.onuId} gemport 1 multi-service user-vlan ${onu.vlan} tag-transform translate`,
      ].join('\n');
    }
    return [
      'enable',
      'config',
      `interface epon ${f}/${s}`,
      `ont add ${p} ${onu.onuId} mac-auth ${onu.snOrMac.toLowerCase()} oam ont-lineprofile-id ${onu.lineProfile} ont-srvprofile-id ${onu.srvProfile} desc "${safeDesc}"`,
      'quit',
      `service-port vlan ${onu.vlan} epon ${f}/${s}/${p} ont ${onu.onuId} multi-service user-vlan ${onu.vlan} tag-transform translate`,
    ].join('\n');
  }
  if (brand === 'ZTE') {
    return [
      'configure terminal',
      `interface gpon-olt_${onu.port}`,
      ` onu ${onu.onuId} type ALL sn ${onu.snOrMac.toUpperCase()}`,
      'exit',
      `interface gpon-onu_${onu.port}:${onu.onuId}`,
      ` name ${safeDesc}`,
      ` tcont 1 profile 1G`,
      ` gemport 1 tcont 1`,
      ` service-port 1 vport 1 user-vlan ${onu.vlan} vlan ${onu.vlan}`,
      'exit',
      `pon-onu-mng gpon-onu_${onu.port}:${onu.onuId}`,
      ` service 1 gemport 1 vlan ${onu.vlan}`,
      ` vlan port eth_0/1 mode tag vlan ${onu.vlan}`,
      'exit',
      'write',
    ].join('\n');
  }
  if (brand === 'C-Data') {
    const parts = onu.port.split('/');
    const f = parts[0] || '0';
    const s = parts[1] || '0';
    const p = parts[2] || '1';
    return [
      'enable',
      'config',
      `interface ${onu.mode.toLowerCase()} ${f}/${s}`,
      onu.mode === 'GPON'
        ? `ont add ${p} ${onu.onuId} sn-auth ${onu.snOrMac.toUpperCase()} ont-lineprofile-id ${onu.lineProfile} ont-srvprofile-id ${onu.srvProfile} desc ${safeDesc}`
        : `ont add ${p} ${onu.onuId} mac-auth ${onu.snOrMac.toLowerCase()} ont-lineprofile-id ${onu.lineProfile} ont-srvprofile-id ${onu.srvProfile} desc ${safeDesc}`,
      `ont port native-vlan ${p} ${onu.onuId} eth 1 vlan ${onu.vlan}`,
      'exit',
      `service-port autoindex vlan ${onu.vlan} ${onu.mode.toLowerCase()} ${f}/${s}/${p} ont ${onu.onuId} gemport 1 multi-service user-vlan ${onu.vlan}`,
      'save',
    ].join('\n');
  }
  if (brand === 'BDCOM') {
    const iface = onu.mode === 'GPON' ? `gpon ${onu.port}` : `epon ${onu.port}`;
    return [
      'enable',
      'config',
      `interface ${iface}`,
      onu.mode === 'GPON'
        ? `gpon bind-onutype onutype-default sn ${onu.snOrMac.toUpperCase()} sequence ${onu.onuId}`
        : `epon bind-onu mac ${onu.snOrMac.toLowerCase()} ${onu.onuId}`,
      'exit',
      `interface ${iface}:${onu.onuId}`,
      ` description ${safeDesc}`,
      ` ${onu.mode === 'GPON' ? `gpon onu uni 1 vlan mode tag ${onu.vlan}` : `epon onu port 1 ctc vlan mode tag ${onu.vlan}`}`,
      'exit',
      'write all',
    ].join('\n');
  }
  // VSOL
  return [
    'enable',
    'configure terminal',
    `interface ${onu.mode.toLowerCase()} ${onu.port}`,
    onu.mode === 'GPON'
      ? `ont add ${onu.onuId} sn-auth ${onu.snOrMac.toUpperCase()} ont-lineprofile-id ${onu.lineProfile} ont-srvprofile-id ${onu.srvProfile} desc ${safeDesc}`
      : `onu auth mac ${onu.snOrMac.toLowerCase()} onu-id ${onu.onuId} desc ${safeDesc}`,
    'exit',
    'write',
  ].join('\n');
}

export function genOnuDeleteCli(brand: TerminalVendor, onu: WebUiOnu): string {
  if (brand === 'Huawei') {
    const parts = onu.port.split('/');
    const f = parts[0] || '0';
    const s = parts[1] || '1';
    const p = parts[2] || '0';
    return `enable\nconfig\nundo service-port port ${f}/${s}/${p} ont ${onu.onuId}\ninterface ${onu.mode.toLowerCase()} ${f}/${s}\nont delete ${p} ${onu.onuId}\nquit`;
  }
  if (brand === 'ZTE') {
    return `configure terminal\ninterface gpon-olt_${onu.port}\n no onu ${onu.onuId}\nexit\nwrite`;
  }
  if (brand === 'C-Data') {
    const parts = onu.port.split('/');
    const f = parts[0] || '0';
    const s = parts[1] || '0';
    const p = parts[2] || '1';
    return `enable\nconfig\nundo service-port port ${f}/${s}/${p} ont ${onu.onuId}\ninterface ${onu.mode.toLowerCase()} ${f}/${s}\nont delete ${p} ${onu.onuId}\nexit\nsave`;
  }
  if (brand === 'BDCOM') {
    const iface = onu.mode === 'GPON' ? `gpon ${onu.port}` : `epon ${onu.port}`;
    return `enable\nconfig\ninterface ${iface}\nno ${onu.mode === 'GPON' ? `gpon bind-onutype sequence ${onu.onuId}` : `epon bind-onu sequence ${onu.onuId}`}\nexit\nwrite all`;
  }
  return `enable\nconfigure terminal\ninterface ${onu.mode.toLowerCase()} ${onu.port}\nno ont ${onu.onuId}\nexit\nwrite`;
}

export function genOltDiagnosticCli(
  brand: TerminalVendor,
  action: 'autofind' | 'optical-all' | 'mac-all' | 'onu-optical' | 'onu-reboot',
  onu?: WebUiOnu
): string {
  if (action === 'autofind') {
    if (brand === 'Huawei') return 'display ont autofind all';
    if (brand === 'ZTE') return 'show gpon onu uncfg';
    if (brand === 'BDCOM') return 'show epon rejected-onu\nshow gpon unconfigured-onu';
    if (brand === 'C-Data') return 'show ont autofind all';
    return 'show onu auto-find all';
  }
  if (action === 'optical-all') {
    if (brand === 'Huawei') return 'interface gpon 0/1\ndisplay ont optical-info 0 all\nquit';
    if (brand === 'ZTE') return 'show pon power onu-rx gpon-olt_1/2/1';
    if (brand === 'BDCOM') return 'show epon optical-transceiver-diagnosis';
    if (brand === 'C-Data') return 'show ont optical-info 0/0/1 all';
    return 'show pon optical transceiver';
  }
  if (action === 'mac-all') {
    if (brand === 'Huawei') return 'display mac-address all';
    if (brand === 'ZTE') return 'show mac';
    if (brand === 'BDCOM') return 'show mac address-table';
    if (brand === 'C-Data') return 'show mac-address all';
    return 'show mac address-table';
  }
  if (action === 'onu-optical' && onu) {
    if (brand === 'Huawei') {
      const [f = '0', s = '1', p = '0'] = onu.port.split('/');
      return `interface ${onu.mode.toLowerCase()} ${f}/${s}\ndisplay ont optical-info ${p} ${onu.onuId}\nquit`;
    }
    if (brand === 'ZTE') return `show pon power attenuation gpon-onu_${onu.port}:${onu.onuId}`;
    if (brand === 'BDCOM') return `show ${onu.mode.toLowerCase()} interface ${onu.mode.toLowerCase()} ${onu.port}:${onu.onuId} onu ctc optical-transceiver-diagnosis`;
    if (brand === 'C-Data') return `show ont optical-info ${onu.port} ${onu.onuId}`;
    return `show ${onu.mode.toLowerCase()} onu optical-info ${onu.port} ${onu.onuId}`;
  }
  if (action === 'onu-reboot' && onu) {
    if (brand === 'Huawei') {
      const [f = '0', s = '1', p = '0'] = onu.port.split('/');
      return `enable\nconfig\ninterface ${onu.mode.toLowerCase()} ${f}/${s}\nont reset ${p} ${onu.onuId}\nquit`;
    }
    if (brand === 'ZTE') return `configure terminal\npon-onu-mng gpon-onu_${onu.port}:${onu.onuId}\n reboot\nexit`;
    if (brand === 'BDCOM') return `enable\nconfig\ninterface ${onu.mode.toLowerCase()} ${onu.port}:${onu.onuId}\n ${onu.mode.toLowerCase()} onu reset\nexit`;
    if (brand === 'C-Data') return `enable\nconfig\ninterface ${onu.mode.toLowerCase()} ${onu.port.split('/').slice(0, 2).join('/')}\nont reboot ${onu.port.split('/')[2] || '1'} ${onu.onuId}\nexit`;
    return `enable\nconfigure terminal\ninterface ${onu.mode.toLowerCase()} ${onu.port}\nont reset ${onu.onuId}\nexit`;
  }
  return 'show version';
}

// =========================================================================
// MULTI-VENDOR L2 SWITCHING (Access/Trunk, LACP/LAG, STP, MAC Lookup)
// =========================================================================

export function genSwitchPortModeCli(brand: TerminalVendor, sp: WebUiSwitchPort): string {
  const isTrunk = sp.mode === 'trunk';
  switch (brand) {
    case 'Cisco':
    case 'Arista':
      return [
        'enable',
        'configure terminal',
        `interface ${sp.portName}`,
        isTrunk ? ' switchport mode trunk' : ' switchport mode access',
        isTrunk
          ? ` switchport trunk allowed vlan ${sp.allowedVlans || '100,200'}\n switchport trunk native vlan ${sp.nativeVlan}`
          : ` switchport access vlan ${sp.accessVlan}`,
        sp.stpEdge ? ' spanning-tree portfast' : '',
        sp.bpduGuard ? ' spanning-tree bpduguard enable' : '',
        ' no shutdown',
        'end',
      ].filter(Boolean).join('\n');

    case 'Ruijie':
      return [
        'enable',
        'configure terminal',
        `interface ${sp.portName}`,
        isTrunk ? ' switchport mode trunk' : ' switchport mode access',
        isTrunk
          ? ` switchport trunk allowed vlan add ${sp.allowedVlans || '100,200'}\n switchport trunk native vlan ${sp.nativeVlan}`
          : ` switchport access vlan ${sp.accessVlan}`,
        sp.stpEdge ? ' spanning-tree portfast' : '',
        sp.bpduGuard ? ' spanning-tree bpduguard enable' : '',
        'end',
      ].filter(Boolean).join('\n');

    case 'TP-Link':
      return [
        'enable',
        'configure',
        `interface ${sp.portName}`,
        isTrunk
          ? ` switchport mode trunk\n switchport trunk allowed vlan ${sp.allowedVlans || '100,200'}`
          : ` switchport mode access\n switchport access vlan ${sp.accessVlan}`,
        sp.stpEdge ? ' spanning-tree ext-cost auto\n spanning-tree edge-port' : '',
        sp.bpduGuard ? ' spanning-tree bpduguard' : '',
        'end',
      ].filter(Boolean).join('\n');

    case 'Huawei':
    case 'C-Data':
      return [
        'system-view',
        `interface ${sp.portName}`,
        isTrunk ? ' port link-type trunk' : ' port link-type access',
        isTrunk
          ? ` port trunk allow-pass vlan ${sp.allowedVlans.replace(/,/g, ' ') || '100 200'}`
          : ` port default vlan ${sp.accessVlan}`,
        sp.stpEdge ? ' stp edged-port enable' : '',
        sp.bpduGuard ? ' stp bpdu-protection' : '',
        'quit',
      ].filter(Boolean).join('\n');

    case 'BDCOM':
    case 'ZTE':
    case 'VSOL':
      return [
        'enable',
        brand === 'BDCOM' ? 'config' : 'configure terminal',
        `interface ${sp.portName}`,
        isTrunk ? ' switchport mode trunk' : ' switchport mode access',
        isTrunk
          ? ` switchport trunk vlan-allowed ${sp.allowedVlans || '100,200'}`
          : ` switchport pvid ${sp.accessVlan}`,
        'exit',
      ].join('\n');

    case 'Juniper':
      return [
        'configure',
        `set interfaces ${sp.portName} unit 0 family ethernet-switching interface-mode ${isTrunk ? 'trunk' : 'access'}`,
        `set interfaces ${sp.portName} unit 0 family ethernet-switching vlan members [ ${isTrunk ? sp.allowedVlans.replace(/,/g, ' ') : sp.accessVlan} ]`,
        sp.stpEdge ? `set protocols rstp interface ${sp.portName} edge` : '',
        'commit',
      ].filter(Boolean).join('\n');

    case 'MikroTik':
      return isTrunk
        ? `/interface bridge vlan add bridge=bridge-lan tagged=${sp.portName} vlan-ids=${sp.allowedVlans || '100,200'}`
        : `/interface bridge port set [find interface="${sp.portName}"] pvid=${sp.accessVlan}${sp.stpEdge ? ' edge=yes' : ''}`;

    case 'Palo Alto':
      return `configure\nset network interface ethernet ${sp.portName} layer2\ncommit`;
  }
}

export function genLagCreateCli(brand: TerminalVendor, lag: WebUiLagBundle): string {
  const modeStr = lag.mode === 'lacp-active' ? 'active' : 'on';
  const ports = lag.members.split(',').map((s) => s.trim()).filter(Boolean);
  switch (brand) {
    case 'Cisco':
    case 'Arista':
      return [
        'enable',
        'configure terminal',
        `interface Port-Channel${lag.lagId}`,
        ` description ${lag.desc}`,
        ' switchport mode trunk',
        ` switchport trunk allowed vlan ${lag.allowedVlans}`,
        'exit',
        ...ports.map((p) => `interface ${p}\n channel-group ${lag.lagId} mode ${modeStr}\nexit`),
        'end',
      ].join('\n');

    case 'Ruijie':
      return [
        'enable',
        'configure terminal',
        `interface AggregatePort ${lag.lagId}`,
        ` description ${lag.desc}`,
        ' switchport mode trunk',
        ` switchport trunk allowed vlan add ${lag.allowedVlans}`,
        'exit',
        ...ports.map((p) => `interface ${p}\n port-group ${lag.lagId} mode ${modeStr}\nexit`),
        'end',
      ].join('\n');

    case 'TP-Link':
      return [
        'enable',
        'configure',
        ...ports.map((p) => `interface ${p}\n channel-group ${lag.lagId} mode ${modeStr}\nexit`),
        `interface port-channel ${lag.lagId}`,
        ' switchport mode trunk',
        ` switchport trunk allowed vlan ${lag.allowedVlans}`,
        'end',
      ].join('\n');

    case 'Huawei':
    case 'C-Data':
      return [
        'system-view',
        `interface Eth-Trunk ${lag.lagId}`,
        ` description ${lag.desc}`,
        lag.mode === 'lacp-active' ? ' mode lacp-static' : ' mode manual load-balance',
        ' port link-type trunk',
        ` port trunk allow-pass vlan ${lag.allowedVlans.replace(/,/g, ' ')}`,
        ...ports.map((p) => ` trunkport ${p}`),
        'quit',
      ].join('\n');

    case 'ZTE':
      return [
        'configure terminal',
        `interface smartgroup${lag.lagId}`,
        ` description ${lag.desc}`,
        ' switchport mode trunk',
        ` switchport vlan ${lag.allowedVlans} tag`,
        'exit',
        ...ports.map((p) => `interface ${p}\n smartgroup ${lag.lagId} mode ${modeStr}\nexit`),
      ].join('\n');

    case 'BDCOM':
    case 'VSOL':
      return [
        'enable',
        brand === 'BDCOM' ? 'config' : 'configure terminal',
        `interface port-aggregator ${lag.lagId}`,
        ' switchport mode trunk',
        ` switchport trunk vlan-allowed ${lag.allowedVlans}`,
        'exit',
        ...ports.map((p) => `interface ${p}\n aggregator-group ${lag.lagId} mode ${lag.mode === 'lacp-active' ? 'lacp' : 'static'}\nexit`),
      ].join('\n');

    case 'MikroTik':
      return `/interface bonding add name="bond${lag.lagId}" slaves="${ports.join(',')}" mode=${lag.mode === 'lacp-active' ? '802.3ad lacp-rate=1sec' : 'balance-rr'} transmit-hash-policy=layer-2-and-3 comment="${lag.desc}"`;

    case 'Juniper':
      return [
        'configure',
        `set chassis aggregated-devices ethernet device-count 16`,
        ...ports.map((p) => `set interfaces ${p} ether-options 802.3ad ae${lag.lagId}`),
        `set interfaces ae${lag.lagId} description "${lag.desc}"`,
        lag.mode === 'lacp-active' ? `set interfaces ae${lag.lagId} aggregated-ether-options lacp active` : '',
        'commit',
      ].filter(Boolean).join('\n');

    case 'Palo Alto':
      return `configure\nset network interface aggregate-ethernet ae${lag.lagId} layer3\ncommit`;
  }
}

export function genStpConfigCli(brand: TerminalVendor, stpMode: 'rstp' | 'mstp', priority: number): string {
  switch (brand) {
    case 'Cisco':
    case 'Arista':
      return `enable\nconfigure terminal\nspanning-tree mode ${stpMode === 'rstp' ? 'rapid-pvst' : 'mst'}\nspanning-tree vlan 1-4094 priority ${priority}\nend`;
    case 'Ruijie':
    case 'TP-Link':
      return `enable\nconfigure${brand === 'TP-Link' ? '' : ' terminal'}\nspanning-tree\nspanning-tree mode ${stpMode}\nspanning-tree priority ${priority}\nend`;
    case 'Huawei':
    case 'C-Data':
      return `system-view\nstp enable\nstp mode ${stpMode}\nstp priority ${priority}\nquit`;
    case 'BDCOM':
    case 'ZTE':
    case 'VSOL':
      return `enable\nconfig\nspanning-tree mode ${stpMode}\nspanning-tree priority ${priority}\nexit`;
    case 'MikroTik':
      return `/interface bridge set [find name="bridge-lan"] protocol-mode=${stpMode} priority=0x${priority.toString(16)}`;
    case 'Juniper':
      return `configure\nset protocols ${stpMode} bridge-priority ${priority}\ncommit`;
    case 'Palo Alto':
      return '# Palo Alto operates primarily at L3/VWire; STP is transparent in VWire mode';
  }
}

export function genMacLookupCli(brand: TerminalVendor, query: string): string {
  const q = query.trim();
  switch (brand) {
    case 'MikroTik':
      return q ? `/interface bridge host print where mac-address~"${q}"` : '/interface bridge host print';
    case 'Huawei':
    case 'C-Data':
      return q ? `display mac-address ${q}` : 'display mac-address all';
    case 'ZTE':
      return q ? `show mac ${q}` : 'show mac';
    case 'Juniper':
      return q ? `show ethernet-switching table | match ${q}` : 'show ethernet-switching table';
    case 'Ruijie':
      return q ? `show mac-address-table address ${q}` : 'show mac-address-table';
    case 'Palo Alto':
      return 'show arp all';
    default:
      return q ? `show mac address-table address ${q}` : 'show mac address-table';
  }
}

// =========================================================================
// MULTI-VENDOR DYNAMIC ROUTING (BGP & OSPF)
// =========================================================================

export function genBgpPeerCli(brand: TerminalVendor, peer: WebUiBgpPeer): string {
  const [netIp, netCidrStr] = (peer.advertisePrefix || '10.0.0.0/24').split('/');
  const netMask = cidrToMask(parseInt(netCidrStr || '24', 10));

  switch (brand) {
    case 'MikroTik':
      return [
        `/routing bgp template set default as=${peer.localAsn} router-id=${peer.routerId}`,
        `/routing bgp connection add name="${peer.desc}" local.role=ebgp remote.address=${peer.peerIp} remote.as=${peer.remoteAsn} output.network=bgp-networks`,
        `/ip firewall address-list add list=bgp-networks address=${peer.advertisePrefix}`,
      ].join('\n');

    case 'Cisco':
    case 'Ruijie':
      return [
        'enable',
        'configure terminal',
        `router bgp ${peer.localAsn}`,
        ` bgp router-id ${peer.routerId}`,
        ` neighbor ${peer.peerIp} remote-as ${peer.remoteAsn}`,
        ` neighbor ${peer.peerIp} description ${peer.desc}`,
        ` network ${netIp} mask ${netMask}`,
        'end',
      ].join('\n');

    case 'Arista':
      return [
        'enable',
        'configure terminal',
        `router bgp ${peer.localAsn}`,
        ` router-id ${peer.routerId}`,
        ` neighbor ${peer.peerIp} remote-as ${peer.remoteAsn}`,
        ` neighbor ${peer.peerIp} description ${peer.desc}`,
        ` network ${peer.advertisePrefix}`,
        'end',
      ].join('\n');

    case 'Huawei':
      return [
        'system-view',
        `bgp ${peer.localAsn}`,
        ` router-id ${peer.routerId}`,
        ` peer ${peer.peerIp} as-number ${peer.remoteAsn}`,
        ` peer ${peer.peerIp} description ${peer.desc}`,
        ` network ${netIp} ${netMask}`,
        'quit',
      ].join('\n');

    case 'Juniper':
      return [
        'configure',
        `set routing-options autonomous-system ${peer.localAsn}`,
        `set routing-options router-id ${peer.routerId}`,
        `set protocols bgp group EBGP-${peer.desc} type external`,
        `set protocols bgp group EBGP-${peer.desc} peer-as ${peer.remoteAsn}`,
        `set protocols bgp group EBGP-${peer.desc} neighbor ${peer.peerIp} description "${peer.desc}"`,
        'commit',
      ].join('\n');

    case 'Palo Alto':
      return [
        'configure',
        `set network virtual-router default protocol bgp enable yes router-id ${peer.routerId} local-as ${peer.localAsn}`,
        `set network virtual-router default protocol bgp peer-group ${peer.desc} peer ${peer.desc}-P1 peer-as ${peer.remoteAsn} peer-address ip ${peer.peerIp}`,
        'commit',
      ].join('\n');

    default:
      return `# BGP is typically configured on Core Routers / L3 Switches (${brand} model may support static routing only)`;
  }
}

export function genOspfNetworkCli(brand: TerminalVendor, ospf: WebUiOspfEntry): string {
  const [netIp, cidrStr] = (ospf.networkCidr || '10.99.0.0/24').split('/');
  const cidr = parseInt(cidrStr || '24', 10);
  const wildcard = cidrToWildcard(cidr);

  switch (brand) {
    case 'MikroTik':
      return [
        `/routing ospf instance add name=ospf-v2-${ospf.processId} version=2`,
        `/routing ospf area add name=area-${ospf.area} area-id=${ospf.area} instance=ospf-v2-${ospf.processId}`,
        `/routing ospf interface-template add area=area-${ospf.area} networks=${ospf.networkCidr}`,
        ospf.passiveInterface ? `/routing ospf interface-template add area=area-${ospf.area} interfaces="${ospf.passiveInterface}" passive` : '',
      ].filter(Boolean).join('\n');

    case 'Cisco':
    case 'Arista':
    case 'Ruijie':
      return [
        'enable',
        'configure terminal',
        `router ospf ${ospf.processId}`,
        ` network ${netIp} ${wildcard} area ${ospf.area}`,
        ospf.passiveInterface ? ` passive-interface ${ospf.passiveInterface}` : '',
        'end',
      ].filter(Boolean).join('\n');

    case 'Huawei':
      return [
        'system-view',
        `ospf ${ospf.processId}`,
        ` area ${ospf.area}`,
        `  network ${netIp} ${wildcard}`,
        ' quit',
        ospf.passiveInterface ? ` silent-interface ${ospf.passiveInterface}` : '',
        'quit',
      ].filter(Boolean).join('\n');

    case 'Juniper':
      return [
        'configure',
        `set protocols ospf area ${ospf.area} interface all`,
        ospf.passiveInterface ? `set protocols ospf area ${ospf.area} interface ${ospf.passiveInterface} passive` : '',
        'commit',
      ].filter(Boolean).join('\n');

    case 'Palo Alto':
      return `configure\nset network virtual-router default protocol ospf enable yes area ${ospf.area}\ncommit`;

    default:
      return `# OSPF is available on L3 Routers and L3 Switches (${brand})`;
  }
}

export function genPolicyOrPppAddCli(brand: TerminalVendor, item: WebUiPolicyOrPpp): string {
  if (brand === 'MikroTik') {
    if (item.kind === 'ppp') {
      return `/ppp secret add name="${item.srcOrUser}" password="ChangeMe123" service=${item.actionOrService} profile="${item.dstOrProfile}" comment="${item.comment}"`;
    }
    return `/ip firewall nat add chain=srcnat src-address=${item.srcOrUser} out-interface=${item.dstOrProfile} action=${item.actionOrService} comment="${item.comment}"`;
  }
  if (brand === 'Palo Alto') {
    const rule = item.name.replace(/\s+/g, '-');
    return `configure\nset rulebase security rules ${rule} from ${item.srcOrUser} to ${item.dstOrProfile} source any destination any application any service application-default action ${item.actionOrService}\ncommit`;
  }
  if (brand === 'Juniper') {
    const rule = item.name.replace(/\s+/g, '-');
    return `configure\nset firewall family inet filter PROTECT-RE term ${rule} from source-address ${item.srcOrUser}\nset firewall family inet filter PROTECT-RE term ${rule} then ${item.actionOrService}\ncommit`;
  }
  return `enable\nconfigure terminal\nip access-list extended ${item.name.replace(/\s+/g, '-')}\n ${item.actionOrService} ${item.srcOrUser} ${item.dstOrProfile}\nend`;
}

export function genSaveConfigCli(brand: TerminalVendor): string {
  switch (brand) {
    case 'MikroTik':
      return '/system backup save name=webui-backup\n/export show-sensitive';
    case 'Cisco':
    case 'Arista':
      return 'write memory';
    case 'Huawei':
    case 'C-Data':
      return 'save';
    case 'BDCOM':
      return 'write all';
    case 'VSOL':
    case 'ZTE':
    case 'Ruijie':
      return 'write';
    case 'TP-Link':
      return 'copy running-config startup-config';
    case 'Palo Alto':
    case 'Juniper':
      return 'commit';
  }
}
