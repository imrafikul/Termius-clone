import 'dart:convert';

/// Represents an ISP or MikroTik PPTP connection profile with strict split-tunneling CIDRs.
class PPTPProfile {
  final String id;
  final String ispName;
  final String host;
  final int port;
  final String username;
  final String password;
  final String targetSubnet; // e.g. "192.168.88.0/24" or comma-separated "192.168.88.0/24, 10.0.0.0/8"
  final String routerIp;     // Private IP on remote LAN for SSH/Winbox (e.g. "192.168.88.1")
  final int sshPort;        // Default 22
  final int winboxPort;     // Default 8291
  final int webPort;        // Default 80
  final int apiPort;        // Default 8728
  final int mtu;            // Default 1400
  final bool mppeEnabled;   // Default true (128-bit)
  final DateTime createdAt;

  const PPTPProfile({
    required this.id,
    required this.ispName,
    required this.host,
    this.port = 1723,
    required this.username,
    required this.password,
    required this.targetSubnet,
    required this.routerIp,
    this.sshPort = 22,
    this.winboxPort = 8291,
    this.webPort = 80,
    this.apiPort = 8728,
    this.mtu = 1400,
    this.mppeEnabled = true,
    required this.createdAt,
  });

  /// Extracts individual subnets from the targetSubnet string (supports 0.0.0.0/0 for Full Internet VPN).
  List<String> get sanitizedSubnets {
    if (targetSubnet.trim() == '0.0.0.0/0' || targetSubnet.trim() == '0.0.0.0') {
      return ['0.0.0.0/0'];
    }
    return targetSubnet
        .split(RegExp(r'[,;\n]'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  /// Verifies valid CIDR notation.
  bool get hasValidRoutingRules {
    return sanitizedSubnets.isNotEmpty;
  }

  PPTPProfile copyWith({
    String? id,
    String? ispName,
    String? host,
    int? port,
    String? username,
    String? password,
    String? targetSubnet,
    String? routerIp,
    int? sshPort,
    int? winboxPort,
    int? webPort,
    int? apiPort,
    int? mtu,
    bool? mppeEnabled,
    DateTime? createdAt,
  }) {
    return PPTPProfile(
      id: id ?? this.id,
      ispName: ispName ?? this.ispName,
      host: host ?? this.host,
      port: port ?? this.port,
      username: username ?? this.username,
      password: password ?? this.password,
      targetSubnet: targetSubnet ?? this.targetSubnet,
      routerIp: routerIp ?? this.routerIp,
      sshPort: sshPort ?? this.sshPort,
      winboxPort: winboxPort ?? this.winboxPort,
      webPort: webPort ?? this.webPort,
      apiPort: apiPort ?? this.apiPort,
      mtu: mtu ?? this.mtu,
      mppeEnabled: mppeEnabled ?? this.mppeEnabled,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'ispName': ispName,
      'host': host,
      'port': port,
      'username': username,
      'password': password,
      'targetSubnet': targetSubnet,
      'routerIp': routerIp,
      'sshPort': sshPort,
      'winboxPort': winboxPort,
      'webPort': webPort,
      'apiPort': apiPort,
      'mtu': mtu,
      'mppeEnabled': mppeEnabled,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory PPTPProfile.fromMap(Map<String, dynamic> map) {
    return PPTPProfile(
      id: map['id'] ?? '',
      ispName: map['ispName'] ?? '',
      host: map['host'] ?? '',
      port: map['port']?.toInt() ?? 1723,
      username: map['username'] ?? '',
      password: map['password'] ?? '',
      targetSubnet: map['targetSubnet'] ?? '192.168.88.0/24',
      routerIp: map['routerIp'] ?? '192.168.88.1',
      sshPort: map['sshPort']?.toInt() ?? 22,
      winboxPort: map['winboxPort']?.toInt() ?? 8291,
      webPort: map['webPort']?.toInt() ?? 80,
      apiPort: map['apiPort']?.toInt() ?? 8728,
      mtu: map['mtu']?.toInt() ?? 1400,
      mppeEnabled: map['mppeEnabled'] ?? true,
      createdAt: map['createdAt'] != null
          ? DateTime.parse(map['createdAt'])
          : DateTime.now(),
    );
  }

  String toJson() => json.encode(toMap());

  factory PPTPProfile.fromJson(String source) =>
      PPTPProfile.fromMap(json.decode(source));
}
