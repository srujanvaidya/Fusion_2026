import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DISTRICTS, MOCK_ALERTS, formatINR } from '../data/maharashtra.js';

const DISTRICT_STATS = DISTRICTS.slice(0, 12).map(d => ({
  district: d,
  alerts: Math.floor(Math.random() * 8),
  claims: Math.floor(Math.random() * 20),
  ndviAvg: (0.35 + Math.random() * 0.45).toFixed(2),
  status: Math.random() > 0.6 ? 'Stable' : Math.random() > 0.3 ? 'Watch' : 'Critical',
}));

const STATUS_COLOR = { Stable: '#22c55e', Watch: '#f59e0b', Critical: '#ef4444' };

export default function GovtPortal({ user, profile }) {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  const isGovt = profile?.role === 'govt_authority';

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'alerts'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) setAlerts(data);
      setLoading(false);
    }, () => setLoading(false));

    const unsub2 = onSnapshot(collection(db, 'claims'), (snap) => {
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    return () => { unsub1(); unsub2(); };
  }, []);

  if (!isGovt) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '40px', color: '#1e1e1e' }}>⊘</div>
        <div style={{ fontSize: '16px', color: '#888', fontWeight: 600 }}>Access Denied</div>
        <div style={{ fontSize: '12px', color: '#777', textAlign: 'center', maxWidth: '300px' }}>
          This portal is restricted to Government Authority accounts only.<br />
          Contact your administrator to upgrade your role.
        </div>
      </div>
    );
  }

  const totalSubsidies = claims.filter(c => c.status === 'Approved').reduce((s, c) => s + (c.estimatedLoss || 0), 0);
  const pendingClaims = claims.filter(c => c.status === 'Pending').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical').length;
  const stableDistricts = DISTRICT_STATS.filter(d => d.status === 'Stable').length;

  const handleBulkApprove = async (district) => {
    const batch = writeBatch(db);
    claims.filter(c => c.district === district && c.status === 'Pending').forEach(c => {
      batch.update(doc(db, 'claims', c.id), { status: 'Approved', approvedAt: serverTimestamp() });
    });
    await batch.commit().catch(console.error);
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>Government Portal</h1>
          <span style={{
            fontSize: '9px', padding: '3px 8px', borderRadius: '4px',
            background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30', letterSpacing: '0.1em',
          }}>GOVT AUTHORITY</span>
        </div>
        <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
          Statewide Maharashtra agricultural intelligence dashboard
        </p>
      </div>

      {/* Stat Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          ['ACTIVE ALERTS', criticalAlerts, '#ef4444'],
          ['CLAIMS PENDING', pendingClaims, '#f59e0b'],
          ['SUBSIDIES ISSUED', formatINR(totalSubsidies), '#22c55e'],
          ['DISTRICTS STABLE', stableDistricts, '#3b82f6'],
        ].map(([l, v, c]) => (
          <div key={l} style={{
            background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px',
            padding: '18px 20px', flex: 1, minWidth: '150px',
          }}>
            <div style={{ fontSize: '9px', color: '#777', letterSpacing: '0.1em', marginBottom: '8px' }}>{l}</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* District Table */}
      <div style={{
        background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '12px',
        overflow: 'hidden', marginBottom: '24px',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>District Summary</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                {['District', 'Alerts', 'Claims', 'NDVI Avg', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: '9px',
                    color: '#777', letterSpacing: '0.1em', fontWeight: 400,
                  }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISTRICT_STATS.map((d, i) => (
                <tr key={d.district}
                  style={{
                    borderBottom: i < DISTRICT_STATS.length - 1 ? '1px solid #0f0f0f' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0d0d0d'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px', color: '#ccc' }}>{d.district}</td>
                  <td style={{ padding: '11px 16px', color: d.alerts > 5 ? '#ef4444' : d.alerts > 2 ? '#f59e0b' : '#999' }}>{d.alerts}</td>
                  <td style={{ padding: '11px 16px', color: '#999' }}>{d.claims}</td>
                  <td style={{ padding: '11px 16px', color: d.ndviAvg > 0.6 ? '#22c55e' : d.ndviAvg > 0.4 ? '#f59e0b' : '#ef4444' }}>{d.ndviAvg}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{
                      fontSize: '9px', padding: '3px 8px', borderRadius: '4px',
                      background: `${STATUS_COLOR[d.status]}15`, color: STATUS_COLOR[d.status],
                      border: `1px solid ${STATUS_COLOR[d.status]}30`, letterSpacing: '0.08em',
                    }}>{d.status.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleBulkApprove(d.district)}
                        style={{
                          padding: '5px 10px', borderRadius: '5px', fontSize: '9px',
                          fontFamily: "inherit", cursor: 'pointer',
                          background: '#22c55e10', color: '#22c55e', border: '1px solid #22c55e20',
                          letterSpacing: '0.05em', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#22c55e20'}
                        onMouseLeave={e => e.currentTarget.style.background = '#22c55e10'}
                      >
                        APPROVE CLAIMS
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Alerts */}
      <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Active Alerts — All Maharashtra</span>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.slice(0, 5).map(a => (
            <div key={a.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: '#111', borderRadius: '7px', border: '1px solid #1a1a1a',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '9px', padding: '2px 6px', borderRadius: '3px',
                  background: a.severity === 'Critical' ? '#ef444415' : '#f59e0b15',
                  color: a.severity === 'Critical' ? '#ef4444' : '#f59e0b',
                  border: `1px solid ${a.severity === 'Critical' ? '#ef444430' : '#f59e0b30'}`,
                }}>{a.severity?.toUpperCase()}</span>
                <span style={{ fontSize: '12px', color: '#ccc' }}>{a.type} — {a.district}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!a.reliefDispatched && (
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'alerts', a.id), { reliefDispatched: true, dispatchedAt: serverTimestamp() });
                      } catch {
                        setAlerts(prev => prev.map(al => al.id === a.id ? { ...al, reliefDispatched: true } : al));
                      }
                    }}
                    style={{
                      padding: '5px 10px', borderRadius: '5px', fontSize: '9px',
                      fontFamily: "inherit", cursor: 'pointer',
                      background: '#22c55e10', color: '#22c55e', border: '1px solid #22c55e20',
                      transition: 'all 0.15s',
                    }}
                  >DISPATCH RELIEF</button>
                )}
                {a.reliefDispatched && (
                  <span style={{ fontSize: '10px', color: '#22c55e' }}>✓ Relief Dispatched</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
