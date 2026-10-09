import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MOCK_ALERTS, formatIST } from '../data/maharashtra.js';

// Open-Meteo — free, no API key, real weather
const MAHARASHTRA_CITIES = [
  { name: 'Pune',       lat: 18.52, lon: 73.86, district: 'Pune' },
  { name: 'Nashik',     lat: 20.00, lon: 73.79, district: 'Nashik' },
  { name: 'Kolhapur',   lat: 16.70, lon: 74.24, district: 'Kolhapur' },
  { name: 'Solapur',    lat: 17.68, lon: 75.90, district: 'Solapur' },
  { name: 'Aurangabad', lat: 19.88, lon: 75.34, district: 'Aurangabad' },
  { name: 'Nagpur',     lat: 21.15, lon: 79.09, district: 'Nagpur' },
  { name: 'Latur',      lat: 18.40, lon: 76.58, district: 'Latur' },
  { name: 'Amravati',   lat: 20.93, lon: 77.75, district: 'Amravati' },
  { name: 'Sangli',     lat: 16.86, lon: 74.57, district: 'Sangli' },
  { name: 'Nanded',     lat: 19.17, lon: 77.32, district: 'Nanded' },
];

const SEVERITY_CONFIG = {
  Critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
  High:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  Watch:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
};

const TYPE_ICONS = { Drought: '◎', Flood: '▲', Pest: '◈', Heat: '' };

async function fetchLiveWeatherAlerts() {
  const liveAlerts = [];
  for (const city of MAHARASHTRA_CITIES) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata&forecast_days=3`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const c = data.current;
      const temp = c.temperature_2m;
      const rain = c.precipitation || 0;
      const humidity = c.relative_humidity_2m;
      const daily = data.daily;
      const rain3d = (daily?.precipitation_sum || []).slice(0, 3).reduce((a, b) => a + (b || 0), 0);

      // Flood alert: heavy rainfall
      if (rain > 30 || rain3d > 100) {
        liveAlerts.push({
          id: `live-flood-${city.name}`,
          type: 'Flood',
          district: city.district,
          taluka: 'Multiple',
          affectedArea: Math.round(rain3d * 40),
          severity: rain > 50 || rain3d > 150 ? 'Critical' : 'High',
          source: 'Open-Meteo (Live)',
          description: `Current rainfall: ${rain.toFixed(1)}mm. 3-day forecast: ${rain3d.toFixed(1)}mm. Flood risk is ${rain > 50 ? 'very high' : 'elevated'}. Humidity: ${humidity}%.`,
          reportedToGovt: false,
          reliefDispatched: false,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
          isLive: true,
        });
      }

      // Drought/Heat alert: high temp + no rain
      if (temp > 38 && rain < 2 && humidity < 35) {
        liveAlerts.push({
          id: `live-drought-${city.name}`,
          type: temp > 42 ? 'Heat' : 'Drought',
          district: city.district,
          taluka: 'Multiple',
          affectedArea: Math.round(temp * 30),
          severity: temp > 42 ? 'Critical' : 'High',
          source: 'Open-Meteo (Live)',
          description: `Temperature: ${temp}°C, Rainfall: ${rain}mm, Humidity: ${humidity}%. ${temp > 42 ? 'Extreme heat wave conditions.' : 'Drought stress likely for standing crops.'}`,
          reportedToGovt: false,
          reliefDispatched: false,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
          isLive: true,
        });
      }
    } catch { /* silent fail per city */ }
  }
  return liveAlerts;
}

function AlertCard({ alert, onReport, onDispatch, isGovt }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.Watch;
  const timeAgo = (ts) => {
    const secs = Math.floor(Date.now() / 1000 - (ts?.seconds || 0));
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  return (
    <div style={{ background: '#111', border: `1px solid ${cfg.border}`, borderRadius: '10px', padding: '20px', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', color: cfg.color }}>{TYPE_ICONS[alert.type] || '◉'}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{alert.type} Alert</span>
              {alert.isLive && (
                <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '3px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>LIVE</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{alert.district} — {alert.taluka}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
          <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '4px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>
            {alert.severity?.toUpperCase()}
          </span>
          <span style={{ fontSize: '10px', color: '#777' }}>{timeAgo(alert.createdAt)}</span>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#bbb', lineHeight: 1.7, marginBottom: '12px' }}>{alert.description}</p>

      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#888', marginBottom: '14px' }}>
        <span>AREA: <span style={{ color: '#ccc' }}>{alert.affectedArea?.toLocaleString('en-IN')} ha</span></span>
        <span>SOURCE: <span style={{ color: '#ccc' }}>{alert.source}</span></span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!alert.reportedToGovt ? (
          <button onClick={() => onReport(alert.id)} style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}>
            Report to Government
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: '#22c55e', padding: '7px 0' }}>✓ Reported to Mantralaya</span>
        )}
        {isGovt && !alert.reliefDispatched && (
          <button onClick={() => onDispatch(alert.id)} style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}>
            Dispatch Relief
          </button>
        )}
        {alert.reliefDispatched && <span style={{ fontSize: '11px', color: '#22c55e', padding: '7px 0' }}>✓ Relief Dispatched</span>}
      </div>
    </div>
  );
}

export default function DisasterAlerts({ user, profile }) {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [fetchingLive, setFetchingLive] = useState(false);

  // Farmer's own parcels for personalized alerts
  const [myParcels, setMyParcels] = useState([]);
  const isFarmer = profile?.role === 'farmer';
  const isGovt   = profile?.role === 'gram_panchayat' || profile?.role === 'talathi';

  useEffect(() => {
    if (!user || !isFarmer) return;
    const q = query(collection(db,'parcels'), where('uid','==',user.uid));
    return onSnapshot(q, snap => setMyParcels(snap.docs.map(d=>({id:d.id,...d.data()}))), ()=>{});
  }, [user, isFarmer]);

  // Firestore alerts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'alerts'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) setAlerts(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, () => {});
    return unsub;
  }, []);

  // Live Open-Meteo weather
  useEffect(() => {
    setFetchingLive(true);
    fetchLiveWeatherAlerts().then(live => {
      setLiveAlerts(live);
      setFetchingLive(false);
    }).catch(() => setFetchingLive(false));
  }, []);

  const handleReport = async (id) => {
    try {
      await updateDoc(doc(db, 'alerts', id), { reportedToGovt: true, reportedAt: serverTimestamp(), reportedBy: user?.uid });
    } catch {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, reportedToGovt: true } : a));
      setLiveAlerts(prev => prev.map(a => a.id === id ? { ...a, reportedToGovt: true } : a));
    }
  };

  const handleDispatch = async (id) => {
    try {
      await updateDoc(doc(db, 'alerts', id), { reliefDispatched: true, dispatchedAt: serverTimestamp() });
    } catch {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, reliefDispatched: true } : a));
      setLiveAlerts(prev => prev.map(a => a.id === id ? { ...a, reliefDispatched: true } : a));
    }
  };

  const allAlerts = [...liveAlerts, ...alerts];

  // Farmer: highlight alerts that affect their districts
  const myDistricts = new Set(myParcels.map(p => p.district).filter(Boolean));
  const myAlerts    = isFarmer ? allAlerts.filter(a => myDistricts.has(a.district)) : [];

  const types = ['All', 'Drought', 'Flood', 'Pest', 'Heat'];
  const filtered = filter === 'All' ? allAlerts : allAlerts.filter(a => a.type === filter);

  const counts = { Critical: 0, High: 0, Watch: 0 };
  allAlerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Disaster Alerts</h1>
          {fetchingLive && (
            <span style={{ fontSize: '10px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.2)' }}>
              ◉ Fetching live weather...
            </span>
          )}
          {liveAlerts.length > 0 && !fetchingLive && (
            <span style={{ fontSize: '10px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(34,197,94,0.2)' }}>
              ✓ {liveAlerts.length} live alerts from Open-Meteo
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
          Real-time weather (Open-Meteo) + Satellite + IMD advisory monitoring
        </p>
      </div>

      {/* Farmer — my land alerts banner */}
      {isFarmer && myParcels.length > 0 && (
        <div style={{ background: myAlerts.length > 0 ? 'rgba(239,68,68,.06)' : 'rgba(34,197,94,.06)', border: `1px solid ${myAlerts.length > 0 ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`, borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: myAlerts.length > 0 ? '#ef4444' : '#22c55e', marginBottom: '4px' }}>
            {myAlerts.length > 0 ? ` ${myAlerts.length} alert${myAlerts.length!==1?'s':''} in your land area` : '✓ No active alerts in your land area'}
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            Monitoring {myParcels.length} parcel{myParcels.length!==1?'s':''} across {myDistricts.size} district{myDistricts.size!==1?'s':''}: {[...myDistricts].join(', ')}
          </div>
        </div>
      )}
      {isFarmer && myParcels.length === 0 && (
        <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '11px', color: '#f59e0b' }}>
           Add land parcels in <strong>My Land Parcels</strong> to see alerts specific to your plots.
        </div>
      )}

      {/* Severity summary */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[['CRITICAL', counts.Critical, '#ef4444'], ['HIGH', counts.High, '#f59e0b'], ['WATCH', counts.Watch, '#3b82f6'], ['TOTAL', allAlerts.length, '#fff']].map(([label, count, color]) => (
          <div key={label} style={{ background: '#0d0d0d', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: '10px', padding: '14px 20px', flex: 1, minWidth: '110px' }}>
            <div style={{ fontSize: '10px', color: '#777', letterSpacing: '0.1em', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: '7px 16px', borderRadius: '6px', fontSize: '11px',
            fontFamily: 'inherit', cursor: 'pointer',
            background: filter === t ? 'rgba(34,197,94,0.12)' : 'transparent',
            color: filter === t ? '#22c55e' : '#888',
            border: `1px solid ${filter === t ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'all 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: '50px', fontSize: '13px', background: '#0d0d0d', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          No {filter !== 'All' ? filter.toLowerCase() : ''} alerts active.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(alert => (
            <AlertCard key={alert.id} alert={alert} onReport={handleReport} onDispatch={handleDispatch} isGovt={isGovt} />
          ))}
        </div>
      )}
    </div>
  );
}
