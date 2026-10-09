import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

/**
 * NDVI colour ramp (same stops as the usual agronomy palette:
 * bare/water -> tan -> yellow -> light green -> dark green).
 */
const RAMP = [
  [-0.10, [30, 60, 120]],   // water
  [0.00,  [120, 90, 60]],   // bare soil / built-up
  [0.12,  [190, 160, 100]],
  [0.22,  [235, 215, 110]], // sparse / stressed
  [0.32,  [210, 225, 90]],
  [0.45,  [140, 200, 70]],  // moderate
  [0.60,  [60, 160, 50]],   // healthy
  [0.75,  [20, 120, 40]],
  [0.90,  [0, 80, 30]],     // dense canopy
];

// Pre-bake a 256-entry lookup so per-pixel colouring is just an array read.
const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  const lo = RAMP[0][0], hi = RAMP[RAMP.length - 1][0];
  for (let i = 0; i < 256; i++) {
    const v = lo + (i / 255) * (hi - lo);
    let k = 0;
    while (k < RAMP.length - 2 && v > RAMP[k + 1][0]) k++;
    const [v0, c0] = RAMP[k], [v1, c1] = RAMP[k + 1];
    const f = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
  }
  return lut;
})();

/**
 * Visible-band vegetation index (NGRDI) rescaled onto the NDVI range.
 * The Esri basemap has no NIR band, so this is a proxy, not true NDVI —
 * but it separates canopy / bare soil / water / built-up the same way and
 * is rendered with the standard NDVI palette.
 */
function ndviProxy(r, g, b) {
  const sum = r + g;
  if (sum < 8) return -0.1;
  const lum = (r + g + b) / 765;
  const ngrdi = (g - r) / sum;
  // water: blue dominant and dark
  if (b > g && b > r && lum < 0.35) return -0.08;
  // grey surfaces (roads, roofs, concrete): channels nearly equal
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread < 14) return 0.03 + (0.5 - lum) * 0.04;
  let v = 0.2 + 3.4 * ngrdi;
  if (ngrdi > 0) v += (0.45 - lum) * 0.35; // shaded dense canopy reads greener
  return Math.max(-0.1, Math.min(0.9, v));
}

const NdviGrid = L.GridLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const ctx = tile.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 256, 256);
        const data = ctx.getImageData(0, 0, 256, 256);
        const px = data.data;
        const lo = RAMP[0][0], span = RAMP[RAMP.length - 1][0] - lo;
        for (let i = 0; i < px.length; i += 4) {
          const v = ndviProxy(px[i], px[i + 1], px[i + 2]);
          const idx = Math.max(0, Math.min(255, Math.round(((v - lo) / span) * 255))) * 3;
          px[i] = LUT[idx]; px[i + 1] = LUT[idx + 1]; px[i + 2] = LUT[idx + 2];
        }
        ctx.putImageData(data, 0, 0);
        done(null, tile);
      } catch (e) { done(e, tile); }
    };
    img.onerror = () => done(new Error('tile'), tile);
    img.src = `${ESRI}/${coords.z}/${coords.y}/${coords.x}`;
    return tile;
  },
});

/** Drop-in react-leaflet layer: NDVI-coloured rendering of the satellite basemap. */
export default function NdviTileLayer({ maxNativeZoom = 19, maxZoom = 19, opacity = 1 }) {
  const map = useMap();
  useEffect(() => {
    const layer = new NdviGrid({ maxNativeZoom, maxZoom, opacity, tileSize: 256, updateWhenIdle: true });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, maxNativeZoom, maxZoom, opacity]);
  return null;
}

export function NdviLegend({ style }) {
  const stops = RAMP.map(([v, c]) => `rgb(${c.join(',')}) ${((v - RAMP[0][0]) / (RAMP[RAMP.length - 1][0] - RAMP[0][0]) * 100).toFixed(0)}%`).join(', ');
  return (
    <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 1000, pointerEvents: 'none', background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '5px 8px', backdropFilter: 'blur(4px)', ...style }}>
      <div style={{ width: 120, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${stops})` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace', marginTop: 2 }}>
        <span>-0.1</span><span>0.3</span><span>0.9</span>
      </div>
    </div>
  );
}
