import React, { useState } from 'react';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import Glyph from '../components/icons/Glyph';

const INITIAL_TASKS = [
  // Planned
  {
    id: 1,
    title: 'Scout for early blight symptoms',
    date: 'Apr 16, 2026',
    duration: '9 days',
    field: 'Field potato block A',
    priority: 'High',
    status: 'planned',
    assignees: ['olena.jpg', 'ethan.jpg'],
    moreCount: 3
  },
  {
    id: 2,
    title: 'Check leaf wetness and canopy...',
    date: 'Aug 12, 2026',
    duration: '5 days',
    field: 'Tomato greenhouse 2 field, north aisle',
    priority: 'Low',
    status: 'planned',
    assignees: ['ethan.jpg'],
    moreCount: 0
  },

  // In Progress
  {
    id: 3,
    title: 'Weekly scouting loop for funga...',
    date: 'May 16, 2026',
    duration: '30 days',
    field: 'Apple orchard west field (12-18)',
    priority: 'Medium',
    status: 'in_progress',
    assignees: ['lauren.jpg', 'olena.jpg'],
    moreCount: 2
  },
  {
    id: 4,
    title: 'Check drainage, fix standing-wa...',
    date: 'Apr 27, 2026',
    duration: '12 days',
    field: 'Pumpkin field south',
    priority: 'High',
    status: 'in_progress',
    assignees: ['mike.jpg'],
    moreCount: 1
  },
  {
    id: 5,
    title: 'Monitor disease hotspots & upd...',
    date: 'Jul 15, 2026',
    duration: '90 days',
    field: 'Strawberry tunnels (4-6) field',
    priority: 'Low',
    status: 'in_progress',
    assignees: ['diane.jpg', 'olena.jpg'],
    moreCount: 3
  },

  // Completed
  {
    id: 6,
    title: 'Record baseline crop health ph...',
    date: 'Apr 05, 2026',
    duration: '21 days',
    field: 'Corn pivot 1: quadrant NE',
    priority: 'Low',
    status: 'completed',
    assignees: ['ryan.jpg'],
    moreCount: 1
  },
  {
    id: 7,
    title: 'Calibrate moisture sensors and...',
    date: 'Mar 18, 2026',
    duration: '45 days',
    field: 'Irrigation control room (panel 3)',
    priority: 'Medium',
    status: 'completed',
    assignees: ['tyler.jpg', 'ethan.jpg'],
    moreCount: 3
  },
  {
    id: 8,
    title: 'Clean and sanitize harvest crates',
    date: 'Apr 14, 2026',
    duration: '9 days',
    field: 'Packing area: wash station 1',
    priority: 'High',
    status: 'completed',
    assignees: ['lauren.jpg', 'diane.jpg'],
    moreCount: 3
  },

  // Overdue
  {
    id: 9,
    title: 'Preventive sprayer maintenanc...',
    date: 'Apr 10, 2026',
    duration: 'Season',
    field: 'Service yard, maintenance lane 2',
    priority: 'High',
    status: 'overdue',
    assignees: ['mike.jpg', 'frank.jpg'],
    moreCount: 8
  }
];

export default function Tasks() {
  const { theme } = useTheme();
  const { t } = useLang();
  
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskField, setNewTaskField] = useState('Field potato block A');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskStatus, setNewTaskStatus] = useState('planned');

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) || 
                          task.field.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = filterPriority === 'all' || task.priority.toLowerCase() === filterPriority.toLowerCase();
    return matchesSearch && matchesPriority;
  });

  const columns = [
    { id: 'planned',     title: 'Planned',     color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' },
    { id: 'in_progress', title: 'In progress', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
    { id: 'completed',   title: 'Completed',   color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
    { id: 'overdue',     title: 'Overdue',     color: '#fb7185', bg: 'rgba(251, 113, 133, 0.15)' },
  ];

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask = {
      id: Date.now(),
      title: newTaskTitle,
      date: 'Today',
      duration: '7 days',
      field: newTaskField,
      priority: newTaskPriority,
      status: newTaskStatus,
      assignees: ['ethan.jpg'],
      moreCount: 1
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setShowModal(false);
  };

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(16px, 3vw, 36px)', background: theme.bg, color: theme.text }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 600, margin: 0, color: theme.text }}>
          Tasks
        </h1>
        <button 
          onClick={() => setShowModal(true)}
          className="agro-btn-yellow"
          style={{ padding: '10px 22px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(246, 238, 116, 0.25)' }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
          <span>New task</span>
        </button>
      </div>

      {/* ── Search, Filters & View Toggle Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        
        {/* Left: Search & Filter button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', maxWidth: '520px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
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

          <div 
            onClick={() => setFilterPriority(p => p === 'all' ? 'high' : (p === 'high' ? 'medium' : (p === 'medium' ? 'low' : 'all')))}
            className="agro-pill" 
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
          >
            <span>⑂</span>
            <span>Filter {filterPriority !== 'all' ? `(${filterPriority})` : ''}</span>
          </div>
        </div>

        {/* Right: Kanban vs List View Toggle */}
        <div style={{ display: 'flex', background: 'rgba(22, 34, 26, 0.85)', padding: '4px', borderRadius: '30px', border: `1px solid ${theme.border}` }}>
          <button 
            onClick={() => setViewMode('kanban')}
            style={{
              padding: '7px 16px',
              borderRadius: '24px',
              border: 'none',
              background: viewMode === 'kanban' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'kanban' ? '#0E1711' : theme.textDim,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <span>▦</span>
            <span>Kanban view</span>
          </button>

          <button 
            onClick={() => setViewMode('list')}
            style={{
              padding: '7px 16px',
              borderRadius: '24px',
              border: 'none',
              background: viewMode === 'list' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'list' ? '#0E1711' : theme.textDim,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <span>☰</span>
            <span>List view</span>
          </button>
        </div>

      </div>

      {/* ── Kanban Board Columns ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))', 
        gap: '20px', 
        alignItems: 'start',
        overflowX: 'auto',
        paddingBottom: '24px'
      }}>
        {columns.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Column Header Capsule */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: col.bg,
                  color: col.color,
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  <span>{col.title}</span>
                </div>
                <span style={{ 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px', 
                  color: theme.textDim,
                  fontWeight: 600 
                }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task Cards Column Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {colTasks.map(task => {
                  const flagColor = task.priority === 'High' ? '#fb7185' : (task.priority === 'Medium' ? '#facc15' : '#60a5fa');
                  return (
                    <div 
                      key={task.id}
                      className="agro-card"
                      style={{
                        padding: '20px',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: '0 0 10px 0', lineHeight: 1.4 }}>
                        {task.title}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>
                        <span> {task.date}</span>
                        <span>•</span>
                        <span>⏳ {task.duration}</span>
                      </div>

                      <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '16px' }}>
                        {task.field}
                      </div>

                      {/* Card Footer: Priority & Assignee stack */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: `1px solid ${theme.border}` }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '12px', 
                          padding: '3px 10px', 
                          borderRadius: '14px', 
                          background: 'rgba(255,255,255,0.06)',
                          color: flagColor,
                          fontWeight: 500
                        }}>
                          <span><Glyph name="flag" size={16} /></span>
                          <span>{task.priority}</span>
                        </div>

                        {/* Avatars */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {task.assignees.map((a, i) => (
                            <img 
                              key={i} 
                              src={`/assets/workers/${a}`} 
                              alt="Worker" 
                              style={{ 
                                width: '26px', 
                                height: '26px', 
                                borderRadius: '50%', 
                                objectFit: 'cover', 
                                marginLeft: i > 0 ? '-8px' : '0', 
                                border: '2px solid #16221A' 
                              }} 
                            />
                          ))}
                          {task.moreCount > 0 && (
                            <div style={{ 
                              width: '26px', 
                              height: '26px', 
                              borderRadius: '50%', 
                              background: '#243528', 
                              color: '#F2F6F4', 
                              fontSize: '10px', 
                              fontWeight: 600, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              marginLeft: '-8px', 
                              border: '2px solid #16221A' 
                            }}>
                              +{task.moreCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

      {/* ── New Task Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="agro-card" style={{ width: '90%', maxWidth: '440px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 20px 0', color: theme.text }}>Add New Farming Task</h2>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Task Description</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Inspect soil moisture and pest thresholds"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Target Field / Parcel</label>
                <select 
                  value={newTaskField} 
                  onChange={e => setNewTaskField(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(22,34,26,0.95)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                >
                  <option>Field potato block A</option>
                  <option>Apple orchard west field (12-18)</option>
                  <option>Corn pivot 1: quadrant NE</option>
                  <option>Tomato greenhouse 2 field, north aisle</option>
                  <option>Strawberry tunnels (4-6) field</option>
                  <option>Pumpkin field south</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Priority</label>
                  <select 
                    value={newTaskPriority} 
                    onChange={e => setNewTaskPriority(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(22,34,26,0.95)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: theme.textDim, marginBottom: '6px' }}>Status</label>
                  <select 
                    value={newTaskStatus} 
                    onChange={e => setNewTaskStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(22,34,26,0.95)', border: `1px solid ${theme.border}`, color: '#fff', fontSize: '13px' }}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
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
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
