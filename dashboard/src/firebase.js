import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyC85U4ZDm9zYGDKqmjmKTV7OvUudyANWQY',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'skycrop-77a29.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'skycrop-77a29',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'skycrop-77a29.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '622739856326',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:622739856326:web:890ec5758fa73ebefc70c7',
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || 'G-BX90W1QSMM',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
