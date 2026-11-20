import { TerminalVendor } from '../types/vpn';

export type SerialParity = 'none' | 'even' | 'odd';
export type SerialDataBits = 7 | 8;
export type SerialStopBits = 1 | 2;
export type SerialLineEnding = '\r' | '\r\n' | '\n';

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400] as const;

export interface SerialOpenOptions {
  baudRate: number;
  dataBits?: SerialDataBits;
  stopBits?: SerialStopBits;
  parity?: SerialParity;
  flowControl?: 'none' | 'hardware';
}

export interface SerialPortInfoLike {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface SerialSignalsLike {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export interface SerialPortLike {
  open: (options: SerialOpenOptions) => Promise<void>;
  close: () => Promise<void>;
  getInfo?: () => SerialPortInfoLike;
  setSignals?: (signals: SerialSignalsLike) => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface NavigatorSerialLike {
  requestPort: (options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }) => Promise<SerialPortLike>;
  getPorts?: () => Promise<SerialPortLike[]>;
}

export interface SerialConnectParams {
  baudRate: number;
  dataBits?: SerialDataBits;
  parity?: SerialParity;
  stopBits?: SerialStopBits;
  lineEnding?: SerialLineEnding;
  onData: (chunk: string) => void;
  onClose?: (reason?: string) => void;
  onError?: (message: string) => void;
}

export interface SerialConnectResult {
  ok: boolean;
  id?: string;
  label?: string;
  chipName?: string;
  baudRate?: number;
  error?: string;
  isIframeBlocked?: boolean;
  isCancelled?: boolean;
  isUnsupported?: boolean;
}

interface ActiveSerialSession {
  id: string;
  port: SerialPortLike;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  keepReading: boolean;
  lineEnding: SerialLineEnding;
  baudRate: number;
  label: string;
}

/**
 * Known USB-to-Serial Console Adapter Vendor IDs (FTDI, Prolific, CH340, CP210x, Cisco, Huawei)
 */
const USB_VENDOR_NAMES: Record<number, string> = {
  0x0403: 'FTDI USB-Serial',
  0x067b: 'Prolific PL2303',
  0x1a86: 'WCH CH340/CH341',
  0x10c4: 'Silicon Labs CP210x',
  0x05a6: 'Cisco USB Console',
  0x12d1: 'Huawei USB Console',
  0x2341: 'USB CDC Serial',
  0x04b4: 'Cypress USB-UART',
};

export function getRecommendedBaudRate(vendor: TerminalVendor): number {
  if (vendor === 'MikroTik' || vendor === 'TP-Link') {
    return 115200;
  }
  return 9600;
}

export function isWebSerialSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'serial' in navigator;
}

function getNavigatorSerial(): NavigatorSerialLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as { serial?: NavigatorSerialLike };
  return nav.serial ?? null;
}

function describeUsbPort(port: SerialPortLike): { label: string; chipName: string } {
  const info = typeof port.getInfo === 'function' ? port.getInfo() : {};
  const vid = info.usbVendorId;
  const pid = info.usbProductId;
  if (vid !== undefined) {
    const chipName = USB_VENDOR_NAMES[vid] || `USB Serial (VID:0x${vid.toString(16).toUpperCase()})`;
    const pidHex = pid !== undefined ? `:0x${pid.toString(16).toUpperCase()}` : '';
    return {
      chipName,
      label: `${chipName} [0x${vid.toString(16).toUpperCase()}${pidHex}]`,
    };
  }
  return {
    chipName: 'RS-232 COM Port',
    label: 'USB / COM Console Port',
  };
}

function sanitizeSerialOutput(chunk: string): string {
  // Strip ANSI CSI/OSC escape sequences while preserving readable terminal lines
  return chunk
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

class SerialConsoleManager {
  private sessions = new Map<string, ActiveSerialSession>();
  private encoder = new TextEncoder();

  async connect(params: SerialConnectParams): Promise<SerialConnectResult> {
    const serial = getNavigatorSerial();
    if (!serial) {
      return {
        ok: false,
        isUnsupported: true,
        error:
          'Web Serial API is not supported in this browser. Use Google Chrome, Microsoft Edge, or Opera on Desktop (or the Android APK with USB-OTG Console Cable).',
      };
    }

    let port: SerialPortLike;
    try {
      port = await serial.requestPort();
    } catch (err: any) {
      const name = err?.name || '';
      const msg = String(err?.message || err || '');
      if (name === 'NotFoundError' || msg.toLowerCase().includes('no port selected')) {
        return {
          ok: false,
          isCancelled: true,
          error: 'Port selection cancelled.',
        };
      }
      if (
        name === 'SecurityError' ||
        msg.toLowerCase().includes('permissions policy') ||
        msg.toLowerCase().includes('disallowed')
      ) {
        return {
          ok: false,
          isIframeBlocked: true,
          error:
            'Browser security blocks USB/COM Serial inside an embedded preview iframe. Open this app directly in a standalone Chrome/Edge tab (or installed PWA) to connect your physical Console Cable.',
        };
      }
      return {
        ok: false,
        error: msg || 'Failed to select serial COM port.',
      };
    }

    try {
      await port.open({
        baudRate: params.baudRate,
        dataBits: params.dataBits ?? 8,
        parity: params.parity ?? 'none',
        stopBits: params.stopBits ?? 1,
        flowControl: 'none',
      });

      // Assert DTR/RTS so Cisco/Huawei/BDCOM/MikroTik console UARTs wake up cleanly
      if (typeof port.setSignals === 'function') {
        try {
          await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        } catch {
          // Some adapters do not implement setSignals; safe to ignore
        }
      }

      const id = `serial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { label, chipName } = describeUsbPort(port);

      const writer = port.writable ? port.writable.getWriter() : null;
      const reader = port.readable ? port.readable.getReader() : null;

      const session: ActiveSerialSession = {
        id,
        port,
        reader,
        writer,
        keepReading: true,
        lineEnding: params.lineEnding ?? '\r',
        baudRate: params.baudRate,
        label,
      };
      this.sessions.set(id, session);

      // Start background read loop
      if (reader) {
        void this.startReadLoop(session, params.onData, params.onClose, params.onError);
      }

      return {
        ok: true,
        id,
        label,
        chipName,
        baudRate: params.baudRate,
      };
    } catch (err: any) {
      try {
        await port.close();
      } catch {
        // Ignore cleanup close error
      }
      const msg = String(err?.message || err || 'Failed to open COM port.');
      return {
        ok: false,
        error: msg.includes('Failed to open')
          ? `${msg} (Check if PuTTY, TeraTerm, or another app is holding this COM port.)`
          : msg,
      };
    }
  }

  private async startReadLoop(
    session: ActiveSerialSession,
    onData: (chunk: string) => void,
    onClose?: (reason?: string) => void,
    onError?: (message: string) => void
  ) {
    const decoder = new TextDecoder();
    try {
      while (session.keepReading && session.reader) {
        const { value, done } = await session.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          const text = decoder.decode(value, { stream: true });
          const cleaned = sanitizeSerialOutput(text);
          if (cleaned) {
            onData(cleaned);
          }
        }
      }
    } catch (err: any) {
      if (session.keepReading) {
        onError?.(err?.message || 'Console cable disconnected unexpectedly.');
      }
    } finally {
      if (session.keepReading) {
        await this.disconnect(session.id);
        onClose?.('Console cable disconnected.');
      }
    }
  }

  async write(id: string, data: string, raw = false): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || !session.writer) return false;
    try {
      const payload = raw ? data : `${data}${session.lineEnding}`;
      await session.writer.write(this.encoder.encode(payload));
      return true;
    } catch {
      return false;
    }
  }

  async sendBreak(id: string, durationMs = 250): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session || typeof session.port.setSignals !== 'function') return false;
    try {
      await session.port.setSignals({ break: true });
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      await session.port.setSignals({ break: false });
      return true;
    } catch {
      return false;
    }
  }

  setLineEnding(id: string, lineEnding: SerialLineEnding) {
    const session = this.sessions.get(id);
    if (session) {
      session.lineEnding = lineEnding;
    }
  }

  isConnected(id?: string): boolean {
    return Boolean(id && this.sessions.has(id));
  }

  async disconnect(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    session.keepReading = false;
    this.sessions.delete(id);

    try {
      if (session.reader) {
        await session.reader.cancel().catch(() => {});
        session.reader.releaseLock();
      }
    } catch {
      // Ignore reader release error
    }

    try {
      if (session.writer) {
        session.writer.releaseLock();
      }
    } catch {
      // Ignore writer release error
    }

    try {
      await session.port.close();
    } catch {
      // Ignore port close error
    }
  }
}

export const serialConsoleManager = new SerialConsoleManager();
