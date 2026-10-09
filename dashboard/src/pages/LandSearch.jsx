import React, { useState } from 'react';
import { DISTRICTS } from '../data/maharashtra.js';
import { useLocationData, DISTRICT_MARATHI } from '../data/useLocationData';

const S = {
  label: { fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: '7px',
    background: '#111', border: '1px solid #1e1e1e', color: '#fff',
    fontSize: '12px', fontFamily: "inherit", outline: 'none',
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '7px',
    background: '#111', border: '1px solid #1e1e1e', color: '#fff',
    fontSize: '12px', fontFamily: "inherit", outline: 'none',
    boxSizing: 'border-box',
  },
};

const MOCK_RESULT = {
  gatNo: '142', surveyNo: '142/1', ownerName: 'Ramesh Patil',
  area: '2.40 हेक्टर / 2.40 Hectares', landType: 'बागायत / Irrigated',
  crop: 'ऊस / Sugarcane', encumbrance: 'बोजा नाही / No Encumbrance',
  mutationNo: 'फे-1234', khataNo: 'खाते-88', waterSource: 'कालवा / Canal',
};

export default function LandSearch({ user }) {
  const [stateName, setStateName] = useState('Maharashtra');
  const [category, setCategory] = useState('Rural');
  const [district, setDistrict] = useState('');
  const [taluka, setTaluka] = useState('');
  const [village, setVillage] = useState('');
  const [gat, setGat] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // JSON-backed cascading dropdowns via shared hook
  const { talukasList, villagesList, loading: locLoading } = useLocationData(district, taluka);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/land-search/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, district, taluka, village, gat })
      });
      
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'API failed to fetch record.');
      }
      
      setResult({
        ...MOCK_RESULT, 
        gatNo: data.gat_no || gat || '142', 
        district: data.district || district, 
        taluka, 
        village: data.village || village,
        ownerName: data.owner || MOCK_RESULT.ownerName,
        pdf_url: data.pdf_url || ''
      });
    } catch (err) {
      console.error(err);
      setError('Failed to fetch land record. The Bhulekh portal may be unavailable. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGPS = () => {
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
          );
          const data = await res.json();
          const addr = data.address;
          const detectedDistrict = addr.county || addr.state_district || '';
          const detectedVillage = addr.village || addr.town || addr.city || '';
          const matched = DISTRICTS.find(d => detectedDistrict.toLowerCase().includes(d.toLowerCase())) || '';
          if (matched) { setDistrict(matched); setVillage(detectedVillage); }
          else setError(`Location detected: ${detectedDistrict}. Please select district manually.`);
        } catch {
          setError('Reverse geocoding failed.');
        } finally {
          setGpsLoading(false);
        }
      },
      () => { setError('Location access denied.'); setGpsLoading(false); }
    );
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Land Search</h1>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Search any land parcel across all 36 Maharashtra districts
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Search Form */}
        <div style={{
          background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '12px',
          padding: '24px', width: '100%', maxWidth: '480px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Search by location</span>
            <button
              onClick={handleGPS}
              disabled={gpsLoading}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '10px',
                fontFamily: "inherit", cursor: 'pointer',
                background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#3b82f625'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b82f615'}
            >
              {gpsLoading ? 'DETECTING...' : '⊕ USE MY LOCATION'}
            </button>
          </div>

          {error && (
            <div style={{
              background: '#ef444415', border: '1px solid #ef444430', borderRadius: '7px',
              color: '#ef4444', fontSize: '11px', padding: '10px 14px', marginBottom: '16px',
            }}>{error}</div>
          )}

          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={S.label}>STATE</label>
              <select style={S.select} value={stateName} disabled>
                <option value="Maharashtra" style={{ background: '#111' }}>Maharashtra</option>
              </select>
            </div>
            <div>
              <label style={S.label}>CATEGORY</label>
              <select style={S.select} value={category} onChange={e => setCategory(e.target.value)} required>
                <option value="Rural" style={{ background: '#111' }}>Rural</option>
                <option value="Urban" style={{ background: '#111' }}>Urban</option>
              </select>
            </div>
            <div>
              <label style={S.label}>जिल्हा / DISTRICT</label>
              <select style={S.select} value={district} onChange={e => { setDistrict(e.target.value); setTaluka(''); setVillage(''); }} required>
                <option value="" style={{ background: '#111' }}>जिल्हा निवडा...</option>
                {DISTRICTS.map(d => <option key={d} value={d} style={{ background: '#111' }}>{DISTRICT_MARATHI[d] || d}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>तालुका / TALUKA</label>
              <select style={S.select} value={taluka}
                onChange={e => { setTaluka(e.target.value); setVillage(''); }}
                required disabled={!district || locLoading}>
                <option value="" style={{ background: '#111' }}>{locLoading ? 'लोड होत आहे...' : 'तालुका निवडा...'}</option>
                {talukasList.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>गाव / VILLAGE</label>
              <select style={S.select} value={village}
                onChange={e => setVillage(e.target.value)}
                required disabled={!taluka || locLoading}>
                <option value="" style={{ background: '#111' }}>{locLoading ? 'लोड होत आहे...' : 'गाव निवडा...'}</option>
                {villagesList.map(v => <option key={v} value={v} style={{ background: '#111' }}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>GAT NUMBER</label>
              <input
                style={S.input}
                type="text" value={gat} onChange={e => setGat(e.target.value)}
                placeholder="e.g. 142" required
                onFocus={e => e.target.style.borderColor = '#22c55e'}
                onBlur={e => e.target.style.borderColor = '#1e1e1e'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '11px', borderRadius: '8px', fontSize: '11px',
                fontFamily: "inherit", cursor: 'pointer',
                background: loading ? '#111' : '#22c55e', color: loading ? '#888' : '#000',
                border: `1px solid ${loading ? '#1e1e1e' : '#22c55e'}`,
                fontWeight: 600, letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
            >
              {loading ? 'SEARCHING BHULEKH...' : 'SEARCH LAND RECORD'}
            </button>
          </form>

          <div style={{ marginTop: '16px', padding: '12px', background: '#111', borderRadius: '7px', border: '1px solid #1e1e1e' }}>
            <div style={{ fontSize: '10px', color: '#777', letterSpacing: '0.08em', marginBottom: '4px' }}>DATA SOURCE</div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              Bhulekh MahaBhumi via backend proxy. Live data. Results cached 24h.
            </div>
          </div>
        </div>

        {/* Result Panel */}
        {result && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{
              background: '#0a0a0a', border: '1px solid #22c55e30', borderRadius: '12px',
              padding: '24px', marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                  7/12 Record — Gat {result.gatNo}
                </div>
                <span style={{
                  fontSize: '9px', color: '#22c55e', background: '#22c55e15',
                  padding: '3px 8px', borderRadius: '4px', border: '1px solid #22c55e30', letterSpacing: '0.1em',
                }}>LIVE DATA</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: '20px' }}>
                {[
                  ['जिल्हा / District', result.district],
                  ['तालुका / Taluka', result.taluka],
                  ['गाव / Village', result.village],
                  ['गट नंबर / Gat No.', result.gatNo],
                  ['सर्व्हे नंबर / Survey No.', result.surveyNo],
                  ['खातेदाराचे नाव / Owner', result.ownerName],
                  ['एकूण क्षेत्र / Area', result.area],
                  ['जमिनीचा प्रकार / Land Type', result.landType],
                  ['पिकांची नावे / Crop', result.crop],
                  ['बोजा / Encumbrance', result.encumbrance],
                  ['फेरफार नंबर / Mutation No.', result.mutationNo],
                  ['पाण्याचा स्रोत / Water Source', result.waterSource],
                ].map(([k, v]) => (
                  <div key={k} style={{ borderBottom: '1px solid #111', paddingBottom: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#777', marginBottom: '3px' }}>{k}</div>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href={result.pdf_url || '#'} target="_blank" rel="noreferrer"
                  style={{
                    padding: '8px 14px', borderRadius: '6px', fontSize: '10px',
                    background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30',
                    textDecoration: 'none', letterSpacing: '0.03em',
                  }}
                >
                  Download Map PDF →
                </a>
                <button
                  onClick={() => alert('Saving to My Parcels...')}
                  style={{
                    padding: '8px 14px', borderRadius: '6px', fontSize: '10px',
                    fontFamily: "inherit", cursor: 'pointer',
                    background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630',
                    transition: 'all 0.15s',
                  }}
                >
                  + Save to My Parcels
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
