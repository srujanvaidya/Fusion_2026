import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MOCK_PARCELS } from '../data/maharashtra.js';

export default function Records({ user, profile }) {
  const isFarmer = profile?.role === 'farmer';
  const [parcels, setParcels] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    // Farmers: own parcels only. GP/Talathi: all parcels
    const q = isFarmer
      ? query(collection(db, 'parcels'), where('uid', '==', user.uid))
      : collection(db, 'parcels');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length > 0) { setParcels(data); setSelected(data[0]); }
      else if (isFarmer) { setParcels([]); setSelected(null); }
      else { setParcels(MOCK_PARCELS); setSelected(MOCK_PARCELS[0]); }
    }, () => {
      setParcels(MOCK_PARCELS); setSelected(MOCK_PARCELS[0]);
    });
    return unsub;
  }, [user, isFarmer]);

  useEffect(() => {
    if (parcels.length && !selected) setSelected(parcels[0]);
  }, [parcels]);

  // Support both new field names (gatNumber) and old mock (gatNo)
  const gat   = selected?.gatNumber || selected?.gatNo || '—';
  const plot  = selected?.plotNumber || selected?.surveyNo || '—';
  const owner = selected?.ownerName || '—';

  const fields = selected ? [
    ['जिल्हा', 'District', selected.district || '—'],
    ['तालुका', 'Taluka', selected.taluka || '—'],
    ['गाव', 'Village', selected.village || '—'],
    ['गट नंबर', 'Gat No.', gat],
    ['सर्व्हे नंबर', 'Survey / Plot No.', plot],
    ['खातेदाराचे नाव', 'Owner Name', owner],
    ['एकूण क्षेत्र', 'Total Area', selected.area ? `${selected.area} Hectares` : '—'],
    ['जमिनीचा प्रकार', 'Land Type', selected.landType || '—'],
    ['पिकांची नावे', 'Crops', selected.crop || '—'],
    ['पाण्याचा स्रोत', 'Water Source', selected.waterSource || '—'],
    ['राज्य', 'State', selected.state || 'Maharashtra'],
    ['फेरफार नंबर', 'Mutation No.', `फे-${gat}01`],
  ] : [];

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>7/12 Records — सातबारा उतारा</h1>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Official land records in Marathi and English
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Parcel selector */}
        <div style={{ minWidth: '200px' }}>
          <div style={{ fontSize: '10px', color: '#777', letterSpacing: '0.1em', marginBottom: '10px' }}>SELECT PARCEL</div>
          {parcels.length === 0 && isFarmer && (
            <div style={{ fontSize: '12px', color: '#666', padding: '12px', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #1e1e1e' }}>
              No parcels added yet. Go to <strong style={{color:'#22c55e'}}>My Land Parcels</strong> to add your GAT.
            </div>
          )}
          {parcels.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              style={{
                padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                background: selected?.id === p.id ? '#111' : '#0a0a0a',
                border: `1px solid ${selected?.id === p.id ? '#22c55e' : '#1e1e1e'}`,
                marginBottom: '8px', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = '#2a2a2a'; }}
              onMouseLeave={e => { if (selected?.id !== p.id) e.currentTarget.style.borderColor = '#1e1e1e'; }}
            >
              <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>Gat {p.gatNumber || p.gatNo}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{p.village}, {p.taluka}</div>
            </div>
          ))}
        </div>

        {/* 7/12 Record Card */}
        {selected && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{
              background: '#0a0a0a', border: '1px solid #22c55e20', borderRadius: '12px',
              padding: '24px', marginBottom: '16px',
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '1px solid #1e1e1e', paddingBottom: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: '#777', letterSpacing: '0.15em', marginBottom: '4px' }}>
                  महाराष्ट्र शासन / GOVERNMENT OF MAHARASHTRA
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                  सातबारा उतारा / 7/12 Extract
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  महसूल व वन विभाग / Revenue & Forest Department
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
                {fields.map(([marathi, english, value]) => (
                  <div key={english} style={{ borderBottom: '1px solid #111', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '9px', color: '#22c55e', letterSpacing: '0.05em' }}>{marathi}</span>
                      <span style={{ fontSize: '9px', color: '#777' }}>/ {english.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a
                href="https://mahabhumi.gov.in/DigiSatbara/"
                target="_blank" rel="noreferrer"
                style={{
                  padding: '10px 18px', borderRadius: '8px', fontSize: '11px',
                  background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30',
                  textDecoration: 'none', letterSpacing: '0.03em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#22c55e25'}
                onMouseLeave={e => e.currentTarget.style.background = '#22c55e15'}
              >
                Download 7/12 PDF (DigiSatbara)
              </a>
              <a
                href="https://mahabhumi.gov.in/DigiSatbara/"
                target="_blank" rel="noreferrer"
                style={{
                  padding: '10px 18px', borderRadius: '8px', fontSize: '11px',
                  background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630',
                  textDecoration: 'none', letterSpacing: '0.03em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#3b82f625'}
                onMouseLeave={e => e.currentTarget.style.background = '#3b82f615'}
              >
                Download 8-A Extract
              </a>
              <a
                href="https://bhulekh.mahabhumi.gov.in"
                target="_blank" rel="noreferrer"
                style={{
                  padding: '10px 18px', borderRadius: '8px', fontSize: '11px',
                  background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b30',
                  textDecoration: 'none', letterSpacing: '0.03em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f59e0b25'}
                onMouseLeave={e => e.currentTarget.style.background = '#f59e0b15'}
              >
                Mutation Certificate
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
