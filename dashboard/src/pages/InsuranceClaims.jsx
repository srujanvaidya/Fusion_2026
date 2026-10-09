import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import { useLocationData } from '../data/useLocationData';
import { DISTRICTS_BY_STATE } from '../data/locationData';
import { visibleClaims as withoutHiddenClaims } from '../data/hiddenClaims';
import GeoTagPhoto from '../components/GeoTagPhoto';
import NdviTileLayer, { NdviLegend } from '../components/NdviTileLayer';
import { getGeeAnalyzeUrl } from '../config/geeApi';
import Glyph from '../components/icons/Glyph';

const CROP_VALUES = {
  Sugarcane: 80000, Wheat: 35000, Rice: 45000, Cotton: 60000, Soybean: 42000,
  Onion: 30000, Jowar: 28000, Bajra: 25000, Tur: 50000, Groundnut: 55000,
  Maize: 32000, Gram: 48000, Sunflower: 38000, Turmeric: 70000, Ginger: 90000,
};
const CROPS = Object.keys(CROP_VALUES);
const DISASTER_TYPES = ['Drought', 'Flood', 'Hailstorm', 'Pest Attack', 'Cyclone', 'Landslide', 'Fire'];

/** If i18n bundle is stale, Marathi UI still shows correct calamity names (Firestore stays English). */
const MR_DISASTER_FALLBACK = {
  Drought: 'दुष्काळ',
  Flood: 'पूर',
  Hailstorm: 'गारपीट',
  'Pest Attack': 'कीटक व रोग',
  Cyclone: 'चक्रीवादळ',
  Landslide: 'भूस्खलन',
  Fire: 'आग',
  Healthy: 'स्वस्थ',
};

/** English codes stay in Firestore; normalize Unicode/casing so t() finds mr.js / en.js keys. */
function canonicalDisasterKey(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).normalize('NFKC').trim();
  return DISASTER_TYPES.find((d) => d.toLowerCase() === s.toLowerCase()) || s;
}

function translateDisasterType(raw, t, lang) {
  const rawNorm = String(raw ?? '').normalize('NFKC').trim();
  const key = canonicalDisasterKey(rawNorm);
  const fromCanon = t(key);
  if (fromCanon !== key) return fromCanon;
  if (lang === 'mr' && MR_DISASTER_FALLBACK[key]) return MR_DISASTER_FALLBACK[key];
  const fromRaw = t(rawNorm);
  if (fromRaw !== rawNorm) return fromRaw;
  if (lang === 'mr' && MR_DISASTER_FALLBACK[rawNorm]) return MR_DISASTER_FALLBACK[rawNorm];
  return rawNorm || key;
}

function plotNoLabel(t, lang) {
  const v = t('Plot No');
  if (v !== 'Plot No') return v;
  return lang === 'mr' ? 'प्लॉट क्र.' : 'Plot No';
}

const STATUS_CFG = {
  Pending: { color: '#d97706', bg: '#fef3c720', border: '#fde68a', labelKey: 'claim_status_pending_gp' },
  Pending_Talathi: { color: '#2563eb', bg: '#dbeafe20', border: '#93c5fd', labelKey: 'claim_status_pending_talathi' },
  Approved: { color: '#16a34a', bg: '#dcfce720', border: '#bbf7d0', labelKey: 'claim_status_approved' },
  Rejected: { color: '#dc2626', bg: '#fee2e220', border: '#fca5a5', labelKey: 'claim_status_rejected' },
  Processing: { color: '#2563eb', bg: '#dbeafe20', border: '#93c5fd', labelKey: 'claim_status_processing' },
};

function formatINR(n) {
  return '₹' + (n || 0).toLocaleString('en-IN');
}

/* ─── CSV line parser (handles quoted fields with commas) ─── */
function parseLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

/* ─── Geo-Tagged Photo Wrapper — remount `key` so farmer can capture multiple field photos ─── */
function GeoTaggedPhotoWrapper({ theme, onCapture, cameraKey }) {
  return (
    <div style={{ gridColumn: 'span 2' }}>
      <GeoTagPhoto key={cameraKey} theme={theme} parcelId={`claim-${cameraKey}`} onCapture={onCapture} />
    </div>
  );
}

/* ─── GEE Satellite View (replaces broken sentinel_proxy) ─── */
const GEE_API = getGeeAnalyzeUrl();

// Fallback coords for Maharashtra talukas / districts when no GPS is available
const DISTRICT_COORDS = {
  // Talukas
  'Karad': [17.29, 74.18], 'Satara': [17.68, 74.00], 'Wai': [17.95, 73.90],
  'Patan': [17.37, 73.86], 'Koregaon': [17.67, 74.16], 'Khandala': [17.85, 74.32],
  'Jaoli': [17.80, 73.75], 'Mahabaleshwar': [17.92, 73.68], 'Man': [17.50, 74.50],
  'Khatav': [17.55, 74.62], 'Jawali': [17.90, 73.80],
  // Districts (fallback)
  'Pune': [18.52, 73.86], 'Kolhapur': [16.70, 74.24], 'Solapur': [17.68, 75.90],
  'Nashik': [20.00, 73.79], 'Aurangabad': [19.88, 75.34], 'Nagpur': [21.15, 79.09],
  'Ahmednagar': [19.09, 74.74], 'Latur': [18.40, 76.56], 'Osmanabad': [18.17, 76.04],
};

function getFallbackCoords(claim) {
  const t = claim.taluka || '';
  const d = claim.district || '';
  return DISTRICT_COORDS[t] || DISTRICT_COORDS[d] || [17.68, 74.00]; // default: Satara
}

const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
/**
 * Esri World Imagery — rural India often has no tiles above ~19; higher zoom shows “Map data not available”.
 */
const ESRI_IMAGERY_MAX_ZOOM = 19;
/** Geo-tagged photo strip: conservative zoom so imagery always resolves. */
const ESRI_FIELD_PHOTO_ZOOM = 18;

/** MODIS GIBS — tighter framing on the GPS pin without empty over-zoom tiles. */
function gibsMaxZoomForNative(nativeMax) {
  return Math.min(12, nativeMax + 3);
}

/** All geo-tagged images for a claim (supports legacy single `geoPhoto`). */
function claimGeoPhotos(claim) {
  if (Array.isArray(claim?.geoPhotos) && claim.geoPhotos.length) return claim.geoPhotos.filter((p) => p && (p.url || p.lat != null));
  if (claim?.geoPhoto && (claim.geoPhoto.url || (claim.geoPhoto.lat != null && claim.geoPhoto.lng != null))) return [claim.geoPhoto];
  return [];
}

/** Tight satellite view at capture GPS — GP / farmer verification (no extra zoom needed). */
function PhotoVerifyMap({ lat, lng, theme, height = 300, describeAerial = false }) {
  const { t } = useLang();
  if (lat == null || lng == null || Number.isNaN(+lat) || Number.isNaN(+lng)) return null;
  const center = [+lat, +lng];
  return (
    <div>
      {describeAerial && (
        <div style={{ fontSize: 11, color: theme.textDim, marginBottom: 8, lineHeight: 1.4 }}>
          {t('claim_map_aerial_caption')}
        </div>
      )}
      <div style={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid ${theme.border}`, height, boxShadow: theme.shadow }}>
        <MapContainer
          center={center}
          zoom={ESRI_FIELD_PHOTO_ZOOM}
          maxZoom={ESRI_IMAGERY_MAX_ZOOM}
          minZoom={3}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={false}
          doubleClickZoom={false}
          attributionControl={false}
        >
          <TileLayer url={SAT_URL} maxZoom={ESRI_IMAGERY_MAX_ZOOM} maxNativeZoom={ESRI_IMAGERY_MAX_ZOOM} />
          <CircleMarker
            center={center}
            radius={10}
            pathOptions={{ color: '#22c55e', fillColor: '#4ade80', fillOpacity: 0.9, weight: 2 }}
          />
        </MapContainer>
      </div>
    </div>
  );
}

const NASA_URL = (layer, date) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;

const fmtDate = (d) => d.toISOString().split('T')[0];

/**
 * NASA GIBS MODIS tiles often return empty/black for the current calendar day
 * (processing lag). Use recent published composite dates instead.
 */
const GIBS_MODIS_LAG_DAYS = 21;
function gibsDateDaysAgo(days) {
  return fmtDate(new Date(Date.now() - days * 86400000));
}
const GIBS_RECENT_MODIS = gibsDateDaysAgo(GIBS_MODIS_LAG_DAYS);
const GIBS_REF_MODIS = gibsDateDaysAgo(190);

const GIBS_LAYERS = {
  ndvi8: 'MODIS_Terra_NDVI_8Day',
  lstDay: 'MODIS_Terra_Land_Surface_Temp_Day',
};

/** Esri World Imagery tile layer — real satellite photos. */
function EsriSatTiles() {
  return (
    <TileLayer
      attribution="Esri World Imagery"
      url={SAT_URL}
      maxZoom={ESRI_IMAGERY_MAX_ZOOM}
      maxNativeZoom={ESRI_IMAGERY_MAX_ZOOM}
    />
  );
}

/** NASA GIBS WMTS only — raw scientific product, no CSS filters. */
function GibsScienceTiles({ gibsUrl, nativeMax = 8 }) {
  return (
    <TileLayer
      attribution="NASA GIBS"
      url={gibsUrl}
      maxZoom={19}
      maxNativeZoom={nativeMax}
      minZoom={2}
    />
  );
}

/**
 * Dual field panel: LEFT = Esri satellite (real aerial), RIGHT = NASA GIBS science tile.
 * No header bars — both use absolute-positioned overlay badges inside the map.
 * MODIS NDVI_8Day nativeMax MUST be 8 (tiles only exist up to zoom 8; requesting 9+ → black).
 */
function ScienceTwinFieldPanel({ lat, lng, sciLayer, sciDate, sciNativeMax = 9, theme, t }) {
  const center = [+lat, +lng];
  // Both panels should zoom to the field-level pinpoint
  const esriZ = 14;
  const sciZ  = 14;
  const sciUrl = NASA_URL(sciLayer, sciDate);
  const layerLabel = sciLayer === GIBS_LAYERS.ndvi8 ? 'NDVI · Vegetation' : 'LST · Thermal';
  const sciColor   = sciLayer === GIBS_LAYERS.ndvi8 ? '#4ade80' : '#fb923c';

  const panelBox = {
    position: 'relative', borderRadius: 12, overflow: 'hidden',
    border: `1px solid ${theme.border}`, background: '#050508', minHeight: 280,
  };
  const mapStyle = { width: '100%', height: '100%', minHeight: 280, background: '#0f172a' };

  // Overlay label — top-left corner, no separate header bar
  const overlay = (label, color, sub) => (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 2,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.82)', borderRadius: 6, padding: '4px 10px',
        fontSize: 10, fontWeight: 800, color,
        letterSpacing: '0.08em', border: `1px solid ${color}33`,
        textTransform: 'uppercase', backdropFilter: 'blur(4px)',
      }}>{label}</div>
      {sub && (
        <div style={{
          background: 'rgba(0,0,0,0.65)', borderRadius: 4, padding: '2px 8px',
          fontSize: 8, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace',
          backdropFilter: 'blur(4px)',
        }}>{sub}</div>
      )}
    </div>
  );

  const footer = (text) => (
    <div style={{
      position: 'absolute', bottom: 5, left: 8, right: 8, zIndex: 1000, pointerEvents: 'none',
      fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: 'monospace',
    }}>{text}</div>
  );

  const pin = { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9, weight: 2.5 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* LEFT: Real satellite (Esri World Imagery) — no header bar */}
      <div style={panelBox}>
        {overlay('Real Satellite', '#93c5fd', 'Esri World Imagery')}
        <MapContainer center={center} zoom={esriZ} maxZoom={ESRI_IMAGERY_MAX_ZOOM} minZoom={3}
          style={mapStyle} scrollWheelZoom zoomControl={false} dragging doubleClickZoom attributionControl={false}>
          <EsriSatTiles />
          <CircleMarker center={center} radius={8} pathOptions={pin} />
        </MapContainer>
        {footer('© Esri · True colour satellite')}
      </div>

      {/* RIGHT: NDVI rendering of the same imagery (NDVI palette, not a CSS hue filter) */}
      <div style={panelBox}>
        {overlay(`${layerLabel}`, sciColor, sciLayer === GIBS_LAYERS.ndvi8 ? 'NDVI colour map' : 'Thermal')}
        <MapContainer center={center} zoom={sciZ} maxZoom={19} minZoom={2}
          style={mapStyle}
          scrollWheelZoom zoomControl={false} dragging doubleClickZoom attributionControl={false}>
          {sciLayer === GIBS_LAYERS.ndvi8 ? <NdviTileLayer /> : <EsriSatTiles />}
          <CircleMarker center={center} radius={8} pathOptions={pin} />
        </MapContainer>
        {sciLayer === GIBS_LAYERS.ndvi8 && <NdviLegend style={{ bottom: 22 }} />}
        {footer('Visible-band NDVI proxy (NGRDI) · Esri imagery')}
      </div>
    </div>
  );
}

/**
 * Officer twin maps: LEFT = Esri satellite (real aerial), RIGHT = NASA GIBS NDVI (science product).
 * No CSS filters on either panel — both use the provider's own tile rendering.
 */
function OfficerScienceTwinMaps({ lat, lng, theme, t }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <ScienceTwinFieldPanel
        lat={lat}
        lng={lng}
        sciLayer={GIBS_LAYERS.ndvi8}
        sciDate={GIBS_RECENT_MODIS}
        sciNativeMax={8}
        theme={theme}
        t={t}
      />
      <div style={{ fontSize: 10, color: theme.textMuted, lineHeight: 1.55, padding: '8px 2px 0' }}>
        {t('claim_map_science_footnote')}
      </div>
    </div>
  );
}

/* GEE metrics + real satellite / NASA MODIS science maps (no CSS filter tricks). */
function SatelliteView({ theme, lat, lng, gatNo, verifyZoom = false }) {
  const { t, lang } = useLang();
  const [geeData, setGeeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gatNo) return;
    if (!GEE_API) {
      setLoading(false);
      setError('GEE URL not set');
      return;
    }
    setLoading(true); setError(''); setGeeData(null);
    fetch(GEE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gat_no: String(gatNo) }) })
      .then(r => r.json()).then(setGeeData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [gatNo]);

  if (!lat || !lng) return null;
  return (
    <div style={{ gridColumn: 'span 2', background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: theme.text }}>{t('claim_field_analysis_title')}</div>
        {loading && <span style={{ fontSize: 10, color: '#f59e0b' }}>{t('claim_gee_loading')}</span>}
        {!loading && geeData && (
          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>
            GEE: NDVI {geeData.current_ndvi?.toFixed(3)} · {translateDisasterType(geeData.status, t, lang)}
          </span>
        )}
        {!loading && error && <span style={{ fontSize: 10, color: '#ef4444' }}>{t('claim_gee_offline_modis')}</span>}
      </div>
      <div style={{ fontSize: 11, color: theme.textDim, marginBottom: '12px', lineHeight: 1.45 }}>
        {t('claim_field_analysis_sub')}
      </div>
      {/* LEFT = real satellite · RIGHT = NASA NDVI science tiles (no CSS filter) */}
      <ScienceTwinFieldPanel
        lat={lat}
        lng={lng}
        sciLayer={GIBS_LAYERS.ndvi8}
        sciDate={GIBS_RECENT_MODIS}
        sciNativeMax={8}
        theme={theme}
        t={t}
      />
      <div style={{ marginTop: 10, fontSize: 10, color: theme.textMuted, lineHeight: 1.5 }}>
         {lat?.toFixed(4)}, {lng?.toFixed(4)} · {t('claim_farmer_map_footer')}
      </div>
    </div>
  );
}

function fmtClaimDate(ts, lang) {
  if (!ts?.seconds) return null;
  return new Date(ts.seconds * 1000).toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Four-step progress: Submitted -> Gram Panchayat -> Talathi -> Decision. */
function ClaimTimeline({ status, theme, lang }) {
  const mr = lang === 'mr';
  const steps = [mr ? 'दाखल' : 'Submitted', mr ? 'ग्रामपंचायत' : 'Gram Panchayat', mr ? 'तलाठी' : 'Talathi', mr ? 'निर्णय' : 'Decision'];
  const done = status === 'Approved' || status === 'Rejected' ? 4 : status === 'Pending_Talathi' || status === 'Processing' ? 2 : 1;
  const rejected = status === 'Rejected';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', margin: '4px 0 22px' }}>
      {steps.map((label, i) => {
        const complete = i < done;
        const current = i === done && !rejected && done < 4;
        const isLast = i === steps.length - 1;
        const color = rejected && isLast ? '#dc2626' : complete ? '#16a34a' : current ? theme.accent : theme.border;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 64, flexShrink: 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: complete || (rejected && isLast) ? color : 'transparent', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: current ? `0 0 0 4px ${theme.accentBg}` : 'none', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                {rejected && isLast ? '✕' : complete ? '✓' : ''}
              </div>
              <div style={{ fontSize: 10, marginTop: 6, textAlign: 'center', color: complete || current ? theme.text : theme.textMuted, fontWeight: complete || current ? 600 : 400, lineHeight: 1.3 }}>{label}</div>
            </div>
            {!isLast && <div style={{ flex: 1, height: 2, marginTop: 10, background: i < done - 1 ? '#16a34a' : theme.border, borderRadius: 2 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ClaimCard({ claim, theme, defaultOpen = false }) {
  const { t, lang } = useLang();
  const mr = lang === 'mr';
  const [open, setOpen] = useState(defaultOpen);
  const cfg = STATUS_CFG[claim.status] || STATUS_CFG.Pending;
  const photos = claimGeoPhotos(claim);
  const fallback = getFallbackCoords(claim);
  const lat = photos[0]?.lat ?? fallback[0];
  const lng = photos[0]?.lng ?? fallback[1];
  const cropName = String(claim.crop || '').split('/')[0].trim();
  const isNew = defaultOpen;
  const submitted = fmtClaimDate(claim.createdAt, lang) || (mr ? 'आत्ताच' : 'Just now');

  const details = [
    [mr ? 'दावा क्र.' : 'Claim ID', `#${(claim.id || '').slice(-6).toUpperCase()}`],
    [mr ? 'दाखल दिनांक' : 'Submitted', submitted],
    [mr ? 'नुकसान दिनांक' : 'Damage date', claim.damageDate || '-'],
    [mr ? 'शेतकरी' : 'Farmer', claim.farmerName || '-'],
    [mr ? 'नोंदणीकृत मालक' : 'Registered owner', claim.officialOwner || '-'],
    [mr ? 'पीक' : 'Crop', cropName ? t(claim.crop) : '-'],
    [mr ? 'गट क्र.' : 'Plot No', claim.gatNumber || '-'],
    [mr ? 'गाव' : 'Village', claim.village ? t(claim.village) : '-'],
    [mr ? 'तालुका' : 'Taluka', claim.taluka || '-'],
    [mr ? 'जिल्हा' : 'District', claim.district ? t(claim.district) : '-'],
    [mr ? 'बाधित क्षेत्र' : 'Affected area', `${claim.area || 0} ha`],
    [mr ? 'पीक मूल्य/हे.' : 'Crop value/ha', formatINR(CROP_VALUES[claim.crop] || 40000)],
  ];

  return (
    <div style={{ background: theme.card, border: `1px solid ${isNew ? theme.accentBorder : theme.border}`, borderRadius: 22, overflow: 'hidden', boxShadow: isNew ? `0 0 0 4px ${theme.accentBg}, ${theme.shadow}` : theme.shadow, transition: 'box-shadow .3s ease, border-color .3s ease' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px' }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: `${cfg.color}1f`, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Glyph name={claim.status === 'Approved' ? 'shield' : claim.status === 'Rejected' ? 'alert' : 'clock'} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>{translateDisasterType(claim.disasterType, t, lang)} <span style={{ color: theme.textMuted, fontWeight: 400 }}>· {plotNoLabel(t, lang)} {claim.gatNumber}</span></div>
          <div style={{ fontSize: 12, color: theme.textDim, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {cropName} · {claim.village ? t(claim.village) : ''}{claim.district ? `, ${t(claim.district)}` : ''} · {submitted}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>{formatINR(claim.estimatedLoss)}</div>
          <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700, letterSpacing: '.04em', background: `${cfg.color}1f`, color: cfg.color }}>
            {(t(cfg.labelKey) || (claim.status || 'PENDING')).toString().toUpperCase().replace('_', ' ')}
          </span>
        </div>
        <span style={{ color: theme.textMuted, fontSize: 12, transition: 'transform .25s ease', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '22px 22px 24px', animation: 'claimIn .25s ease' }}>
          <ClaimTimeline status={claim.status} theme={theme} lang={lang} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px 20px', marginBottom: 22 }}>
            {details.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>{k}</div>
                <div style={{ fontSize: 14, color: theme.text, fontWeight: 500, wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <div style={{ flex: '1 1 180px', padding: '16px 18px', borderRadius: 16, background: theme.accentBg, border: `1px solid ${theme.accentBorder}` }}>
              <div style={{ fontSize: 10, color: theme.textDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>{mr ? 'अंदाजित नुकसान' : 'Estimated loss'}</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: theme.text }}>{formatINR(claim.estimatedLoss)}</div>
            </div>
            <div style={{ flex: '1 1 180px', padding: '16px 18px', borderRadius: 16, background: claim.pmfbyEligible ? 'rgba(34,197,94,0.1)' : theme.cardAlt, border: `1px solid ${claim.pmfbyEligible ? 'rgba(34,197,94,0.3)' : theme.border}` }}>
              <div style={{ fontSize: 10, color: theme.textDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>PMFBY</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: claim.pmfbyEligible ? '#16a34a' : theme.textDim }}>{claim.pmfbyEligible ? (mr ? 'पात्र' : 'Eligible') : (mr ? 'पात्र नाही' : 'Not eligible')}</div>
              {claim.pmfbyEligible && <a href="https://pmfby.gov.in" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: theme.text, textDecorationLine: 'underline' }}>pmfby.gov.in</a>}
            </div>
          </div>

          {claim.description && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>{mr ? 'वर्णन' : 'Description'}</div>
              <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.6, padding: '14px 16px', borderRadius: 14, background: theme.cardAlt, border: `1px solid ${theme.border}`, whiteSpace: 'pre-wrap' }}>{claim.description}</div>
            </div>
          )}

          <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>
            {mr ? 'उपग्रह व NDVI दृश्य' : 'Satellite and NDVI view'}{photos.length ? '' : (mr ? ' (अंदाजे स्थान)' : ' (approximate location)')}
          </div>
          <div style={{ marginBottom: photos.length ? 14 : 0 }}>
            <ScienceTwinFieldPanel lat={lat} lng={lng} sciLayer={GIBS_LAYERS.ndvi8} sciDate={GIBS_RECENT_MODIS} theme={theme} t={t} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: photos.length ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: 12 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${theme.border}`, background: theme.cardAlt }}>
                {p.url && <img src={p.url} alt={`Geo-tagged photo ${i + 1}`} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />}
                <div style={{ padding: '10px 12px', fontSize: 11, color: theme.textDim, lineHeight: 1.6 }}>
                  {p.lat != null && <div>{Number(p.lat).toFixed(5)}, {Number(p.lng).toFixed(5)} · ±{Math.round(p.accuracy || 0)}m</div>}
                  {p.timestamp && <div>{new Date(p.timestamp).toLocaleString(mr ? 'mr-IN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes claimIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function GPReviewCard({ claim, theme, onStatusChange, role }) {
  const { t, lang } = useLang();
  const cfg = STATUS_CFG[claim.status] || STATUS_CFG.Pending;
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState('');
  const [geeResult, setGeeResult] = useState(null);
  const [satLoading, setSatLoading] = useState(false);
  const [satError, setSatError] = useState('');

  const photos = claimGeoPhotos(claim);
  const photoLat = photos[0]?.lat;
  const photoLng = photos[0]?.lng;
  // Priority: geo-tagged photo → GEE polygon centroid → taluka/district fallback
  const fallback = getFallbackCoords(claim);
  const lat = photoLat ?? geeResult?.lat ?? fallback[0];
  const lng = photoLng ?? geeResult?.lon ?? fallback[1];
  const coordSource = photoLat ? 'GPS Photo' : geeResult?.lat ? 'GEE Centroid' : 'Taluka Approx';

  // Fetch live GEE data when expanded
  useEffect(() => {
    if (!expanded || !claim.gatNumber) return;
    if (!GEE_API) {
      setSatLoading(false);
      setSatError('GEE URL not set');
      return;
    }
    setSatLoading(true); setSatError(''); setGeeResult(null);
    fetch(GEE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gat_no: String(claim.gatNumber) }) })
      .then(r => r.json()).then(setGeeResult).catch(e => setSatError(e.message)).finally(() => setSatLoading(false));
  }, [expanded, claim.gatNumber]);

  const handleAction = async (newStatus) => {
    setUpdating(newStatus);
    try {
      await updateDoc(doc(db, 'claims', claim.id), {
        status: newStatus,
        reviewedAt: serverTimestamp(),
      });
      onStatusChange?.(claim.id, newStatus);
    } catch (e) { console.error('Update failed', e); }
    finally { setUpdating(''); }
  };

  const lbl = { fontSize: '9px', color: theme.textMuted, letterSpacing: '.06em', fontWeight: 700, marginBottom: '3px' };
  const val = { fontSize: '13px', color: theme.text, fontWeight: 600 };
  const geeStatusCanon = geeResult ? canonicalDisasterKey(geeResult.status) : '';

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '14px', overflow: 'hidden', boxShadow: theme.shadow }}>
      {/* Compact header — always visible */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', transition: 'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background = theme.cardAlt}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
          {claim.status === 'Approved' ? '✓' : claim.status === 'Rejected' ? '✕' : '⏳'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>{translateDisasterType(claim.disasterType, t, lang)} — {plotNoLabel(t, lang)} {claim.gatNumber}</div>
          <div style={{ fontSize: '11px', color: theme.textDim, marginTop: '2px' }}>
             {claim.farmerName || 'Unknown'} · {t(claim.village)}, {t(claim.district)} · {t(claim.crop)} · {formatINR(claim.estimatedLoss)}
          </div>
        </div>
        <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
          {t(cfg.labelKey) || (claim.status || 'PENDING').toUpperCase().replace('_', ' ')}
        </span>
        <span style={{ fontSize: '16px', color: theme.textDim, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '18px' }}>
          {/* Farmer details grid */}
          <div style={{ fontSize: '12px', color: theme.textMuted, letterSpacing: '.08em', fontWeight: 700, marginBottom: '12px' }}> FARMER & CLAIM DETAILS</div>
          <div className="sc-claims-kv-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px', background: theme.cardAlt, borderRadius: '10px', padding: '14px' }}>
            {[
              ['FARMER NAME', claim.farmerName || '—'],
              ['EMAIL', claim.farmerEmail || '—'],
              ['PLOT NO', claim.gatNumber || '—'],
              ['VILLAGE', claim.village || '—'],
              ['DISTRICT', claim.district || '—'],
              ['TALUKA', claim.taluka || '—'],
              ['CROP', claim.crop || '—'],
              ['AREA', `${claim.area || 0} ha`],
              ['DISASTER', claim.disasterType ? translateDisasterType(claim.disasterType, t, lang) : '—'],
              ['DAMAGE DATE', claim.damageDate || '—'],
              ['EST. LOSS', formatINR(claim.estimatedLoss)],
              ['PMFBY', claim.pmfbyEligible ? '✓ Eligible' : '✕ Not eligible'],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={lbl}>{k}</div>
                <div style={{ ...val, fontSize: '12px', color: k === 'EST. LOSS' ? '#d97706' : theme.text }}>{v}</div>
              </div>
            ))}
          </div>
          {claim.description && (
            <div style={{ marginBottom: '18px', background: theme.cardAlt, borderRadius: '10px', padding: '12px', fontSize: '13px', color: theme.text, lineHeight: 1.5, border: `1px solid ${theme.border}` }}>
              <div style={lbl}>DESCRIPTION</div>
              {claim.description}
            </div>
          )}

          {/* Geo-tagged photos (all angles) + satellite at capture GPS */}
          {photos.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: theme.textMuted, letterSpacing: '.08em', fontWeight: 700, marginBottom: '10px' }}> GEO-TAGGED FARM PHOTOS</div>
              {photos.map((p, idx) => (
                <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: idx < photos.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                  {p.lat != null && p.lng != null && (
                    <>
                      <div style={{ fontSize: '11px', color: theme.textDim, marginBottom: '6px' }}>{t('claim_photo_n', { n: String(idx + 1) })} — {t('claim_sat_zoom_hint')}</div>
                      <PhotoVerifyMap lat={p.lat} lng={p.lng} theme={theme} height={300} />
                    </>
                  )}
                  {p.url ? (
                    <img src={p.url} alt={`Geo ${idx + 1}`} style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', display: 'block', marginTop: '10px', borderRadius: '10px', border: `1px solid ${theme.border}` }} />
                  ) : (
                    <div style={{ background: theme.cardAlt, borderRadius: '10px', padding: '16px', textAlign: 'center', border: `1px solid ${theme.border}`, marginTop: '10px', fontSize: '12px', color: theme.textDim }}> Photo not uploaded</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '8px' }}>
                    {[
                      ['LAT', p.lat?.toFixed(6)],
                      ['LNG', p.lng?.toFixed(6)],
                      ['ACC', `±${Math.round(p.accuracy || 0)}m`],
                      ['TIME', p.timestamp ? new Date(p.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: theme.cardAlt, borderRadius: '8px', padding: '6px 8px', border: `1px solid ${theme.border}` }}>
                        <div style={{ fontSize: '8px', color: theme.textMuted, fontWeight: 700, letterSpacing: '.05em' }}>{k}</div>
                        <div style={{ fontSize: '11px', color: theme.text, fontWeight: 700, fontFamily: 'monospace' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Remote sensing — NASA MODIS NDVI (scientific), not Esri before/after */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: theme.textMuted, letterSpacing: '.08em', fontWeight: 700 }}>{t('claim_officer_rs_title')}</span>
              {satLoading && <span style={{ fontSize: 10, color: '#f59e0b' }}>Querying Earth Engine...</span>}
              {!satLoading && geeResult && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: geeStatusCanon === 'Flood' ? 'rgba(37,99,235,0.15)' : geeStatusCanon === 'Drought' ? 'rgba(217,119,6,0.15)' : 'rgba(22,163,74,0.15)', color: geeStatusCanon === 'Flood' ? '#2563eb' : geeStatusCanon === 'Drought' ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                  GEE: {translateDisasterType(geeResult.status, t, lang)} · NDVI {geeResult.current_ndvi?.toFixed(3)} · SAR {geeResult.current_sar?.toFixed(1)} dB
                </span>
              )}
              {!satLoading && satError && <span style={{ fontSize: 10, color: '#ef4444' }}>GEE offline — MODIS maps below still load from NASA GIBS</span>}
            </div>
            <style>{`@keyframes satSpin{to{transform:rotate(360deg)}}`}</style>
            {satLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px', background: '#0a0a0a', borderRadius: 10 }}>
                <div style={{ width: 20, height: 20, border: '2px solid #222', borderTop: '2px solid #22c55e', borderRadius: '50%', animation: 'satSpin .8s linear infinite' }} />
                <span style={{ fontSize: 11, color: '#555' }}>Fetching live data from Google Earth Engine...</span>
              </div>
            )}
            {lat && lng ? (
              <OfficerScienceTwinMaps lat={lat} lng={lng} theme={theme} t={t} />
            ) : (
              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 10, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 12, color: '#444' }}>{satLoading ? 'Fetching parcel coordinates from GEE...' : 'No GPS coordinates — enter a valid Plot No to load map'}</span>
              </div>
            )}
            {geeResult && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[['NDVI', geeResult.current_ndvi?.toFixed(3), geeResult.current_ndvi > 0.5 ? '#16a34a' : geeResult.current_ndvi > 0.25 ? '#d97706' : '#dc2626'], ['SAR VV', geeResult.current_sar?.toFixed(1) + ' dB', geeResult.current_sar < -18 ? '#2563eb' : '#888'], ['GEE STATUS', translateDisasterType(geeResult.status, t, lang), geeStatusCanon === 'Flood' ? '#2563eb' : geeStatusCanon === 'Drought' ? '#d97706' : '#16a34a'], ['CONFIDENCE', Math.round((geeResult.confidence || 0) * 100) + '%', '#aaa']].map(([k, v, c]) => (
                  <div key={k} style={{ background: theme.cardAlt, borderRadius: 8, padding: '8px 10px', border: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700, marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 10, color: theme.textMuted }}>
              {t('claim_officer_rs_sources')} ·  {lat.toFixed(4)}°N {lng.toFixed(4)}°E · <span style={{ color: '#555' }}>{coordSource}</span>
            </div>
          </div>

          {/* Approve / Reject actions */}
          {/* Approve / Reject actions */}
          {((role === 'gram_panchayat' && claim.status === 'Pending') ||
            (role === 'talathi' && claim.status === 'Pending_Talathi')) && (
              <div style={{ display: 'flex', gap: '10px', paddingTop: '14px', borderTop: `1px solid ${theme.border}` }}>
                <button onClick={() => handleAction(role === 'gram_panchayat' ? 'Pending_Talathi' : 'Approved')} disabled={!!updating}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', cursor: updating ? 'not-allowed' : 'pointer', background: '#16a34a', color: '#fff', border: 'none', opacity: updating ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {updating ? '⏳ Processing…' : '✓ Approve Claim'}
                </button>
                <button onClick={() => handleAction('Rejected')} disabled={!!updating}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', cursor: updating ? 'not-allowed' : 'pointer', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', opacity: updating ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {updating === 'Rejected' ? '⏳ Rejecting…' : '✕ Reject Claim'}
                </button>
              </div>
            )}
          {((role === 'gram_panchayat' && claim.status !== 'Pending') ||
            (role === 'talathi' && claim.status !== 'Pending_Talathi')) && (
              <div style={{ paddingTop: '14px', borderTop: `1px solid ${theme.border}`, fontSize: '12px', color: cfg.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {claim.status === 'Approved' ? '✓' : claim.status === 'Rejected' ? '✕' : '⏳'} {t('claim_status_label')}: {t(cfg.labelKey) || claim.status.replace('_', ' ')}
                {claim.reviewedAt?.seconds && <span style={{ color: theme.textDim, fontWeight: 400 }}> · {new Date(claim.reviewedAt.seconds * 1000).toLocaleString('en-IN')}</span>}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default function InsuranceClaims({ user, profile }) {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const role = profile?.role || 'farmer';
  const isOfficer = role === 'gram_panchayat' || role === 'talathi';

  const [claims, setClaims] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [newClaimId, setNewClaimId] = useState('');
  const listRef = React.useRef(null);
  const [photoList, setPhotoList] = useState([]);
  const [geoCameraKey, setGeoCameraKey] = useState(0);

  const [selectedParcelId, setSelectedParcelId] = useState('');
  const [crop, setCrop] = useState('');
  const [disasterType, setDisasterType] = useState('Drought');
  const [damageDate, setDamageDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const [manualDist, setManualDist] = useState('Satara');
  const [manualTaluka, setManualTaluka] = useState('');
  const [manualVillage, setManualVillage] = useState('');
  const [manualGat, setManualGat] = useState('');

  // JSON-backed dropdowns from /json/ files via useLocationData hook
  const { talukasList: jsonTalukas, villagesList: jsonVillages, loading: locLoading } = useLocationData(manualDist, manualTaluka);
  const districtList = DISTRICTS_BY_STATE['Maharashtra'] || [];

  const [officialOwner, setOfficialOwner] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvContent, setCsvContent] = useState(null);

  const inp = {
    width: '100%', padding: '13px 14px', background: theme.inputBg,
    border: `1px solid ${theme.inputBorder}`, borderRadius: '14px',
    color: theme.text, fontSize: '15px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box', appearance: 'none', transition: 'border-color .2s, box-shadow .2s',
  };

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db, 'parcels'), where('uid', '==', user.uid)), snap => setParcels(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => { });
    // GP and Talathi see ALL claims; farmers see only their own
    const isOfficer = role === 'gram_panchayat' || role === 'talathi';
    const claimQuery = isOfficer
      ? query(collection(db, 'claims'))
      : query(collection(db, 'claims'), where('uid', '==', user.uid));
    const u2 = onSnapshot(claimQuery, snap => setClaims(withoutHiddenClaims(snap.docs.map(d => ({ id: d.id, ...d.data() }))).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => { });
    return () => { u1(); u2(); };
  }, [user, role]);

  const selectedParcel = parcels.find(p => p.id === selectedParcelId);

  // CSV owner lookup — searches land_satara.csv for official owner
  useEffect(() => {
    const tTarget = manualTaluka.trim();
    const vTarget = manualVillage.trim();
    const gTarget = manualGat.trim();

    if (!tTarget || !vTarget || !gTarget) {
      setOfficialOwner('');
      return;
    }

    const isSatara = manualDist === 'Satara';
    if (!isSatara) {
      setOfficialOwner('केवळ सातारा जिल्ह्यासाठी नोंदी उपलब्ध (Records only for Satara)');
      return;
    }

    const searchInCsv = (content) => {
      const lines = content.split('\n');
      const tMap = { 'Karad': 'कह्राड', 'कराड': 'कह्राड' };
      const normalizedTaluka = tMap[tTarget] || tTarget;
      setOfficialOwner('Searching...');

      const match = lines.find(line => {
        if (!line || line.length < 10) return false;
        if (!line.includes(gTarget)) return false;
        const p = parseLine(line);
        if (p.length < 4) return false;
        const csvTaluka = p[1].trim();
        const csvVillage = p[2].trim();
        const csvGat = p[3].trim();
        return (csvTaluka === normalizedTaluka || csvTaluka.includes(normalizedTaluka) || normalizedTaluka.includes(csvTaluka)) &&
          (csvVillage === vTarget || csvVillage.includes(vTarget) || vTarget.includes(csvVillage)) &&
          (csvGat === gTarget);
      });

      if (match) {
        const p = parseLine(match);
        const owner = p[4]?.replace(/^"|"$/g, '').trim();
        setOfficialOwner(owner || 'Owner name empty');
      } else {
        setOfficialOwner('नोंदीमध्ये आढळले नाही (Not in records)');
      }
    };

    if (csvContent) {
      searchInCsv(csvContent);
    } else {
      setCsvLoading(true);
      fetch(`${import.meta.env.BASE_URL}data/land_satara.csv`)
        .then(res => res.text())
        .then(text => { setCsvContent(text); searchInCsv(text); })
        .catch(err => { console.error('CSV Error:', err); setOfficialOwner('Error loading records'); })
        .finally(() => setCsvLoading(false));
    }
  }, [manualDist, manualTaluka, manualVillage, manualGat, csvContent]);

  const activeCrop = crop || selectedParcel?.crop || '';
  const cropValue = CROP_VALUES[activeCrop] || 40000;
  const areaVal = parseFloat(selectedParcel?.area) || 1;
  const estimatedLoss = Math.round(areaVal * cropValue * 0.4);
  const canSubmit = !!(manualDist && manualTaluka && manualVillage && manualGat && activeCrop);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const missing = [
      !manualDist && 'District', !manualTaluka && 'Taluka', !manualVillage && 'Village',
      !String(manualGat).trim() && 'Plot No', !activeCrop && 'Crop type',
    ].filter(Boolean);
    if (missing.length) {
      setSubmitError(`Please fill: ${missing.join(', ')}`);
      return;
    }
    if (!user) { setSubmitError('You are signed out. Please sign in again.'); return; }
    setSubmitting(true);
    try {
      const geoPhotos = [];
      for (let i = 0; i < photoList.length; i++) {
        const photoData = photoList[i];
        if (!photoData?.file) continue;
        try {
          const fname = `claims/${user.uid}/${Date.now()}_${i}_geotag.jpg`;
          const storageRef = ref(storage, fname);
          await Promise.race([
            (async () => {
              await uploadBytes(storageRef, photoData.file, { contentType: 'image/jpeg' });
              const url = await getDownloadURL(storageRef);
              geoPhotos.push({
                url,
                lat: photoData.lat,
                lng: photoData.lng,
                accuracy: photoData.accuracy,
                timestamp: photoData.timestamp,
              });
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Photo upload timed out')), 12000)),
          ]);
        } catch (uploadErr) {
          console.warn('Photo upload failed, falling back to base64:', uploadErr);
          if (photoData.lat != null && photoData.lng != null) {
            geoPhotos.push({
              url: photoData.base64,
              lat: photoData.lat,
              lng: photoData.lng,
              accuracy: photoData.accuracy,
              timestamp: photoData.timestamp,
            });
          }
        }
      }
      const firstGeo = geoPhotos[0];
      const claimData = {
        uid: user.uid, parcelId: selectedParcelId || '',
        farmerName: profile?.name || user?.displayName || '', farmerEmail: user?.email || '',
        gatNumber: manualGat,
        village: manualVillage, district: manualDist,
        taluka: manualTaluka, state: 'Maharashtra',
        crop: activeCrop, area: areaVal, disasterType, damageDate, description,
        estimatedLoss, pmfbyEligible: estimatedLoss > 10000,
        officialOwner: officialOwner || '',
        status: 'Pending',
        ...(firstGeo && { geoPhoto: firstGeo, geoPhotos }),
      };
      // Firestore rejects `undefined` values (e.g. a photo without accuracy) — strip them.
      const payload = { ...JSON.parse(JSON.stringify(claimData)), createdAt: serverTimestamp() };
      // Race against a 10s timeout — Firestore hangs forever if rules deny access
      const docRef = await Promise.race([
        addDoc(collection(db, 'claims'), payload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore write timed out. Check Firestore security rules — claims collection may not allow writes.')), 10000)),
      ]);
      setNewClaimId(docRef.id);
      setShowForm(false); setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setSelectedParcelId(''); setCrop(''); setDisasterType('Drought'); setDescription(''); setPhotoList([]); setGeoCameraKey(0);
      setManualTaluka(''); setManualVillage(''); setManualGat('');
      setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      console.error('Claim submission failed:', err);
      setSubmitError('Submission failed: ' + (err.message || 'Unknown error'));
    }
    finally { setSubmitting(false); }
  };

  const totalPending = claims.filter(c => c.status === 'Pending' || c.status === 'Pending_Talathi').length;
  const totalApproved = claims.filter(c => c.status === 'Approved').length;

  const visibleClaims = claims.filter(c => {
    if (role === 'talathi' && c.status === 'Pending') return false; // Hide from Talathi until GP approves
    return true;
  });
  const totalValue = claims.reduce((s, c) => s + (c.estimatedLoss || 0), 0);

  const Lbl = ({ children }) => <label style={{ fontSize: '13px', color: theme.textDim, display: 'block', marginBottom: '6px', fontWeight: 500 }}>{children}</label>;

  return (
    <div className="sc-page-gutter" style={{ padding: '20px', minHeight: '100vh', background: theme.bg }}>

      {/* Header */}
      <div className="sc-claims-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: theme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t('Protect Your Livelihood')}</div>
          <h1 style={{ fontSize: '34px', fontWeight: 500, margin: 0, color: theme.text, letterSpacing: '-0.02em' }}>
            {isOfficer ? t('Claim Review Panel') : t('Insurance Claims')}
          </h1>
          <p style={{ fontSize: '13px', color: theme.textDim, marginTop: '8px', margin: 0 }}>
            {isOfficer ? t('Review and verify farmer insurance claims with satellite data') : t('File and track crop damage insurance claims')}
          </p>
        </div>
        {!isOfficer && (
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '12px 24px', borderRadius: '30px', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', background: showForm ? 'transparent' : theme.text, color: showForm ? theme.text : theme.bg, border: showForm ? `1px solid ${theme.border}` : 'none', fontWeight: 500 }}>
            {showForm ? t('Cancel') : t('+ File Claim')}
          </button>
        )}
      </div>

      {/* Success */}
      {submitted && (
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', padding: '14px 18px', borderRadius: '12px', fontSize: '14px', marginBottom: '16px', fontWeight: 600 }}>
          {t('claim_submitted')}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          [totalPending, t('PENDING'), 'clock', '#d97706'],
          [totalApproved, t('APPROVED'), 'shield', '#16a34a'],
          [claims.length, t('Total Claims', 'Total Claims'), 'clipboard', theme.text],
          [formatINR(totalValue), t('Total Value', 'Total Value'), 'chart', '#3b82f6'],
        ].map(([v, l, icon, c], i) => (
          <div key={i} style={{ background: theme.card, borderRadius: 22, padding: '16px 16px', boxShadow: theme.shadow, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: `${c}1f`, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Glyph name={icon} size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 500, color: theme.text, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 11, color: theme.textDim, letterSpacing: '.06em', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>{l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Claim Form — farmers only */}
      {!isOfficer && showForm && (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: '24px', padding: '28px', marginBottom: '28px', boxShadow: theme.shadow }}>
          <h3 style={{ fontSize: '20px', fontWeight: 500, color: theme.text, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('file_claim')}</h3>
          <p style={{ fontSize: '13px', color: theme.textDim, margin: '0 0 22px' }}>{lang === 'mr' ? 'तपशील भरा, फोटो जोडा आणि सबमिट करा. ग्रामपंचायत प्रथम पडताळणी करेल.' : 'Fill in the details, add field photos and submit. Your Gram Panchayat reviews it first.'}</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="sc-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

              <div style={{ gridColumn: 'span 2', marginBottom: '14px', background: theme.cardAlt, padding: '16px', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                <Lbl style={{ marginBottom: '12px', display: 'block' }}>Select Land Parameters (Directly from Records)</Lbl>

                <div className="sc-loc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <Lbl style={{ fontSize: '9px' }}>DISTRICT</Lbl>
                    <select value={manualDist} onChange={e => { setManualDist(e.target.value); setManualTaluka(''); setManualVillage(''); }} style={inp}>
                      <option value="">Select District</option>
                      {districtList.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl style={{ fontSize: '9px' }}>TALUKA</Lbl>
                    <select value={manualTaluka} onChange={e => { setManualTaluka(e.target.value); setManualVillage(''); }} style={inp} disabled={!manualDist || locLoading}>
                      <option value="">{locLoading ? 'Loading...' : 'Select Taluka'}</option>
                      {jsonTalukas.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl style={{ fontSize: '9px' }}>VILLAGE</Lbl>
                    <select value={manualVillage} onChange={e => setManualVillage(e.target.value)} style={inp} disabled={!manualTaluka || locLoading}>
                      <option value="">{locLoading ? 'Loading...' : 'Select Village'}</option>
                      {jsonVillages.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl style={{ fontSize: '9px' }}>PLOT NO</Lbl>
                    <input type="text" placeholder="e.g. 104" value={manualGat} onChange={e => setManualGat(e.target.value)} style={inp} />
                  </div>
                </div>

                <div className="sc-quickfill" style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '11px', color: theme.textDim }}>Quick fill from my land:</span>
                  <select value={selectedParcelId} onChange={e => {
                    const pid = e.target.value;
                    setSelectedParcelId(pid);
                    const p = parcels.find(x => x.id === pid);
                    if (p) {
                      setManualDist(p.district || 'Satara');
                      setManualTaluka(p.taluka || '');
                      setManualGat(p.gatNumber || p.gatNo || '');
                      // Village list will update via useEffect, but we set the target
                      setManualVillage(p.village || '');
                      setTimeout(() => setManualVillage(p.village || ''), 300);
                    }
                  }} style={{ ...inp, width: 'auto', padding: '4px 8px', fontSize: '11px' }}>
                    <option value="">Choose registered parcel...</option>
                    {parcels.map(p => <option key={p.id} value={p.id}>{p.village}, {p.gatNumber || p.gatNo}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <Lbl>नोंदणीकृत मालक (OFFICIAL OWNER)</Lbl>
                <div style={{
                  ...inp,
                  background: theme.cardAlt,
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '45px',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}>
                  {csvLoading ? 'नोंदी शोधत आहे...' : (officialOwner || 'निवड करा')}
                </div>
              </div>
              <div>
                <Lbl>{t('crop_type')}</Lbl>
                <select value={activeCrop} onChange={e => setCrop(e.target.value)} style={inp}>
                  <option value="">{t('select_crop_type')}</option>
                  {activeCrop && !CROPS.includes(activeCrop) && <option value={activeCrop}>{activeCrop}</option>}
                  {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Lbl>{t('disaster_type')}</Lbl>
                <select value={disasterType} onChange={e => setDisasterType(e.target.value)} style={inp}>
                  {DISASTER_TYPES.map(d => <option key={d} value={d}>{translateDisasterType(d, t, lang)}</option>)}
                </select>
              </div>
              <div>
                <Lbl>{t('damage_date')}</Lbl>
                <input type="date" value={damageDate} onChange={e => setDamageDate(e.target.value)} style={{ ...inp, colorScheme: theme.bg === '#000000' ? 'dark' : 'light' }} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <Lbl>{t('description')}</Lbl>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder={t('desc_placeholder')}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            {/* Geo-Tagged Photo Capture — multiple photos supported */}
            {photoList.length > 0 && (
              <div style={{ gridColumn: 'span 2', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: theme.textDim, marginBottom: '8px' }}>{t('claim_photos_added', { n: String(photoList.length) })}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {photoList.map((p, i) => (
                    <div key={p.id} style={{ position: 'relative' }}>
                      <img src={p.preview} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: '12px', border: `1px solid ${theme.border}` }} />
                      <button
                        type="button"
                        onClick={() => setPhotoList((list) => list.filter((_, j) => j !== i))}
                        style={{
                          position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%',
                          border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,.35)',
                        }}
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <GeoTaggedPhotoWrapper
              theme={theme}
              cameraKey={geoCameraKey}
              onCapture={(geoWithPhoto) => {
                if (!geoWithPhoto?.stampedDataUrl) return;
                fetch(geoWithPhoto.stampedDataUrl)
                  .then((r) => r.blob())
                  .then((blob) => {
                    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    setPhotoList((prev) => [...prev, {
                      id,
                      file: blob,
                      base64: geoWithPhoto.stampedDataUrl,
                      preview: geoWithPhoto.stampedDataUrl,
                      lat: geoWithPhoto.lat,
                      lng: geoWithPhoto.lng,
                      accuracy: geoWithPhoto.acc,
                      timestamp: new Date().toISOString(),
                    }]);
                    setGeoCameraKey((k) => k + 1);
                  })
                  .catch(() => {});
              }}
            />

            {/* Satellite View — first captured photo location, zoomed for verification */}
            {photoList[0]?.lat != null && photoList[0]?.lng != null && (
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: theme.textDim, marginBottom: '8px' }}>{t('claim_form_map_preview')}</div>
                <PhotoVerifyMap lat={photoList[0].lat} lng={photoList[0].lng} theme={theme} height={280} describeAerial />
                <SatelliteView theme={theme} lat={photoList[0].lat} lng={photoList[0].lng} gatNo={manualGat} verifyZoom />
              </div>
            )}

            {/* Preview */}
            {canSubmit && (
              <div style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', color: theme.textMuted, letterSpacing: '.08em', fontWeight: 700, marginBottom: '10px' }}>{t('claim_preview')}</div>
                <div className="sc-preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                  {[
                    [t('affected_area'), `${areaVal} ha`],
                    [t('crop'), activeCrop],
                    [t('crop_value_ha'), formatINR(cropValue)],
                    [t('est_loss'), formatINR(estimatedLoss)],
                    [t('disaster_type'), translateDisasterType(disasterType, t, lang)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: '3px' }}>{k}</div>
                      <div style={{ fontSize: '13px', color: k === t('est_loss') ? '#d97706' : theme.text, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submitError && (
              <div role="alert" style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: theme.danger, fontSize: '13px', lineHeight: 1.5 }}>
                {submitError}
              </div>
            )}
            <button type="submit" disabled={submitting}
              style={{ width: '100%', marginTop: '16px', padding: '14px', borderRadius: '30px', fontSize: '15px', fontFamily: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer', background: theme.accent, color: '#111', border: 'none', fontWeight: 700, opacity: submitting ? .6 : (canSubmit ? 1 : .75) }}>
              {submitting ? t('submitting') : t('submit_claim')}
            </button>
          </form>
        </div>
      )}

      {/* Claims list */}
      <div ref={listRef} style={{ scrollMarginTop: 100 }} />
      {visibleClaims.length === 0 ? (
        <div style={{ textAlign: 'center', color: theme.textDim, padding: '50px 20px', fontSize: '15px', background: theme.card, borderRadius: '14px', border: `1px solid ${theme.border}` }}>
          {claims.length > 0 ? 'No claims visible for your role yet.' : isOfficer ? 'No claims submitted by farmers yet.' : t('no_claims')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isOfficer
            ? visibleClaims.map(c => <GPReviewCard key={c.id} claim={c} theme={theme} role={role} />)
            : visibleClaims.map(c => <ClaimCard key={c.id} claim={c} theme={theme} defaultOpen={c.id === newClaimId} />)
          }
        </div>
      )}
    </div>
  );
}
