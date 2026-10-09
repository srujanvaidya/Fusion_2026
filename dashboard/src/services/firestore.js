import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, where, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// ── USER PROFILE ─────────────────────────────────────────────
export const createUserProfile = async (user, extra = {}) => {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await updateDoc(ref, {}).catch(async () => {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(ref, {
        name: user.displayName || extra.name || '',
        email: user.email || '',
        role: extra.role || 'farmer',
        district: extra.district || '',
        createdAt: serverTimestamp(),
      });
    });
  }
};

export const getUserProfile = (uid, cb) => {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null));
};

// ── PARCELS ──────────────────────────────────────────────────
export const subscribeParcels = (uid, cb) => {
  const q = query(collection(db, 'parcels'), where('uid', '==', uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

export const addParcel = (uid, data) =>
  addDoc(collection(db, 'parcels'), { ...data, uid, createdAt: serverTimestamp() });

export const deleteParcel = (id) => deleteDoc(doc(db, 'parcels', id));

// ── ALERTS ───────────────────────────────────────────────────
export const subscribeAlerts = (cb, district = null) => {
  const constraints = [orderBy('createdAt', 'desc')];
  if (district) constraints.unshift(where('district', '==', district));
  const q = query(collection(db, 'alerts'), ...constraints);
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

export const addAlert = (data) =>
  addDoc(collection(db, 'alerts'), { ...data, createdAt: serverTimestamp() });

export const updateAlert = (id, data) => updateDoc(doc(db, 'alerts', id), data);

// ── CLAIMS ───────────────────────────────────────────────────
export const subscribeClaims = (uid, cb) => {
  const q = query(collection(db, 'claims'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

export const addClaim = (uid, data) =>
  addDoc(collection(db, 'claims'), { ...data, uid, status: 'Pending', createdAt: serverTimestamp() });

export const updateClaim = (id, data) => updateDoc(doc(db, 'claims', id), data);

// ── MUTATIONS ────────────────────────────────────────────────
export const subscribeMutations = (parcelId, cb) => {
  const q = query(collection(db, 'mutations'), where('parcelId', '==', parcelId), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

// ── FIELD REPORTS ────────────────────────────────────────────
export const addFieldReport = (uid, data) =>
  addDoc(collection(db, 'field-reports'), { ...data, uid, createdAt: serverTimestamp() });

export const subscribeFieldReports = (uid, cb) => {
  const q = query(collection(db, 'field-reports'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};
