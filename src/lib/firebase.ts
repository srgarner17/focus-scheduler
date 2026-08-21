import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// Firebase's client config is not a secret: access control is enforced by
// Firestore security rules, not by hiding these values, so it's safe to
// commit them directly rather than threading them through env vars per host.
const firebaseConfig = {
  apiKey: 'AIzaSyD8zwa0GsEFiaDe6Z_it3A9UMnIFvrQzBw',
  authDomain: 'focus-scheduler-d5c54.firebaseapp.com',
  projectId: 'focus-scheduler-d5c54',
  storageBucket: 'focus-scheduler-d5c54.firebasestorage.app',
  messagingSenderId: '175821470028',
  appId: '1:175821470028:web:6531e67c7f6409594977e9',
};

const app = initializeApp(firebaseConfig);

// Offline persistence so the app still works (and queues writes) without
// wifi, syncing automatically once the connection comes back.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);

let signedIn: Promise<void> | null = null;

export function ensureSignedIn(): Promise<void> {
  if (!signedIn) {
    signedIn = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      });
      signInAnonymously(auth).catch((err) => {
        unsubscribe();
        reject(err);
      });
    });
  }
  return signedIn;
}
