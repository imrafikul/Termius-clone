import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:dartssh2/dartssh2.dart';
import 'package:xterm/xterm.dart';
import '../models/pptp_profile.dart';
import '../services/telnet_client.dart';
import '../services/storage_service.dart';
import '../services/notepad_storage_service.dart';
import '../services/serial_console_service.dart';

enum TerminalProtocol { ssh, telnet, serial }

class ActiveSession {
  final String id;
  final String name;
  final String host;
  final int port;
  final String username;
  final String password;
  final String vendor;
  final bool autoLogin;
  final TerminalProtocol protocol;
  final Terminal terminal;
  bool isConnected;
  bool sentAutoUsername;
  bool sentAutoPassword;
  SSHClient? sshClient;
  SSHSession? sshSession;
  UniversalTelnetClient? telnetClient;
  UsbSerialConsoleService? serialClient;

  ActiveSession({
    required this.id,
    required this.name,
    required this.host,
    required this.port,
    required this.username,
    required this.password,
    required this.vendor,
    required this.protocol,
    required this.terminal,
    this.autoLogin = true,
    this.isConnected = false,
    this.sentAutoUsername = false,
    this.sentAutoPassword = false,
  });
}

class TerminalScreen extends StatefulWidget {
  final PPTPProfile profile;
  final TerminalProtocol initialProtocol;

  const TerminalScreen({
    super.key,
    required this.profile,
    this.initialProtocol = TerminalProtocol.telnet,
  });

  @override
  State<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends State<TerminalScreen> {
  final List<ActiveSession> _sessions = [];
  List<SavedTerminalHost> _savedHosts = [];
  int _activeSessionIndex = 0;
  String _selectedVendor = 'MikroTik';
  double _terminalFontSize = 12.0;
  bool _isFullscreen = false;
  double? _customTerminalHeight;

  static const List<String> _vendors = [
    'MikroTik',
    'Cisco',
    'Huawei',
    'ZTE',
    'BDCOM',
    'VSOL',
    'C-Data',
    'Palo Alto',
    'Juniper',
    'Arista',
    'Ruijie',
    'TP-Link',
  ];

  final Map<String, List<Map<String, String>>> _snippets = {
    'MikroTik': [
      {'label': '/int pr', 'cmd': '/interface print\r'},
      {'label': '/ip addr pr', 'cmd': '/ip address print\r'},
      {'label': '/ip route', 'cmd': '/ip route print\r'},
      {'label': '/ppp active', 'cmd': '/ppp active print\r'},
      {'label': '/sys res', 'cmd': '/system resource print\r'},
      {'label': '/ping 8.8.8.8', 'cmd': '/ping 8.8.8.8 count=4\r'},
    ],
    'Cisco': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'term len 0', 'cmd': 'terminal length 0\r'},
      {'label': 'sh ip int br', 'cmd': 'show ip interface brief\r'},
      {'label': 'sh run', 'cmd': 'show running-config\r'},
      {'label': 'sh mac addr', 'cmd': 'show mac address-table\r'},
      {'label': 'sh vlan br', 'cmd': 'show vlan brief\r'},
    ],
    'Huawei': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'sys-view', 'cmd': 'system-view\r'},
      {'label': 'scr-len 0', 'cmd': 'screen-length 0 temporary\r'},
      {'label': 'dis ip int br', 'cmd': 'display ip interface brief\r'},
      {'label': 'dis ont all', 'cmd': 'display ont info 0 all\r'},
      {'label': 'dis cur', 'cmd': 'display current-configuration\r'},
    ],
    'BDCOM': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'conf t', 'cmd': 'config\r'},
      {'label': 'sh epon onu', 'cmd': 'show epon active-onu\r'},
      {'label': 'sh gpon onu', 'cmd': 'show gpon active-onu\r'},
      {'label': 'sh int br', 'cmd': 'show interface brief\r'},
      {'label': 'sh mac', 'cmd': 'show mac address-table\r'},
    ],
    'VSOL': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'conf t', 'cmd': 'configure terminal\r'},
      {'label': 'sh onu auth', 'cmd': 'show onu authinfo all\r'},
      {'label': 'sh pon status', 'cmd': 'show pon onu-information\r'},
      {'label': 'sh vlan', 'cmd': 'show vlan all\r'},
      {'label': 'sh run', 'cmd': 'show running-config\r'},
    ],
    'ZTE': [
      {'label': 'sh uncfg', 'cmd': 'show gpon onu uncfg\r'},
      {'label': 'sh onu state', 'cmd': 'show gpon onu state\r'},
      {'label': 'sh pon pwr', 'cmd': 'show pon power attenuation gpon-onu_1/2/1:1\r'},
      {'label': 'sh vlan', 'cmd': 'show vlan summary\r'},
      {'label': 'write', 'cmd': 'write\r'},
    ],
    'C-Data': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'config', 'cmd': 'config\r'},
      {'label': 'sh autofind', 'cmd': 'show ont autofind all\r'},
      {'label': 'sh ont info', 'cmd': 'show ont info 0 all\r'},
      {'label': 'save', 'cmd': 'save\r'},
    ],
    'Juniper': [
      {'label': 'configure', 'cmd': 'configure\r'},
      {'label': 'sh int terse', 'cmd': 'show interfaces terse\r'},
      {'label': 'sh route', 'cmd': 'show route\r'},
      {'label': 'sh bgp sum', 'cmd': 'show bgp summary\r'},
      {'label': 'commit', 'cmd': 'commit\r'},
    ],
    'Arista': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'sh int status', 'cmd': 'show interfaces status\r'},
      {'label': 'sh vlan', 'cmd': 'show vlan\r'},
      {'label': 'sh ip bgp sum', 'cmd': 'show ip bgp summary\r'},
      {'label': 'wr mem', 'cmd': 'write memory\r'},
    ],
    'Ruijie': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'sh int status', 'cmd': 'show interface status\r'},
      {'label': 'sh vlan', 'cmd': 'show vlan\r'},
      {'label': 'sh mac', 'cmd': 'show mac-address-table\r'},
      {'label': 'write', 'cmd': 'write\r'},
    ],
    'TP-Link': [
      {'label': 'enable', 'cmd': 'enable\r'},
      {'label': 'sh int br', 'cmd': 'show interface brief\r'},
      {'label': 'sh vlan', 'cmd': 'show vlan\r'},
      {'label': 'sh mac', 'cmd': 'show mac address-table\r'},
      {'label': 'copy run start', 'cmd': 'copy running-config startup-config\r'},
    ],
    'Palo Alto': [
      {'label': 'sh sys info', 'cmd': 'show system info\r'},
      {'label': 'sh int all', 'cmd': 'show interface all\r'},
      {'label': 'sh routing', 'cmd': 'show routing route\r'},
      {'label': 'sh session', 'cmd': 'show session info\r'},
      {'label': 'set cli pager', 'cmd': 'set cli pager off\r'},
      {'label': 'enable telnet', 'cmd': 'set deviceconfig system service disable-telnet no\r'},
    ],
  };

  @override
  void initState() {
    super.initState();
    _loadSavedHosts();
    final isTelnet = widget.initialProtocol == TerminalProtocol.telnet;
    _addNewSession(
      name: '${widget.profile.ispName} (${isTelnet ? 'Telnet' : 'SSH'})',
      host: widget.profile.routerIp,
      port: isTelnet ? 23 : widget.profile.sshPort,
      username: widget.profile.username,
      password: widget.profile.password,
      vendor: 'MikroTik',
      protocol: widget.initialProtocol,
      autoLogin: true,
    );
  }

  Future<void> _loadSavedHosts() async {
    final loaded = await StorageService().getTerminalSessions();
    if (mounted) {
      setState(() {
        _savedHosts = loaded;
      });
    }
  }

  void _addNewSession({
    required String name,
    required String host,
    required int port,
    required String username,
    required String password,
    required String vendor,
    required TerminalProtocol protocol,
    bool autoLogin = true,
  }) {
    final terminal = Terminal(maxLines: 5000);
    final session = ActiveSession(
      id: 'sess_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      host: host,
      port: port,
      username: username,
      password: password,
      vendor: vendor,
      protocol: protocol,
      terminal: terminal,
      autoLogin: autoLogin,
    );

    setState(() {
      _sessions.add(session);
      _activeSessionIndex = _sessions.length - 1;
      _selectedVendor = vendor;
    });

    if (protocol == TerminalProtocol.ssh) {
      _connectSSH(session);
    } else {
      _connectTelnet(session);
    }
  }

  Future<void> _connectSSH(ActiveSession session) async {
    session.terminal.write(
      '\x1b[36m[*] Connecting SSH (${session.vendor}) to ${session.host}:${session.port}...\x1b[0m\r\n',
    );
    try {
      final socket = await SSHSocket.connect(
        session.host,
        session.port,
        timeout: const Duration(seconds: 12),
      );

      final client = SSHClient(
        socket,
        username: session.username,
        onPasswordRequest: () => session.password,
      );

      await client.authenticated;
      final sshSession = await client.shell(
        pty: SSHPtyConfig(
          type: 'xterm-256color',
          width: session.terminal.viewWidth,
          height: session.terminal.viewHeight,
        ),
      );

      session.sshClient = client;
      session.sshSession = sshSession;
      session.isConnected = true;

      session.terminal.onResize = (width, height, pixelWidth, pixelHeight) {
        sshSession.resizeTerminal(width, height);
      };

      session.terminal.onOutput = (data) {
        sshSession.write(utf8.encode(data));
      };

      sshSession.stdout.listen((data) {
        session.terminal.write(utf8.decode(data, allowMalformed: true));
      });

      sshSession.stderr.listen((data) {
        session.terminal.write('\x1b[31m${utf8.decode(data, allowMalformed: true)}\x1b[0m');
      });

      sshSession.done.then((_) {
        session.isConnected = false;
        session.terminal.write('\r\n\x1b[33m[SSH Session Closed]\x1b[0m\r\n');
        if (mounted) setState(() {});
      });

      if (mounted) setState(() {});
      session.terminal.write('\x1b[32m[+] SSH Session Connected (${session.vendor})!\x1b[0m\r\n\r\n');
    } catch (e) {
      session.terminal.write('\r\n\x1b[31m[-] SSH Connection Failed: $e\x1b[0m\r\n');
      if (mounted) setState(() {});
    }
  }

  Future<void> _connectTelnet(ActiveSession session) async {
    session.terminal.write(
      '\x1b[35m[*] Connecting Universal RFC 854 Telnet (${session.vendor}) to ${session.host}:${session.port}...\x1b[0m\r\n',
    );
    try {
      final telnet = UniversalTelnetClient(
        host: session.host,
        port: session.port,
        terminalType: 'xterm-256color',
        onData: (text) {
          session.terminal.write(text);
          // Smart Telnet Auto-Login prompt detection for Cisco/Huawei/BDCOM/VSOL/MikroTik
          if (session.autoLogin && session.telnetClient != null) {
            final lower = text.toLowerCase();
            if (!session.sentAutoUsername &&
                session.username.isNotEmpty &&
                (lower.contains('login:') ||
                    lower.contains('username:') ||
                    lower.contains('user name:') ||
                    lower.contains('user:'))) {
              session.sentAutoUsername = true;
              Future.delayed(const Duration(milliseconds: 180), () {
                session.telnetClient?.sendString('${session.username}\r');
              });
            } else if (!session.sentAutoPassword &&
                session.password.isNotEmpty &&
                lower.contains('password:')) {
              session.sentAutoPassword = true;
              Future.delayed(const Duration(milliseconds: 180), () {
                session.telnetClient?.sendString('${session.password}\r');
              });
            }
          }
        },
        onError: (err) {
          session.terminal.write('\r\n\x1b[31m[-] Telnet Error: $err\x1b[0m\r\n');
          if (mounted) setState(() {});
        },
        onClose: () {
          session.isConnected = false;
          session.terminal.write('\r\n\x1b[33m[Telnet Session Closed]\x1b[0m\r\n');
          if (mounted) setState(() {});
        },
      );

      await telnet.connect(timeout: const Duration(seconds: 12));

      session.telnetClient = telnet;
      session.isConnected = true;

      telnet.resize(session.terminal.viewWidth, session.terminal.viewHeight);
      session.terminal.onResize = (width, height, pixelWidth, pixelHeight) {
        telnet.resize(width, height);
      };

      session.terminal.onOutput = (data) {
        telnet.sendString(data);
      };

      if (mounted) setState(() {});
      session.terminal.write(
        '\x1b[32m[+] Telnet Connected (RFC 854 IAC/NAWS/TTYPE active · ${session.vendor})!\x1b[0m\r\n\r\n',
      );
    } catch (e) {
      session.terminal.write('\r\n\x1b[31m[-] Telnet Connection Failed: $e\x1b[0m\r\n');
      if (session.vendor == 'Palo Alto') {
        session.terminal.write(
          '\x1b[33m[i] Note: Palo Alto PAN-OS disables Telnet by default. Use SSH (Port 22) or enable Telnet on management interface.\x1b[0m\r\n',
        );
      }
      if (mounted) setState(() {});
    }
  }

  Future<void> _showUsbConsoleSheet() async {
    final service = UsbSerialConsoleService();
    final devices = await service.listDevices();
    int baud = UsbSerialConsoleService.recommendedBaudRate(_selectedVendor);
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'USB-OTG Console Cable (RS-232 / COM)',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Supports FTDI, PL2303, CH340, CP210x, Cisco & Huawei USB Console',
                    style: TextStyle(color: Colors.white60, fontSize: 11),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: baud,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      labelText: 'Baud Rate (8-N-1)',
                      labelStyle: TextStyle(color: Colors.white70),
                      border: OutlineInputBorder(),
                    ),
                    items: const [9600, 19200, 38400, 57600, 115200]
                        .map((b) => DropdownMenuItem(value: b, child: Text('$b bps')))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setSheetState(() => baud = v);
                    },
                  ),
                  const SizedBox(height: 12),
                  if (devices.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'No USB-OTG serial adapter detected. Plug in your FTDI/PL2303/CH340/CP2102 Console Cable via OTG and tap again.',
                        style: TextStyle(color: Colors.amberAccent, fontSize: 12),
                      ),
                    )
                  else
                    ...devices.map(
                      (dev) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.usb, color: Colors.greenAccent),
                        title: Text(
                          dev.productName ?? dev.manufacturerName ?? 'USB Serial Adapter',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          'VID: ${dev.vid} · PID: ${dev.pid} · $baud bps',
                          style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'monospace'),
                        ),
                        trailing: ElevatedButton(
                          onPressed: () async {
                            Navigator.pop(ctx);
                            final terminal = Terminal(maxLines: 5000);
                            final session = ActiveSession(
                              id: 'serial_${DateTime.now().millisecondsSinceEpoch}',
                              name: '$_selectedVendor Console',
                              host: dev.productName ?? 'USB-OTG',
                              port: baud,
                              username: '',
                              password: '',
                              vendor: _selectedVendor,
                              protocol: TerminalProtocol.serial,
                              terminal: terminal,
                              autoLogin: false,
                            );
                            session.serialClient = service;
                            setState(() {
                              _sessions.add(session);
                              _activeSessionIndex = _sessions.length - 1;
                            });
                            final ok = await service.connect(
                              device: dev,
                              baudRate: baud,
                              onData: (chunk) => session.terminal.write(chunk),
                              onDisconnect: (reason) {
                                session.isConnected = false;
                                session.terminal.write('\r\n\x1b[31m[!] $reason\x1b[0m\r\n');
                                if (mounted) setState(() {});
                              },
                            );
                            session.isConnected = ok;
                            if (ok) {
                              session.terminal.onOutput = (data) {
                                service.writeRaw(data);
                              };
                              session.terminal.write(
                                '\x1b[32m[+] USB-OTG Console Cable Connected (${service.deviceName} @ $baud bps 8-N-1)\x1b[0m\r\n',
                              );
                            } else {
                              session.terminal.write('\x1b[31m[-] Failed to open USB-OTG serial port.\x1b[0m\r\n');
                            }
                            if (mounted) setState(() {});
                          },
                          child: const Text('Connect'),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _sendShortcut(String payload) {
    if (_sessions.isEmpty) return;
    final current = _sessions[_activeSessionIndex];
    if (current.protocol == TerminalProtocol.ssh && current.sshSession != null) {
      current.sshSession?.write(utf8.encode(payload));
    } else if (current.protocol == TerminalProtocol.telnet && current.telnetClient != null) {
      current.telnetClient?.sendString(payload);
    } else if (current.protocol == TerminalProtocol.serial && current.serialClient != null) {
      current.serialClient?.writeRaw(payload);
    }
  }

  void _sendSavedCredentials() {
    if (_sessions.isEmpty) return;
    final current = _sessions[_activeSessionIndex];
    if (current.username.isNotEmpty) {
      _sendShortcut('${current.username}\r');
    }
    if (current.password.isNotEmpty) {
      Future.delayed(const Duration(milliseconds: 550), () {
        _sendShortcut('${current.password}\r');
      });
    }
  }

  void _cycleTelnetLineEnding() {
    if (_sessions.isEmpty) return;
    final telnet = _sessions[_activeSessionIndex].telnetClient;
    if (telnet == null) return;
    setState(() {
      switch (telnet.lineEnding) {
        case TelnetLineEnding.auto:
          telnet.lineEnding = TelnetLineEnding.crlf;
          break;
        case TelnetLineEnding.crlf:
          telnet.lineEnding = TelnetLineEnding.cr;
          break;
        case TelnetLineEnding.cr:
          telnet.lineEnding = TelnetLineEnding.auto;
          break;
      }
    });
  }

  void _toggleLocalEcho() {
    if (_sessions.isEmpty) return;
    final telnet = _sessions[_activeSessionIndex].telnetClient;
    if (telnet == null) return;
    setState(() {
      telnet.localEchoOverride = !telnet.localEchoOverride;
    });
  }

  void _closeSession(int idx) {
    if (_sessions.length <= 1) return;
    final s = _sessions[idx];
    s.sshSession?.close();
    s.sshClient?.close();
    s.telnetClient?.close();
    s.serialClient?.disconnect();
    setState(() {
      _sessions.removeAt(idx);
      if (_activeSessionIndex >= _sessions.length) {
        _activeSessionIndex = _sessions.length - 1;
      }
      _selectedVendor = _sessions[_activeSessionIndex].vendor;
    });
  }

  void _showSavedHostsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Saved Telnet / SSH Hosts',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showNewSessionDialog();
                        },
                        icon: const Icon(Icons.add, size: 16, color: Colors.cyanAccent),
                        label: const Text(
                          'Add New',
                          style: TextStyle(color: Colors.cyanAccent, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_savedHosts.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 28),
                      child: Center(
                        child: Text(
                          'No saved Telnet/SSH hosts yet.\nTap "Add New" to save IP, Username & Password.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white54, fontSize: 12),
                        ),
                      ),
                    )
                  else
                    Flexible(
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: _savedHosts.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, idx) {
                          final item = _savedHosts[idx];
                          final isSsh = item.protocol == 'ssh';
                          return Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF334155)),
                            ),
                            child: ListTile(
                              dense: true,
                              title: Text(
                                '${item.name} [${item.protocol.toUpperCase()} · ${item.vendor}]',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              subtitle: Text(
                                '${item.host}:${item.port}  ·  User: ${item.username.isEmpty ? "-" : item.username}',
                                style: const TextStyle(
                                  color: Colors.cyanAccent,
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, color: Colors.white70, size: 18),
                                    tooltip: 'Edit Host',
                                    onPressed: () {
                                      Navigator.pop(ctx);
                                      _showNewSessionDialog(existing: item);
                                    },
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                    tooltip: 'Delete Host',
                                    onPressed: () async {
                                      final updated = await StorageService().deleteTerminalSession(item.id);
                                      if (mounted) {
                                        setState(() => _savedHosts = updated);
                                      }
                                      setSheetState(() {});
                                    },
                                  ),
                                ],
                              ),
                              onTap: () {
                                Navigator.pop(ctx);
                                _addNewSession(
                                  name: item.name,
                                  host: item.host,
                                  port: item.port,
                                  username: item.username,
                                  password: item.password,
                                  vendor: item.vendor,
                                  protocol: isSsh ? TerminalProtocol.ssh : TerminalProtocol.telnet,
                                  autoLogin: item.autoLogin,
                                );
                              },
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showNewSessionDialog({SavedTerminalHost? existing}) {
    final hostCtrl = TextEditingController(text: existing?.host ?? widget.profile.routerIp);
    final portCtrl = TextEditingController(text: (existing?.port ?? 23).toString());
    final nameCtrl = TextEditingController(text: existing?.name ?? 'Core OLT / Switch');
    final userCtrl = TextEditingController(text: existing?.username ?? widget.profile.username);
    final passCtrl = TextEditingController(text: existing?.password ?? widget.profile.password);
    TerminalProtocol selectedProto =
        existing?.protocol == 'ssh' ? TerminalProtocol.ssh : TerminalProtocol.telnet;
    String selectedVendor = existing?.vendor ?? _selectedVendor;
    bool saveSession = true;
    bool autoLogin = existing?.autoLogin ?? true;
    bool obscurePass = true;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: const Color(0xFF0F172A),
            title: Text(
              existing != null ? 'Edit Saved Host' : 'Connect & Save Network Device',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: nameCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Device Label',
                      labelStyle: TextStyle(color: Colors.white60),
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _vendors.contains(selectedVendor) ? selectedVendor : _vendors.first,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Device Vendor / OS',
                      labelStyle: TextStyle(color: Colors.white60),
                    ),
                    items: _vendors
                        .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() {
                          selectedVendor = val;
                          if (existing == null) {
                            nameCtrl.text = '$val (${selectedProto.name.toUpperCase()})';
                          }
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<TerminalProtocol>(
                    value: selectedProto,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.cyanAccent),
                    decoration: const InputDecoration(
                      labelText: 'Protocol',
                      labelStyle: TextStyle(color: Colors.white60),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: TerminalProtocol.telnet,
                        child: Text('Telnet (RFC 854 · Cisco/Huawei/BDCOM/VSOL/MikroTik/Palo Alto)'),
                      ),
                      DropdownMenuItem(
                        value: TerminalProtocol.ssh,
                        child: Text('SSH v2 (Secure Shell · Port 22)'),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() {
                          selectedProto = val;
                          portCtrl.text = val == TerminalProtocol.ssh ? '22' : '23';
                          if (existing == null) {
                            nameCtrl.text = '$selectedVendor (${val.name.toUpperCase()})';
                          }
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextField(
                          controller: hostCtrl,
                          style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                          decoration: const InputDecoration(
                            labelText: 'Host IP / Domain',
                            labelStyle: TextStyle(color: Colors.white60),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: TextField(
                          controller: portCtrl,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white),
                          decoration: const InputDecoration(
                            labelText: 'Port',
                            labelStyle: TextStyle(color: Colors.white60),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: userCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: 'Username (Telnet / SSH)',
                      labelStyle: TextStyle(color: Colors.white60),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: passCtrl,
                    obscureText: obscurePass,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Password (Telnet / SSH)',
                      labelStyle: const TextStyle(color: Colors.white60),
                      suffixIcon: IconButton(
                        icon: Icon(
                          obscurePass ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          color: Colors.white54,
                          size: 18,
                        ),
                        onPressed: () => setDialogState(() => obscurePass = !obscurePass),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: Colors.cyanAccent,
                    title: const Text(
                      'Save IP + User + Pass',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                    value: saveSession,
                    onChanged: (v) => setDialogState(() => saveSession = v),
                  ),
                  SwitchListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: Colors.greenAccent,
                    title: const Text(
                      'Auto-Login on Telnet Prompt',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    value: autoLogin,
                    onChanged: (v) => setDialogState(() => autoLogin = v),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.cyanAccent,
                  foregroundColor: Colors.black,
                ),
                onPressed: () async {
                  final host = hostCtrl.text.trim();
                  if (host.isEmpty) return;
                  final label = nameCtrl.text.trim().isEmpty
                      ? '$selectedVendor $host'
                      : nameCtrl.text.trim();
                  final port = int.tryParse(portCtrl.text) ??
                      (selectedProto == TerminalProtocol.ssh ? 22 : 23);

                  if (saveSession) {
                    final savedObj = SavedTerminalHost(
                      id: existing?.id ?? 'host_${DateTime.now().millisecondsSinceEpoch}',
                      name: label,
                      vendor: selectedVendor,
                      protocol: selectedProto == TerminalProtocol.ssh ? 'ssh' : 'telnet',
                      host: host,
                      port: port,
                      username: userCtrl.text.trim(),
                      password: passCtrl.text,
                      autoLogin: autoLogin,
                    );
                    final updated = await StorageService().upsertTerminalSession(savedObj);
                    if (mounted) {
                      setState(() => _savedHosts = updated);
                    }
                  }

                  if (ctx.mounted) Navigator.pop(ctx);
                  _addNewSession(
                    name: label,
                    host: host,
                    port: port,
                    username: userCtrl.text.trim(),
                    password: passCtrl.text,
                    vendor: selectedVendor,
                    protocol: selectedProto,
                    autoLogin: autoLogin,
                  );
                },
                child: Text(saveSession ? 'Save & Connect' : 'Connect'),
              ),
            ],
          );
        });
      },
    );
  }

  @override
  void dispose() {
    for (final s in _sessions) {
      s.sshSession?.close();
      s.sshClient?.close();
      s.telnetClient?.close();
      s.serialClient?.disconnect();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _sessions.isNotEmpty ? _sessions[_activeSessionIndex] : null;
    final telnet = current?.telnetClient;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              current != null ? '${current.name} [${current.protocol.name.toUpperCase()}]' : 'Terminal',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            Text(
              current?.isConnected == true
                  ? 'Connected · ${current?.host}:${current?.port} (${current?.vendor})'
                  : 'Disconnected / Connecting...',
              style: TextStyle(
                fontSize: 11,
                color: current?.isConnected == true ? Colors.greenAccent : Colors.amberAccent,
              ),
            ),
          ],
        ),
        actions: [
          if (current?.protocol == TerminalProtocol.telnet && telnet != null) ...[
            TextButton(
              onPressed: _cycleTelnetLineEnding,
              child: Text(
                telnet.lineEnding.name.toUpperCase(),
                style: const TextStyle(color: Colors.cyanAccent, fontSize: 11, fontFamily: 'monospace'),
              ),
            ),
            IconButton(
              icon: Icon(
                Icons.keyboard_alt_outlined,
                color: telnet.localEchoOverride ? Colors.greenAccent : Colors.white54,
                size: 20,
              ),
              tooltip: 'Toggle Local Echo (for raw OLTs)',
              onPressed: _toggleLocalEcho,
            ),
          ],
          IconButton(
            icon: const Icon(Icons.text_decrease, color: Colors.white70, size: 19),
            tooltip: 'Decrease Font Size',
            onPressed: () => setState(() {
              _terminalFontSize = (_terminalFontSize - 1).clamp(8.0, 22.0);
            }),
          ),
          IconButton(
            icon: const Icon(Icons.text_increase, color: Colors.white70, size: 19),
            tooltip: 'Increase Font Size',
            onPressed: () => setState(() {
              _terminalFontSize = (_terminalFontSize + 1).clamp(8.0, 22.0);
            }),
          ),
          IconButton(
            icon: Icon(
              _isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
              color: _isFullscreen ? Colors.greenAccent : Colors.white,
              size: 22,
            ),
            tooltip: _isFullscreen ? 'Restore Toolbars' : 'Fullscreen Terminal',
            onPressed: () => setState(() {
              _isFullscreen = !_isFullscreen;
              if (_isFullscreen) _customTerminalHeight = null;
            }),
          ),
          IconButton(
            icon: const Icon(Icons.usb, color: Colors.greenAccent),
            tooltip: 'USB-OTG Console Cable (RS-232 / COM)',
            onPressed: _showUsbConsoleSheet,
          ),
          IconButton(
            icon: const Icon(Icons.bookmarks_outlined, color: Colors.amberAccent),
            tooltip: 'Saved Telnet / SSH Hosts',
            onPressed: _showSavedHostsSheet,
          ),
          IconButton(
            icon: const Icon(Icons.add_to_queue, color: Colors.cyanAccent),
            tooltip: 'New / Save Telnet & SSH Device',
            onPressed: () => _showNewSessionDialog(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Multi-Session Tabs Bar
          if (_sessions.length > 1)
            Container(
              height: 38,
              color: const Color(0xFF0B0F19),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _sessions.length,
                itemBuilder: (ctx, idx) {
                  final s = _sessions[idx];
                  final isSelected = idx == _activeSessionIndex;
                  return InkWell(
                    onTap: () => setState(() {
                      _activeSessionIndex = idx;
                      _selectedVendor = s.vendor;
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF1E293B) : Colors.transparent,
                        border: Border(
                          bottom: BorderSide(
                            color: isSelected ? Colors.cyanAccent : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          Text(
                            s.protocol.name.toUpperCase(),
                            style: TextStyle(
                              color: s.protocol == TerminalProtocol.ssh
                                  ? Colors.cyanAccent
                                  : Colors.purpleAccent,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            s.name,
                            style: TextStyle(
                              color: isSelected ? Colors.white : Colors.white60,
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          const SizedBox(width: 4),
                          GestureDetector(
                            onTap: () => _closeSession(idx),
                            child: const Icon(Icons.close, size: 14, color: Colors.white38),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

          // Vendor Selector Strip (hidden in Fullscreen mode for maximum terminal height)
          if (!_isFullscreen)
            Container(
              height: 36,
              color: const Color(0xFF0F172A),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _vendors.map((v) {
                  final active = _selectedVendor == v;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: InkWell(
                      onTap: () => setState(() => _selectedVendor = v),
                      borderRadius: BorderRadius.circular(4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: active ? Colors.cyanAccent.withOpacity(0.18) : const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: active ? Colors.cyanAccent : const Color(0xFF334155),
                          ),
                        ),
                        child: Text(
                          v,
                          style: TextStyle(
                            color: active ? Colors.cyanAccent : Colors.white60,
                            fontSize: 11,
                            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

          // Termius Quick Control & Vendor Snippets Bar (hidden in Fullscreen mode)
          if (!_isFullscreen)
            Container(
              height: 42,
              color: const Color(0xFF1E293B),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  if (current != null && current.username.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: InkWell(
                        onTap: _sendSavedCredentials,
                        borderRadius: BorderRadius.circular(4),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.greenAccent.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.greenAccent),
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'Send Login',
                            style: TextStyle(
                              color: Colors.greenAccent,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ),
                    ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: InkWell(
                      onTap: _showNotepadPicker,
                      borderRadius: BorderRadius.circular(4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.amberAccent),
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          'Notepad',
                          style: TextStyle(
                            color: Colors.amberAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ),
                  ),
                  _shortcutButton('? Help', '?'),
                  _shortcutButton('Tab', '\t'),
                  _shortcutButton('Ctrl+C', '\x03'),
                  _shortcutButton('Ctrl+Z', '\x1a'),
                  _shortcutButton('Space', ' '),
                  _shortcutButton('Up', '\x1b[A'),
                  _shortcutButton('Down', '\x1b[B'),
                  ...(_snippets[_selectedVendor] ?? []).map((snip) {
                    return _shortcutButton(snip['label']!, snip['cmd']!);
                  }),
                  _shortcutButton('Enter', '\r'),
                ],
              ),
            ),

          // Resizable Terminal Viewport (supports custom drag height + S/M/L/Full + dynamic font size)
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final maxH = constraints.maxHeight;
                final activeH = _customTerminalHeight != null
                    ? _customTerminalHeight!.clamp(180.0, maxH - 22.0)
                    : maxH - 22.0;
                return Column(
                  children: [
                    SizedBox(
                      height: activeH,
                      width: double.infinity,
                      child: Container(
                        color: Colors.black,
                        padding: const EdgeInsets.all(4),
                        child: current != null
                            ? TerminalView(
                                current.terminal,
                                backgroundOpacity: 1.0,
                                textStyle: TerminalStyle(
                                  fontSize: _terminalFontSize,
                                  fontFamily: 'monospace',
                                ),
                              )
                            : const Center(
                                child: Text('No active session', style: TextStyle(color: Colors.white38)),
                              ),
                      ),
                    ),
                    // Drag-to-Resize Handle Bar
                    GestureDetector(
                      onVerticalDragUpdate: (details) {
                        setState(() {
                          final baseH = _customTerminalHeight ?? (maxH - 22.0);
                          _customTerminalHeight = (baseH + details.delta.dy).clamp(180.0, maxH - 22.0);
                        });
                      },
                      onDoubleTap: () => setState(() => _customTerminalHeight = null),
                      child: Container(
                        height: 22,
                        width: double.infinity,
                        color: const Color(0xFF1E293B),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.drag_handle, size: 16, color: Colors.white54),
                            const SizedBox(width: 6),
                            Text(
                              'Drag to Resize · ${_terminalFontSize.toInt()}px · Double-tap Full',
                              style: const TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showNotepadPicker() async {
    final storage = NotepadStorageService();
    final notes = await storage.getNotes();
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.65,
          maxChildSize: 0.9,
          builder: (_, scrollCtrl) {
            return Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Command Notepad — 1-Tap Apply to Terminal',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.black),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Tap Apply on any saved script to send all lines directly into the active Telnet/SSH session.',
                    style: TextStyle(fontSize: 11, color: Colors.black54),
                  ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: ListView.builder(
                      controller: scrollCtrl,
                      itemCount: notes.length,
                      itemBuilder: (_, i) {
                        final note = notes[i];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      note.title,
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.black),
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () async {
                                      Navigator.pop(ctx);
                                      final lines = note.commands
                                          .split('\n')
                                          .map((l) => l.trim())
                                          .where((l) => l.isNotEmpty && !l.startsWith('#'))
                                          .toList();
                                      for (final line in lines) {
                                        _sendShortcut('$line\r');
                                        await Future.delayed(const Duration(milliseconds: 220));
                                      }
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.black,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    ),
                                    child: const Text('Apply Live', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                note.commands,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.black87),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _shortcutButton(String label, String payload) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: InkWell(
        onTap: () => _sendShortcut(payload),
        borderRadius: BorderRadius.circular(4),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF334155),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: const Color(0xFF475569)),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              fontFamily: 'monospace',
            ),
          ),
        ),
      ),
    );
  }
}
