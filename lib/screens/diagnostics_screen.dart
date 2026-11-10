import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import '../models/pptp_profile.dart';

class PortProbeResult {
  final int port;
  final String serviceName;
  final bool isOpen;
  final int latencyMs;
  final String? error;

  PortProbeResult({
    required this.port,
    required this.serviceName,
    required this.isOpen,
    required this.latencyMs,
    this.error,
  });
}

class PingResult {
  final int seq;
  final int latencyMs;
  final bool success;

  PingResult({required this.seq, required this.latencyMs, required this.success});
}

class DiagnosticsScreen extends StatefulWidget {
  final PPTPProfile profile;

  const DiagnosticsScreen({super.key, required this.profile});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen> {
  bool _isScanningPorts = false;
  bool _isPinging = false;
  late final TextEditingController _targetIpController;
  final List<PortProbeResult> _portResults = [];
  final List<PingResult> _pingResults = [];

  final List<Map<String, dynamic>> _targetPorts = [
    {'port': 8291, 'name': 'MikroTik Winbox'},
    {'port': 22, 'name': 'SSH Terminal'},
    {'port': 80, 'name': 'HTTP WebFig'},
    {'port': 443, 'name': 'HTTPS WebFig'},
    {'port': 8728, 'name': 'RouterOS API'},
    {'port': 1723, 'name': 'PPTP Control'},
  ];

  @override
  void initState() {
    super.initState();
    _targetIpController = TextEditingController(text: widget.profile.routerIp);
    _runPortScan();
  }

  @override
  void dispose() {
    _targetIpController.dispose();
    super.dispose();
  }

  Future<void> _runPortScan() async {
    final host = _targetIpController.text.trim();
    if (host.isEmpty) return;

    setState(() {
      _isScanningPorts = true;
      _portResults.clear();
    });

    for (final item in _targetPorts) {
      final port = item['port'] as int;
      final name = item['name'] as String;

      final stopwatch = Stopwatch()..start();
      bool open = false;
      String? errorMsg;

      try {
        final socket = await Socket.connect(
          host,
          port,
          timeout: const Duration(milliseconds: 2500),
        );
        stopwatch.stop();
        open = true;
        await socket.close();
      } on SocketException catch (e) {
        stopwatch.stop();
        open = false;
        errorMsg = e.osError?.message ?? 'Refused or Timed out';
      } catch (e) {
        stopwatch.stop();
        open = false;
        errorMsg = e.toString();
      }

      if (mounted) {
        setState(() {
          _portResults.add(PortProbeResult(
            port: port,
            serviceName: name,
            isOpen: open,
            latencyMs: stopwatch.elapsedMilliseconds,
            error: errorMsg,
          ));
        });
      }
    }

    if (mounted) {
      setState(() {
        _isScanningPorts = false;
      });
    }
  }

  Future<void> _runPingProbe() async {
    final host = _targetIpController.text.trim();
    if (host.isEmpty) return;

    setState(() {
      _isPinging = true;
      _pingResults.clear();
    });

    for (int i = 1; i <= 5; i++) {
      final stopwatch = Stopwatch()..start();
      bool ok = false;
      try {
        // Attempt TCP connect to router's default port 80/22/8291 to determine RTT
        final socket = await Socket.connect(
          host,
          widget.profile.winboxPort,
          timeout: const Duration(milliseconds: 1500),
        );
        stopwatch.stop();
        ok = true;
        await socket.close();
      } catch (_) {
        stopwatch.stop();
        ok = false;
      }

      if (mounted) {
        setState(() {
          _pingResults.add(PingResult(
            seq: i,
            latencyMs: ok ? stopwatch.elapsedMilliseconds : 1500,
            success: ok,
          ));
        });
      }
      await Future.delayed(const Duration(milliseconds: 200));
    }

    if (mounted) {
      setState(() {
        _isPinging = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text(
          'Network Diagnostics',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.cyanAccent),
            onPressed: (_isScanningPorts || _isPinging) ? null : _runPortScan,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Target Host IP selector
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _targetIpController,
                    style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                    decoration: const InputDecoration(
                      labelText: 'Target Router IP (Remote LAN)',
                      labelStyle: TextStyle(color: Colors.white54, fontSize: 12),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.cyanAccent,
                    foregroundColor: const Color(0xFF0F172A),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                  onPressed: (_isScanningPorts || _isPinging) ? null : _runPortScan,
                  child: const Text('Probe Ports', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Router Port Scanner',
                style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 14),
              ),
              if (_isScanningPorts)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.cyanAccent),
                ),
            ],
          ),
          const SizedBox(height: 10),
          // Port list
          ..._portResults.map((res) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: res.isOpen ? const Color(0xFF10B981) : const Color(0xFF1F2937),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          ':${res.port}',
                          style: const TextStyle(
                            color: Colors.cyanAccent,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        res.serviceName,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        '${res.latencyMs} ms',
                        style: const TextStyle(color: Colors.white54, fontFamily: 'monospace', fontSize: 12),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: res.isOpen ? const Color(0xFF065F46) : const Color(0xFF334155),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          res.isOpen ? 'OPEN' : 'CLOSED',
                          style: TextStyle(
                            color: res.isOpen ? const Color(0xFF34D399) : Colors.white60,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Round-Trip Latency (Ping)',
                style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 14),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E293B),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  side: const BorderSide(color: Color(0xFF334155)),
                ),
                icon: const Icon(Icons.speed, size: 16, color: Colors.cyanAccent),
                label: const Text('Start Ping', style: TextStyle(fontSize: 12)),
                onPressed: _isPinging ? null : _runPingProbe,
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_pingResults.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: const Text('Tap "Start Ping" to test latency over the PPTP split tunnel.',
                  style: TextStyle(color: Colors.white38, fontSize: 12)),
            )
          else
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: _pingResults.map((p) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('icmp_seq=${p.seq}',
                            style: const TextStyle(color: Colors.white60, fontFamily: 'monospace', fontSize: 12)),
                        Text(p.success ? 'bytes=64' : 'packet lost',
                            style: TextStyle(color: p.success ? Colors.white70 : Colors.redAccent, fontSize: 12)),
                        Text(p.success ? 'time=${p.latencyMs} ms' : 'timeout',
                            style: TextStyle(
                              color: p.success ? Colors.greenAccent : Colors.redAccent,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            )),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}
