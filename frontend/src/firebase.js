import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const hasFirebaseConfig =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app = null;
let auth = null;
let googleProvider = null;

if (hasFirebaseConfig) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();

  // Attempt to enable Analytics only when supported (and in browser)
  if (typeof window !== 'undefined') {
    isAnalyticsSupported()
      .then((supported) => {
        if (supported && firebaseConfig.measurementId) {
          getAnalytics(app);
        }
      })
      .catch((err) => {
        console.warn('[Firebase] Analytics not enabled:', err);
      });
  }
} else if (process.env.NODE_ENV === 'development') {
  console.warn('[Firebase] Web config environment variables missing. Firebase features disabled on client.');
}

export { app, auth, googleProvider, hasFirebaseConfig };

