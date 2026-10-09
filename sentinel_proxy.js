/**
 * Guardian Sentinel Hub Proxy
 * Handles OAuth2 client_credentials (blocked by CORS in browsers) and
 * proxies Sentinel Hub Process API calls for satellite imagery.
 * Run: node sentinel_proxy.js
 * Listens on: http://localhost:3031
 */
const express = require('express');
const fetch   = require('node-fetch');

const SH_CLIENT_ID     = 'sh-5589b58b-6e5f-4d6e-a700-a19dafa7c415';
const SH_CLIENT_SECRET = 'eZq45msQTRI6ou0xLQJraNxclGLxOn2Z';
const TOKEN_URL        = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const PROCESS_URL      = 'https://sh.dataspace.copernicus.eu/api/v1/process';
const PORT             = 3031;

const app = express();
app.use(express.json());
// Allow any origin (this runs only locally on the developer's machine)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Token cache ───────────────────────────────────────────────────────────────
let cachedToken = null, tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() / 1000 < tokenExpiry - 30) return cachedToken;
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${SH_CLIENT_ID}&client_secret=${SH_CLIENT_SECRET}`,
  });
  const d = await r.json();
  cachedToken = d.access_token;
  tokenExpiry = Date.now() / 1000 + (d.expires_in || 1800);
  console.log('Token refreshed. Expires in', d.expires_in, 's');
  return cachedToken;
}

// ── Evalscripts ───────────────────────────────────────────────────────────────
function ndviScript() {
  return `//VERSION=3
function setup() {
  return { input:[{bands:["B04","B08","dataMask"],units:"REFLECTANCE"}],
           output:[{id:"default",bands:3,sampleType:"UINT8"},{id:"dataMask",bands:1}] }
}
function evaluatePixel(s) {
  var n = (s.B08-s.B04)/(s.B08+s.B04+1e-9);
  // NDVI colormap: red(drought) → yellow(stressed) → green(healthy)
  var r,g,b;
  if      (n < 0.0)  { r=50;  g=50;  b=50; }   // no data / shadow
  else if (n < 0.15) { r=220; g=60;  b=40; }   // bare/burnt
  else if (n < 0.30) { r=210; g=180; b=50; }   // sparse veg
  else if (n < 0.45) { r=120; g=200; b=60; }   // moderate
  else               { r=30;  g=150; b=50; }   // dense/healthy
  return { default:[r,g,b], dataMask:[s.dataMask] };
}`;
}

function sarScript() {
  return `//VERSION=3
function setup() {
  return { input:[{bands:["VV","dataMask"],units:"LINEAR_POWER"}],
           output:[{id:"default",bands:3,sampleType:"UINT8"},{id:"dataMask",bands:1}] }
}
function evaluatePixel(s) {
  var db = 10*Math.log10(s.VV+1e-9);
  // normalize -25..0 dB => blue-white scale (bright=wet/flooded)
  var t = Math.min(1, Math.max(0, (db+25)/25));
  return { default:[Math.round(30+t*140), Math.round(60+t*150), Math.round(100+t*155)], dataMask:[s.dataMask] };
}`;
}

function trueColorScript() {
  return `//VERSION=3
function setup() {
  return { input:[{bands:["B04","B03","B02","dataMask"],units:"REFLECTANCE"}],
           output:[{id:"default",bands:3,sampleType:"UINT8"},{id:"dataMask",bands:1}] }
}
function evaluatePixel(s) {
  var gain = 3.5;
  return { default:[Math.round(Math.min(255, s.B04*gain*255)),
                     Math.round(Math.min(255, s.B03*gain*255)),
                     Math.round(Math.min(255, s.B02*gain*255))],
           dataMask:[s.dataMask] };
}`;
}

function getEvalscript(type) {
  if (type === 'truecolor') return trueColorScript();
  if (type === 'sar')       return sarScript();
  return ndviScript();
}

// ── Sentinel image endpoint ───────────────────────────────────────────────────
// GET /sentinel?lat=17.39&lon=74.09&timeFrom=2025-11-12&timeTo=2026-02-10&type=ndvi|truecolor|sar
app.get('/sentinel', async (req, res) => {
  const { lat, lon, timeFrom, timeTo, type = 'ndvi' } = req.query;
  if (!lat || !lon || !timeFrom || !timeTo) {
    return res.status(400).json({ error: 'lat, lon, timeFrom, timeTo required' });
  }

  const buf  = 0.01;
  const bbox = [+lon-buf, +lat-buf, +lon+buf, +lat+buf];
  const useSAR = type === 'sar';

  const body = {
    input: {
      bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{
        type: useSAR ? 'sentinel-1-grd' : 'sentinel-2-l2a',
        dataFilter: {
          timeRange: { from: `${timeFrom}T00:00:00Z`, to: `${timeTo}T23:59:59Z` },
          mosaickingOrder: 'leastCC',
        },
      }],
    },
    output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: getEvalscript(type),
  };

  try {
    const token = await getToken();
    const r = await fetch(PROCESS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('SH error', r.status, text.slice(0, 200));
      return res.status(r.status).json({ error: text });
    }

    const buf2 = await r.buffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf2);
    console.log(`[${type.toUpperCase()}] ${lat},${lon} ${timeFrom}→${timeTo} ✓`);
  } catch (e) {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

app.listen(PORT, () => {
  console.log(`\n🛰  Guardian Sentinel Proxy running on http://localhost:${PORT}`);
  console.log(`   Test: http://localhost:${PORT}/sentinel?lat=17.399&lon=74.091&timeFrom=2025-11-12&timeTo=2026-02-10&type=ndvi\n`);
});
