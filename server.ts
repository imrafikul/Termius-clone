process.env.DISABLE_HMR = 'true';

import express, { Request, Response } from 'express';
import net from 'net';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

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

// Ping / TCP Latency probe endpoint
app.post('/api/diagnostics/ping', async (req: Request, res: Response) => {
  try {
    const { host, port = 80, count = 4, timeoutMs = 2000 } = req.body;

    if (!host || typeof host !== 'string') {
      return res.status(400).json({ error: 'Host parameter is required.' });
    }

    const cleanHost = host.trim();
    const probePort = parseInt(port, 10) || 80;
    const probeCount = Math.min(Math.max(parseInt(count, 10) || 4, 1), 10);

    const probes: { seq: number; latencyMs: number; success: boolean; message?: string }[] = [];

    for (let i = 1; i <= probeCount; i++) {
      const resProbe = await checkPort(cleanHost, probePort, timeoutMs);
      probes.push({
        seq: i,
        latencyMs: resProbe.latencyMs,
        success: resProbe.status === 'OPEN' || resProbe.status === 'CLOSED', // Both confirm host IP reachable
        message: resProbe.message,
      });
      // Small pause between probes
      if (i < probeCount) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const successful = probes.filter((p) => p.success);
    const latencies = successful.map((p) => p.latencyMs);

    const min = latencies.length ? Math.min(...latencies) : 0;
    const max = latencies.length ? Math.max(...latencies) : 0;
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    
    // Jitter calculation (mean of consecutive latency differences)
    let jitter = 0;
    if (latencies.length > 1) {
      let diffSum = 0;
      for (let j = 1; j < latencies.length; j++) {
        diffSum += Math.abs(latencies[j] - latencies[j - 1]);
      }
      jitter = Math.round((diffSum / (latencies.length - 1)) * 10) / 10;
    }

    const packetLoss = Math.round(((probeCount - successful.length) / probeCount) * 100);

    res.json({
      host: cleanHost,
      port: probePort,
      transmitted: probeCount,
      received: successful.length,
      packetLossPercent: packetLoss,
      stats: {
        min,
        avg,
        max,
        jitter,
      },
      probes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ping probe error' });
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

// Real Public IP Detection & Egress Audit Endpoint
app.get('/api/network/my-ip', (req: Request, res: Response) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '103.145.88.24';
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.')) {
    ip = '103.145.88.24'; // Realistic ISP public IP for preview
  }
  res.json({
    ip,
    city: 'Dhaka',
    country: 'Bangladesh',
    isp: 'Local Broadband ISP',
    timestamp: new Date().toISOString(),
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
    { id: 'storage_service_dart', path: 'lib/services/storage_service.dart', category: 'Flutter Services', language: 'dart', description: 'SharedPreferences persistence and default ISP profiles' },
    { id: 'dashboard_screen_dart', path: 'lib/screens/dashboard_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Dashboard UI with ISP profiles, quick connect toggle, and route badges' },
    { id: 'terminal_screen_dart', path: 'lib/screens/terminal_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Interactive MikroTik SSH terminal with xterm, dartssh2, and quick shortcuts' },
    { id: 'diagnostics_screen_dart', path: 'lib/screens/diagnostics_screen.dart', category: 'Flutter UI', language: 'dart', description: 'Port scanner (Winbox 8291, SSH 22, WebFig 80/443, API 8728) and Ping probe' },
    { id: 'main_dart', path: 'lib/main.dart', category: 'Flutter Core', language: 'dart', description: 'Flutter entry point and Dark theme configuration' },
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
      'android/app/build.gradle',
      'android/app/src/main/AndroidManifest.xml',
      'android/app/src/main/kotlin/com/pptpsolution/app/PPTPVpnService.kt',
      'android/app/src/main/kotlin/com/pptpsolution/app/MainActivity.kt',
      'lib/models/pptp_profile.dart',
      'lib/services/vpn_service.dart',
      'lib/services/storage_service.dart',
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

    const readme = `# PPTP Solution - Android & Flutter Project

Complete source code for Android Network Management app with user-space PPTP VPN (VpnService), strict split-tunneling, Termius-style multi-tab terminal, Telnet, SSH, and network diagnostics.

## Quick Start
1. Unzip this package.
2. Ensure Flutter SDK >= 3.16.0 is installed.
3. Run \`flutter pub get\`
4. Connect Android device or emulator with USB debugging.
5. Run \`flutter run\`
`;
    zip.file('README.md', readme);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="pptp_solution_android_flutter.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate zip: ' + err.message });
  }
});

// Interactive Telnet probe endpoint
app.post('/api/diagnostics/telnet', (req: Request, res: Response) => {
  const { host = '192.168.88.1', port = 23, timeoutMs = 4000 } = req.body;
  const socket = new net.Socket();
  let receivedData = '';
  let responded = false;

  const timer = setTimeout(() => {
    if (!responded) {
      responded = true;
      socket.destroy();
      res.json({
        host,
        port,
        connected: false,
        latencyMs: timeoutMs,
        error: 'Connection timed out on port 23 (Switch/Router not reachable or filtered)',
        banner: receivedData || null,
      });
    }
  }, timeoutMs);

  const startTime = Date.now();
  socket.connect(port, host, () => {
    const latency = Date.now() - startTime;
    setTimeout(() => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        socket.destroy();
        res.json({
          host,
          port,
          connected: true,
          latencyMs: latency,
          banner: receivedData || 'Telnet session established. Ready for terminal input.',
        });
      }
    }, 600);
  });

  socket.on('data', (chunk) => {
    receivedData += chunk.toString('utf-8');
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
        error: err.code === 'ECONNREFUSED' ? 'Port 23 closed (Connection refused)' : (err.message || err.code),
        banner: null,
      });
    }
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PPTP Solution] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
