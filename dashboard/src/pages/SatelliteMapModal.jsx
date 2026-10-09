import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getGeeAnalyzeUrl } from '../config/geeApi';

const GEE_API = getGeeAnalyzeUrl();

// ── Tile sources ───────────────────────────────────────────────────────────────
const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const fmtD = (d) => d.toISOString().split('T')[0];
const MODIS_DATE = fmtD(new Date(Date.now() - 21 * 864e5)); // ~3 weeks behind = tiles exist
const NASA_NDVI_URL = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${MODIS_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
const NASA_LST_URL  = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${MODIS_DATE}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`;

const STATUS = {
  Healthy: { color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.3)',  label: 'Healthy',  mr: 'चांगले'  },
  Drought: { color: '#d97706', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.3)',  label: 'Drought',  mr: 'दुष्काळ' },
  Flood:   { color: '#2563eb', bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.3)',  label: 'Flood',    mr: 'पूर'     },
};

// ── Reusable Leaflet map panel ─────────────────────────────────────────────────
function MapPanel({ lat, lon, label, badgeColor, tileUrl, tileAttrib, nativeMax = 19, zoom = 10 }) {
  const center = [+lat, +lon];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Label badge — only rendered when label is non-empty */}
      {label && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 1000,
          background: 'rgba(0,0,0,0.82)', borderRadius: 6, padding: '4px 10px',
          fontSize: 9, fontWeight: 800, color: badgeColor,
          letterSpacing: '0.08em', border: `1px solid ${badgeColor}44`,
          textTransform: 'uppercase',
        }}>{label}</div>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        maxZoom={19}
        minZoom={2}
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
        scrollWheelZoom
        zoomControl={false}
        dragging
        doubleClickZoom
        attributionControl={false}
      >
        {/* maxNativeZoom must match the tile provider's actual max to avoid black tiles */}
        <TileLayer url={tileUrl} attribution={tileAttrib} maxZoom={19} maxNativeZoom={nativeMax} />
        <CircleMarker
          center={center}
          radius={8}
          pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9, weight: 2.5 }}
        />
      </MapContainer>
      {/* Attribution strip */}
      <div style={{
        position: 'absolute', bottom: 5, left: 8, right: 8, zIndex: 1000, pointerEvents: 'none',
        fontSize: 8, color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontFamily: 'monospace',
      }}>{tileAttrib}</div>
    </div>
  );
}

function NDVIGauge({ value, label, color }) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) + 1) / 2 * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: '#888' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{typeof value === 'number' ? value.toFixed(4) : '—'}</span>
      </div>
      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, borderRadius: 3, transition: 'width .5s' }} />
      </div>
    </div>
  );
}

// ── Live GEE results panel ────────────────────────────────────────────────────
function GEEResultPanel({ result, loading, error, parcel, theme }) {
  const m = STATUS[result?.status || parcel?.status] || STATUS.Healthy;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: 16, background: theme?.cardAlt || '#0d0d0d',
      borderLeft: `1px solid ${theme?.border || '#1e1e1e'}`,
      overflowY: 'auto', minWidth: 260,
    }}>
      {/* GEE badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: loading ? '#f59e0b' : error ? '#ef4444' : '#22c55e',
          boxShadow: `0 0 6px ${loading ? '#f59e0b' : error ? '#ef4444' : '#22c55e'}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.08em' }}>
          {loading ? 'QUERYING GEE...' : error ? 'GEE ERROR' : 'LIVE GEE DATA'}
        </span>
      </div>

      {/* Status result */}
      {!loading && !error && result && (
        <div style={{
          background: m.bg, border: `1px solid ${m.border}`,
          borderRadius: 10, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: m.color, marginBottom: 2 }}>
            {result.status}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>
            Confidence: {Math.round((result.confidence || 0) * 100)}%
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 0' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid #1e1e1e', borderTop: '3px solid #22c55e',
            animation: 'spin .8s linear infinite',
          }} />
          <span style={{ fontSize: 11, color: '#555' }}>Fetching from Google Earth Engine...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#f87171', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>GEE fetch failed</div>
          <div style={{ color: '#888' }}>{error}</div>
          <div style={{ marginTop: 8, color: '#555' }}>
            Make sure the GEE microservice is running:<br />
            <code style={{ fontSize: 10, color: '#4ade80' }}>cd gee_service && uvicorn main:app --port 8001</code>
          </div>
        </div>
      )}

      {/* Live spectral data from GEE */}
      {!loading && result && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.1em', marginBottom: 10 }}>
            LIVE SPECTRAL DATA (15-DAY WINDOW)
          </div>
          <NDVIGauge
            value={result.current_ndvi}
            label="NDVI (Sentinel-2)"
            color={result.current_ndvi > 0.5 ? '#16a34a' : result.current_ndvi > 0.2 ? '#d97706' : '#dc2626'}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: '#888' }}>SAR VV (Sentinel-1)</span>
            <span style={{ fontWeight: 700, color: result.current_sar < -18 ? '#2563eb' : '#aaa' }}>
              {typeof result.current_sar === 'number' ? result.current_sar.toFixed(2) + ' dB' : '—'}
            </span>
          </div>
          <div style={{ height: 1, background: '#1a1a1a', margin: '10px 0' }} />
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.7 }}>
            <div>Owner: <span style={{ color: '#aaa' }}>{result.owner_name || parcel?.owner_name || '—'}</span></div>
            <div>Village: <span style={{ color: '#aaa' }}>{result.village || parcel?.village || '—'}</span></div>
            <div>Taluka: <span style={{ color: '#aaa' }}>{result.taluka || parcel?.taluka || '—'}</span></div>
            <div>Area: <span style={{ color: '#aaa' }}>{(result.area_ha || parcel?.area_ha || 0).toFixed(4)} ha</span></div>
          </div>
        </div>
      )}

      {/* Static parcel data from JSON (fallback display) */}
      {!result && !loading && parcel && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.1em', marginBottom: 10 }}>
            CACHED ANALYSIS DATA
          </div>
          <NDVIGauge value={parcel.current_ndvi}  label="NDVI current"  color="#d97706" />
          <NDVIGauge value={parcel.baseline_ndvi} label="NDVI baseline" color="#888" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: '#888' }}>ΔSAR σ⁰</span>
            <span style={{ fontWeight: 700, color: '#aaa' }}>
              {parcel.delta_sar >= 0 ? '+' : ''}{parcel.delta_sar?.toFixed(2)} dB
            </span>
          </div>
        </div>
      )}

      {/* Classifier logic */}
      <div style={{
        background: '#0a0a0a', border: '1px solid #1a1a1a',
        borderRadius: 8, padding: '10px 12px', fontSize: 10, color: '#555', lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 700, color: '#444', marginBottom: 4 }}>GEE CLASSIFIER THRESHOLDS</div>
        <div>SAR &lt; −18 dB → Flood (0.92)</div>
        <div>NDVI &lt; 0.25 → Drought (0.88)</div>
        <div>Else → Healthy (0.95)</div>
        <div style={{ marginTop: 6, color: '#333' }}>Source: Sentinel-2 + Sentinel-1 via GEE</div>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SatelliteMapModal({ parcel, onClose, theme, lang }) {
  const [geeResult, setGeeResult] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const gatKey = parcel?.gat_no ?? null;
  const lat    = parcel?.lat ?? 17.68;
  const lon    = parcel?.lon ?? 74.0;

  // Fetch live GEE data when parcel changes
  useEffect(() => {
    if (!gatKey) return;
    let cancelled = false;
    setGeeResult(null);
    setError(null);
    setLoading(true);

    if (!GEE_API) {
      setLoading(false);
      setError('GEE service URL not configured. Set VITE_GEE_API_BASE for production or run the API locally in development.');
      return;
    }

    fetch(GEE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gat_no: String(gatKey) }),
    })
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.detail || `HTTP ${r.status}`); });
        return r.json();
      })
      .then(data => { if (!cancelled) setGeeResult(data); })
      .catch(e  => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [gatKey]);

  if (!parcel) return null;

  const displayStatus = geeResult?.status || parcel?.status || 'Healthy';
  const m = STATUS[displayStatus] || STATUS.Healthy;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '96%', maxWidth: 1100,
          height: '90vh', maxHeight: 700,
          background: theme?.card || '#0d0d0d',
          border: `1px solid ${theme?.border || '#1e1e1e'}`,
          borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${theme?.border || '#222'}`,
          display: 'flex', alignItems: 'center', gap: 10,
          background: theme?.cardAlt || '#0a0a0a',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme?.text || '#fff' }}>
              GEE Analysis — Gat {parcel.gat_no}
            </div>
            <div style={{ fontSize: 11, color: theme?.textDim || '#888' }}>
              {[parcel.village, parcel.taluka, parcel.district].filter(Boolean).join(', ')}
              {' · '}{lat.toFixed(4)}°N {lon.toFixed(4)}°E
            </div>
          </div>

          {/* Live status badge */}
          <div style={{
            padding: '5px 12px', borderRadius: 8,
            background: m.bg, border: `1px solid ${m.border}`,
            fontSize: 12, fontWeight: 700, color: m.color,
          }}>
            {loading ? 'Analyzing...' : displayStatus}
            {!loading && (geeResult?.confidence != null) && (
              <span style={{ fontWeight: 400, marginLeft: 6, color: m.color + 'cc' }}>
                {Math.round(geeResult.confidence * 100)}%
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          >×</button>
        </div>

        {/* ── Content: Map + Map + Side panel ── */}
        <div className="resp-sat-modal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left: Esri World Imagery — real satellite */}
          <div style={{ position: 'relative', borderRight: `1px solid ${theme?.border || '#222'}` }}>
            <div style={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 100,
              background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '3px 8px',
              fontSize: 10, color: '#888',
            }}>
              NDVI: {geeResult?.current_ndvi != null ? geeResult.current_ndvi.toFixed(4) : (parcel.current_ndvi?.toFixed(4) ?? '—')}
            </div>
            <MapPanel
              lat={lat} lon={lon}
              label="REAL SATELLITE (ESRI)"
              badgeColor="#93c5fd"
              tileUrl={ESRI_SAT}
              tileAttrib="© Esri World Imagery"
              nativeMax={19}
              zoom={16}
            />
          </div>

          {/* Centre: NASA GIBS MODIS NDVI — genuine scientific product (no CSS filter) */}
          <div style={{ position: 'relative', borderRight: `1px solid ${theme?.border || '#222'}` }}>
            <div style={{
              position: 'absolute', top: 36, left: 8, zIndex: 100,
              background: 'rgba(0,0,0,0.65)', borderRadius: 4, padding: '2px 6px',
              fontSize: 8, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace',
            }}>
              MODIS_Terra_NDVI_8Day · {MODIS_DATE}
            </div>
            <div style={{
              position: 'absolute', bottom: 8, left: 8, zIndex: 100,
              background: 'rgba(0,0,0,0.75)', borderRadius: 5, padding: '3px 8px',
              fontSize: 10, color: '#888',
            }}>
              SAR VV: {geeResult?.current_sar != null ? geeResult.current_sar.toFixed(2) + ' dB' : (parcel.current_sar?.toFixed(2) ?? '—')}
            </div>
            <MapPanel
              lat={lat} lon={lon}
              label="MODIS NDVI (NASA GIBS)"
              badgeColor="#4ade80"
              tileUrl={NASA_NDVI_URL}
              tileAttrib="NASA GIBS · MODIS Terra NDVI"
              nativeMax={9}
              zoom={16}
            />
          </div>

          {/* Right: GEE live results panel */}
          <GEEResultPanel
            result={geeResult}
            loading={loading}
            error={error}
            parcel={parcel}
            theme={theme}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '6px 16px',
          borderTop: `1px solid ${theme?.border || '#222'}`,
          background: theme?.cardAlt || '#0a0a0a',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#93c5fd', fontWeight: 700 }}>
             Esri World Imagery
          </span>
          <span style={{ fontSize: 10, color: '#333' }}>·</span>
          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>
             NASA GIBS — MODIS_Terra_NDVI_8Day
          </span>
          <span style={{ fontSize: 10, color: '#333' }}>·</span>
          <span style={{ fontSize: 10, color: '#555' }}>
            {MODIS_DATE} · NASA's own rendering (no CSS filters)
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: loading ? '#f59e0b' : error ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
            {loading ? 'LIVE FETCH IN PROGRESS' : error ? 'USING CACHED DATA' : 'LIVE DATA'}
          </span>
        </div>
      </div>
    </div>
  );
}
