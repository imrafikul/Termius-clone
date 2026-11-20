import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

/// Telnet line ending mode for cross-vendor compatibility (Cisco, Huawei, BDCOM, VSOL, MikroTik, Palo Alto).
enum TelnetLineEnding {
  auto, // Sends CR+NUL (\r\0) when SGA negotiated (Cisco/Huawei/BDCOM/VSOL/MikroTik/Palo Alto), else CRLF
  cr,   // Sends raw CR (\r)
  crlf, // Sends CR+LF (\r\n)
}

enum _ParserState {
  data,
  iac,
  will,
  wont,
  doOpt,
  dontOpt,
  sb,
  sbIac,
}

/// Full RFC 854 / RFC 1073 (NAWS) / RFC 1091 (TTYPE) Telnet Client Engine.
/// Supports Cisco IOS/NX-OS, Huawei VRP/OLT, BDCOM, VSOL, C-Data, ZTE, MikroTik, and Palo Alto CLI.
class UniversalTelnetClient {
  // RFC 854 Telnet Commands
  static const int _iac = 255;
  static const int _dont = 254;
  static const int _do = 253;
  static const int _wont = 252;
  static const int _will = 251;
  static const int _sb = 250;
  static const int _se = 240;

  // Telnet Options
  static const int _optBinary = 0;
  static const int _optEcho = 1;
  static const int _optSga = 3; // Suppress Go Ahead
  static const int _optTtype = 24; // Terminal Type
  static const int _optNaws = 31; // Negotiate About Window Size

  // Subnegotiation constants
  static const int _ttypeIs = 0;
  static const int _ttypeSend = 1;

  final String host;
  final int port;
  final String terminalType;
  final void Function(String text) onData;
  final void Function(String message)? onInfo;
  final void Function(Object error)? onError;
  final void Function()? onClose;

  Socket? _socket;
  _ParserState _state = _ParserState.data;
  final List<int> _sbBuffer = [];

  int _cols = 80;
  int _rows = 24;
  bool _nawsEnabled = false;
  bool _serverEcho = false;
  bool _serverSga = false;
  bool _isConnected = false;

  bool localEchoOverride = false;
  TelnetLineEnding lineEnding = TelnetLineEnding.auto;

  bool get isConnected => _isConnected;
  bool get serverEcho => _serverEcho;
  bool get serverSga => _serverSga;

  UniversalTelnetClient({
    required this.host,
    required this.port,
    required this.onData,
    this.terminalType = 'xterm-256color',
    this.onInfo,
    this.onError,
    this.onClose,
  });

  Future<void> connect({Duration timeout = const Duration(seconds: 12)}) async {
    _socket = await Socket.connect(host, port, timeout: timeout);
    _socket!.setOption(SocketOption.tcpNoDelay, true);
    _isConnected = true;

    // Proactively offer SGA and NAWS for faster negotiation on Cisco / Huawei / BDCOM / VSOL / MikroTik
    _sendRaw([
      _iac, _do, _optSga,
      _iac, _will, _optSga,
      _iac, _will, _optTtype,
      _iac, _will, _optNaws,
    ]);

    _socket!.listen(
      _handleIncomingBytes,
      onError: (Object err) {
        _isConnected = false;
        onError?.call(err);
      },
      onDone: () {
        _isConnected = false;
        onClose?.call();
      },
      cancelOnError: false,
    );
  }

  /// Sends user keyboard input to the Telnet server with proper IAC escaping and NVT CR handling.
  void sendString(String input) {
    if (!_isConnected || _socket == null) return;

    final bytes = utf8.encode(input);
    final out = <int>[];

    for (int i = 0; i < bytes.length; i++) {
      final b = bytes[i];

      if (b == 13) {
        // Handle Enter (\r) according to line ending mode & SGA negotiation
        switch (lineEnding) {
          case TelnetLineEnding.cr:
            out.add(13);
            break;
          case TelnetLineEnding.crlf:
            out.add(13);
            out.add(10);
            break;
          case TelnetLineEnding.auto:
            // In character mode (Cisco/Huawei/BDCOM/VSOL/MikroTik/Palo Alto), CR+NUL avoids double-enter bug
            if (_serverSga || _serverEcho) {
              out.add(13);
              out.add(0);
            } else {
              out.add(13);
              out.add(10);
            }
            break;
        }
      } else if (b == _iac) {
        // Escape literal 0xFF as IAC IAC
        out.add(_iac);
        out.add(_iac);
      } else {
        out.add(b);
      }
    }

    _sendRaw(out);

    // Local echo fallback only when explicitly enabled or device doesn't echo
    if (localEchoOverride && !_serverEcho) {
      onData(input.replaceAll('\r', '\r\n'));
    }
  }

  /// Sends raw control bytes (e.g. Ctrl+C = 0x03, Tab = 0x09, ESC sequences).
  void sendRawControl(List<int> bytes) {
    if (!_isConnected || _socket == null) return;
    _sendRaw(bytes);
  }

  /// Notifies the Telnet server of terminal window resize (RFC 1073 NAWS).
  void resize(int cols, int rows) {
    _cols = cols.clamp(20, 300);
    _rows = rows.clamp(10, 120);
    if (_isConnected && _nawsEnabled) {
      _sendNaws();
    }
  }

  void _sendNaws() {
    final payload = <int>[_iac, _sb, _optNaws];
    void addEscapedByte(int v) {
      final byte = v & 0xFF;
      payload.add(byte);
      if (byte == _iac) payload.add(_iac);
    }

    addEscapedByte((_cols >> 8) & 0xFF);
    addEscapedByte(_cols & 0xFF);
    addEscapedByte((_rows >> 8) & 0xFF);
    addEscapedByte(_rows & 0xFF);
    payload.add(_iac);
    payload.add(_se);
    _sendRaw(payload);
  }

  void _sendTerminalType() {
    final typeBytes = ascii.encode(terminalType);
    final payload = <int>[
      _iac,
      _sb,
      _optTtype,
      _ttypeIs,
      ...typeBytes,
      _iac,
      _se,
    ];
    _sendRaw(payload);
  }

  void _sendRaw(List<int> bytes) {
    try {
      _socket?.add(Uint8List.fromList(bytes));
    } catch (_) {
      // Ignore write errors if socket is closing
    }
  }

  /// Stateful RFC 854 byte stream parser that strips IAC negotiation cleanly across packet boundaries.
  void _handleIncomingBytes(Uint8List chunk) {
    final cleanBytes = <int>[];

    for (final b in chunk) {
      switch (_state) {
        case _ParserState.data:
          if (b == _iac) {
            _state = _ParserState.iac;
          } else if (b == 0) {
            // Strip NUL bytes (commonly sent after CR by Cisco/Huawei/BDCOM/VSOL)
          } else {
            cleanBytes.add(b);
          }
          break;

        case _ParserState.iac:
          switch (b) {
            case _iac:
              cleanBytes.add(_iac);
              _state = _ParserState.data;
              break;
            case _will:
              _state = _ParserState.will;
              break;
            case _wont:
              _state = _ParserState.wont;
              break;
            case _do:
              _state = _ParserState.doOpt;
              break;
            case _dont:
              _state = _ParserState.dontOpt;
              break;
            case _sb:
              _sbBuffer.clear();
              _state = _ParserState.sb;
              break;
            default:
              // NOP, GA, AYT, etc. — consume silently
              _state = _ParserState.data;
              break;
          }
          break;

        case _ParserState.will:
          _handleWill(b);
          _state = _ParserState.data;
          break;

        case _ParserState.wont:
          _handleWont(b);
          _state = _ParserState.data;
          break;

        case _ParserState.doOpt:
          _handleDo(b);
          _state = _ParserState.data;
          break;

        case _ParserState.dontOpt:
          _handleDont(b);
          _state = _ParserState.data;
          break;

        case _ParserState.sb:
          if (b == _iac) {
            _state = _ParserState.sbIac;
          } else {
            _sbBuffer.add(b);
          }
          break;

        case _ParserState.sbIac:
          if (b == _se) {
            _handleSubnegotiation(_sbBuffer);
            _sbBuffer.clear();
            _state = _ParserState.data;
          } else if (b == _iac) {
            _sbBuffer.add(_iac);
            _state = _ParserState.sb;
          } else {
            _state = _ParserState.data;
          }
          break;
      }
    }

    if (cleanBytes.isNotEmpty) {
      final decoded = utf8.decode(cleanBytes, allowMalformed: true);
      onData(decoded);
    }
  }

  void _handleWill(int option) {
    switch (option) {
      case _optEcho:
        _serverEcho = true;
        _sendRaw([_iac, _do, _optEcho]);
        break;
      case _optSga:
        _serverSga = true;
        _sendRaw([_iac, _do, _optSga]);
        break;
      case _optBinary:
        _sendRaw([_iac, _do, _optBinary]);
        break;
      default:
        _sendRaw([_iac, _dont, option]);
        break;
    }
  }

  void _handleWont(int option) {
    if (option == _optEcho) {
      _serverEcho = false;
    } else if (option == _optSga) {
      _serverSga = false;
    }
    _sendRaw([_iac, _dont, option]);
  }

  void _handleDo(int option) {
    switch (option) {
      case _optSga:
        _serverSga = true;
        _sendRaw([_iac, _will, _optSga]);
        break;
      case _optBinary:
        _sendRaw([_iac, _will, _optBinary]);
        break;
      case _optTtype:
        _sendRaw([_iac, _will, _optTtype]);
        break;
      case _optNaws:
        _nawsEnabled = true;
        _sendRaw([_iac, _will, _optNaws]);
        _sendNaws();
        break;
      case _optEcho:
        // Client must NOT echo when server asks DO ECHO (prevents double chars on BDCOM/VSOL/MikroTik)
        _sendRaw([_iac, _wont, _optEcho]);
        break;
      default:
        _sendRaw([_iac, _wont, option]);
        break;
    }
  }

  void _handleDont(int option) {
    if (option == _optNaws) {
      _nawsEnabled = false;
    }
    _sendRaw([_iac, _wont, option]);
  }

  void _handleSubnegotiation(List<int> data) {
    if (data.length >= 2 && data[0] == _optTtype && data[1] == _ttypeSend) {
      _sendTerminalType();
    }
  }

  Future<void> close() async {
    _isConnected = false;
    try {
      await _socket?.close();
      _socket?.destroy();
    } catch (_) {}
    _socket = null;
  }
}
