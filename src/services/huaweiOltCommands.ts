export type HuaweiOltModel =
  | 'MA5608T'
  | 'MA5683T'
  | 'MA5680T'
  | 'MA5800-X2'
  | 'MA5800-X7'
  | 'MA5800-X15'
  | 'MA5800-X17';

export type HuaweiPonMode = 'GPON' | 'EPON' | 'XG-PON' | 'XGS-PON';

export interface HuaweiModelSpec {
  model: HuaweiOltModel;
  series: 'SmartAX MA5600T' | 'SmartAX MA5800';
  heightU: string;
  controlBoard: string;
  serviceSlots: number;
  maxPonPorts: string;
  maxOnts: string;
  switchingCapacity: string;
  uplinkBoards: string;
  ponBoards: string[];
  defaultSlots: {
    slot: number;
    board: string;
    role: string;
    mode: 'CTRL' | 'GPON' | 'EPON' | 'XGS-PON' | 'UPLINK';
    ports: number;
    status: 'Normal' | 'Active_normal' | 'Auto_find' | 'Offline';
  }[];
}

export const HUAWEI_OLT_DATASHEETS: Record<HuaweiOltModel, HuaweiModelSpec> = {
  MA5608T: {
    model: 'MA5608T',
    series: 'SmartAX MA5600T',
    heightU: '2U Mini OLT',
    controlBoard: 'MCUD / MCUD1',
    serviceSlots: 2,
    maxPonPorts: '32 GPON / 16 EPON',
    maxOnts: '4,096 ONTs',
    switchingCapacity: '360 Gbps',
    uplinkBoards: 'MCUD1 (4xGE/10GE Integrated)',
    ponBoards: ['GPFD (16P GPON)', 'GPBD (8P GPON)', 'EPBD (8P EPON)', 'XGHD (8P XG-PON)'],
    defaultSlots: [
      { slot: 0, board: 'MCUD1', role: 'Control + 4x10G', mode: 'CTRL', ports: 4, status: 'Active_normal' },
      { slot: 1, board: 'GPFD', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'EPBD', role: '8P EPON', mode: 'EPON', ports: 4, status: 'Normal' },
    ],
  },
  MA5683T: {
    model: 'MA5683T',
    series: 'SmartAX MA5600T',
    heightU: '6U Medium OLT',
    controlBoard: 'SCUN / SCUH',
    serviceSlots: 6,
    maxPonPorts: '96 GPON / 48 EPON',
    maxOnts: '12,288 ONTs',
    switchingCapacity: '960 Gbps',
    uplinkBoards: 'H801X2CS (2x10G) / GICF (2xGE)',
    ponBoards: ['GPFD (16P GPON)', 'GPBD (8P GPON)', 'EPFD (16P EPON)', 'XGHD (8P XG-PON)'],
    defaultSlots: [
      { slot: 0, board: 'SCUN', role: 'Main Control', mode: 'CTRL', ports: 0, status: 'Active_normal' },
      { slot: 1, board: 'GPFD', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'GPBD', role: '8P GPON', mode: 'GPON', ports: 4, status: 'Normal' },
      { slot: 3, board: 'EPBD', role: '8P EPON', mode: 'EPON', ports: 4, status: 'Normal' },
      { slot: 7, board: 'H801X2CS', role: '2x10G Uplink', mode: 'UPLINK', ports: 2, status: 'Normal' },
    ],
  },
  MA5680T: {
    model: 'MA5680T',
    series: 'SmartAX MA5600T',
    heightU: '11U Large OLT',
    controlBoard: 'SCUN / SCUH',
    serviceSlots: 16,
    maxPonPorts: '256 GPON / 128 EPON',
    maxOnts: '32,768 ONTs',
    switchingCapacity: '3.2 Tbps',
    uplinkBoards: 'H801X2CS (2x10G) / H802X2CS',
    ponBoards: ['GPFD (16P GPON)', 'GPBH (8P GPON)', 'EPFD (16P EPON)', 'XGHD (8P XG-PON)'],
    defaultSlots: [
      { slot: 0, board: 'GPFD', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 1, board: 'GPFD', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'EPFD', role: '16P EPON', mode: 'EPON', ports: 4, status: 'Normal' },
      { slot: 9, board: 'SCUN', role: 'Main Control', mode: 'CTRL', ports: 0, status: 'Active_normal' },
      { slot: 19, board: 'H801X2CS', role: '2x10G Uplink', mode: 'UPLINK', ports: 2, status: 'Normal' },
    ],
  },
  'MA5800-X2': {
    model: 'MA5800-X2',
    series: 'SmartAX MA5800',
    heightU: '2U Distributed NG-OLT',
    controlBoard: 'MPLA / MPLB',
    serviceSlots: 2,
    maxPonPorts: '32 GPON / 16 XGS-PON',
    maxOnts: '4,096 ONTs',
    switchingCapacity: '400 Gbps (200G/slot)',
    uplinkBoards: 'MPLA/MPLB (4x10GE Integrated)',
    ponBoards: ['H901GPHF (16P GPON)', 'H901GPSF (16P GPON)', 'H902XGHD (8P XGS-PON)', 'H901CGHD (8P Combo)'],
    defaultSlots: [
      { slot: 0, board: 'MPLA', role: 'Control + 4x10G', mode: 'CTRL', ports: 4, status: 'Active_normal' },
      { slot: 1, board: 'H901GPHF', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'H902XGHD', role: '8P XGS-PON', mode: 'XGS-PON', ports: 4, status: 'Normal' },
    ],
  },
  'MA5800-X7': {
    model: 'MA5800-X7',
    series: 'SmartAX MA5800',
    heightU: '6U Distributed NG-OLT',
    controlBoard: 'MPLA / MPLB',
    serviceSlots: 7,
    maxPonPorts: '112 GPON / 56 XGS-PON',
    maxOnts: '14,336 ONTs',
    switchingCapacity: '7 Tbps (200G/slot)',
    uplinkBoards: 'MPLA/MPLB (4x10GE) + H901NXED (8x10GE)',
    ponBoards: ['H901GPHF (16P GPON)', 'H901GPSF (16P GPON)', 'H902XGHD (8P XGS-PON)', 'H901CGHD (8P Combo)'],
    defaultSlots: [
      { slot: 1, board: 'H901GPHF', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'H901GPSF', role: '16P GPON', mode: 'GPON', ports: 4, status: 'Normal' },
      { slot: 3, board: 'H902XGHD', role: '8P XGS-PON', mode: 'XGS-PON', ports: 4, status: 'Normal' },
      { slot: 8, board: 'MPLA', role: 'Main Control', mode: 'CTRL', ports: 4, status: 'Active_normal' },
      { slot: 9, board: 'H901NXED', role: '8x10G Uplink', mode: 'UPLINK', ports: 4, status: 'Normal' },
    ],
  },
  'MA5800-X15': {
    model: 'MA5800-X15',
    series: 'SmartAX MA5800',
    heightU: '11U Core NG-OLT',
    controlBoard: 'MPLA / MPLB',
    serviceSlots: 15,
    maxPonPorts: '240 GPON / 120 XGS-PON',
    maxOnts: '30,720 ONTs',
    switchingCapacity: '15 Tbps (200G/slot)',
    uplinkBoards: 'MPLA/MPLB + H901NXED (8x10GE) / H901CIUA (40G/100G)',
    ponBoards: ['H901GPHF (16P GPON)', 'H901GPSF (16P GPON)', 'H902XGHD (8P XGS-PON)', 'H901CGHD (8P Combo)'],
    defaultSlots: [
      { slot: 1, board: 'H901GPHF', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'H901GPHF', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 3, board: 'H902XGHD', role: '8P XGS-PON', mode: 'XGS-PON', ports: 4, status: 'Normal' },
      { slot: 9, board: 'MPLA', role: 'Main Control', mode: 'CTRL', ports: 4, status: 'Active_normal' },
      { slot: 18, board: 'H901NXED', role: '8x10G Uplink', mode: 'UPLINK', ports: 4, status: 'Normal' },
    ],
  },
  'MA5800-X17': {
    model: 'MA5800-X17',
    series: 'SmartAX MA5800',
    heightU: '11U Flagship NG-OLT',
    controlBoard: 'MPLA / MPLB',
    serviceSlots: 17,
    maxPonPorts: '272 GPON / 136 XGS-PON',
    maxOnts: '34,816 ONTs',
    switchingCapacity: '17 Tbps (200G/slot)',
    uplinkBoards: 'MPLA/MPLB + H901CIUA (100GE) / H901NXED (8x10GE)',
    ponBoards: ['H901GPHF (16P GPON)', 'H901GPSF (16P GPON)', 'H902XGHD (8P XGS-PON)', 'H901CGHD (8P Combo)'],
    defaultSlots: [
      { slot: 1, board: 'H901GPHF', role: '16P GPON', mode: 'GPON', ports: 8, status: 'Normal' },
      { slot: 2, board: 'H902XGHD', role: '8P XGS-PON', mode: 'XGS-PON', ports: 4, status: 'Normal' },
      { slot: 3, board: 'H901CGHD', role: '8P Combo PON', mode: 'GPON', ports: 4, status: 'Normal' },
      { slot: 9, board: 'MPLB', role: 'Main Control', mode: 'CTRL', ports: 4, status: 'Active_normal' },
      { slot: 19, board: 'H901CIUA', role: '2x100G Uplink', mode: 'UPLINK', ports: 2, status: 'Normal' },
    ],
  },
};

export interface HuaweiCheatSheetItem {
  id: string;
  category:
    | 'Boards & Hardware'
    | 'ONT Provisioning'
    | 'Optical & Rogue ONT'
    | 'Service-Port & QinQ'
    | 'DBA / Line / Srv Profiles'
    | 'VLAN & Uplink'
    | 'L3 IP & Routing'
    | 'System & Security';
  title: string;
  command: string;
  description: string;
  requiresConfig?: boolean;
}

export const HUAWEI_OFFICIAL_CHEATSHEET: HuaweiCheatSheetItem[] = [
  // Boards & Hardware
  {
    id: 'hw_brd_show',
    category: 'Boards & Hardware',
    title: 'Display Chassis Boards',
    command: 'display board 0',
    description: 'Show all slots, board models (GPFD/H901GPHF/MCUD1/MPLA), and Auto_find / Normal status.',
  },
  {
    id: 'hw_brd_confirm_all',
    category: 'Boards & Hardware',
    title: 'Confirm All Auto-Find Boards',
    command: 'board confirm 0',
    description: 'Activate every newly inserted GPON/EPON/XGS-PON board waiting in Auto_find state.',
    requiresConfig: true,
  },
  {
    id: 'hw_brd_cpu',
    category: 'Boards & Hardware',
    title: 'Control Board CPU & Memory',
    command: 'display cpu 0/0\ndisplay mem 0/0\ndisplay temperature 0',
    description: 'Audit main control board CPU load, RAM usage, and thermal sensors.',
  },
  {
    id: 'hw_brd_ver',
    category: 'Boards & Hardware',
    title: 'OLT Version & Patch Info',
    command: 'display version\ndisplay patch all',
    description: 'Inspect MA5600T/MA5800 software version, uptime, and installed hotfix patches.',
  },
  {
    id: 'hw_pon_autofind_en',
    category: 'Boards & Hardware',
    title: 'Enable Auto-Find on PON Port',
    command: 'interface gpon 0/1\nport 0 ont-auto-find enable\nquit',
    description: 'Allow OLT to automatically discover newly plugged ONUs on GPON port 0/1/0.',
    requiresConfig: true,
  },
  {
    id: 'hw_pon_ddm',
    category: 'Boards & Hardware',
    title: 'OLT PON SFP Optical DDM Info',
    command: 'interface gpon 0/1\ndisplay port ddm-info 0\nquit',
    description: 'Read OLT GPON SFP transceiver Tx power, temperature, bias current, and voltage.',
    requiresConfig: true,
  },

  // ONT Provisioning
  {
    id: 'hw_ont_autofind',
    category: 'ONT Provisioning',
    title: 'Scan Unregistered ONTs (All)',
    command: 'display ont autofind all',
    description: 'List all newly connected GPON/EPON/XGS-PON ONTs awaiting registration across the chassis.',
  },
  {
    id: 'hw_ont_info_all',
    category: 'ONT Provisioning',
    title: 'Show All Registered ONTs',
    command: 'display ont info 0 all',
    description: 'Display Frame/Slot/Port, ONT ID, Serial Number, Control Flag, Run State, and Config State.',
  },
  {
    id: 'hw_ont_summary',
    category: 'ONT Provisioning',
    title: 'PON Port ONT Summary',
    command: 'display ont info summary 0/1',
    description: 'Quick online vs. offline ONT counts per PON port on slot 0/1.',
  },
  {
    id: 'hw_ont_bysn',
    category: 'ONT Provisioning',
    title: 'Find ONT by Serial Number',
    command: 'display ont info by-sn 48575443A1B2C301',
    description: 'Locate exact F/S/P, ONT ID, run state, and last down cause by GPON SN.',
  },
  {
    id: 'hw_ont_bymac',
    category: 'ONT Provisioning',
    title: 'Find ONT by MAC Address',
    command: 'display ont info by-mac e067-b311-a401',
    description: 'Locate EPON ONT or CPE MAC across all PON ports.',
  },
  {
    id: 'hw_ont_port_state',
    category: 'ONT Provisioning',
    title: 'Check ONT UNI Ethernet Ports',
    command: 'interface gpon 0/1\ndisplay ont port state 0 0 eth-port all\nquit',
    description: 'Check LAN link up/down, speed (100M/1000M), and duplex on customer ONT ETH ports.',
    requiresConfig: true,
  },
  {
    id: 'hw_ont_version',
    category: 'ONT Provisioning',
    title: 'Check ONT Model & Firmware',
    command: 'interface gpon 0/1\ndisplay ont version 0 0\nquit',
    description: 'Read vendor ID, hardware model (e.g. HG8245H5), and main/standby software version.',
    requiresConfig: true,
  },

  // Optical & Rogue ONT
  {
    id: 'hw_opt_ont',
    category: 'Optical & Rogue ONT',
    title: 'Read ONT Optical Power (dBm)',
    command: 'interface gpon 0/1\ndisplay ont optical-info 0 0\nquit',
    description: 'Check ONT Rx/Tx optical power, OLT Rx power, temperature, voltage, and laser bias.',
    requiresConfig: true,
  },
  {
    id: 'hw_opt_all_port',
    category: 'Optical & Rogue ONT',
    title: 'All ONT Optical Power on Port',
    command: 'interface gpon 0/1\ndisplay ont optical-info 0 all\nquit',
    description: 'Bulk optical signal audit for every ONT on GPON port 0/1/0 to spot weak fiber splices.',
    requiresConfig: true,
  },
  {
    id: 'hw_rogue_show',
    category: 'Optical & Rogue ONT',
    title: 'Check Rogue ONT on Board',
    command: 'display rogue-ont gpon 0/1',
    description: 'Detect continuous-wave rogue ONTs disrupting an entire GPON splitter tree.',
    requiresConfig: true,
  },
  {
    id: 'hw_rogue_detect',
    category: 'Optical & Rogue ONT',
    title: 'Trigger Rogue ONT Detection',
    command: 'interface gpon 0/1\nport 0 rogue-ont-detect enable\nquit',
    description: 'Enable hardware rogue ONT auto-detection on GPON port 0/1/0.',
    requiresConfig: true,
  },
  {
    id: 'hw_alarm_active',
    category: 'Optical & Rogue ONT',
    title: 'Show Active OLT Alarms',
    command: 'display alarm active all',
    description: 'Inspect live LOS, Dying-Gasp, LoFi, high-temperature, and uplink-down alarms.',
  },

  // Service-Port & QinQ
  {
    id: 'hw_sp_all',
    category: 'Service-Port & QinQ',
    title: 'List All Service-Ports',
    command: 'display service-port all',
    description: 'Show index, VLAN, F/S/P, ONT ID, GEM port, user-VLAN, and RX/TX traffic-table state.',
  },
  {
    id: 'hw_sp_port',
    category: 'Service-Port & QinQ',
    title: 'Service-Ports by PON Port',
    command: 'display service-port port 0/1/0',
    description: 'List every VLAN service-port binding on GPON 0/1/0.',
  },
  {
    id: 'hw_sp_qinq',
    category: 'Service-Port & QinQ',
    title: 'Create QinQ Double-Tag Service-Port',
    command:
      'service-port vlan 500 gpon 0/1/0 ont 0 gemport 1 multi-service user-vlan 100 tag-transform add-double inner-vlan 100 inbound traffic-table index 10 outbound traffic-table index 10',
    description: 'Encapsulate customer C-VLAN 100 inside ISP S-VLAN 500 (802.1ad QinQ stacking).',
    requiresConfig: true,
  },
  {
    id: 'hw_mac_all',
    category: 'Service-Port & QinQ',
    title: 'Show Learned MAC Table',
    command: 'display mac-address all',
    description: 'Inspect customer router / PPPoE MAC addresses learned on service-ports & uplinks.',
  },

  // DBA / Line / Srv Profiles
  {
    id: 'hw_dba_all',
    category: 'DBA / Line / Srv Profiles',
    title: 'Display All DBA Profiles',
    command: 'display dba-profile all',
    description: 'View upstream T-CONT bandwidth profiles (Type 1–5 Fixed / Assured / Max).',
  },
  {
    id: 'hw_lp_all',
    category: 'DBA / Line / Srv Profiles',
    title: 'Display GPON Line Profiles',
    command: 'display ont-lineprofile gpon all',
    description: 'List all GPON line profiles defining T-CONT, GEM port, and VLAN mappings.',
  },
  {
    id: 'hw_sp_prof_all',
    category: 'DBA / Line / Srv Profiles',
    title: 'Display GPON Service Profiles',
    command: 'display ont-srvprofile gpon all',
    description: 'List all GPON service profiles defining ETH/POTS ports and transparent/VLAN modes.',
  },
  {
    id: 'hw_tt_all',
    category: 'DBA / Line / Srv Profiles',
    title: 'Display IP Traffic Tables',
    command: 'display traffic table ip from-index 0',
    description: 'Inspect CIR / PIR / Priority QoS rate-limiting profiles applied to service-ports.',
  },

  // VLAN & Uplink
  {
    id: 'hw_vlan_all',
    category: 'VLAN & Uplink',
    title: 'Display All VLANs',
    command: 'display vlan all',
    description: 'List smart, mux, standard, and QinQ VLANs with uplink port memberships.',
  },
  {
    id: 'hw_uplink_eth',
    category: 'VLAN & Uplink',
    title: 'Check Uplink Ethernet Status',
    command: 'display interface eth 0/9',
    description: 'Inspect 10G SFP+ uplink link status, speed, CRC errors, and traffic counters.',
  },
  {
    id: 'hw_lacp_all',
    category: 'VLAN & Uplink',
    title: 'Check Uplink LACP / Link-Aggregation',
    command: 'display link-aggregation all',
    description: 'Verify bundled 10G uplink LAG ports toward core MikroTik / Cisco / Juniper routers.',
  },

  // L3 IP & Routing
  {
    id: 'hw_ip_int_br',
    category: 'L3 IP & Routing',
    title: 'Display L3 Vlanif Interfaces',
    command: 'display ip interface brief',
    description: 'Show management Vlanif and Meth0 IPv4 addresses and operational status.',
  },
  {
    id: 'hw_ip_route',
    category: 'L3 IP & Routing',
    title: 'Display IPv4 Routing Table',
    command: 'display ip routing-table',
    description: 'Audit default gateway and static routes to NOC management subnets.',
  },
  {
    id: 'hw_arp_all',
    category: 'L3 IP & Routing',
    title: 'Display ARP Table',
    command: 'display arp all',
    description: 'Check resolved next-hop gateway and core router MAC addresses.',
  },

  // System & Security
  {
    id: 'hw_cur_cfg',
    category: 'System & Security',
    title: 'Display Running Configuration',
    command: 'display current-configuration',
    description: 'Export full active Huawei OLT configuration (use with scroll enabled).',
  },
  {
    id: 'hw_users',
    category: 'System & Security',
    title: 'Display OLT Admin Users',
    command: 'display terminal user all',
    description: 'Audit all Telnet/SSH admin accounts, privilege levels, and active sessions.',
  },
  {
    id: 'hw_save',
    category: 'System & Security',
    title: 'Save Running Config to Flash',
    command: 'save',
    description: 'Commit active configuration to flash so changes survive OLT reboot.',
  },
];

export type HuaweiPromptMode = 'unknown' | 'user' | 'priv' | 'config' | 'subview';

/**
 * Detects Huawei OLT prompt mode from live Telnet output so GUI-pushed scripts
 * automatically transition cleanly into (config)# without emitting "% Unknown command".
 */
export function detectHuaweiPromptMode(chunk: string): {
  mode: HuaweiPromptMode | null;
  sysname: string | null;
} {
  if (!chunk) return { mode: null, sysname: null };
  // Strip ANSI escape sequences
  const clean = chunk.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    // e.g. MA5608T(config-if-gpon-0/1)# or MA5800(config-gpon-lineprofile-10)#
    const subM = line.match(/^([A-Za-z0-9_.-]{2,32})\((config-[^)]+)\)#$/);
    if (subM) return { mode: 'subview', sysname: subM[1] };

    // e.g. MA5608T(config)#
    const cfgM = line.match(/^([A-Za-z0-9_.-]{2,32})\(config\)#$/);
    if (cfgM) return { mode: 'config', sysname: cfgM[1] };

    // e.g. MA5608T#
    const privM = line.match(/^([A-Za-z0-9_.-]{2,32})#$/);
    if (privM && !['User', 'Password'].includes(privM[1])) {
      return { mode: 'priv', sysname: privM[1] };
    }

    // e.g. MA5608T>
    const userM = line.match(/^([A-Za-z0-9_.-]{2,32})>$/);
    if (userM && !['User', 'Password'].includes(userM[1])) {
      return { mode: 'user', sysname: userM[1] };
    }
  }
  return { mode: null, sysname: null };
}

/**
 * Normalizes a Huawei CLI script for a live Telnet session based on the detected prompt mode.
 * Prevents sending `enable` / `config` when already in `(config)#` or exits sub-views cleanly first.
 */
export function prepareHuaweiScriptForPrompt(
  rawScript: string,
  currentMode: HuaweiPromptMode,
  isLiveTelnet: boolean
): string[] {
  const rawLines = rawScript
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('!'));

  if (!isLiveTelnet) return rawLines;

  // Strip leading enable/config so we re-apply exact needed transitions for currentMode
  const body = [...rawLines];
  let needsConfig = false;
  let needsPriv = false;
  while (body.length > 0 && (body[0].toLowerCase() === 'enable' || body[0].toLowerCase() === 'config')) {
    if (body[0].toLowerCase() === 'enable') needsPriv = true;
    if (body[0].toLowerCase() === 'config') {
      needsPriv = true;
      needsConfig = true;
    }
    body.shift();
  }

  const prefix: string[] = [];
  if (currentMode === 'subview') {
    prefix.push('quit');
    // Returning one level up from config-if-* lands in (config)#
  } else if (currentMode === 'user') {
    if (needsPriv) prefix.push('enable');
    if (needsConfig) prefix.push('config');
  } else if (currentMode === 'priv') {
    if (needsConfig) prefix.push('config');
  } else if (currentMode === 'unknown') {
    if (needsPriv) prefix.push('enable');
    if (needsConfig) prefix.push('config');
  }
  // If currentMode === 'config', no prefix needed!

  return [...prefix, ...body];
}

/**
 * Returns true if Huawei OLT typically waits for an extra <CR> confirmation (`{ <cr>|... }:`)
 * after executing this command over interactive Telnet.
 */
export function huaweiCommandNeedsCrConfirm(cmd: string): boolean {
  const lower = cmd.trim().toLowerCase();
  return (
    lower === 'save' ||
    lower.startsWith('board confirm') ||
    lower.startsWith('service-port ') ||
    lower.startsWith('undo service-port ') ||
    lower.startsWith('ont add ') ||
    lower.startsWith('ont confirm ') ||
    lower.startsWith('dba-profile add ') ||
    lower.startsWith('traffic table ip ') ||
    lower.startsWith('display ont autofind') ||
    lower.startsWith('display ont info') ||
    lower.startsWith('display service-port') ||
    lower.startsWith('display board') ||
    lower.startsWith('display mac-address') ||
    lower.startsWith('display vlan') ||
    lower.startsWith('display ip routing-table')
  );
}
