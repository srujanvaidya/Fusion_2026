/**
 * GeoTagPhoto.jsx  — v4
 *
 * • getUserMedia — direct live camera, NO file picker
 * • GPS via ref (no stale closure)
 * • Nominatim reverse-geocode → place name stamped on photo
 * • Preview includes a Leaflet satellite mini-map at captured location
 * • onCapture(geo) callback fires after capture so parent can use the coords
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default leaflet marker icon (missing in Vite builds)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n) { return String(Math.floor(n)).padStart(2, '0'); }

function fmtCoord(val, pos, neg) {
  if (val == null) return 'N/A';
  const deg = Math.floor(Math.abs(val));
  const minFull = (Math.abs(val) - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(1);
  return `${deg}°${pad2(min)}'${sec}" ${val >= 0 ? pos : neg}`;
}

function fmtDateTime() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const j = await res.json();
    const a = j.address || {};
    return [
      a.village || a.suburb || a.town || a.city || a.county,
      a.state_district || a.district,
      a.state,
    ].filter(Boolean).join(', ') || j.display_name?.split(',').slice(0, 3).join(',') || '';
  } catch { return ''; }
}

function stampCanvas(canvas, geo, theme) {
  const W   = canvas.width;
  const H   = canvas.height;
  const ctx = canvas.getContext('2d');
  const pad = Math.round(W * 0.025);
  const fs  = Math.max(14, Math.round(W * 0.022));
  const lh  = fs * 1.65;
  const coordColor = theme?.text || '#e5e7eb';
  const placeColor = theme?.accent || '#93c5fd';

  const lines = [
    { text: '   GEO-TAGGED FARM PHOTO',               color: '#22c55e', size: Math.round(fs * 0.78), bold: true },
    { text: `   LAT  ${fmtCoord(geo.lat, 'N', 'S')}`, color: coordColor, size: fs },
    { text: `   LNG  ${fmtCoord(geo.lng, 'E', 'W')}`, color: coordColor, size: fs },
    { text: `   ACC  ±${geo.acc != null ? Math.round(geo.acc) : '?'}m`,  color: '#facc15', size: fs },
    { text: `   ${fmtDateTime()}`,                    color: '#d1d5db', size: Math.round(fs * 0.9) },
    ...(geo.place ? [{ text: `   ${geo.place}`, color: placeColor, size: Math.round(fs * 0.9) }] : []),
  ];

  const bannerH = pad * 2.2 + lines.length * lh;
  const bannerY = H - bannerH;

  ctx.fillStyle = 'rgba(0,0,0,0.80)';
  ctx.fillRect(0, bannerY, W, bannerH);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, bannerY, Math.round(W * 0.006), bannerH);

  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';
  lines.forEach(({ text, color, size, bold }, i) => {
    ctx.font      = `${bold ? 'bold ' : ''}${size}px 'Courier New', monospace`;
    ctx.fillStyle = color;
    ctx.fillText(text, pad * 2, bannerY + pad + i * lh);
  });

  ctx.font         = `bold ${Math.round(fs * 0.65)}px sans-serif`;
  ctx.fillStyle    = 'rgba(255,255,255,0.35)';
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('Guardian™', W - pad, pad);

  return canvas.toDataURL('image/jpeg', 0.93);
}

const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_IMAGERY_MAX_ZOOM = 19;
const ESRI_FIELD_PHOTO_ZOOM = 18;

/** Tiny satellite map centred on lat/lng */
function SatMiniMap({ lat, lng }) {
  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '2px solid #22c55e', height: '220px', position: 'relative' }}>
      {/* Label */}
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', color: '#22c55e',
        borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        letterSpacing: '.05em', pointerEvents: 'none',
      }}>
        SATELLITE VIEW · CAPTURE LOCATION
      </div>
      <MapContainer
        center={[lat, lng]}
        zoom={ESRI_FIELD_PHOTO_ZOOM}
        maxZoom={ESRI_IMAGERY_MAX_ZOOM}
        minZoom={3}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer url={ESRI_SAT} maxZoom={ESRI_IMAGERY_MAX_ZOOM} maxNativeZoom={ESRI_IMAGERY_MAX_ZOOM} />
        <Marker position={[lat, lng]} />
      </MapContainer>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GeoTagPhoto({ theme, parcelId, onCapture }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const geoRef     = useRef(null);

  const [phase, setPhase]         = useState('idle');
  const [error, setError]         = useState('');
  const [geo, setGeo]             = useState(null);
  const [place, setPlace]         = useState('');
  const [stamped, setStamped]     = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [gpsReady, setGpsReady]   = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const openCamera = useCallback(async () => {
    setError(''); setGeo(null); setPlace(''); setStamped(null);
    setVideoReady(false); setGpsReady(false); geoRef.current = null;

    // GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, place: '' };
          geoRef.current = coords; setGeo(coords); setGpsReady(true);
          const pl = await reverseGeocode(coords.lat, coords.lng);
          const updated = { ...coords, place: pl };
          geoRef.current = updated; setGeo(updated); setPlace(pl);
        },
        () => {
          const fallback = { lat: null, lng: null, acc: null, place: '' };
          geoRef.current = fallback; setGeo(fallback); setGpsReady(true);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      const fallback = { lat: null, lng: null, acc: null, place: '' };
      geoRef.current = fallback; setGeo(fallback); setGpsReady(true);
    }

    // Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('camera');

      requestAnimationFrame(() => {
        const vid = videoRef.current;
        if (!vid) return;
        vid.srcObject = stream;
        vid.onloadedmetadata = () => { vid.play?.().catch(() => {}); };
        vid.oncanplay = () => {
          vid.play?.().catch(() => {});
          setTimeout(() => setVideoReady(true), 200);
        };
      });
    } catch (err) {
      const msgs = {
        NotAllowedError:      'Camera permission denied. Allow camera access in browser settings.',
        NotFoundError:        'No camera found on this device.',
        NotReadableError:     'Camera is in use by another app. Close it and try again.',
        OverconstrainedError: 'Camera constraints not supported on this device.',
      };
      setError(msgs[err.name] || `Camera error: ${err.message}`);
      setPhase('error');
    }
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const W = video.videoWidth  || 1280;
    const H = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    await new Promise(r => requestAnimationFrame(() => { ctx.drawImage(video, 0, 0, W, H); r(); }));

    const geoNow = geoRef.current || { lat: null, lng: null, acc: null, place: '' };
    const jpeg   = stampCanvas(canvas, geoNow, theme);

    stopStream();
    setStamped(jpeg);
    setPhase('preview');

    // Notify parent with GPS data AND the stamped JPEG dataUrl
    onCapture?.({ ...geoNow, stampedDataUrl: jpeg });
  }, [stopStream, onCapture, theme]);

  const download = () => {
    const a = document.createElement('a');
    a.href = stamped; a.download = `guardian_geo_${parcelId || 'field'}_${Date.now()}.jpg`; a.click();
  };

  const retake = () => { stopStream(); setPhase('idle'); setStamped(null); };
  const cancel = () => { stopStream(); setPhase('idle'); setStamped(null); setError(''); };

  /* Video must be ready; do not block shutter on GPS (slow on desktop / denied). Coordinates stamp as N/A until GPS arrives. */
  const canCapture = videoReady;

  const card = {
    background: theme.card, border: `1px solid ${theme.border}`,
    borderRadius: '14px', padding: '16px', marginTop: '16px', boxShadow: theme.shadow,
  };
  const Btn = ({ onClick, bg, children, disabled }) => (
    <button type="button" onClick={onClick} disabled={!!disabled} style={{
      flex: 1, padding: '13px 0', borderRadius: '10px', border: 'none',
      background: disabled ? '#374151' : bg, color: disabled ? '#9ca3af' : theme.bg,
      fontSize: '14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: '8px', transition: 'all .15s',
    }}>{children}</button>
  );

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ color: theme.text, opacity: 0.8 }}><svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"></path></svg></div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: theme.text }}>Geo-Tagged Farm Photo</div>
          <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>
            Live camera · GPS coordinates · Satellite map of location
          </div>
        </div>
      </div>

      {/* ── IDLE ── */}
      {phase === 'idle' && (
        <button type="button" id="geo-camera-btn" onClick={openCamera} style={{
          width: '100%', padding: '18px 0', borderRadius: '12px', border: 'none',
          background: 'linear-gradient(135deg,#15803d,#16a34a)',
          color: theme.bg, fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '10px', boxShadow: '0 4px 16px rgba(22,163,74,.35)',
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"></path><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"></path></svg> Open Camera &amp; Tag Location
        </button>
      )}

      {/* ── CAMERA ── */}
      {phase === 'camera' && (
        <div>
          <div style={{
            position: 'relative', borderRadius: '12px', overflow: 'hidden',
            border: `2px solid ${videoReady ? '#22c55e' : '#d97706'}`,
            background: theme.text, aspectRatio: '16/9', marginBottom: '12px', transition: 'border-color .3s',
          }}>
            <video ref={videoRef} playsInline muted autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

            {/* GPS badge */}
            <div style={{
              position: 'absolute', top: '10px', left: '10px',
              background: gpsReady ? (geo?.lat ? 'rgba(22,163,74,.88)' : 'rgba(107,114,128,.88)') : 'rgba(217,119,6,.88)',
              color: theme.bg, borderRadius: '20px', padding: '5px 12px',
              fontSize: '11px', fontWeight: 700, backdropFilter: 'blur(4px)',
            }}>
              {gpsReady ? (geo?.lat ? `${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : 'GPS unavailable') : 'Getting GPS…'}
            </div>

            {!videoReady && (
              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'rgba(217,119,6,.88)', color: theme.bg,
                borderRadius: '20px', padding: '5px 12px', fontSize: '11px', fontWeight: 700,
              }}>Starting camera…</div>
            )}

            {place && (
              <div style={{
                position: 'absolute', bottom: '80px', left: '10px', right: '10px',
                background: 'rgba(0,0,0,.72)', color: '#93c5fd',
                borderRadius: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: 600,
              }}>{place}</div>
            )}

            {/* Shutter */}
            <div style={{ position: 'absolute', bottom: '14px', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={captureFrame} disabled={!canCapture}
                style={{
                  width: '70px', height: '70px', borderRadius: '50%',
                  background: canCapture ? theme.bg : '#6b7280',
                  border: `5px solid ${canCapture ? 'rgba(255,255,255,.5)' : 'rgba(107,114,128,.4)'}`,
                  cursor: canCapture ? 'pointer' : 'not-allowed',
                  boxShadow: canCapture ? '0 2px 16px rgba(0,0,0,.5)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', transition: 'all .2s', color: theme.text || '#111',
                }}>
                {canCapture ? <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg> : '...'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: theme.textDim, textAlign: 'center', marginBottom: '10px' }}>
            {!videoReady && !gpsReady && 'Starting camera and locating GPS…'}
            {videoReady && !gpsReady && 'Tip: you can capture now; GPS will refine on the image if it arrives.'}
            {!videoReady && gpsReady && 'Camera starting…'}
            {canCapture && 'Ready — tap the shutter to capture'}
          </div>

          <button type="button" onClick={cancel} style={{
            width: '100%', padding: '10px', borderRadius: '10px', background: 'transparent',
            border: `1px solid ${theme.border}`, color: theme.textDim, fontSize: '13px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {phase === 'preview' && stamped && (
        <div>
          {/* Stamped photo */}
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${theme.border}`, marginBottom: '12px' }}>
            <img src={stamped} alt="Geo-tagged farm" style={{ width: '100%', display: 'block' }} />
          </div>

          {/* GPS info strip */}
          {geo && (
            <div style={{
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.22)',
              borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', marginBottom: '8px', letterSpacing: '.06em' }}>
                CAPTURED LOCATION
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '12px' }}>
                <span style={{ color: theme.textDim }}>Latitude</span>
                <span style={{ color: theme.text, fontFamily: 'monospace', fontWeight: 600 }}>{fmtCoord(geo.lat, 'N', 'S')}</span>
                <span style={{ color: theme.textDim }}>Longitude</span>
                <span style={{ color: theme.text, fontFamily: 'monospace', fontWeight: 600 }}>{fmtCoord(geo.lng, 'E', 'W')}</span>
                <span style={{ color: theme.textDim }}>Accuracy</span>
                <span style={{ color: '#facc15', fontWeight: 600 }}>±{geo.acc != null ? Math.round(geo.acc) : '?'}m</span>
                <span style={{ color: theme.textDim }}>Time</span>
                <span style={{ color: theme.text }}>{fmtDateTime()}</span>
                {geo.place && (
                  <>
                    <span style={{ color: theme.textDim }}>Place</span>
                    <span style={{ color: '#93c5fd', fontWeight: 600 }}>{geo.place}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/*  Satellite mini-map of capture location */}
          {geo?.lat && geo?.lng && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textMuted, letterSpacing: '.08em', marginBottom: '8px' }}>
                SATELLITE VIEW — PHOTO LOCATION
              </div>
              <SatMiniMap lat={geo.lat} lng={geo.lng} />
              <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '6px', textAlign: 'center' }}>
                Source: Esri World Imagery · {geo.lat.toFixed(5)}°N, {geo.lng.toFixed(5)}°E
                {geo.place && ` · ${geo.place}`}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn onClick={download} bg="#16a34a"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"></path></svg> Save Photo</Btn>
            <Btn onClick={retake}   bg="#2563eb"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"></path></svg> Retake</Btn>
          </div>
          <button type="button" onClick={cancel} style={{
            marginTop: '10px', width: '100%', padding: '10px', borderRadius: '10px',
            background: 'transparent', border: `1px solid ${theme.border}`,
            color: theme.textDim, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>Close</button>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <div>
          <div style={{
            background: theme.dangerBg || '#fef2f2', border: `1px solid ${theme.dangerBorder || '#fca5a5'}`,
            color: theme.danger || '#dc2626', padding: '12px 14px', borderRadius: '10px',
            fontSize: '13px', lineHeight: 1.6, marginBottom: '12px',
          }}> {error}</div>
          <button type="button" onClick={openCamera} style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: '#16a34a', color: theme.bg, fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Try Again</button>
        </div>
      )}
    </div>
  );
}
