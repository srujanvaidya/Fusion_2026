import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import RayaChat from './RayaChat';
import NotificationBell from './NotificationBell';
import { EarlyWarningProvider } from './EarlyWarningContext';
import { NavIcon, IconSun, IconMoon } from './icons/ScIcons';

const FARMER_NAV = [
  { path: '/home',    label: 'Dashboard',       labelMr: 'डॅशबोर्ड',       short: 'Home', shortMr: 'मुख्य',  icon: 'dashboard' },
  { path: '/stress',  label: 'Crop Stress Watch', labelMr: 'पीक तणाव निरीक्षण',   short: 'Stress', shortMr: 'तणाव', icon: 'verify' },
  { path: '/weather', label: 'Weather',         labelMr: 'हवामान',       short: 'Weather', shortMr: 'हवामान', icon: 'weather' },
  { path: '/claims',  label: 'Insurance',       labelMr: 'विमा',         icon: 'insurance' },
  { path: '/profile', label: 'Profile',         labelMr: 'प्रोफाइल',      icon: 'profile' },
];

const OFFICIAL_NAV = [
  { path: '/home',      label: 'Dashboard',       labelMr: 'डॅशबोर्ड',       short: 'Home', shortMr: 'मुख्य',  icon: 'dashboard' },
  { path: '/satellite', label: 'Crop Stress Watch', labelMr: 'पीक तणाव निरीक्षण',   short: 'Stress', shortMr: 'तणाव', icon: 'verify' },
  { path: '/weather',   label: 'Weather',         labelMr: 'हवामान',       icon: 'weather' },
  { path: '/claims',    label: 'Insurance',       labelMr: 'विमा',         icon: 'insurance' },
  { path: '/profile',   label: 'Profile',         labelMr: 'प्रोफाइल',      icon: 'profile' },
];

function SignOutModal({ onConfirm, onCancel, theme, signing }) {
  const [ch, setCh] = useState(false);
  const [oh, setOh] = useState(false);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:theme.name === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(240,239,233,0.8)', backdropFilter:'blur(8px)', animation:'soFade .15s ease' }}>
      <div style={{ background:theme.card, border:`1px solid ${theme.border}`, borderRadius:'24px', padding:'32px 28px', width:'88%', maxWidth:'320px', boxShadow:theme.shadowHover, animation:'soUp .2s ease', textAlign:'center' }}>
        <div style={{ fontSize:'18px', fontWeight:500, color:theme.text, marginBottom:'8px', letterSpacing:'-0.02em' }}>Sign Out of Dhara</div>
        <div style={{ fontSize:'14px', color:theme.textDim, lineHeight:1.6, marginBottom:'24px', fontWeight:400 }}>Do you want to sign out?<br/>Your data is saved to the cloud.</div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onCancel} disabled={signing} onMouseEnter={()=>setCh(true)} onMouseLeave={()=>setCh(false)}
            style={{ flex:1, padding:'12px 0', borderRadius:'30px', background:'transparent', border:`1px solid ${ch?theme.text:theme.border}`, color:ch?theme.text:theme.textDim, fontSize:'14px', fontWeight:500, cursor:'pointer', fontFamily:'inherit', transition:'all .2s' }}>Stay</button>
          <button onClick={onConfirm} disabled={signing} onMouseEnter={()=>setOh(true)} onMouseLeave={()=>setOh(false)}
            style={{ flex:1, padding:'12px 0', borderRadius:'30px', border:'none', background:signing?'#9ca3af':oh?theme.pillHover:theme.text, color:theme.bg, fontSize:'14px', fontWeight:500, cursor:signing?'not-allowed':'pointer', fontFamily:'inherit', transition:'all .2s' }}>{signing?'Signing out…':'Sign Out'}</button>
        </div>
      </div>
      <style>{`@keyframes soFade{from{opacity:0}to{opacity:1}} @keyframes soUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

export default function Layout({ children, user, profile }) {
  const location = useLocation();
  const { lang, toggleLang } = useLang();
  const { theme, themeName, toggleTheme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [signing,   setSigning]   = useState(false);

  const isOfficial = ['talathi','gram_panchayat','field_officer'].includes(profile?.role);
  const NAV    = isOfficial ? OFFICIAL_NAV : FARMER_NAV;
  const isDark = themeName === 'dark';
  const name   = profile?.name || user?.email?.split('@')[0] || '';

  const handleSignOut = async () => {
    setSigning(true);
    try { await signOut(auth); window.location.href = '/get-started.html'; }
    catch { setSigning(false); }
  };

  return (
    <EarlyWarningProvider user={user} profile={profile} lang={lang}>
    <div style={{ minHeight:'100vh', background:theme.bg, color:theme.text, fontFamily:"'Inter', 'Helvetica Neue', -apple-system, sans-serif", display:'flex', flexDirection:'column' }}>
      {showModal && <SignOutModal theme={theme} signing={signing} onCancel={()=>setShowModal(false)} onConfirm={handleSignOut}/>}

      {/* ── Minimalist Centered Header ── */}
      <header className="sc-layout-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 32px', minHeight:'76px', height:'auto', flexShrink:0, background: theme.name==='dark' ? 'rgba(14,23,18,0.72)' : 'rgba(240,239,233,0.78)', position:'sticky', top:0, zIndex:100 }}>
        
        {/* Left: Logo */}
        <div style={{ flexShrink:0, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: theme.text, letterSpacing: '-0.03em', display:'flex', alignItems:'center', gap:'8px' }}><span style={{ width:'10px', height:'10px', borderRadius:'50%', background:theme.accent, boxShadow:`0 0 0 4px ${theme.accentBg}` }} />Dhara</span>
        </div>

        {/* Center: Nav pills */}
        <nav style={{ display:'flex', gap:'8px' }} className="sc-topnav">
          {NAV.map(({ path, label, labelMr }) => {
            const active = location.pathname === path || (path==='/home' && location.pathname==='/');
            const txt = lang==='mr' ? labelMr : label;
            return (
              <NavPill key={path} to={path} active={active} label={txt} theme={theme} />
            );
          })}
        </nav>

        {/* Right: Controls & Avatar */}
        <div className="sc-header-controls" style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div className="sc-lang" style={{ display:'flex', background:theme.card, borderRadius:'30px', border:`1px solid ${theme.border}`, padding:'4px', gap:'2px' }}>
            <button onClick={() => lang !== 'en' && toggleLang()}
              style={{ padding:'4px 12px', borderRadius:'20px', background: lang === 'en' ? theme.accent : 'transparent', color: lang === 'en' ? '#111111' : theme.textDim, border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'all 0.2s', fontFamily:'inherit' }}>
              English
            </button>
            <button onClick={() => lang !== 'mr' && toggleLang()}
              style={{ padding:'4px 12px', borderRadius:'20px', background: lang === 'mr' ? theme.accent : 'transparent', color: lang === 'mr' ? '#111111' : theme.textDim, border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'all 0.2s', fontFamily:'inherit' }}>
              मराठी
            </button>
          </div>
          
          <NotificationBell theme={theme} lang={lang} />

          <button onClick={toggleTheme} title="Toggle Theme"
            style={{ width:'34px', height:'34px', borderRadius:'50%', background:theme.card, border:`1px solid ${theme.border}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', color: theme.textDim }}
            onMouseEnter={e=>e.currentTarget.style.transform='rotate(45deg)'}
            onMouseLeave={e=>e.currentTarget.style.transform='rotate(0deg)'}>
            {isDark ? <IconSun size={18} color="currentColor" /> : <IconMoon size={18} color="currentColor" />}
          </button>

          {/* Avatar → opens sign out */}
          <button onClick={()=>setShowModal(true)} title="Profile / Sign Out"
            style={{ width:'36px', height:'36px', borderRadius:'50%', background:theme.accent, border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'#111', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', marginLeft: '4px' }}
            onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
            onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
            {name?name.slice(0,2).toUpperCase():'DH'}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', paddingBottom:'76px' }}>
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav style={{ position:'fixed', bottom:0, left:0, right:0, minHeight:'64px', height:'auto', background:theme.navBg, backdropFilter:'blur(12px)', borderTop:`1px solid ${theme.navBorder}`, display:'flex', alignItems:'stretch', zIndex:100, paddingTop:'6px', paddingBottom:'calc(6px + env(safe-area-inset-bottom, 0px))' }} className="sc-botnav">
        {NAV.map(({ path, label, labelMr, short, shortMr, icon }) => {
          const active = location.pathname===path || (path==='/home'&&location.pathname==='/');
          const txt = lang==='mr' ? (shortMr||labelMr) : (short||label);
          return (
            <Link key={path} to={path} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px', textDecoration:'none', minWidth:0, padding:'2px 4px' }} title={txt}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: active ? 1 : 0.85 }} aria-hidden>
                <NavIcon name={icon} size={24} color={active ? theme.text : theme.textMuted} />
              </span>
              <span style={{ fontSize:'11px', fontWeight:active?600:500, color:active?theme.text:theme.textMuted, textAlign:'center', lineHeight:1.2, maxWidth:'100%', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {txt}
              </span>
              {active && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: theme.text, flexShrink:0 }} />}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;}
        body { margin: 0; background: ${theme.bg}; }
        .sc-topnav{display:flex!important;}
        .sc-botnav{display:none!important;}
        @media(max-width:1100px){
          .sc-layout-header{padding-left:20px!important;padding-right:20px!important;gap:12px!important;}
          .sc-topnav{gap:2px!important;}
          .sc-navpill{padding:9px 13px!important;font-size:14px!important;}
          .sc-lang button{padding:4px 9px!important;font-size:12px!important;}
        }
        @media(max-width:767px){
          .sc-topnav{display:none!important;}
          .sc-botnav{display:flex!important;}
          main{padding-bottom:84px!important;}
          .sc-layout-header{flex-wrap:nowrap!important;min-height:56px!important;padding:8px 14px!important;row-gap:0!important;}
          .sc-header-controls{gap:6px!important;}
          .sc-header-controls > button{width:34px!important;height:34px!important;min-height:34px!important;}
          .sc-lang{padding:3px!important;}
          .sc-lang button{padding:3px 8px!important;font-size:12px!important;min-height:28px!important;}
        }
        ::-webkit-scrollbar{width:0px;background:transparent;} /* Hidden scrollbar for cleaner look */
      `}</style>
      <RayaChat profile={profile} />
    </div>
    </EarlyWarningProvider>
  );
}

// Individual nav pill with minimal hover state
function NavPill({ to, active, label, theme }) {
  const [hov, setHov] = useState(false);
  
  // Specific requested styling
  const bg = active ? theme.text : (hov ? theme.pillHover : 'transparent');
  const color = active ? theme.bg : (hov ? theme.text : theme.textDim);

  return (
    <Link to={to} style={{ textDecoration:'none' }}>
      <div
        className="sc-navpill"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          padding: '11px 20px',
          borderRadius: '30px',
          background: bg,
          color: color,
          fontSize: '15px',
          fontWeight: 400,
          cursor: 'pointer',
          transition: 'all .2s ease',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}>
        {label}
      </div>
    </Link>
  );
}
