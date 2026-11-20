// Official Hardware Datasheets, CLI Command Libraries & Live Telnet Prompt Adapters
// for MikroTik RouterOS v7, BDCOM EPON/GPON OLT, and VSOL EPON/GPON OLT

export type VendorPromptMode = 'unknown' | 'user' | 'priv' | 'config' | 'subview';

export interface VendorCheatItem {
  id: string;
  category: string;
  title: string;
  command: string;
  description: string;
  requiresConfig?: boolean;
}

// ============================================================================
// 1. MIKROTIK ROUTEROS v7 DATASHEETS & CLI REFERENCE
// ============================================================================
export type MikroTikModel =
  | 'RB5009UG+S+IN'
  | 'CCR2004-16G-2S+'
  | 'CCR2004-1G-12S+2XS'
  | 'CCR2116-12G-4S+'
  | 'CCR2216-12G-4XS'
  | 'CRS326-24S+2Q+RM';

export interface MikroTikModelSpec {
  model: MikroTikModel;
  series: string;
  cpu: string;
  ram: string;
  portsSummary: string;
  l3HwOffload: string;
  throughput: string;
  defaultPorts: { name: string; speed: string; role: string }[];
}

export const MIKROTIK_DATASHEETS: Record<MikroTikModel, MikroTikModelSpec> = {
  'RB5009UG+S+IN': {
    model: 'RB5009UG+S+IN',
    series: 'Heavy-Duty Branch / Small ISP Router',
    cpu: '88F7040 4-Core ARM64 1.4 GHz',
    ram: '1 GB DDR4 · 1 GB NAND',
    portsSummary: '7x 1G + 1x 2.5G + 1x 10G SFP+',
    l3HwOffload: 'Marvell Amethyst Switch Chip',
    throughput: 'Up to 9.8 Gbps Routing',
    defaultPorts: [
      { name: 'sfp-sfpplus1', speed: '10G', role: 'WAN / Upstream' },
      { name: 'ether1', speed: '2.5G', role: 'OLT Uplink' },
      { name: 'ether2', speed: '1G', role: 'LAN / Bridge' },
      { name: 'ether3', speed: '1G', role: 'LAN / Bridge' },
      { name: 'ether4', speed: '1G', role: 'Management' },
    ],
  },
  'CCR2004-16G-2S+': {
    model: 'CCR2004-16G-2S+',
    series: 'Cloud Core Router (1U ISP Edge)',
    cpu: 'AL32400 4-Core ARM64 1.7 GHz',
    ram: '4 GB DDR4 · 128 MB NAND',
    portsSummary: '16x 1G RJ45 + 2x 10G SFP+',
    l3HwOffload: 'Dual Marvell Amethyst',
    throughput: 'Up to 22 Gbps Routing',
    defaultPorts: [
      { name: 'sfp-sfpplus1', speed: '10G', role: 'ISP Upstream' },
      { name: 'sfp-sfpplus2', speed: '10G', role: 'OLT Trunk' },
      { name: 'ether1', speed: '1G', role: 'PPPoE Access' },
      { name: 'ether2', speed: '1G', role: 'PPPoE Access' },
      { name: 'ether16', speed: '1G', role: 'NOC Mgmt' },
    ],
  },
  'CCR2004-1G-12S+2XS': {
    model: 'CCR2004-1G-12S+2XS',
    series: 'Cloud Core Fiber Aggregation',
    cpu: 'AL32400 4-Core ARM64 1.7 GHz',
    ram: '4 GB DDR4 · 128 MB NAND',
    portsSummary: '1x 1G + 12x 10G SFP+ + 2x 25G SFP28',
    l3HwOffload: 'Direct CPU Lanes (40G Bus)',
    throughput: 'Up to 42 Gbps Routing',
    defaultPorts: [
      { name: 'sfp28-1', speed: '25G', role: 'Core Upstream' },
      { name: 'sfp28-2', speed: '25G', role: 'BGP Peer' },
      { name: 'sfp-sfpplus1', speed: '10G', role: 'Huawei OLT' },
      { name: 'sfp-sfpplus2', speed: '10G', role: 'BDCOM OLT' },
      { name: 'sfp-sfpplus3', speed: '10G', role: 'VSOL OLT' },
      { name: 'ether1', speed: '1G', role: 'Management' },
    ],
  },
  'CCR2116-12G-4S+': {
    model: 'CCR2116-12G-4S+',
    series: 'Cloud Core 16-Core BGP / PPPoE BRAS',
    cpu: 'AL73400 16-Core ARM64 2.0 GHz',
    ram: '16 GB DDR4 · 128 MB NAND',
    portsSummary: '13x 1G RJ45 + 4x 10G SFP+',
    l3HwOffload: 'Marvell 98DX3255 L3HW Offload',
    throughput: 'Up to 96 Gbps · Full BGP Tables',
    defaultPorts: [
      { name: 'sfp-sfpplus1', speed: '10G', role: 'IIG BGP Upstream' },
      { name: 'sfp-sfpplus2', speed: '10G', role: 'BDIX / Peering' },
      { name: 'sfp-sfpplus3', speed: '10G', role: 'OLT Aggregation' },
      { name: 'sfp-sfpplus4', speed: '10G', role: 'Core Switch' },
      { name: 'ether1', speed: '1G', role: 'LAN / Server' },
      { name: 'ether13', speed: '1G', role: 'OOB Mgmt' },
    ],
  },
  'CCR2216-12G-4XS': {
    model: 'CCR2216-12G-4XS',
    series: 'Flagship 100G Cloud Core Router',
    cpu: 'AL73400 16-Core ARM64 2.0 GHz',
    ram: '16 GB DDR4 · 128 MB NAND',
    portsSummary: '1x 1G + 12x 25G SFP28 + 2x 100G QSFP28',
    l3HwOffload: 'Marvell Prestera Aldrin2 L3HW',
    throughput: 'Up to 400+ Gbps L3HW',
    defaultPorts: [
      { name: 'qsfp28-1-1', speed: '100G', role: 'Tier-1 Upstream' },
      { name: 'qsfp28-2-1', speed: '100G', role: 'IXP Peering' },
      { name: 'sfp28-1', speed: '25G', role: 'POP Core 1' },
      { name: 'sfp28-2', speed: '25G', role: 'POP Core 2' },
      { name: 'ether1', speed: '1G', role: 'OOB Mgmt' },
    ],
  },
  'CRS326-24S+2Q+RM': {
    model: 'CRS326-24S+2Q+RM',
    series: 'Cloud Router Switch (10G/40G Core)',
    cpu: 'QCA9531 650 MHz + 98DX8332 ASIC',
    ram: '64 MB RAM · 16 MB Flash',
    portsSummary: '24x 10G SFP+ + 2x 40G QSFP+',
    l3HwOffload: 'Full L2/L3 Hardware Offload',
    throughput: '320 Gbps Non-Blocking',
    defaultPorts: [
      { name: 'qsfpplus1-1', speed: '40G', role: 'CCR Core Uplink' },
      { name: 'sfp-sfpplus1', speed: '10G', role: 'Huawei OLT' },
      { name: 'sfp-sfpplus2', speed: '10G', role: 'BDCOM OLT' },
      { name: 'sfp-sfpplus3', speed: '10G', role: 'VSOL OLT' },
      { name: 'ether1', speed: '1G', role: 'Management' },
    ],
  },
};

export const MIKROTIK_OFFICIAL_CHEATSHEET: VendorCheatItem[] = [
  // Interfaces & Bridge VLAN
  {
    id: 'mt_int_pr',
    category: 'Interfaces & Bridge VLAN',
    title: 'Show All Interfaces & Counters',
    command: '/interface print stats',
    description: 'Display operational status, Rx/Tx bytes, drops, and link-downs across all Ethernet & SFP+ ports.',
  },
  {
    id: 'mt_sfp_mon',
    category: 'Interfaces & Bridge VLAN',
    title: 'Monitor SFP+ Optical DDM Power',
    command: '/interface ethernet monitor sfp-sfpplus1 once',
    description: 'Check 10G SFP+ wavelength, Tx/Rx dBm optical power, link speed, and transceiver temperature.',
  },
  {
    id: 'mt_br_vlan',
    category: 'Interfaces & Bridge VLAN',
    title: 'Enable Hardware Bridge VLAN Filtering',
    command: '/interface bridge add name=bridge-core vlan-filtering=yes\n/interface bridge port add bridge=bridge-core interface=sfp-sfpplus1\n/interface bridge vlan add bridge=bridge-core tagged=bridge-core,sfp-sfpplus1 vlan-ids=100',
    description: 'RouterOS v7 hardware-offloaded 802.1Q bridge VLAN trunking for OLT uplinks.',
  },
  {
    id: 'mt_l3hw',
    category: 'Interfaces & Bridge VLAN',
    title: 'Verify L3 Hardware Offloading (CCR2116/2216)',
    command: '/interface ethernet switch print\n/interface ethernet switch port print',
    description: 'Check Marvell switch-chip L3HW offload state for wire-speed 10G/100G routing.',
  },
  // PPPoE & VPN
  {
    id: 'mt_ppp_act',
    category: 'PPPoE & VPN (PPTP/L2TP/SSTP)',
    title: 'List Active PPPoE / VPN Sessions',
    command: '/ppp active print',
    description: 'View live connected PPPoE, PPTP, L2TP, and SSTP clients with assigned IPs and uptime.',
  },
  {
    id: 'mt_ppp_sec',
    category: 'PPPoE & VPN (PPTP/L2TP/SSTP)',
    title: 'List All PPP Secrets',
    command: '/ppp secret print',
    description: 'Audit configured customer PPPoE and NOC VPN accounts, profiles, and static IPs.',
  },
  {
    id: 'mt_pptp_en',
    category: 'PPPoE & VPN (PPTP/L2TP/SSTP)',
    title: 'Enable PPTP, L2TP & SSTP Servers',
    command: '/interface pptp-server server set enabled=yes\n/interface l2tp-server server set enabled=yes\n/interface sstp-server server set enabled=yes',
    description: 'Turn on all three MikroTik remote VPN daemons for NOC private LAN access.',
  },
  {
    id: 'mt_pppoe_srv',
    category: 'PPPoE & VPN (PPTP/L2TP/SSTP)',
    title: 'Create PPPoE Server on OLT VLAN',
    command: '/interface pppoe-server server add service-name=ISP-PPPoE interface=vlan100 default-profile=default-encryption one-session-per-host=yes disabled=no',
    description: 'Launch an ISP PPPoE concentrator directly on customer VLAN 100.',
  },
  // Routing, BGP v7 & OSPF
  {
    id: 'mt_ip_addr',
    category: 'IP, Routing & BGP v7',
    title: 'Show IPv4 Interface Addresses',
    command: '/ip address print',
    description: 'List every assigned CIDR subnet, network, and interface binding.',
  },
  {
    id: 'mt_ip_route',
    category: 'IP, Routing & BGP v7',
    title: 'Display IPv4 Routing Table',
    command: '/ip route print',
    description: 'Inspect active default gateways, static routes, BGP, and OSPF learned routes.',
  },
  {
    id: 'mt_bgp_sess',
    category: 'IP, Routing & BGP v7',
    title: 'Check RouterOS v7 BGP Sessions',
    command: '/routing bgp session print\n/routing bgp connection print',
    description: 'Verify Established state, uptime, and prefix counts on multi-threaded ROS v7 BGP peers.',
  },
  {
    id: 'mt_bgp_adv',
    category: 'IP, Routing & BGP v7',
    title: 'View Advertised BGP Prefixes (v7)',
    command: '/routing bgp advertisements print',
    description: 'Confirm exact IPv4 prefixes being announced to upstream IIG / BDIX peers.',
  },
  {
    id: 'mt_ospf_nbr',
    category: 'IP, Routing & BGP v7',
    title: 'Check OSPF Neighbors (ROS v7)',
    command: '/routing ospf neighbor print',
    description: 'Audit OSPF Full adjacencies across POP core routers.',
  },
  // Queues & QoS
  {
    id: 'mt_q_simple',
    category: 'Queues & Bandwidth QoS',
    title: 'List Simple Queues & Live Rates',
    command: '/queue simple print stats',
    description: 'Check per-customer target IP, upload/download max-limit, and live packet/byte counters.',
  },
  {
    id: 'mt_q_add',
    category: 'Queues & Bandwidth QoS',
    title: 'Create 50M/50M Dedicated Client Queue',
    command: '/queue simple add name="Corp-50M" target=10.10.50.2/32 max-limit=50M/50M priority=4/4',
    description: 'Enforce symmetric 50 Mbps bandwidth limit with elevated priority.',
  },
  // Firewall & NAT
  {
    id: 'mt_fw_nat',
    category: 'Firewall & NAT',
    title: 'Show NAT Rules & Counters',
    command: '/ip firewall nat print stats',
    description: 'Audit Masquerade, Src-NAT (CGNAT), and Dst-NAT port forwarding hit counts.',
  },
  {
    id: 'mt_fw_filt',
    category: 'Firewall & NAT',
    title: 'Show Firewall Filter Rules',
    command: '/ip firewall filter print stats',
    description: 'Inspect Input/Forward protection rules, FastTrack counters, and dropped attack traffic.',
  },
  {
    id: 'mt_fw_fasttrack',
    category: 'Firewall & NAT',
    title: 'Enable FastTrack Connection Acceleration',
    command: '/ip firewall filter add chain=forward action=fasttrack-connection connection-state=established,related hw-offload=yes comment="FastTrack"',
    description: 'Accelerate established forwarded flows with hardware offload on CCR/RB5009.',
  },
  {
    id: 'mt_fw_conn',
    category: 'Firewall & NAT',
    title: 'Count Active NAT / Conntrack Sessions',
    command: '/ip firewall connection print count-only',
    description: 'Check total concurrent NAT sessions to monitor CGNAT load.',
  },
  // System, Security & Tools
  {
    id: 'mt_sys_res',
    category: 'System, Security & Tools',
    title: 'CPU, RAM, Uptime & Health Sensors',
    command: '/system resource print\n/system health print',
    description: 'Read RouterOS v7 version, CPU load, free memory, PSU voltage, and board temperature.',
  },
  {
    id: 'mt_ip_srv',
    category: 'System, Security & Tools',
    title: 'Audit Management Service Ports',
    command: '/ip service print',
    description: 'Check enabled ports for Winbox (8291), SSH (22), Telnet (23), API (8728), and WWW.',
  },
  {
    id: 'mt_neighbors',
    category: 'System, Security & Tools',
    title: 'Discover Neighbors (MNDP / LLDP / CDP)',
    command: '/ip neighbor print',
    description: 'List directly connected MikroTik routers, switches, and OLTs with MAC and IP.',
  },
  {
    id: 'mt_export',
    category: 'System, Security & Tools',
    title: 'Export Compact Running Config',
    command: '/export compact',
    description: 'Print complete RouterOS v7 configuration script ready for backup or migration.',
  },
  {
    id: 'mt_backup',
    category: 'System, Security & Tools',
    title: 'Save Binary Backup to Flash',
    command: '/system backup save name=noc-auto-backup',
    description: 'Create full binary .backup file inside RouterOS flash storage.',
  },
];

// ============================================================================
// 2. BDCOM EPON / GPON OLT DATASHEETS & CLI REFERENCE
// ============================================================================
export type BdcomOltModel =
  | 'P3310D'
  | 'P3608B'
  | 'P3616-2TE'
  | 'GP3600-04'
  | 'GP3600-08'
  | 'GP3600-16';

export interface BdcomModelSpec {
  model: BdcomOltModel;
  tech: 'EPON' | 'GPON';
  ponPorts: number;
  uplinkSummary: string;
  uplinkIfacePrefix: 'gigaEthernet' | 'tgigaEthernet';
  splitRatio: string;
  maxOnus: string;
  switchingCapacity: string;
  heightU: string;
}

export const BDCOM_DATASHEETS: Record<BdcomOltModel, BdcomModelSpec> = {
  P3310D: {
    model: 'P3310D',
    tech: 'EPON',
    ponPorts: 4,
    uplinkSummary: '4x GE Combo + 2x GE SFP + 2x 10G SFP+',
    uplinkIfacePrefix: 'gigaEthernet',
    splitRatio: '1:64 per PON',
    maxOnus: '256 ONUs',
    switchingCapacity: '64 Gbps',
    heightU: '1U Pizza-Box EPON OLT',
  },
  P3608B: {
    model: 'P3608B',
    tech: 'EPON',
    ponPorts: 8,
    uplinkSummary: '4x GE Copper + 4x 10G SFP+',
    uplinkIfacePrefix: 'tgigaEthernet',
    splitRatio: '1:64 per PON',
    maxOnus: '512 ONUs',
    switchingCapacity: '128 Gbps',
    heightU: '1U 8-Port EPON OLT',
  },
  'P3616-2TE': {
    model: 'P3616-2TE',
    tech: 'EPON',
    ponPorts: 16,
    uplinkSummary: '4x GE Copper + 2x GE SFP + 2x 10G SFP+',
    uplinkIfacePrefix: 'tgigaEthernet',
    splitRatio: '1:64 per PON',
    maxOnus: '1,024 ONUs',
    switchingCapacity: '176 Gbps',
    heightU: '1U 16-Port High-Density EPON',
  },
  'GP3600-04': {
    model: 'GP3600-04',
    tech: 'GPON',
    ponPorts: 4,
    uplinkSummary: '4x GE + 4x 10G SFP+',
    uplinkIfacePrefix: 'tgigaEthernet',
    splitRatio: '1:128 per PON',
    maxOnus: '512 ONTs',
    switchingCapacity: '108 Gbps',
    heightU: '1U 4-Port GPON OLT',
  },
  'GP3600-08': {
    model: 'GP3600-08',
    tech: 'GPON',
    ponPorts: 8,
    uplinkSummary: '4x GE + 4x 10G SFP+',
    uplinkIfacePrefix: 'tgigaEthernet',
    splitRatio: '1:128 per PON',
    maxOnus: '1,024 ONTs',
    switchingCapacity: '128 Gbps',
    heightU: '1U 8-Port GPON OLT',
  },
  'GP3600-16': {
    model: 'GP3600-16',
    tech: 'GPON',
    ponPorts: 16,
    uplinkSummary: '4x GE + 4x 10G SFP+ (Dual Power)',
    uplinkIfacePrefix: 'tgigaEthernet',
    splitRatio: '1:128 per PON',
    maxOnus: '2,048 ONTs',
    switchingCapacity: '256 Gbps',
    heightU: '1U 16-Port Carrier GPON OLT',
  },
};

export const BDCOM_OFFICIAL_CHEATSHEET: VendorCheatItem[] = [
  {
    id: 'bd_epon_act',
    category: 'EPON ONU Management',
    title: 'Show All Active EPON ONUs',
    command: 'show epon active-onu',
    description: 'List every online EPON ONU with Interface (epon0/1:1), MAC, Status, and Distance.',
  },
  {
    id: 'bd_epon_inact',
    category: 'EPON ONU Management',
    title: 'Show Offline / Deregistered EPON ONUs',
    command: 'show epon inactive-onu',
    description: 'Check offline ONUs with last deregister reason (power-off / wire-down / los).',
  },
  {
    id: 'bd_epon_info',
    category: 'EPON ONU Management',
    title: 'Detailed EPON ONU Information',
    command: 'show epon onu-information',
    description: 'Display ONU vendor, model, MAC, LLID, bind type, and status across all ports.',
  },
  {
    id: 'bd_epon_bind',
    category: 'EPON ONU Management',
    title: 'Bind EPON ONU by MAC Address',
    command: 'interface epon 0/1\nepon bind-onu mac 8479.73ed.02ca 1\nexit',
    description: 'Statically bind an EPON ONU MAC address to logical ID 1 on PON 0/1.',
    requiresConfig: true,
  },
  {
    id: 'bd_epon_vlan',
    category: 'EPON ONU Management',
    title: 'Set EPON ONU ETH 1 CTC Tag VLAN',
    command: 'interface epon 0/1:1\nepon onu port 1 ctc vlan mode tag 100\nexit',
    description: 'Configure customer ONU LAN port 1 to tag PPPoE traffic with VLAN 100 via CTC.',
    requiresConfig: true,
  },
  {
    id: 'bd_epon_rate',
    category: 'EPON ONU Management',
    title: 'Set EPON ONU Port Rate-Limit',
    command: 'interface epon 0/1:1\nepon onu port 1 ctc rate-limit 51200 ingress\nepon onu port 1 ctc rate-limit 51200 egress\nexit',
    description: 'Limit customer ONU UNI port 1 upstream & downstream speed in kbps.',
    requiresConfig: true,
  },
  {
    id: 'bd_epon_sla',
    category: 'EPON ONU Management',
    title: 'Configure EPON SLA Upstream Bandwidth',
    command: 'interface epon 0/1:1\nepon sla upstream pir 100000 cir 10000\nexit',
    description: 'Set LLID SLA Peak Information Rate (PIR) and Committed Information Rate (CIR).',
    requiresConfig: true,
  },
  {
    id: 'bd_gpon_act',
    category: 'GPON ONT Management',
    title: 'Show All Active GPON ONTs',
    command: 'show gpon active-onu',
    description: 'List every registered online GPON ONT on GP3600-04/08/16.',
  },
  {
    id: 'bd_gpon_inact',
    category: 'GPON ONT Management',
    title: 'Show Inactive GPON ONTs',
    command: 'show gpon inactive-onu',
    description: 'List offline GPON ONTs and dying-gasp / LOS causes.',
  },
  {
    id: 'bd_gpon_bind',
    category: 'GPON ONT Management',
    title: 'Bind GPON ONT by Serial Number',
    command: 'interface gpon 0/1\ngpon bind-onu sn HWTC1A2B3C4D 1\nexit',
    description: 'Bind GPON ONT to port 0/1 logical slot 1 using its 12/16-char SN.',
    requiresConfig: true,
  },
  {
    id: 'bd_gpon_uni',
    category: 'GPON ONT Management',
    title: 'Set GPON ONT UNI ETH 1 Native VLAN',
    command: 'interface gpon 0/1:1\ngpon onu uni 1 vlan-mode tag pvid 100\nexit',
    description: 'Assign native customer VLAN 100 to GPON ONT Ethernet port 1.',
    requiresConfig: true,
  },
  {
    id: 'bd_opt_epon_all',
    category: 'Optical & Diagnostics',
    title: 'EPON OLT SFP Optical Power Diagnosis',
    command: 'show epon optical-transceiver-diagnosis',
    description: 'Read Tx/Rx optical power, temperature, voltage, and laser bias of all EPON SFP modules.',
  },
  {
    id: 'bd_opt_epon_onu',
    category: 'Optical & Diagnostics',
    title: 'Read Specific EPON ONU Rx/Tx Power (dBm)',
    command: 'show epon interface epon 0/1:1 onu ctc optical-transceiver-diagnosis',
    description: 'Fetch real-time fiber signal strength directly from customer EPON ONU.',
  },
  {
    id: 'bd_opt_gpon_all',
    category: 'Optical & Diagnostics',
    title: 'GPON Optical Transceiver Diagnosis',
    command: 'show gpon optical-transceiver-diagnosis',
    description: 'Read GPON SFP optical diagnostics across all PON ports on GP3600.',
  },
  {
    id: 'bd_opt_gpon_onu',
    category: 'Optical & Diagnostics',
    title: 'Read Specific GPON ONT Optical Power',
    command: 'show gpon interface gpon 0/1:1 onu optical-transceiver-diagnosis',
    description: 'Fetch Rx/Tx dBm power, temperature, and voltage for GPON ONT 0/1:1.',
  },
  {
    id: 'bd_mac_all',
    category: 'Optical & Diagnostics',
    title: 'Show Learned MAC Address Table',
    command: 'show mac address-table',
    description: 'Inspect customer router / PPPoE MAC addresses across PON ports and uplinks.',
  },
  {
    id: 'bd_vlan_show',
    category: 'VLAN & Uplink Trunk',
    title: 'Show All VLANs & Member Ports',
    command: 'show vlan',
    description: 'Audit all configured VLAN IDs and tagged/untagged uplink & PON memberships.',
  },
  {
    id: 'bd_uplink_trunk',
    category: 'VLAN & Uplink Trunk',
    title: 'Configure 10G Uplink as Full VLAN Trunk',
    command: 'interface tgigaEthernet 0/1\nno shutdown\nswitchport mode trunk\nswitchport trunk vlan-allowed all\nexit',
    description: 'Enable 10G SFP+ uplink toward MikroTik / Core Router carrying all customer VLANs.',
    requiresConfig: true,
  },
  {
    id: 'bd_int_br',
    category: 'VLAN & Uplink Trunk',
    title: 'Show Brief Status of All Interfaces',
    command: 'show interface brief',
    description: 'Quick link up/down, speed, duplex, and PVID table for all OLT ports.',
  },
  {
    id: 'bd_sys_health',
    category: 'System & Save',
    title: 'Check OLT Version, CPU & Memory',
    command: 'show version\nshow cpu\nshow memory',
    description: 'Audit BDCOM NOS firmware build, uptime, CPU utilization, and RAM usage.',
  },
  {
    id: 'bd_save',
    category: 'System & Save',
    title: 'Save Full Configuration to Flash (write all)',
    command: 'write all',
    description: 'Persist running-config to startup-config flash so settings survive power loss.',
  },
];

// ============================================================================
// 3. VSOL EPON / GPON OLT DATASHEETS & CLI REFERENCE
// ============================================================================
export type VsolOltModel =
  | 'V1600D4'
  | 'V1600D8'
  | 'V1600G1-B'
  | 'V1600G2-B'
  | 'V1600GS'
  | 'V3600G1';

export interface VsolModelSpec {
  model: VsolOltModel;
  tech: 'EPON' | 'GPON';
  ponPorts: number;
  uplinkSummary: string;
  splitRatio: string;
  maxOnus: string;
  backplane: string;
  defaultCreds: string;
  heightU: string;
}

export const VSOL_DATASHEETS: Record<VsolOltModel, VsolModelSpec> = {
  V1600D4: {
    model: 'V1600D4',
    tech: 'EPON',
    ponPorts: 4,
    uplinkSummary: '4x GE Copper + 4x GE SFP (2x 10G SFP+ opt)',
    splitRatio: '1:64 per PON',
    maxOnus: '256 ONUs',
    backplane: '48 Gbps',
    defaultCreds: '192.168.8.100 · admin / Xpon@Olt9417#',
    heightU: '1U 4-Port EPON OLT',
  },
  V1600D8: {
    model: 'V1600D8',
    tech: 'EPON',
    ponPorts: 8,
    uplinkSummary: '4x GE Copper + 4x GE SFP + 4x 10G SFP+',
    splitRatio: '1:64 per PON',
    maxOnus: '512 ONUs',
    backplane: '104 Gbps',
    defaultCreds: '192.168.8.100 · admin / Xpon@Olt9417#',
    heightU: '1U 8-Port EPON OLT',
  },
  'V1600G1-B': {
    model: 'V1600G1-B',
    tech: 'GPON',
    ponPorts: 8,
    uplinkSummary: '4x GE Copper + 2x GE SFP + 2x 10G SFP+',
    splitRatio: '1:128 per PON',
    maxOnus: '1,024 ONTs',
    backplane: '108 Gbps',
    defaultCreds: '192.168.8.200 · admin / Xpon@Olt9417#',
    heightU: '1U 8-Port GPON OLT',
  },
  'V1600G2-B': {
    model: 'V1600G2-B',
    tech: 'GPON',
    ponPorts: 16,
    uplinkSummary: '4x GE Copper + 4x 10G SFP+ (Dual AC/DC)',
    splitRatio: '1:128 per PON',
    maxOnus: '2,048 ONTs',
    backplane: '200 Gbps',
    defaultCreds: '192.168.8.200 · admin / Xpon@Olt9417#',
    heightU: '1U 16-Port Carrier GPON OLT',
  },
  V1600GS: {
    model: 'V1600GS',
    tech: 'GPON',
    ponPorts: 1,
    uplinkSummary: '1x GE Copper + 1x 10G SFP+ Uplink',
    splitRatio: '1:128 per PON',
    maxOnus: '128 ONTs',
    backplane: '24 Gbps',
    defaultCreds: '192.168.8.200 · admin / Xpon@Olt9417#',
    heightU: 'Compact 1-Port Mini GPON OLT',
  },
  V3600G1: {
    model: 'V3600G1',
    tech: 'GPON',
    ponPorts: 8,
    uplinkSummary: '4x GE + 4x 10G SFP+ + 2x 25G/40G',
    splitRatio: '1:128 per PON',
    maxOnus: '1,024 ONTs',
    backplane: '320 Gbps',
    defaultCreds: '192.168.8.200 · admin / Xpon@Olt9417#',
    heightU: '1U Next-Gen Layer-3 GPON OLT',
  },
};

export const VSOL_OFFICIAL_CHEATSHEET: VendorCheatItem[] = [
  {
    id: 'vs_af_epon',
    category: 'ONU Discovery & Status',
    title: 'Show Auto-Find Unregistered EPON ONUs',
    command: 'show onu auto-find',
    description: 'Discover newly plugged unregistered EPON ONUs with MAC addresses.',
  },
  {
    id: 'vs_af_gpon',
    category: 'ONU Discovery & Status',
    title: 'Show Auto-Learn GPON ONTs (Port 0/1)',
    command: 'interface gpon 0/1\nshow onu auto-learn\nexit',
    description: 'List newly discovered GPON ONTs awaiting authorization on GPON port 0/1.',
    requiresConfig: true,
  },
  {
    id: 'vs_onu_all',
    category: 'ONU Discovery & Status',
    title: 'Show All Registered ONUs Status',
    command: 'show onu status all',
    description: 'Display online/offline state, MAC/SN, firmware, and uptime for all ONUs.',
  },
  {
    id: 'vs_onu_auth',
    category: 'ONU Discovery & Status',
    title: 'Show Authenticated ONU Info',
    command: 'show onu authinfo all',
    description: 'List every authenticated ONU binding, profile name, and serial number.',
  },
  {
    id: 'vs_opm_all',
    category: 'Optical & Diagnostics',
    title: 'All ONU Optical Power (OPM Diagnostics)',
    command: 'show onu opm-diag all',
    description: 'Bulk optical signal audit (Rx/Tx dBm, temp, voltage) across every connected ONU.',
  },
  {
    id: 'vs_pon_sfp',
    category: 'Optical & Diagnostics',
    title: 'Check OLT PON SFP Optical Transceiver',
    command: 'show pon optical transceiver',
    description: 'Read VSOL OLT PON SFP Tx power, temperature, supply voltage, and bias current.',
  },
  {
    id: 'vs_onu_opt_single',
    category: 'Optical & Diagnostics',
    title: 'Check Single ONT Optical Info (GPON 0/1:1)',
    command: 'interface gpon 0/1\nshow onu 1 optical-info\nexit',
    description: 'Inspect detailed Rx/Tx optical power for ONT 1 on GPON port 0/1.',
    requiresConfig: true,
  },
  {
    id: 'vs_mac_all',
    category: 'Optical & Diagnostics',
    title: 'Show Learned MAC Address Table',
    command: 'show mac address-table',
    description: 'View customer PPPoE/router MAC addresses learned behind ONUs and uplinks.',
  },
  {
    id: 'vs_dba_add',
    category: 'GPON Profiles (DBA / Line / Srv)',
    title: 'Create GPON DBA Profile (1G Max)',
    command: 'dba-profile add profile-id 10 profile-name "DBA_1G" type4 max 1024000',
    description: 'Create upstream Dynamic Bandwidth Allocation profile (Type 4 Best-Effort 1 Gbps).',
    requiresConfig: true,
  },
  {
    id: 'vs_line_add',
    category: 'GPON Profiles (DBA / Line / Srv)',
    title: 'Create GPON ONT Line Profile',
    command: 'ont-lineprofile gpon profile-id 10 profile-name "LINE_100"\ntcont 1 dba-profile-id 10\ngem add 1 eth tcont 1\ngem mapping 1 0 vlan 100\ncommit\nquit',
    description: 'Map T-CONT 1, GEM Port 1, and VLAN 100 for GPON ONT provisioning.',
    requiresConfig: true,
  },
  {
    id: 'vs_srv_add',
    category: 'GPON Profiles (DBA / Line / Srv)',
    title: 'Create GPON ONT Service Profile',
    command: 'ont-srvprofile gpon profile-id 10 profile-name "SRV_ETH4"\nont-port eth 4 pots 0\nport vlan eth 1 translation 100 user-vlan 100\ncommit\nquit',
    description: 'Define 4-port ETH ONT capability and UNI VLAN translation.',
    requiresConfig: true,
  },
  {
    id: 'vs_gpon_add',
    category: 'ONU Provisioning',
    title: 'Authorize GPON ONT by SN',
    command: 'interface gpon 0/1\nont add 0 1 sn-auth 48575443A1B2C301 ont-lineprofile-id 10 ont-srvprofile-id 10\nexit',
    description: 'Bind GPON ONT with Line Profile 10 & Service Profile 10.',
    requiresConfig: true,
  },
  {
    id: 'vs_epon_add',
    category: 'ONU Provisioning',
    title: 'Authorize EPON ONU by MAC',
    command: 'interface epon 0/1\nonu add 1 mac e0:67:b3:11:a4:01\nonu 1 eth 1 vlan mode tag 100\nexit',
    description: 'Register EPON ONU on port 0/1 and tag UNI Ethernet port 1 to VLAN 100.',
    requiresConfig: true,
  },
  {
    id: 'vs_vlan_all',
    category: 'VLAN & Uplink SFP+',
    title: 'Show All VLANs',
    command: 'show vlan all',
    description: 'List every VLAN ID and its tagged/untagged GE, SFP+, and PON ports.',
  },
  {
    id: 'vs_uplink_trunk',
    category: 'VLAN & Uplink SFP+',
    title: 'Configure 10G SFP+ Uplink Trunk',
    command: 'interface tengigabitethernet 0/1\nswitchport mode trunk\nswitchport trunk vlan 100-200\nno shutdown\nexit',
    description: 'Trunk customer VLAN range 100–200 on 10G SFP+ port 0/1 toward Core Router.',
    requiresConfig: true,
  },
  {
    id: 'vs_sys_info',
    category: 'System & Save',
    title: 'Show VSOL System Info & Running Config',
    command: 'show system\nshow version\nshow ip route',
    description: 'Check OLT model, CPU, memory, uptime, firmware version, and management routes.',
  },
  {
    id: 'vs_write',
    category: 'System & Save',
    title: 'Save Configuration to Flash (write)',
    command: 'write',
    description: 'Commit running configuration to non-volatile flash memory.',
  },
];

// ============================================================================
// PROMPT MODE DETECTORS & LIVE SCRIPT ADAPTERS
// ============================================================================

export function detectBdcomPromptMode(chunk: string): {
  mode: VendorPromptMode | null;
  hostname: string | null;
} {
  if (!chunk) return { mode: null, hostname: null };
  const clean = chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // e.g. BDCOM_config_epon0/1# or Switch_config_g0/1#
    const subM = line.match(/^([A-Za-z0-9_.-]{2,32})_config_([^#]+)#$/);
    if (subM) return { mode: 'subview', hostname: subM[1] };

    // e.g. Switch_config# or BDCOM_config#
    const cfgM = line.match(/^([A-Za-z0-9_.-]{2,32})_config#$/);
    if (cfgM) return { mode: 'config', hostname: cfgM[1] };

    // e.g. Switch#
    const privM = line.match(/^([A-Za-z0-9_.-]{2,32})#$/);
    if (privM && !['Username', 'Password'].includes(privM[1])) {
      return { mode: 'priv', hostname: privM[1] };
    }

    // e.g. Switch>
    const userM = line.match(/^([A-Za-z0-9_.-]{2,32})>$/);
    if (userM && !['Username', 'Password'].includes(userM[1])) {
      return { mode: 'user', hostname: userM[1] };
    }
  }
  return { mode: null, hostname: null };
}

export function detectVsolPromptMode(chunk: string): {
  mode: VendorPromptMode | null;
  hostname: string | null;
} {
  if (!chunk) return { mode: null, hostname: null };
  const clean = chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // e.g. OLT(config-pon-0/1)# or OLT(config-if-gpon-0/1)#
    const subM = line.match(/^([A-Za-z0-9_.-]{2,32})\((config-[^)]+)\)#$/);
    if (subM) return { mode: 'subview', hostname: subM[1] };

    const cfgM = line.match(/^([A-Za-z0-9_.-]{2,32})\(config\)#$/);
    if (cfgM) return { mode: 'config', hostname: cfgM[1] };

    const privM = line.match(/^([A-Za-z0-9_.-]{2,32})#$/);
    if (privM && !['Login', 'Username', 'Password'].includes(privM[1])) {
      return { mode: 'priv', hostname: privM[1] };
    }

    const userM = line.match(/^([A-Za-z0-9_.-]{2,32})>$/);
    if (userM && !['Login', 'Username', 'Password'].includes(userM[1])) {
      return { mode: 'user', hostname: userM[1] };
    }
  }
  return { mode: null, hostname: null };
}

export function detectMikroTikPrompt(chunk: string): { identity: string | null } {
  if (!chunk) return { identity: null };
  const clean = chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const m = clean.match(/\[[^\]]+@([A-Za-z0-9_.-]{2,40})\]\s*>/);
  return { identity: m ? m[1] : null };
}

export function prepareCiscoStyleScriptForPrompt(
  rawScript: string,
  currentMode: VendorPromptMode,
  isLiveTelnet: boolean,
  configCmd: 'config' | 'configure terminal'
): string[] {
  const rawLines = rawScript
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('!'));
  if (!isLiveTelnet) return rawLines;

  const body = [...rawLines];
  let needsPriv = false;
  let needsConfig = false;
  while (
    body.length > 0 &&
    ['enable', 'config', 'configure terminal', 'conf t'].includes(body[0].toLowerCase())
  ) {
    if (body[0].toLowerCase() === 'enable') needsPriv = true;
    else {
      needsPriv = true;
      needsConfig = true;
    }
    body.shift();
  }

  const prefix: string[] = [];
  if (currentMode === 'subview') {
    prefix.push('exit');
  } else if (currentMode === 'user' || currentMode === 'unknown') {
    if (needsPriv) prefix.push('enable');
    if (needsConfig) prefix.push(configCmd);
  } else if (currentMode === 'priv') {
    if (needsConfig) prefix.push(configCmd);
  }
  return [...prefix, ...body];
}
