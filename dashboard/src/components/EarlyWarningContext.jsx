import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { visibleClaims } from '../data/hiddenClaims';
import { buildAlerts, DEMO_PARCELS } from '../services/earlyWarning';

const Ctx = createContext({ alerts: [], unread: 0, parcels: [], isDemo: false });
export const useEarlyWarnings = () => useContext(Ctx);

const READ_KEY = 'skycrop_ew_read';
const PUSHED_KEY = 'skycrop_ew_pushed';

const loadSet = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
};
const saveSet = (key, set) => {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-200))); } catch { /* storage blocked */ }
};

export function EarlyWarningProvider({ user, profile, lang, children }) {
  const [parcels, setParcels] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [readIds, setReadIds] = useState(() => loadSet(READ_KEY));
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const pushed = useRef(loadSet(PUSHED_KEY));

  // Same scoping rules as the dashboard: GP sees its village, everyone else their own land.
  useEffect(() => {
    if (!user) return undefined;
    const onErr = () => setLoaded(true);
    if (profile?.role === 'gram_panchayat') {
      const dist = (profile?.district || 'Satara').trim() || 'Satara';
      return onSnapshot(query(collection(db, 'parcels'), where('district', '==', dist)), (s) => {
        const vil = (profile?.village || '').trim().toLowerCase();
        let rows = s.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
        if (vil) rows = rows.filter((p) => (p.village || '').trim().toLowerCase() === vil);
        setParcels(rows); setLoaded(true);
      }, onErr);
    }
    return onSnapshot(query(collection(db, 'parcels'), where('uid', '==', user.uid)), (s) => {
      setParcels(s.docs.map((d) => ({ firestoreId: d.id, ...d.data() })));
      setLoaded(true);
    }, onErr);
  }, [user, profile?.role, profile?.district, profile?.village]);

  // Claims visible to this user (GP: own village; everyone else: their own).
  useEffect(() => {
    if (!user) return undefined;
    const isGp = profile?.role === 'gram_panchayat';
    const q = isGp ? query(collection(db, 'claims')) : query(collection(db, 'claims'), where('uid', '==', user.uid));
    return onSnapshot(q, (s) => {
      let rows = visibleClaims(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (isGp) {
        const dist = (profile?.district || '').trim();
        const vil = (profile?.village || '').trim().toLowerCase();
        if (dist) rows = rows.filter((c) => (c.district || '').trim() === dist);
        if (vil) rows = rows.filter((c) => (c.village || '').trim().toLowerCase() === vil);
      }
      setClaims(rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, () => setClaims([]));
  }, [user, profile?.role, profile?.district, profile?.village]);

  const isDemo = parcels.length === 0;
  const source = isDemo ? DEMO_PARCELS : parcels;
  const alerts = useMemo(() => buildAlerts(source), [source]);
  const unread = alerts.filter((a) => !readIds.has(a.id)).length;

  const markRead = useCallback((ids) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveSet(READ_KEY, next);
      return next;
    });
  }, []);
  const markAllRead = useCallback(() => markRead(alerts.map((a) => a.id)), [alerts, markRead]);

  const enablePush = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  }, []);

  // OS-level push for critical alerts, once per alert id.
  useEffect(() => {
    if (permission !== 'granted') return;
    alerts.filter((a) => a.level === 'critical' && !pushed.current.has(a.id)).forEach((a) => {
      pushed.current.add(a.id);
      try {
        new Notification(lang === 'mr' ? 'पीक तणाव इशारा' : 'Crop stress alert', {
          body: `${a.crop} · ${a.where}\n${a.message[lang === 'mr' ? 'mr' : 'en']}`,
          tag: a.id,
        });
      } catch { /* ignore */ }
    });
    saveSet(PUSHED_KEY, pushed.current);
  }, [alerts, permission, lang]);

  const value = useMemo(() => ({
    alerts, unread, parcels: source, claims, isDemo, loaded, readIds, markRead, markAllRead, permission, enablePush,
  }), [alerts, unread, source, claims, isDemo, loaded, readIds, markRead, markAllRead, permission, enablePush]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
