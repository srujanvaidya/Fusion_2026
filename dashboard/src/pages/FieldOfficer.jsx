import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DISTRICTS, formatIST } from '../data/maharashtra.js';
import { useLocationData, DISTRICT_MARATHI } from '../data/useLocationData';
import GeoTagPhoto from '../components/GeoTagPhoto';

export default function FieldOfficer({ user, profile }) {
  const [reports, setReports] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    district: '', taluka: '', village: '', gatNo: '',
    cropType: '', observation: '', damagePercent: '',
    lat: '', lon: '',
  });

  // JSON-backed cascading dropdowns
  const { talukasList, villagesList, loading: locLoading } = useLocationData(form.district, form.taluka);

  const isFieldOfficer = profile?.role === 'field_officer';

  // Online/offline tracking
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load past reports
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'field-reports'),
      where('uid', '==', user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, () => {});
    return unsub;
  }, [user]);

  const handleGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
      },
      () => { alert('Location access denied.'); setGpsLoading(false); }
    );
  };

  // Photo is handled by GeoTagPhoto component — no file input needed

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'field-reports'), {
        uid: user.uid,
        district: form.district,
        taluka: form.taluka,
        village: form.village,
        gatNo: form.gatNo,
        cropType: form.cropType,
        observation: form.observation,
        damagePercent: Number(form.damagePercent),
        gps: { lat: Number(form.lat), lon: Number(form.lon) },
        createdAt: serverTimestamp(),
      });
      setForm({
        district: '', taluka: '', village: '', gatNo: '', cropType: '',
        observation: '', damagePercent: '', lat: '', lon: '',
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error('Submission error:', err);
      alert('Submission failed. Check connection or Firestore permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isFieldOfficer) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '40px', color: '#1e1e1e' }}>⊘</div>
        <div style={{ fontSize: '16px', color: '#888', fontWeight: 600 }}>Access Denied</div>
        <div style={{ fontSize: '12px', color: '#777', textAlign: 'center', maxWidth: '300px' }}>
          This page is restricted to Field Officer accounts only.
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: '7px',
    background: '#111', border: '1px solid #1e1e1e', color: '#fff',
    fontSize: '12px', fontFamily: "inherit",
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Offline banner */}
      {!isOnline && (
        <div style={{
          background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: '8px',
          padding: '10px 16px', marginBottom: '16px', fontSize: '11px', color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>◉</span> Offline — Data will sync automatically when connection is restored.
        </div>
      )}

      {submitted && (
        <div style={{
          background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: '8px',
          padding: '10px 16px', marginBottom: '16px', fontSize: '11px', color: '#22c55e',
        }}>
          ✓ Field report submitted successfully.
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Field Data Collection</h1>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          GPS-tagged, time-stamped field reports with photo verification
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Form */}
        <div style={{
          background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '12px',
          padding: '24px', flex: 1, minWidth: '300px', maxWidth: '520px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>
            New Field Report
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* GPS */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em' }}>GPS COORDINATES</label>
                <button type="button" onClick={handleGPS} disabled={gpsLoading} style={{
                  padding: '4px 10px', borderRadius: '5px', fontSize: '9px',
                  fontFamily: "inherit", cursor: 'pointer',
                  background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630',
                }}>
                  {gpsLoading ? 'DETECTING...' : '⊕ CAPTURE GPS'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Latitude" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Longitude" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
              </div>
            </div>

            {/* District / Taluka / Village */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>जिल्हा / DISTRICT</label>
                <select style={inputStyle} value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value, taluka: '', village: '' }))} required>
                  <option value="" style={{ background: '#111' }}>जिल्हा निवडा...</option>
                  {DISTRICTS.map(d => <option key={d} value={d} style={{ background: '#111' }}>{DISTRICT_MARATHI[d] || d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>तालुका{locLoading ? ' …' : ''}</label>
                <select style={{ ...inputStyle, cursor: talukasList.length ? 'pointer' : 'not-allowed' }}
                  value={form.taluka} onChange={e => setForm(f => ({ ...f, taluka: e.target.value, village: '' }))}
                  disabled={locLoading || !talukasList.length} required>
                  <option value="" style={{ background: '#111' }}>तालुका निवडा...</option>
                  {talukasList.map(t => <option key={t} value={t} style={{ background: '#111' }}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>गाव / VILLAGE</label>
              <select style={{ ...inputStyle, cursor: villagesList.length ? 'pointer' : 'not-allowed' }}
                value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))}
                disabled={locLoading || !villagesList.length} required>
                <option value="" style={{ background: '#111' }}>गाव निवडा...</option>
                {villagesList.map(v => <option key={v} value={v} style={{ background: '#111' }}>{v}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>GAT NUMBER</label>
                <input style={inputStyle} placeholder="e.g. 142" value={form.gatNo} onChange={e => setForm(f => ({ ...f, gatNo: e.target.value }))} required />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>CROP TYPE</label>
                <input style={inputStyle} placeholder="e.g. Sugarcane" value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>OBSERVATION NOTES</label>
              <textarea
                style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
                placeholder="Describe crop condition, visible damage, water stress indicators..."
                value={form.observation}
                onChange={e => setForm(f => ({ ...f, observation: e.target.value }))}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>DAMAGE ESTIMATE (%)</label>
              <input
                type="number" min="0" max="100"
                style={inputStyle} placeholder="0–100"
                value={form.damagePercent}
                onChange={e => setForm(f => ({ ...f, damagePercent: e.target.value }))}
                required
              />
            </div>

            {/* Photo capture — live camera only, no file picker */}
            <div>
              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em', display: 'block', marginBottom: '6px' }}>FIELD PHOTO (GEO-TAGGED)</label>
              <GeoTagPhoto
                theme={{
                  card: '#0a0a0a', cardAlt: '#111', border: '#1e1e1e',
                  text: '#fff', textDim: '#888', textMuted: '#555',
                  accent: '#22c55e', accentBg: '#22c55e15', accentBorder: '#22c55e30',
                  danger: '#ef4444', dangerBg: '#fef2f2', dangerBorder: '#fca5a5',
                  inputBg: '#111', inputBorder: '#1e1e1e', shadow: 'none',
                }}
                parcelId={form.gatNo || 'field'}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '11px', borderRadius: '8px', fontSize: '11px',
                fontFamily: "inherit", cursor: 'pointer',
                background: submitting ? '#111' : '#22c55e',
                color: submitting ? '#888' : '#000',
                border: `1px solid ${submitting ? '#1e1e1e' : '#22c55e'}`,
                fontWeight: 600, letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT FIELD REPORT'}
            </button>
          </form>
        </div>

        {/* Past reports */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
            Audit Trail — Past Submissions
          </div>
          {reports.length === 0 ? (
            <div style={{
              background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px',
              padding: '30px', textAlign: 'center', fontSize: '11px', color: '#777',
            }}>No reports submitted yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {reports.map(r => (
                <div key={r.id} style={{
                  background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px',
                  padding: '16px', transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e1e'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
                      Gat {r.gatNo} — {r.village}
                    </div>
                    <span style={{
                      fontSize: '9px', color: '#22c55e', background: '#22c55e15',
                      padding: '2px 7px', borderRadius: '3px', border: '1px solid #22c55e30',
                    }}>IMMUTABLE</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                    {r.cropType} — {r.damagePercent}% damage
                  </div>
                  <div style={{ fontSize: '10px', color: '#777' }}>
                    GPS: {r.gps?.lat?.toFixed(4)}, {r.gps?.lon?.toFixed(4)}
                    {r.createdAt && ` · ${formatIST(r.createdAt)}`}
                  </div>
                  {r.observation && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', lineHeight: 1.5 }}>
                      {r.observation}
                    </div>
                  )}
                  {r.photoUrl && (
                    <a href={r.photoUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: '10px', color: '#3b82f6', marginTop: '6px', display: 'block' }}>
                      View Photo →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
