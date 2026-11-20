export type TopologyBrand =
  | 'Cisco'
  | 'MikroTik'
  | 'Huawei'
  | 'BDCOM'
  | 'VSOL'
  | 'Palo Alto'
  | 'Juniper';

export type DeviceRole = 'router' | 'switch' | 'olt' | 'firewall';

export interface DeviceModelSpec {
  id: string;
  model: string;
  role: DeviceRole;
  osVersions: string[];
  defaultInterfaces: string[];
}

export interface InterfaceConfig {
  id: string;
  name: string;
  ipAddress: string;
  cidr: number;
  vlanId?: string;
  description?: string;
  enabled: boolean;
}

export interface StaticRouteConfig {
  id: string;
  destination: string;
  cidr: number;
  gateway: string;
}

export interface TopologyNode {
  id: string;
  hostname: string;
  brand: TopologyBrand;
  model: string;
  osVersion: string;
  role: DeviceRole;
  x: number;
  y: number;
  managementIp?: string;
  interfaces: InterfaceConfig[];
  routes: StaticRouteConfig[];
}

export interface TopologyLink {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  media: 'fiber' | 'copper';
}

export const BRAND_CATALOG: Record<TopologyBrand, DeviceModelSpec[]> = {
  Cisco: [
    {
      id: 'cisco-isr4331',
      model: 'ISR 4331 Router',
      role: 'router',
      osVersions: ['IOS-XE 17.9', 'IOS-XE 16.12', 'IOS 15.7'],
      defaultInterfaces: ['GigabitEthernet0/0/0', 'GigabitEthernet0/0/1', 'GigabitEthernet0/0/2', 'Loopback0'],
    },
    {
      id: 'cisco-c2960x',
      model: 'Catalyst 2960-X',
      role: 'switch',
      osVersions: ['IOS 15.2(7)E', 'IOS 12.2(55)SE'],
      defaultInterfaces: ['Vlan1', 'Vlan100', 'GigabitEthernet1/0/1', 'GigabitEthernet1/0/24'],
    },
    {
      id: 'cisco-c9300',
      model: 'Catalyst 9300 L3 Switch',
      role: 'switch',
      osVersions: ['IOS-XE 17.9', 'IOS-XE 17.6'],
      defaultInterfaces: ['Vlan100', 'GigabitEthernet1/0/1', 'TenGigabitEthernet1/1/1', 'Loopback0'],
    },
    {
      id: 'cisco-n9300',
      model: 'Nexus 93180YC-EX',
      role: 'switch',
      osVersions: ['NX-OS 10.3', 'NX-OS 9.3'],
      defaultInterfaces: ['Ethernet1/1', 'Ethernet1/2', 'Vlan100', 'mgmt0'],
    },
  ],
  MikroTik: [
    {
      id: 'mt-rb4011',
      model: 'RB4011iGS+RM',
      role: 'router',
      osVersions: ['RouterOS v7.14', 'RouterOS v6.49'],
      defaultInterfaces: ['ether1', 'ether2', 'sfp-sfpplus1', 'bridge-lan'],
    },
    {
      id: 'mt-ccr2004',
      model: 'CCR2004-1G-12S+2XS',
      role: 'router',
      osVersions: ['RouterOS v7.15', 'RouterOS v7.12'],
      defaultInterfaces: ['sfp-sfpplus1', 'sfp-sfpplus2', 'sfp28-1', 'ether1'],
    },
    {
      id: 'mt-crs326',
      model: 'CRS326-24G-2S+',
      role: 'switch',
      osVersions: ['RouterOS v7.14', 'RouterOS v6.49'],
      defaultInterfaces: ['bridge', 'ether1', 'sfp-sfpplus1', 'vlan100'],
    },
  ],
  Huawei: [
    {
      id: 'hw-ne40e',
      model: 'NE40E-X8 Core Router',
      role: 'router',
      osVersions: ['VRP v8 (8.210)', 'VRP v5 (5.170)'],
      defaultInterfaces: ['GigabitEthernet0/1/0', '10GE0/1/1', 'LoopBack0'],
    },
    {
      id: 'hw-s5735',
      model: 'CloudEngine S5735-L',
      role: 'switch',
      osVersions: ['VRP v5 (5.170)', 'VRP v8 (8.220)'],
      defaultInterfaces: ['Vlanif100', 'GigabitEthernet0/0/1', 'XGigabitEthernet0/0/1'],
    },
    {
      id: 'hw-ma5800',
      model: 'SmartAX MA5800-X7 OLT',
      role: 'olt',
      osVersions: ['MA5800 V100R021', 'MA5600T V800R018'],
      defaultInterfaces: ['vlanif 100', 'meth 0', '0/19/0'],
    },
  ],
  BDCOM: [
    {
      id: 'bd-gp3600',
      model: 'GP3600-08B GPON OLT',
      role: 'olt',
      osVersions: ['BDROS v3.0 (GPON)', 'BDROS v2.2 (GPON)'],
      defaultInterfaces: ['vlan 100', 'GigaEthernet0/1', 'TGigaEthernet0/1'],
    },
    {
      id: 'bd-p3310d',
      model: 'P3310D EPON OLT',
      role: 'olt',
      osVersions: ['BDROS v2.1 (EPON)', 'BDROS v2.0 (EPON)'],
      defaultInterfaces: ['vlan 1', 'GigaEthernet0/1', 'GigaEthernet0/2'],
    },
    {
      id: 'bd-s2928',
      model: 'S2928E Core Switch',
      role: 'switch',
      osVersions: ['BDROS Switch v2.2'],
      defaultInterfaces: ['vlan 100', 'GigaEthernet0/1', 'TGigaEthernet0/1'],
    },
  ],
  VSOL: [
    {
      id: 'vsol-v1600g1',
      model: 'V1600G1 GPON OLT',
      role: 'olt',
      osVersions: ['V-SOL OS v3.2', 'V-SOL OS v2.0'],
      defaultInterfaces: ['vlan 100', 'aux', 'ge 0/1'],
    },
    {
      id: 'vsol-v1600d4',
      model: 'V1600D4 EPON OLT',
      role: 'olt',
      osVersions: ['V-SOL OS v2.0', 'V-SOL OS v1.9'],
      defaultInterfaces: ['vlan 1', 'aux', 'ge 0/1'],
    },
  ],
  'Palo Alto': [
    {
      id: 'pa-440',
      model: 'PA-440 Firewall',
      role: 'firewall',
      osVersions: ['PAN-OS 11.1', 'PAN-OS 10.2'],
      defaultInterfaces: ['ethernet1/1', 'ethernet1/2', 'ethernet1/3', 'loopback.1'],
    },
    {
      id: 'pa-3220',
      model: 'PA-3220 Next-Gen FW',
      role: 'firewall',
      osVersions: ['PAN-OS 11.1', 'PAN-OS 10.2', 'PAN-OS 9.1'],
      defaultInterfaces: ['ethernet1/1', 'ethernet1/2', 'ae1', 'loopback.1'],
    },
  ],
  Juniper: [
    {
      id: 'juniper-mx204',
      model: 'MX204 Universal Router',
      role: 'router',
      osVersions: ['Junos OS 23.2', 'Junos OS 21.4'],
      defaultInterfaces: ['xe-0/1/0', 'et-0/0/0', 'lo0'],
    },
    {
      id: 'juniper-ex4300',
      model: 'EX4300 Switch',
      role: 'switch',
      osVersions: ['Junos OS 21.4', 'Junos OS 18.4'],
      defaultInterfaces: ['irb.100', 'ge-0/0/0', 'xe-0/2/0'],
    },
  ],
};

export function cidrToSubnetMask(cidr: number): string {
  const bits = Math.max(0, Math.min(32, Math.floor(cidr)));
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

export function getScriptExtension(brand: TopologyBrand): string {
  if (brand === 'MikroTik') return 'rsc';
  if (brand === 'Palo Alto' || brand === 'Juniper') return 'set';
  return 'cfg';
}

export function generateDeviceCli(node: TopologyNode): string {
  const lines: string[] = [];
  const host = node.hostname.trim().replace(/\s+/g, '-') || 'Device';
  const configuredIfs = node.interfaces.filter((i) => i.name.trim());
  const validRoutes = node.routes.filter((r) => r.destination.trim() && r.gateway.trim());

  switch (node.brand) {
    case 'Cisco': {
      const isNxOs = node.osVersion.startsWith('NX-OS');
      const isSwitch = node.role === 'switch';
      lines.push(`! ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push('enable');
      lines.push('configure terminal');
      lines.push(`hostname ${host}`);
      lines.push('');

      for (const iface of configuredIfs) {
        const mask = cidrToSubnetMask(iface.cidr);
        const isVlanIf = /^vlan/i.test(iface.name);
        const isLoopback = /^loopback/i.test(iface.name);

        if (iface.vlanId && isVlanIf) {
          lines.push(`vlan ${iface.vlanId}`);
          lines.push(` name VLAN_${iface.vlanId}`);
          lines.push(' exit');
        }

        lines.push(`interface ${iface.name}`);
        if (iface.description) {
          lines.push(` description ${iface.description}`);
        }
        if (isSwitch && !isVlanIf && !isLoopback && iface.ipAddress.trim()) {
          lines.push(' no switchport');
        }
        if (iface.ipAddress.trim()) {
          if (isNxOs) {
            lines.push(` ip address ${iface.ipAddress.trim()}/${iface.cidr}`);
          } else {
            lines.push(` ip address ${iface.ipAddress.trim()} ${mask}`);
          }
        }
        lines.push(iface.enabled ? ' no shutdown' : ' shutdown');
        lines.push(' exit');
      }

      if (validRoutes.length > 0) {
        lines.push('');
        for (const r of validRoutes) {
          if (isNxOs) {
            lines.push(`ip route ${r.destination.trim()}/${r.cidr} ${r.gateway.trim()}`);
          } else {
            lines.push(
              `ip route ${r.destination.trim()} ${cidrToSubnetMask(r.cidr)} ${r.gateway.trim()}`
            );
          }
        }
      }

      lines.push('end');
      lines.push(isNxOs ? 'copy running-config startup-config' : 'write memory');
      break;
    }

    case 'MikroTik': {
      const isV7 = node.osVersion.includes('v7');
      lines.push(`# ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push(`/system identity set name="${host}"`);

      for (const iface of configuredIfs) {
        const targetIf = iface.vlanId ? `vlan${iface.vlanId}` : iface.name.trim();
        if (iface.vlanId) {
          lines.push(
            `/interface vlan add name=${targetIf} vlan-id=${iface.vlanId} interface=${iface.name.trim()}`
          );
        }
        if (iface.ipAddress.trim()) {
          const commentPart = iface.description ? ` comment="${iface.description}"` : '';
          lines.push(
            `/ip address add address=${iface.ipAddress.trim()}/${iface.cidr} interface=${targetIf}${commentPart}`
          );
        }
        if (!iface.enabled) {
          lines.push(`/interface disable [find name="${targetIf}"]`);
        } else {
          lines.push(`/interface enable [find name="${targetIf}"]`);
        }
      }

      if (validRoutes.length > 0) {
        lines.push('');
        for (const r of validRoutes) {
          if (isV7) {
            lines.push(
              `/ip route add dst-address=${r.destination.trim()}/${r.cidr} gateway=${r.gateway.trim()} routing-table=main`
            );
          } else {
            lines.push(
              `/ip route add dst-address=${r.destination.trim()}/${r.cidr} gateway=${r.gateway.trim()}`
            );
          }
        }
      }
      break;
    }

    case 'Huawei': {
      const isOlt = node.role === 'olt' || node.osVersion.includes('MA5');
      const isVrp8 = node.osVersion.includes('v8');

      lines.push(`# ${node.brand} ${node.model} (${node.osVersion})`);
      if (isOlt) {
        lines.push('enable');
        lines.push('config');
        lines.push(`sysname ${host}`);
        lines.push('');
        for (const iface of configuredIfs) {
          const mask = cidrToSubnetMask(iface.cidr);
          if (iface.vlanId) {
            lines.push(`vlan ${iface.vlanId} smart`);
          }
          const ifName = iface.vlanId ? `vlanif ${iface.vlanId}` : iface.name.trim();
          lines.push(`interface ${ifName}`);
          if (iface.description) {
            lines.push(` description ${iface.description}`);
          }
          if (iface.ipAddress.trim()) {
            lines.push(` ip address ${iface.ipAddress.trim()} ${mask}`);
          }
          lines.push(iface.enabled ? ' undo shutdown' : ' shutdown');
          lines.push(' quit');
        }
        for (const r of validRoutes) {
          lines.push(
            `ip route-static ${r.destination.trim()} ${cidrToSubnetMask(r.cidr)} ${r.gateway.trim()}`
          );
        }
        lines.push('save');
      } else {
        lines.push('system-view');
        lines.push(`sysname ${host}`);
        lines.push('');
        for (const iface of configuredIfs) {
          const mask = cidrToSubnetMask(iface.cidr);
          if (iface.vlanId) {
            lines.push(`vlan ${iface.vlanId}`);
            lines.push(' quit');
          }
          const ifName = iface.vlanId ? `Vlanif${iface.vlanId}` : iface.name.trim();
          lines.push(`interface ${ifName}`);
          if (iface.description) {
            lines.push(` description ${iface.description}`);
          }
          if (iface.ipAddress.trim()) {
            lines.push(
              isVrp8
                ? ` ip address ${iface.ipAddress.trim()} ${iface.cidr}`
                : ` ip address ${iface.ipAddress.trim()} ${mask}`
            );
          }
          lines.push(iface.enabled ? ' undo shutdown' : ' shutdown');
          lines.push(' quit');
        }
        if (validRoutes.length > 0) {
          lines.push('');
          for (const r of validRoutes) {
            lines.push(
              `ip route-static ${r.destination.trim()} ${cidrToSubnetMask(r.cidr)} ${r.gateway.trim()}`
            );
          }
        }
        if (isVrp8) {
          lines.push('commit');
        }
        lines.push('return');
        lines.push('save');
      }
      break;
    }

    case 'BDCOM': {
      const isGpon = node.osVersion.includes('GPON');
      lines.push(`! ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push('enable');
      lines.push('config');
      lines.push(`hostname ${host}`);
      lines.push('');

      for (const iface of configuredIfs) {
        const mask = cidrToSubnetMask(iface.cidr);
        if (iface.vlanId) {
          lines.push(`vlan ${iface.vlanId}`);
          lines.push(' exit');
        }
        const ifTarget = iface.vlanId ? `vlan ${iface.vlanId}` : iface.name.trim();
        lines.push(`interface ${ifTarget}`);
        if (iface.description) {
          lines.push(` description ${iface.description}`);
        }
        if (iface.ipAddress.trim()) {
          lines.push(` ip address ${iface.ipAddress.trim()} ${mask}`);
        }
        lines.push(iface.enabled ? ' no shutdown' : ' shutdown');
        lines.push(' exit');
      }

      if (validRoutes.length > 0) {
        lines.push('');
        for (const r of validRoutes) {
          lines.push(
            `ip route ${r.destination.trim()} ${cidrToSubnetMask(r.cidr)} ${r.gateway.trim()}`
          );
        }
      }

      lines.push('exit');
      lines.push(isGpon ? 'write all' : 'write');
      break;
    }

    case 'VSOL': {
      const isV3 = node.osVersion.includes('v3');
      lines.push(`! ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push('enable');
      lines.push('configure terminal');
      lines.push(`hostname ${host}`);
      lines.push('');

      for (const iface of configuredIfs) {
        const mask = cidrToSubnetMask(iface.cidr);
        if (iface.vlanId) {
          lines.push(`vlan ${iface.vlanId}`);
          lines.push(' exit');
        }
        const ifTarget = iface.vlanId ? `vlan ${iface.vlanId}` : iface.name.trim();
        lines.push(`interface ${ifTarget}`);
        if (iface.description && isV3) {
          lines.push(` description ${iface.description}`);
        }
        if (iface.ipAddress.trim()) {
          lines.push(` ip address ${iface.ipAddress.trim()} ${mask}`);
        }
        lines.push(iface.enabled ? ' no shutdown' : ' shutdown');
        lines.push(' exit');
      }

      if (validRoutes.length > 0) {
        lines.push('');
        for (const r of validRoutes) {
          lines.push(
            `ip route ${r.destination.trim()} ${cidrToSubnetMask(r.cidr)} ${r.gateway.trim()}`
          );
        }
      }

      lines.push('exit');
      lines.push('write');
      break;
    }

    case 'Palo Alto': {
      lines.push(`# ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push('configure');
      lines.push(`set deviceconfig system hostname ${host}`);

      for (const iface of configuredIfs) {
        const cleanIf = iface.name.trim();
        const isLoop = cleanIf.startsWith('loopback');
        if (iface.ipAddress.trim()) {
          if (isLoop) {
            lines.push(
              `set network interface loopback units ${cleanIf} ip ${iface.ipAddress.trim()}/${iface.cidr}`
            );
          } else if (iface.vlanId) {
            lines.push(
              `set network interface ethernet ${cleanIf} layer3 units ${cleanIf}.${iface.vlanId} tag ${iface.vlanId}`
            );
            lines.push(
              `set network interface ethernet ${cleanIf} layer3 units ${cleanIf}.${iface.vlanId} ip ${iface.ipAddress.trim()}/${iface.cidr}`
            );
            lines.push(
              `set network virtual-router default interface ${cleanIf}.${iface.vlanId}`
            );
          } else {
            lines.push(
              `set network interface ethernet ${cleanIf} layer3 ip ${iface.ipAddress.trim()}/${iface.cidr}`
            );
            lines.push(`set network virtual-router default interface ${cleanIf}`);
          }
        }
        if (iface.description && !isLoop) {
          lines.push(
            `set network interface ethernet ${cleanIf} comment "${iface.description}"`
          );
        }
        if (!iface.enabled && !isLoop) {
          lines.push(`set network interface ethernet ${cleanIf} link-state down`);
        }
      }

      validRoutes.forEach((r, idx) => {
        lines.push(
          `set network virtual-router default routing-table ip static-route route_${idx + 1} destination ${r.destination.trim()}/${r.cidr} nexthop ip-address ${r.gateway.trim()}`
        );
      });

      lines.push('commit');
      break;
    }

    case 'Juniper': {
      lines.push(`# ${node.brand} ${node.model} (${node.osVersion})`);
      lines.push('configure');
      lines.push(`set system host-name ${host}`);

      for (const iface of configuredIfs) {
        const cleanIf = iface.name.trim();
        const unit = iface.vlanId || '0';
        if (iface.vlanId) {
          lines.push(`set interfaces ${cleanIf} vlan-tagging`);
          lines.push(`set interfaces ${cleanIf} unit ${unit} vlan-id ${iface.vlanId}`);
        }
        if (iface.description) {
          lines.push(`set interfaces ${cleanIf} unit ${unit} description "${iface.description}"`);
        }
        if (iface.ipAddress.trim()) {
          lines.push(
            `set interfaces ${cleanIf} unit ${unit} family inet address ${iface.ipAddress.trim()}/${iface.cidr}`
          );
        }
        if (!iface.enabled) {
          lines.push(`set interfaces ${cleanIf} disable`);
        }
      }

      for (const r of validRoutes) {
        lines.push(
          `set routing-options static route ${r.destination.trim()}/${r.cidr} next-hop ${r.gateway.trim()}`
        );
      }

      lines.push('commit and-quit');
      break;
    }
  }

  return lines.join('\n');
}
