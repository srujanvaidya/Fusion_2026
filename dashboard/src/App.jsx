import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Layout from './components/Layout';
import Home              from './pages/Home';
import MyLand            from './pages/MyLand';
import Weather           from './pages/Weather';
import NDVIHealth        from './pages/NDVIHealth';
import CropStressWatch   from './pages/CropStressWatch';
import InsuranceClaims   from './pages/InsuranceClaims';
import Schemes           from './pages/Schemes';
import Profile           from './pages/Profile';
import DisasterVerification from './pages/DisasterVerification';

import { INDIA_STATES, getDistricts, getTalukas } from './data/locationData';
import { useFullLocationData } from './data/useFullLocationData';
import Glyph from './components/icons/Glyph';

const googleProvider = new GoogleAuthProvider();

const ROLES = [
  { id: 'farmer',         label: 'Farmer',          icon: 'sprout', desc: 'Agricultural land owner / cultivator',   color: '#22c55e' },
  { id: 'gram_panchayat', label: 'Gram Panchayat',  icon: 'building', desc: 'Local self-governance worker',           color: '#3b82f6' },
  { id: 'talathi',        label: 'Talathi',          icon: 'clipboard', desc: 'Revenue / land records official',        color: '#f59e0b' },
];

const inp = {
  width: '100%', padding: '10px 13px', background: 'var(--auth-input)',
  border: '1px solid var(--auth-input-border)', borderRadius: '8px', color: 'var(--auth-text)',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'border-color 0.15s',
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', color: 'var(--auth-dim)', marginBottom: '5px', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  );
}

const ERR_MAP = {
  'auth/invalid-credential':   'Invalid email or password.',
  'auth/user-not-found':       'No account with this email.',
  'auth/wrong-password':       'Incorrect password.',
  'auth/email-already-in-use': 'Email already registered.',
  'auth/weak-password':        'Password must be 6+ characters.',
  'auth/invalid-email':        'Invalid email address.',
};

const DEMO_PROFILES = {
  farmer: {
    uid: 'demo-farmer-01',
    displayName: 'Ramesh Patil',
    email: 'ramesh.farmer@dhara.agri',
    name: 'Ramesh Patil',
    phone: '+91 98220 12345',
    role: 'farmer',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Khadakwasla',
    gatNumber: '1204',
    plotNumber: '2B',
    state: 'Maharashtra',
    myGats: [
      { gatNumber: '1204', crop: 'Rice (Kharif)', areaAcres: 3.5, health: 'Healthy', ndvi: 0.74 },
      { gatNumber: '1205', crop: 'Soybean', areaAcres: 2.0, health: 'Normal', ndvi: 0.68 },
      { gatNumber: '1206', crop: 'Sugarcane', areaAcres: 1.8, health: 'Good', ndvi: 0.79 },
    ]
  },
  gram_panchayat: {
    uid: 'demo-gp-01',
    displayName: 'Suresh More (Gram Sevak)',
    email: 'gp.khadakwasla@dhara.agri',
    name: 'Suresh More',
    phone: '+91 98220 54321',
    role: 'gram_panchayat',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Khadakwasla',
    gramPanchayatName: 'Khadakwasla Gram Panchayat',
    ward: 'Ward 2',
    employeeId: 'GP-PUN-084',
    state: 'Maharashtra',
    myGats: []
  },
  talathi: {
    uid: 'demo-talathi-01',
    displayName: 'Sunil Jadhav (Talathi)',
    email: 'talathi.haveli@dhara.agri',
    name: 'Sunil Jadhav',
    phone: '+91 98220 99887',
    role: 'talathi',
    district: 'Pune',
    taluka: 'Haveli',
    village: 'Khadakwasla',
    circle: 'Haveli Mandal',
    badgeNumber: 'MH-PUN-TAL-12',
    employeeId: 'TAL-2024-042',
    state: 'Maharashtra',
    myGats: []
  }
};

function AuthPage({ onEnterDemo }) {
  // Auto-start in signup mode if URL has ?signup=true
  const initialMode = new URLSearchParams(window.location.search).get('signup') === 'true' ? 'signup' : 'login';

  const [mode, setMode]       = useState(initialMode);
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Step 1
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Step 2 — common
  const [role, setRole]       = useState('farmer');
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [state, setState_]    = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [taluka, setTaluka]   = useState('');
  const [village, setVillage] = useState('');

  // Cascading options for signup
  const [signupDistrictOpts, setSignupDistrictOpts] = useState(getDistricts('Maharashtra'));

  const { talukasList: signupTalukaOpts, villagesList: signupVillageOpts, loading: locLoading } = useFullLocationData(district, taluka);

  const onSignupStateChange = (val) => {
    setState_(val);
    setDistrict(''); setTaluka(''); setVillage('');
    setSignupDistrictOpts(getDistricts(val));
  };
  const onSignupDistrictChange = (val) => {
    setDistrict(val); setTaluka(''); setVillage('');
  };

  // Farmer-specific
  const [gatNumber, setGatNumber]   = useState('');
  const [plotNumber, setPlotNumber] = useState('');

  // Gram Panchayat-specific
  const [gpName, setGpName]   = useState('');
  const [ward, setWard]       = useState('');
  const [empId, setEmpId]     = useState('');

  // Talathi-specific
  const [circle, setCircle]         = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [talathiEmpId, setTalathiEmpId] = useState('');

  const activeRole = ROLES.find(r => r.id === role) || ROLES[0];

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) {
      console.warn('Firebase login bypassed in frontend mode:', err);
      if (onEnterDemo) {
        onEnterDemo(role, { email, name: email ? email.split('@')[0] : activeRole.label });
      } else {
        setError(ERR_MAP[err.code] || 'Login failed.');
      }
    }
    finally { setLoading(false); }
  };

  const handleSignupStep1 = (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password required.'); return; }
    if (password.length < 6)  { setError('Password must be 6+ characters.'); return; }
    setError(''); setStep(2);
  };

  const handleSignupStep2 = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Full name is required.'); return; }
    setLoading(true); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
      const base = { name: name.trim(), phone, village, taluka, district, state: state, role, email: cred.user.email, myGats: [], createdAt: serverTimestamp() };
      if (role === 'farmer') {
        Object.assign(base, { gatNumber, plotNumber });
      } else if (role === 'gram_panchayat') {
        Object.assign(base, { gramPanchayatName: gpName, ward, employeeId: empId });
      } else if (role === 'talathi') {
        Object.assign(base, { circle, badgeNumber, employeeId: talathiEmpId });
      }
      await setDoc(doc(db, 'users', cred.user.uid), base, { merge: true });
    } catch (err) {
      console.warn('Firebase registration bypassed in frontend mode:', err);
      if (onEnterDemo) {
        onEnterDemo(role, { name, phone, village, taluka, district, state, role, email });
      } else {
        setError(ERR_MAP[err.code] || 'Registration failed.');
      }
    }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      const ref = doc(db, 'users', u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { name: u.displayName || '', email: u.email, phone: '', village: '', taluka: '', district: '', state: 'Maharashtra', role: 'farmer', myGats: [], createdAt: serverTimestamp() });
      }
    } catch (err) { if (err.code !== 'auth/popup-closed-by-user') setError('Google sign-in failed.'); }
    finally { setLoading(false); }
  };

  const btnStyle = { width: '100%', padding: '11px', background: '#fff', color: 'var(--auth-page)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', transition: 'background 0.15s' };

  const onFocus = (c) => (e) => { e.target.style.borderColor = c; };
  const onBlur  = (e) => { e.target.style.borderColor = 'var(--auth-input-border)'; };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--auth-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--auth-card)', border: '1px solid var(--auth-border)', borderRadius: '16px', padding: '32px 28px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--auth-text)', letterSpacing: '-0.03em', marginBottom: '4px' }}>Dhara</div>
          <div style={{ fontSize: '9px', color: 'var(--auth-dim)', letterSpacing: '0.15em' }}>AGRI INTELLIGENCE PLATFORM</div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '11px', padding: '9px 13px', borderRadius: '8px', marginBottom: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--auth-text)', marginBottom: '18px' }}>Sign in</h2>

            {/* Role selector */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', color: 'var(--auth-dim)', letterSpacing: '0.1em', marginBottom: '8px' }}>I AM A</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {ROLES.map(r => {
                  const isActive = role === r.id;
                  return (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)}
                      style={{
                        padding: '10px 6px', borderRadius: '10px', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                        background: isActive ? `${r.color}18` : 'var(--auth-input)',
                        border: `1px solid ${isActive ? r.color : 'var(--auth-input-border)'}`,
                        color: isActive ? r.color : 'var(--auth-dim)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}><Glyph name={r.icon} size={20} /></div>
                      <div style={{ fontSize: '10px', fontWeight: isActive ? 700 : 400, letterSpacing: '0.02em' }}>{r.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onEnterDemo && onEnterDemo(role)}
              style={{
                width: '100%',
                padding: '11px',
                background: '#F6EE74',
                border: 'none',
                borderRadius: '8px',
                color: '#0E1712',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
            >
               Explore {activeRole.label} Dashboard (Frontend Demo)
            </button>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="EMAIL">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
              </Field>
              <Field label="PASSWORD">
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
              </Field>
              <button type="submit" disabled={loading} style={{ ...btnStyle, background: activeRole.color, color: 'var(--auth-page)' }} onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.85'; }} onMouseLeave={e => e.target.style.opacity = '1'}>
                {loading ? 'Signing in…' : `Sign in as ${activeRole.label}`}
              </button>
            </form>
            <Divider />
            <GoogleBtn onClick={handleGoogle} loading={loading} />
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--auth-dim)' }}>
              No account?{' '}
              <button onClick={() => { setMode('signup'); setStep(1); setError(''); }} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>Create one</button>
            </p>
          </>
        )}

        {/* ── SIGNUP STEP 1 — credentials ── */}
        {mode === 'signup' && step === 1 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--auth-text)', margin: 0 }}>Create account</h2>
              <span style={{ fontSize: '10px', color: 'var(--auth-dim)' }}>Step 1 of 2</span>
            </div>
            <form onSubmit={handleSignupStep1} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="EMAIL ADDRESS">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inp} onFocus={onFocus('#22c55e')} onBlur={onBlur} />
              </Field>
              <Field label="PASSWORD">
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" style={inp} onFocus={onFocus('#22c55e')} onBlur={onBlur} />
              </Field>
              <button type="submit" style={btnStyle}>Continue →</button>
            </form>
            <Divider />
            <GoogleBtn onClick={handleGoogle} loading={loading} />
            <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--auth-dim)' }}>
              Have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>Sign in</button>
            </p>
          </>
        )}

        {/* ── SIGNUP STEP 2 — role + profile ── */}
        {mode === 'signup' && step === 2 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--auth-text)', margin: 0 }}>Your Profile</h2>
              <span style={{ fontSize: '10px', color: 'var(--auth-dim)' }}>Step 2 of 2</span>
            </div>

            {/* Role selector */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', color: 'var(--auth-dim)', letterSpacing: '0.1em', marginBottom: '8px' }}>I AM A</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {ROLES.map(r => {
                  const isActive = role === r.id;
                  return (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)}
                      style={{
                        padding: '10px 6px', borderRadius: '10px', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                        background: isActive ? `${r.color}18` : 'var(--auth-input)',
                        border: `1px solid ${isActive ? r.color : 'var(--auth-input-border)'}`,
                        color: isActive ? r.color : 'var(--auth-dim)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}><Glyph name={r.icon} size={20} /></div>
                      <div style={{ fontSize: '10px', fontWeight: isActive ? 700 : 400, letterSpacing: '0.02em' }}>{r.label}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--auth-dim)', marginTop: '6px', textAlign: 'center' }}>{activeRole.desc}</div>
            </div>

            <form onSubmit={handleSignupStep2} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Common */}
              <Field label="FULL NAME *">
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh Kadam" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
              </Field>
              <Field label="PHONE NUMBER">
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 9876543210" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
              </Field>

              {/* Location — cascading State → District → Taluka → Village */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="STATE">
                  <select value={state} onChange={e => onSignupStateChange(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }} onFocus={onFocus(activeRole.color)} onBlur={onBlur}>
                    <option value="">Select state</option>
                    {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="DISTRICT">
                  <select value={district} onChange={e => onSignupDistrictChange(e.target.value)} disabled={!signupDistrictOpts.length} style={{ ...inp, appearance: 'none', cursor: signupDistrictOpts.length ? 'pointer' : 'not-allowed' }} onFocus={onFocus(activeRole.color)} onBlur={onBlur}>
                    <option value="">Select district</option>
                    {signupDistrictOpts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="TALUKA">
                  <select value={taluka} onChange={e => { setTaluka(e.target.value); setVillage(''); }} disabled={!signupTalukaOpts.length || locLoading} style={{ ...inp, appearance: 'none', cursor: signupTalukaOpts.length ? 'pointer' : 'not-allowed' }} onFocus={onFocus(activeRole.color)} onBlur={onBlur}>
                    <option value="">{locLoading ? 'Loading...' : 'Select taluka'}</option>
                    {signupTalukaOpts.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="VILLAGE">
                  <select value={village} onChange={e => setVillage(e.target.value)} disabled={!signupVillageOpts.length || locLoading} style={{ ...inp, appearance: 'none', cursor: signupVillageOpts.length ? 'pointer' : 'not-allowed' }} onFocus={onFocus(activeRole.color)} onBlur={onBlur}>
                    <option value="">{locLoading ? 'Loading...' : 'Select village'}</option>
                    {signupVillageOpts.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
              </div>

              {/* Farmer-specific */}
              {role === 'farmer' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="GAT NUMBER">
                    <input value={gatNumber} onChange={e => setGatNumber(e.target.value)} placeholder="e.g. 1234" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                  </Field>
                  <Field label="PLOT NUMBER">
                    <input value={plotNumber} onChange={e => setPlotNumber(e.target.value)} placeholder="e.g. A-4" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                  </Field>
                </div>
              )}

              {/* Gram Panchayat-specific */}
              {role === 'gram_panchayat' && (
                <>
                  <Field label="GRAM PANCHAYAT NAME">
                    <input value={gpName} onChange={e => setGpName(e.target.value)} placeholder="e.g. Khadakwasla GP" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="WARD / ZONE">
                      <input value={ward} onChange={e => setWard(e.target.value)} placeholder="Ward 3" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                    </Field>
                    <Field label="EMPLOYEE ID">
                      <input value={empId} onChange={e => setEmpId(e.target.value)} placeholder="GP-2024-001" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                    </Field>
                  </div>
                </>
              )}

              {/* Talathi-specific */}
              {role === 'talathi' && (
                <>
                  <Field label="CIRCLE / MANDAL">
                    <input value={circle} onChange={e => setCircle(e.target.value)} placeholder="e.g. Haveli Circle" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <Field label="EMPLOYEE ID">
                      <input value={talathiEmpId} onChange={e => setTalathiEmpId(e.target.value)} placeholder="TAL-2024-001" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                    </Field>
                    <Field label="BADGE NUMBER">
                      <input value={badgeNumber} onChange={e => setBadgeNumber(e.target.value)} placeholder="MH-PUN-T-042" style={inp} onFocus={onFocus(activeRole.color)} onBlur={onBlur} />
                    </Field>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setStep(1)} style={{ ...btnStyle, background: 'transparent', color: '#777', border: '1px solid #1e1e1e', width: 'auto', padding: '11px 16px', flex: '0 0 auto' }}>← Back</button>
                <button type="submit" disabled={loading} style={{ ...btnStyle, background: activeRole.color, color: '#000' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
      <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
      <span style={{ fontSize: '10px', color: '#444', letterSpacing: '0.08em' }}>OR</span>
      <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
    </div>
  );
}

function GoogleBtn({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ width: '100%', padding: '10px', background: 'var(--auth-input)', border: '1px solid var(--auth-input-border)', borderRadius: '8px', color: 'var(--auth-dim)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'inherit', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#888'; }}>
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('dhara_signed_out') === 'true') {
      return null;
    }
    const role = (typeof window !== 'undefined' && localStorage.getItem('dhara_demo_role')) || 'farmer';
    return DEMO_PROFILES[role] || DEMO_PROFILES.farmer;
  });

  const [profile, setProfile] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('dhara_signed_out') === 'true') {
      return null;
    }
    const role = (typeof window !== 'undefined' && localStorage.getItem('dhara_demo_role')) || 'farmer';
    return DEMO_PROFILES[role] || DEMO_PROFILES.farmer;
  });

  const enterDemo = (role = 'farmer', custom = {}) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dhara_signed_out');
      localStorage.setItem('dhara_demo_role', role);
    }
    const base = DEMO_PROFILES[role] || DEMO_PROFILES.farmer;
    const merged = { ...base, ...custom, role };
    setUser(merged);
    setProfile(merged);
  };

  useEffect(() => {
    let unsubSnap = () => {};

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      unsubSnap();
      if (u) {
        if (typeof window !== 'undefined') localStorage.removeItem('dhara_signed_out');
        setUser(u);
        const ref = doc(db, 'users', u.uid);

        try {
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, {
              name: u.displayName || '',
              email: u.email || '',
              phone: '', village: '', taluka: '',
              district: '', state: 'Maharashtra',
              role: 'farmer', myGats: [],
              createdAt: serverTimestamp(),
            }, { merge: true });
          }
        } catch (e) {
          console.error('Firestore init error:', e);
        }

        unsubSnap = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data());
          } else {
            setProfile({ name: u.displayName || '', email: u.email || '', role: 'farmer', district: '', myGats: [] });
          }
        }, (err) => {
          console.error('onSnapshot error:', err);
          setProfile({ name: u.displayName || '', email: u.email || '', role: 'farmer', district: '', myGats: [] });
        });
      } else {
        // Fallback for frontend mode
        if (typeof window !== 'undefined' && localStorage.getItem('dhara_signed_out') === 'true') {
          setUser(null);
          setProfile(null);
        } else {
          const role = (typeof window !== 'undefined' && localStorage.getItem('dhara_demo_role')) || 'farmer';
          setUser(DEMO_PROFILES[role] || DEMO_PROFILES.farmer);
          setProfile(DEMO_PROFILES[role] || DEMO_PROFILES.farmer);
        }
      }
    });

    return () => { unsubAuth(); unsubSnap(); };
  }, []);

  if (user === undefined) {
    return (
      <div style={{ height: '100vh', background: '#0E1712', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #F6EE74', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) return <AuthPage onEnterDemo={enterDemo} />;

  return (
    <Layout user={user} profile={profile}>
      <Routes>
        <Route path="/"         element={<Navigate to="/home" replace />} />
        <Route path="/home"     element={<Home            user={user} profile={profile} />} />
        <Route path="/weather"  element={<Weather         profile={profile} />} />
        <Route path="/land"     element={<MyLand          user={user} profile={profile} />} />
        <Route path="/stress"   element={<CropStressWatch />} />
        <Route path="/ndvi"     element={<NDVIHealth      user={user} profile={profile} />} />
        <Route path="/claims"   element={<InsuranceClaims user={user} profile={profile} />} />
        <Route path="/schemes"  element={<Schemes />} />
        <Route path="/profile"  element={<Profile         user={user} profile={profile} setProfile={setProfile} />} />
        <Route path="/satellite" element={<DisasterVerification user={user} profile={profile} />} />
        <Route path="*"         element={<Navigate to="/home" replace />} />
      </Routes>
    </Layout>
  );
}
