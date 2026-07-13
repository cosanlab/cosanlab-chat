import { initializeApp } from 'firebase/app'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

// Set VITE_USE_EMULATOR=true (dev/e2e) to run fully offline against the
// Firebase emulator suite — no .env.local needed in that mode.
export const USING_EMULATORS = import.meta.env.VITE_USE_EMULATOR === 'true'

// Web SDK config is public by design (security lives in database.rules.json);
// env vars keep it swappable between projects.
const firebaseConfig = USING_EMULATORS
  ? {
      apiKey: 'demo-key',
      authDomain: 'demo-cosanlab.firebaseapp.com',
      databaseURL: 'http://127.0.0.1:9000?ns=demo-cosanlab-default-rtdb',
      projectId: 'demo-cosanlab',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const auth = getAuth(app)

if (USING_EMULATORS) {
  connectDatabaseEmulator(db, '127.0.0.1', 9000)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
}
