import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import Glyph from '../components/icons/Glyph';

const EQUIPMENT_ITEMS = [
  { id: 'row-crop', name: 'Row-crop tractor', tasks: 7, img: '/assets/tractor_green.jpg' },
  { id: 'rx-7',     name: 'Field tractor RX-7', tasks: 6, img: '/assets/tractor_rx7.jpg', model: 'John Deere 6R 155', hp: '155 hp', hitch: '7.2 t', speed: '40 km/h' },
  { id: 'combine',  name: 'Combine Harvester', tasks: 4, img: '/assets/tractor_green.jpg' },
  { id: 'utility',  name: 'Utility vehicles', tasks: 2, img: '/assets/utility_truck.jpg' },
  { id: 'sprayer',  name: 'Propelled sprayer', tasks: 3, img: '/assets/tractor_rx7.jpg' },
  { id: 'grain',    name: 'Grain cart', tasks: 2, img: '/assets/tractor_green.jpg' },
];

export default function Equipment() {
  const { theme } = useTheme();
  const { t } = useLang();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState('rx-7');
  const [timeRange, setTimeRange] = useState('10 days');

  const selectedItem = EQUIPMENT_ITEMS.find(e => e.id === selectedId) || EQUIPMENT_ITEMS[1];

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(16px, 3vw, 36px)', background: theme.bg, color: theme.text }}>
      
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/home')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: theme.text, fontSize: '18px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          <span style={{ fontSize: '20px' }}>←</span>
          <span>{t('Equipment')}</span>
        </button>
      </div>

      {/* ── Equipment Horizontal Carousel ── */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        overflowX: 'auto', 
        paddingBottom: '16px', 
        marginBottom: '24px',
        scrollbarWidth: 'none'
      }}>
        {EQUIPMENT_ITEMS.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <div 
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px 8px 8px',
                borderRadius: '16px',
                background: isSelected ? 'rgba(246, 238, 116, 0.15)' : 'rgba(22, 34, 26, 0.75)',
                border: isSelected ? `1px solid #F6EE74` : `1px solid ${theme.border}`,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              <img 
                src={item.img} 
                alt={item.name} 
                style={{ width: '42px', height: '36px', borderRadius: '10px', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#F6EE74' : theme.text }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '11px', color: theme.textDim }}>
                  {item.tasks} tasks
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main Two Column Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: '20px' }} className="resp-grid-2">
        
        {/* Left Column: Machine Details & Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main Machine Card */}
          <div className="agro-card" style={{ padding: '24px' }}>
            <div style={{ borderRadius: '18px', overflow: 'hidden', height: '220px', marginBottom: '20px' }}>
              <img 
                src={selectedItem.img} 
                alt={selectedItem.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            
            <h2 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 16px 0', color: theme.text }}>
              {selectedItem.name}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '13px', color: theme.textDim }}>Model / type :</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{selectedItem.model || 'John Deere 6R 155'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '13px', color: theme.textDim }}>Engine power :</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{selectedItem.hp || '155 hp'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: '13px', color: theme.textDim }}>Hitch capacity :</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{selectedItem.hitch || '7.2 t'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: theme.textDim }}>Max speed :</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{selectedItem.speed || '40 km/h'}</span>
              </div>
            </div>
          </div>

          {/* Alerts Card */}
          <div className="agro-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Alerts</h3>
              <button style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: theme.textDim, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer' }}>
                Read all ›
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Alert 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(251, 146, 60, 0.2)', color: '#fb923c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                  <Glyph name="alert" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>Hydraulic pressure drop</div>
                    <div style={{ fontSize: '11px', color: theme.textDim }}>2h. ago</div>
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>Check hose connections</div>
                </div>
              </div>

              {/* Alert 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>Service completed</div>
                    <div style={{ fontSize: '11px', color: theme.textDim }}>1 day ago</div>
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>Oil &amp; filter changed (today)</div>
                </div>
              </div>

              {/* Alert 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                  <Glyph name="info" size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text }}>GPS signal unstable</div>
                    <div style={{ fontSize: '11px', color: theme.textDim }}>3 days ago</div>
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textDim, marginTop: '2px' }}>Guidance accuracy reduced</div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Map & Performance Chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Equipment Map Card */}
          <div className="agro-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Equipment map</h3>
              <div className="agro-pill" style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                Today ▼
              </div>
            </div>

            {/* Field Map Visual with Tractor Path */}
            <div style={{ position: 'relative', height: '360px', borderRadius: '18px', overflow: 'hidden' }}>
              <img 
                src="/assets/aerial_fields.jpg" 
                alt="Field Aerial" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              
              {/* Route Waypoint SVG Overlay */}
              <svg 
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                viewBox="0 0 600 360"
              >
                {/* Yellow solid and dashed tractor path */}
                <path 
                  d="M 120 310 L 120 120 L 260 120 L 260 270 L 390 270 L 390 130" 
                  fill="none" 
                  stroke="#F6EE74" 
                  strokeWidth="3" 
                  strokeDasharray="6 6"
                />
                
                {/* Waypoints */}
                <circle cx="120" cy="310" r="12" fill="#FFFFFF" />
                <polygon points="117,304 127,310 117,316" fill="#0E1711" />

                <circle cx="200" cy="120" r="10" fill="#FFFFFF" />
                <text x="200" y="124" fill="#0E1711" fontSize="10" fontWeight="bold" textAnchor="middle">1</text>

                <circle cx="260" cy="120" r="10" fill="#FFFFFF" />
                <text x="260" y="124" fill="#0E1711" fontSize="10" fontWeight="bold" textAnchor="middle">2</text>

                <circle cx="260" cy="270" r="10" fill="#FFFFFF" />
                <text x="260" y="274" fill="#0E1711" fontSize="10" fontWeight="bold" textAnchor="middle">3</text>

                <circle cx="330" cy="210" r="10" fill="#FFFFFF" />
                <text x="330" y="214" fill="#0E1711" fontSize="10" fontWeight="bold" textAnchor="middle">4</text>
              </svg>

              {/* Floating Tractor Pin */}
              <div style={{ position: 'absolute', top: '104px', left: '215px', width: '32px', height: '32px', borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                <Glyph name="truck" size={16} />
              </div>

              {/* Top Right Floating Telemetry Badges */}
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="agro-pill" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14, 23, 18, 0.85)' }}>
                  <span><Glyph name="clock" size={16} /></span>
                  <span>Running hours: <strong style={{ color: '#fff' }}>06:27:13</strong></span>
                </div>
                <div className="agro-pill" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14, 23, 18, 0.85)' }}>
                  <span><Glyph name="pin" size={16} /></span>
                  <span>Distance: <strong style={{ color: '#fff' }}>3 km.</strong></span>
                </div>
                <div className="agro-pill" style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14, 23, 18, 0.85)' }}>
                  <span><Glyph name="clipboard" size={16} /></span>
                  <span>Tasks: <strong style={{ color: '#fff' }}>4/5</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Equipment Performance Chart */}
          <div className="agro-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Equipment performance</h3>
              <div className="agro-pill" style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                {timeRange} ▼
              </div>
            </div>

            {/* Performance Step SVG Chart */}
            <div style={{ width: '100%', height: '180px' }}>
              <svg width="100%" height="180" viewBox="0 0 600 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="stepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#84cc16" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
                {[30, 65, 100, 135, 170].map((y, i) => (
                  <line key={i} x1="40" y1={y} x2="580" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                ))}

                {/* Y-axis labels */}
                <text x="10" y="34" fill={theme.textDim} fontSize="10">6km</text>
                <text x="10" y="69" fill={theme.textDim} fontSize="10">5km</text>
                <text x="10" y="104" fill={theme.textDim} fontSize="10">4km</text>
                <text x="10" y="139" fill={theme.textDim} fontSize="10">3km</text>
                <text x="10" y="174" fill={theme.textDim} fontSize="10">1km</text>

                {/* Step Path */}
                <path 
                  d="M 50 120 L 130 120 L 130 150 L 220 150 L 220 160 L 290 160 L 290 85 L 390 85 L 390 120 L 470 120 L 470 70 L 520 70 L 520 170 L 50 170 Z" 
                  fill="url(#stepGrad)" 
                />
                <path 
                  d="M 50 120 L 130 120 L 130 150 L 220 150 L 220 160 L 290 160 L 290 85 L 390 85 L 390 120 L 470 120 L 470 70 L 520 70" 
                  fill="none" 
                  stroke="#a3e635" 
                  strokeWidth="2.5" 
                />

                {/* X-axis dates */}
                {['Apr 7', 'Apr 8', 'Apr 9', 'Apr 10', 'Apr 11', 'Apr 12'].map((d, i) => (
                  <text key={i} x={70 + i * 85} y="178" fill={theme.textDim} fontSize="11" textAnchor="middle">
                    {d}
                  </text>
                ))}
              </svg>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
