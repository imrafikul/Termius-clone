import 'dart:async';
import 'package:flutter/services.dart';
import '../models/pptp_profile.dart';

enum VpnState {
  disconnected,
  connecting,
  authenticating,
  connected,
  disconnecting,
  error,
}

class VpnStatusEvent {
  final VpnState state;
  final String message;
  final String? assignedIp;
  final String? gatewayIp;
  final List<String> activeRoutes;
  final String? error;

  const VpnStatusEvent({
    required this.state,
    required this.message,
    this.assignedIp,
    this.gatewayIp,
    this.activeRoutes = const [],
    this.error,
  });

  factory VpnStatusEvent.fromMap(Map<dynamic, dynamic> map) {
    final statusStr = map['status']?.toString() ?? 'DISCONNECTED';
    VpnState state;
    switch (statusStr) {
      case 'CONNECTING':
      case 'CONNECTING_TCP':
      case 'PPTP_HANDSHAKE':
        state = VpnState.connecting;
        break;
      case 'AUTHENTICATING':
      case 'ESTABLISHING_TUN':
        state = VpnState.authenticating;
        break;
      case 'CONNECTED':
        state = VpnState.connected;
        break;
      case 'DISCONNECTING':
        state = VpnState.disconnecting;
        break;
      case 'ERROR':
        state = VpnState.error;
        break;
      default:
        state = VpnState.disconnected;
        break;
    }

    final routesRaw = map['routes'];
    List<String> routes = [];
    if (routesRaw is List) {
      routes = routesRaw.map((e) => e.toString()).toList();
    }

    return VpnStatusEvent(
      state: state,
      message: map['message']?.toString() ?? '',
      assignedIp: map['assignedIp']?.toString(),
      gatewayIp: map['gatewayIp']?.toString(),
      activeRoutes: routes,
      error: map['error']?.toString(),
    );
  }
}

class VpnService {
  static const MethodChannel _methodChannel =
      MethodChannel('com.pptpsolution.app/vpn_control');
  static const EventChannel _eventChannel =
      EventChannel('com.pptpsolution.app/vpn_status');

  static final VpnService _instance = VpnService._internal();
  factory VpnService() => _instance;
  VpnService._internal() {
    _initEventStream();
  }

  final StreamController<VpnStatusEvent> _statusController =
      StreamController<VpnStatusEvent>.broadcast();
  Stream<VpnStatusEvent> get statusStream => _statusController.stream;

  VpnStatusEvent _currentStatus = const VpnStatusEvent(
    state: VpnState.disconnected,
    message: 'Tunnel Idle',
  );
  VpnStatusEvent get currentStatus => _currentStatus;

  void _initEventStream() {
    _eventChannel.receiveBroadcastStream().listen(
      (dynamic event) {
        if (event is Map) {
          final statusEvent = VpnStatusEvent.fromMap(event);
          _currentStatus = statusEvent;
          _statusController.add(statusEvent);
        }
      },
      onError: (dynamic error) {
        final errEvent = VpnStatusEvent(
          state: VpnState.error,
          message: 'VPN Platform Error',
          error: error.toString(),
        );
        _currentStatus = errEvent;
        _statusController.add(errEvent);
      },
    );
  }

  /// Initiates PPTP connection with strict split-tunneling.
  Future<bool> connect(PPTPProfile profile) async {
    try {
      // Validate split routing rule before sending to native
      if (!profile.hasValidSplitTunnelRules) {
        throw Exception(
            'Invalid Split-Tunnel configuration: 0.0.0.0/0 is strictly prohibited.');
      }

      final Map<String, dynamic> args = {
        'host': profile.host,
        'port': profile.port,
        'username': profile.username,
        'password': profile.password,
        'targetSubnets': profile.sanitizedSubnets,
        'mtu': profile.mtu,
        'profileName': profile.ispName,
      };

      final bool? result =
          await _methodChannel.invokeMethod<bool>('startVpn', args);
      return result ?? false;
    } on PlatformException catch (e) {
      _statusController.add(VpnStatusEvent(
        state: VpnState.error,
        message: 'Native VpnService call failed',
        error: e.message,
      ));
      return false;
    } catch (e) {
      _statusController.add(VpnStatusEvent(
        state: VpnState.error,
        message: 'Connection setup failed',
        error: e.toString(),
      ));
      return false;
    }
  }

  /// Terminates the active VPN tunnel.
  Future<bool> disconnect() async {
    try {
      final bool? result =
          await _methodChannel.invokeMethod<bool>('stopVpn');
      return result ?? false;
    } on PlatformException catch (e) {
      _statusController.add(VpnStatusEvent(
        state: VpnState.error,
        message: 'Failed to stop VpnService',
        error: e.message,
      ));
      return false;
    }
  }

  /// Checks if Android VpnService is currently executing in background.
  Future<bool> isVpnRunning() async {
    try {
      final bool? running =
          await _methodChannel.invokeMethod<bool>('isVpnRunning');
      return running ?? false;
    } catch (_) {
      return false;
    }
  }
}
