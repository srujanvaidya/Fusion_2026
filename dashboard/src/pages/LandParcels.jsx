import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { INDIA_STATES, getDistricts } from '../data/locationData';
import { useLocationData, DISTRICT_MARATHI } from '../data/useLocationData';
import Glyph from '../components/icons/Glyph';

const CROPS = ['Sugarcane','Wheat','Rice','Cotton','Soybean','Onion','Jowar','Bajra','Tur','Groundnut','Maize','Gram','Sunflower','Turmeric','Ginger'];
const LAND_TYPES = ['Irrigated','Rain-fed','Partially irrigated','Dryland'];
const WATER_SOURCES = ['Canal','Borewell','River','Rain','Well','Tank','Drip Irrigation'];

const inp = {
  width:'100%', padding:'10px 12px', background:'#111', border:'1px solid #222',
  borderRadius:'7px', color:'#fff', fontSize:'12px', fontFamily:'inherit',
  outline:'none', boxSizing:'border-box', transition:'border-color .15s', appearance:'none',
};

function Label({ children }) {
  return <label style={{ fontSize:'10px', color:'#777', display:'block', marginBottom:'5px', letterSpacing:'0.08em' }}>{children}</label>;
}

function SectionHead({ children }) {
  return <div style={{ fontSize:'10px', color:'#555', letterSpacing:'.15em', fontWeight:600, margin:'18px 0 10px', borderBottom:'1px solid #141414', paddingBottom:'6px' }}>{children}</div>;
}

// ─── Add / Edit Parcel Modal ─────────────────────────────────────────────────
function ParcelModal({ onSave, onClose, existing }) {
  const [form, setForm] = useState(existing || {
    gatNumber:'', plotNumber:'', state:'Maharashtra', district:'', taluka:'', village:'',
    area:'', crop:'', landType:'', waterSource:'', ownerName:'',
  });
  const [districtOpts, setDistrictOpts] = useState(getDistricts(form.state || 'Maharashtra'));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const { talukasList, villagesList, loading: locLoading } = useLocationData(form.district, form.taluka);

  const onState = v => {
    setForm(f => ({ ...f, state:v, district:'', taluka:'', village:'' }));
    setDistrictOpts(getDistricts(v));
  };
  const onDistrict = v => {
    setForm(f => ({ ...f, district:v, taluka:'', village:'' }));
  };

  const handleSave = async () => {
    if (!form.gatNumber.trim()) { setError('GAT number is required.'); return; }
    if (!form.village.trim())   { setError('Village is required.'); return; }
    setSaving(true); setError('');
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#0a0a0a', border:'1px solid #1e1e1e', borderRadius:'14px', padding:'28px', width:'100%', maxWidth:'520px', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ fontSize:'16px', fontWeight:600, color:'#fff', margin:0 }}>{existing ? 'Edit Land Parcel' : 'Add Land Parcel'}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#777', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
        </div>

        {error && <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', color:'#ef4444', fontSize:'11px', padding:'9px 12px', borderRadius:'7px', marginBottom:'14px' }}>{error}</div>}

        <SectionHead>LAND IDENTIFICATION</SectionHead>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><Label>GAT NUMBER *</Label><input value={form.gatNumber} onChange={set('gatNumber')} placeholder="e.g. 1234" style={inp} onFocus={e=>e.target.style.borderColor='#22c55e'} onBlur={e=>e.target.style.borderColor='#222'} /></div>
          <div><Label>PLOT / SURVEY NO.</Label><input value={form.plotNumber} onChange={set('plotNumber')} placeholder="e.g. A-4" style={inp} onFocus={e=>e.target.style.borderColor='#22c55e'} onBlur={e=>e.target.style.borderColor='#222'} /></div>
          <div><Label>LAND AREA (hectares)</Label><input type="number" min="0" step="0.01" value={form.area} onChange={set('area')} placeholder="e.g. 2.5" style={inp} onFocus={e=>e.target.style.borderColor='#22c55e'} onBlur={e=>e.target.style.borderColor='#222'} /></div>
          <div><Label>OWNER NAME</Label><input value={form.ownerName} onChange={set('ownerName')} placeholder="As per 7/12" style={inp} onFocus={e=>e.target.style.borderColor='#22c55e'} onBlur={e=>e.target.style.borderColor='#222'} /></div>
        </div>

        <SectionHead>LOCATION</SectionHead>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><Label>STATE</Label>
            <select value={form.state} onChange={e=>onState(e.target.value)} style={inp}>
              <option value="">Select state</option>
              {INDIA_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label>DISTRICT</Label>
            <select value={form.district} onChange={e=>onDistrict(e.target.value)} disabled={!districtOpts.length} style={{ ...inp, cursor:districtOpts.length?'pointer':'not-allowed' }}>
              <option value="">Select district</option>
              {districtOpts.map(d=><option key={d} value={d}>{DISTRICT_MARATHI[d]||d}</option>)}
            </select>
          </div>
          <div><Label>TALUKA</Label>
            <select value={form.taluka} onChange={e=>setForm(f=>({...f,taluka:e.target.value,village:''}))} disabled={locLoading || !talukasList.length} style={{ ...inp, cursor:talukasList.length?'pointer':'not-allowed' }}>
              <option value="">{locLoading ? 'Loading...' : 'Select taluka'}</option>
              {talukasList.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>VILLAGE *</Label>
            <select value={form.village} onChange={set('village')} disabled={locLoading || !villagesList.length} style={{ ...inp, cursor:villagesList.length?'pointer':'not-allowed' }}>
              <option value="">{locLoading ? 'Loading...' : 'Select village'}</option>
              {villagesList.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <SectionHead>CROP & LAND DETAILS</SectionHead>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
          <div><Label>CROP TYPE</Label>
            <select value={form.crop} onChange={set('crop')} style={inp}>
              <option value="">Select crop</option>
              {CROPS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>LAND TYPE</Label>
            <select value={form.landType} onChange={set('landType')} style={inp}>
              <option value="">Select type</option>
              {LAND_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>WATER SOURCE</Label>
            <select value={form.waterSource} onChange={set('waterSource')} style={inp}>
              <option value="">Select source</option>
              {WATER_SOURCES.map(w=><option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:'10px', marginTop:'22px' }}>
          <button onClick={onClose} style={{ padding:'10px 20px', borderRadius:'7px', background:'transparent', border:'1px solid #222', color:'#777', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'10px', borderRadius:'7px', background:'#22c55e', color:'#000', border:'none', fontSize:'12px', fontWeight:700, cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', opacity:saving?.7:1 }}>
            {saving ? 'Saving…' : existing ? 'Update Parcel' : 'Add to My Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Parcel Card ─────────────────────────────────────────────────────────────
function ParcelCard({ parcel, onRemove, isFarmerOwner }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'18px', cursor:'pointer', transition:'border-color .15s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}
      onClick={()=>setExpanded(!expanded)}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'13px', fontWeight:600, color:'#fff' }}>Gat {parcel.gatNumber || parcel.gatNo}</span>
            {parcel.crop && <span style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'3px', background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>{parcel.crop}</span>}
          </div>
          <div style={{ fontSize:'12px', color:'#888', marginTop:'3px' }}>
            {[parcel.village, parcel.taluka, parcel.district].filter(Boolean).join(', ')}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {parcel.area && <span style={{ fontSize:'13px', color:'#ccc', fontWeight:500 }}>{parcel.area} ha</span>}
          {isFarmerOwner && (
            <button onClick={e=>{e.stopPropagation(); onRemove(parcel);}}
              style={{ background:'transparent', border:'none', color:'#555', cursor:'pointer', fontSize:'18px', lineHeight:1, padding:'2px 4px' }}
              onMouseEnter={e=>e.currentTarget.style.color='#ef4444'}
              onMouseLeave={e=>e.currentTarget.style.color='#555'}>×</button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
          {[
            ['Plot / Survey No.', parcel.plotNumber || '—'],
            ['Owner', parcel.ownerName || '—'],
            ['Land Type', parcel.landType || '—'],
            ['Water Source', parcel.waterSource || '—'],
            ['State', parcel.state || '—'],
            ['Added', parcel.addedAt?.seconds ? new Date(parcel.addedAt.seconds*1000).toLocaleDateString('en-IN') : '—'],
          ].map(([k,v])=>(
            <div key={k}>
              <div style={{ fontSize:'9px', color:'#666', marginBottom:'2px', letterSpacing:'.05em' }}>{k.toUpperCase()}</div>
              <div style={{ fontSize:'12px', color:'#ccc' }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandParcels({ user, profile }) {
  const role       = profile?.role || 'farmer';
  const isFarmer   = role === 'farmer';

  const [parcels,       setParcels]       = useState([]);
  const [allParcels,    setAllParcels]    = useState([]);
  const [showModal,     setShowModal]     = useState(false);
  const [filterDistrict, setFilterDistrict] = useState('');
  const [loading,       setLoading]       = useState(true);

  // Farmer: load own parcels. GP/Talathi: load all parcels
  useEffect(() => {
    if (!user) return;
    let q;
    if (isFarmer) {
      q = query(collection(db, 'parcels'), where('uid', '==', user.uid));
    } else {
      q = collection(db, 'parcels');
    }
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ firestoreId:d.id, ...d.data() }));
      if (isFarmer) setParcels(data);
      else { setAllParcels(data); setParcels(data); }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user, isFarmer]);

  // Filter for GP/Talathi
  const displayParcels = isFarmer ? parcels : (filterDistrict ? allParcels.filter(p=>p.district===filterDistrict) : allParcels);
  const allDistricts   = [...new Set(allParcels.map(p=>p.district).filter(Boolean))].sort();

  const handleAdd = async (form) => {
    await addDoc(collection(db,'parcels'), {
      ...form,
      uid: user.uid,
      addedAt: serverTimestamp(),
    });
  };

  const handleRemove = async (parcel) => {
    if (!window.confirm(`Remove Gat ${parcel.gatNumber || parcel.gatNo} from your dashboard?`)) return;
    if (parcel.firestoreId) await deleteDoc(doc(db,'parcels',parcel.firestoreId));
  };

  const totalArea = displayParcels.reduce((s,p)=>s+(parseFloat(p.area)||0),0).toFixed(1);

  return (
    <div style={{ padding:'24px', minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:600, color:'#fff', margin:0 }}>
            {isFarmer ? 'My Land Parcels' : 'All Registered Parcels'}
          </h1>
          <p style={{ fontSize:'12px', color:'#888', marginTop:'4px' }}>
            {isFarmer
              ? (loading ? 'Loading…' : parcels.length===0 ? 'Add your GAT numbers to register your land.' : `${parcels.length} registered parcel${parcels.length!==1?'s':''}`)
              : `${displayParcels.length} parcel${displayParcels.length!==1?'s':''} registered by farmers`}
          </p>
        </div>
        {isFarmer && (
          <button onClick={()=>setShowModal(true)}
            style={{ padding:'10px 18px', borderRadius:'8px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', background:'#22c55e', color:'#000', border:'none', fontWeight:600 }}>
            + Add Land
          </button>
        )}
      </div>

      {/* GP/Talathi district filter */}
      {!isFarmer && allDistricts.length > 0 && (
        <div style={{ marginBottom:'16px' }}>
          <select value={filterDistrict} onChange={e=>{setFilterDistrict(e.target.value); setParcels(e.target.value ? allParcels.filter(p=>p.district===e.target.value) : allParcels);}}
            style={{ ...inp, maxWidth:'260px' }}>
            <option value="">All Districts</option>
            {allDistricts.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Stats */}
      {displayParcels.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
          {[
            ['TOTAL PARCELS', displayParcels.length, '#22c55e'],
            ['TOTAL AREA', `${totalArea} ha`, '#fff'],
            ['DISTRICTS', [...new Set(displayParcels.map(p=>p.district).filter(Boolean))].length, '#3b82f6'],
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:'#0d0d0d', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'10px', padding:'16px 18px' }}>
              <div style={{ fontSize:'10px', color:'#777', letterSpacing:'.1em', marginBottom:'5px' }}>{l}</div>
              <div style={{ fontSize:'22px', fontWeight:600, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state — farmer */}
      {isFarmer && !loading && parcels.length===0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#0d0d0d', borderRadius:'12px', border:'1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:'36px', marginBottom:'12px' }}><Glyph name="sprout" size={36} color="#777" /></div>
          <div style={{ fontSize:'15px', fontWeight:500, color:'#ddd', marginBottom:'8px' }}>No land parcels added yet</div>
          <div style={{ fontSize:'12px', color:'#888', marginBottom:'20px' }}>Register your GAT number with location details — your data will be saved and available each time you log in</div>
          <button onClick={()=>setShowModal(true)}
            style={{ padding:'11px 24px', background:'#22c55e', color:'#000', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            + Add Your First GAT
          </button>
        </div>
      )}

      {/* Empty state — GP/Talathi */}
      {!isFarmer && !loading && displayParcels.length===0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#0d0d0d', borderRadius:'12px', border:'1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize:'36px', marginBottom:'12px' }}><Glyph name="building" size={36} color="#777" /></div>
          <div style={{ fontSize:'15px', fontWeight:500, color:'#ddd', marginBottom:'8px' }}>No registered parcels found</div>
          <div style={{ fontSize:'12px', color:'#888' }}>Farmers who register their land will appear here</div>
        </div>
      )}

      {/* Parcels list */}
      {displayParcels.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {displayParcels.map(p=>(
            <ParcelCard key={p.firestoreId} parcel={p} onRemove={handleRemove} isFarmerOwner={isFarmer} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && <ParcelModal onSave={handleAdd} onClose={()=>setShowModal(false)} />}
    </div>
  );
}
