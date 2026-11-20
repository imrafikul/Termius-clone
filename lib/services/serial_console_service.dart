import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:usb_serial/usb_serial.dart';

/// Android USB-OTG RS-232 / RJ45 Rollover Console Cable Engine
/// Supports FTDI, Prolific PL2303, WCH CH340/CH341, Silicon Labs CP210x, Cisco & Huawei USB Console adapters.
class UsbSerialConsoleService {
  UsbPort? _port;
  StreamSubscription<Uint8List>? _inputSub;
  bool _connected = false;
  String? _deviceName;

  bool get isConnected => _connected;
  String get deviceName => _deviceName ?? 'USB-OTG Console';

  static int recommendedBaudRate(String vendor) {
    if (vendor == 'MikroTik' || vendor == 'TP-Link') {
      return 115200;
    }
    return 9600;
  }

  /// List all attached USB-OTG serial console cables.
  Future<List<UsbDevice>> listDevices() async {
    return UsbSerial.listDevices();
  }

  /// Connect to the specified USB-OTG serial device at [baudRate] (default 9600 8-N-1).
  Future<bool> connect({
    required UsbDevice device,
    int baudRate = 9600,
    required void Function(String chunk) onData,
    void Function(String reason)? onDisconnect,
  }) async {
    await disconnect();

    final port = await device.create();
    if (port == null) return false;

    final opened = await port.open();
    if (!opened) return false;

    await port.setDTR(true);
    await port.setRTS(true);
    await port.setPortParameters(
      baudRate,
      UsbPort.DATABITS_8,
      UsbPort.STOPBITS_1,
      UsbPort.PARITY_NONE,
    );

    _port = port;
    _connected = true;
    _deviceName = device.productName ?? device.manufacturerName ?? 'USB Console (${device.vid})';

    _inputSub = port.inputStream?.listen(
      (Uint8List bytes) {
        final text = utf8.decode(bytes, allowMalformed: true);
        onData(text);
      },
      onDone: () {
        _connected = false;
        onDisconnect?.('USB Console Cable unplugged.');
      },
      onError: (Object err) {
        _connected = false;
        onDisconnect?.('Serial read error: $err');
      },
    );

    // Wake console prompt with CR
    await writeRaw('\r');
    return true;
  }

  Future<void> writeCommand(String command, {String lineEnding = '\r'}) async {
    if (_port == null || !_connected) return;
    await _port!.write(Uint8List.fromList(utf8.encode('$command$lineEnding')));
  }

  Future<void> writeRaw(String raw) async {
    if (_port == null || !_connected) return;
    await _port!.write(Uint8List.fromList(utf8.encode(raw)));
  }

  Future<void> disconnect() async {
    _connected = false;
    await _inputSub?.cancel();
    _inputSub = null;
    try {
      await _port?.close();
    } catch (_) {}
    _port = null;
  }
}
