import { TerminalVendor } from '../types/vpn';

export interface CliNode {
  name: string;
  desc: string;
  children?: CliNode[];
}

export interface CliHelpResult {
  header: string;
  matches: { name: string; desc: string }[];
  formatted: string;
}

export interface CliTabResult {
  completed: string;
  changed: boolean;
  matches: { name: string; desc: string }[];
  formatted?: string;
}

const MIKROTIK_TREE: CliNode[] = [
  {
    name: '/interface',
    desc: 'Interface configuration & monitoring',
    children: [
      { name: 'print', desc: 'Show all network interfaces and status' },
      { name: 'ethernet', desc: 'Ethernet port settings & link status', children: [{ name: 'print', desc: 'List Ethernet ports' }, { name: 'monitor', desc: 'Monitor live link rate/duplex' }, { name: 'set', desc: 'Modify Ethernet parameters' }] },
      { name: 'bridge', desc: 'Bridge interfaces and ports', children: [{ name: 'print', desc: 'List bridges' }, { name: 'port', desc: 'Bridge port assignments', children: [{ name: 'print', desc: 'Show bridge ports' }, { name: 'add', desc: 'Add interface to bridge' }] }] },
      { name: 'vlan', desc: '802.1Q VLAN sub-interfaces', children: [{ name: 'print', desc: 'List VLAN interfaces' }, { name: 'add', desc: 'Create VLAN interface' }] },
      { name: 'pptp-server', desc: 'PPTP VPN server settings', children: [{ name: 'server', desc: 'PPTP server daemon', children: [{ name: 'print', desc: 'Show PPTP server status' }, { name: 'set', desc: 'Enable/configure PPTP server' }] }, { name: 'print', desc: 'List PPTP server bindings' }] },
      { name: 'pppoe-server', desc: 'PPPoE concentrator settings', children: [{ name: 'server', desc: 'PPPoE server instances', children: [{ name: 'print', desc: 'List PPPoE servers' }] }] },
      { name: 'wireguard', desc: 'WireGuard tunnel interfaces', children: [{ name: 'print', desc: 'List WireGuard interfaces' }] },
      { name: 'monitor-traffic', desc: 'Real-time Rx/Tx bandwidth monitor' },
    ],
  },
  {
    name: '/ip',
    desc: 'IPv4 addressing, routing, firewall & services',
    children: [
      {
        name: 'address',
        desc: 'IPv4 interface addresses',
        children: [
          { name: 'print', desc: 'Show all configured IPv4 addresses' },
          { name: 'add', desc: 'Assign new IP/CIDR to an interface' },
          { name: 'set', desc: 'Edit existing IP address entry' },
          { name: 'remove', desc: 'Delete IP address entry' },
          { name: 'export', desc: 'Export IP address configuration' },
        ],
      },
      {
        name: 'route',
        desc: 'Static & dynamic routing table',
        children: [
          { name: 'print', desc: 'Display IPv4 routing table' },
          { name: 'add', desc: 'Add static route' },
          { name: 'remove', desc: 'Remove route' },
          { name: 'check', desc: 'Check gateway reachability for destination' },
        ],
      },
      {
        name: 'firewall',
        desc: 'Firewall filter, NAT, mangle & address-lists',
        children: [
          { name: 'filter', desc: 'Packet filter rules', children: [{ name: 'print', desc: 'List filter rules' }, { name: 'add', desc: 'Add filter rule' }] },
          { name: 'nat', desc: 'Source/Destination NAT rules', children: [{ name: 'print', desc: 'List NAT rules' }, { name: 'add', desc: 'Add NAT rule' }] },
          { name: 'mangle', desc: 'Packet marking rules', children: [{ name: 'print', desc: 'List mangle rules' }] },
          { name: 'address-list', desc: 'Dynamic/static IP lists', children: [{ name: 'print', desc: 'Show address lists' }] },
          { name: 'connection', desc: 'Active connection tracking table', children: [{ name: 'print', desc: 'Show active connections' }] },
        ],
      },
      { name: 'dns', desc: 'DNS resolver & static entries', children: [{ name: 'print', desc: 'Show DNS servers' }, { name: 'set', desc: 'Configure DNS servers' }] },
      { name: 'pool', desc: 'IP address pools (DHCP/PPP)', children: [{ name: 'print', desc: 'Show IP pools' }, { name: 'add', desc: 'Create IP pool' }] },
      { name: 'arp', desc: 'ARP neighbor table', children: [{ name: 'print', desc: 'Show ARP table' }] },
      { name: 'neighbor', desc: 'MNDP/CDP/LLDP discovered neighbors', children: [{ name: 'print', desc: 'List discovered neighbors' }] },
      { name: 'service', desc: 'Management services (Telnet, SSH, Winbox, API)', children: [{ name: 'print', desc: 'List service ports & status' }, { name: 'set', desc: 'Enable/disable management service' }] },
      { name: 'dhcp-server', desc: 'DHCP server & leases', children: [{ name: 'print', desc: 'Show DHCP servers' }, { name: 'lease', desc: 'DHCP leases', children: [{ name: 'print', desc: 'List active DHCP leases' }] }] },
    ],
  },
  {
    name: '/ppp',
    desc: 'PPTP, L2TP, PPPoE & SSTP accounts and profiles',
    children: [
      { name: 'secret', desc: 'PPP user credentials', children: [{ name: 'print', desc: 'List all PPP secrets' }, { name: 'add', desc: 'Create PPP user secret' }, { name: 'remove', desc: 'Remove PPP secret' }] },
      { name: 'profile', desc: 'PPP connection profiles', children: [{ name: 'print', desc: 'List PPP profiles' }, { name: 'add', desc: 'Add PPP profile' }] },
      { name: 'active', desc: 'Currently connected PPP sessions', children: [{ name: 'print', desc: 'Show active PPP tunnels' }] },
      { name: 'aaa', desc: 'PPP RADIUS / AAA settings', children: [{ name: 'print', desc: 'Show AAA settings' }] },
    ],
  },
  {
    name: '/routing',
    desc: 'BGP, OSPF & routing policy',
    children: [
      { name: 'bgp', desc: 'BGP sessions & connections', children: [{ name: 'connection', desc: 'BGP peers', children: [{ name: 'print', desc: 'Show BGP peers' }] }, { name: 'session', desc: 'Active BGP sessions', children: [{ name: 'print', desc: 'Show BGP session state' }] }] },
      { name: 'ospf', desc: 'OSPF areas & neighbors', children: [{ name: 'neighbor', desc: 'OSPF adjacencies', children: [{ name: 'print', desc: 'Show OSPF neighbors' }] }] },
    ],
  },
  {
    name: '/system',
    desc: 'RouterOS hardware, identity, health & reboot',
    children: [
      { name: 'resource', desc: 'CPU, RAM, uptime & board model', children: [{ name: 'print', desc: 'Show system resources' }] },
      { name: 'identity', desc: 'Router hostname', children: [{ name: 'print', desc: 'Show hostname' }, { name: 'set', desc: 'Change router identity' }] },
      { name: 'clock', desc: 'System date & time', children: [{ name: 'print', desc: 'Show clock' }] },
      { name: 'routerboard', desc: 'Firmware & BIOS info', children: [{ name: 'print', desc: 'Show RouterBOARD info' }] },
      { name: 'package', desc: 'Installed RouterOS packages', children: [{ name: 'print', desc: 'List installed packages' }] },
      { name: 'backup', desc: 'Binary backup management', children: [{ name: 'save', desc: 'Save backup file' }] },
      { name: 'reboot', desc: 'Reboot MikroTik router' },
      { name: 'telnet', desc: 'Open outbound Telnet client' },
      { name: 'ssh', desc: 'Open outbound SSH client' },
    ],
  },
  {
    name: '/tool',
    desc: 'Network diagnostics (ping, traceroute, torch)',
    children: [
      { name: 'ping', desc: 'Send ICMP Echo probes' },
      { name: 'traceroute', desc: 'Trace IP path hop-by-hop' },
      { name: 'torch', desc: 'Live traffic flow inspector' },
      { name: 'bandwidth-test', desc: 'Throughput test to remote MikroTik' },
      { name: 'netwatch', desc: 'Host availability monitor', children: [{ name: 'print', desc: 'List netwatch probes' }] },
    ],
  },
  { name: '/queue', desc: 'Simple queues & QoS bandwidth shaping', children: [{ name: 'simple', desc: 'Simple per-IP queues', children: [{ name: 'print', desc: 'Show simple queues' }] }] },
  { name: '/log', desc: 'System event logs', children: [{ name: 'print', desc: 'Display recent logs' }] },
  { name: '/user', desc: 'RouterOS login users & groups', children: [{ name: 'print', desc: 'List local users' }, { name: 'active', desc: 'Logged-in admins', children: [{ name: 'print', desc: 'Show active admin sessions' }] }] },
  { name: '/export', desc: 'Export full RouterOS configuration script' },
  { name: '/ping', desc: 'Quick ICMP ping (e.g. /ping 8.8.8.8 count=4)' },
  { name: 'telnet', desc: 'Connect live Telnet from terminal (telnet <IP> [port])' },
  { name: 'clear', desc: 'Clear terminal screen' },
  { name: 'help', desc: 'Display quick command overview' },
];

const BDCOM_TREE: CliNode[] = [
  { name: 'enable', desc: 'Enter Privileged EXEC mode (#)' },
  {
    name: 'config',
    desc: 'Enter Global Configuration mode',
    children: [{ name: 'terminal', desc: 'Configure from terminal (config)# ' }],
  },
  {
    name: 'show',
    desc: 'Display OLT / Switch running status & optical diagnostics',
    children: [
      {
        name: 'epon',
        desc: 'EPON OLT ports & ONU management',
        children: [
          { name: 'active-onu', desc: 'List all online/registered EPON ONUs' },
          { name: 'inactive-onu', desc: 'List offline/deregistered EPON ONUs' },
          { name: 'onu-information', desc: 'Show detailed ONU MAC, distance & status' },
          { name: 'optical-transceiver-diagnosis', desc: 'Read EPON OLT SFP Tx/Rx optical power' },
          { name: 'interface', desc: 'Show EPON PON port summary & ONU optical Rx' },
          { name: 'basic-info', desc: 'Show EPON hardware & chipset info' },
        ],
      },
      {
        name: 'gpon',
        desc: 'GPON OLT ports & ONT management',
        children: [
          { name: 'active-onu', desc: 'List all online GPON ONUs/ONTs' },
          { name: 'inactive-onu', desc: 'List offline GPON ONUs' },
          { name: 'onu-information', desc: 'Show GPON ONT serial number & profile' },
          { name: 'optical-transceiver-diagnosis', desc: 'Read GPON OLT SFP optical power' },
          { name: 'onu-optical-transceiver-diagnosis', desc: 'Read remote ONU Rx/Tx dBm power' },
        ],
      },
      {
        name: 'interface',
        desc: 'Show physical, PON & VLAN interfaces',
        children: [
          { name: 'brief', desc: 'Summary of all interfaces (link/speed/duplex)' },
          { name: 'epon', desc: 'Specific EPON interface counters' },
          { name: 'gpon', desc: 'Specific GPON interface counters' },
          { name: 'gigaEthernet', desc: 'Gigabit uplink interface details' },
          { name: 'tgigaEthernet', desc: '10G SFP+ uplink interface details' },
          { name: 'vlan', desc: 'Layer-3 VLAN interface IP & status' },
        ],
      },
      {
        name: 'mac',
        desc: 'Layer-2 MAC forwarding table',
        children: [{ name: 'address-table', desc: 'Show learned MAC addresses per VLAN/PON' }],
      },
      { name: 'vlan', desc: 'Show configured VLANs and tagged/untagged ports' },
      { name: 'running-config', desc: 'Display active OLT/Switch configuration' },
      { name: 'startup-config', desc: 'Display saved NVRAM startup configuration' },
      { name: 'ip', desc: 'IP routing & interface info', children: [{ name: 'route', desc: 'Show IPv4 routing table' }, { name: 'interface', desc: 'Show L3 IP interfaces' }] },
      { name: 'arp', desc: 'Show ARP table' },
      { name: 'cpu', desc: 'Display CPU utilization' },
      { name: 'memory', desc: 'Display RAM usage' },
      { name: 'version', desc: 'Show BDCOM firmware version & uptime' },
      { name: 'logging', desc: 'Display OLT syslog buffer' },
    ],
  },
  {
    name: 'interface',
    desc: 'Select interface to configure (config mode)',
    children: [
      { name: 'epon', desc: 'EPON PON interface (e.g. epon 0/1)' },
      { name: 'gpon', desc: 'GPON PON interface (e.g. gpon 0/1)' },
      { name: 'gigaEthernet', desc: 'Gigabit Ethernet uplink (e.g. gigaEthernet 0/1)' },
      { name: 'tgigaEthernet', desc: '10G SFP+ uplink (e.g. tgigaEthernet 0/1)' },
      { name: 'vlan', desc: 'SVI management VLAN (e.g. vlan 100)' },
    ],
  },
  { name: 'vlan', desc: 'Create or modify VLAN ID' },
  { name: 'write', desc: 'Save running-config to flash memory', children: [{ name: 'all', desc: 'Save full configuration to startup-config' }] },
  { name: 'ping', desc: 'Send ICMP ping to remote IP' },
  { name: 'traceroute', desc: 'Trace route to destination IP' },
  { name: 'telnet', desc: 'Connect live Telnet (telnet <IP> [port])' },
  { name: 'reboot', desc: 'Restart BDCOM OLT / Switch' },
  { name: 'exit', desc: 'Exit current mode or Telnet session' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const CISCO_TREE: CliNode[] = [
  { name: 'enable', desc: 'Turn on Privileged EXEC mode (#)' },
  {
    name: 'configure',
    desc: 'Enter Global Configuration mode',
    children: [{ name: 'terminal', desc: 'Configure from the terminal (config)#' }],
  },
  {
    name: 'show',
    desc: 'Show running system information',
    children: [
      {
        name: 'ip',
        desc: 'IPv4 status and tables',
        children: [
          { name: 'interface', desc: 'IP interface status', children: [{ name: 'brief', desc: 'Summary of IP addresses and link status' }] },
          { name: 'route', desc: 'IPv4 routing table' },
          { name: 'bgp', desc: 'BGP summary & neighbors', children: [{ name: 'summary', desc: 'Summary of BGP neighbor status' }] },
          { name: 'ospf', desc: 'OSPF neighbor & database info', children: [{ name: 'neighbor', desc: 'List OSPF neighbor routers' }] },
          { name: 'arp', desc: 'ARP cache table' },
          { name: 'nat', desc: 'NAT translations & statistics', children: [{ name: 'translations', desc: 'Active NAT sessions' }] },
        ],
      },
      { name: 'running-config', desc: 'Current operating configuration' },
      { name: 'startup-config', desc: 'Contents of startup configuration' },
      { name: 'interfaces', desc: 'Interface status, speed & error counters', children: [{ name: 'status', desc: 'One-line switchport status table' }, { name: 'trunk', desc: 'Active 802.1Q trunk ports' }] },
      { name: 'vlan', desc: 'VLAN database information', children: [{ name: 'brief', desc: 'Concise VLAN list and member ports' }] },
      { name: 'mac', desc: 'MAC address table', children: [{ name: 'address-table', desc: 'Dynamic & static MAC forwarding entries' }] },
      { name: 'cdp', desc: 'Cisco Discovery Protocol neighbors', children: [{ name: 'neighbors', desc: 'Connected Cisco devices' }] },
      { name: 'lldp', desc: 'LLDP neighbor devices', children: [{ name: 'neighbors', desc: 'Connected LLDP devices' }] },
      { name: 'spanning-tree', desc: 'STP topology & root bridge state' },
      { name: 'version', desc: 'Cisco IOS version, model & uptime' },
      { name: 'logging', desc: 'Syslog buffer messages' },
    ],
  },
  {
    name: 'interface',
    desc: 'Select interface to configure',
    children: [
      { name: 'GigabitEthernet', desc: 'Gigabit Ethernet interface (e.g. GigabitEthernet0/1)' },
      { name: 'TenGigabitEthernet', desc: '10G SFP+ interface' },
      { name: 'Vlan', desc: 'Switched Virtual Interface (e.g. Vlan100)' },
      { name: 'Loopback', desc: 'Loopback interface' },
    ],
  },
  { name: 'copy', desc: 'Copy configuration or image files', children: [{ name: 'running-config', desc: 'Copy running config', children: [{ name: 'startup-config', desc: 'Save to NVRAM startup-config' }] }] },
  { name: 'write', desc: 'Save running configuration', children: [{ name: 'memory', desc: 'Write config to NVRAM' }] },
  { name: 'ping', desc: 'Send echo messages (e.g. ping 10.99.0.1)' },
  { name: 'traceroute', desc: 'Trace route to destination' },
  { name: 'telnet', desc: 'Open live Telnet connection (telnet <IP> [port])' },
  { name: 'reload', desc: 'Halt and perform a cold restart' },
  { name: 'exit', desc: 'Exit current mode' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const HUAWEI_TREE: CliNode[] = [
  { name: 'enable', desc: 'Enter Privileged EXEC mode (#) on MA5600T / MA5800 OLT' },
  { name: 'config', desc: 'Enter Global Configuration mode (config)# on Huawei OLT' },
  { name: 'sysname', desc: 'Set OLT / Router hostname (e.g. sysname HUAWEI-MA5608T-01)' },
  { name: 'system-view', desc: 'Enter Huawei VRP system view [Huawei]' },
  {
    name: 'board',
    desc: 'Confirm, add, delete or reset OLT chassis service boards',
    children: [
      { name: 'confirm', desc: 'Confirm Auto_find boards (board confirm 0 or board confirm 0/1)' },
      { name: 'add', desc: 'Pre-provision board in slot (board add 0/1 H901GPHF)' },
      { name: 'reset', desc: 'Warm-reset service board (board reset 0/1)' },
      { name: 'delete', desc: 'Remove unequipped board configuration (board delete 0/1)' },
    ],
  },
  {
    name: 'dba-profile',
    desc: 'Configure upstream Dynamic Bandwidth Assignment (Type 1–5)',
    children: [
      { name: 'add', desc: 'Create DBA profile (dba-profile add profile-id 10 profile-name "100M" type4 max 102400)' },
      { name: 'modify', desc: 'Modify existing DBA profile parameters' },
      { name: 'delete', desc: 'Delete unused DBA profile (dba-profile delete profile-id 10)' },
    ],
  },
  {
    name: 'ont-lineprofile',
    desc: 'Configure GPON/EPON ONT T-CONT, GEM port & VLAN mapping profiles',
    children: [
      { name: 'gpon', desc: 'GPON line profile (ont-lineprofile gpon profile-id 10 profile-name "FTTH")' },
      { name: 'epon', desc: 'EPON line profile (ont-lineprofile epon profile-id 10)' },
    ],
  },
  {
    name: 'ont-srvprofile',
    desc: 'Configure GPON/EPON ONT UNI Ethernet/POTS/VLAN service profiles',
    children: [
      { name: 'gpon', desc: 'GPON service profile (ont-srvprofile gpon profile-id 10 profile-name "BRIDGE")' },
      { name: 'epon', desc: 'EPON service profile (ont-srvprofile epon profile-id 10)' },
    ],
  },
  {
    name: 'traffic',
    desc: 'Configure IP QoS rate-limiting traffic tables (CIR/PIR/Priority)',
    children: [
      { name: 'table', desc: 'Traffic table commands', children: [{ name: 'ip', desc: 'Create IP traffic table (traffic table ip index 10 name "50M" cir 51200 pir 51200 priority 0 priority-policy local-setting)' }] },
    ],
  },
  {
    name: 'display',
    desc: 'Display Huawei OLT / VRP ONUs, optical power, boards, profiles & routes',
    children: [
      {
        name: 'ont',
        desc: 'GPON / EPON / XGS-PON ONT status, autofind & optical diagnostics',
        children: [
          {
            name: 'autofind',
            desc: 'Discover unregistered ONUs on PON ports',
            children: [
              { name: 'all', desc: 'List all auto-found unregistered ONTs across OLT' },
              { name: '0', desc: 'Show auto-found ONTs on specific PON port (e.g. 0)' },
            ],
          },
          {
            name: 'info',
            desc: 'Query ONUs by port, SN, MAC or description',
            children: [
              { name: '0 all', desc: 'Show all registered ONTs in frame 0' },
              { name: 'by-sn', desc: 'Find GPON ONT by Serial Number (display ont info by-sn <SN>)' },
              { name: 'by-mac', desc: 'Find EPON ONT by MAC address (display ont info by-mac <MAC>)' },
              { name: 'by-desc', desc: 'Find ONT by customer description' },
              { name: 'summary', desc: 'Show ONT online/offline summary per PON port' },
            ],
          },
          { name: 'optical-info', desc: 'Read ONT Rx/Tx optical power, temp & voltage (dBm)' },
          { name: 'version', desc: 'Display ONT hardware model & firmware version' },
          { name: 'port', desc: 'Display ONT UNI Ethernet port state (display ont port state <p> <id> eth-port all)' },
          { name: 'capability', desc: 'Show ONT hardware port & OMCI capabilities' },
        ],
      },
      { name: 'ont-lineprofile', desc: 'Display GPON/EPON line profiles', children: [{ name: 'gpon all', desc: 'List all GPON line profiles' }, { name: 'epon all', desc: 'List all EPON line profiles' }] },
      { name: 'ont-srvprofile', desc: 'Display GPON/EPON service profiles', children: [{ name: 'gpon all', desc: 'List all GPON service profiles' }, { name: 'epon all', desc: 'List all EPON service profiles' }] },
      { name: 'dba-profile', desc: 'Display upstream DBA bandwidth profiles', children: [{ name: 'all', desc: 'List all DBA profiles' }] },
      { name: 'traffic', desc: 'Display QoS traffic tables', children: [{ name: 'table ip from-index 0', desc: 'List all IP traffic tables' }] },
      { name: 'port', desc: 'Display PON port state & optical SFP DDM', children: [{ name: 'ddm-info', desc: 'Show OLT SFP Tx power, temp & bias (display port ddm-info <p>)' }, { name: 'state', desc: 'Show PON port operational state' }] },
      { name: 'optic-info', desc: 'Show OLT PON optical transceiver parameters (display optic-info 0/1/0)' },
      { name: 'rogue-ont', desc: 'Check rogue ONT detection status (display rogue-ont gpon 0/1)' },
      {
        name: 'ip',
        desc: 'IPv4 interfaces & routing table',
        children: [
          { name: 'interface', desc: 'L3 IP interface summary', children: [{ name: 'brief', desc: 'Brief IP status of vlanif & meth interfaces' }] },
          { name: 'routing-table', desc: 'Display active IPv4 static & connected routes' },
        ],
      },
      { name: 'service-port', desc: 'Display VLAN service-port bindings', children: [{ name: 'all', desc: 'List all service-port entries' }, { name: 'port', desc: 'Filter service-ports by F/S/P' }, { name: 'vlan', desc: 'Filter service-ports by VLAN ID' }] },
      { name: 'board', desc: 'Display OLT chassis slots, boards & status (display board 0)', children: [{ name: '0', desc: 'Show all boards in Frame 0' }] },
      { name: 'mac-address', desc: 'Display learned MAC table', children: [{ name: 'all', desc: 'Show all MAC entries' }, { name: 'port', desc: 'Filter MACs by PON port/ONT' }, { name: 'vlan', desc: 'Filter MACs by VLAN ID' }, { name: 'service-port', desc: 'Filter MACs by service-port index' }] },
      { name: 'vlan', desc: 'Display VLANs and uplink/PON memberships', children: [{ name: 'all', desc: 'Show all configured VLANs' }] },
      { name: 'link-aggregation', desc: 'Display LACP uplink trunk bundles', children: [{ name: 'all', desc: 'Show all link-aggregation groups' }] },
      { name: 'current-configuration', desc: 'Display active running configuration' },
      { name: 'saved-configuration', desc: 'Display saved flash configuration' },
      { name: 'interface', desc: 'Display interface counters', children: [{ name: 'brief', desc: 'Brief link/bandwidth table' }, { name: 'eth', desc: 'Show uplink Ethernet board counters' }, { name: 'vlanif', desc: 'Show management Vlanif IP' }] },
      { name: 'arp', desc: 'Display ARP cache table', children: [{ name: 'all', desc: 'All ARP entries' }] },
      { name: 'version', desc: 'Display Huawei OLT software version & uptime' },
      { name: 'patch', desc: 'Display installed hotfix patches', children: [{ name: 'all', desc: 'Show all patches' }] },
      { name: 'cpu', desc: 'Display main control board CPU load (display cpu 0/0)' },
      { name: 'mem', desc: 'Display board RAM utilization (display mem 0/0)' },
      { name: 'temperature', desc: 'Display board temperature sensors (display temperature 0)' },
      { name: 'terminal', desc: 'Display Telnet/SSH admin accounts', children: [{ name: 'user all', desc: 'List all configured OLT users' }] },
      { name: 'alarm', desc: 'Display active alarms & optical warnings', children: [{ name: 'active all', desc: 'Show all active alarms' }] },
    ],
  },
  {
    name: 'interface',
    desc: 'Enter GPON / EPON / XGS-PON / Vlanif / Uplink interface config mode',
    children: [
      { name: 'gpon', desc: 'Enter GPON board view (e.g. interface gpon 0/1)' },
      { name: 'epon', desc: 'Enter EPON board view (e.g. interface epon 0/3)' },
      { name: 'xgpon', desc: 'Enter XG-PON / XGS-PON board view (e.g. interface xgpon 0/2)' },
      { name: 'vlanif', desc: 'Enter L3 Management VLAN interface (e.g. interface vlanif 100)' },
      { name: 'eth', desc: 'Enter Uplink Ethernet board (e.g. interface eth 0/9)' },
      { name: 'meth', desc: 'Enter Out-of-band management port (interface meth 0)' },
      { name: 'GigabitEthernet', desc: 'Enter VRP GE interface (e.g. GigabitEthernet0/0/1)' },
    ],
  },
  {
    name: 'ont',
    desc: 'Provision, modify, reset, deactivate or delete ONUs inside PON view',
    children: [
      { name: 'add', desc: 'Add GPON (sn-auth) or EPON (mac-auth) ONU to PON port' },
      { name: 'delete', desc: 'Delete registered ONU from PON port (ont delete <port> <id>)' },
      { name: 'confirm', desc: 'Confirm auto-found ONU directly by port/SN' },
      {
        name: 'port',
        desc: 'Configure ONU UNI Ethernet port',
        children: [
          { name: 'native-vlan', desc: 'Set native VLAN on ONU eth port (ont port native-vlan <p> <id> eth 1 vlan <v> priority 0)' },
          { name: 'attribute', desc: 'Enable/disable ONT UNI Ethernet port (ont port attribute <p> <id> eth 1 operational-state on|off)' },
        ],
      },
      { name: 'reset', desc: 'Reboot remote ONU (ont reset <port> <id>)' },
      { name: 'factory-setting-restore', desc: 'Reset remote ONU back to factory defaults' },
      { name: 'modify', desc: 'Modify ONU description, line-profile or srv-profile live' },
      { name: 'deactivate', desc: 'Administratively disable/suspend ONU (or isolate rogue ONT)' },
      { name: 'activate', desc: 'Re-enable deactivated ONU' },
    ],
  },
  {
    name: 'service-port',
    desc: 'Bind ONU GEM/VLAN traffic to OLT uplink VLAN (Standard or QinQ)',
    children: [
      { name: 'vlan', desc: 'Create service-port (service-port vlan <v> gpon <f/s/p> ont <id> gemport 1 multi-service user-vlan <v> tag-transform translate)' },
    ],
  },
  {
    name: 'rogue-ont',
    desc: 'Run rogue ONT isolation & scan commands',
    children: [{ name: 'detect', desc: 'Trigger rogue ONT scan on GPON board (rogue-ont detect gpon 0/1)' }],
  },
  {
    name: 'ip',
    desc: 'Configure static routes & IPv4 parameters',
    children: [
      { name: 'route-static', desc: 'Add static IP route (ip route-static <dst> <mask> <next-hop>)' },
      { name: 'address', desc: 'Assign IPv4 address inside vlanif (ip address <ip> <mask>)' },
    ],
  },
  {
    name: 'undo',
    desc: 'Remove service-port, static route, VLAN, shutdown or traffic table',
    children: [
      { name: 'service-port', desc: 'Delete service-port by index or port/ONT' },
      { name: 'shutdown', desc: 'Administratively enable PON or Ethernet port (undo shutdown <port>)' },
      { name: 'ip', desc: 'Remove IP route or address', children: [{ name: 'route-static', desc: 'Delete static route (undo ip route-static <dst> <mask> <gw>)' }] },
      { name: 'vlan', desc: 'Delete VLAN ID' },
      { name: 'port', desc: 'Remove VLAN from uplink port' },
      { name: 'traffic', desc: 'Delete IP traffic table (undo traffic table ip index <idx>)' },
      { name: 'mac-address', desc: 'Clear specific MAC entry from table' },
    ],
  },
  { name: 'shutdown', desc: 'Administratively disable PON or Uplink Ethernet port (shutdown <port>)' },
  {
    name: 'vlan',
    desc: 'Create smart/mux/standard/QinQ VLANs',
    children: [
      { name: 'attrib', desc: 'Set VLAN attribute (vlan attrib <id> q-in-q | stacking)' },
      { name: 'desc', desc: 'Set VLAN description (vlan desc <id> description "<name>")' },
    ],
  },
  {
    name: 'port',
    desc: 'Configure uplink VLAN tagging & PON port auto-find / rogue detection',
    children: [
      { name: 'vlan', desc: 'Allow VLAN on uplink port (port vlan <id> 0/9 0)' },
    ],
  },
  { name: 'ntp-service', desc: 'Configure NTP time sync server (ntp-service unicast-server <IP>)' },
  { name: 'terminal', desc: 'Manage OLT Telnet/SSH users', children: [{ name: 'user', desc: 'Add or modify admin user (terminal user name)' }] },
  { name: 'scroll', desc: 'Disable interactive paging on Huawei OLT (scroll)' },
  { name: 'screen-length', desc: 'Set terminal page length', children: [{ name: '0 temporary', desc: 'Disable --More-- pagination for current session' }] },
  { name: 'save', desc: 'Save running OLT configuration to flash memory' },
  { name: 'ping', desc: 'Send ICMP ping probes from OLT' },
  { name: 'tracert', desc: 'Trace route to destination IP' },
  { name: 'telnet', desc: 'Open live Telnet connection (telnet <IP> [port])' },
  { name: 'quit', desc: 'Exit current view one level up' },
  { name: 'return', desc: 'Return directly to Privileged mode (#)' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const VSOL_TREE: CliNode[] = [
  { name: 'enable', desc: 'Enter Privileged EXEC mode (#)' },
  { name: 'configure', desc: 'Enter Global Configuration mode', children: [{ name: 'terminal', desc: 'Configure from terminal' }] },
  {
    name: 'show',
    desc: 'Display VSOL EPON/GPON OLT diagnostics & status',
    children: [
      {
        name: 'onu',
        desc: 'ONU authentication, state & optical power',
        children: [
          { name: 'authinfo', desc: 'Show authenticated ONUs (show onu authinfo all)' },
          { name: 'state', desc: 'Show online/offline ONU state' },
          { name: 'optical-ddm', desc: 'Read ONU Rx/Tx optical power (dBm)' },
          { name: 'mac-address', desc: 'Show MACs learned behind ONUs' },
        ],
      },
      {
        name: 'pon',
        desc: 'PON port optical & ONU overview',
        children: [
          { name: 'onu-information', desc: 'List all PON ONUs and status' },
          { name: 'optical', desc: 'Show PON SFP transceiver diagnostics', children: [{ name: 'transceiver', desc: 'Temperature, voltage & Tx power' }] },
        ],
      },
      { name: 'vlan', desc: 'Show VLAN table', children: [{ name: 'all', desc: 'Display all configured VLANs' }] },
      { name: 'interface', desc: 'Show GE/SFP+/PON/VLAN interfaces', children: [{ name: 'brief', desc: 'Brief interface link status' }] },
      { name: 'mac', desc: 'MAC address table', children: [{ name: 'address-table', desc: 'Show learned MAC table' }] },
      { name: 'running-config', desc: 'Show active OLT configuration' },
      { name: 'system', desc: 'Show VSOL OLT model, CPU & uptime' },
      { name: 'ip', desc: 'Show L3 management IP & routes', children: [{ name: 'route', desc: 'Show IPv4 routing table' }] },
    ],
  },
  { name: 'interface', desc: 'Select GE, PON or VLAN interface', children: [{ name: 'epon', desc: 'EPON port' }, { name: 'gpon', desc: 'GPON port' }, { name: 'vlan', desc: 'Management VLAN interface' }] },
  { name: 'write', desc: 'Save running config to flash' },
  { name: 'ping', desc: 'Ping remote host' },
  { name: 'telnet', desc: 'Open live Telnet (telnet <IP> [port])' },
  { name: 'exit', desc: 'Exit current mode' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const PALO_ALTO_TREE: CliNode[] = [
  { name: 'configure', desc: 'Enter PAN-OS configuration mode (#)' },
  {
    name: 'show',
    desc: 'Display firewall operational state & telemetry',
    children: [
      {
        name: 'system',
        desc: 'System hardware, version & resources',
        children: [
          { name: 'info', desc: 'Show PAN-OS version, model, management IP & uptime' },
          { name: 'resources', desc: 'Display CPU, memory & load average' },
          { name: 'software', desc: 'Show installed PAN-OS images' },
        ],
      },
      {
        name: 'interface',
        desc: 'Firewall dataplane & management interfaces',
        children: [
          { name: 'all', desc: 'Display all hardware & logical interfaces' },
          { name: 'logical', desc: 'Show L3 IP addresses, zones & virtual-routers' },
          { name: 'management', desc: 'Show management interface IP & speed' },
        ],
      },
      {
        name: 'routing',
        desc: 'Virtual router FIB & RIB tables',
        children: [
          { name: 'route', desc: 'Show IPv4 routing table' },
          { name: 'fib', desc: 'Show Forwarding Information Base' },
          { name: 'protocol', desc: 'Show BGP/OSPF routing protocol status' },
        ],
      },
      { name: 'session', desc: 'Active firewall sessions', children: [{ name: 'info', desc: 'Show session count, CPS & throughput' }, { name: 'all', desc: 'List active sessions' }] },
      { name: 'high-availability', desc: 'HA cluster status', children: [{ name: 'state', desc: 'Show Active/Passive HA status' }] },
      { name: 'arp', desc: 'Show ARP entries', children: [{ name: 'all', desc: 'All ARP cache entries' }] },
    ],
  },
  {
    name: 'set',
    desc: 'Set CLI options or firewall config',
    children: [
      { name: 'cli', desc: 'CLI display settings', children: [{ name: 'pager', desc: 'Enable/disable paging', children: [{ name: 'off', desc: 'Disable CLI pager' }] }, { name: 'config-output-format', desc: 'Output format (set/xml)' }] },
      { name: 'deviceconfig', desc: 'Management & system services', children: [{ name: 'system', desc: 'System management config', children: [{ name: 'service', desc: 'Toggle Telnet/SSH/HTTP services' }] }] },
      { name: 'network', desc: 'Interfaces, zones & virtual-routers' },
    ],
  },
  { name: 'commit', desc: 'Commit candidate configuration changes' },
  { name: 'ping', desc: 'Ping host (e.g. ping host 8.8.8.8)' },
  { name: 'traceroute', desc: 'Trace path (e.g. traceroute host 8.8.8.8)' },
  { name: 'telnet', desc: 'Open live Telnet (telnet <IP> [port])' },
  { name: 'exit', desc: 'Exit current mode' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const JUNIPER_TREE: CliNode[] = [
  { name: 'configure', desc: 'Enter Junos OS configuration mode (#)' },
  {
    name: 'show',
    desc: 'Display Junos OS operational state, interfaces, BGP, routes & security',
    children: [
      {
        name: 'interfaces',
        desc: 'Interface status, IPs & optical diagnostics',
        children: [
          { name: 'terse', desc: 'Concise summary of all interfaces & IPv4/IPv6 addresses' },
          { name: 'diagnostics', desc: 'Optical DOM transceiver telemetry', children: [{ name: 'optics', desc: 'Read SFP+/QSFP Rx/Tx optical power (dBm)' }] },
          { name: 'descriptions', desc: 'Show interface labels & link states' },
          { name: 'extensive', desc: 'Detailed interface counters, drops & errors' },
        ],
      },
      {
        name: 'route',
        desc: 'IPv4/IPv6 routing table (inet.0 / inet6.0)',
        children: [
          { name: 'summary', desc: 'Summary count of active/hidden routes per protocol' },
          { name: 'receive-protocol', desc: 'Show routes received from BGP/OSPF peer', children: [{ name: 'bgp', desc: 'Received BGP prefixes from neighbor IP' }] },
          { name: 'advertising-protocol', desc: 'Show routes advertised to BGP peer', children: [{ name: 'bgp', desc: 'Advertised BGP prefixes to neighbor IP' }] },
          { name: 'protocol', desc: 'Filter routes by static/direct/ospf/bgp' },
        ],
      },
      {
        name: 'bgp',
        desc: 'BGP sessions & neighbor telemetry',
        children: [
          { name: 'summary', desc: 'Overview of all BGP neighbors, ASN & prefix counts' },
          { name: 'neighbor', desc: 'Detailed BGP peer session & capabilities' },
        ],
      },
      {
        name: 'ospf',
        desc: 'OSPF adjacencies & LSDB',
        children: [
          { name: 'neighbor', desc: 'List OSPF neighbors and Full/2Way state' },
          { name: 'database', desc: 'Display OSPF link-state database' },
          { name: 'interface', desc: 'Display OSPF enabled interfaces' },
        ],
      },
      {
        name: 'chassis',
        desc: 'Hardware modules, FPCs, Routing Engine & alarms',
        children: [
          { name: 'hardware', desc: 'List FPCs, PICs, optics & serial numbers' },
          { name: 'routing-engine', desc: 'Monitor RE CPU, RAM, temp & uptime' },
          { name: 'alarms', desc: 'Display active hardware alarms' },
          { name: 'environment', desc: 'Display fans, PSUs & temperature sensors' },
        ],
      },
      {
        name: 'system',
        desc: 'System uptime, users, storage & alarms',
        children: [
          { name: 'uptime', desc: 'Show boot time & system uptime' },
          { name: 'alarms', desc: 'Show active system alarms' },
          { name: 'users', desc: 'List currently logged-in CLI users' },
          { name: 'commit', desc: 'Show recent Junos commit history' },
        ],
      },
      { name: 'vlans', desc: 'Display EX/QFX VLANs and member interfaces' },
      { name: 'ethernet-switching', desc: 'L2 switching tables (ELS)', children: [{ name: 'table', desc: 'Show learned MAC address table' }] },
      { name: 'lldp', desc: 'LLDP neighbor discovery', children: [{ name: 'neighbors', desc: 'Show connected LLDP devices' }] },
      { name: 'lacp', desc: 'AE LACP link aggregation', children: [{ name: 'interfaces', desc: 'Show LACP bundle status' }] },
      { name: 'virtual-chassis', desc: 'EX/QFX stack state', children: [{ name: 'status', desc: 'Show Virtual Chassis members & roles' }] },
      {
        name: 'security',
        desc: 'SRX firewall zones, policies, NAT & IPsec VPN',
        children: [
          { name: 'zones', desc: 'Show SRX security zones & interfaces' },
          { name: 'policies', desc: 'Show security firewall policies' },
          { name: 'flow', desc: 'Active dataplane sessions', children: [{ name: 'session', desc: 'Show flow sessions', children: [{ name: 'summary', desc: 'Count active SRX sessions' }] }] },
          { name: 'nat', desc: 'Source/Destination/Static NAT', children: [{ name: 'source', desc: 'Source NAT stats', children: [{ name: 'summary', desc: 'Source NAT rule summary' }] }] },
          { name: 'ike', desc: 'IPsec Phase-1 IKE', children: [{ name: 'security-associations', desc: 'Active IKE SAs' }] },
          { name: 'ipsec', desc: 'IPsec Phase-2 tunnels', children: [{ name: 'security-associations', desc: 'Active IPsec SAs' }] },
        ],
      },
      { name: 'configuration', desc: 'Display active Junos configuration (add | display set)' },
      { name: 'arp', desc: 'Show ARP cache', children: [{ name: 'no-resolve', desc: 'Fast numeric ARP table' }] },
      { name: 'version', desc: 'Display Junos OS version & model' },
    ],
  },
  {
    name: 'set',
    desc: 'Add/modify candidate Junos configuration (config mode)',
    children: [
      { name: 'system', desc: 'Hostname, login, services & NTP', children: [{ name: 'host-name', desc: 'Set Junos hostname' }, { name: 'services', desc: 'Enable ssh/telnet/netconf' }] },
      { name: 'interfaces', desc: 'Configure xe-/et-/ge-/irb/lo0 interfaces & IPs' },
      { name: 'routing-options', desc: 'Static routes, router-id & AS number', children: [{ name: 'static', desc: 'Configure static routes (route <dst> next-hop <gw>)' }] },
      { name: 'vlans', desc: 'Create VLANs and L3 IRB bindings' },
      { name: 'protocols', desc: 'Configure BGP, OSPF, RSTP, LLDP' },
      { name: 'security', desc: 'Configure SRX zones, policies & NAT' },
    ],
  },
  { name: 'delete', desc: 'Remove a statement from candidate configuration' },
  {
    name: 'commit',
    desc: 'Activate candidate Junos configuration',
    children: [
      { name: 'check', desc: 'Validate configuration without applying' },
      { name: 'confirmed', desc: 'Safe commit with auto-rollback timer (e.g. commit confirmed 5)' },
      { name: 'and-quit', desc: 'Commit and exit configuration mode' },
    ],
  },
  { name: 'rollback', desc: 'Restore previous configuration (e.g. rollback 0 / rollback 1)' },
  { name: 'request', desc: 'System operational actions (reboot, snapshot, support)', children: [{ name: 'system', desc: 'System actions (reboot / power-off / snapshot)' }] },
  { name: 'monitor', desc: 'Real-time interface & packet monitoring', children: [{ name: 'interface', desc: 'Live interface bandwidth/errors (monitor interface traffic)' }] },
  { name: 'ping', desc: 'Send ICMP ping (e.g. ping 8.8.8.8 rapid count 5)' },
  { name: 'traceroute', desc: 'Trace path hop-by-hop' },
  { name: 'telnet', desc: 'Open live Telnet (telnet <IP> [port])' },
  { name: 'exit', desc: 'Exit current mode' },
  { name: 'clear', desc: 'Clear terminal screen' },
];

const ZTE_TREE: CliNode[] = [
  {
    name: 'show',
    desc: 'Display ZTE ZXA10 C300/C320/C600 OLT operational status',
    children: [
      {
        name: 'gpon',
        desc: 'GPON OLT & ONU status',
        children: [
          {
            name: 'onu',
            desc: 'ONU state, unconfigured list, optical power & details',
            children: [
              { name: 'uncfg', desc: 'List newly discovered unregistered GPON ONUs (SN)' },
              { name: 'state', desc: 'Show GPON ONU phase state (e.g. gpon-olt_1/2/1)' },
              { name: 'detail-info', desc: 'Detailed ONU info, uptime, last offline reason' },
              { name: 'by', desc: 'Find ONU by SN (show gpon onu by sn <SN>)' },
            ],
          },
        ],
      },
      {
        name: 'pon',
        desc: 'PON optical power & diagnostics',
        children: [
          { name: 'power', desc: 'Check ONU/OLT Rx/Tx optical power (onu-rx / olt-rx)' },
        ],
      },
      { name: 'card', desc: 'Show OLT rack/shelf/slot boards (GTGO/GTGH/SCXM)' },
      { name: 'mac', desc: 'Display Layer-2 MAC table (by PON/ONU/VLAN)' },
      { name: 'vlan', desc: 'Show VLAN database & port bindings (summary / <id>)' },
      { name: 'interface', desc: 'Show gei / xgei / smartgroup / vlan interfaces' },
      { name: 'ip', desc: 'Show IPv4 interface & route table (route / interface brief)' },
      { name: 'running-config', desc: 'Display running configuration (or interface <port>)' },
    ],
  },
  { name: 'configure', desc: 'Enter global configuration mode (configure terminal)', children: [{ name: 'terminal', desc: 'Configure from terminal' }] },
  {
    name: 'interface',
    desc: 'Enter PON, ONU, Uplink, or VLAN interface mode',
    children: [
      { name: 'gpon-olt_1/2/1', desc: 'Enter GPON OLT port 1/2/1 to add/delete ONU' },
      { name: 'gpon-onu_1/2/1:1', desc: 'Configure ONU service-port, tcont & gemport' },
      { name: 'xgei_1/19/1', desc: 'Configure 10G SFP+ uplink port' },
      { name: 'vlan', desc: 'Configure Layer-3 management VLAN interface' },
    ],
  },
  { name: 'pon-onu-mng', desc: 'Enter OMCI remote management for ONU (pon-onu-mng gpon-onu_1/2/1:1)' },
  { name: 'onu', desc: 'Register ONU under gpon-olt port (onu <id> type <model> sn <SN>)' },
  { name: 'vlan', desc: 'Create/edit VLAN ID' },
  { name: 'ip', desc: 'Configure IP route (ip route 0.0.0.0 0.0.0.0 <gw>)' },
  { name: 'hostname', desc: 'Set ZTE OLT hostname' },
  { name: 'write', desc: 'Save running configuration to flash' },
  { name: 'reboot', desc: 'Reboot OLT or ONU (under pon-onu-mng)' },
  { name: 'exit', desc: 'Exit current mode' },
];

const CDATA_TREE: CliNode[] = [
  {
    name: 'show',
    desc: 'Display C-Data FD1608S/FD1616S GPON & FD1208S EPON status',
    children: [
      {
        name: 'ont',
        desc: 'ONT/ONU discovery, status & optical diagnostics',
        children: [
          { name: 'autofind', desc: 'Find unregistered ONUs (show ont autofind all)' },
          { name: 'info', desc: 'Show registered ONU table (show ont info 0 all)' },
          { name: 'optical-info', desc: 'Check ONU Rx/Tx optical power (show ont optical-info 0/0/1 all)' },
          { name: 'port', desc: 'Show ONU ETH UNI port state' },
        ],
      },
      { name: 'mac-address', desc: 'Show MAC forwarding table (all / vlan / ont)' },
      { name: 'vlan', desc: 'Show VLAN configuration (show vlan all)' },
      { name: 'interface', desc: 'Show GE/XGE/PON interface link status' },
      { name: 'ip', desc: 'Show management IP & static routes (route / interface)' },
      { name: 'service-port', desc: 'Show service-port VLAN mappings (all)' },
      { name: 'running-config', desc: 'Display active OLT configuration' },
    ],
  },
  { name: 'enable', desc: 'Enter privileged mode (#)' },
  { name: 'config', desc: 'Enter global configuration mode (config)#' },
  { name: 'interface', desc: 'Enter gpon / epon / ge / xge / vlanif interface' },
  { name: 'ont', desc: 'Add/delete/reboot ONT (ont add <port> <id> sn-auth ...)' },
  { name: 'service-port', desc: 'Create VLAN service-port for ONU' },
  { name: 'vlan', desc: 'Create/edit VLAN' },
  { name: 'sysname', desc: 'Set C-Data OLT hostname' },
  { name: 'save', desc: 'Save configuration to flash' },
  { name: 'exit', desc: 'Exit current mode' },
];

const ARISTA_TREE: CliNode[] = [
  {
    name: 'show',
    desc: 'Display Arista EOS switch & core router telemetry',
    children: [
      {
        name: 'interfaces',
        desc: 'Interface link, status, trunk & transceiver optics',
        children: [
          { name: 'status', desc: 'All switchports link state, VLAN, speed & duplex' },
          { name: 'trunk', desc: '802.1Q trunk ports & allowed VLANs' },
          { name: 'transceiver', desc: 'SFP+/QSFP28 DOM optical power & temp' },
          { name: 'counters', desc: 'Packet/byte & error counters' },
        ],
      },
      { name: 'ip', desc: 'IPv4 interfaces, routes, BGP & OSPF', children: [{ name: 'interface', desc: 'brief' }, { name: 'route', desc: 'Routing table' }, { name: 'bgp', desc: 'BGP summary / neighbors' }, { name: 'ospf', desc: 'OSPF neighbor / database' }] },
      { name: 'vlan', desc: 'Display VLAN database & member ports' },
      { name: 'mac', desc: 'Layer-2 MAC address-table (show mac address-table)' },
      { name: 'port-channel', desc: 'LACP Port-Channel summary (show port-channel summary)' },
      { name: 'mlag', desc: 'Multi-Chassis LAG status & peer link' },
      { name: 'spanning-tree', desc: 'STP/RSTP/MSTP root & port states' },
      { name: 'lldp', desc: 'LLDP neighbor discovery (neighbors detail)' },
      { name: 'running-config', desc: 'Display active EOS configuration' },
      { name: 'version', desc: 'Show Arista EOS version, model & uptime' },
    ],
  },
  { name: 'enable', desc: 'Enter privileged EXEC mode' },
  { name: 'configure', desc: 'Enter global config mode (configure terminal)' },
  { name: 'interface', desc: 'Configure Ethernet / Port-Channel / Vlan / Loopback' },
  { name: 'router', desc: 'Configure BGP or OSPF (router bgp <ASN> / router ospf <id>)' },
  { name: 'vlan', desc: 'Create/edit VLAN ID' },
  { name: 'hostname', desc: 'Set Arista switch hostname' },
  { name: 'write', desc: 'Save running config (write memory)' },
  { name: 'exit', desc: 'Exit current mode' },
];

const RUIJIE_TREE: CliNode[] = [
  {
    name: 'show',
    desc: 'Display Ruijie RGOS switch & ISP router state',
    children: [
      {
        name: 'interfaces',
        desc: 'Interface status, switchport, trunk & counters',
        children: [
          { name: 'status', desc: 'Show port link status, VLAN & speed' },
          { name: 'switchport', desc: 'Show Access/Trunk VLAN mode per port' },
          { name: 'transceiver', desc: 'Show SFP/SFP+ optical diagnostics' },
        ],
      },
      { name: 'ip', desc: 'Show IP interface brief, route, BGP & OSPF', children: [{ name: 'interface', desc: 'brief' }, { name: 'route', desc: 'IPv4 routes' }, { name: 'bgp', desc: 'summary' }, { name: 'ospf', desc: 'neighbor' }] },
      { name: 'vlan', desc: 'Show VLAN IDs & port assignments' },
      { name: 'mac-address-table', desc: 'Show Layer-2 MAC table' },
      { name: 'aggregateport', desc: 'Show LACP AggregatePort summary (show aggregateport summary)' },
      { name: 'spanning-tree', desc: 'Show RSTP/MSTP bridge & port status' },
      { name: 'lldp', desc: 'Show LLDP neighbor table (neighbors)' },
      { name: 'running-config', desc: 'Display running configuration' },
      { name: 'version', desc: 'Show RGOS version, model & uptime' },
    ],
  },
  { name: 'enable', desc: 'Enter privileged mode' },
  { name: 'configure', desc: 'Enter global configuration (configure terminal)' },
  { name: 'interface', desc: 'Configure GigabitEthernet / TenGigabitEthernet / AggregatePort / VLAN' },
  { name: 'vlan', desc: 'Create/configure VLAN' },
  { name: 'hostname', desc: 'Set Ruijie hostname' },
  { name: 'write', desc: 'Save configuration to flash' },
  { name: 'exit', desc: 'Exit current mode' },
];

const TPLINK_TREE: CliNode[] = [
  {
    name: 'show',
    desc: 'Display TP-Link Omada / JetStream L2+/L3 switch status',
    children: [
      { name: 'interface', desc: 'Show gigabitEthernet / ten-gigabitEthernet status & switchport', children: [{ name: 'status', desc: 'Port link, speed & duplex' }, { name: 'switchport', desc: 'Access/Trunk/General VLAN mode' }, { name: 'brief', desc: 'Compact port summary' }] },
      { name: 'vlan', desc: 'Display 802.1Q VLAN table (brief / id <vid>)' },
      { name: 'mac', desc: 'Show MAC address-table (show mac address-table)' },
      { name: 'etherchannel', desc: 'Show LAG / LACP port-channel summary (summary)' },
      { name: 'spanning-tree', desc: 'Show STP/RSTP/MSTP status (active / interface)' },
      { name: 'ip', desc: 'Show SVI IP interfaces & static routes (interface / route)' },
      { name: 'lldp', desc: 'Show LLDP neighbor information (neighbor-information)' },
      { name: 'running-config', desc: 'Display active switch configuration' },
      { name: 'system-info', desc: 'Show hardware model, firmware & uptime' },
    ],
  },
  { name: 'enable', desc: 'Enter privileged EXEC mode' },
  { name: 'configure', desc: 'Enter global configuration mode' },
  { name: 'interface', desc: 'Configure gigabitEthernet / ten-gigabitEthernet / port-channel / vlan' },
  { name: 'vlan', desc: 'Create/delete VLAN' },
  { name: 'hostname', desc: 'Set switch hostname' },
  { name: 'copy', desc: 'Save config (copy running-config startup-config)' },
  { name: 'exit', desc: 'Exit current mode' },
];

export const VENDOR_CLI_TREES: Record<TerminalVendor, CliNode[]> = {
  MikroTik: MIKROTIK_TREE,
  BDCOM: BDCOM_TREE,
  Cisco: CISCO_TREE,
  Huawei: HUAWEI_TREE,
  ZTE: ZTE_TREE,
  VSOL: VSOL_TREE,
  'C-Data': CDATA_TREE,
  'Palo Alto': PALO_ALTO_TREE,
  Juniper: JUNIPER_TREE,
  Arista: ARISTA_TREE,
  Ruijie: RUIJIE_TREE,
  'TP-Link': TPLINK_TREE,
};

function normalizeToken(token: string, vendor: TerminalVendor): string {
  const lower = token.toLowerCase();
  if (vendor === 'MikroTik' && lower.startsWith('/')) {
    return lower.slice(1);
  }
  return lower;
}

function nodeMatchesPrefix(nodeName: string, token: string, vendor: TerminalVendor): boolean {
  const nLower = nodeName.toLowerCase();
  const tLower = token.toLowerCase();
  if (nLower.startsWith(tLower)) return true;
  if (vendor === 'MikroTik') {
    return normalizeToken(nodeName, vendor).startsWith(normalizeToken(token, vendor));
  }
  return false;
}

function nodeMatchesExact(nodeName: string, token: string, vendor: TerminalVendor): boolean {
  const nLower = nodeName.toLowerCase();
  const tLower = token.toLowerCase();
  if (nLower === tLower) return true;
  if (vendor === 'MikroTik') {
    return normalizeToken(nodeName, vendor) === normalizeToken(token, vendor);
  }
  return false;
}

/**
 * Walks the vendor command tree given the user's current (even partial/unfinished) input line.
 * Supports abbreviated parent tokens (e.g. "dis o", "sh ep", "/ip ad", "ont a") before finishing the command.
 */
function resolveCursorContext(vendor: TerminalVendor, rawInput: string): {
  parentTokens: string[];
  partial: string;
  candidates: CliNode[];
  hasTrailingSpace: boolean;
} {
  const tree = VENDOR_CLI_TREES[vendor] || MIKROTIK_TREE;
  const hasTrailingSpace = /\s+$/.test(rawInput);
  const trimmedStart = rawInput.trimStart();
  if (!trimmedStart) {
    return { parentTokens: [], partial: '', candidates: tree, hasTrailingSpace: false };
  }

  const parts = trimmedStart.split(/\s+/).filter(Boolean);
  const completedTokens = hasTrailingSpace ? parts : parts.slice(0, -1);
  const partial = hasTrailingSpace ? '' : parts[parts.length - 1] || '';

  let currentLevel = tree;
  const resolvedParents: string[] = [];

  for (const tok of completedTokens) {
    let matched = currentLevel.find((n) => nodeMatchesExact(n.name, tok, vendor));
    if (!matched) {
      const prefixMatches = currentLevel.filter((n) => nodeMatchesPrefix(n.name, tok, vendor));
      if (prefixMatches.length >= 1) {
        // Use exact shortest / unique prefix match so partial parents like "dis o" or "sh ip" work cleanly
        matched = prefixMatches[0];
      }
    }
    if (!matched) {
      return { parentTokens: completedTokens, partial, candidates: [], hasTrailingSpace };
    }
    resolvedParents.push(matched.name);
    currentLevel = matched.children || [];
  }

  const filtered = partial
    ? currentLevel.filter((n) => nodeMatchesPrefix(n.name, partial, vendor))
    : currentLevel;

  return {
    parentTokens: resolvedParents,
    partial,
    candidates: filtered,
    hasTrailingSpace,
  };
}

function formatHelpTable(vendor: TerminalVendor, contextLabel: string, nodes: { name: string; desc: string }[]): string {
  if (nodes.length === 0) {
    return `  % Unrecognized command or no subcommands available for "${contextLabel}" (${vendor}). Press ? on empty line for all commands.`;
  }
  const maxNameLen = Math.min(36, Math.max(14, ...nodes.map((n) => n.name.length + 2)));
  const header = `  [${vendor} CLI Help — ${contextLabel || 'Top-Level Commands'}]`;
  const rows = nodes.map((n) => `  ${n.name.padEnd(maxNameLen, ' ')} ${n.desc}`);
  return `${header}\n${rows.join('\n')}`;
}

export function getCliHelp(vendor: TerminalVendor, inputVal: string): CliHelpResult {
  const cleaned = inputVal.replace(/\?+$/, '');
  const { parentTokens, partial, candidates, hasTrailingSpace } = resolveCursorContext(vendor, cleaned);

  // If user typed a full command without trailing space (e.g. "display?") and it uniquely matches a command with subcommands,
  // show both the command and its subcommands so '?' before finishing is immediately helpful!
  if (!hasTrailingSpace && partial && candidates.length === 1 && candidates[0].children && candidates[0].children.length > 0 && nodeMatchesExact(candidates[0].name, partial, vendor)) {
    const subMatches = candidates[0].children.map((c) => ({ name: c.name, desc: c.desc }));
    const ctx = [...parentTokens, candidates[0].name].join(' ');
    return {
      header: ctx,
      matches: subMatches,
      formatted: formatHelpTable(vendor, `${ctx} <subcommands>`, subMatches),
    };
  }

  const contextLabel = [...parentTokens, partial].filter(Boolean).join(' ') || 'Root Commands';
  const matches = candidates.map((c) => ({ name: c.name, desc: c.desc }));
  return {
    header: contextLabel,
    matches,
    formatted: formatHelpTable(vendor, contextLabel, matches),
  };
}

export function getCliSuggestions(vendor: TerminalVendor, inputVal: string): {
  insertText: string;
  label: string;
  desc: string;
  hasChildren: boolean;
}[] {
  const { parentTokens, partial, candidates, hasTrailingSpace } = resolveCursorContext(vendor, inputVal);

  // If user finished a token without trailing space and it uniquely matches a parent with children, surface its children right away!
  if (!hasTrailingSpace && partial && candidates.length === 1 && candidates[0].children && candidates[0].children.length > 0 && nodeMatchesExact(candidates[0].name, partial, vendor)) {
    const nextPrefix = `${[...parentTokens, candidates[0].name].join(' ')} `;
    return candidates[0].children.slice(0, 10).map((c) => ({
      label: c.name,
      desc: c.desc,
      hasChildren: Boolean(c.children && c.children.length > 0),
      insertText: `${nextPrefix}${c.name}${c.children && c.children.length > 0 ? ' ' : ''}`,
    }));
  }

  const prefix = parentTokens.length > 0 ? `${parentTokens.join(' ')} ` : '';
  return candidates.slice(0, 10).map((c) => ({
    label: c.name,
    desc: c.desc,
    hasChildren: Boolean(c.children && c.children.length > 0),
    insertText: `${prefix}${c.name}${c.children && c.children.length > 0 ? ' ' : ''}`,
  }));
}

function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].toLowerCase().startsWith(prefix.toLowerCase()) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

export function getCliTabCompletion(vendor: TerminalVendor, inputVal: string): CliTabResult {
  const { parentTokens, partial, candidates } = resolveCursorContext(vendor, inputVal);
  const prefix = parentTokens.length > 0 ? `${parentTokens.join(' ')} ` : '';

  if (candidates.length === 0) {
    return {
      completed: inputVal,
      changed: false,
      matches: [],
    };
  }

  if (candidates.length === 1) {
    const only = candidates[0];
    const completed = `${prefix}${only.name} `;
    return {
      completed,
      changed: completed !== inputVal,
      matches: [{ name: only.name, desc: only.desc }],
    };
  }

  // Multiple matches: expand abbreviated parent tokens + longest common prefix of matching candidates
  const names = candidates.map((c) => c.name);
  const lcp = longestCommonPrefix(names);
  const expanded = `${prefix}${lcp.length >= partial.length ? lcp : partial}`;
  const matches = candidates.map((c) => ({ name: c.name, desc: c.desc }));
  const contextLabel = [...parentTokens, partial].filter(Boolean).join(' ') || 'Available Completions';

  return {
    completed: expanded,
    changed: expanded !== inputVal,
    matches,
    formatted: formatHelpTable(vendor, `${contextLabel} (Tab matches)`, matches),
  };
}
