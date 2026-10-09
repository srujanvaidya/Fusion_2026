import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { INDIA_STATES, getDistricts } from '../data/locationData';
import { useLocationData, DISTRICT_MARATHI } from '../data/useLocationData';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import GeoTagPhoto from '../components/GeoTagPhoto';
import Glyph from '../components/icons/Glyph';

const CROPS = ['Sugarcane','Wheat','Rice','Cotton','Soybean','Onion','Jowar','Bajra','Tur','Groundnut','Maize','Gram','Sunflower','Turmeric','Ginger'];
const LAND_TYPES = ['Irrigated','Rain-fed','Partially irrigated','Dryland'];
const WATER_SOURCES = ['Canal','Borewell','River','Rain','Well','Tank','Drip Irrigation'];

function printDocument(type, parcel) {
  const now = new Date().toLocaleDateString('mr-IN', { year:'numeric', month:'long', day:'numeric' });
  const titles = { '7/12':'सातबारा उतारा (7/12 Extract)', '8-A':'८-अ उतारा (8-A Extract)', 'tauton':'ताटोण प्रमाणपत्र (Tauton Certificate)' };
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${titles[type]}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans Devanagari','Times New Roman',serif;padding:40px;color:#000;background:#fff}
      .header{text-align:center;border-bottom:3px double #000;padding-bottom:16px;margin-bottom:20px}
      .header h1{font-size:20px;font-weight:bold}.header h2{font-size:15px;margin-top:4px}
      .header h3{font-size:13px;margin-top:4px;color:#444}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
      th,td{border:1px solid #555;padding:9px 12px;text-align:left}
      th{background:#eee;font-weight:bold;width:40%}
      .footer{margin-top:40px;display:flex;justify-content:space-between;font-size:11px;color:#555}
      .sign{text-align:right;margin-top:60px;font-size:12px}
      .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:70px;color:rgba(0,0,0,0.04);pointer-events:none;white-space:nowrap}
      @media print{button{display:none}}
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&display=swap" rel="stylesheet">
  </head><body>
    <div class="wm">महाराष्ट्र शासन</div>
    <div class="header">
      <div style="font-size:40px;margin-bottom:8px"></div>
      <h1>महाराष्ट्र शासन | Government of Maharashtra</h1>
      <h2>${titles[type]}</h2>
      <h3>महसूल व वन विभाग | Revenue & Forest Department</h3>
    </div>
    <table>
      <tr><th>गट क्रमांक (Gat No.)</th><td>${parcel.gatNumber||'—'}</td></tr>
      <tr><th>सर्व्हे क्रमांक (Survey No.)</th><td>${parcel.plotNumber||'—'}</td></tr>
      <tr><th>मालकाचे नाव (Owner Name)</th><td>${parcel.ownerName||'—'}</td></tr>
      <tr><th>गाव (Village)</th><td>${parcel.village||'—'}</td></tr>
      <tr><th>तालुका (Taluka)</th><td>${parcel.taluka||'—'}</td></tr>
      <tr><th>जिल्हा (District)</th><td>${parcel.district||'—'}</td></tr>
      <tr><th>राज्य (State)</th><td>${parcel.state||'Maharashtra'}</td></tr>
      <tr><th>क्षेत्र (Area)</th><td>${parcel.area?parcel.area+' हेक्टर':'—'}</td></tr>
      <tr><th>पीक (Crop)</th><td>${parcel.crop||'—'}</td></tr>
      <tr><th>जमीन प्रकार (Land Type)</th><td>${parcel.landType||'—'}</td></tr>
      <tr><th>पाण्याचा स्रोत (Water Source)</th><td>${parcel.waterSource||'—'}</td></tr>
      <tr><th>दस्तऐवज दिनांक</th><td>${now}</td></tr>
    </table>
    <div class="sign"><p>तलाठी / Talathi</p><p style="margin-top:4px;font-size:11px;color:#555">${parcel.taluka||''} Circle</p></div>
    <div class="footer">
      <span>* हे संगणकीय अभिलेख आहे | Computer-generated record.</span>
      <span>मुद्रण दिनांक: ${now}</span>
    </div>
    <br><center><button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer;background:#111;color:#fff;border:none;border-radius:6px"><svg style="vertical-align:middle;margin-right:6px;" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"></path></svg>Print / Download PDF</button></center>
  </body></html>`);
  w.document.close();
}

function AddParcelForm({ onSave, onCancel, theme }) {
  const { t } = useLang();
  const [form, setForm] = useState({ gatNumber:'', plotNumber:'', state:'Maharashtra', district:'', taluka:'', village:'', area:'', crop:'', landType:'', waterSource:'', ownerName:'' });
  const [districtOpts, setDistrictOpts] = useState(getDistricts('Maharashtra'));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const { talukasList, villagesList, loading: locLoading } = useLocationData(form.district, form.taluka);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const onState = v => { setForm(f => ({ ...f, state:v, district:'', taluka:'', village:'' })); setDistrictOpts(getDistricts(v)); };
  const onDist  = v => { setForm(f => ({ ...f, district:v, taluka:'', village:'' })); };
  const handleSave = async () => {
    if (!form.gatNumber.trim()) { setError(t('gat_required')); return; }
    if (!form.village.trim())   { setError(t('village_required')); return; }
    setSaving(true); setError(''); await onSave(form); setSaving(false);
  };

  const inp = { width:'100%', padding:'12px 16px', background: theme.inputBg, border:`1px solid rgba(0,0,0,0.15)`, borderRadius:'12px', color: theme.text, fontSize:'15px', outline:'none', boxSizing:'border-box', appearance:'none' };
  const Lbl = ({ children }) => <label style={{ fontSize:'11px', color: theme.text, opacity: 0.6, display:'block', marginBottom:'6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{children}</label>;
  const Sec = ({ children }) => <div style={{ fontSize:'14px', color: theme.text, fontWeight:600, margin:'24px 0 16px', paddingBottom:'8px' }}>{children}</div>;

  return (
    <div style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'24px', padding:'32px', marginBottom:'24px', boxShadow: theme.shadow }} className="sc-myland-form">
      <div style={{ fontSize:'24px', fontWeight:400, color: theme.text, marginBottom:'8px' }}>{t('register_land')}</div>
      <div style={{ fontSize:'13px', color: theme.text, opacity: 0.6, marginBottom:'24px' }}>{t('register_sub')}</div>
      
      {error && <div style={{ background: '#fee2e2', color: '#dc2626', fontSize:'13px', padding:'12px 16px', borderRadius:'12px', marginBottom:'16px' }}>{error}</div>}

      <Sec>{t('land_id')}</Sec>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        <div><Lbl>{t('gat_number')}</Lbl><input value={form.gatNumber} onChange={set('gatNumber')} placeholder="1234" style={inp} /></div>
        <div><Lbl>{t('plot_number')}</Lbl><input value={form.plotNumber} onChange={set('plotNumber')} placeholder="A-4" style={inp} /></div>
        <div><Lbl>{t('owner_name')}</Lbl><input value={form.ownerName} onChange={set('ownerName')} placeholder="रमेश काडम" style={inp} /></div>
        <div><Lbl>{t('area_ha')}</Lbl><input type="number" min="0" step="0.01" value={form.area} onChange={set('area')} placeholder="2.5" style={inp} /></div>
      </div>

      <Sec>{t('location')}</Sec>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        <div><Lbl>{t('state')}</Lbl><select value={form.state} onChange={e=>onState(e.target.value)} style={inp}>{INDIA_STATES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><Lbl>{t('district')}</Lbl>
          <select value={form.district} onChange={e=>onDist(e.target.value)} disabled={!districtOpts.length} style={inp}>
            <option value="">{t('select_district')}</option>
            {districtOpts.map(d=><option key={d} value={d}>{DISTRICT_MARATHI[d] || d}</option>)}
          </select>
        </div>
        <div><Lbl>{t('taluka')}</Lbl>
          <select value={form.taluka} onChange={e=>setForm(f=>({...f,taluka:e.target.value,village:''}))} disabled={locLoading || !talukasList.length} style={inp}>
            <option value="">{locLoading ? 'Loading...' : t('select_taluka')}</option>
            {talukasList.map(t2=><option key={t2}>{t2}</option>)}
          </select>
        </div>
        <div><Lbl>{t('village')} *</Lbl>
          <select value={form.village} onChange={set('village')} disabled={locLoading || !villagesList.length} style={inp}>
            <option value="">{locLoading ? 'Loading...' : t('select_village') || 'Select village'}</option>
            {villagesList.map(v=><option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <Sec>{t('crop_land')}</Sec>
      <div className="resp-grid-3" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px' }}>
        <div><Lbl>{t('crop')}</Lbl><select value={form.crop} onChange={set('crop')} style={inp}><option value="">{t('select_crop')}</option>{CROPS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><Lbl>{t('land_type')}</Lbl><select value={form.landType} onChange={set('landType')} style={inp}><option value="">{t('select_type')}</option>{LAND_TYPES.map(l=><option key={l}>{l}</option>)}</select></div>
        <div><Lbl>{t('water_source')}</Lbl><select value={form.waterSource} onChange={set('waterSource')} style={inp}><option value="">{t('select_source')}</option>{WATER_SOURCES.map(w=><option key={w}>{w}</option>)}</select></div>
      </div>

      <div style={{ display:'flex', gap:'12px', marginTop:'32px', justifyContent: 'flex-end' }}>
        {onCancel && <button onClick={onCancel} style={{ padding:'12px 24px', borderRadius:'30px', background:'transparent', border:`1px solid ${theme.border}`, color: theme.text, fontSize:'14px', fontWeight: 600, cursor:'pointer' }}>{t('cancel')}</button>}
        <button onClick={handleSave} disabled={saving} style={{ padding:'12px 32px', borderRadius:'30px', background: theme.accent, color: theme.accentText || '#000000', border:'none', fontSize:'14px', fontWeight:600, cursor:saving?'not-allowed':'pointer', boxShadow: '0 4px 14px rgba(0,210,255,0.25)' }}>
          {saving ? t('registering') : t('register_btn')}
        </button>
      </div>
    </div>
  );
}

function LandDetail({ parcel, onClose, onRemove, theme }) {
  const { t } = useLang();
  const rows = [
    [t('plot_survey'), parcel.plotNumber||'—'],
    [t('owner'),       parcel.ownerName||'—'],
    [t('village'),     parcel.village||'—'],
    [t('taluka'),      parcel.taluka||'—'],
    [t('district'),    parcel.district||'—'],
    [t('state'),       parcel.state||'—'],
    [t('area_label'),  parcel.area ? `${parcel.area} ha` : '—'],
    [t('crop'),        parcel.crop||'—'],
    [t('land_type'),   parcel.landType||'—'],
    [t('water_source'),parcel.waterSource||'—'],
    [t('registered_on'), parcel.addedAt?.seconds ? new Date(parcel.addedAt.seconds*1000).toLocaleDateString('mr-IN',{year:'numeric',month:'long',day:'numeric'}) : '—'],
  ];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(240,239,233,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
      <div style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'24px', padding:'32px', width:'100%', maxWidth:'640px', maxHeight:'90vh', overflowY:'auto', boxShadow: theme.shadow }}>
        
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
          <div>
            <div style={{ fontSize:'28px', fontWeight:400, color: theme.text, letterSpacing: '-0.02em' }}>गट {parcel.gatNumber||'—'}</div>
            <div style={{ fontSize:'13px', color: theme.text, opacity: 0.6, marginTop:'4px' }}>{[parcel.village, parcel.taluka, parcel.district].filter(Boolean).join(', ')}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color: theme.text, cursor:'pointer', fontSize:'28px', lineHeight:1 }}>×</button>
        </div>

        <div style={{ border:`1px solid ${theme.border}`, borderRadius:'16px', overflow:'hidden', marginBottom:'24px' }}>
          {rows.map(([k,v],i) => (
            <div key={k} style={{ display:'flex', borderBottom: i<rows.length-1?`1px solid ${theme.border}`:'none', background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
              <div style={{ width:'45%', padding:'12px 16px', fontSize:'13px', color: theme.text, opacity: 0.6, borderRight:`1px solid ${theme.border}` }}>{k}</div>
              <div style={{ flex:1, padding:'12px 16px', fontSize:'14px', color: theme.text, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:'24px' }}>
          <div style={{ fontSize:'11px', color: theme.text, opacity: 0.6, letterSpacing:'0.05em', fontWeight:600, textTransform: 'uppercase', marginBottom:'12px' }}>{t('official_extracts')}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            {[
              { label:t('download_712'), icon:<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>, key:'7/12' },
              { label:t('download_8a'),  icon:<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"></path></svg>, key:'8-A'  },
              { label:t('download_tauton'), icon:<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"></path></svg>, key:'tauton' },
            ].map(({ label, icon, key }) => (
              <button key={key} onClick={() => printDocument(key, parcel)}
                style={{ padding:'16px', borderRadius:'16px', background: theme.inputBg, border:`1px solid ${theme.border}`, color: theme.text, fontSize:'13px', fontWeight:600, cursor:'pointer', textAlign:'center', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor=theme.text}
                onMouseLeave={e => e.currentTarget.style.borderColor=theme.border}>
                <div style={{ fontSize:'24px', marginBottom:'8px' }}>{icon}</div>
                <div style={{ lineHeight:1.3 }}>{label}</div>
              </button>
            ))}
          </div>
        </div>

        {/*  Geo-Tagged Farm Photo */}
        <GeoTagPhoto theme={theme} parcelId={parcel.gatNumber} />

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => { onRemove(parcel); onClose(); }}
            style={{ padding:'12px 24px', borderRadius:'30px', background: '#fee2e2', border:`none`, color: '#dc2626', fontSize:'14px', fontWeight: 600, cursor:'pointer' }}>
            {t('remove_land')}
          </button>
        </div>
      </div>
    </div>
  );
}

function LandCard({ parcel, onClick, theme }) {
  return (
    <div onClick={onClick}
      style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'24px', padding:'24px', cursor:'pointer', transition:'all .2s ease', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow: theme.shadow }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = theme.text; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
        <div style={{ width:'48px', height:'48px', borderRadius:'12px', background: theme.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0, color:'#111' }}><Glyph name="sprout" size={24} /></div>
        <div>
          <div style={{ fontSize:'18px', fontWeight:500, color: theme.text }}>गट {parcel.gatNumber||'—'}</div>
          <div style={{ fontSize:'13px', color: theme.text, opacity: 0.6, marginTop:'4px' }}>{[parcel.village, parcel.taluka, parcel.district].filter(Boolean).join(', ')}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        {parcel.crop && <span style={{ fontSize:'12px', fontWeight: 600, padding:'6px 12px', borderRadius:'20px', background: theme.inputBg, color: theme.text, border:`1px solid ${theme.border}` }}>{parcel.crop}</span>}
        <span style={{ color: theme.text, fontSize:'24px', opacity: 0.4 }}>→</span>
      </div>
    </div>
  );
}

export default function MyLand({ user }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'parcels'), where('uid','==',user.uid));
    const unsub = onSnapshot(q, snap => {
      setParcels(snap.docs.map(d => ({ firestoreId:d.id, ...d.data() })));
      setLoading(false);
    }, ()=>setLoading(false));
    return unsub;
  }, [user]);

  const handleAdd = async (form) => { await addDoc(collection(db,'parcels'), { ...form, uid:user.uid, addedAt:serverTimestamp() }); setShowForm(false); };
  const handleRemove = async (parcel) => { if (!window.confirm(t('confirm_remove',{gat:parcel.gatNumber}))) return; if (parcel.firestoreId) await deleteDoc(doc(db,'parcels',parcel.firestoreId)); };
  const totalArea = parcels.reduce((s,p)=>s+(parseFloat(p.area)||0),0).toFixed(1);

  return (
    <div className="sc-page-gutter" style={{ padding:'20px 40px', maxWidth:'1400px', margin:'0 auto' }}>
      
      {/* ── Top Header Section ── */}
      <div className="sc-myland-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px' }}>
        <div>
          <div style={{ fontSize: '12px', color: theme.text, opacity: 0.6, letterSpacing: '0.02em', marginBottom: '4px', fontWeight: 600 }}>Active Registrations</div>
          <h1 style={{ fontSize: '40px', fontWeight: 400, color: theme.text, margin: 0, letterSpacing: '-0.04em' }}>{t('my_land_title')}</h1>
          <p style={{ fontSize:'14px', color: theme.text, opacity: 0.6, marginTop:'8px', margin: 0 }}>
            {loading ? 'Loading...' : parcels.length===0 ? t('no_land_sub') : `${parcels.length} ${t('total_lands')} · ${totalArea} ha`}
          </p>
        </div>
        {!showForm && (
          <button onClick={()=>setShowForm(true)} style={{ background: theme.text, color: theme.bg, border: 'none', borderRadius: '30px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {t('add_land')}
          </button>
        )}
      </div>

      {parcels.length > 0 && (
        <div className="resp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px', marginBottom:'32px' }}>
          {[
            [t('total_lands'), parcels.length, theme.text],
            [t('total_area'),  `${totalArea} ha`, theme.text],
            [t('districts'),   [...new Set(parcels.map(p=>p.district).filter(Boolean))].length, theme.text],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background: theme.card, border:`1px solid ${theme.border}`, borderRadius:'24px', padding:'24px', boxShadow: theme.shadow }}>
              <div style={{ fontSize:'40px', fontWeight:300, color:c, marginBottom:'8px' }}>{v}</div>
              <div style={{ fontSize:'13px', fontWeight:600, color: theme.text, opacity: 0.6 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && <AddParcelForm onSave={handleAdd} onCancel={()=>setShowForm(false)} theme={theme} />}

      {!loading && parcels.length===0 && !showForm && (
        <div style={{ textAlign:'center', padding:'80px 20px', background: theme.card, borderRadius:'24px', border:`1px dashed ${theme.border}`, boxShadow: theme.shadow }}>
          <div style={{ fontSize:'48px', marginBottom:'24px', color: theme.textMuted }}><Glyph name="sprout" size={48} /></div>
          <div style={{ fontSize:'24px', fontWeight:400, color: theme.text, marginBottom:'8px' }}>{t('no_land_title')}</div>
          <div style={{ fontSize:'14px', color: theme.text, opacity: 0.6, marginBottom:'32px', lineHeight:1.6 }}>{t('no_land_sub')}</div>
          <button onClick={()=>setShowForm(true)} style={{ padding:'12px 32px', background: theme.accent, color: theme.accentText || '#000000', border:'none', borderRadius:'30px', fontSize:'14px', fontWeight:600, cursor:'pointer', boxShadow: '0 4px 14px rgba(0,210,255,0.25)' }}>
            {t('add_first')}
          </button>
        </div>
      )}

      {parcels.length > 0 && (
        <div>
          <div style={{ fontSize:'11px', color: theme.text, opacity: 0.6, letterSpacing:'.05em', fontWeight:600, textTransform: 'uppercase', marginBottom:'16px' }}>{t('registered_lands')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {parcels.map(p => <LandCard key={p.firestoreId} parcel={p} onClick={()=>setSelected(p)} theme={theme} />)}
          </div>
        </div>
      )}

      {selected && <LandDetail parcel={selected} onClose={()=>setSelected(null)} onRemove={p=>{ handleRemove(p); setSelected(null); }} theme={theme} />}
    </div>
  );
}
