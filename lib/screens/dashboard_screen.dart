import 'package:flutter/material.dart';
import '../models/pptp_profile.dart';
import '../services/storage_service.dart';
import '../services/vpn_service.dart';
import 'terminal_screen.dart';
import 'diagnostics_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final StorageService _storageService = StorageService();
  final VpnService _vpnService = VpnService();

  List<PPTPProfile> _profiles = [];
  String? _activeProfileId;
  VpnStatusEvent _vpnStatus = const VpnStatusEvent(
    state: VpnState.disconnected,
    message: 'Disconnected',
  );
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
    _listenVpn();
  }

  Future<void> _loadData() async {
    final profiles = await _storageService.getProfiles();
    final activeId = await _storageService.getActiveProfileId();
    setState(() {
      _profiles = profiles;
      _activeProfileId = activeId ?? (profiles.isNotEmpty ? profiles.first.id : null);
      _isLoading = false;
    });
  }

  void _listenVpn() {
    _vpnService.statusStream.listen((status) {
      if (mounted) {
        setState(() {
          _vpnStatus = status;
        });
      }
    });
  }

  PPTPProfile? get _activeProfile {
    try {
      return _profiles.firstWhere((p) => p.id == _activeProfileId);
    } catch (_) {
      return _profiles.isNotEmpty ? _profiles.first : null;
    }
  }

  Future<void> _toggleVpn(PPTPProfile profile) async {
    if (_vpnStatus.state == VpnState.connected ||
        _vpnStatus.state == VpnState.connecting ||
        _vpnStatus.state == VpnState.authenticating) {
      await _vpnService.disconnect();
    } else {
      await _storageService.setActiveProfileId(profile.id);
      setState(() {
        _activeProfileId = profile.id;
      });
      await _vpnService.connect(profile);
    }
  }

  void _showAddEditProfileDialog([PPTPProfile? existing]) {
    final formKey = GlobalKey<FormState>();
    final nameCtrl = TextEditingController(text: existing?.ispName ?? '');
    final hostCtrl = TextEditingController(text: existing?.host ?? '');
    final portCtrl = TextEditingController(text: (existing?.port ?? 1723).toString());
    final userCtrl = TextEditingController(text: existing?.username ?? '');
    final passCtrl = TextEditingController(text: existing?.password ?? '');
    final subnetCtrl = TextEditingController(text: existing?.targetSubnet ?? '192.168.88.0/24');
    final routerIpCtrl = TextEditingController(text: existing?.routerIp ?? '192.168.88.1');
    final sshPortCtrl = TextEditingController(text: (existing?.sshPort ?? 22).toString());
    final winboxPortCtrl = TextEditingController(text: (existing?.winboxPort ?? 8291).toString());
    bool mppe = existing?.mppeEnabled ?? true;
    bool obscurePass = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                top: 24,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            existing == null ? 'Add ISP PPTP Profile' : 'Edit Profile',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.white70),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Split Tunneling Warning Notice
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF334155)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.shield_outlined, color: Colors.cyanAccent, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Split-Tunneling Active: 0.0.0.0/0 is strictly forbidden. Enter ONLY private subnets.',
                                style: TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: nameCtrl,
                        style: const TextStyle(color: Colors.white),
                        decoration: _inputDecoration('ISP / Site Name', 'e.g. North POP · CCR2004'),
                        validator: (v) => v == null || v.isEmpty ? 'Name required' : null,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: TextFormField(
                              controller: hostCtrl,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('PPTP Server Host/IP', '103.45.89.12'),
                              validator: (v) => v == null || v.isEmpty ? 'Host required' : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 1,
                            child: TextFormField(
                              controller: portCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('Port', '1723'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: userCtrl,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('Username', 'admin'),
                              validator: (v) => v == null || v.isEmpty ? 'User required' : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextFormField(
                              controller: passCtrl,
                              obscureText: obscurePass,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('Password', '••••••••').copyWith(
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    obscurePass ? Icons.visibility_off : Icons.visibility,
                                    color: Colors.white54,
                                    size: 18,
                                  ),
                                  onPressed: () => setModalState(() => obscurePass = !obscurePass),
                                ),
                              ),
                              validator: (v) => v == null || v.isEmpty ? 'Password required' : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: subnetCtrl,
                        style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                        decoration: _inputDecoration('Target Subnets (CIDRs)', '192.168.88.0/24, 10.0.0.0/8'),
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Subnet required';
                          if (v.contains('0.0.0.0/0')) return '0.0.0.0/0 violates split tunneling';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            flex: 2,
                            child: TextFormField(
                              controller: routerIpCtrl,
                              style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                              decoration: _inputDecoration('Router LAN IP', '192.168.88.1'),
                              validator: (v) => v == null || v.isEmpty ? 'LAN IP required' : null,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 1,
                            child: TextFormField(
                              controller: sshPortCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('SSH Port', '22'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 1,
                            child: TextFormField(
                              controller: winboxPortCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(color: Colors.white),
                              decoration: _inputDecoration('Winbox', '8291'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'MPPE 128-bit Encryption',
                            style: TextStyle(color: Colors.white, fontSize: 14),
                          ),
                          Switch(
                            value: mppe,
                            activeColor: Colors.cyanAccent,
                            onChanged: (val) => setModalState(() => mppe = val),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.cyanAccent,
                            foregroundColor: const Color(0xFF0F172A),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () async {
                            if (!formKey.currentState!.validate()) return;
                            final newProfile = PPTPProfile(
                              id: existing?.id ?? 'prof_${DateTime.now().millisecondsSinceEpoch}',
                              ispName: nameCtrl.text.trim(),
                              host: hostCtrl.text.trim(),
                              port: int.tryParse(portCtrl.text) ?? 1723,
                              username: userCtrl.text.trim(),
                              password: passCtrl.text.trim(),
                              targetSubnet: subnetCtrl.text.trim(),
                              routerIp: routerIpCtrl.text.trim(),
                              sshPort: int.tryParse(sshPortCtrl.text) ?? 22,
                              winboxPort: int.tryParse(winboxPortCtrl.text) ?? 8291,
                              mppeEnabled: mppe,
                              createdAt: existing?.createdAt ?? DateTime.now(),
                            );
                            await _storageService.upsertProfile(newProfile);
                            await _loadData();
                            if (mounted) Navigator.pop(ctx);
                          },
                          child: Text(
                            existing == null ? 'Save Profile' : 'Update Profile',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  InputDecoration _inputDecoration(String label, String hint) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white60, fontSize: 13),
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
      filled: true,
      fillColor: const Color(0xFF1E293B),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Colors.cyanAccent),
      ),
    );
  }

  Color _getStatusColor() {
    switch (_vpnStatus.state) {
      case VpnState.connected:
        return const Color(0xFF10B981);
      case VpnState.connecting:
      case VpnState.authenticating:
        return const Color(0xFFF59E0B);
      case VpnState.error:
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeProfile;
    final isConnected = _vpnStatus.state == VpnState.connected;
    final isPending = _vpnStatus.state == VpnState.connecting ||
        _vpnStatus.state == VpnState.authenticating;

    return Scaffold(
      backgroundColor: const Color(0xFF0B0F19),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.cyanAccent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(Icons.hub_outlined, color: Colors.cyanAccent, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'PPTP Solution',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: Colors.cyanAccent),
            tooltip: 'Add Profile',
            onPressed: () => _showAddEditProfileDialog(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.cyanAccent))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Active Connection Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF111827),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isConnected ? const Color(0xFF10B981) : const Color(0xFF1F2937),
                      width: isConnected ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  color: _getStatusColor(),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _vpnStatus.state.name.toUpperCase(),
                                style: TextStyle(
                                  color: _getStatusColor(),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            isConnected ? 'tun0 active' : 'idle',
                            style: const TextStyle(
                              color: Colors.white38,
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        active?.ispName ?? 'No Profile Selected',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Target Host: ${active?.host ?? "—"} : ${active?.port ?? 1723}',
                        style: const TextStyle(color: Colors.white60, fontSize: 13),
                      ),
                      const SizedBox(height: 12),
                      // Split Tunneling Route Summary
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.alt_route, size: 16, color: Colors.cyanAccent),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Split Subnets: ${active?.targetSubnet ?? "None"}',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Action buttons
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isConnected
                                    ? const Color(0xFFDC2626)
                                    : (isPending ? const Color(0xFF475569) : Colors.cyanAccent),
                                foregroundColor: isConnected
                                    ? Colors.white
                                    : (isPending ? Colors.white70 : const Color(0xFF0F172A)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: isPending
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : Icon(isConnected ? Icons.power_settings_new : Icons.play_arrow),
                              label: Text(
                                isConnected
                                    ? 'Disconnect'
                                    : (isPending ? 'Connecting...' : 'Connect PPTP'),
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                              ),
                              onPressed: active == null ? null : () => _toggleVpn(active),
                            ),
                          ),
                        ],
                      ),
                      if (isConnected && active != null) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.cyanAccent,
                                  side: const BorderSide(color: Color(0xFF334155)),
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                icon: const Icon(Icons.terminal, size: 18),
                                label: const Text('MikroTik Terminal', style: TextStyle(fontSize: 12)),
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => TerminalScreen(profile: active),
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white70,
                                  side: const BorderSide(color: Color(0xFF334155)),
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                icon: const Icon(Icons.network_check, size: 18),
                                label: const Text('Diagnostics', style: TextStyle(fontSize: 12)),
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => DiagnosticsScreen(profile: active),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Saved ISP Profiles',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 10),
                ..._profiles.map((profile) {
                  final isCurrentActive = profile.id == _activeProfileId;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111827),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isCurrentActive ? Colors.cyanAccent.withOpacity(0.5) : const Color(0xFF1F2937),
                      ),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      title: Text(
                        profile.ispName,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(
                            'Host: ${profile.host} · User: ${profile.username}',
                            style: const TextStyle(color: Colors.white60, fontSize: 12),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Subnet: ${profile.targetSubnet}',
                            style: const TextStyle(color: Colors.cyanAccent, fontFamily: 'monospace', fontSize: 11),
                          ),
                        ],
                      ),
                      trailing: PopupMenuButton<String>(
                        icon: const Icon(Icons.more_vert, color: Colors.white54),
                        color: const Color(0xFF1E293B),
                        onSelected: (val) async {
                          if (val == 'select') {
                            await _storageService.setActiveProfileId(profile.id);
                            setState(() => _activeProfileId = profile.id);
                          } else if (val == 'edit') {
                            _showAddEditProfileDialog(profile);
                          } else if (val == 'delete') {
                            await _storageService.deleteProfile(profile.id);
                            await _loadData();
                          } else if (val == 'terminal') {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => TerminalScreen(profile: profile)),
                            );
                          } else if (val == 'diag') {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => DiagnosticsScreen(profile: profile)),
                            );
                          }
                        },
                        itemBuilder: (ctx) => [
                          const PopupMenuItem(value: 'select', child: Text('Set as Active', style: TextStyle(color: Colors.white))),
                          const PopupMenuItem(value: 'terminal', child: Text('Open Terminal', style: TextStyle(color: Colors.white))),
                          const PopupMenuItem(value: 'diag', child: Text('Run Diagnostics', style: TextStyle(color: Colors.white))),
                          const PopupMenuItem(value: 'edit', child: Text('Edit Profile', style: TextStyle(color: Colors.white))),
                          const PopupMenuItem(value: 'delete', child: Text('Delete Profile', style: TextStyle(color: Colors.redAccent))),
                        ],
                      ),
                      onTap: () async {
                        await _storageService.setActiveProfileId(profile.id);
                        setState(() => _activeProfileId = profile.id);
                      },
                    ),
                  );
                }),
              ],
            ),
    );
  }
}
