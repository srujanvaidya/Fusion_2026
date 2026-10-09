import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import { visibleClaims } from '../data/hiddenClaims';
import EarlyWarningPanel from '../components/EarlyWarningPanel';
import { LandHoldingsCard, LocalConditionsCard, FieldScanCard, RegisteredFieldsCard } from '../components/HomeSections';
import { useEarlyWarnings } from '../components/EarlyWarningContext';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const DISTRICT_COORDS = {
  'Pune':{lat:18.52,lon:73.86},'Nashik':{lat:20.00,lon:73.79},'Kolhapur':{lat:16.70,lon:74.24},
  'Solapur':{lat:17.68,lon:75.90},'Aurangabad':{lat:19.88,lon:75.34},'Nagpur':{lat:21.15,lon:79.09},
  'Latur':{lat:18.40,lon:76.58},'Amravati':{lat:20.93,lon:77.75},'Sangli':{lat:16.86,lon:74.57},
  'Nanded':{lat:19.17,lon:77.32},'Satara':{lat:17.68,lon:74.00},'Ahmednagar':{lat:19.10,lon:74.74},
  'Jalgaon':{lat:21.00,lon:75.56},'Dhule':{lat:20.90,lon:74.78},'Raigad':{lat:18.51,lon:73.18},
  'Thane':{lat:19.22,lon:72.98},'Yavatmal':{lat:20.39,lon:78.12},'Wardha':{lat:20.74,lon:78.60},
};

function formatINR(n) {
  return '₹' + (n||0).toLocaleString('en-IN');
}

const linkIcon = () => (
  <div style={{ position:'absolute', top:'16px', right:'16px', width:'28px', height:'28px', borderRadius:'50%', background:'rgba(0,0,0,0.03)', display:'flex', alignItems:'center', justifyContent:'center' }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
  </div>
);


// ─── Main Component ───────────────────────────────────────────
export default function Home({ user, profile }) {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const isOfficial = ['talathi', 'gram_panchayat', 'field_officer'].includes(profile?.role);
  const isGp = profile?.role === 'gram_panchayat';

  const [parcels, setParcels] = useState([]);
  const [claims, setClaims] = useState([]);
  const [weather, setWeather] = useState(null);
  const { parcels: fieldList, isDemo: fieldsAreDemo } = useEarlyWarnings();

  const district = profile?.district || 'Satara';
  const coords = DISTRICT_COORDS[district] || DISTRICT_COORDS['Satara'];

  useEffect(() => {
    if (!user) return undefined;

    if (profile?.role === 'gram_panchayat') {
      const dist = (profile?.district || 'Satara').trim() || 'Satara';
      const qRef = query(collection(db, 'parcels'), where('district', '==', dist));
      const unsub = onSnapshot(
        qRef,
        (s) => {
          const vil = (profile?.village || '').trim().toLowerCase();
          let rows = s.docs.map((d) => d.data());
          if (vil) rows = rows.filter((p) => (p.village || '').trim().toLowerCase() === vil);
          setParcels(rows);
        },
        () => setParcels([])
      );
      return unsub;
    }

    const unsub = onSnapshot(
      query(collection(db, 'parcels'), where('uid', '==', user.uid)),
      (s) => setParcels(s.docs.map((d) => d.data())),
      () => {}
    );
    return unsub;
  }, [user, profile?.role, profile?.district, profile?.village]);

  useEffect(() => {
    if (!user) return undefined;

    if (profile?.role === 'gram_panchayat') {
      const unsub = onSnapshot(
        query(collection(db, 'claims')),
        (s) => {
          let rows = s.docs.map((d) => d.data());
          const dist = (profile?.district || '').trim();
          const vil = (profile?.village || '').trim().toLowerCase();
          if (dist) rows = rows.filter((c) => (c.district || '').trim() === dist);
          if (vil) rows = rows.filter((c) => (c.village || '').trim().toLowerCase() === vil);
          setClaims(visibleClaims(rows));
        },
        () => setClaims([])
      );
      return unsub;
    }

    const unsub = onSnapshot(
      query(collection(db, 'claims'), where('uid', '==', user.uid)),
      (s) => setClaims(visibleClaims(s.docs.map((d) => d.data()))),
      () => {}
    );
    return unsub;
  }, [user, profile?.role, profile?.district, profile?.village]);

  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&timezone=Asia%2FKolkata`)
      .then(r=>r.json()).then(setWeather).catch(()=>{});
  }, [district]);

  const cur = weather?.current || { temperature_2m: 25, relative_humidity_2m: 86, wind_speed_10m: 8.5, precipitation: 0 };

  const cropBarData = useMemo(() => {
    const counts = new Map();
    const cropLabel = (crop) => {
      if (!crop) return t('Unknown Crop');
      const c = String(crop).trim();
      const tr = t(c);
      return tr !== c ? tr : c;
    };
    for (const p of parcels) {
      const key = cropLabel(p.crop);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, fields]) => ({ name, fields }))
      .sort((a, b) => b.fields - a.fields);
  }, [parcels, t]);

  const gpUsingDemoData = isGp && cropBarData.length === 0;

  const gpChartData = useMemo(() => {
    if (!isGp) return [];
    if (cropBarData.length > 0) return cropBarData;
    return [
      { name: t('gp_demo_sugarcane'), fields: 19 },
      { name: t('gp_demo_wheat'), fields: 12 },
      { name: t('gp_demo_soybean'), fields: 8 },
    ];
  }, [isGp, cropBarData, t]);

  const gpParcelCountDisplay = gpUsingDemoData
    ? gpChartData.reduce((s, r) => s + r.fields, 0)
    : parcels.length;

  const gpDistrictDisplay = gpUsingDemoData
    ? (profile?.district?.trim() || 'Pune')
    : district;

  const gpVillageDisplay = (profile?.village && profile.village.trim())
    || (gpUsingDemoData ? 'Adivare' : '');

  const cardStyle = {
    background: theme.card,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: theme.shadow,
    border: `1px solid ${theme.border}`,
    position: 'relative'
  };

  return (
    <div className="sc-page-gutter" style={{ padding: 'clamp(16px, 4vw, 40px) clamp(16px, 4vw, 40px)', minHeight: '100vh', background: theme.bg, color: theme.text }}>
      
      {/* Header */}
      <div className="sc-home-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div className="sc-desktop-only" style={{ fontSize: '11px', fontWeight: 600, color: theme.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{t('Satellite-Backed Crop Verification')}</div>
          <h1 style={{ fontSize: '32px', fontWeight: 500, margin: 0, color: theme.text }}>{t('Dashboard Overview')}</h1>
        </div>
        <div className="sc-home-actions" style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/claims')} style={{ background: theme.text, color: theme.bg, border: 'none', borderRadius: '30px', padding: '12px 24px', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            {t('➦ File Claim')}
          </button>
          {!isOfficial && (
          <button onClick={() => navigate('/land')} style={{ background: theme.accent, color: '#111111', border: 'none', borderRadius: '30px', padding: '12px 24px', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(200,232,36,0.3)' }}>
            {t('+ Add Land')}
          </button>
          )}
        </div>
      </div>

      {/* Phone: quick snapshot only */}
      <div
        className="sc-mobile-only sc-home-mobile-summary"
        style={{
          background: theme.card,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          color: theme.text,
        }}
      >
        <span style={{ fontWeight: 600 }}>{Math.round(cur.temperature_2m)}°C</span>
        <span style={{ color: theme.textDim }}>·</span>
        <span>{district}</span>
        <span style={{ color: theme.textDim }}>·</span>
        <span>{t('Parcels:')} {!isGp && parcels.length === 0 ? 3 : parcels.length}</span>
        {claims.length > 0 && (
          <>
            <span style={{ color: theme.textDim }}>·</span>
            <span>{claims.length} {t('Recent Claims').replace('Recent ', '')}</span>
          </>
        )}
      </div>

      {isGp && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 500, margin: '0 0 6px 0', color: theme.text }}>{t('gp_crop_overview_title')}</h2>
              <p style={{ fontSize: '13px', color: theme.textDim, margin: 0, lineHeight: 1.55 }}>{t('gp_crop_overview_sub')}</p>
            </div>
            {gpUsingDemoData && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: theme.textDim, background: theme.name === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
                {t('gp_demo_badge')}
              </span>
            )}
          </div>
          <div style={{ width: '100%', height: Math.min(440, 64 + gpChartData.length * 42), marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gpChartData} layout="vertical" margin={{ top: 6, right: 28, left: 4, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                <XAxis type="number" stroke={theme.border} tick={{ fill: theme.textDim, fontSize: 11 }} axisLine={{ stroke: theme.border }} />
                <YAxis type="category" dataKey="name" width={132} tick={{ fill: theme.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: theme.name === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                  contentStyle={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: '10px', fontSize: '12px', color: theme.text }}
                  formatter={(value) => [value, t('gp_fields_axis')]}
                />
                <Bar dataKey="fields" fill={theme.accent} radius={[0, 8, 8, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '14px', fontSize: '12px', color: theme.textDim, fontWeight: 500 }}>
            {t('Parcels:')} {gpParcelCountDisplay} · {t('district')}: {gpDistrictDisplay}
            {gpVillageDisplay ? ` · ${gpVillageDisplay}` : ''}
          </div>
        </div>
      )}

      <EarlyWarningPanel theme={theme} lang={lang} />

      <div className="sc-home-dashboard-grid resp-grid-1-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* Left: Recent Claims — desktop */}
        <div className="sc-desktop-only" style={{ ...cardStyle, display:'flex', flexDirection:'column', gap:'12px', padding:'20px' }}>
          {linkIcon()}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:theme.accent }}></div>
            <div style={{ fontSize:'14px', fontWeight:500, color:theme.text }}>{t('Recent Claims')}</div>
          </div>
          
          {[...claims.slice(0,4)].map((c, i) => (
            <div key={i} style={{ padding:'16px', background: theme.name === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa', borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:600, color:theme.text }}>{t('Claim')}</div>
                <div style={{ fontSize:'11px', color:theme.textDim, marginTop:'2px' }}>{t('Est. Loss:')} {formatINR(c.amount)}</div>
              </div>
              <div style={{ fontSize:'11px', fontWeight:600, color: c.status === 'Rejected' ? '#dc2626' : '#f59e0b', textTransform:'uppercase' }}>
                {t(c.status?.toUpperCase() || 'PENDING')}
              </div>
            </div>
          ))}
          {claims.length === 0 && (
            <div style={{ padding:'16px', background: theme.name === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa', borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'13px', fontWeight:600, color:theme.text }}>{t('Claim')}</div>
                <div style={{ fontSize:'11px', color:theme.textDim, marginTop:'2px' }}>{t('Est. Loss:')} ₹55,000</div>
              </div>
              <div style={{ fontSize:'11px', fontWeight:600, color: '#f59e0b', textTransform:'uppercase' }}>{t('PENDING')}</div>
            </div>
          )}

          <div style={{ marginTop:'auto', paddingTop:'16px', borderTop:`1px solid ${theme.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={()=>navigate('/claims')}>
            <span style={{ fontSize:'14px', fontWeight:500, color:theme.text }}>{t('View All Claims')}</span>
            <span style={{ color:theme.textDim }}>→</span>
          </div>
        </div>

        <div className="sc-home-land-card" style={{ minWidth: 0 }}>
          <LandHoldingsCard parcels={fieldList} theme={theme} lang={lang} isDemo={fieldsAreDemo} district={district} onOpen={() => navigate('/land')} />
        </div>

        <div style={{ minWidth: 0 }}>
          <LocalConditionsCard cur={cur} district={district} theme={theme} lang={lang} onOpen={() => navigate('/weather')} />
        </div>
      </div>

      <div className="sc-home-bottom-grid resp-grid-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px' }}>
        <FieldScanCard parcels={fieldList} theme={theme} lang={lang} district={district} onOpen={() => navigate('/stress')} />
        <RegisteredFieldsCard parcels={fieldList} theme={theme} lang={lang} isDemo={fieldsAreDemo} onOpen={() => navigate('/land')} onAdd={() => navigate('/land')} />
      </div>
    </div>
  );
}
