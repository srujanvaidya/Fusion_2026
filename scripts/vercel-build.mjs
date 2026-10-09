#!/usr/bin/env node
/**
 * Builds dashboard with Vite, then assembles `site/` for Vercel static deploy:
 *   /get-started.html, /login.html, /dashboard/dist/*, shared assets at root.
 */
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const site = join(root, 'site');
const dash = join(root, 'dashboard');
const dist = join(dash, 'dist');

rmSync(site, { recursive: true, force: true });
mkdirSync(join(site, 'dashboard', 'dist'), { recursive: true });

const rootLogo = join(root, 'logo.png');
const pubDir = join(dash, 'public');
const pubLogo = join(pubDir, 'logo.png');
if (existsSync(rootLogo)) {
  mkdirSync(pubDir, { recursive: true });
  cpSync(rootLogo, pubLogo);
}

execSync('npm run build', { cwd: dash, stdio: 'inherit' });

cpSync(dist, join(site, 'dashboard', 'dist'), { recursive: true });

const villageSrc = join(dash, 'src', 'assets', 'json', 'maharashtra_full.json');
const villageDestDir = join(site, 'dashboard', 'dist', 'assets', 'json');
if (existsSync(villageSrc)) {
  mkdirSync(villageDestDir, { recursive: true });
  cpSync(villageSrc, join(villageDestDir, 'maharashtra_full.json'));
}

const staticRootFiles = [
  'get-started.html',
  'login.html',
  'farm.jpg',
  'farmvideo.mp4',
  'map.png',
  'logo.jpg',
  'logo.png',
  'favicon.svg',
  'favicon.ico',
];
for (const f of staticRootFiles) {
  const p = join(root, f);
  if (existsSync(p)) cpSync(p, join(site, f));
}

// Marketing site at `/` — use repo `index.html` (nav "Get Started" → get-started.html)
const indexSrc = join(root, 'index.html');
if (existsSync(indexSrc)) {
  cpSync(indexSrc, join(site, 'index.html'));
} else {
  writeFileSync(
    join(site, 'index.html'),
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Guardian</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"/><link rel="icon" type="image/png" href="/logo.png"/></head><body style="font-family:system-ui;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#090C15;color:#fff"><div style="text-align:center;padding:24px"><p style="margin:0 0 16px">Guardian</p><a href="/get-started.html" style="color:#00D2FF;font-weight:600">Get started</a></div></body></html>`,
  );
}

const assetsRoot = join(root, 'assets');
if (existsSync(assetsRoot)) {
  cpSync(assetsRoot, join(site, 'assets'), { recursive: true });
}

for (const f of ['bsec.png', 'services.html', 'about.html', 'cybersecurity.html']) {
  const p = join(root, f);
  if (existsSync(p)) cpSync(p, join(site, f));
}

const sectionsSrc = join(dash, 'public', 'sections');
if (existsSync(sectionsSrc)) {
  cpSync(sectionsSrc, join(site, 'sections'), { recursive: true });
}

console.log('vercel-build: site/ ready at', site);
