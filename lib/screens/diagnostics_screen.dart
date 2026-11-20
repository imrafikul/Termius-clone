import 'dart:async';
import 'dart:io';
import 'dart:math';
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

class PingSample {
  final int seq;
  final double latencyMs;
  final bool success;
  final int? ttl;
  final String method;

  PingSample({
    required this.seq,
    required this.latencyMs,
    required this.success,
    this.ttl,
    this.method = 'ICMP',
  });
}

class TracerouteHop {
  final int hop;
  final String ip;
  final double? latencyMs;
  final bool reached;
  final bool timedOut;

  TracerouteHop({
    required this.hop,
    required this.ip,
    this.latencyMs,
    required this.reached,
    required this.timedOut,
  });
}

class DiagnosticsScreen extends StatefulWidget {
  final PPTPProfile profile;

  const DiagnosticsScreen({super.key, required this.profile});

  @override
  State<DiagnosticsScreen> createState() => _DiagnosticsScreenState();
}

class _DiagnosticsScreenState extends State<DiagnosticsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final TextEditingController _targetIpController;
  final TextEditingController _customPortController = TextEditingController();

  // Standard Ping state
  bool _isPinging = false;
  final List<PingSample> _pingResults = [];

  // Speed Ping state
  bool _isSpeedPinging = false;
  int _speedIntervalMs = 100;
  int _speedSeq = 0;
  DateTime? _speedStartTime;
  final List<PingSample> _speedSamples = [];

  // Traceroute state
  bool _isTracing = false;
  int _maxHops = 20;
  String? _traceResolvedIp;
  final List<TracerouteHop> _traceHops = [];

  // Port Scan state
  bool _isScanningPorts = false;
  final List<PortProbeResult> _portResults = [];

  final List<Map<String, dynamic>> _targetPorts = [
    {'port': 8291, 'name': 'MikroTik Winbox'},
    {'port': 22, 'name': 'SSH Terminal'},
    {'port': 23, 'name': 'Telnet (OLT/Switch)'},
    {'port': 80, 'name': 'HTTP WebFig'},
    {'port': 443, 'name': 'HTTPS WebFig'},
    {'port': 8728, 'name': 'RouterOS API'},
    {'port': 1723, 'name': 'PPTP Control'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _targetIpController = TextEditingController(
      text: widget.profile.routerIp.isNotEmpty ? widget.profile.routerIp : '8.8.8.8',
    );
  }

  @override
  void dispose() {
    _isSpeedPinging = false;
    _isTracing = false;
    _isPinging = false;
    _tabController.dispose();
    _targetIpController.dispose();
    _customPortController.dispose();
    super.dispose();
  }

  /// Native Android ICMP ping with automatic TCP fallback
  Future<PingSample> _executeSinglePing(String host, int seq, {int timeoutSec = 1}) async {
    final stopwatch = Stopwatch()..start();
    try {
      final res = await Process.run(
        'ping',
        ['-n', '-c', '1', '-W', '$timeoutSec', host],
      ).timeout(Duration(seconds: timeoutSec + 2));

      stopwatch.stop();
      final out = '${res.stdout}\n${res.stderr}';
      final timeMatch = RegExp(r'time[=<]\s*([\d.]+)\s*ms', caseSensitive: false).firstMatch(out);
      final ttlMatch = RegExp(r'ttl=(\d+)', caseSensitive: false).firstMatch(out);

      if (res.exitCode == 0) {
        final ms = timeMatch != null
            ? double.tryParse(timeMatch.group(1)!) ?? stopwatch.elapsedMilliseconds.toDouble()
            : stopwatch.elapsedMilliseconds.toDouble();
        return PingSample(
          seq: seq,
          latencyMs: double.parse(ms.toStringAsFixed(1)),
          success: true,
          ttl: ttlMatch != null ? int.tryParse(ttlMatch.group(1)!) : null,
          method: 'ICMP',
        );
      }

      // If ping binary isn't permitted, fall back to TCP connect
      if (out.toLowerCase().contains('operation not permitted') ||
          out.toLowerCase().contains('permission denied')) {
        return _executeTcpFallbackPing(host, seq);
      }

      return PingSample(
        seq: seq,
        latencyMs: (timeoutSec * 1000).toDouble(),
        success: false,
        method: 'ICMP',
      );
    } catch (_) {
      return _executeTcpFallbackPing(host, seq);
    }
  }

  Future<PingSample> _executeTcpFallbackPing(String host, int seq) async {
    final stopwatch = Stopwatch()..start();
    final port = widget.profile.winboxPort > 0 ? widget.profile.winboxPort : 80;
    try {
      final socket = await Socket.connect(
        host,
        port,
        timeout: const Duration(milliseconds: 1200),
      );
      stopwatch.stop();
      await socket.close();
      return PingSample(
        seq: seq,
        latencyMs: stopwatch.elapsedMilliseconds.toDouble(),
        success: true,
        method: 'TCP:$port',
      );
    } on SocketException catch (e) {
      stopwatch.stop();
      // ECONNREFUSED still proves host IP is alive and reachable
      final msg = (e.osError?.message ?? '').toLowerCase();
      final reachable = msg.contains('refused');
      return PingSample(
        seq: seq,
        latencyMs: stopwatch.elapsedMilliseconds.toDouble(),
        success: reachable,
        method: 'TCP:$port',
      );
    } catch (_) {
      stopwatch.stop();
      return PingSample(
        seq: seq,
        latencyMs: 1200,
        success: false,
        method: 'TCP:$port',
      );
    }
  }

  // ==================== 1. STANDARD PING ====================
  Future<void> _runStandardPing() async {
    final host = _targetIpController.text.trim();
    if (host.isEmpty || _isPinging) return;

    setState(() {
      _isPinging = true;
      _pingResults.clear();
    });

    for (int i = 1; i <= 5; i++) {
      if (!_isPinging || !mounted) break;
      final sample = await _executeSinglePing(host, i, timeoutSec: 2);
      if (!mounted) break;
      setState(() {
        _pingResults.add(sample);
      });
      if (i < 5) {
        await Future.delayed(const Duration(milliseconds: 250));
      }
    }

    if (mounted) {
      setState(() => _isPinging = false);
    }
  }

  // ==================== 2. SPEED PING ====================
  Future<void> _toggleSpeedPing() async {
    if (_isSpeedPinging) {
      setState(() => _isSpeedPinging = false);
      return;
    }

    final host = _targetIpController.text.trim();
    if (host.isEmpty) return;

    setState(() {
      _isSpeedPinging = true;
      _speedSamples.clear();
      _speedSeq = 0;
      _speedStartTime = DateTime.now();
    });

    while (_isSpeedPinging && mounted) {
      final iterStart = DateTime.now();
      _speedSeq++;
      final sample = await _executeSinglePing(host, _speedSeq, timeoutSec: 1);
      if (!_isSpeedPinging || !mounted) break;

      setState(() {
        _speedSamples.add(sample);
        if (_speedSamples.length > 80) {
          _speedSamples.removeAt(0);
        }
      });

      final elapsed = DateTime.now().difference(iterStart).inMilliseconds;
      final waitMs = _speedIntervalMs - elapsed;
      if (waitMs > 0) {
        await Future.delayed(Duration(milliseconds: waitMs));
      }
    }

    if (mounted) {
      setState(() => _isSpeedPinging = false);
    }
  }

  Map<String, dynamic> _computeStats(List<PingSample> samples) {
    final total = samples.length;
    final ok = samples.where((s) => s.success).toList();
    final lats = ok.map((s) => s.latencyMs).toList()..sort();
    final loss = total == 0 ? 0.0 : ((total - ok.length) / total) * 100.0;

    if (lats.isEmpty) {
      return {
        'min': 0.0,
        'avg': 0.0,
        'max': 0.0,
        'p95': 0.0,
        'jitter': 0.0,
        'loss': loss,
        'grade': 'POOR',
      };
    }

    final minVal = lats.first;
    final maxVal = lats.last;
    final avgVal = lats.reduce((a, b) => a + b) / lats.length;
    final p95Val = lats[min(lats.length - 1, (lats.length * 0.95).floor())];

    double jitter = 0.0;
    final seqLats = ok.map((s) => s.latencyMs).toList();
    if (seqLats.length > 1) {
      double diffSum = 0.0;
      for (int i = 1; i < seqLats.length; i++) {
        diffSum += (seqLats[i] - seqLats[i - 1]).abs();
      }
      jitter = diffSum / (seqLats.length - 1);
    }

    String grade = 'POOR';
    if (loss == 0 && avgVal < 45 && jitter < 12) {
      grade = 'EXCELLENT';
    } else if (loss <= 2 && avgVal < 110 && jitter < 30) {
      grade = 'GOOD';
    } else if (loss <= 10 && avgVal < 220) {
      grade = 'FAIR';
    }

    return {
      'min': minVal,
      'avg': avgVal,
      'max': maxVal,
      'p95': p95Val,
      'jitter': jitter,
      'loss': loss,
      'grade': grade,
    };
  }

  // ==================== 3. TRACEROUTE ====================
  Future<void> _toggleTraceroute() async {
    if (_isTracing) {
      setState(() => _isTracing = false);
      return;
    }

    final host = _targetIpController.text.trim();
    if (host.isEmpty) return;

    setState(() {
      _isTracing = true;
      _traceHops.clear();
      _traceResolvedIp = null;
    });

    String targetIp = host;
    try {
      final addrs = await InternetAddress.lookup(host).timeout(const Duration(seconds: 3));
      if (addrs.isNotEmpty) {
        targetIp = addrs.first.address;
      }
    } catch (_) {
      // Keep raw host string
    }

    if (!mounted) return;
    setState(() => _traceResolvedIp = targetIp);

    for (int ttl = 1; ttl <= _maxHops; ttl++) {
      if (!_isTracing || !mounted) break;

      final stopwatch = Stopwatch()..start();
      try {
        final res = await Process.run(
          'ping',
          ['-n', '-c', '1', '-W', '1', '-t', '$ttl', targetIp],
        ).timeout(const Duration(seconds: 3));
        stopwatch.stop();

        final out = '${res.stdout}\n${res.stderr}';
        final exceedMatch = RegExp(
          r'From\s+([0-9a-fA-F.:]+).*?(?:Time to live exceeded|Hop limit exceeded)',
          caseSensitive: false,
        ).firstMatch(out);
        final replyMatch = RegExp(
          r'from\s+([0-9a-fA-F.:]+).*?time[=<]\s*([\d.]+)\s*ms',
          caseSensitive: false,
        ).firstMatch(out);

        if (replyMatch != null && res.exitCode == 0) {
          final hopIp = replyMatch.group(1)!.replaceAll(RegExp(r':+$'), '');
          final ms = double.tryParse(replyMatch.group(2)!) ?? stopwatch.elapsedMilliseconds.toDouble();
          if (!mounted) break;
          setState(() {
            _traceHops.add(TracerouteHop(
              hop: ttl,
              ip: hopIp,
              latencyMs: double.parse(ms.toStringAsFixed(1)),
              reached: true,
              timedOut: false,
            ));
          });
          break;
        } else if (exceedMatch != null) {
          final hopIp = exceedMatch.group(1)!.replaceAll(RegExp(r':+$'), '');
          final reached = hopIp == targetIp;
          if (!mounted) break;
          setState(() {
            _traceHops.add(TracerouteHop(
              hop: ttl,
              ip: hopIp,
              latencyMs: stopwatch.elapsedMilliseconds.toDouble(),
              reached: reached,
              timedOut: false,
            ));
          });
          if (reached) break;
        } else {
          if (!mounted) break;
          setState(() {
            _traceHops.add(TracerouteHop(
              hop: ttl,
              ip: '*',
              latencyMs: null,
              reached: false,
              timedOut: true,
            ));
          });
        }
      } catch (_) {
        stopwatch.stop();
        if (!mounted) break;
        setState(() {
          _traceHops.add(TracerouteHop(
            hop: ttl,
            ip: '*',
            latencyMs: null,
            reached: false,
            timedOut: true,
          ));
        });
      }
    }

    if (mounted) {
      setState(() => _isTracing = false);
    }
  }

  // ==================== 4. PORT SCANNER ====================
  Future<void> _runPortScan() async {
    final host = _targetIpController.text.trim();
    if (host.isEmpty || _isScanningPorts) return;

    setState(() {
      _isScanningPorts = true;
      _portResults.clear();
    });

    final portsToScan = List<Map<String, dynamic>>.from(_targetPorts);
    final custom = int.tryParse(_customPortController.text.trim());
    if (custom != null && custom > 0 && custom <= 65535) {
      if (!portsToScan.any((p) => p['port'] == custom)) {
        portsToScan.add({'port': custom, 'name': 'Custom Port $custom'});
      }
    }

    for (final item in portsToScan) {
      if (!mounted) break;
      final port = item['port'] as int;
      final name = item['name'] as String;

      final stopwatch = Stopwatch()..start();
      bool open = false;
      String? errorMsg;

      try {
        final socket = await Socket.connect(
          host,
          port,
          timeout: const Duration(milliseconds: 2200),
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
      setState(() => _isScanningPorts = false);
    }
  }

  Color _latencyColor(double ms, bool success) {
    if (!success) return Colors.redAccent;
    if (ms < 35) return const Color(0xFF34D399);
    if (ms < 85) return Colors.cyanAccent;
    if (ms < 160) return Colors.amberAccent;
    return Colors.redAccent;
  }

  Color _gradeColor(String grade) {
    switch (grade) {
      case 'EXCELLENT':
        return const Color(0xFF34D399);
      case 'GOOD':
        return Colors.cyanAccent;
      case 'FAIR':
        return Colors.amberAccent;
      default:
        return Colors.redAccent;
    }
  }

  Widget _buildKpiBox(String label, String value, Color valueColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF1E293B)),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(color: Colors.white54, fontSize: 10, fontFamily: 'monospace')),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: valueColor,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickTargetChip(String label, String value) {
    final active = _targetIpController.text.trim() == value;
    return InkWell(
      onTap: () => setState(() => _targetIpController.text = value),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: active ? Colors.cyanAccent.withOpacity(0.18) : const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: active ? Colors.cyanAccent : const Color(0xFF334155),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? Colors.cyanAccent : Colors.white70,
            fontSize: 11,
            fontFamily: 'monospace',
          ),
        ),
      ),
    );
  }

  // ==================== TAB BUILDERS ====================
  Widget _buildPingTab() {
    final stats = _computeStats(_pingResults);
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'ICMP / TCP Ping (5 Packets)',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purpleAccent,
                foregroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
              icon: Icon(_isPinging ? Icons.hourglass_top : Icons.play_arrow, size: 16),
              label: Text(_isPinging ? 'Pinging...' : 'Start Ping',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              onPressed: _isPinging ? null : _runStandardPing,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_pingResults.isNotEmpty) ...[
          Row(
            children: [
              _buildKpiBox('MIN', '${(stats['min'] as double).toStringAsFixed(1)}ms', const Color(0xFF34D399)),
              const SizedBox(width: 6),
              _buildKpiBox('AVG', '${(stats['avg'] as double).toStringAsFixed(1)}ms', Colors.cyanAccent),
              const SizedBox(width: 6),
              _buildKpiBox('MAX', '${(stats['max'] as double).toStringAsFixed(1)}ms', Colors.amberAccent),
              const SizedBox(width: 6),
              _buildKpiBox('LOSS', '${(stats['loss'] as double).toStringAsFixed(0)}%',
                  (stats['loss'] as double) == 0 ? const Color(0xFF34D399) : Colors.redAccent),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            child: Column(
              children: _pingResults.map((p) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('seq=${p.seq}  [${p.method}]',
                          style: const TextStyle(color: Colors.white60, fontFamily: 'monospace', fontSize: 12)),
                      if (p.ttl != null)
                        Text('ttl=${p.ttl}',
                            style: const TextStyle(color: Colors.white54, fontFamily: 'monospace', fontSize: 11)),
                      Text(
                        p.success ? '${p.latencyMs} ms' : 'TIMEOUT',
                        style: TextStyle(
                          color: _latencyColor(p.latencyMs, p.success),
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ] else
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            alignment: Alignment.center,
            child: const Text(
              'Tap "Start Ping" to run native ICMP/TCP latency probes.',
              style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace'),
            ),
          ),
      ],
    );
  }

  Widget _buildSpeedPingTab() {
    final stats = _computeStats(_speedSamples);
    final grade = stats['grade'] as String;
    final visible = _speedSamples.length > 40
        ? _speedSamples.sublist(_speedSamples.length - 40)
        : _speedSamples;
    final maxLat = visible
        .where((s) => s.success)
        .fold<double>(60.0, (prev, el) => max(prev, el.latencyMs));

    double pps = 0.0;
    if (_speedStartTime != null && _speedSeq > 0) {
      final secs = max(1, DateTime.now().difference(_speedStartTime!).inMilliseconds) / 1000.0;
      pps = _speedSeq / secs;
    }

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Wrap(
              spacing: 6,
              children: [100, 250, 500].map((ms) {
                final selected = _speedIntervalMs == ms;
                return ChoiceChip(
                  label: Text('${ms}ms', style: const TextStyle(fontSize: 11, fontFamily: 'monospace')),
                  selected: selected,
                  selectedColor: const Color(0xFF10B981),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: TextStyle(
                    color: selected ? const Color(0xFF0F172A) : Colors.white70,
                    fontWeight: FontWeight.bold,
                  ),
                  onSelected: _isSpeedPinging
                      ? null
                      : (_) => setState(() => _speedIntervalMs = ms),
                );
              }).toList(),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isSpeedPinging ? Colors.redAccent : const Color(0xFF10B981),
                foregroundColor: _isSpeedPinging ? Colors.white : const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
              icon: Icon(_isSpeedPinging ? Icons.stop : Icons.speed, size: 16),
              label: Text(
                _isSpeedPinging ? 'Stop' : 'Start Speed Ping',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              onPressed: _toggleSpeedPing,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_speedSamples.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Sent: $_speedSeq  ·  ${pps.toStringAsFixed(1)} pkt/s',
                  style: const TextStyle(color: Colors.white70, fontFamily: 'monospace', fontSize: 12),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _gradeColor(grade).withOpacity(0.18),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _gradeColor(grade)),
                  ),
                  child: Text(
                    grade,
                    style: TextStyle(
                      color: _gradeColor(grade),
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildKpiBox('MIN', '${(stats['min'] as double).toStringAsFixed(1)}ms', const Color(0xFF34D399)),
              const SizedBox(width: 6),
              _buildKpiBox('AVG', '${(stats['avg'] as double).toStringAsFixed(1)}ms', Colors.cyanAccent),
              const SizedBox(width: 6),
              _buildKpiBox('P95', '${(stats['p95'] as double).toStringAsFixed(1)}ms', Colors.lightBlueAccent),
              const SizedBox(width: 6),
              _buildKpiBox('JITTER', '${(stats['jitter'] as double).toStringAsFixed(1)}ms', Colors.purpleAccent),
            ],
          ),
          const SizedBox(height: 12),
          // Live Bar Chart
          Container(
            height: 140,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Live Latency Sparkline',
                        style: TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'monospace')),
                    Text('Loss: ${(stats['loss'] as double).toStringAsFixed(1)}%',
                        style: TextStyle(
                            color: (stats['loss'] as double) == 0 ? const Color(0xFF34D399) : Colors.redAccent,
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: visible.map((s) {
                      final ratio = s.success ? (s.latencyMs / maxLat).clamp(0.08, 1.0) : 1.0;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 1),
                          child: FractionallySizedBox(
                            heightFactor: ratio,
                            alignment: Alignment.bottomCenter,
                            child: Container(
                              decoration: BoxDecoration(
                                color: _latencyColor(s.latencyMs, s.success),
                                borderRadius: const BorderRadius.vertical(top: Radius.circular(2)),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
        ] else
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            alignment: Alignment.center,
            child: const Text(
              'Tap "Start Speed Ping" for continuous rapid latency & jitter monitoring.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace'),
            ),
          ),
      ],
    );
  }

  Widget _buildTracerouteTab() {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Hop-by-Hop Traceroute',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                if (_traceResolvedIp != null)
                  Text(
                    'Target IP: $_traceResolvedIp (Max $_maxHops hops)',
                    style: const TextStyle(color: Colors.cyanAccent, fontSize: 11, fontFamily: 'monospace'),
                  ),
              ],
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isTracing ? Colors.redAccent : Colors.cyanAccent,
                foregroundColor: _isTracing ? Colors.white : const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
              icon: Icon(_isTracing ? Icons.stop : Icons.alt_route, size: 16),
              label: Text(
                _isTracing ? 'Stop Trace' : 'Run Traceroute',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              onPressed: _toggleTraceroute,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_traceHops.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            alignment: Alignment.center,
            child: Text(
              _isTracing
                  ? 'Tracing TTL 1 → $_maxHops...'
                  : 'Tap "Run Traceroute" to trace every L3 hop on Android.',
              style: const TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace'),
            ),
          )
        else
          ..._traceHops.map((h) {
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: h.reached ? const Color(0xFF064E3B).withOpacity(0.4) : const Color(0xFF111827),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: h.reached ? const Color(0xFF10B981) : const Color(0xFF1F2937),
                ),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 28,
                    child: Text(
                      '#${h.hop}',
                      style: const TextStyle(
                        color: Colors.cyanAccent,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      h.timedOut ? '* * *  Request timed out' : h.ip,
                      style: TextStyle(
                        color: h.timedOut
                            ? Colors.white38
                            : (h.reached ? const Color(0xFF34D399) : Colors.white),
                        fontFamily: 'monospace',
                        fontWeight: h.reached ? FontWeight.bold : FontWeight.normal,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  Text(
                    h.latencyMs != null ? '${h.latencyMs} ms' : '—',
                    style: TextStyle(
                      color: h.latencyMs != null
                          ? _latencyColor(h.latencyMs!, true)
                          : Colors.white38,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }

  Widget _buildPortScanTab() {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _customPortController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Custom port (optional)',
                  hintStyle: const TextStyle(color: Colors.white38, fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF111827),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF1F2937)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amberAccent,
                foregroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              icon: Icon(_isScanningPorts ? Icons.hourglass_top : Icons.search, size: 16),
              label: Text(
                _isScanningPorts ? 'Scanning...' : 'Scan Ports',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              onPressed: _isScanningPorts ? null : _runPortScan,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_portResults.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF1F2937)),
            ),
            alignment: Alignment.center,
            child: const Text(
              'Scan Winbox (8291), SSH (22), Telnet (23), WebFig (80/443), API (8728) & PPTP (1723).',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace'),
            ),
          )
        else
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
                      const SizedBox(width: 10),
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
      ],
    );
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
        bottom: TabBar(
          controller: _tabController,
          isScrollable: false,
          indicatorColor: Colors.cyanAccent,
          labelColor: Colors.cyanAccent,
          unselectedLabelColor: Colors.white54,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
          tabs: const [
            Tab(icon: Icon(Icons.bolt, size: 18), text: 'Ping'),
            Tab(icon: Icon(Icons.speed, size: 18), text: 'Speed Ping'),
            Tab(icon: Icon(Icons.alt_route, size: 18), text: 'Traceroute'),
            Tab(icon: Icon(Icons.radar, size: 18), text: 'Port Scan'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Shared Target Host Input Bar
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            color: const Color(0xFF111827),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _targetIpController,
                  style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 14),
                  decoration: InputDecoration(
                    labelText: 'Target IP or Hostname',
                    labelStyle: const TextStyle(color: Colors.white54, fontSize: 12),
                    prefixIcon: const Icon(Icons.dns, color: Colors.cyanAccent, size: 18),
                    filled: true,
                    fillColor: const Color(0xFF0B0F19),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFF1F2937)),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    if (widget.profile.routerIp.isNotEmpty)
                      _buildQuickTargetChip('Router (${widget.profile.routerIp})', widget.profile.routerIp),
                    _buildQuickTargetChip('8.8.8.8', '8.8.8.8'),
                    _buildQuickTargetChip('1.1.1.1', '1.1.1.1'),
                    _buildQuickTargetChip('google.com', 'google.com'),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPingTab(),
                _buildSpeedPingTab(),
                _buildTracerouteTab(),
                _buildPortScanTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
