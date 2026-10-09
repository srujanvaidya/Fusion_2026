import React, { useState } from 'react';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../firebase';

const provider = new GoogleAuthProvider();

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: '16px' },
  card: { width: '100%', maxWidth: '400px', background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '40px 36px' },
  logo: { textAlign: 'center', marginBottom: '36px' },
  logoName: { fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '0.1em' },
  logoDot: { color: '#22c55e' },
  logoSub: { fontSize: '10px', color: '#777', letterSpacing: '0.2em', marginTop: '3px' },
  title: { fontSize: '22px', fontWeight: 300, color: '#fff', marginBottom: '6px', lineHeight: 1.2 },
  sub: { fontSize: '12px', color: '#888', marginBottom: '28px' },
  label: { display: 'block', fontSize: '11px', color: '#999', marginBottom: '6px', letterSpacing: '0.08em' },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    background: '#111', border: '1px solid #1e1e1e', color: '#fff',
    fontSize: '12px', fontFamily: "inherit",
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  },
  btnPrimary: {
    width: '100%', padding: '12px', borderRadius: '8px',
    background: '#fff', color: '#000', border: 'none',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    fontFamily: "inherit", letterSpacing: '0.05em',
    transition: 'background 0.15s', marginTop: '6px',
  },
  btnGoogle: {
    width: '100%', padding: '11px', borderRadius: '8px',
    background: '#111', color: '#888', border: '1px solid #1e1e1e',
    fontSize: '12px', fontFamily: "inherit",
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '10px', transition: 'all 0.15s',
  },
  divider: { position: 'relative', textAlign: 'center', margin: '24px 0' },
  dividerLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#1e1e1e' },
  dividerText: { position: 'relative', background: '#0a0a0a', padding: '0 12px', fontSize: '10px', color: '#777', letterSpacing: '0.1em' },
  error: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', marginBottom: '16px', textAlign: 'center' },
  toggle: { textAlign: 'center', marginTop: '24px', fontSize: '11px', color: '#888' },
  toggleBtn: { background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontFamily: "inherit", fontSize: '11px', marginLeft: '4px' },
};

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'An account already exists with this email.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      };
      setError(msgs[err.code] || `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoName}>SKY<span style={S.logoDot}>.</span>CROP</div>
          <div style={S.logoSub}>AGRI INTELLIGENCE PLATFORM</div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <h2 style={S.title}>{isSignUp ? 'Create account' : 'Welcome back'}</h2>
          <p style={S.sub}>{isSignUp ? 'Join the platform — fill in your details below.' : 'Sign in to access your dashboard.'}</p>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignUp && (
            <div>
              <label style={S.label}>FULL NAME</label>
              <input
                style={S.input}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                onFocus={e => e.target.style.borderColor = '#22c55e'}
                onBlur={e => e.target.style.borderColor = '#1e1e1e'}
              />
            </div>
          )}
          <div>
            <label style={S.label}>EMAIL ADDRESS</label>
            <input
              style={S.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              onFocus={e => e.target.style.borderColor = '#22c55e'}
              onBlur={e => e.target.style.borderColor = '#1e1e1e'}
            />
          </div>
          <div>
            <label style={S.label}>PASSWORD</label>
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              onFocus={e => e.target.style.borderColor = '#22c55e'}
              onBlur={e => e.target.style.borderColor = '#1e1e1e'}
            />
          </div>
          <button
            type="submit"
            style={{ ...S.btnPrimary, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#e5e5e5'; }}
            onMouseLeave={e => { e.target.style.background = '#fff'; }}
          >
            {loading ? 'PLEASE WAIT...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </form>

        <div style={S.divider}>
          <div style={S.dividerLine} />
          <span style={S.dividerText}>OR CONTINUE WITH</span>
        </div>

        <button
          style={S.btnGoogle}
          onClick={handleGoogle}
          disabled={loading}
          onMouseEnter={e => { e.currentTarget.style.color = '#4ade80'; e.currentTarget.style.borderColor = '#22c55e'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#1e1e1e'; }}
        >
          <GoogleSVG />
          Google
        </button>

        <div style={S.toggle}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button style={S.toggleBtn} onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
