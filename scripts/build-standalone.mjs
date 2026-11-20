import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const BUILD_DIR = path.join(ROOT, 'desktop-build');
const RELEASE_DIR = path.join(ROOT, 'releases');

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(DIST_DIR)) {
  console.error('dist/ folder not found. Run npm run build first.');
  process.exit(1);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(RELEASE_DIR, { recursive: true });

const assets = {};
function walkDist(dir, relBase = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = relBase ? `${relBase}/${entry.name}` : `/${entry.name}`;
    if (entry.isDirectory()) {
      walkDist(abs, rel);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const mime = MIME_MAP[ext] || 'application/octet-stream';
      assets[rel] = {
        mime,
        b64: fs.readFileSync(abs).toString('base64'),
      };
    }
  }
}

walkDist(DIST_DIR);
console.log(`Embedded ${Object.keys(assets).length} frontend assets from dist/`);

const entryTs = `// Auto-generated standalone desktop executable entry
process.env.NODE_ENV = 'production';
process.env.STANDALONE_DESKTOP = 'true';
(globalThis as any).__EMBEDDED_DIST_ASSETS__ = ${JSON.stringify(assets)};
await import('../server.ts');
`;

const entryPath = path.join(BUILD_DIR, 'standalone-entry.ts');
fs.writeFileSync(entryPath, entryTs, 'utf-8');

const winOut = path.join(RELEASE_DIR, 'Universal-WebUI-Network-Engineer.exe');
console.log('Compiling Windows 64-bit standalone executable (.exe)...');
execSync(
  `bun build "${entryPath}" --compile --target=bun-windows-x64 --external vite --outfile "${winOut}"`,
  { stdio: 'inherit', cwd: ROOT }
);

const linuxOut = path.join(RELEASE_DIR, 'Universal-WebUI-Network-Engineer-Linux-x64');
console.log('Compiling Linux 64-bit standalone executable...');
execSync(
  `bun build "${entryPath}" --compile --target=bun-linux-x64 --external vite --outfile "${linuxOut}"`,
  { stdio: 'inherit', cwd: ROOT }
);

// Pre-compress executables with gzip so chunked in-app downloads transfer 50% less data
fs.writeFileSync(`${winOut}.gz`, zlib.gzipSync(fs.readFileSync(winOut), { level: 6 }));
fs.writeFileSync(`${linuxOut}.gz`, zlib.gzipSync(fs.readFileSync(linuxOut), { level: 6 }));

// Clean temporary generated entry file so repo stays tidy
fs.rmSync(BUILD_DIR, { recursive: true, force: true });

const winSizeMB = (fs.statSync(winOut).size / (1024 * 1024)).toFixed(1);
const winGzMB = (fs.statSync(`${winOut}.gz`).size / (1024 * 1024)).toFixed(1);
const linuxSizeMB = (fs.statSync(linuxOut).size / (1024 * 1024)).toFixed(1);
const linuxGzMB = (fs.statSync(`${linuxOut}.gz`).size / (1024 * 1024)).toFixed(1);
console.log(`SUCCESS! Built standalone executables:`);
console.log(`  - ${winOut} (${winSizeMB} MB raw / ${winGzMB} MB gz)`);
console.log(`  - ${linuxOut} (${linuxSizeMB} MB raw / ${linuxGzMB} MB gz)`);
