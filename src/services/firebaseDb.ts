import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: 'family-tree-177f2',
  appId: '1:470872961144:web:3f95247e3b69a0b533bd8d',
  storageBucket: 'family-tree-177f2.firebasestorage.app',
  apiKey: 'AIzaSyDUVk_rSXlf9fZA4xC20kr8eyq3mWTD31w',
  authDomain: 'family-tree-177f2.firebaseapp.com',
  messagingSenderId: '470872961144',
  measurementId: 'G-ZCVV33QDDV',
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

/**
 * Returns true when running in a real browser environment where Firestore is active.
 * In offline Node.js unit test runners (where `document` is undefined), services
 * use an isolated in-memory test store instead of live network calls.
 */
export function isBrowserRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined'
  );
}

export function getDb(): Firestore {
  if (!dbInstance) {
    appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance);
  }
  return dbInstance;
}
