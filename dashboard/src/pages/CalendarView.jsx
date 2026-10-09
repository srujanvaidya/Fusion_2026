import React, { useState } from 'react';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';

const EVENTS = [
  { day: 7,  title: 'Sentinel-2 Multispectral Pass', tag: 'Satellite', color: '#60a5fa' },
  { day: 8,  title: 'Soil Moisture Check - Pivot 1', tag: 'Telemetry', color: '#facc15' },
  { day: 10, title: 'Field tractor RX-7 Maintenance', tag: 'Equipment', color: '#fb923c' },
  { day: 12, title: 'Potato Early Blight Scouting', tag: 'Scouting', color: '#34d399' },
  { day: 14, title: 'Sentinel-1 SAR Radar Pass', tag: 'Satellite', color: '#60a5fa' },
  { day: 15, title: 'Clean & Sanitize Crates', tag: 'Field Ops', color: '#c084fc' },
  { day: 16, title: 'Harvest Window Start - 5 Fields', tag: 'Harvest', color: '#F6EE74' },
  { day: 18, title: 'Sugarcane Micro-irrigation Cycle', tag: 'Irrigation', color: '#38bdf8' },
  { day: 22, title: 'Crop Health Verification Docket', tag: 'Insurance', color: '#34d399' },
];

export default function CalendarView() {
  const { theme } = useTheme();
  const { t } = useLang();
  const [selectedDay, setSelectedDay] = useState(12);

  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(16px, 3vw, 36px)', background: theme.bg, color: theme.text }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 600, margin: '0 0 6px 0', color: theme.text }}>
            Agricultural Calendar
          </h1>
          <div style={{ fontSize: '13px', color: theme.textDim }}>
            April 2026 &bull; Operations, Satellite Passes &amp; Harvest Schedule
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="agro-pill" style={{ padding: '8px 16px', cursor: 'pointer' }}>Month</div>
          <div className="agro-pill" style={{ padding: '8px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.15)' }}>Week</div>
        </div>
      </div>

      {/* Main Grid: Calendar Grid + Day Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }} className="resp-grid-2-1">
        
        {/* Calendar Grid Card */}
        <div className="agro-card" style={{ padding: '24px' }}>
          
          {/* Weekday Labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '16px' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} style={{ fontSize: '12px', fontWeight: 600, color: theme.textDim, textTransform: 'uppercase' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
            {/* Blank pad for starting Wednesday */}
            <div style={{ minHeight: '90px' }} />
            <div style={{ minHeight: '90px' }} />

            {daysInMonth.map(day => {
              const dayEvents = EVENTS.filter(e => e.day === day);
              const isSelected = selectedDay === day;
              return (
                <div 
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    minHeight: '90px',
                    borderRadius: '16px',
                    background: isSelected ? 'rgba(246, 238, 116, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid #F6EE74' : `1px solid ${theme.border}`,
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#F6EE74' : theme.text, marginBottom: '6px' }}>
                    {day}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    {dayEvents.map((ev, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          borderRadius: '6px', 
                          background: `${ev.color}22`, 
                          color: ev.color, 
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="agro-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', color: theme.text }}>
            April {selectedDay}, 2026
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {EVENTS.filter(e => e.day === selectedDay).length > 0 ? (
              EVENTS.filter(e => e.day === selectedDay).map((ev, i) => (
                <div key={i} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.border}` }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: ev.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {ev.tag}
                  </span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text, marginTop: '4px', marginBottom: '8px' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textDim }}>
                    Status: Verified &amp; Scheduled for farm quadrant.
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: theme.textDim, fontSize: '13px' }}>
                No critical anomalies scheduled on this date. Routine crop growth cycle active.
              </div>
            )}

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '12px', color: theme.textDim, marginBottom: '10px' }}>Field Officers on duty:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/assets/workers/olena.jpg" alt="Olena" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                <img src="/assets/workers/ethan.jpg" alt="Ethan" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                <img src="/assets/workers/mike.jpg" alt="Mike" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: '12px', color: theme.textDim, marginLeft: '6px' }}>+3 crew</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
