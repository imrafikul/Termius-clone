import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:dartssh2/dartssh2.dart';
import 'package:xterm/xterm.dart';
import '../models/pptp_profile.dart';

enum TerminalProtocol { ssh, telnet }

class ActiveSession {
  final String id;
  final String name;
  final String host;
  final int port;
  final TerminalProtocol protocol;
  final Terminal terminal;
  bool isConnected;
  SSHClient? sshClient;
  SSHSession? sshSession;
  Socket? telnetSocket;

  ActiveSession({
    required this.id,
    required this.name,
    required this.host,
    required this.port,
    required this.protocol,
    required this.terminal,
    this.isConnected = false,
  });
}

class TerminalScreen extends StatefulWidget {
  final PPTPProfile profile;

  const TerminalScreen({super.key, required this.profile});

  @override
  State<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends State<TerminalScreen> {
  final List<ActiveSession> _sessions = [];
  int _activeSessionIndex = 0;
  String _selectedSnippetCategory = 'MikroTik';

  final Map<String, List<Map<String, String>>> _snippets = {
    'MikroTik': [
      {'label': '/int pr', 'cmd': '/interface print\r'},
      {'label': '/ip addr pr', 'cmd': '/ip address print\r'},
      {'label': '/pptp-srv', 'cmd': '/interface pptp-server server print\r'},
      {'label': '/ip route', 'cmd': '/ip route print\r'},
      {'label': '/firewall', 'cmd': '/ip firewall filter print\r'},
      {'label': '/ping 8.8.8.8', 'cmd': '/ping 8.8.8.8 count=4\r'},
      {'label': '/system res', 'cmd': '/system resource print\r'},
    ],
    'Cisco/OLT': [
      {'label': 'sh ip int br', 'cmd': 'show ip interface brief\r'},
      {'label': 'sh run', 'cmd': 'show running-config\r'},
      {'label': 'sh mac addr', 'cmd': 'show mac address-table\r'},
      {'label': 'sh vlan br', 'cmd': 'show vlan brief\r'},
      {'label': 'ping 10.99.0.1', 'cmd': 'ping 10.99.0.1\r'},
    ],
    'Linux/Troubleshoot': [
      {'label': 'ip a', 'cmd': 'ip a\n'},
      {'label': 'ip route', 'cmd': 'ip route\n'},
      {'label': 'ping -c 4', 'cmd': 'ping -c 4 1.1.1.1\n'},
      {'label': 'mtr 8.8.8.8', 'cmd': 'mtr -n -c 5 8.8.8.8\n'},
    ],
  };

  @override
  void initState() {
    super.initState();
    _addNewSession(
      name: '${widget.profile.ispName} (SSH)',
      host: widget.profile.routerIp,
      port: widget.profile.sshPort,
      protocol: TerminalProtocol.ssh,
    );
  }

  void _addNewSession({
    required String name,
    required String host,
    required int port,
    required TerminalProtocol protocol,
  }) {
    final terminal = Terminal(maxLines: 5000);
    final session = ActiveSession(
      id: 'sess_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      host: host,
      port: port,
      protocol: protocol,
      terminal: terminal,
    );

    setState(() {
      _sessions.add(session);
      _activeSessionIndex = _sessions.length - 1;
    });

    if (protocol == TerminalProtocol.ssh) {
      _connectSSH(session);
    } else {
      _connectTelnet(session);
    }
  }

  Future<void> _connectSSH(ActiveSession session) async {
    session.terminal.write('\x1b[36m[*] Connecting SSH to ${session.host}:${session.port}...\x1b[0m\r\n');
    try {
      final socket = await SSHSocket.connect(
        session.host,
        session.port,
        timeout: const Duration(seconds: 10),
      );

      final client = SSHClient(
        socket,
        username: widget.profile.username,
        onPasswordRequest: () => widget.profile.password,
      );

      await client.authenticated;
      final sshSession = await client.shell(
        pty: const SSHPtyConfig(type: 'xterm-256color', width: 80, height: 24),
      );

      session.sshClient = client;
      session.sshSession = sshSession;
      session.isConnected = true;

      session.terminal.onOutput = (data) {
        sshSession.write(utf8.encode(data));
      };

      sshSession.stdout.listen((data) {
        session.terminal.write(utf8.decode(data));
      });

      sshSession.stderr.listen((data) {
        session.terminal.write('\x1b[31m${utf8.decode(data)}\x1b[0m');
      });

      if (mounted) setState(() {});
      session.terminal.write('\x1b[32m[+] SSH Session Connected (Termius Mode)!\x1b[0m\r\n\r\n');
    } catch (e) {
      session.terminal.write('\r\n\x1b[31m[-] SSH Connection Failed: $e\x1b[0m\r\n');
      if (mounted) setState(() {});
    }
  }

  Future<void> _connectTelnet(ActiveSession session) async {
    session.terminal.write('\x1b[35m[*] Connecting Telnet to ${session.host}:${session.port}...\x1b[0m\r\n');
    try {
      final socket = await Socket.connect(
        session.host,
        session.port,
        timeout: const Duration(seconds: 10),
      );

      session.telnetSocket = socket;
      session.isConnected = true;

      session.terminal.onOutput = (data) {
        socket.add(utf8.encode(data));
      };

      socket.listen(
        (data) {
          session.terminal.write(utf8.decode(data, allowMalformed: true));
        },
        onError: (e) {
          session.terminal.write('\r\n\x1b[31m[-] Telnet Error: $e\x1b[0m\r\n');
        },
        onDone: () {
          session.terminal.write('\r\n\x1b[33m[Telnet Session Closed]\x1b[0m\r\n');
          session.isConnected = false;
          if (mounted) setState(() {});
        },
      );

      if (mounted) setState(() {});
      session.terminal.write('\x1b[32m[+] Telnet Session Connected!\x1b[0m\r\n\r\n');
    } catch (e) {
      session.terminal.write('\r\n\x1b[31m[-] Telnet Connection Failed: $e\x1b[0m\r\n');
      if (mounted) setState(() {});
    }
  }

  void _sendShortcut(String payload) {
    if (_sessions.isEmpty) return;
    final current = _sessions[_activeSessionIndex];
    if (current.protocol == TerminalProtocol.ssh && current.sshSession != null) {
      current.sshSession?.write(utf8.encode(payload));
    } else if (current.protocol == TerminalProtocol.telnet && current.telnetSocket != null) {
      current.telnetSocket?.add(utf8.encode(payload));
    }
  }

  void _showNewSessionDialog() {
    final hostCtrl = TextEditingController(text: widget.profile.routerIp);
    final portCtrl = TextEditingController(text: '23');
    final nameCtrl = TextEditingController(text: 'Edge Switch (Telnet)');
    TerminalProtocol selectedProto = TerminalProtocol.telnet;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: const Color(0xFF0F172A),
            title: const Text('Add Termius Session', style: TextStyle(color: Colors.white, fontSize: 16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Session Name', labelStyle: TextStyle(color: Colors.white60)),
                ),
                DropdownButton<TerminalProtocol>(
                  value: selectedProto,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Colors.cyanAccent),
                  isExpanded: true,
                  items: const [
                    DropdownMenuItem(value: TerminalProtocol.ssh, child: Text('SSH (Secure Shell)')),
                    DropdownMenuItem(value: TerminalProtocol.telnet, child: Text('Telnet (Switch / OLT / Router)')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setDialogState(() {
                        selectedProto = val;
                        portCtrl.text = val == TerminalProtocol.ssh ? '22' : '23';
                      });
                    }
                  },
                ),
                TextField(
                  controller: hostCtrl,
                  style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                  decoration: const InputDecoration(labelText: 'Host IP', labelStyle: TextStyle(color: Colors.white60)),
                ),
                TextField(
                  controller: portCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(labelText: 'Port', labelStyle: TextStyle(color: Colors.white60)),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: Colors.cyanAccent, foregroundColor: Colors.black),
                onPressed: () {
                  Navigator.pop(ctx);
                  _addNewSession(
                    name: nameCtrl.text.trim(),
                    host: hostCtrl.text.trim(),
                    port: int.tryParse(portCtrl.text) ?? 23,
                    protocol: selectedProto,
                  );
                },
                child: const Text('Connect Session'),
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
      s.telnetSocket?.close();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _sessions.isNotEmpty ? _sessions[_activeSessionIndex] : null;

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
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            Text(
              current?.isConnected == true ? 'Connected to ${current?.host}:${current?.port}' : 'Connecting...',
              style: TextStyle(
                fontSize: 11,
                color: current?.isConnected == true ? Colors.greenAccent : Colors.amberAccent,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_to_queue, color: Colors.cyanAccent),
            tooltip: 'New Session Tab',
            onPressed: _showNewSessionDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Termius Multi-Session Tabs Bar
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
                    onTap: () => setState(() => _activeSessionIndex = idx),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
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
                              color: s.protocol == TerminalProtocol.ssh ? Colors.cyanAccent : Colors.purpleAccent,
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
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

          // Termius Snippet Bar
          Container(
            height: 42,
            color: const Color(0xFF1E293B),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _shortcutButton('Tab', '\t'),
                _shortcutButton('Ctrl+C', '\x03'),
                _shortcutButton('Up', '\x1b[A'),
                _shortcutButton('Down', '\x1b[B'),
                ...(_snippets[_selectedSnippetCategory] ?? []).map((snip) {
                  return _shortcutButton(snip['label']!, snip['cmd']!);
                }),
                _shortcutButton('Enter', '\r'),
              ],
            ),
          ),

          // Terminal Viewport
          Expanded(
            child: Container(
              color: Colors.black,
              padding: const EdgeInsets.all(4),
              child: current != null
                  ? TerminalView(
                      current.terminal,
                      backgroundOpacity: 1.0,
                      textStyle: const TerminalStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                      ),
                    )
                  : const Center(child: Text('No active session', style: TextStyle(color: Colors.white38))),
            ),
          ),
        ],
      ),
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
