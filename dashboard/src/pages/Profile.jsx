import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLang } from '../i18n/LangContext';
import { useTheme } from '../i18n/ThemeContext';
import { useLocationData, DISTRICT_MARATHI } from '../data/useLocationData';

export default function Profile({ user, profile }) {
  const { theme } = useTheme();
  const { t } = useLang();

  const [parcelsCount, setParcelsCount] = useState(0);
  const [claimsCount, setClaimsCount]   = useState(0);
  const [isEditing, setIsEditing]       = useState(false);
  const [loading, setLoading]           = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    aadhar: '',
    address: '',
    district: '',
    taluka: '',
    village: '',
    pincode: ''
  });

  const districtOpts = Object.keys(DISTRICT_MARATHI).sort();
  const { talukasList, villagesList, loading: locLoading } = useLocationData(formData.district, formData.taluka);

  useEffect(() => {
    if (!user) return;
    
    getDocs(query(collection(db, 'parcels'), where('uid', '==', user.uid)))
      .then(snap => setParcelsCount(snap.size)).catch(() => {});
      
    getDocs(query(collection(db, 'claims'), where('uid', '==', user.uid)))
      .then(snap => setClaimsCount(snap.size)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        aadhar: profile.aadhar || '',
        address: profile.address || '',
        district: profile.district || '',
        taluka: profile.taluka || '',
        village: profile.village || '',
        pincode: profile.pincode || ''
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    }
    setLoading(false);
  };

  const name = profile?.name || user?.phoneNumber || 'Farmer';
  const getRoleDisplay = () => {
    const r = profile?.role;
    if (r === 'gram_panchayat' || r === 'gp') return t('Gram Panchayat');
    if (r === 'talathi') return t('Talathi');
    if (r === 'officer' || r === 'field_officer' || r === 'field officer') return t('Field Officer');
    return t('Registered Farmer');
  };
  const role = getRoleDisplay();
  const phone = user?.phoneNumber || '+91 - Unknown';
  const loc = profile?.district ? `${profile.village || ''}, ${profile.district}` : 'Location not set';

  const cardStyle = {
    background: theme.card,
    borderRadius: '24px',
    padding: '32px',
    boxShadow: theme.shadow,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    border: `1px solid ${theme.border}`
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.text,
    marginBottom: '6px',
    opacity: 0.6
  };

  const valueStyle = {
    fontSize: '18px',
    fontWeight: 500,
    color: theme.text,
    marginBottom: '24px'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: `1px solid rgba(0,0,0,0.15)`,
    background: theme.inputBg,
    fontSize: '15px',
    color: theme.text,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '20px'
  };

  const readOnlyInputStyle = { ...inputStyle, background: 'rgba(0,0,0,0.03)', color: '#666', cursor: 'not-allowed' };

  return (
    <div className="sc-page-gutter" style={{ padding: '20px 40px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' }}>

      {/* Header */}
      <div className="sc-profile-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'32px' }}>
        <div>
          <div className="sc-desktop-only" style={{ fontSize: '12px', color: theme.text, opacity: 0.6, letterSpacing: '0.02em', marginBottom: '4px', fontWeight: 600 }}>Account & Settings</div>
          <h1 style={{ fontSize: '40px', fontWeight: 400, color: theme.text, margin: 0, letterSpacing: '-0.04em' }}>Profile Management</h1>
        </div>
      </div>

      <div className="resp-grid-2 sc-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
        
        {/* Left: Identity Card */}
        <div style={cardStyle} className="sc-profile-identity">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 700, color: theme.accentText || '#000000', marginBottom: '16px', boxShadow: '0 8px 24px rgba(0,210,255,0.35)' }}>
              {name.slice(0,2).toUpperCase()}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: theme.text, margin: '0 0 4px 0' }}>{name}</h2>
            <div style={{ fontSize: '14px', fontWeight: 500, color: theme.text, opacity: 0.7 }}>{role}</div>
            
            <div style={{ marginTop: '16px', background: '#e5e5e5', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: theme.text }}>
              ID: {user?.uid.slice(0,8)}...
            </div>
          </div>

          <div>
            <div style={labelStyle}>Contact Number</div>
            <div style={valueStyle}>{phone}</div>

            <div style={labelStyle}>Registered Location</div>
            <div style={valueStyle}>{loc}</div>
            
            <div style={labelStyle}>Account Status</div>
            <div style={{ ...valueStyle, color: '#16a34a', fontWeight: 600 }}>Active & Verified</div>
          </div>
        </div>

        {/* Right: Stats & Edit Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Stats */}
          <div className="sc-profile-stats-row resp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ ...cardStyle, padding: '24px' }}>
              <div style={{ fontSize: '40px', fontWeight: 300, color: theme.text, marginBottom: '8px' }}>{parcelsCount}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text, opacity: 0.8 }}>Registered Parcels</div>
            </div>
            <div style={{ ...cardStyle, padding: '24px' }}>
              <div style={{ fontSize: '40px', fontWeight: 300, color: theme.text, marginBottom: '8px' }}>{claimsCount}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: theme.text, opacity: 0.8 }}>Insurance Claims Filed</div>
            </div>
          </div>

          {/* Details Form / View */}
          <div style={{ ...cardStyle, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: theme.text }}>Personal Information</h2>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} style={{ background: theme.text, color: theme.bg, border: 'none', borderRadius: '30px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                  Edit Profile
                </button>
              )}
            </div>
            
            {!isEditing ? (
              // View Mode
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'x-20px' }}>
                <div>
                  <div style={labelStyle}>Full Name</div>
                  <div style={valueStyle}>{profile?.name || 'Not provided'}</div>
                  
                  <div style={labelStyle}>Village</div>
                  <div style={valueStyle}>{profile?.village || 'Not provided'}</div>

                  <div style={labelStyle}>Pincode</div>
                  <div style={valueStyle}>{profile?.pincode || 'Not provided'}</div>
                </div>
                <div>
                  <div style={labelStyle}>Aadhar / Identity No.</div>
                  <div style={valueStyle}>{profile?.aadhar || 'Not provided'}</div>

                  <div style={labelStyle}>District</div>
                  <div style={valueStyle}>{profile?.district || 'Not provided'}</div>

                  <div style={labelStyle}>Taluka</div>
                  <div style={valueStyle}>{profile?.taluka || 'Not provided'}</div>

                  <div style={labelStyle}>Address</div>
                  <div style={valueStyle}>{profile?.address || 'Not provided'}</div>
                </div>
              </div>
            ) : (
              // Edit Mode
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                  <div>
                    <div style={labelStyle}>Phone Number (Uneditable)</div>
                    <input style={readOnlyInputStyle} value={phone} readOnly />
                  </div>
                  <div>
                    <div style={labelStyle}>Full Name</div>
                    <input style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Enter your full name" />
                  </div>
                  
                  <div>
                    <div style={labelStyle}>Aadhar / Identity No.</div>
                    <input style={inputStyle} value={formData.aadhar} onChange={e => setFormData({...formData, aadhar: e.target.value})} placeholder="XXXX-XXXX-XXXX" />
                  </div>
                  <div>
                    <div style={labelStyle}>District</div>
                    <select style={inputStyle} value={formData.district} onChange={e => setFormData({...formData, district: e.target.value, taluka: '', village: ''})}>
                      <option value="">Select district</option>
                      {districtOpts.map(d => <option key={d} value={d}>{DISTRICT_MARATHI[d] || d}</option>)}
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>Taluka</div>
                    <select style={inputStyle} value={formData.taluka} onChange={e => setFormData({...formData, taluka: e.target.value, village: ''})} disabled={!talukasList.length}>
                      <option value="">{locLoading ? 'Loading...' : 'Select taluka'}</option>
                      {talukasList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>Village</div>
                    <select style={inputStyle} value={formData.village} onChange={e => setFormData({...formData, village: e.target.value})} disabled={!villagesList.length}>
                      <option value="">{locLoading ? 'Loading...' : 'Select village'}</option>
                      {villagesList.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Pincode</div>
                    <input style={inputStyle} value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} placeholder="Enter pincode" />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Detailed Address</div>
                  <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Enter your complete address..." />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button onClick={() => {
                    // Reset to original on cancel
                    setFormData({
                      name: profile?.name || '',
                      aadhar: profile?.aadhar || '',
                      address: profile?.address || '',
                      district: profile?.district || '',
                      taluka: profile?.taluka || '',
                      village: profile?.village || '',
                      pincode: profile?.pincode || ''
                    });
                    setIsEditing(false);
                  }} style={{ background: 'transparent', color: theme.text, border: '1px solid #ccc', borderRadius: '30px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={loading} style={{ background: theme.accent, color: theme.accentText || '#000000', border: 'none', borderRadius: '30px', padding: '12px 32px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,210,255,0.25)' }}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
