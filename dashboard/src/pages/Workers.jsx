import React, { useState } from 'react';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import Glyph from '../components/icons/Glyph';

const INITIAL_WORKERS = [
  {
    id: 1,
    name: 'Olena Kovalenko',
    role: 'Field operations coordinator',
    img: '/assets/workers/olena.jpg',
    tags: ['Crop disease ID', 'Sampling & scouting'],
    tasks: 5,
    capacity: 85,
  },
  {
    id: 2,
    name: 'Ethan Parker',
    role: 'Greenhouse harvest manager',
    img: '/assets/workers/ethan.jpg',
    tags: ['Harvest planning', 'Produce handling'],
    tasks: 3,
    capacity: 70,
  },
  {
    id: 3,
    name: 'Lauren Hayes',
    role: 'Harvest crew supervisor',
    img: '/assets/workers/lauren.jpg',
    tags: ['Harvest planning', 'Team briefing', '+2'],
    tasks: 4,
    capacity: 63,
  },
  {
    id: 4,
    name: 'Mike Carter',
    role: 'Tractor equipment operator',
    img: '/assets/workers/mike.jpg',
    tags: ['GPS guidance', 'Fertilizer spreading'],
    tasks: 4,
    capacity: 92,
  },
  {
    id: 5,
    name: 'Ryan Brooks',
    role: 'Field operations coordinator',
    img: '/assets/workers/ryan.jpg',
    tags: ['Irrigation systems', 'Soil sampling'],
    tasks: 5,
    capacity: 80,
  },
  {
    id: 6,
    name: 'Diane Collins',
    role: 'Produce quality inspector',
    img: '/assets/workers/diane.jpg',
    tags: ['Quality grading', 'Post-harvest audit'],
    tasks: 3,
    capacity: 65,
  },
  {
    id: 7,
    name: 'Frank Bennett',
    role: 'Tractor and implements operator',
    img: '/assets/workers/frank.jpg',
    tags: ['Harvester ops', 'Field prep'],
    tasks: 5,
    capacity: 88,
  },
  {
    id: 8,
    name: 'Tyler Hughes',
    role: 'Livestock care technician',
    img: '/assets/workers/tyler.jpg',
    tags: ['Pasture rotation', 'Animal health'],
    tasks: 4,
    capacity: 75,
  },
];

export default function Workers() {
  const { theme } = useTheme();
  const { t } = useLang();

  const [workers, setWorkers] = useState(INITIAL_WORKERS);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('Field operations specialist');
  const [newWorkerTag1, setNewWorkerTag1] = useState('Crop Scouting');
  const [newWorkerTag2, setNewWorkerTag2] = useState('Pest Monitoring');

  const filtered = workers.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    w.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    const newW = {
      id: Date.now(),
      name: newWorkerName,
      role: newWorkerRole,
      img: '/assets/workers/ethan.jpg',
      tags: [newWorkerTag1, newWorkerTag2],
      tasks: 2,
      capacity: 50,
    };
    setWorkers([newW, ...workers]);
    setNewWorkerName('');
    setShowModal(false);
  };

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(16px, 3vw, 36px)', background: theme.bg, color: theme.text }}>
      
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 600, margin: 0, color: theme.text }}>
          Workers
        </h1>
        <button 
          onClick={() => setShowModal(true)}
          className="agro-btn-yellow"
          style={{ padding: '10px 22px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(246, 238, 116, 0.25)' }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
          <span>Add worker</span>
        </button>
      </div>

      {/* ── Search & Filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '14px' }}><Glyph name="search" size={16} /></span>
          <input 
            type="text" 
            placeholder="Search" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px 10px 42px',
              borderRadius: '30px',
              background: 'rgba(22, 34, 26, 0.85)',
              border: `1px solid ${theme.border}`,
              color: theme.text,
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <div className="agro-pill" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <span>⑂</span>
          <span>Filter</span>
        </div>
      </div>

      {/* ── Grid of Workers ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', 
        gap: '20px' 
      }} className="resp-grid-4">
        {filtered.map(w => (
          <div 
            key={w.id}
            className="agro-card"
            style={{ 
              overflow: 'hidden', 
              padding: '0 0 20px 0',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {/* Top Portrait Photo */}
            <div style={{ height: '180px', width: '100%', overflow: 'hidden' }}>
              <img 
                src={w.img} 
                alt={w.name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Info Body */}
            <div style={{ padding: '16px 20px 0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              
              {/* Name & three-dot action */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: theme.text, margin: 0 }}>
                  {w.name}
                </h3>
                <span style={{ color: theme.textDim, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>•••</span>
              </div>

              <div style={{ fontSize: '12px', color: theme.textDim, marginBottom: '16px' }}>
                {w.role}
              </div>

              {/* Skill Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                {w.tags.map((tag, i) => (
                  <span 
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: theme.textDim,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Capacity Bar & Stats */}
              <div style={{ marginTop: 'auto' }}>
                <div style={{ width: '100%', height: '5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${w.capacity}%`, height: '100%', background: '#22c55e', borderRadius: '4px' }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme.textDim }}>
                  <span>{w.tasks} tasks</span>
                  <span>{w.capacity}% capacity</span>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* ── Add Worker Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="agro-card" style={{ width: '90%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 20px 0', color: theme.text }}>Register New Farm Specialist</h2>
            <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Maya Shinde"
                  value={newWorkerName}
                  onChange={e => setNewWorkerName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Farm Operations Role</label>
                <input 
                  type="text" 
                  required
                  value={newWorkerRole}
                  onChange={e => setNewWorkerRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Skill Tag 1</label>
                  <input 
                    type="text" 
                    value={newWorkerTag1}
                    onChange={e => setNewWorkerTag1(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Skill Tag 2</label>
                  <input 
                    type="text" 
                    value={newWorkerTag2}
                    onChange={e => setNewWorkerTag2(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '24px', background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textDim, cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="agro-btn-yellow"
                  style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                >
                  Add Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
