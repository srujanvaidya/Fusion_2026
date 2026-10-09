/**
 * Crop-stress early-warning engine (SPACE-05).
 *
 * Pipeline per parcel:
 *   1. NDVI time series for the current season (one observation every ~10 days)
 *   2. Historical baseline = per-crop phenology curve (mean) + inter-annual spread (std)
 *   3. Anomaly score  z = (ndvi_now - baseline_mean) / baseline_std
 *   4. Trend over the last 3 observations (slope per 10 days) and largest single-step drop
 *   5. Classification -> healthy | watch | warning | critical, with a likely cause
 *
 * The series is generated deterministically from the parcel id so the demo is stable.
 * When the GEE microservice returns a real `current_ndvi`, pass it as `liveNdvi` and it
 * replaces the latest observation (the anomaly logic then runs on real data).
 */

const STEP_DAYS = 10;
const N_OBS = 12; // ~120 days, one growing season window

// Peak NDVI and the day-of-season where the canopy peaks, per crop.
const CROP_PHENOLOGY = {
  sugarcane: { peak: 0.82, peakAt: 7, width: 5.5 },
  wheat:     { peak: 0.78, peakAt: 6, width: 3.5 },
  rice:      { peak: 0.80, peakAt: 7, width: 3.5 },
  cotton:    { peak: 0.72, peakAt: 7, width: 4 },
  soybean:   { peak: 0.76, peakAt: 6, width: 3.5 },
  onion:     { peak: 0.68, peakAt: 6, width: 3.5 },
  jowar:     { peak: 0.70, peakAt: 6, width: 3.5 },
  bajra:     { peak: 0.66, peakAt: 6, width: 3.5 },
  tur:       { peak: 0.70, peakAt: 7, width: 4 },
  groundnut: { peak: 0.72, peakAt: 6, width: 3.5 },
  grapes:    { peak: 0.74, peakAt: 7, width: 5 },
  tomato:    { peak: 0.70, peakAt: 6, width: 3.5 },
};
const DEFAULT_CROP = { peak: 0.74, peakAt: 6.5, width: 4 };

export const SEVERITY_ORDER = { healthy: 0, watch: 1, warning: 2, critical: 3 };

export const SEVERITY_COLOR = {
  healthy:  '#22c55e',
  watch:    '#84cc16',
  warning:  '#f59e0b',
  critical: '#ef4444',
};

/* ── tiny seeded RNG so a parcel always yields the same series ───────────── */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cropKey(crop) {
  const c = String(crop || '').toLowerCase();
  return Object.keys(CROP_PHENOLOGY).find((k) => c.includes(k)) || null;
}

export const phenologyFor = (crop) => CROP_PHENOLOGY[cropKey(crop)] || DEFAULT_CROP;
export const OBS_STEP_DAYS = STEP_DAYS;

/** Historical baseline (mean, std) at observation index i. */
export function baselineAt(crop, i) {
  const ph = CROP_PHENOLOGY[cropKey(crop)] || DEFAULT_CROP;
  const floor = 0.18;
  const g = Math.exp(-((i - ph.peakAt) ** 2) / (2 * ph.width ** 2));
  const mean = floor + (ph.peak - floor) * g;
  const std = 0.045 + 0.03 * g; // spread is larger near peak canopy
  return { mean, std };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r3 = (v) => Math.round(v * 1000) / 1000;

function dateLabel(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * Build the NDVI series for a parcel. Roughly one parcel in three gets an injected
 * stress episode (gradual drought decline or a sudden pest/disease drop) so the
 * early-warning flow has something to detect.
 */
export function buildSeries(parcel, liveNdvi = null) {
  const id = String(parcel.firestoreId || parcel.id || parcel.gutNo || parcel.gatNumber || parcel.village || 'x')
    + '|' + (parcel.crop || '');
  const rand = rng(hashStr(id));
  const roll = rand();
  const scenario = roll < 0.34 ? 'drought' : roll < 0.5 ? 'pest' : 'normal';
  const onset = N_OBS - 1 - (3 + Math.floor(rand() * 3)); // stress starts 3-5 obs before "today"

  const series = [];
  for (let i = 0; i < N_OBS; i++) {
    const { mean, std } = baselineAt(parcel.crop, i);
    let v = mean + (rand() - 0.5) * 2 * std * 0.6;
    if (i >= onset) {
      const k = i - onset + 1;
      if (scenario === 'drought') v -= 0.045 * k;           // slow, steady decline
      if (scenario === 'pest')   v -= k === 1 ? 0.03 : 0.17 + 0.02 * k; // abrupt drop
    }
    series.push({
      i,
      label: dateLabel((N_OBS - 1 - i) * STEP_DAYS),
      ndvi: r3(clamp(v, 0.05, 0.95)),
      base: r3(mean),
      low: r3(mean - 2 * std),
      high: r3(clamp(mean + 2 * std, 0, 1)),
      std,
    });
  }
  if (liveNdvi != null && !Number.isNaN(+liveNdvi)) {
    series[N_OBS - 1].ndvi = r3(clamp(+liveNdvi, 0.02, 0.95));
  }
  return { series, scenario };
}

/** Least-squares slope over the last `n` points, per observation step. */
function slope(vals) {
  const n = vals.length;
  const mx = (n - 1) / 2;
  const my = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  vals.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
}

const MSG = {
  drought: {
    en: (c) => `Gradual NDVI decline on ${c} — consistent with moisture/drought stress. Irrigate if possible and check soil moisture.`,
    mr: (c) => `${c} मध्ये NDVI हळूहळू घटत आहे — पाण्याचा ताण/दुष्काळाची लक्षणे. शक्य असल्यास सिंचन करा व जमिनीतील ओलावा तपासा.`,
  },
  pest: {
    en: (c) => `Sudden NDVI drop on ${c} — possible pest or disease outbreak. Scout the field this week and consult your krishi officer.`,
    mr: (c) => `${c} मध्ये NDVI अचानक घटला — कीड/रोगाचा प्रादुर्भाव शक्य. या आठवड्यात शेताची पाहणी करा व कृषी अधिकाऱ्यांचा सल्ला घ्या.`,
  },
  generic: {
    en: (c) => `${c} is trending below its seasonal baseline. Keep monitoring.`,
    mr: (c) => `${c} हंगामी सरासरीपेक्षा कमी दिसत आहे. निरीक्षण सुरू ठेवा.`,
  },
};

/** Analyse one parcel -> { level, z, trend, drop, cause, series, ... }. */
export function analyseParcel(parcel, opts = {}) {
  const { series, scenario } = buildSeries(parcel, opts.liveNdvi);
  const last = series[series.length - 1];
  const z = (last.ndvi - last.base) / last.std;
  const tail = series.slice(-4).map((s) => s.ndvi - s.base);
  const trend = slope(tail); // per 10 days
  let maxDrop = 0;
  // Work on anomalies (ndvi - baseline) so normal seasonal senescence is not mistaken for stress.
  const anom = (s) => s.ndvi - s.base;
  for (let i = 1; i < series.length; i++) maxDrop = Math.max(maxDrop, anom(series[i - 1]) - anom(series[i]));
  const recentDrop = anom(series[series.length - 4]) - anom(last);

  let level = 'healthy';
  if (z <= -2.5 || recentDrop >= 0.25) level = 'critical';
  else if (z <= -1.7 || recentDrop >= 0.15) level = 'warning';
  else if (z <= -1.0 || trend <= -0.03) level = 'watch';

  let cause = null;
  if (level !== 'healthy') {
    // abrupt single-step fall => pest/disease; steady decline => moisture stress
    cause = maxDrop >= 0.12 ? 'pest' : trend < -0.02 ? 'drought' : 'generic';
  }

  return {
    level,
    z: Math.round(z * 10) / 10,
    trend: r3(trend),
    recentDrop: r3(recentDrop),
    ndvi: last.ndvi,
    baseline: last.base,
    cause,
    scenario, // for debugging / demos only
    series,
  };
}

/** Analyse all parcels and return alerts sorted most-severe first. */
export function buildAlerts(parcels, opts = {}) {
  const alerts = [];
  parcels.forEach((p, idx) => {
    const a = analyseParcel(p, opts);
    if (a.level === 'healthy') return;
    const crop = p.crop ? String(p.crop).split('/')[0].trim() : 'crop';
    const plot = p.gutNo || p.gatNumber || p.gat_no || String(idx + 1);
    const where = [p.village, p.district].filter(Boolean).join(', ');
    // id is stable per parcel + level so a re-render never re-notifies
    const parcelKey = p.firestoreId || p.id || `${plot}-${p.village || ''}`;
    alerts.push({
      id: `ew-${parcelKey}-${a.level}`,
      parcelKey,
      level: a.level,
      cause: a.cause,
      plot,
      crop,
      where,
      ndvi: a.ndvi,
      baseline: a.baseline,
      z: a.z,
      recentDrop: a.recentDrop,
      message: { en: MSG[a.cause].en(crop), mr: MSG[a.cause].mr(crop) },
      analysis: a,
    });
  });
  return alerts.sort((x, y) => SEVERITY_ORDER[y.level] - SEVERITY_ORDER[x.level] || x.z - y.z);
}

/** Demo parcels used when a farmer has not registered land yet (mirrors Home's empty state). */
export const DEMO_PARCELS = [
  { id: 'demo-1', crop: 'Rice', village: 'Khadakwasla', district: 'Pune', gutNo: '1204', area: 1.8 },
  { id: 'demo-2', crop: 'Sugarcane', village: 'Baramati', district: 'Pune', gutNo: '1205', area: 2.5 },
  { id: 'demo-3', crop: 'Soybean', village: 'Garawade', district: 'Satara', gutNo: '1206', area: 3.2 },
];
