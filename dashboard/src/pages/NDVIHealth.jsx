import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MOCK_PARCELS, MOCK_NDVI_HISTORY, ndviColor, ndviLabel } from '../data/maharashtra.js';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';

function NDVIBar({ value, color }) {
  return (
    <div style={{ width:'100%', height:'8px', background:'#e5e7eb', borderRadius:'4px', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(value*100,100)}%`, background:color, borderRadius:'4px', transition:'width 0.6s ease' }} />
    </div>
  );
}

function ParcelNDVICard({ parcel, onSelect, selected, theme, t }) {
  const color = ndviColor(parcel.ndvi);
  const recommendation = parcel.ndvi < 0.3
    ? t('rec_critical') : parcel.ndvi < 0.6
    ? t('rec_moderate') : t('rec_good');

  return (
    <div onClick={onSelect} style={{
      background: selected ? theme.cardAlt : theme.card,
      border: `1px solid ${selected ? color+'60' : theme.border}`,
      borderRadius:'12px', padding:'16px', cursor:'pointer',
      transition:'all 0.15s', boxShadow: theme.shadow,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
        <div>
          <div style={{ fontSize:'14px', fontWeight:700, color: theme.text, marginBottom:'2px' }}>गट {parcel.gatNo}</div>
          <div style={{ fontSize:'12px', color: theme.textDim }}>{parcel.village} — {parcel.crop}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'22px', fontWeight:800, color, lineHeight:1 }}>{parcel.ndvi?.toFixed(2)}</div>
          <div style={{ fontSize:'10px', color, letterSpacing:'0.08em', marginTop:'2px', fontWeight:700 }}>{ndviLabel(parcel.ndvi).toUpperCase()}</div>
        </div>
      </div>
      <div style={{ marginBottom:'10px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color: theme.textMuted, marginBottom:'5px' }}>
          <span>NDVI</span><span>{(parcel.ndvi*100).toFixed(0)}%</span>
        </div>
        <NDVIBar value={parcel.ndvi} color={color} />
      </div>
      <div style={{ background:`${color}10`, border:`1px solid ${color}20`, borderRadius:'8px', padding:'10px 12px', fontSize:'12px', color: theme.textDim, lineHeight:1.6 }}>
        {recommendation}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, theme }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'8px', padding:'12px 16px', fontSize:'12px', boxShadow: theme.shadow }}>
      <div style={{ color: theme.textDim, marginBottom:'6px' }}>{label}</div>
      {payload.map(p=>(
        <div key={p.key} style={{ color:p.color, marginBottom:'2px' }}>
          {p.name.toUpperCase()}: {p.value?.toFixed(3)}
        </div>
      ))}
    </div>
  );
};

export default function NDVIHealth({ user }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [parcels, setParcels] = useState(MOCK_PARCELS);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'parcels'), where('uid','==',user.uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      if (data.length > 0) { setParcels(data); setSelected(data[0]); }
      else setSelected(MOCK_PARCELS[0]);
    });
    return unsub;
  }, [user]);

  useEffect(() => { if (parcels.length && !selected) setSelected(parcels[0]); }, [parcels]);

  const avgNdvi = parcels.length ? parcels.reduce((s,p)=>s+(p.ndvi||0),0)/parcels.length : 0;

  const stats = [
    [t('avg_ndvi'),  avgNdvi.toFixed(2), ndviColor(avgNdvi)],
    [t('healthy'),   parcels.filter(p=>p.ndvi>=0.6).length, '#16a34a'],
    [t('stressed'),  parcels.filter(p=>p.ndvi>=0.3&&p.ndvi<0.6).length, '#d97706'],
    [t('critical'),  parcels.filter(p=>p.ndvi<0.3).length, '#dc2626'],
  ];

  return (
    <div style={{ padding:'20px', minHeight:'100vh', background: theme.bg }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:800, color: theme.text, margin:0 }}>{t('crop_health_title')}</h1>
        <p style={{ fontSize:'13px', color: theme.textDim, marginTop:'4px' }}>{t('crop_health_sub')}</p>
      </div>

      {/* Stats */}
      <div className="resp-grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
        {stats.map(([l,v,c])=>(
          <div key={l} style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'12px', padding:'14px', boxShadow: theme.shadow }}>
            <div style={{ fontSize:'10px', color: theme.textMuted, letterSpacing:'.06em', marginBottom:'5px', fontWeight:700 }}>{l.toUpperCase()}</div>
            <div style={{ fontSize:'22px', fontWeight:800, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'16px', alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Parcel list */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', minWidth:'280px', flex:1 }}>
          {parcels.map(p=>(
            <ParcelNDVICard key={p.id} parcel={p} selected={selected?.id===p.id} onSelect={()=>setSelected(p)} theme={theme} t={t} />
          ))}
        </div>

        {/* Chart */}
        <div style={{ flex:1, minWidth:'300px' }}>
          <div style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'14px', padding:'20px', boxShadow: theme.shadow }}>
            <div style={{ marginBottom:'14px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color: theme.text, marginBottom:'2px' }}>{t('ndvi_trend')}</div>
              <div style={{ fontSize:'12px', color: theme.textDim }}>
                {selected ? `गट ${selected.gatNo} — ${selected.village}` : t('select_parcel')}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={MOCK_NDVI_HISTORY} margin={{ top:5, right:10, bottom:5, left:-20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="month" tick={{ fill:theme.textMuted, fontSize:10 }} />
                <YAxis domain={[0,1]} tick={{ fill:theme.textMuted, fontSize:10 }} />
                <Tooltip content={<CustomTooltip theme={theme} />} />
                <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#16a34a" fill="#16a34a20" strokeWidth={2} dot={{ fill:'#16a34a', r:3 }} />
                <Area type="monotone" dataKey="evi"  name="EVI"  stroke="#2563eb" fill="#2563eb10" strokeWidth={1.5} dot={{ fill:'#2563eb', r:2 }} />
                <Area type="monotone" dataKey="savi" name="SAVI" stroke="#d97706" fill="#d97706 10" strokeWidth={1.5} dot={{ fill:'#d97706', r:2 }} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ marginTop:'14px', padding:'12px 14px', background: theme.cardAlt, borderRadius:'8px', border:`1px solid ${theme.border}` }}>
              <div style={{ fontSize:'10px', color: theme.textMuted, letterSpacing:'.08em', fontWeight:700, marginBottom:'5px' }}>{t('data_source').toUpperCase()}</div>
              <div style={{ fontSize:'12px', color: theme.textDim, lineHeight:1.6 }}>
                Sentinel Hub Statistics API. NASA MODIS AppEEARS. Update: monthly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
