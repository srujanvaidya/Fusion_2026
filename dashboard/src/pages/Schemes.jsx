import React from 'react';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';

const SCHEMES = [
  { name:'PM-KISAN', fullName:'Pradhan Mantri Kisan Samman Nidhi', img:null, color:'#16a34a', desc:'Direct income support of ₹6,000/year to small and marginal farmers in three equal installments.', eligibility:'Land-holding farmers with cultivable land up to 2 hectares.', benefit:'₹6,000/year (₹2,000 per installment)', link:'https://pmkisan.gov.in' },
  { name:'PMFBY',    fullName:'Pradhan Mantri Fasal Bima Yojana',  img:null, color:'#2563eb', desc:'Crop insurance scheme providing financial support to farmers suffering crop loss or damage due to unforeseen events.', eligibility:'All farmers growing notified crops, including sharecroppers and tenant farmers.', benefit:'Up to 100% sum insured for crop loss', link:'https://pmfby.gov.in' },
  { name:'Namo Shetkari', fullName:'Namo Shetkari Mahasanman Nidhi (Maharashtra)', img:null, color:'#d97706', desc:'Maharashtra state scheme providing an additional ₹6,000/year to farmers complementing PM-KISAN.', eligibility:'All PM-KISAN beneficiaries registered in Maharashtra.', benefit:'₹6,000/year (state top-up)', link:'https://krishi.maharashtra.gov.in' },
  { name:'Kisan Credit Card', fullName:'Kisan Credit Card (KCC) Scheme', img:null, color:'#7c3aed', desc:'Provides timely and adequate credit support to farmers for their agricultural operations.', eligibility:'Farmers, sharecroppers, tenant farmers, and SHGs.', benefit:'Credit up to ₹3 lakh at 4% interest p.a.', link:'https://www.india.gov.in/spotlight/kisan-credit-card' },
  { name:'eNAM', fullName:'National Agriculture Market', img:null, color:'#0891b2', desc:'Pan-India electronic trading portal that networks existing APMC mandis to create a unified national market.', eligibility:'All farmers and traders registered with linked APMCs.', benefit:'Better price discovery, transparent bidding', link:'https://enam.gov.in' },
  { name:'Soil Health Card', fullName:'Soil Health Card Scheme', img:null, color:'#c2410c', desc:'Government provides soil health cards to farmers with crop-wise recommendations for nutrients and fertilizers.', eligibility:'All farmers in India.', benefit:'Free soil testing & fertilizer recommendations', link:'https://soilhealth.dac.gov.in' },
  { name:'PKVY', fullName:'Paramparagat Krishi Vikas Yojana', img:null, color:'#059669', desc:'Supports organic farming practices and certification to promote chemical-free agriculture.', eligibility:'Farmer clusters willing to adopt organic practices (minimum 50 farmers per cluster).', benefit:'₹50,000/hectare over 3 years', link:'https://pgsindia-ncof.gov.in' },
  { name:'RKVY', fullName:'Rashtriya Krishi Vikas Yojana', img:null, color:'#2563eb', desc:'Incentivises states to increase public investment in Agriculture and Allied Sectors.', eligibility:'Applied through State Government agriculture departments.', benefit:'Infrastructure grants for farm development', link:'https://rkvy.nic.in' },
];

function SchemeCard({ scheme, theme, t }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ background: theme.card, border:`1.5px solid ${hov ? scheme.color+'60' : theme.border}`, borderRadius:'14px', overflow:'hidden', transition:'all .15s', boxShadow: hov ? `0 4px 20px ${scheme.color}20` : theme.shadow }}>
      {/* Color top bar */}
      <div style={{ height:'6px', background: scheme.color }} />
      <div style={{ padding:'18px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', marginBottom:'12px' }}>
          <div>
            <div style={{ fontSize:'16px', fontWeight:800, color: theme.text }}>{scheme.name}</div>
            <div style={{ fontSize:'11px', color: theme.textDim, marginTop:'2px' }}>{scheme.fullName}</div>
          </div>
          <span style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'20px', background:`${scheme.color}15`, color:scheme.color, border:`1px solid ${scheme.color}30`, whiteSpace:'nowrap', flexShrink:0, fontWeight:700 }}>
            {scheme.benefit}
          </span>
        </div>
        <p style={{ fontSize:'14px', color: theme.textDim, lineHeight:1.7, margin:'0 0 12px' }}>{scheme.desc}</p>
        <div style={{ background: theme.cardAlt, borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color: theme.textDim, lineHeight:1.6, marginBottom:'12px' }}>
          <span style={{ color: theme.textMuted, fontWeight:700 }}>{t('eligibility')}: </span>{scheme.eligibility}
        </div>
        <a href={scheme.link} target="_blank" rel="noreferrer"
          style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'13px', color:scheme.color, textDecoration:'none', fontWeight:700 }}
          onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
          onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>
          {t('apply_link')}
        </a>
      </div>
    </div>
  );
}

export default function Schemes() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <div style={{ padding:'20px', minHeight:'100vh', background: theme.bg }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:800, color: theme.text, margin:0 }}>{t('schemes_title')}</h1>
        <p style={{ fontSize:'13px', color: theme.textDim, marginTop:'4px' }}>{t('schemes_sub')}</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'14px' }}>
        {SCHEMES.map(s=><SchemeCard key={s.name} scheme={s} theme={theme} t={t} />)}
      </div>
      <div style={{ marginTop:'24px', padding:'16px 18px', background: theme.accentBg, border:`1px solid ${theme.accentBorder}`, borderRadius:'12px', fontSize:'13px', color: theme.textDim, lineHeight:1.8 }}>
        <strong style={{ color: theme.accent }}>*</strong> {t('schemes_note')}
      </div>
    </div>
  );
}
