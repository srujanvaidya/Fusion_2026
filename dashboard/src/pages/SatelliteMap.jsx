import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polygon, Popup } from 'react-leaflet';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MOCK_PARCELS } from '../data/maharashtra.js';

const MAHA_CENTER = [19.7515, 75.7139];
const INIT_ZOOM = 7;

// 10-year-old date for BEFORE panel
const today = new Date();
const tenYearsAgo = new Date(today);
tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
const fmtDate = (d) => d.toISOString().split('T')[0];
const TODAY_STR = fmtDate(today);
const TEN_YEARS_STR = fmtDate(tenYearsAgo);

// ── Tile sources ─────────────────────────────────────────────────────────────
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const NASA = (layer, date) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`;

// Simulated Sentinel overlays (NASA MODIS — free, no key needed)
const OVERLAYS = {
  // Sentinel-2 crop simulation: MODIS NDVI (vegetation greenness)
  crop_after:  NASA('MODIS_Terra_NDVI_8Day', TODAY_STR),
  crop_before: NASA('MODIS_Terra_NDVI_8Day', TEN_YEARS_STR),
  // Sentinel-1 flood simulation: MODIS true-color (water shows as dark/blue)
  flood_after:  NASA('MODIS_Terra_CorrectedReflectance_TrueColor', TODAY_STR),
  flood_before: NASA('MODIS_Terra_CorrectedReflectance_TrueColor', TEN_YEARS_STR),
  // Land surface temp — soil moisture proxy
  soil_after:  NASA('MODIS_Terra_Land_Surface_Temp_Day', TODAY_STR),
  soil_before: NASA('MODIS_Terra_Land_Surface_Temp_Day', TEN_YEARS_STR),
};

// ── Sync two maps ─────────────────────────────────────────────────────────────
function useSyncedMaps() {
  const afterRef  = useRef(null);
  const beforeRef = useRef(null);
  const busy = useRef(false);

  const sync = useCallback((src, dst) => {
    if (!src || !dst || busy.current) return;
    busy.current = true;
    dst.setView(src.getCenter(), src.getZoom(), { animate: false });
    busy.current = false;
  }, []);

  const bindAfter = useCallback((map) => {
    if (!map || afterRef.current === map) return;
    afterRef.current = map;
    map.on('moveend', () => sync(map, beforeRef.current));
  }, [sync]);

  const bindBefore = useCallback((map) => {
    if (!map || beforeRef.current === map) return;
    beforeRef.current = map;
    map.on('moveend', () => sync(map, afterRef.current));
  }, [sync]);

  return { bindAfter, bindBefore };
}

// ── Parcel polygons ───────────────────────────────────────────────────────────
function ParcelLayer({ parcels }) {
  return parcels.map(p => {
    if (!p.geometry?.coordinates) return null;
    const pos = p.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    const isAlert = p.status === 'drought';
    return (
      <Polygon key={p.id} positions={pos}
        eventHandlers={{
          click: (e) => {
            const map = e.target._map;
            map.flyToBounds(e.target.getBounds(), { padding: [20, 20], maxZoom: 18 });
          }
        }}
        pathOptions={{
          color: isAlert ? '#ef4444' : '#22c55e',
          fillColor: isAlert ? '#ef4444' : '#22c55e',
          fillOpacity: 0.28, weight: 2,
          dashArray: isAlert ? '6 4' : null,
        }}
      >
        <Popup>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6 }}>
            <b>Gat {p.gatNo}</b> — {p.village}<br />
            {p.ownerName}<br />
            {p.area} ha · {p.crop} · NDVI {p.ndvi?.toFixed(2)}<br />
            <span style={{ color: isAlert ? '#ef4444' : '#22c55e' }}>
              ● {p.status?.toUpperCase()}
            </span>
          </div>
        </Popup>
      </Polygon>
    );
  });
}

// ── Layer control ─────────────────────────────────────────────────────────────
function LayerPanel({ baseLayer, setBaseLayer, overlay, setOverlay }) {
  const opts = [
    { key: 'none',  label: '— None',              color: '#666' },
    { key: 'flood', label: 'S1 Flood (SAR sim)', color: '#3b82f6' },
    { key: 'crop',  label: 'S2 Crop (NDVI sim)', color: '#22c55e' },
    { key: 'soil',  label: 'Soil / LST sim',     color: '#f59e0b' },
  ];
  return (
    <div style={{
      position: 'absolute', top: '12px', right: '12px', zIndex: 1000,
      background: 'rgba(8,8,8,0.96)', border: '1px solid #252525',
      borderRadius: '10px', padding: '14px 16px', minWidth: '190px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: '9px', color: '#444', letterSpacing: '0.12em', marginBottom: '8px' }}>BASE LAYER</div>
      {[['satellite','Satellite'],['osm','OSM']].map(([k, l]) => (
        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', cursor: 'pointer' }}>
          <input type="radio" name="base" checked={baseLayer === k} onChange={() => setBaseLayer(k)} style={{ accentColor: '#22c55e' }} />
          <span style={{ fontSize: '11px', color: baseLayer === k ? '#22c55e' : '#666' }}>{l}</span>
        </label>
      ))}
      <div style={{ height: '1px', background: '#1a1a1a', margin: '10px 0' }} />
      <div style={{ fontSize: '9px', color: '#444', letterSpacing: '0.12em', marginBottom: '8px' }}>SENTINEL OVERLAY (SIMULATED)</div>
      {opts.map(o => (
        <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', cursor: 'pointer' }}>
          <input type="radio" name="overlay" checked={overlay === o.key} onChange={() => setOverlay(o.key)} style={{ accentColor: o.color }} />
          <span style={{ fontSize: '11px', color: overlay === o.key ? o.color : '#666' }}>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SatelliteMap({ user }) {
  const [parcels, setParcels] = useState(MOCK_PARCELS);
  const [baseLayer, setBaseLayer] = useState('satellite');
  const [overlay, setOverlay] = useState('none');
  const [districtGeoJSON, setDistrictGeoJSON] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const isDragging = useRef(false);
  const containerRef = useRef(null);
  const { bindAfter, bindBefore } = useSyncedMaps();

  // ── data ────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'parcels'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const d = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      if (d.length > 0) setParcels(d);
    }, () => {});
    return unsub;
  }, [user]);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/datameet/maps/master/Districts/maharashtra.geojson')
      .then(r => r.json()).then(setDistrictGeoJSON).catch(() => {});
  }, []);

  // ── drag ────
  const onDragStart = useCallback(e => { e.preventDefault(); isDragging.current = true; }, []);
  useEffect(() => {
    const move = e => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      setSplitPos(Math.min(95, Math.max(5, ((cx - rect.left) / rect.width) * 100)));
    };
    const up = () => { isDragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, []);

  const baseUrl = baseLayer === 'satellite' ? SAT_URL : OSM_URL;

  const distStyle = () => ({ color: '#22c55e', weight: 1, fillColor: '#22c55e', fillOpacity: 0.03, opacity: 0.4 });
  const onEachDist = (f, layer) => {
    const name = f.properties?.DISTRICT || f.properties?.NAME || 'District';
    layer.bindTooltip(name, { permanent: false, sticky: true });
    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.12, color: '#4ade80' }));
    layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.03, color: '#22c55e' }));
  };

  // Which NASA tile to show based on selected overlay + panel side
  const overlayUrl = (side) => {
    // side: 'before' | 'after'
    if (overlay === 'none') return null;
    return OVERLAYS[`${overlay}_${side}`] || null;
  };

  // ── label style ────
  const labelStyle = (side) => ({
    position: 'absolute', bottom: '50px',
    [side === 'before' ? 'left' : 'right']: '14px',
    zIndex: 900,
    background: side === 'before' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)',
    border: `1px solid ${side === 'before' ? '#f59e0b60' : '#22c55e60'}`,
    borderRadius: '6px', padding: '5px 12px',
    fontSize: '11px', fontWeight: 700,
    color: side === 'before' ? '#f59e0b' : '#22c55e',
  });

  const getOverlayFilter = (side) => {
    // Only apply heatmap filter to AFTER side (or if single map)
    if (side === 'before') return {};
    if (overlay === 'crop') return { filter: 'hue-rotate(80deg) saturate(3) contrast(1.4)' };
    if (overlay === 'flood') return { filter: 'hue-rotate(200deg) saturate(2) contrast(1.2)' };
    if (overlay === 'soil') return { filter: 'hue-rotate(150deg) saturate(4) contrast(1.5)' };
    return {};
  };

  return (
    <div style={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '11px 20px', borderBottom: '1px solid #1e1e1e',
        background: '#0a0a0a', display: 'flex', alignItems: 'center',
        gap: '10px', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Satellite Map</h1>
        <span style={{ fontSize: '10px', color: '#555' }}>Maharashtra Agricultural Intelligence</span>

        <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '4px', background: '#3b82f615', color: '#60a5fa', border: '1px solid #3b82f630' }}>S1 FLOOD SIM</span>
        <span style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '4px', background: '#22c55e15', color: '#4ade80', border: '1px solid #22c55e30' }}>S2 CROP SIM</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* ← BACK button — only visible in split mode */}
          {splitMode && (
            <button
              onClick={() => setSplitMode(false)}
              style={{
                padding: '7px 14px', borderRadius: '7px', fontSize: '11px',
                fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, border: '1px solid #333',
                background: '#1a1a1a', color: '#aaa', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = '#252525'; e.target.style.color = '#fff'; }}
              onMouseLeave={e => { e.target.style.background = '#1a1a1a'; e.target.style.color = '#aaa'; }}
            >
              ← BACK
            </button>
          )}

          {/* BEFORE / AFTER toggle */}
          <button
            onClick={() => setSplitMode(s => !s)}
            style={{
              padding: '7px 14px', borderRadius: '7px', fontSize: '11px',
              fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, border: 'none',
              background: splitMode ? '#3b82f6' : '#1a1a1a',
              color: splitMode ? '#fff' : '#888', transition: 'all 0.2s',
            }}
          >
            ⟺ {splitMode ? 'COMPARING' : 'BEFORE / AFTER'}
          </button>
        </div>

        {/* Date range label */}
        {splitMode && (
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            background: '#111', border: '1px solid #222',
            borderRadius: '7px', padding: '5px 12px', fontSize: '10px',
          }}>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>◀ BEFORE {TEN_YEARS_STR}</span>
            <span style={{ color: '#333' }}>│</span>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>AFTER {TODAY_STR} ▶</span>
          </div>
        )}
      </div>

      {/* ── Map Area ── */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', userSelect: 'none' }}>

        {/* ═══ SINGLE MAP ═══ */}
        {!splitMode && (
          <MapContainer center={MAHA_CENTER} zoom={INIT_ZOOM} style={{ height: '100%', width: '100%', ...getOverlayFilter('after') }} ref={bindAfter}>
            <TileLayer url={baseUrl} maxZoom={19} attribution="© Map contributors" />
            {districtGeoJSON && <GeoJSON data={districtGeoJSON} style={distStyle} onEachFeature={onEachDist} />}
            <ParcelLayer parcels={parcels} />
            <LayerPanel baseLayer={baseLayer} setBaseLayer={setBaseLayer} overlay={overlay} setOverlay={setOverlay} />
          </MapContainer>
        )}

        {/* ═══ SPLIT: BEFORE (left) ═══ */}
        {splitMode && (
          <>
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - splitPos}% 0 0)`, zIndex: 1 }}>
              <MapContainer center={MAHA_CENTER} zoom={INIT_ZOOM} style={{ height: '100%', width: '100%', ...getOverlayFilter('before') }} ref={bindBefore} zoomControl={false} attributionControl={false}>
                <TileLayer url={baseUrl} maxZoom={19} />
                {districtGeoJSON && <GeoJSON data={districtGeoJSON} style={distStyle} onEachFeature={onEachDist} />}
                <ParcelLayer parcels={parcels} />
              </MapContainer>
              <div style={labelStyle('before')}>◀ GEE SATELLITE (BEFORE)</div>
            </div>

            {/* ═══ SPLIT: AFTER (right) ═══ */}
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 0 0 ${splitPos}%)`, zIndex: 1 }}>
              <MapContainer center={MAHA_CENTER} zoom={INIT_ZOOM} style={{ height: '100%', width: '100%', ...getOverlayFilter('after') }} ref={bindAfter} attributionControl={false}>
                <TileLayer url={baseUrl} maxZoom={19} />
                {districtGeoJSON && <GeoJSON data={districtGeoJSON} style={distStyle} onEachFeature={onEachDist} />}
                <ParcelLayer parcels={parcels} />
                <LayerPanel baseLayer={baseLayer} setBaseLayer={setBaseLayer} overlay={overlay} setOverlay={setOverlay} />
              </MapContainer>
              <div style={labelStyle('after')}>SENTINEL-2 HEATMAP ▶</div>
            </div>

            {/* ═══ DRAG DIVIDER ═══ */}
            <div
              onMouseDown={onDragStart}
              onTouchStart={onDragStart}
              style={{
                position: 'absolute',
                left: `calc(${splitPos}% - 1px)`,
                top: 0, bottom: 0, width: '2px',
                background: 'linear-gradient(180deg, #3b82f6, #60a5fa 50%, #3b82f6)',
                zIndex: 500, cursor: 'col-resize',
                boxShadow: '0 0 14px 3px #3b82f655',
              }}
            >
              {/* Knob */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                border: '2px solid #60a5fa',
                boxShadow: '0 0 18px #3b82f680',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', color: '#fff', cursor: 'col-resize',
                pointerEvents: 'none',
              }}>⟺</div>
            </div>

            {/* Floating hint */}
            <div style={{
              position: 'absolute', top: '10px', left: '50%',
              transform: 'translateX(-50%)', zIndex: 600,
              background: 'rgba(8,8,8,0.92)', border: '1px solid #3b82f640',
              borderRadius: '20px', padding: '5px 14px',
              fontSize: '10px', color: '#93c5fd',
              backdropFilter: 'blur(8px)', pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
               Drag ⟺ · Simulated S1 SAR (flood) + S2 NDVI (crop) · {TEN_YEARS_STR} vs {TODAY_STR}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
