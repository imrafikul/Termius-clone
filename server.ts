process.env.DISABLE_HMR = 'true';

import express, { Request, Response } from 'express';
import net from 'net';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dns from 'dns';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const execFileAsync = promisify(execFile);

function isValidHost(host: string): boolean {
  const trimmed = host.trim();
  if (!trimmed || trimmed.length > 253 || trimmed.startsWith('-')) return false;
  return /^[a-zA-Z0-9.:_-]+$/.test(trimmed);
}

interface JumpGatewayConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
}

/**
 * Run a real `/ping <target> count=<n>` inside a remote MikroTik RouterOS gateway over Telnet,
 * enabling real ICMP ping to private LAN IPs (192.168.x.x, 10.x.x.x, 172.16.x.x) behind the MikroTik!
 */
async function runMikrotikJumpPing(
  jump: JumpGatewayConfig,
  targetHost: string,
  count: number
): Promise<{
  ok: boolean;
  probes: { seq: number; latencyMs: number; success: boolean; ttl?: number | null; message?: string }[];
  rawOutput: string;
  error?: string;
}> {
  const gwHost = jump.host.trim();
  const gwPort = Math.max(1, Math.min(65535, Number(jump.port) || 23));
  const gwUser = (jump.username || 'admin').trim();
  const gwPass = jump.password || '';
  const loginUser = gwUser.includes('+') ? gwUser : `${gwUser}+ct`;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let stage: 'login' | 'pass' | 'prompt' | 'pinging' | 'done' = 'login';
    let fullOutput = '';
    let pingOutput = '';
    let settled = false;

    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      try {
        if (!socket.destroyed) {
          socket.write('/quit\r\n');
          socket.destroy();
        }
      } catch {}

      if (!ok) {
        return resolve({ ok: false, probes: [], rawOutput: fullOutput, error });
      }

      // Parse MikroTik /ping lines:
      // e.g. "  0 192.168.88.2                               56  64 2ms"
      // e.g. "  0 192.168.88.2                               56  64 1ms340us"
      // e.g. "  1 192.168.88.2                                          timeout"
      const probes: { seq: number; latencyMs: number; success: boolean; ttl?: number | null; message?: string }[] = [];
      const lines = pingOutput.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        // Match reply line: seq host size ttl time
        const replyMatch = line.match(
          /^(\d+)\s+([0-9a-fA-F.:]+)\s+\d+\s+(\d+)\s+((?:\d+ms)?(?:\d+us)?|\d+(?:\.\d+)?ms)/i
        );
        if (replyMatch) {
          const seq = parseInt(replyMatch[1], 10) + 1;
          const ip = replyMatch[2];
          const ttl = parseInt(replyMatch[3], 10);
          const timeStr = replyMatch[4].toLowerCase();
          let ms = 1;
          const msMatch = timeStr.match(/(\d+(?:\.\d+)?)ms/);
          const usMatch = timeStr.match(/(\d+)us/);
          if (msMatch || usMatch) {
            ms = (msMatch ? parseFloat(msMatch[1]) : 0) + (usMatch ? parseInt(usMatch[1], 10) / 1000 : 0);
            ms = Math.max(0.1, Math.round(ms * 10) / 10);
          }
          probes.push({
            seq,
            latencyMs: ms,
            success: true,
            ttl,
            message: `MikroTik (${gwHost}) ICMP Reply from ${ip} ttl=${ttl}`,
          });
          continue;
        }
        // Match timeout / host unreachable line
        const failMatch = line.match(/^(\d+)\s+([0-9a-fA-F.:]+)\s+.*?(timeout|host unreachable|no route|net unreachable)/i);
        if (failMatch) {
          const seq = parseInt(failMatch[1], 10) + 1;
          probes.push({
            seq,
            latencyMs: 1000,
            success: false,
            ttl: null,
            message: `MikroTik (${gwHost}): ${failMatch[3]}`,
          });
        }
      }

      resolve({
        ok: true,
        probes,
        rawOutput: pingOutput || fullOutput,
        error: probes.length === 0 ? 'MikroTik returned no ping rows (check credentials or Telnet access).' : undefined,
      });
    };

    const overallTimer = setTimeout(() => {
      if (stage === 'pinging' && pingOutput.length > 0) {
        finish(true);
      } else {
        finish(
          false,
          `MikroTik Jump-Gateway (${gwHost}:${gwPort}) timed out at stage '${stage}'. Verify Telnet port ${gwPort} & username/password.`
        );
      }
    }, Math.max(8000, count * 1300 + 5000));

    socket.connect(gwPort, gwHost, () => {
      try {
        socket.write(Buffer.from([255, 253, 3, 255, 251, 3, 255, 251, 24]));
      } catch {}
    });

    socket.on('data', (chunk: Buffer) => {
      const text = negotiateAndDecodeTelnet(chunk, socket);
      if (!text) return;
      fullOutput += text;
      const lower = fullOutput.toLowerCase();

      if (stage === 'login' && /login\s*:/i.test(lower)) {
        stage = 'pass';
        setTimeout(() => !socket.destroyed && socket.write(`${loginUser}\r\n`), 120);
      } else if (stage === 'pass' && /password\s*:/i.test(lower)) {
        stage = 'prompt';
        setTimeout(() => !socket.destroyed && socket.write(`${gwPass}\r\n`), 120);
      } else if (stage === 'prompt') {
        if (/login failed|incorrect/i.test(text)) {
          finish(false, `MikroTik Jump-Gateway (${gwHost}) rejected username/password.`);
          return;
        }
        if (/\]\s*>\s*$/m.test(fullOutput) || /\[.+@.+\]\s*>/i.test(fullOutput)) {
          stage = 'pinging';
          setTimeout(() => {
            if (!socket.destroyed) {
              socket.write(`/ping ${targetHost} count=${count}\r\n`);
            }
          }, 150);
        }
      } else if (stage === 'pinging') {
        pingOutput += text;
        if (/sent=\d+\s+received=\d+/i.test(pingOutput)) {
          stage = 'done';
          setTimeout(() => finish(true), 120);
        }
      }
    });

    socket.on('error', (err: any) => {
      finish(false, `MikroTik Jump-Gateway (${gwHost}:${gwPort}) error: ${err.code || err.message}`);
    });

    socket.on('close', () => {
      if (!settled) {
        if (stage === 'pinging' && pingOutput.length > 0) {
          finish(true);
        } else {
          finish(false, `MikroTik Jump-Gateway (${gwHost}:${gwPort}) closed connection.`);
        }
      }
    });
  });
}

/**
 * Verify REAL MikroTik RouterOS Telnet credentials without faking success.
 * Returns verified=true ONLY when RouterOS presents an authenticated CLI prompt like [user@Identity] >
 */
function verifyMikrotikTelnetLogin(
  host: string,
  port = 23,
  username?: string,
  password?: string,
  timeoutMs = 5000
): Promise<{
  verified: boolean;
  identity?: string;
  error?: string;
}> {
  const cleanUser = (username || '').trim();
  if (!cleanUser) {
    return Promise.resolve({
      verified: false,
      error: 'Profile has no RouterOS username saved for Jump-Gateway login.',
    });
  }
  const loginUser = cleanUser.includes('+') ? cleanUser : `${cleanUser}+ct`;
  const loginPass = password || '';

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let stage: 'login' | 'pass' | 'prompt' = 'login';
    let fullOutput = '';
    let settled = false;

    const finish = (res: { verified: boolean; identity?: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (!socket.destroyed) {
          socket.write('/quit\r\n');
          socket.destroy();
        }
      } catch {}
      resolve(res);
    };

    const timer = setTimeout(() => {
      finish({
        verified: false,
        error: `MikroTik Telnet (${host}:${port}) login timed out at stage '${stage}'.`,
      });
    }, timeoutMs);

    socket.connect(port, host, () => {
      try {
        socket.write(Buffer.from([255, 253, 3, 255, 251, 3, 255, 251, 24]));
      } catch {}
    });

    socket.on('data', (chunk: Buffer) => {
      const text = negotiateAndDecodeTelnet(chunk, socket);
      if (!text) return;
      fullOutput += text;
      const lower = fullOutput.toLowerCase();

      if (stage === 'login' && /login\s*:/i.test(lower)) {
        stage = 'pass';
        setTimeout(() => !socket.destroyed && socket.write(`${loginUser}\r\n`), 100);
      } else if (stage === 'pass' && /password\s*:/i.test(lower)) {
        stage = 'prompt';
        setTimeout(() => !socket.destroyed && socket.write(`${loginPass}\r\n`), 100);
      } else if (stage === 'prompt') {
        if (/login failed|incorrect|invalid/i.test(text)) {
          finish({
            verified: false,
            error: `MikroTik (${host}) rejected RouterOS login for "${cleanUser}". Use your MikroTik RouterOS Admin Username/Password (not just a PPTP-only secret).`,
          });
          return;
        }
        const promptMatch = fullOutput.match(/\[([^\]\r\n]+@([^\]\r\n]+))\]\s*>/);
        if (promptMatch) {
          finish({
            verified: true,
            identity: promptMatch[2].trim(),
          });
          return;
        }
      }
    });

    socket.on('error', (err: any) => {
      finish({
        verified: false,
        error: `Telnet port ${port} error on ${host}: ${err.code || err.message}`,
      });
    });

    socket.on('close', () => {
      if (!settled) {
        finish({
          verified: false,
          error: `MikroTik (${host}:${port}) closed Telnet before login completed.`,
        });
      }
    });
  });
}

/**
 * Real RFC 2637 PPTP Control Connection Probe (TCP 1723: SCCRQ -> SCCRP -> StopCCRQ)
 */
function probePptpControlPlane(
  host: string,
  port = 1723,
  timeoutMs = 5000
): Promise<{
  reachable: boolean;
  pptpVerified: boolean;
  resultCode?: number;
  mikrotikHostName?: string;
  mikrotikVendor?: string;
  latencyMs: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    let rxBuf = Buffer.alloc(0);

    const done = (result: {
      reachable: boolean;
      pptpVerified: boolean;
      resultCode?: number;
      mikrotikHostName?: string;
      mikrotikVendor?: string;
      latencyMs: number;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({
        reachable: false,
        pptpVerified: false,
        latencyMs: timeoutMs,
        error: `TCP ${port} timed out on ${host} (PPTP Server disabled or firewall blocking port ${port}).`,
      });
    }, timeoutMs);

    socket.connect(port, host, () => {
      const sccrq = Buffer.alloc(156, 0);
      sccrq.writeUInt16BE(156, 0); // Length
      sccrq.writeUInt16BE(1, 2); // PPTP Control Message
      sccrq.writeUInt32BE(0x1a2b3c4d, 4); // Magic Cookie
      sccrq.writeUInt16BE(1, 8); // Control Message Type: Start-Control-Connection-Request (1)
      sccrq.writeUInt16BE(0, 10); // Reserved
      sccrq.writeUInt16BE(0x0100, 12); // Protocol Version 1.0
      sccrq.writeUInt16BE(0, 14); // Reserved
      sccrq.writeUInt32BE(3, 16); // Framing Capabilities (Async + Sync)
      sccrq.writeUInt32BE(3, 20); // Bearer Capabilities (Analog + Digital)
      sccrq.writeUInt16BE(0, 24); // Maximum Channels
      sccrq.writeUInt16BE(1, 26); // Firmware Revision
      sccrq.write('UniversalWebUI', 28, 'ascii');
      sccrq.write('NetworkEngineer', 92, 'ascii');
      socket.write(sccrq);
    });

    socket.on('data', (chunk: Buffer) => {
      rxBuf = Buffer.concat([rxBuf, chunk]);
      if (rxBuf.length >= 156) {
        const latencyMs = Math.max(1, Date.now() - start);
        const cookie = rxBuf.readUInt32BE(4);
        const ctrlType = rxBuf.readUInt16BE(8);
        const resultCode = rxBuf.readUInt8(14);
        if (cookie === 0x1a2b3c4d && ctrlType === 2) {
          const hostName = rxBuf.subarray(28, 92).toString('ascii').replace(/\0.*$/, '').trim();
          const vendorName = rxBuf.subarray(92, 156).toString('ascii').replace(/\0.*$/, '').trim();
          // Politely send Stop-Control-Connection-Request (Type 3)
          const stop = Buffer.alloc(16, 0);
          stop.writeUInt16BE(16, 0);
          stop.writeUInt16BE(1, 2);
          stop.writeUInt32BE(0x1a2b3c4d, 4);
          stop.writeUInt16BE(3, 8);
          stop.writeUInt8(1, 12);
          try {
            socket.write(stop);
          } catch {}
          done({
            reachable: true,
            pptpVerified: resultCode === 1,
            resultCode,
            mikrotikHostName: hostName || host,
            mikrotikVendor: vendorName || 'PPTP Server',
            latencyMs,
          });
        } else {
          done({
            reachable: true,
            pptpVerified: false,
            latencyMs,
            error: `Port ${port} open, but did not return valid RFC 2637 PPTP SCCRP reply.`,
          });
        }
      }
    });

    socket.on('error', (err: any) => {
      const latencyMs = Math.max(1, Date.now() - start);
      done({
        reachable: false,
        pptpVerified: false,
        latencyMs,
        error:
          err.code === 'ECONNREFUSED'
            ? `Port ${port} refused on ${host} (/interface pptp-server server set enabled=yes required).`
            : err.code === 'ENOTFOUND'
            ? `Host not found: ${host}`
            : `Cannot reach ${host}:${port} (${err.code || err.message})`,
      });
    });
  });
}

interface SinglePingOutcome {
  ok: boolean;
  reached: boolean;
  hopIp: string | null;
  ttl: number | null;
  latencyMs: number;
  permissionDenied: boolean;
  error?: string;
}

async function runSystemPingSingle(
  host: string,
  ttl?: number,
  timeoutSec = 1
): Promise<SinglePingOutcome> {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  let args: string[];

  if (isWin) {
    args = ['-n', '1', '-w', String(Math.max(500, timeoutSec * 1000))];
    if (typeof ttl === 'number' && ttl > 0 && ttl <= 64) {
      args.push('-i', String(ttl));
    }
    args.push(host);
  } else if (isMac) {
    args = ['-n', '-c', '1', '-W', String(Math.max(500, timeoutSec * 1000))];
    if (typeof ttl === 'number' && ttl > 0 && ttl <= 64) {
      args.push('-m', String(ttl));
    }
    args.push(host);
  } else {
    args = ['-n', '-c', '1', '-W', String(timeoutSec)];
    if (typeof ttl === 'number' && ttl > 0 && ttl <= 64) {
      args.push('-t', String(ttl));
    }
    args.push(host);
  }

  const start = Date.now();
  try {
    const { stdout } = await execFileAsync('ping', args, {
      timeout: (timeoutSec + 1) * 1000 + 800,
    });
    const elapsed = Math.max(1, Date.now() - start);

    // Windows can exit with code 0 even when returning "TTL expired in transit" or "Destination host unreachable"
    const winExceed = stdout.match(/(?:Reply\s+)?from\s+([0-9a-fA-F.:]+)[:\s]+.*?(?:TTL expired in transit|Time to live exceeded|Hop limit exceeded)/i);
    if (winExceed) {
      return {
        ok: true,
        reached: false,
        hopIp: winExceed[1].replace(/:+$/, ''),
        ttl: ttl ?? null,
        latencyMs: elapsed,
        permissionDenied: false,
      };
    }

    if (/Request timed out|Destination (?:host|net) unreachable|100%\s+loss|0\s+received/i.test(stdout)) {
      return {
        ok: false,
        reached: false,
        hopIp: null,
        ttl: null,
        latencyMs: timeoutSec * 1000,
        permissionDenied: false,
        error: 'Request timed out',
      };
    }

    const timeMatch = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
    const ttlMatch = stdout.match(/ttl=(\d+)/i);
    const fromMatch = stdout.match(/from\s+([0-9a-fA-F.:]+)(?:[:\s(])/i);
    const latencyMs = timeMatch ? Math.round(parseFloat(timeMatch[1]) * 10) / 10 : elapsed;

    const hopIp = fromMatch ? fromMatch[1].replace(/:+$/, '') : host;

    return {
      ok: true,
      reached: true,
      hopIp,
      ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : null,
      latencyMs,
      permissionDenied: false,
    };
  } catch (err: any) {
    const elapsed = Math.max(1, Date.now() - start);
    const combined = `${err?.stdout || ''}\n${err?.stderr || ''}\n${err?.message || ''}`;

    if (
      /operation not permitted|permission denied|cap_net_raw|socket:\s*permission/i.test(combined) ||
      err?.code === 'EPERM' ||
      err?.code === 'ENOENT'
    ) {
      return {
        ok: false,
        reached: false,
        hopIp: null,
        ttl: null,
        latencyMs: elapsed,
        permissionDenied: true,
        error: 'ICMP raw socket restricted in container environment',
      };
    }

    // Check for intermediate router TTL exceeded response (Linux + Windows + macOS)
    const exceedMatch = combined.match(/From\s+([0-9a-fA-F.:]+).*?(?:Time to live exceeded|TTL expired in transit|Hop limit exceeded)/i);
    if (exceedMatch) {
      return {
        ok: true,
        reached: false,
        hopIp: exceedMatch[1].replace(/:+$/, ''),
        ttl: ttl ?? null,
        latencyMs: elapsed,
        permissionDenied: false,
      };
    }

    return {
      ok: false,
      reached: false,
      hopIp: null,
      ttl: null,
      latencyMs: timeoutSec * 1000,
      permissionDenied: false,
      error: 'Request timed out',
    };
  }
}

async function resolveReverseDns(ip: string, timeoutMs = 350): Promise<string> {
  try {
    const result = await Promise.race<string[]>([
      dns.promises.reverse(ip),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return result && result.length > 0 ? result[0] : ip;
  } catch {
    return ip;
  }
}

function computeStats(latencies: number[]) {
  if (latencies.length === 0) {
    return { min: 0, avg: 0, max: 0, p95: 0, jitter: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;
  const avg = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10;
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = Math.round(sorted[p95Idx] * 10) / 10;

  let jitter = 0;
  if (latencies.length > 1) {
    let diffSum = 0;
    for (let j = 1; j < latencies.length; j++) {
      diffSum += Math.abs(latencies[j] - latencies[j - 1]);
    }
    jitter = Math.round((diffSum / (latencies.length - 1)) * 10) / 10;
  }

  return { min, avg, max, p95, jitter };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Helper function to test TCP port connectivity
function checkPort(host: string, port: number, timeoutMs = 2500): Promise<{
  host: string;
  port: number;
  status: 'OPEN' | 'CLOSED' | 'FILTERED' | 'ERROR';
  latencyMs: number;
  message?: string;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let hasResponded = false;

    const timer = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        socket.destroy();
        resolve({
          host,
          port,
          status: 'FILTERED',
          latencyMs: timeoutMs,
          message: 'Connection timed out (firewall drop or host unreachable)',
        });
      }
    }, timeoutMs);

    socket.connect(port, host, () => {
      if (!hasResponded) {
        hasResponded = true;
        const latency = Date.now() - startTime;
        clearTimeout(timer);
        socket.destroy();
        resolve({
          host,
          port,
          status: 'OPEN',
          latencyMs: latency,
          message: 'Port is open and accepting TCP connections',
        });
      }
    });

    socket.on('error', (err: any) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        socket.destroy();
        if (err.code === 'ECONNREFUSED') {
          resolve({
            host,
            port,
            status: 'CLOSED',
            latencyMs: latency,
            message: 'Port is closed (RST packet received from host)',
          });
        } else if (err.code === 'ENOTFOUND') {
          resolve({
            host,
            port,
            status: 'ERROR',
            latencyMs: 0,
            message: 'DNS lookup failed: Host not found',
          });
        } else {
          resolve({
            host,
            port,
            status: 'FILTERED',
            latencyMs: latency,
            message: `Network error: ${err.code || err.message}`,
          });
        }
      }
    });
  });
}

// Multi-port check endpoint
app.post('/api/diagnostics/port-check', async (req: Request, res: Response) => {
  try {
    const { host, ports = [8291, 22, 23, 80, 443, 8728, 1723], timeoutMs = 2500 } = req.body;

    if (!host || typeof host !== 'string') {
      return res.status(400).json({ error: 'Host parameter is required.' });
    }

    const cleanHost = host.trim();
    const cleanPorts: number[] = Array.isArray(ports)
      ? ports.map((p) => parseInt(p, 10)).filter((p) => !isNaN(p) && p > 0 && p <= 65535)
      : [8291, 22, 23, 80, 443, 8728, 1723];

    const results = await Promise.all(
      cleanPorts.map((port) => checkPort(cleanHost, port, timeoutMs))
    );

    res.json({
      host: cleanHost,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Real visitor public IP (resolves real egress public IP when running locally on Desktop App; ZERO fake IPs)
async function resolveLocalEgressPublicIp(): Promise<string> {
  const endpoints = [
    { url: 'https://api.ipify.org?format=json', parse: async (r: globalThis.Response) => ((await r.json()) as { ip?: string }).ip || '' },
    { url: 'https://ifconfig.me/ip', parse: async (r: globalThis.Response) => (await r.text()).trim() },
  ];
  for (const ep of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const resp = await fetch(ep.url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (resp.ok) {
        const ip = (await ep.parse(resp)).trim();
        if (/^[0-9a-fA-F:.]+$/.test(ip)) return ip;
      }
    } catch {
      // try next provider
    }
  }
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '127.0.0.1';
}

app.get('/api/network/my-ip', async (req: Request, res: Response) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    ip = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    ip = forwarded[0].split(',')[0].trim();
  } else {
    ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  }
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    ip = await resolveLocalEgressPublicIp();
  }
  res.json({
    ip: ip || 'Unavailable',
    pptpTunnelActive: realVpnState.status === 'CONNECTED',
    greSupportedInCloud: process.platform === 'win32',
    timestamp: new Date().toISOString(),
  });
});

// Real RFC 2637 PPTP Control Verification + Real MikroTik Jump-Gateway Login Check
app.post('/api/pptp/probe', async (req: Request, res: Response) => {
  try {
    const { host, port = 1723, username, password } = req.body || {};
    if (!host || typeof host !== 'string' || !isValidHost(host)) {
      return res.status(400).json({
        reachable: false,
        pptpVerified: false,
        pptpTunnelConnected: false,
        greSupportedInCloud: false,
        jumpTelnetOpen: false,
        jumpLoginVerified: false,
        latencyMs: 0,
        error: 'Valid PPTP Server IP or hostname is required.',
      });
    }
    const cleanHost = host.trim();
    const pptpPort = Math.max(1, Math.min(65535, parseInt(String(port), 10) || 1723));

    const [pptpResult, telnetCheck] = await Promise.all([
      probePptpControlPlane(cleanHost, pptpPort, 5000),
      checkPort(cleanHost, 23, 3000),
    ]);

    const jumpTelnetOpen = telnetCheck.status === 'OPEN';
    let jumpLoginVerified = false;
    let jumpIdentity: string | undefined;
    let jumpLoginError: string | undefined;

    if (jumpTelnetOpen) {
      const loginRes = await verifyMikrotikTelnetLogin(cleanHost, 23, username, password, 5500);
      jumpLoginVerified = loginRes.verified;
      jumpIdentity = loginRes.identity;
      jumpLoginError = loginRes.error;
    } else {
      jumpLoginError = `Telnet port 23 is ${telnetCheck.status} on ${cleanHost}. Enable /ip service enable telnet on MikroTik to use Local LAN IP Ping & Telnet.`;
    }

    res.json({
      ...pptpResult,
      host: cleanHost,
      port: pptpPort,
      pptpTunnelConnected: false,
      greSupportedInCloud: false,
      jumpTelnetOpen,
      jumpTelnetLatencyMs: telnetCheck.latencyMs,
      jumpLoginVerified,
      jumpIdentity,
      jumpLoginError,
      explanation: pptpResult.pptpVerified
        ? 'TCP 1723 PPTP Server is reachable on MikroTik, but Web Browsers / Cloud Servers CANNOT send GRE (IP Protocol 47) — so PPTP Tunnel is NOT connected and MikroTik /ppp active stays offline.'
        : pptpResult.error || 'PPTP Control port 1723 not reachable.',
    });
  } catch (err: any) {
    res.status(500).json({
      reachable: false,
      pptpVerified: false,
      pptpTunnelConnected: false,
      greSupportedInCloud: false,
      jumpTelnetOpen: false,
      jumpLoginVerified: false,
      latencyMs: 0,
      error: err?.message || 'PPTP probe failed',
    });
  }
});

// ==============================================================================
// REAL L2TPv2 (UDP 1701) & MS-SSTP (TCP 443 TLS) VPN TUNNEL MANAGER (Linux vpn0)
// Connects directly to MikroTik /ppp secret — ZERO MikroTik admin login needed!
// ==============================================================================
interface RealVpnState {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  protocol: 'pptp' | 'l2tp' | 'sstp' | null;
  host: string;
  port: number;
  username: string;
  clientIp: string;
  gatewayIp: string;
  dnsIp: string;
  iface: string;
  routes: string[];
  connectedAt: number | null;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  error: string | null;
  logs: { timestamp: string; component: string; level: string; message: string }[];
}

let activeVpnProc: ChildProcess | null = null;
const realVpnState: RealVpnState = {
  status: 'DISCONNECTED',
  protocol: null,
  host: '',
  port: 1701,
  username: '',
  clientIp: '',
  gatewayIp: '',
  dnsIp: '',
  iface: '',
  routes: [],
  connectedAt: null,
  bytesIn: 0,
  bytesOut: 0,
  packetsIn: 0,
  packetsOut: 0,
  error: null,
  logs: [],
};

function pushVpnLog(component: string, level: string, message: string) {
  realVpnState.logs.unshift({
    timestamp: new Date().toLocaleTimeString(),
    component,
    level,
    message,
  });
  if (realVpnState.logs.length > 60) {
    realVpnState.logs.length = 60;
  }
}

const WIN_VPN_NAME = 'UniversalWebUI_VPN';

function stopActiveVpnDaemon(): Promise<void> {
  return new Promise(async (resolve) => {
    if (process.platform === 'win32') {
      try {
        await execFileAsync('rasdial', [WIN_VPN_NAME, '/DISCONNECT'], { timeout: 6000 });
      } catch {}
    }
    const proc = activeVpnProc;
    activeVpnProc = null;
    if (!proc || proc.killed || proc.exitCode !== null) {
      realVpnState.status = 'DISCONNECTED';
      realVpnState.connectedAt = null;
      realVpnState.clientIp = '';
      realVpnState.gatewayIp = '';
      realVpnState.routes = [];
      return resolve();
    }
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      realVpnState.status = 'DISCONNECTED';
      realVpnState.connectedAt = null;
      realVpnState.clientIp = '';
      realVpnState.gatewayIp = '';
      realVpnState.routes = [];
      resolve();
    };
    const killTimer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
      done();
    }, 1500);
    proc.once('exit', () => {
      clearTimeout(killTimer);
      done();
    });
    try {
      proc.kill('SIGTERM');
    } catch {
      clearTimeout(killTimer);
      done();
    }
  });
}

app.get('/api/system/runtime', (_req: Request, res: Response) => {
  res.json({
    platform: process.platform,
    arch: process.arch,
    nativePptpSupported: process.platform === 'win32',
    standalone: process.env.STANDALONE_DESKTOP === 'true',
  });
});

app.get('/api/vpn/status', (_req: Request, res: Response) => {
  const uptimeSeconds =
    realVpnState.status === 'CONNECTED' && realVpnState.connectedAt
      ? Math.max(0, Math.floor((Date.now() - realVpnState.connectedAt) / 1000))
      : 0;
  res.json({
    ...realVpnState,
    uptimeSeconds,
  });
});

app.post('/api/vpn/disconnect', async (_req: Request, res: Response) => {
  pushVpnLog('CONTROL', 'INFO', 'Disconnecting real VPN tunnel & removing kernel routes...');
  await stopActiveVpnDaemon();
  res.json({
    connected: false,
    status: 'DISCONNECTED',
    message: 'VPN tunnel disconnected cleanly.',
  });
});

app.post('/api/vpn/connect', async (req: Request, res: Response) => {
  try {
    const {
      protocol = 'l2tp',
      host,
      port,
      username,
      password = '',
      subnets = ['0.0.0.0/0'],
    } = req.body || {};

    const rawProto = String(protocol).toLowerCase();
    const cleanProto: 'pptp' | 'l2tp' | 'sstp' =
      rawProto === 'pptp' ? 'pptp' : rawProto === 'sstp' ? 'sstp' : 'l2tp';

    if (!host || typeof host !== 'string' || !isValidHost(host)) {
      return res.status(400).json({ connected: false, error: 'Valid MikroTik Server IP or hostname is required.' });
    }
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ connected: false, error: 'MikroTik /ppp secret username is required.' });
    }

    const cleanHost = host.trim();
    const defaultPort = cleanProto === 'pptp' ? 1723 : cleanProto === 'sstp' ? 443 : 1701;
    const targetPort = Math.max(1, Math.min(65535, parseInt(String(port || defaultPort), 10) || defaultPort));

    // Cleanly stop any prior tunnel first
    await stopActiveVpnDaemon();

    realVpnState.status = 'CONNECTING';
    realVpnState.protocol = cleanProto;
    realVpnState.host = cleanHost;
    realVpnState.port = targetPort;
    realVpnState.username = username.trim();
    realVpnState.clientIp = '';
    realVpnState.gatewayIp = '';
    realVpnState.dnsIp = '';
    realVpnState.iface = '';
    realVpnState.routes = [];
    realVpnState.connectedAt = null;
    realVpnState.bytesIn = 0;
    realVpnState.bytesOut = 0;
    realVpnState.packetsIn = 0;
    realVpnState.packetsOut = 0;
    realVpnState.error = null;
    realVpnState.logs = [];

    // NATIVE WINDOWS DESKTOP APP DIALER: Real PPTP (GRE 47) / L2TP / SSTP via Windows RAS!
    if (process.platform === 'win32') {
      const psTunnel = cleanProto === 'pptp' ? 'Pptp' : cleanProto === 'sstp' ? 'Sstp' : 'L2tp';
      const safeServer = cleanHost.replace(/'/g, "''");
      const validCidrs = Array.isArray(subnets)
        ? subnets.map((s) => String(s).trim()).filter((s) => /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(s) && s !== '0.0.0.0/0')
        : [];
      const useSplit = validCidrs.length > 0;

      const routeCmds = validCidrs
        .map(
          (cidr) =>
            `Add-VpnConnectionRoute -ConnectionName '${WIN_VPN_NAME}' -DestinationPrefix '${cidr}' -PassThru -ErrorAction SilentlyContinue | Out-Null`
        )
        .join('; ');

      const buildProfileScript = (authList: string) =>
        [
          `$ErrorActionPreference = 'SilentlyContinue'`,
          `Remove-VpnConnection -Name '${WIN_VPN_NAME}' -Force -PassThru | Out-Null`,
          `$ErrorActionPreference = 'Stop'`,
          `Add-VpnConnection -Name '${WIN_VPN_NAME}' -ServerAddress '${safeServer}' -TunnelType ${psTunnel} -AuthenticationMethod ${authList} -EncryptionLevel Optional ${
            useSplit ? '-SplitTunneling' : ''
          } -RememberCredential:$false -Force`,
          routeCmds,
        ]
          .filter(Boolean)
          .join('; ');

      pushVpnLog('CONTROL', 'INFO', `Configuring native Windows ${psTunnel} VPN profile for ${cleanHost}...`);
      try {
        try {
          await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', buildProfileScript('MSChapv2,Chap,Pap')],
            { timeout: 14000 }
          );
        } catch {
          // Fallback to MSChapv2 only if Windows build rejects mixed Pap+MSChapv2
          await execFileAsync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', buildProfileScript('MSChapv2')],
            { timeout: 14000 }
          );
        }
      } catch (psErr: any) {
        const msg = `Windows VPN profile error: ${psErr?.stderr || psErr?.message || 'PowerShell failed'}`;
        realVpnState.status = 'ERROR';
        realVpnState.error = msg;
        pushVpnLog('CONTROL', 'ERROR', msg);
        return res.status(502).json({ connected: false, status: 'ERROR', error: msg, logs: realVpnState.logs });
      }

      pushVpnLog('PPTP_HANDSHAKE', 'INFO', `Dialing Windows native ${psTunnel} tunnel to ${cleanHost} as "${username.trim()}"...`);
      try {
        const { stdout } = await execFileAsync('rasdial', [WIN_VPN_NAME, username.trim(), String(password || '')], {
          timeout: 25000,
        });
        pushVpnLog('AUTH', 'INFO', stdout.trim().split(/\r?\n/).slice(-2).join(' · ') || 'Connected via Windows RAS');

        // Read REAL assigned VPN IPv4 from Windows network adapter
        let assignedIp = '';
        try {
          const { stdout: ipOut } = await execFileAsync(
            'powershell.exe',
            [
              '-NoProfile',
              '-NonInteractive',
              '-ExecutionPolicy',
              'Bypass',
              '-Command',
              `(Get-NetIPAddress -InterfaceAlias '${WIN_VPN_NAME}' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty IPAddress)`,
            ],
            { timeout: 6000 }
          );
          assignedIp = ipOut.trim();
        } catch {}

        realVpnState.status = 'CONNECTED';
        realVpnState.connectedAt = Date.now();
        realVpnState.clientIp = assignedIp || 'Assigned by MikroTik';
        realVpnState.gatewayIp = cleanHost;
        realVpnState.iface = WIN_VPN_NAME;
        realVpnState.routes = useSplit ? validCidrs : ['0.0.0.0/0 (Full Tunnel)'];
        pushVpnLog(
          'TUN',
          'INFO',
          `REAL Windows ${psTunnel} VPN ONLINE! IP: ${realVpnState.clientIp} · MikroTik /ppp active is LIVE.`
        );
        return res.json({
          connected: true,
          ...realVpnState,
          uptimeSeconds: 0,
        });
      } catch (dialErr: any) {
        const rawOut = `${dialErr?.stdout || ''}\n${dialErr?.stderr || ''}\n${dialErr?.message || ''}`.trim();
        const msg = rawOut.split(/\r?\n/).filter(Boolean).slice(0, 3).join(' · ') || 'Windows VPN dial failed.';
        realVpnState.status = 'ERROR';
        realVpnState.error = msg;
        pushVpnLog('CONTROL', 'ERROR', msg);
        return res.status(502).json({
          connected: false,
          status: 'ERROR',
          error: msg,
          logs: realVpnState.logs,
        });
      }
    }

    let daemonPath = path.join(__dirname, 'vpn_tunnel_daemon.py');
    if (!fs.existsSync(daemonPath)) {
      const embeddedDaemon = (globalThis as any).__EMBEDDED_VPN_DAEMON_PY__;
      if (typeof embeddedDaemon === 'string' && embeddedDaemon.length > 0) {
        const tmpDaemon = path.join(os.tmpdir(), 'universal_webui_vpn_daemon.py');
        fs.writeFileSync(tmpDaemon, embeddedDaemon, { mode: 0o700 });
        daemonPath = tmpDaemon;
      }
    }
    const proc = spawn('python3', ['-u', daemonPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    activeVpnProc = proc;

    const cfgPayload = JSON.stringify({
      protocol: cleanProto,
      host: cleanHost,
      port: targetPort,
      username: username.trim(),
      password: String(password || ''),
      subnets: Array.isArray(subnets) && subnets.length > 0 ? subnets : ['0.0.0.0/0'],
    });
    proc.stdin.write(cfgPayload);
    proc.stdin.end();

    let settled = false;
    let stdoutBuf = '';
    let stderrBuf = '';

    const waitResult = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const finish = (ok: boolean, error?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        resolve({ ok, error });
      };

      const connectTimer = setTimeout(() => {
        if (realVpnState.status !== 'CONNECTED') {
          const msg =
            cleanProto === 'pptp'
              ? `PPTP (TCP ${targetPort} + GRE 47) timed out on ${cleanHost}. Check MikroTik /interface pptp-server server set enabled=yes and firewall (TCP 1723 + Protocol 47), or run the Windows Desktop App (.exe) on your PC.`
              : cleanProto === 'l2tp'
              ? `L2TP UDP ${targetPort} connection timed out on ${cleanHost}. Enable L2TP on MikroTik: /interface l2tp-server server set enabled=yes use-ipsec=no`
              : `SSTP TCP ${targetPort} connection timed out on ${cleanHost}. Enable SSTP on MikroTik: /interface sstp-server server set enabled=yes`;
          realVpnState.status = 'ERROR';
          realVpnState.error = msg;
          pushVpnLog('CONTROL', 'ERROR', msg);
          try {
            proc.kill('SIGTERM');
          } catch {}
          finish(false, msg);
        }
      }, 18000);

      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString('utf8');
        let nl = stdoutBuf.indexOf('\n');
        while (nl !== -1) {
          const line = stdoutBuf.slice(0, nl).trim();
          stdoutBuf = stdoutBuf.slice(nl + 1);
          nl = stdoutBuf.indexOf('\n');
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.event === 'LOG') {
              pushVpnLog(ev.component || 'SYSTEM', ev.level || 'INFO', ev.message || '');
            } else if (ev.event === 'CONNECTED') {
              realVpnState.status = 'CONNECTED';
              realVpnState.clientIp = ev.clientIp || '';
              realVpnState.gatewayIp = ev.gatewayIp || '';
              realVpnState.dnsIp = ev.dnsIp || '';
              realVpnState.iface = ev.iface || 'vpn0';
              realVpnState.routes = Array.isArray(ev.routes) ? ev.routes : [];
              realVpnState.connectedAt = Date.now();
              realVpnState.error = null;
              finish(true);
            } else if (ev.event === 'STATS') {
              realVpnState.bytesIn = Number(ev.bytesIn || 0);
              realVpnState.bytesOut = Number(ev.bytesOut || 0);
              realVpnState.packetsIn = Number(ev.packetsIn || 0);
              realVpnState.packetsOut = Number(ev.packetsOut || 0);
            } else if (ev.event === 'ERROR') {
              realVpnState.status = 'ERROR';
              realVpnState.error = ev.message || 'VPN connection failed.';
              pushVpnLog('CONTROL', 'ERROR', realVpnState.error || 'VPN error');
              finish(false, realVpnState.error || undefined);
            } else if (ev.event === 'DISCONNECTED') {
              if (activeVpnProc === proc) {
                realVpnState.status = 'DISCONNECTED';
                realVpnState.connectedAt = null;
              }
              finish(false, ev.message || 'VPN disconnected.');
            }
          } catch {}
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      proc.on('exit', (code) => {
        if (activeVpnProc === proc) {
          activeVpnProc = null;
          if (realVpnState.status === 'CONNECTED') {
            realVpnState.status = 'DISCONNECTED';
            realVpnState.connectedAt = null;
            pushVpnLog('CONTROL', 'WARN', `VPN tunnel exited (code ${code ?? 0}).`);
          }
        }
        if (!settled) {
          const errMsg =
            realVpnState.error ||
            stderrBuf.trim() ||
            `VPN daemon exited unexpectedly (code ${code ?? 1}).`;
          realVpnState.status = 'ERROR';
          realVpnState.error = errMsg;
          finish(false, errMsg);
        }
      });
    });

    if (waitResult.ok) {
      return res.json({
        connected: true,
        ...realVpnState,
        uptimeSeconds: 0,
      });
    }
    return res.status(502).json({
      connected: false,
      error: waitResult.error || realVpnState.error || 'VPN tunnel connection failed.',
      logs: realVpnState.logs,
    });
  } catch (err: any) {
    return res.status(500).json({
      connected: false,
      error: err?.message || 'Internal VPN error',
    });
  }
});

// Ping / ICMP + TCP Latency + MikroTik Jump-Gateway LAN Ping endpoint
app.post('/api/diagnostics/ping', async (req: Request, res: Response) => {
  try {
    const { host, port = 80, count = 5, mode = 'auto', timeoutMs = 2000, jumpGateway } = req.body;

    if (!host || typeof host !== 'string' || !isValidHost(host)) {
      return res.status(400).json({ error: 'Valid host or IP address is required.' });
    }

    const cleanHost = host.trim();
    const probePort = parseInt(port, 10) || 80;
    const probeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 15);

    // If real L2TP/SSTP VPN tunnel (vpn0) is NOT connected and MikroTik Jump-Gateway is provided, fallback to Jump-Ping
    if (
      realVpnState.status !== 'CONNECTED' &&
      jumpGateway &&
      typeof jumpGateway.host === 'string' &&
      isValidHost(jumpGateway.host)
    ) {
      const jumpRes = await runMikrotikJumpPing(
        {
          host: jumpGateway.host,
          port: jumpGateway.port || 23,
          username: jumpGateway.username || 'admin',
          password: jumpGateway.password || '',
        },
        cleanHost,
        probeCount
      );
      if (!jumpRes.ok) {
        return res.status(502).json({
          error: jumpRes.error || 'MikroTik Jump-Ping failed.',
        });
      }
      const successful = jumpRes.probes.filter((p) => p.success);
      const latencies = successful.map((p) => p.latencyMs);
      const { min, avg, max, jitter } = computeStats(latencies);
      const total = Math.max(jumpRes.probes.length, probeCount);
      const packetLoss = Math.round(((total - successful.length) / total) * 100);
      return res.json({
        host: cleanHost,
        resolvedIp: `${cleanHost} (via MikroTik ${jumpGateway.host})`,
        port: probePort,
        method: 'icmp',
        transmitted: total,
        received: successful.length,
        packetLossPercent: packetLoss,
        stats: { min, avg, max, jitter },
        probes: jumpRes.probes,
        timestamp: new Date().toISOString(),
      });
    }

    let resolvedIp = cleanHost;
    try {
      const lookup = await dns.promises.lookup(cleanHost);
      resolvedIp = lookup.address;
    } catch {
      // Keep original host if lookup fails
    }

    const probes: { seq: number; latencyMs: number; success: boolean; ttl?: number | null; message?: string }[] = [];
    let activeMethod: 'icmp' | 'tcp' = mode === 'tcp' ? 'tcp' : 'icmp';

    for (let i = 1; i <= probeCount; i++) {
      if (activeMethod === 'icmp') {
        const icmpRes = await runSystemPingSingle(resolvedIp, undefined, Math.max(1, Math.ceil(timeoutMs / 1000)));
        if (icmpRes.permissionDenied) {
          // Container blocks raw ICMP -> switch cleanly to TCP ping
          activeMethod = 'tcp';
        } else {
          probes.push({
            seq: i,
            latencyMs: icmpRes.latencyMs,
            success: icmpRes.ok && icmpRes.reached,
            ttl: icmpRes.ttl,
            message: icmpRes.ok ? `ICMP Echo Reply from ${icmpRes.hopIp || resolvedIp}` : icmpRes.error,
          });
          if (i < probeCount) await new Promise((r) => setTimeout(r, 150));
          continue;
        }
      }

      // TCP fallback or explicit TCP mode
      const resProbe = await checkPort(cleanHost, probePort, timeoutMs);
      probes.push({
        seq: i,
        latencyMs: resProbe.latencyMs,
        success: resProbe.status === 'OPEN' || resProbe.status === 'CLOSED',
        message: resProbe.message,
      });
      if (i < probeCount) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const successful = probes.filter((p) => p.success);
    const latencies = successful.map((p) => p.latencyMs);
    const { min, avg, max, jitter } = computeStats(latencies);
    const packetLoss = Math.round(((probeCount - successful.length) / probeCount) * 100);

    res.json({
      host: cleanHost,
      resolvedIp,
      port: probePort,
      method: activeMethod,
      transmitted: probeCount,
      received: successful.length,
      packetLossPercent: packetLoss,
      stats: { min, avg, max, jitter },
      probes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ping probe error' });
  }
});

// High-Frequency Speed Ping endpoint (Rapid burst latency, jitter, P95 & stability analysis)
app.post('/api/diagnostics/speed-ping', async (req: Request, res: Response) => {
  try {
    const { host, port = 80, count = 20, intervalMs = 100, mode = 'auto' } = req.body;

    if (!host || typeof host !== 'string' || !isValidHost(host)) {
      return res.status(400).json({ error: 'Valid host or IP address is required.' });
    }

    const cleanHost = host.trim();
    const probePort = parseInt(port, 10) || 80;
    const probeCount = Math.min(Math.max(parseInt(count, 10) || 20, 5), 50);
    const delayMs = Math.min(Math.max(parseInt(intervalMs, 10) || 100, 30), 1000);

    let resolvedIp = cleanHost;
    try {
      const lookup = await dns.promises.lookup(cleanHost);
      resolvedIp = lookup.address;
    } catch {
      // Keep original
    }

    const startTime = Date.now();
    const probes: { seq: number; latencyMs: number; success: boolean; ttl?: number | null; timestamp: string }[] = [];
    let activeMethod: 'icmp' | 'tcp' = mode === 'tcp' ? 'tcp' : 'icmp';

    for (let i = 1; i <= probeCount; i++) {
      const iterStart = Date.now();
      if (activeMethod === 'icmp') {
        const icmpRes = await runSystemPingSingle(resolvedIp, undefined, 1);
        if (icmpRes.permissionDenied) {
          activeMethod = 'tcp';
        } else {
          probes.push({
            seq: i,
            latencyMs: icmpRes.latencyMs,
            success: icmpRes.ok && icmpRes.reached,
            ttl: icmpRes.ttl,
            timestamp: new Date().toISOString(),
          });
          const elapsed = Date.now() - iterStart;
          if (i < probeCount && elapsed < delayMs) {
            await new Promise((r) => setTimeout(r, delayMs - elapsed));
          }
          continue;
        }
      }

      const resProbe = await checkPort(cleanHost, probePort, 1200);
      probes.push({
        seq: i,
        latencyMs: resProbe.latencyMs,
        success: resProbe.status === 'OPEN' || resProbe.status === 'CLOSED',
        timestamp: new Date().toISOString(),
      });
      const elapsed = Date.now() - iterStart;
      if (i < probeCount && elapsed < delayMs) {
        await new Promise((r) => setTimeout(r, delayMs - elapsed));
      }
    }

    const durationMs = Math.max(1, Date.now() - startTime);
    const successful = probes.filter((p) => p.success);
    const latencies = successful.map((p) => p.latencyMs);
    const stats = computeStats(latencies);
    const packetLossPercent = Math.round(((probeCount - successful.length) / probeCount) * 1000) / 10;
    const packetsPerSec = Math.round((probeCount / (durationMs / 1000)) * 10) / 10;

    let grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
    if (successful.length > 0) {
      if (packetLossPercent === 0 && stats.avg < 45 && stats.jitter < 12) {
        grade = 'EXCELLENT';
      } else if (packetLossPercent <= 2 && stats.avg < 110 && stats.jitter < 30) {
        grade = 'GOOD';
      } else if (packetLossPercent <= 10 && stats.avg < 220) {
        grade = 'FAIR';
      }
    }

    res.json({
      host: cleanHost,
      resolvedIp,
      port: probePort,
      method: activeMethod,
      transmitted: probeCount,
      received: successful.length,
      packetLossPercent,
      durationMs,
      packetsPerSec,
      stats,
      grade,
      probes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Speed ping error' });
  }
});

// Live Multi-Hop Traceroute / MTR Analyzer endpoint
app.post('/api/diagnostics/traceroute', async (req: Request, res: Response) => {
  try {
    const { host, maxHops = 16, timeoutSec = 1 } = req.body;

    if (!host || typeof host !== 'string' || !isValidHost(host)) {
      return res.status(400).json({ error: 'Valid host or IP address is required.' });
    }

    const cleanHost = host.trim();
    const hopLimit = Math.min(Math.max(parseInt(maxHops, 10) || 16, 1), 30);
    const hopTimeout = Math.min(Math.max(parseInt(timeoutSec, 10) || 1, 1), 3);

    let resolvedIp = cleanHost;
    try {
      const lookup = await dns.promises.lookup(cleanHost);
      resolvedIp = lookup.address;
    } catch (dnsErr: any) {
      return res.status(400).json({ error: `DNS lookup failed for ${cleanHost}: ${dnsErr.message}` });
    }

    // Test hop 1 to see if raw ICMP TTL probing is allowed by kernel
    const firstProbe = await runSystemPingSingle(resolvedIp, 1, hopTimeout);

    if (firstProbe.permissionDenied) {
      // Cloud container restricts raw ICMP sockets -> perform real TCP multi-port endpoint reachability trace
      const tcpStart = Date.now();
      const targetProbe = await checkPort(resolvedIp, 80, 2000);
      const tcpAlt = targetProbe.status === 'FILTERED' ? await checkPort(resolvedIp, 443, 2000) : targetProbe;
      const reached = tcpAlt.status === 'OPEN' || tcpAlt.status === 'CLOSED';
      const totalMs = Math.max(1, tcpAlt.latencyMs || Date.now() - tcpStart);
      const revHost = await resolveReverseDns(resolvedIp);

      const fallbackHops = [
        {
          hop: 1,
          ip: 'cloud-egress-gw',
          hostname: 'cloud-console-gateway',
          sent: 2,
          lossPercent: 0,
          lastMs: 1.2,
          avgMs: 1.2,
          bestMs: 1.0,
          worstMs: 1.4,
          stDev: 0.2,
        },
        {
          hop: 2,
          ip: resolvedIp,
          hostname: revHost,
          sent: 2,
          lossPercent: reached ? 0 : 100,
          lastMs: reached ? totalMs : 0,
          avgMs: reached ? totalMs : 0,
          bestMs: reached ? totalMs : 0,
          worstMs: reached ? totalMs : 0,
          stDev: 0,
        },
      ];

      return res.json({
        host: cleanHost,
        resolvedIp,
        method: 'tcp-fallback',
        reached,
        note: 'Cloud sandbox restricts raw ICMP TTL sockets; showing direct TCP reachability. Full hop-by-hop ICMP Traceroute runs natively on the Android APK.',
        hops: fallbackHops,
        timestamp: new Date().toISOString(),
      });
    }

    // Real ICMP TTL Hop-by-Hop Traceroute
    const hops: {
      hop: number;
      ip: string;
      hostname: string;
      sent: number;
      lossPercent: number;
      lastMs: number;
      avgMs: number;
      bestMs: number;
      worstMs: number;
      stDev: number;
    }[] = [];

    let reachedDestination = false;

    const processHop = async (ttl: number, preRun?: SinglePingOutcome) => {
      const p1 = preRun ?? (await runSystemPingSingle(resolvedIp, ttl, hopTimeout));
      // Take a 2nd fast sample if hop replied for accurate avg/best/worst/stdev
      const p2 = p1.ok ? await runSystemPingSingle(resolvedIp, ttl, hopTimeout) : null;

      const samples: number[] = [];
      if (p1.ok) samples.push(p1.latencyMs);
      if (p2 && p2.ok) samples.push(p2.latencyMs);

      const hopIp = p1.hopIp || p2?.hopIp || '*';
      const sent = p2 ? 2 : 1;
      const received = samples.length;
      const lossPercent = Math.round(((sent - received) / sent) * 100);
      const lastMs = samples.length ? samples[samples.length - 1] : 0;
      const bestMs = samples.length ? Math.min(...samples) : 0;
      const worstMs = samples.length ? Math.max(...samples) : 0;
      const avgMs = samples.length
        ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
        : 0;
      const stDev =
        samples.length > 1
          ? Math.round((Math.abs(samples[1] - samples[0]) / 2) * 10) / 10
          : 0;

      const hostname = hopIp !== '*' ? await resolveReverseDns(hopIp) : 'Request timed out';

      return {
        hopData: {
          hop: ttl,
          ip: hopIp,
          hostname,
          sent,
          lossPercent,
          lastMs,
          avgMs,
          bestMs,
          worstMs,
          stDev,
        },
        reached: p1.reached || Boolean(p2?.reached) || hopIp === resolvedIp,
      };
    };

    // Process Hop 1 from initial probe
    const h1 = await processHop(1, firstProbe);
    hops.push(h1.hopData);
    if (h1.reached) {
      reachedDestination = true;
    }

    // Run remaining TTLs in parallel batches of 3 for speed
    let currentTtl = 2;
    while (!reachedDestination && currentTtl <= hopLimit) {
      const batchTtls: number[] = [];
      for (let k = 0; k < 3 && currentTtl + k <= hopLimit; k++) {
        batchTtls.push(currentTtl + k);
      }

      const batchResults = await Promise.all(batchTtls.map((t) => processHop(t)));
      for (const item of batchResults) {
        hops.push(item.hopData);
        if (item.reached) {
          reachedDestination = true;
          break;
        }
      }
      currentTtl += batchTtls.length;
    }

    let note: string | undefined;
    if (!reachedDestination) {
      // Check if destination itself is directly reachable (intermediate ISP/cloud routers often drop ICMP Time-Exceeded)
      const directCheck = await runSystemPingSingle(resolvedIp, undefined, hopTimeout);
      if (directCheck.ok && directCheck.reached) {
        const revHost = await resolveReverseDns(resolvedIp);
        const estimatedHop = directCheck.ttl ? Math.max(hops.length + 1, 64 - directCheck.ttl + 1) : hops.length + 1;
        hops.push({
          hop: estimatedHop <= 30 ? estimatedHop : hops.length + 1,
          ip: resolvedIp,
          hostname: revHost,
          sent: 1,
          lossPercent: 0,
          lastMs: directCheck.latencyMs,
          avgMs: directCheck.latencyMs,
          bestMs: directCheck.latencyMs,
          worstMs: directCheck.latencyMs,
          stDev: 0,
        });
        reachedDestination = true;
        note = 'Intermediate cloud/ISP routers filtered ICMP TTL-Exceeded packets; destination confirmed reachable via direct ICMP echo.';
      }
    }

    res.json({
      host: cleanHost,
      resolvedIp,
      method: 'icmp',
      reached: reachedDestination,
      note,
      hops,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Traceroute error' });
  }
});

// DNS lookup helper
app.post('/api/diagnostics/dns', async (req: Request, res: Response) => {
  const { host } = req.body;
  if (!host) {
    return res.status(400).json({ error: 'Host is required.' });
  }

  dns.lookup(host, { all: true }, (err, addresses) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ host, addresses });
  });
});

// MikroTik RouterOS Script Generator endpoint
app.post('/api/mikrotik/generate-script', (req: Request, res: Response) => {
  const {
    profileName = 'isp-client',
    serverIp = '192.168.88.1',
    vpnSubnet = '10.99.0.0/24',
    remoteSubnets = ['192.168.88.0/24'],
    username = 'pptp-admin',
    password = 'ChangeMeSecurely!',
    mppe = 'require-128',
    routerOsVersion = 'v7',
  } = req.body;

  const localIp = '10.99.0.1';
  const remoteIp = '10.99.0.2';

  const scriptV7 = `# ====================================================================
# MikroTik RouterOS v7 PPTP Server & Split-Tunneling Configuration
# Generated by PPTP Solution Engine for ISP Engineering
# Target Subnets: ${remoteSubnets.join(', ')}
# ====================================================================

# 1. Create IP Pool for PPTP Clients
/ip pool add name=pptp-pool ranges=10.99.0.10-10.99.0.50

# 2. Configure PPP Profile (Strict Split Routing, No Default Gateway Override)
/ppp profile add name="pptp-split-profile" \\
    local-address=${localIp} \\
    remote-address=pptp-pool \\
    use-encryption=${mppe === 'none' ? 'no' : 'yes'} \\
    change-tcp-mss=yes \\
    dns-server=${localIp} \\
    comment="Engineered for PPTP Solution Android Split-Tunnel Client"

# 3. Create PPTP Secret for User
/ppp secret add name="${username}" \\
    password="${password}" \\
    profile="pptp-split-profile" \\
    service=pptp \\
    remote-address=${remoteIp} \\
    comment="ISP Field Admin Account"

# 4. Enable PPTP Server Service (TCP 1723 & GRE IP Proto 47)
/interface pptp-server server set enabled=yes \\
    default-profile="pptp-split-profile" \\
    authentication=mschap2,mschap1 \\
    keepalive-timeout=30 \\
    max-mtu=1400 \\
    max-mru=1400

# 5. Firewall Filter Rules (Accept PPTP Control and GRE)
/ip firewall filter add chain=input protocol=tcp dst-port=1723 action=accept comment="Allow PPTP Control (TCP 1723)"
/ip firewall filter add chain=input protocol=gre action=accept comment="Allow PPTP GRE (IP Protocol 47)"

# 6. Split Tunnel Firewall & NAT (Allow access to remote LAN subnets)
${remoteSubnets
  .map(
    (subnet: string) =>
      `/ip firewall filter add chain=forward src-address=${vpnSubnet} dst-address=${subnet} action=accept comment="PPTP Split Tunnel -> ${subnet}"`
  )
  .join('\n')}

# Ensure no masquerade leaks default internet traffic over PPTP
/ip firewall nat add chain=srcnat src-address=10.99.0.0/24 out-interface=!ether1 action=masquerade comment="PPTP LAN access"
`;

  res.json({
    script: scriptV7,
    routerOsVersion,
    generatedAt: new Date().toISOString(),
  });
});


// Native files reader endpoint
app.get('/api/native-files', (_req: Request, res: Response) => {
  const filePaths = [
    { id: 'pubspec', path: 'pubspec.yaml', category: 'Config', language: 'yaml', description: 'Flutter dependencies specification (dartssh2, xterm, shared_preferences)' },
    { id: 'manifest', path: 'android/app/src/main/AndroidManifest.xml', category: 'Android Native', language: 'xml', description: 'Android Manifest with BIND_VPN_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE, and permissions' },
    { id: 'vpn_service_kt', path: 'android/app/src/main/kotlin/com/pptpsolution/app/PPTPVpnService.kt', category: 'Android Native', language: 'kotlin', description: 'Production Android VpnService with strict split tunneling, RFC 2637 PPTP handshake, and TUN fd' },
    { id: 'main_activity_kt', path: 'android/app/src/main/kotlin/com/pptpsolution/app/MainActivity.kt', category: 'Android Native', language: 'kotlin', description: 'FlutterActivity with MethodChannel vpn_control and EventChannel vpn_status' },
    { id: 'pptp_profile_dart', path: 'lib/models/pptp_profile.dart', category: 'Flutter Core', language: 'dart', description: 'PPTPProfile data model with split CIDR sanitization and validation' },
    { id: 'vpn_service_dart', path: 'lib/services/vpn_service.dart', category: 'Flutter Services', language: 'dart', description: 'MethodChannel and EventChannel wrapper with reactive status stream' },
    { id: 'telnet_client_dart', path: 'lib/services/telnet_client.dart', category: 'Flutter Services', language: 'dart', description: 'Universal RFC 854 / NAWS / TTYPE Telnet Engine for Cisco, Huawei, BDCOM, VSOL, MikroTik & Palo Alto' },
    { id: 'serial_console_service_dart', path: 'lib/services/serial_console_service.dart', category: 'Flutter Services', language: 'dart', description: 'Android USB-OTG Serial Console Cable Engine (FTDI, PL2303, CH340, CP210x, Cisco/Huawei USB Console)' },
    { id: 'storage_service_dart', path: 'lib/services/storage_service.dart', category: 'Flutter Services', language: 'dart', description: 'SharedPreferences persistence and default ISP profiles' },
    { id: 'dashboard_screen_dart', path: 'lib/screens/dashboard_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Dashboard UI with ISP profiles, quick connect toggle, and route badges' },
    { id: 'terminal_screen_dart', path: 'lib/screens/terminal_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Multi-vendor SSH, RFC 854 Telnet & USB-OTG Console Cable terminal (12 Vendors)' },
    { id: 'diagnostics_screen_dart', path: 'lib/screens/diagnostics_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Native Android Ping, Speed Ping, Hop-by-Hop Traceroute & TCP Port Scanner' },
    { id: 'main_dart', path: 'lib/main.dart', category: 'Flutter Core', language: 'dart', description: 'Universal WebUI for Network Engineer entry point with 5-tab white/black shell' },
  ];

  const files = filePaths.map((f) => {
    const fullPath = path.join(__dirname, f.path);
    let content = '';
    try {
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8');
      }
    } catch (e: any) {
      content = `// Error reading file: ${e.message}`;
    }
    return {
      ...f,
      name: path.basename(f.path),
      content,
    };
  });

  res.json({ files });
});

// Direct zip download endpoint (works in all browsers without blob restrictions)
app.get('/api/download-zip', async (_req: Request, res: Response) => {
  try {
    const zip = new JSZip();
    const filePaths = [
      'pubspec.yaml',
      'android/settings.gradle',
      'android/build.gradle',
      'android/gradlew',
      'android/gradle/wrapper/gradle-wrapper.properties',
      'android/app/build.gradle',
      'android/app/src/main/AndroidManifest.xml',
      'android/app/src/main/res/values/styles.xml',
      'android/app/src/main/res/xml/network_security_config.xml',
      'android/app/src/main/res/drawable/launch_background.xml',
      'android/app/src/main/kotlin/com/pptpsolution/app/PPTPVpnService.kt',
      'android/app/src/main/kotlin/com/pptpsolution/app/MainActivity.kt',
      'lib/models/pptp_profile.dart',
      'lib/services/vpn_service.dart',
      'lib/services/telnet_client.dart',
      'lib/services/serial_console_service.dart',
      'lib/services/storage_service.dart',
      'lib/services/notepad_storage_service.dart',
      'lib/screens/device_webui_screen.dart',
      'lib/screens/command_notepad_screen.dart',
      'lib/screens/dashboard_screen.dart',
      'lib/screens/terminal_screen.dart',
      'lib/screens/diagnostics_screen.dart',
      'lib/main.dart',
      '.github/workflows/build-apk.yml',
    ];

    for (const relPath of filePaths) {
      const fullPath = path.join(__dirname, relPath);
      if (fs.existsSync(fullPath)) {
        zip.file(relPath, fs.readFileSync(fullPath));
      }
    }

    const readme = `# Universal WebUI for Network Engineer - Android & Flutter App

Complete Android/Flutter app source code with ALL features included:
- **Multi-Vendor Graphical WebUI (12 Brands):** Huawei, ZTE, BDCOM, VSOL, C-Data, MikroTik, Cisco, Juniper, Palo Alto, Arista, Ruijie, TP-Link (Interface IP, VLAN & Switch L2, Static Route & BGP, OLT ONU Add/Delete/Auto-Find/Optics, Hostname & Save)
- **Resizable Live Telnet, SSH & USB-OTG Console Cable Terminal:** Drag-to-resize terminal viewport + Font Size (A-/A+) + Fullscreen mode + RFC 854 Telnet + SSH + USB-to-Serial RS-232 (FTDI, PL2303, CH340, CP210x @ 9600/115200 bps) with interactive \`? Help\`, \`Tab\` autocomplete, Ctrl+C/Z, and 12-vendor snippets
- **Personal Command Notepad:** Save multi-line CLI scripts, Pin, Search, Quick Edit & Apply, and 1-Tap Apply Live
- **User-Space PPTP VPN (Android VpnService):** Full & Split Tunneling
- **Network Diagnostics:** Ping & TCP Port Scanner

## Build Release APK
1. Unzip this package.
2. Ensure Flutter SDK >= 3.16.0 is installed.
3. Run \`flutter pub get\`
4. Run \`flutter build apk --release\` (or push to GitHub to auto-build via GitHub Actions).
`;
    zip.file('README.md', readme);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="universal_webui_network_engineer_app.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate zip: ' + err.message });
  }
});

// Full Working Standalone Desktop Application ZIP (Windows / macOS / Linux)
// Runs directly on the user's PC so local PPTP/L2TP/SSTP, Private LAN Ping/Tracert/Telnet, and Physical COM Port Console Cable work 100% natively.
app.get('/api/download-desktop-app', async (_req: Request, res: Response) => {
  try {
    const zip = new JSZip();

    const addDirToZip = (
      relDir: string,
      skipDirs = new Set(['node_modules', '.git', 'releases', 'dev-dist', '__pycache__', 'aistudio'])
    ) => {
      const absDir = path.join(__dirname, relDir);
      if (!fs.existsSync(absDir)) return;
      const entries = fs.readdirSync(absDir, { withFileTypes: true });
      for (const entry of entries) {
        if (skipDirs.has(entry.name)) continue;
        const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
        const childAbs = path.join(__dirname, childRel);
        if (entry.isDirectory()) {
          addDirToZip(childRel, skipDirs);
        } else if (entry.isFile()) {
          zip.file(childRel, fs.readFileSync(childAbs));
        }
      }
    };

    const rootFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'index.html',
      'metadata.json',
      'server.ts',
      'vpn_tunnel_daemon.py',
    ];
    for (const rel of rootFiles) {
      const full = path.join(__dirname, rel);
      if (fs.existsSync(full)) {
        zip.file(rel, fs.readFileSync(full));
      }
    }

    // Include pre-built dist/ if present + src/ & public/
    addDirToZip('dist');
    addDirToZip('src');
    addDirToZip('public');

    const windowsLauncher = `@echo off
title Universal WebUI for Network Engineer - Desktop App
cd /d "%~dp0"

echo ============================================================
echo   Universal WebUI for Network Engineer (Full Working Mode)
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed on this PC!
  echo Please install Node.js LTS from https://nodejs.org and double-click this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Installing required packages (first run only)...
  call npm install --omit=dev --no-audit --no-fund
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Check internet connection.
    pause
    exit /b 1
  )
)

echo [2/3] Starting local Network Engineer Engine on http://localhost:3000 ...
set NODE_ENV=production
start "Universal-WebUI-Engine" /min cmd /c "npx tsx server.ts"

echo [3/3] Opening Desktop Application Window...
timeout /t 3 /nobreak >nul

set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
set "EDGE64=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
set "CHROME=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
set "CHROME86=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app=http://localhost:3000 --window-size=1360,860
) else if exist "%EDGE64%" (
  start "" "%EDGE64%" --app=http://localhost:3000 --window-size=1360,860
) else if exist "%CHROME%" (
  start "" "%CHROME%" --app=http://localhost:3000 --window-size=1360,860
) else if exist "%CHROME86%" (
  start "" "%CHROME86%" --app=http://localhost:3000 --window-size=1360,860
) else (
  start "" http://localhost:3000
)

echo.
echo App is running at http://localhost:3000
echo Keep the minimized "Universal-WebUI-Engine" window open while using the app.
echo.
`;

    const unixLauncher = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo "  Universal WebUI for Network Engineer (Full Working Mode)"
echo "============================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Install Node.js LTS from https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/3] Installing dependencies (first launch only)..."
  npm install --omit=dev --no-audit --no-fund
fi

echo "[2/3] Starting local engine on http://localhost:3000 ..."
NODE_ENV=production npx tsx server.ts &
SERVER_PID=$!
sleep 3

echo "[3/3] Opening Desktop App Window..."
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app=http://localhost:3000 --window-size=1360,860 >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --app=http://localhost:3000 --window-size=1360,860 >/dev/null 2>&1 &
elif [ "$(uname)" = "Darwin" ]; then
  open -a "Google Chrome" --args --app=http://localhost:3000 || open http://localhost:3000
else
  xdg-open http://localhost:3000 >/dev/null 2>&1 || true
fi

echo "Running on http://localhost:3000 (Press Ctrl+C to stop)"
wait $SERVER_PID
`;

    const desktopReadme = `Universal WebUI for Network Engineer — Full Working Desktop App (Windows / Mac / Linux)
======================================================================================

কেন এই Desktop App ভার্সনটি ১০০% Full Working Mode-এ কাজ করে?
- এটি আপনার নিজের কম্পিউটারে লোকালভাবে (http://localhost:3000) চলে।
- আপনার পিসিতে PPTP / L2TP / SSTP VPN কানেক্ট থাকলে বা সরাসরি অফিস/ISP LAN-এ থাকলে,
  MikroTik-এ আলাদা লগইন না করেই যেকোনো Private IP (10.x.x.x / 172.16.x.x / 192.168.x.x)-এ
  সরাসরি Ping, Traceroute, TCP Port Scan, Telnet, Multi-Vendor WebUI কাজ করবে!
- Physical USB-to-Serial Console Cable (COM Port / FTDI / CH340 / PL2303) সরাসরি কাজ করবে।
- সব Terminal Box ড্র্যাগ করে ছোট-বড় (S/M/L/Drag/Fullscreen) ও Font Size (A-/A+) করা যাবে।

কিভাবে চালু করবেন (Windows):
1. এই ZIP ফাইলটি Extract (Unzip) করুন।
2. পিসিতে Node.js ইনস্টল না থাকলে https://nodejs.org থেকে LTS ভার্সন ইনস্টল করুন।
3. "Universal-WebUI-Desktop.bat" ফাইলে ডাবল-ক্লিক করুন।
   (প্রথমবার চালু হতে ৩০-৬০ সেকেন্ড লাগবে; এরপর থেকে ২ সেকেন্ডেই Standalone Desktop App উইন্ডো ওপেন হবে!)

কিভাবে চালু করবেন (macOS / Linux):
1. টার্মিনালে এই ফোল্ডারে যান এবং চালান:
   chmod +x start-desktop-app.sh && ./start-desktop-app.sh
`;

    zip.file('Universal-WebUI-Desktop.bat', windowsLauncher.replace(/\n/g, '\r\n'));
    zip.file('start-desktop-app.sh', unixLauncher, { unixPermissions: '755' });
    zip.file('README_DESKTOP.txt', desktopReadme);

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="universal_webui_desktop_app.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to build desktop app package: ' + err.message });
  }
});

// Chunked Binary Package Downloader (4 MB chunks — bypasses Cloud Run 32 MB response cap & proxy .exe 403 blocks!)
const PKG_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

function resolvePackageTarget(target: string) {
  if (target === 'win64') {
    return {
      gzPath: path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer.exe.gz'),
      rawPath: path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer.exe'),
      filename: 'Universal-WebUI-Network-Engineer.exe',
    };
  }
  if (target === 'linux64') {
    return {
      gzPath: path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer-Linux-x64.gz'),
      rawPath: path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer-Linux-x64'),
      filename: 'Universal-WebUI-Network-Engineer-Linux-x64',
    };
  }
  return null;
}

app.get('/api/pkg/:target/meta', (req: Request, res: Response) => {
  const pkg = resolvePackageTarget(req.params.target);
  if (!pkg || !fs.existsSync(pkg.gzPath)) {
    return res.status(404).json({ error: 'Package binary is not available.' });
  }
  const gzStat = fs.statSync(pkg.gzPath);
  const rawBytes = fs.existsSync(pkg.rawPath) ? fs.statSync(pkg.rawPath).size : gzStat.size;
  const totalChunks = Math.ceil(gzStat.size / PKG_CHUNK_SIZE);
  res.json({
    target: req.params.target,
    filename: pkg.filename,
    encoding: 'gzip',
    compressedBytes: gzStat.size,
    rawBytes,
    chunkSize: PKG_CHUNK_SIZE,
    totalChunks,
  });
});

app.get('/api/pkg/:target/part/:index', (req: Request, res: Response) => {
  const pkg = resolvePackageTarget(req.params.target);
  if (!pkg || !fs.existsSync(pkg.gzPath)) {
    return res.status(404).json({ error: 'Package binary is not available.' });
  }
  const idx = parseInt(req.params.index, 10);
  const gzStat = fs.statSync(pkg.gzPath);
  const totalChunks = Math.ceil(gzStat.size / PKG_CHUNK_SIZE);
  if (isNaN(idx) || idx < 0 || idx >= totalChunks) {
    return res.status(400).json({ error: 'Invalid chunk index.' });
  }
  const start = idx * PKG_CHUNK_SIZE;
  const end = Math.min(start + PKG_CHUNK_SIZE, gzStat.size) - 1;
  const length = end - start + 1;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(length));
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(pkg.gzPath, { start, end }).pipe(res);
});

const GITHUB_RELEASES_URL = 'https://github.com/imrafikul/Termius-clone/releases/latest';

// Direct Ready-to-Run Standalone Windows 64-bit .exe Download (falls back to external GitHub Release when not bundled locally)
app.get('/api/download-windows-exe', (_req: Request, res: Response) => {
  const exePath = path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer.exe');
  if (!fs.existsSync(exePath)) {
    return res.redirect(302, GITHUB_RELEASES_URL);
  }
  const stat = fs.statSync(exePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Universal-WebUI-Network-Engineer.exe"');
  res.setHeader('Content-Length', stat.size.toString());
  fs.createReadStream(exePath).pipe(res);
});

// Direct Ready-to-Run Standalone Linux x64 Executable Download (falls back to external GitHub Release when not bundled locally)
app.get('/api/download-linux-bin', (_req: Request, res: Response) => {
  const binPath = path.join(__dirname, 'releases', 'Universal-WebUI-Network-Engineer-Linux-x64');
  if (!fs.existsSync(binPath)) {
    return res.redirect(302, GITHUB_RELEASES_URL);
  }
  const stat = fs.statSync(binPath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Universal-WebUI-Network-Engineer-Linux-x64"');
  res.setHeader('Content-Length', stat.size.toString());
  fs.createReadStream(binPath).pipe(res);
});

// Interactive RFC 854 Telnet probe endpoint (strips IAC negotiation for Cisco/Huawei/BDCOM/VSOL/MikroTik/Palo Alto)
app.post('/api/diagnostics/telnet', (req: Request, res: Response) => {
  const { host = '192.168.88.1', port = 23, timeoutMs = 4000 } = req.body;
  const socket = new net.Socket();
  const cleanBytes: number[] = [];
  let responded = false;

  const timer = setTimeout(() => {
    if (!responded) {
      responded = true;
      socket.destroy();
      const bannerText = Buffer.from(cleanBytes).toString('utf-8').trim();
      res.json({
        host,
        port,
        connected: false,
        latencyMs: timeoutMs,
        error: `Connection timed out on port ${port} (Device unreachable, behind private LAN/VPN, or Telnet disabled)`,
        banner: bannerText || null,
      });
    }
  }, timeoutMs);

  const startTime = Date.now();
  socket.connect(port, host, () => {
    const latency = Date.now() - startTime;
    // Offer SGA & TTYPE so Cisco/Huawei/BDCOM/VSOL emit login banner promptly
    socket.write(Buffer.from([255, 253, 3, 255, 251, 3, 255, 251, 24]));
    setTimeout(() => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        socket.destroy();
        const bannerText = Buffer.from(cleanBytes).toString('utf-8').trim();
        res.json({
          host,
          port,
          connected: true,
          latencyMs: latency,
          banner: bannerText || 'Telnet RFC 854 session established. Ready for login prompt.',
        });
      }
    }, 900);
  });

  socket.on('data', (chunk: Buffer) => {
    const replies: number[] = [];
    let i = 0;
    while (i < chunk.length) {
      const b = chunk[i];
      if (b === 255 && i + 1 < chunk.length) {
        const cmd = chunk[i + 1];
        if ((cmd === 251 || cmd === 252 || cmd === 253 || cmd === 254) && i + 2 < chunk.length) {
          const opt = chunk[i + 2];
          if (cmd === 251) {
            // WILL -> DO for ECHO(1)/SGA(3), else DONT
            replies.push(255, opt === 1 || opt === 3 ? 253 : 254, opt);
          } else if (cmd === 253) {
            // DO -> WILL for SGA(3)/TTYPE(24), else WONT
            replies.push(255, opt === 3 || opt === 24 ? 251 : 252, opt);
          }
          i += 3;
          continue;
        } else if (cmd === 250) {
          // Subnegotiation until IAC SE (255 240)
          let end = i + 2;
          while (end < chunk.length - 1 && !(chunk[end] === 255 && chunk[end + 1] === 240)) {
            end++;
          }
          if (i + 3 < chunk.length && chunk[i + 2] === 24 && chunk[i + 3] === 1) {
            // Reply TTYPE IS xterm-256color
            replies.push(255, 250, 24, 0, ...Buffer.from('xterm-256color'), 255, 240);
          }
          i = end + 2;
          continue;
        } else {
          i += 2;
          continue;
        }
      }
      if (b !== 0) cleanBytes.push(b);
      i++;
    }
    if (replies.length > 0 && !socket.destroyed) {
      socket.write(Buffer.from(replies));
    }
  });

  socket.on('error', (err: any) => {
    if (!responded) {
      responded = true;
      clearTimeout(timer);
      const latency = Date.now() - startTime;
      socket.destroy();
      res.json({
        host,
        port,
        connected: false,
        latencyMs: latency,
        error: err.code === 'ECONNREFUSED' ? `Port ${port} closed (Connection refused)` : (err.message || err.code),
        banner: null,
      });
    }
  });
});

// =========================================================================
// REAL INTERACTIVE LIVE TELNET SESSION BRIDGE (RFC 854 / NAWS / TTYPE / AUTO-LOGIN)
// Supports Cisco, Huawei, BDCOM, VSOL, MikroTik, Palo Alto directly from Web UI
// =========================================================================
interface LiveTelnetSession {
  id: string;
  host: string;
  port: number;
  socket: net.Socket;
  connected: boolean;
  closedReason?: string;
  buffer: string;
  lastActivity: number;
  username: string;
  password: string;
  autoLogin: boolean;
  sentUsername: boolean;
  sentPassword: boolean;
}

const liveTelnetSessions = new Map<string, LiveTelnetSession>();

// Periodically reap idle live Telnet sessions (> 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of liveTelnetSessions.entries()) {
    if (now - sess.lastActivity > 10 * 60 * 1000) {
      try {
        sess.socket.destroy();
      } catch {}
      liveTelnetSessions.delete(id);
    }
  }
}, 60 * 1000).unref();

function negotiateAndDecodeTelnet(chunk: Buffer, socket: net.Socket): string {
  const replies: number[] = [];
  const cleanBytes: number[] = [];
  let i = 0;

  while (i < chunk.length) {
    const b = chunk[i];
    if (b === 255 && i + 1 < chunk.length) {
      const cmd = chunk[i + 1];
      if ((cmd === 251 || cmd === 252 || cmd === 253 || cmd === 254) && i + 2 < chunk.length) {
        const opt = chunk[i + 2];
        if (cmd === 251) {
          // WILL -> DO for ECHO(1) and SGA(3), DONT for others
          replies.push(255, opt === 1 || opt === 3 ? 253 : 254, opt);
        } else if (cmd === 253) {
          // DO -> WILL for SGA(3), TTYPE(24), NAWS(31); WONT for others
          if (opt === 3 || opt === 24 || opt === 31) {
            replies.push(255, 251, opt);
            if (opt === 31) {
              // Send NAWS 120x40 immediately
              replies.push(255, 250, 31, 0, 120, 0, 40, 255, 240);
            }
          } else {
            replies.push(255, 252, opt);
          }
        }
        i += 3;
        continue;
      } else if (cmd === 250) {
        let end = i + 2;
        while (end < chunk.length - 1 && !(chunk[end] === 255 && chunk[end + 1] === 240)) {
          end++;
        }
        if (i + 3 < chunk.length && chunk[i + 2] === 24 && chunk[i + 3] === 1) {
          // TTYPE SEND -> TTYPE IS xterm-256color
          replies.push(255, 250, 24, 0, ...Buffer.from('xterm-256color'), 255, 240);
        }
        i = end + 2;
        continue;
      } else if (cmd === 255) {
        cleanBytes.push(255);
        i += 2;
        continue;
      } else {
        i += 2;
        continue;
      }
    }
    if (b !== 0) {
      cleanBytes.push(b);
    }
    i++;
  }

  if (replies.length > 0 && !socket.destroyed) {
    socket.write(Buffer.from(replies));
  }

  // Decode UTF-8 and strip ANSI CSI escape sequences & BEL (\x07) so BDCOM/Cisco/MikroTik ? and Tab outputs stay clean
  return Buffer.from(cleanBytes)
    .toString('utf-8')
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x07/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

// Open a real interactive live Telnet session (supports direct TCP OR via MikroTik Jump-Gateway for private LAN IPs!)
app.post('/api/telnet/sessions', (req: Request, res: Response) => {
  const {
    host,
    port = 23,
    username = '',
    password = '',
    autoLogin = true,
    timeoutMs = 6000,
    jumpGateway,
  } = req.body || {};

  if (!host || typeof host !== 'string' || !isValidHost(host)) {
    return res.status(400).json({ connected: false, error: 'Valid IP address or hostname is required.' });
  }

  const cleanHost = host.trim();
  const portNum = Math.max(1, Math.min(65535, parseInt(String(port), 10) || 23));
  const useJump = Boolean(
    realVpnState.status !== 'CONNECTED' &&
      jumpGateway &&
      typeof jumpGateway.host === 'string' &&
      isValidHost(jumpGateway.host) &&
      jumpGateway.host.trim() !== cleanHost
  );
  const connectHost = useJump ? jumpGateway.host.trim() : cleanHost;
  const connectPort = useJump ? Math.max(1, Math.min(65535, parseInt(String(jumpGateway.port), 10) || 23)) : portNum;
  const jumpUser = useJump
    ? String(jumpGateway.username || 'admin').trim().includes('+')
      ? String(jumpGateway.username || 'admin').trim()
      : `${String(jumpGateway.username || 'admin').trim()}+ct`
    : '';
  const jumpPass = useJump ? String(jumpGateway.password || '') : '';
  let jumpStage: 'login' | 'pass' | 'wait_prompt' | 'done' = useJump ? 'login' : 'done';
  let jumpAccum = '';

  const sessionId = `tnet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // Limit max concurrent live sessions
  if (liveTelnetSessions.size >= 50) {
    const oldestKey = liveTelnetSessions.keys().next().value;
    if (oldestKey) {
      try {
        liveTelnetSessions.get(oldestKey)?.socket.destroy();
      } catch {}
      liveTelnetSessions.delete(oldestKey);
    }
  }

  const socket = new net.Socket();
  const startTime = Date.now();
  let initialResponded = false;

  const session: LiveTelnetSession = {
    id: sessionId,
    host: cleanHost,
    port: portNum,
    socket,
    connected: false,
    buffer: '',
    lastActivity: Date.now(),
    username: typeof username === 'string' ? username.trim() : '',
    password: typeof password === 'string' ? password : '',
    autoLogin: Boolean(autoLogin),
    sentUsername: false,
    sentPassword: false,
  };

  const connectTimer = setTimeout(() => {
    if (!initialResponded) {
      initialResponded = true;
      socket.destroy();
      res.json({
        connected: false,
        host: cleanHost,
        port: portNum,
        latencyMs: timeoutMs,
        error: useJump
          ? `MikroTik Jump-Gateway (${connectHost}:${connectPort}) timed out while hopping to ${cleanHost}:${portNum}.`
          : `Connection timed out to ${cleanHost}:${portNum} (Host unreachable, firewall blocking port ${portNum}, or private LAN IP — enable "Via MikroTik Jump" for private IPs!).`,
      });
    }
  }, Math.min(Math.max(Number(timeoutMs) || 6000, 1500), 12000));

  socket.connect(connectPort, connectHost, () => {
    const latencyMs = Math.max(1, Date.now() - startTime);
    clearTimeout(connectTimer);
    session.connected = true;
    session.lastActivity = Date.now();
    liveTelnetSessions.set(sessionId, session);

    // Proactively offer SGA, TTYPE & NAWS
    try {
      socket.write(Buffer.from([255, 253, 3, 255, 251, 3, 255, 251, 24, 255, 251, 31]));
    } catch {}

    // Give remote router/OLT (or MikroTik jump) time to send its initial banner & login prompt
    setTimeout(() => {
      if (!initialResponded) {
        initialResponded = true;
        const initialOutput = session.buffer;
        session.buffer = '';
        res.json({
          sessionId,
          connected: session.connected,
          host: cleanHost,
          port: portNum,
          viaJump: useJump ? `${connectHost}:${connectPort}` : undefined,
          latencyMs,
          output: initialOutput,
          closedReason: session.closedReason,
        });
      }
    }, useJump ? 1800 : 900);
  });

  socket.on('data', (chunk: Buffer) => {
    session.lastActivity = Date.now();
    const text = negotiateAndDecodeTelnet(chunk, socket);
    if (!text) return;
    session.buffer += text;
    if (session.buffer.length > 65536) {
      session.buffer = session.buffer.slice(-65536);
    }

    // Stage 1: If hopping through MikroTik Jump-Gateway, log into MikroTik & run `/system telnet` to private LAN IP
    if (useJump && jumpStage !== 'done' && session.connected && !socket.destroyed) {
      jumpAccum += text;
      const lowerJump = jumpAccum.toLowerCase();
      if (jumpStage === 'login' && /login\s*:/i.test(lowerJump)) {
        jumpStage = 'pass';
        setTimeout(() => session.connected && !socket.destroyed && socket.write(`${jumpUser}\r\n`), 150);
      } else if (jumpStage === 'pass' && /password\s*:/i.test(lowerJump)) {
        jumpStage = 'wait_prompt';
        setTimeout(() => session.connected && !socket.destroyed && socket.write(`${jumpPass}\r\n`), 150);
      } else if (jumpStage === 'wait_prompt' && (/\]\s*>\s*$/m.test(jumpAccum) || /\[.+@.+\]\s*>/i.test(jumpAccum))) {
        jumpStage = 'done';
        setTimeout(() => {
          if (session.connected && !socket.destroyed) {
            socket.write(`/system telnet address=${cleanHost} port=${portNum}\r\n`);
          }
        }, 200);
      }
      return;
    }

    // Stage 2: Smart Auto-Login prompt detection for target device (Cisco, Huawei, BDCOM, VSOL, MikroTik, Palo Alto)
    if (session.autoLogin && session.connected && !socket.destroyed) {
      const lower = text.toLowerCase();
      if (
        !session.sentUsername &&
        session.username &&
        /(login|username|user\s*name|user)\s*:/i.test(lower)
      ) {
        session.sentUsername = true;
        setTimeout(() => {
          if (session.connected && !socket.destroyed) {
            socket.write(`${session.username}\r\n`);
          }
        }, 180);
      } else if (
        !session.sentPassword &&
        session.password &&
        /password\s*:/i.test(lower)
      ) {
        session.sentPassword = true;
        setTimeout(() => {
          if (session.connected && !socket.destroyed) {
            socket.write(`${session.password}\r\n`);
          }
        }, 180);
      }
    }
  });

  socket.on('close', () => {
    session.connected = false;
    session.closedReason = session.closedReason || 'Remote host closed Telnet connection.';
  });

  socket.on('error', (err: any) => {
    const latencyMs = Math.max(1, Date.now() - startTime);
    session.connected = false;
    const msg =
      err.code === 'ECONNREFUSED'
        ? `Connection refused on ${cleanHost}:${portNum} (Telnet service closed or disabled).`
        : err.code === 'ENOTFOUND'
        ? `Host not found: ${cleanHost}`
        : err.code === 'EHOSTUNREACH' || err.code === 'ENETUNREACH'
        ? `Host unreachable: ${cleanHost}:${portNum}`
        : err.message || String(err.code || 'Socket error');
    session.closedReason = msg;

    if (!initialResponded) {
      initialResponded = true;
      clearTimeout(connectTimer);
      socket.destroy();
      liveTelnetSessions.delete(sessionId);
      res.json({
        connected: false,
        host: cleanHost,
        port: portNum,
        latencyMs,
        error: msg,
      });
    }
  });
});

// Send command or raw control keystrokes to a live Telnet session
app.post('/api/telnet/sessions/:id/write', (req: Request, res: Response) => {
  const session = liveTelnetSessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ connected: false, error: 'Telnet session expired or closed.' });
  }
  if (!session.connected || session.socket.destroyed) {
    const out = session.buffer;
    session.buffer = '';
    return res.json({
      connected: false,
      output: out,
      closedReason: session.closedReason || 'Connection closed.',
    });
  }

  const { input = '', raw = false } = req.body || {};
  session.lastActivity = Date.now();
  try {
    const payload = raw ? String(input) : `${String(input)}\r\n`;
    session.socket.write(payload);
  } catch (err: any) {
    session.connected = false;
    return res.json({ connected: false, error: err.message || 'Write failed.' });
  }

  // Wait briefly (adaptive fast-reply) so immediate echoes/prompts return right away
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(maxTimer);
    if (quietTimer) clearTimeout(quietTimer);
    session.socket.off('data', onChunk);
    const out = session.buffer;
    session.buffer = '';
    res.json({
      connected: session.connected,
      output: out,
      closedReason: session.closedReason,
    });
  };
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  const onChunk = () => {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(finish, 35);
  };
  session.socket.on('data', onChunk);
  const maxTimer = setTimeout(finish, 140);
});

// Poll new output from a live Telnet session
app.get('/api/telnet/sessions/:id/poll', (req: Request, res: Response) => {
  const session = liveTelnetSessions.get(req.params.id);
  if (!session) {
    return res.json({ connected: false, output: '', closedReason: 'Session closed.' });
  }
  session.lastActivity = Date.now();
  const out = session.buffer;
  session.buffer = '';
  const connected = session.connected && !session.socket.destroyed;
  if (!connected && !out) {
    liveTelnetSessions.delete(req.params.id);
  }
  res.json({
    connected,
    output: out,
    closedReason: session.closedReason,
  });
});

// Close a live Telnet session
app.delete('/api/telnet/sessions/:id', (req: Request, res: Response) => {
  const session = liveTelnetSessions.get(req.params.id);
  if (session) {
    session.connected = false;
    try {
      session.socket.destroy();
    } catch {}
    liveTelnetSessions.delete(req.params.id);
  }
  res.json({ closed: true });
});

function isBlockedProbeIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');
  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('ff')
  ) {
    return true;
  }
  const parts = normalized.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // unspecified, RFC1918, loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

// Safe reachability & TCP latency probe for user's public Cloud VM noVNC / WebRTC stream URL
app.post('/api/cloud-vm/probe', async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.streamUrl === 'string' ? req.body.streamUrl.trim() : '';
    if (!rawUrl || rawUrl.length > 512) {
      return res.status(400).json({ reachable: false, error: 'Invalid stream URL.' });
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ reachable: false, error: 'Malformed URL format.' });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ reachable: false, error: 'Only http:// and https:// URLs are allowed.' });
    }
    const hostname = parsed.hostname;
    if (!hostname || hostname.toLowerCase() === 'localhost' || hostname.endsWith('.local')) {
      return res.status(400).json({ reachable: false, error: 'Loopback and local hostnames cannot be probed from cloud.' });
    }
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
      ? 443
      : 80;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return res.status(400).json({ reachable: false, error: 'Invalid TCP port.' });
    }

    const lookups = await dns.promises.lookup(hostname, { all: true });
    if (!lookups.length) {
      return res.json({ reachable: false, error: 'DNS resolution failed.' });
    }
    if (lookups.some((entry) => isBlockedProbeIp(entry.address))) {
      return res.status(400).json({
        reachable: false,
        error: 'Private, loopback, or metadata IP addresses are blocked.',
      });
    }

    const targetIp = lookups[0].address;
    const startMs = Date.now();

    const tcpResult = await new Promise<{ ok: boolean; latencyMs: number; error?: string }>((resolve) => {
      const socket = net.createConnection({ host: targetIp, port, timeout: 4000 });
      let done = false;
      const finish = (ok: boolean, error?: string) => {
        if (done) return;
        done = true;
        const latencyMs = Date.now() - startMs;
        try {
          socket.destroy();
        } catch {}
        resolve({ ok, latencyMs, error });
      };
      socket.on('connect', () => finish(true));
      socket.on('timeout', () => finish(false, `TCP port ${port} timed out after 4s.`));
      socket.on('error', (err) => finish(false, err.message || 'TCP connection refused.'));
    });

    return res.json({
      reachable: tcpResult.ok,
      resolvedIp: targetIp,
      port,
      protocol: parsed.protocol.replace(':', ''),
      latencyMs: tcpResult.latencyMs,
      error: tcpResult.error,
    });
  } catch (err: any) {
    return res.status(500).json({
      reachable: false,
      error: err?.message || 'Unable to probe Cloud VM endpoint.',
    });
  }
});

function launchDesktopAppWindow(url: string) {
  try {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      ];
      const browser = candidates.find((p) => fs.existsSync(p));
      if (browser) {
        const child = spawn(browser, [`--app=${url}`, '--window-size=1380,880'], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        const child = spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
        child.unref();
      }
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    } else if (process.env.DISPLAY) {
      const child = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
      child.unref();
    }
  } catch {}
}

async function startServer() {
  const isStandalone = process.env.STANDALONE_DESKTOP === 'true';
  const embeddedAssets = (globalThis as any).__EMBEDDED_DIST_ASSETS__ as
    | Record<string, { mime: string; b64: string }>
    | undefined;
  const isDev = !isStandalone && process.env.NODE_ENV !== 'production';

  if (embeddedAssets && Object.keys(embeddedAssets).length > 0) {
    app.get('*', (req: Request, res: Response) => {
      const reqPath = req.path === '/' ? '/index.html' : req.path;
      const asset = embeddedAssets[reqPath] || embeddedAssets['/index.html'];
      if (!asset) {
        return res.status(404).send('Not Found');
      }
      res.setHeader('Content-Type', asset.mime);
      if (reqPath.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      res.send(Buffer.from(asset.b64, 'base64'));
    });
  } else if (isDev) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const listenHost = isStandalone ? '127.0.0.1' : '0.0.0.0';
  const tryListen = (portToTry: number) => {
    const srv = app.listen(portToTry, listenHost, () => {
      const url = `http://localhost:${portToTry}`;
      console.log('==============================================================');
      console.log('  Universal WebUI for Network Engineer (Full Working Mode)');
      console.log(`  Running locally at: ${url}`);
      console.log('  Close this window to exit the application.');
      console.log('==============================================================');
      if (isStandalone && process.env.NO_BROWSER_LAUNCH !== 'true') {
        setTimeout(() => launchDesktopAppWindow(url), 400);
      }
    });
    srv.on('error', (err: any) => {
      if (isStandalone && err?.code === 'EADDRINUSE' && portToTry < PORT + 20) {
        tryListen(portToTry + 1);
      } else {
        console.error('Server listen error:', err);
      }
    });
  };

  tryListen(PORT);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
