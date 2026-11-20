import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/telnet_client.dart';
import '../services/notepad_storage_service.dart';

class DeviceWebUiScreen extends StatefulWidget {
  final void Function(String title, String vendor, String commands)? onSaveToNotepad;

  const DeviceWebUiScreen({super.key, this.onSaveToNotepad});

  @override
  State<DeviceWebUiScreen> createState() => _DeviceWebUiScreenState();
}

class _DeviceWebUiScreenState extends State<DeviceWebUiScreen> {
  static const List<String> _allBrands = [
    'Huawei',
    'ZTE',
    'BDCOM',
    'VSOL',
    'C-Data',
    'MikroTik',
    'Cisco',
    'Juniper',
    'Palo Alto',
    'Arista',
    'Ruijie',
    'TP-Link',
  ];

  static const Set<String> _oltBrands = {'Huawei', 'ZTE', 'BDCOM', 'VSOL', 'C-Data'};
  static const Set<String> _switchBrands = {'Arista', 'Ruijie', 'TP-Link'};

  String _roleFilter = 'ALL'; // ALL, OLT, ROUTER, SWITCH
  String _brand = 'Huawei';
  String _section = 'interface'; // interface, vlan-l2, routing, olt, system

  // Direct Live Telnet connection bar
  final TextEditingController _hostCtrl = TextEditingController(text: '192.168.88.1');
  final TextEditingController _portCtrl = TextEditingController(text: '23');
  final TextEditingController _userCtrl = TextEditingController(text: 'root');
  final TextEditingController _passCtrl = TextEditingController(text: 'admin');
  UniversalTelnetClient? _telnet;
  bool _connected = false;
  bool _connecting = false;
  final StringBuffer _consoleLog = StringBuffer();

  // Form controllers
  final TextEditingController _ifaceCtrl = TextEditingController(text: 'vlanif 100');
  final TextEditingController _ipCtrl = TextEditingController(text: '10.10.10.2');
  final TextEditingController _maskCtrl = TextEditingController(text: '255.255.255.0');
  final TextEditingController _vlanIdCtrl = TextEditingController(text: '200');
  final TextEditingController _vlanNameCtrl = TextEditingController(text: 'FTTH-CLIENTS');
  final TextEditingController _swPortCtrl = TextEditingController(text: 'GigabitEthernet0/1');
  String _swMode = 'trunk';
  final TextEditingController _lagIdCtrl = TextEditingController(text: '1');

  final TextEditingController _routeDstCtrl = TextEditingController(text: '0.0.0.0');
  final TextEditingController _routeMaskCtrl = TextEditingController(text: '0.0.0.0');
  final TextEditingController _routeGwCtrl = TextEditingController(text: '10.10.10.1');
  final TextEditingController _bgpAsCtrl = TextEditingController(text: '65001');
  final TextEditingController _bgpPeerCtrl = TextEditingController(text: '10.99.0.1');
  final TextEditingController _bgpRemoteAsCtrl = TextEditingController(text: '65000');

  final TextEditingController _onuPortCtrl = TextEditingController(text: '0/1/0');
  final TextEditingController _onuIdCtrl = TextEditingController(text: '5');
  final TextEditingController _onuSnCtrl = TextEditingController(text: '48575443AABB1122');
  final TextEditingController _onuVlanCtrl = TextEditingController(text: '200');
  final TextEditingController _onuDescCtrl = TextEditingController(text: 'FTTH-Customer');

  final TextEditingController _hostnameCtrl = TextEditingController(text: 'CORE-HUAWEI-OLT');

  String _lastTitle = 'Generated CLI Preview';
  String _lastCli = '# Select any tab above and tap Generate / Push Live';

  @override
  void dispose() {
    _telnet?.close();
    _hostCtrl.dispose();
    _portCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    _ifaceCtrl.dispose();
    _ipCtrl.dispose();
    _maskCtrl.dispose();
    _vlanIdCtrl.dispose();
    _vlanNameCtrl.dispose();
    _swPortCtrl.dispose();
    _lagIdCtrl.dispose();
    _routeDstCtrl.dispose();
    _routeMaskCtrl.dispose();
    _routeGwCtrl.dispose();
    _bgpAsCtrl.dispose();
    _bgpPeerCtrl.dispose();
    _bgpRemoteAsCtrl.dispose();
    _onuPortCtrl.dispose();
    _onuIdCtrl.dispose();
    _onuSnCtrl.dispose();
    _onuVlanCtrl.dispose();
    _onuDescCtrl.dispose();
    _hostnameCtrl.dispose();
    super.dispose();
  }

  List<String> get _visibleBrands {
    if (_roleFilter == 'OLT') return _allBrands.where(_oltBrands.contains).toList();
    if (_roleFilter == 'SWITCH') return _allBrands.where(_switchBrands.contains).toList();
    if (_roleFilter == 'ROUTER') {
      return _allBrands.where((b) => !_oltBrands.contains(b) && !_switchBrands.contains(b)).toList();
    }
    return _allBrands;
  }

  Future<void> _toggleTelnet() async {
    if (_connected) {
      await _telnet?.close();
      setState(() {
        _connected = false;
        _consoleLog.writeln('\n[Disconnected]');
      });
      return;
    }

    final host = _hostCtrl.text.trim();
    final port = int.tryParse(_portCtrl.text.trim()) ?? 23;
    if (host.isEmpty) return;

    setState(() {
      _connecting = true;
      _consoleLog.writeln('>>> Connecting Telnet $host:$port ...');
    });

    final client = UniversalTelnetClient(
      host: host,
      port: port,
      onData: (text) {
        if (!mounted) return;
        setState(() {
          _consoleLog.write(text);
        });
      },
      onError: (err) {
        if (!mounted) return;
        setState(() {
          _connected = false;
          _connecting = false;
          _consoleLog.writeln('\n[Telnet Error] $err');
        });
      },
      onClose: () {
        if (!mounted) return;
        setState(() {
          _connected = false;
          _connecting = false;
          _consoleLog.writeln('\n[Connection Closed]');
        });
      },
    );

    try {
      await client.connect();
      if (!mounted) return;
      setState(() {
        _telnet = client;
        _connected = true;
        _connecting = false;
        _consoleLog.writeln('[Connected to $host:$port]');
      });
      if (_userCtrl.text.trim().isNotEmpty) {
        Future.delayed(const Duration(milliseconds: 700), () {
          if (_connected) client.sendString('${_userCtrl.text.trim()}\r');
        });
      }
      if (_passCtrl.text.isNotEmpty) {
        Future.delayed(const Duration(milliseconds: 1400), () {
          if (_connected) client.sendString('${_passCtrl.text}\r');
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _connected = false;
        _connecting = false;
        _consoleLog.writeln('[Failed] $e');
      });
    }
  }

  Future<void> _emitCli(String title, String cli, {bool autoPush = false}) async {
    setState(() {
      _lastTitle = title;
      _lastCli = cli;
    });

    if (autoPush && _connected && _telnet != null) {
      final lines = cli
          .split('\n')
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty && !e.startsWith('#'))
          .toList();
      for (final line in lines) {
        _telnet!.sendString('$line\r');
        await Future.delayed(const Duration(milliseconds: 220));
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pushed "$title" (${lines.length} lines) to live Telnet')),
        );
      }
    }
  }

  String _maskToCidr(String mask) {
    final trimmed = mask.trim();
    if (trimmed.startsWith('/')) return trimmed.substring(1);
    if (RegExp(r'^\d+$').hasMatch(trimmed)) return trimmed;
    final parts = trimmed.split('.');
    if (parts.length != 4) return '24';
    int bits = 0;
    for (final p in parts) {
      int n = int.tryParse(p) ?? 0;
      while (n > 0) {
        bits += n & 1;
        n >>= 1;
      }
    }
    return bits.toString();
  }

  String _buildInterfaceIpCli() {
    final iface = _ifaceCtrl.text.trim();
    final ip = _ipCtrl.text.trim();
    final mask = _maskCtrl.text.trim();
    final cidr = _maskToCidr(mask);
    switch (_brand) {
      case 'MikroTik':
        return '/ip address add address=$ip/$cidr interface=$iface';
      case 'Huawei':
        return 'enable\nconfig\ninterface $iface\nip address $ip $mask\nquit';
      case 'Juniper':
        return 'configure\nset interfaces $iface unit 0 family inet address $ip/$cidr\ncommit';
      case 'Palo Alto':
        return 'configure\nset network interface ethernet $iface layer3 ip $ip/$cidr\ncommit';
      default:
        return 'enable\nconfigure terminal\ninterface $iface\nip address $ip $mask\nno shutdown\nend';
    }
  }

  String _buildVlanSwitchCli() {
    final vid = _vlanIdCtrl.text.trim();
    final vname = _vlanNameCtrl.text.trim();
    final port = _swPortCtrl.text.trim();
    final lag = _lagIdCtrl.text.trim();
    switch (_brand) {
      case 'MikroTik':
        return '/interface vlan add name=vlan$vid-$vname vlan-id=$vid interface=$port\n/interface bridge vlan add bridge=bridge-lan tagged=$port vlan-ids=$vid';
      case 'Huawei':
        return 'enable\nconfig\nvlan $vid smart\nvlan desc $vid description "$vname"\nport vlan $vid $port\nquit';
      case 'Juniper':
        return 'configure\nset vlans $vname vlan-id $vid\nset interfaces $port unit 0 family ethernet-switching interface-mode $_swMode\ncommit';
      case 'Arista':
      case 'Cisco':
      case 'Ruijie':
      case 'TP-Link':
      case 'BDCOM':
      case 'ZTE':
      case 'VSOL':
      case 'C-Data':
        final modeCmd = _swMode == 'trunk'
            ? 'switchport mode trunk\nswitchport trunk allowed vlan add $vid'
            : 'switchport mode access\nswitchport access vlan $vid';
        return 'configure terminal\nvlan $vid\nname $vname\nexit\ninterface $port\n$modeCmd\nchannel-group $lag mode active\nspanning-tree portfast\nend';
      default:
        return 'configure\nset network vlan $vname virtual-interface interface vlan.$vid\ncommit';
    }
  }

  String _buildRoutingCli() {
    final dst = _routeDstCtrl.text.trim();
    final mask = _routeMaskCtrl.text.trim();
    final gw = _routeGwCtrl.text.trim();
    final cidr = _maskToCidr(mask);
    switch (_brand) {
      case 'MikroTik':
        return '/ip route add dst-address=$dst/$cidr gateway=$gw';
      case 'Huawei':
        return 'enable\nconfig\nip route-static $dst $mask $gw';
      case 'Juniper':
        return 'configure\nset routing-options static route $dst/$cidr next-hop $gw\ncommit';
      case 'Palo Alto':
        return 'configure\nset network virtual-router default routing-table ip static-route Route1 destination $dst/$cidr nexthop ip-address $gw\ncommit';
      default:
        return 'configure terminal\nip route $dst $mask $gw\nend';
    }
  }

  String _buildBgpCli() {
    final localAs = _bgpAsCtrl.text.trim();
    final peer = _bgpPeerCtrl.text.trim();
    final remoteAs = _bgpRemoteAsCtrl.text.trim();
    switch (_brand) {
      case 'MikroTik':
        return '/routing bgp connection add name=peer-$remoteAs local.role=ebgp as=$localAs remote.address=$peer remote.as=$remoteAs';
      case 'Juniper':
        return 'configure\nset routing-options autonomous-system $localAs\nset protocols bgp group EBGP peer-as $remoteAs neighbor $peer\ncommit';
      case 'Huawei':
        return 'system-view\nbgp $localAs\npeer $peer as-number $remoteAs\ncommit';
      default:
        return 'configure terminal\nrouter bgp $localAs\nneighbor $peer remote-as $remoteAs\nend';
    }
  }

  String _buildOnuAddCli() {
    final port = _onuPortCtrl.text.trim();
    final id = _onuIdCtrl.text.trim();
    final sn = _onuSnCtrl.text.trim();
    final vlan = _onuVlanCtrl.text.trim();
    final desc = _onuDescCtrl.text.trim();
    switch (_brand) {
      case 'Huawei':
        final parts = port.split('/');
        final board = parts.length >= 2 ? '${parts[0]}/${parts[1]}' : '0/1';
        final pon = parts.length >= 3 ? parts[2] : '0';
        return 'enable\nconfig\ninterface gpon $board\nont add $pon $id sn-auth $sn omci ont-lineprofile-id 10 ont-srvprofile-id 10 desc "$desc"\nquit\nservice-port vlan $vlan gpon $port ont $id gemport 1 multi-service user-vlan $vlan tag-transform translate\nsave';
      case 'ZTE':
        return 'configure terminal\ninterface gpon-olt_$port\nonu $id type ZTE-F660 sn $sn\nexit\ninterface gpon-onu_$port:$id\nname $desc\nservice-port 1 vport 1 user-vlan $vlan vlan $vlan\nend\nwrite';
      case 'BDCOM':
        return 'enable\nconfig\ninterface epon$port\nepon bind-onu mac $sn $id\nexit\ninterface epon$port:$id\nepon onu port 1 ctc vlan mode tag $vlan\nexit\nwrite all';
      case 'VSOL':
        return 'configure terminal\ninterface gpon $port\nonu add $id profile default sn $sn\nonu $id description "$desc"\nexit\nwrite';
      case 'C-Data':
        return 'configure terminal\ninterface gpon $port\nont add $id sn-auth $sn ont-lineprofile-id 1 ont-srvprofile-id 1 desc "$desc"\nexit\nsave';
      default:
        return '# Select Huawei, ZTE, BDCOM, VSOL, or C-Data for OLT ONU commands';
    }
  }

  String _buildOltDiagCli(String action) {
    final port = _onuPortCtrl.text.trim();
    final id = _onuIdCtrl.text.trim();
    if (action == 'autofind') {
      switch (_brand) {
        case 'Huawei':
          return 'display ont autofind all';
        case 'ZTE':
          return 'show gpon onu uncfg';
        case 'BDCOM':
          return 'show epon active-onu';
        case 'VSOL':
          return 'show onu authinfo all';
        case 'C-Data':
          return 'show ont autofind all';
      }
    } else if (action == 'optics') {
      switch (_brand) {
        case 'Huawei':
          return 'interface gpon 0/1\ndisplay ont optical-info 0 $id';
        case 'ZTE':
          return 'show pon power attenuation gpon-onu_$port:$id';
        case 'BDCOM':
          return 'show epon optical-transceiver-diagnosis interface epon$port:$id';
        case 'VSOL':
          return 'show onu optical-ddm gpon $port $id';
        case 'C-Data':
          return 'show ont optical-info $port $id';
      }
    } else if (action == 'delete') {
      switch (_brand) {
        case 'Huawei':
          return 'enable\nconfig\nundo service-port port $port ont $id\ninterface gpon 0/1\nont delete 0 $id\nquit\nsave';
        case 'ZTE':
          return 'configure terminal\ninterface gpon-olt_$port\nno onu $id\nend\nwrite';
        case 'BDCOM':
          return 'enable\nconfig\ninterface epon$port\nno epon bind-onu sequence $id\nexit\nwrite all';
        case 'VSOL':
          return 'configure terminal\ninterface gpon $port\nno onu $id\nexit\nwrite';
        case 'C-Data':
          return 'configure terminal\ninterface gpon $port\nont delete $id\nexit\nsave';
      }
    }
    return 'display version';
  }

  String _buildHostnameSaveCli(bool saveOnly) {
    final host = _hostnameCtrl.text.trim();
    if (saveOnly) {
      if (_brand == 'MikroTik') return '/export file=backup-config';
      if (_brand == 'Huawei' || _brand == 'C-Data') return 'save';
      if (_brand == 'Juniper' || _brand == 'Palo Alto') return 'commit';
      if (_brand == 'BDCOM') return 'write all';
      return 'write memory';
    }
    switch (_brand) {
      case 'MikroTik':
        return '/system identity set name="$host"';
      case 'Huawei':
        return 'enable\nconfig\nsysname $host\nsave';
      case 'Juniper':
        return 'configure\nset system host-name $host\ncommit';
      case 'Palo Alto':
        return 'configure\nset deviceconfig system hostname $host\ncommit';
      default:
        return 'configure terminal\nhostname $host\nend\nwrite memory';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Universal WebUI for Network Engineer',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.black),
            ),
            Text(
              '12-Brand OLT · Router · Managed Switch Graphical Console',
              style: TextStyle(fontSize: 11, color: Colors.black54),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          // 1. Role Filter + Brand Switcher
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  children: [
                    for (final role in const [
                      ('ALL', 'All (12)'),
                      ('OLT', 'OLTs (5)'),
                      ('ROUTER', 'Routers (4)'),
                      ('SWITCH', 'Switches (3)'),
                    ])
                      ChoiceChip(
                        label: Text(role.$2, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        selected: _roleFilter == role.$1,
                        selectedColor: Colors.black,
                        backgroundColor: Colors.white,
                        labelStyle: TextStyle(color: _roleFilter == role.$1 ? Colors.white : Colors.black),
                        onSelected: (_) {
                          setState(() {
                            _roleFilter = role.$1;
                            if (!_visibleBrands.contains(_brand)) {
                              _brand = _visibleBrands.first;
                            }
                          });
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _visibleBrands.map((b) {
                      final active = b == _brand;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ElevatedButton(
                          onPressed: () => setState(() => _brand = b),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: active ? Colors.black : Colors.white,
                            foregroundColor: active ? Colors.white : Colors.black,
                            elevation: 0,
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                          child: Text(b, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2. Direct Live Telnet Bridge Bar
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _connected ? Colors.green : const Color(0xFFCBD5E1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.cable, size: 16, color: _connected ? Colors.green.shade700 : Colors.black),
                    const SizedBox(width: 6),
                    Text(
                      _connected ? 'LIVE TELNET CONNECTED (${_hostCtrl.text})' : 'Live Device Telnet Bridge',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: _connected ? Colors.green.shade800 : Colors.black,
                      ),
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: _connecting ? null : _toggleTelnet,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _connected ? Colors.red.shade700 : Colors.black,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      child: Text(
                        _connecting ? 'Connecting...' : (_connected ? 'Disconnect' : 'Connect Live'),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(flex: 3, child: _field(_hostCtrl, 'Device IP')),
                    const SizedBox(width: 6),
                    Expanded(flex: 1, child: _field(_portCtrl, 'Port')),
                    const SizedBox(width: 6),
                    Expanded(flex: 2, child: _field(_userCtrl, 'User')),
                    const SizedBox(width: 6),
                    Expanded(flex: 2, child: _field(_passCtrl, 'Pass', obscure: true)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 3. WebUI Section Tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final sec in const [
                  ('interface', 'Interface IP'),
                  ('vlan-l2', 'VLAN & Switch L2'),
                  ('routing', 'Routing / BGP'),
                  ('olt', 'OLT & ONU'),
                  ('system', 'Hostname & Save'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(sec.$2, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      selected: _section == sec.$1,
                      selectedColor: Colors.black,
                      backgroundColor: const Color(0xFFF1F5F9),
                      labelStyle: TextStyle(color: _section == sec.$1 ? Colors.white : Colors.black),
                      onSelected: (_) => setState(() => _section = sec.$1),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 4. Active WebUI Form Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: _buildActiveSectionForm(),
          ),
          const SizedBox(height: 12),

          // 5. Generated CLI Preview + Save to Notepad + Push Live
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.black, width: 1.2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$_brand · $_lastTitle',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.black),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Copy CLI',
                      icon: const Icon(Icons.copy, size: 18, color: Colors.black),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _lastCli));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('CLI copied to clipboard')),
                        );
                      },
                    ),
                    TextButton.icon(
                      onPressed: () async {
                        final storage = NotepadStorageService();
                        await storage.upsertNote(
                          SavedCommandNote(
                            id: 'note_${DateTime.now().millisecondsSinceEpoch}',
                            title: '$_brand — $_lastTitle',
                            vendor: _brand,
                            category: _section.toUpperCase(),
                            commands: _lastCli,
                            description: 'Saved from Universal WebUI',
                            updatedAt: DateTime.now().toIso8601String(),
                          ),
                        );
                        widget.onSaveToNotepad?.call(_lastTitle, _brand, _lastCli);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Saved to Command Notepad!')),
                          );
                        }
                      },
                      icon: const Icon(Icons.note_add, size: 16, color: Colors.black),
                      label: const Text('Save Note', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w700, fontSize: 11)),
                    ),
                    ElevatedButton.icon(
                      onPressed: () => _emitCli(_lastTitle, _lastCli, autoPush: true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      ),
                      icon: const Icon(Icons.send, size: 14),
                      label: Text(_connected ? 'Push Live' : 'Apply', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: SelectableText(
                    _lastCli,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.black, height: 1.45),
                  ),
                ),
                if (_consoleLog.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const Text('Live Telnet Output:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.black54)),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxHeight: 140),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        _consoleLog.toString(),
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveSectionForm() {
    switch (_section) {
      case 'interface':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Configure Interface IP ($_brand)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
            const SizedBox(height: 10),
            _field(_ifaceCtrl, 'Interface (e.g. ether1, GigabitEthernet0/1, vlanif 100)'),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _field(_ipCtrl, 'IP Address')),
                const SizedBox(width: 8),
                Expanded(child: _field(_maskCtrl, 'Subnet Mask / CIDR')),
              ],
            ),
            const SizedBox(height: 10),
            _actionBtn('Generate & Apply Interface IP', () => _emitCli('Set Interface IP', _buildInterfaceIpCli(), autoPush: _connected)),
          ],
        );

      case 'vlan-l2':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('VLAN, Switchport Trunk/Access & LACP ($_brand)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _field(_vlanIdCtrl, 'VLAN ID')),
                const SizedBox(width: 8),
                Expanded(flex: 2, child: _field(_vlanNameCtrl, 'VLAN Name')),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(flex: 2, child: _field(_swPortCtrl, 'Port / Interface')),
                const SizedBox(width: 8),
                Expanded(child: _field(_lagIdCtrl, 'LACP Group')),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                ChoiceChip(
                  label: const Text('Trunk'),
                  selected: _swMode == 'trunk',
                  selectedColor: Colors.black,
                  labelStyle: TextStyle(color: _swMode == 'trunk' ? Colors.white : Colors.black, fontSize: 12),
                  onSelected: (_) => setState(() => _swMode = 'trunk'),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Access'),
                  selected: _swMode == 'access',
                  selectedColor: Colors.black,
                  labelStyle: TextStyle(color: _swMode == 'access' ? Colors.white : Colors.black, fontSize: 12),
                  onSelected: (_) => setState(() => _swMode = 'access'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _actionBtn('Generate & Apply VLAN + L2 Switchport', () => _emitCli('VLAN & Switch L2', _buildVlanSwitchCli(), autoPush: _connected)),
          ],
        );

      case 'routing':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Static IP Route & BGP Peering ($_brand)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _field(_routeDstCtrl, 'Destination')),
                const SizedBox(width: 6),
                Expanded(child: _field(_routeMaskCtrl, 'Mask')),
                const SizedBox(width: 6),
                Expanded(child: _field(_routeGwCtrl, 'Gateway')),
              ],
            ),
            const SizedBox(height: 8),
            _actionBtn('Apply Static Route', () => _emitCli('Add Static Route', _buildRoutingCli(), autoPush: _connected)),
            const Divider(height: 24),
            Row(
              children: [
                Expanded(child: _field(_bgpAsCtrl, 'Local AS')),
                const SizedBox(width: 6),
                Expanded(flex: 2, child: _field(_bgpPeerCtrl, 'BGP Peer IP')),
                const SizedBox(width: 6),
                Expanded(child: _field(_bgpRemoteAsCtrl, 'Remote AS')),
              ],
            ),
            const SizedBox(height: 8),
            _actionBtn('Apply BGP Neighbor', () => _emitCli('Configure BGP Peer', _buildBgpCli(), autoPush: _connected)),
          ],
        );

      case 'olt':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Multi-Vendor OLT ONU Provisioning ($_brand)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _field(_onuPortCtrl, 'PON Port')),
                const SizedBox(width: 6),
                Expanded(child: _field(_onuIdCtrl, 'ONU ID')),
                const SizedBox(width: 6),
                Expanded(child: _field(_onuVlanCtrl, 'VLAN')),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(flex: 2, child: _field(_onuSnCtrl, 'ONU SN / MAC')),
                const SizedBox(width: 6),
                Expanded(flex: 2, child: _field(_onuDescCtrl, 'Customer Desc')),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ElevatedButton(
                  onPressed: () => _emitCli('Add ONU', _buildOnuAddCli(), autoPush: _connected),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white),
                  child: const Text('Add ONU', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                OutlinedButton(
                  onPressed: () => _emitCli('Auto-Find ONU', _buildOltDiagCli('autofind'), autoPush: _connected),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.black),
                  child: const Text('Auto-Find / Uncfg', style: TextStyle(fontSize: 12)),
                ),
                OutlinedButton(
                  onPressed: () => _emitCli('ONU Optical Rx', _buildOltDiagCli('optics'), autoPush: _connected),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.black),
                  child: const Text('Optical Rx', style: TextStyle(fontSize: 12)),
                ),
                OutlinedButton(
                  onPressed: () => _emitCli('Delete ONU', _buildOltDiagCli('delete'), autoPush: _connected),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade700),
                  child: const Text('Delete ONU', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        );

      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hostname & Save Configuration ($_brand)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
            const SizedBox(height: 10),
            _field(_hostnameCtrl, 'Device Hostname'),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _actionBtn('Apply Hostname', () => _emitCli('Set Hostname', _buildHostnameSaveCli(false), autoPush: _connected)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _emitCli('Save / Commit Config', _buildHostnameSaveCli(true), autoPush: _connected),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: Colors.black),
                    ),
                    child: const Text('Save / Commit', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ],
        );
    }
  }

  Widget _field(TextEditingController ctrl, String label, {bool obscure = false}) {
    return TextField(
      controller: ctrl,
      obscureText: obscure,
      style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.black),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 11, color: Colors.black54),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _actionBtn(String text, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      ),
    );
  }
}
