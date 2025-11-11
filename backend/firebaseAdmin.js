const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

let app = null;
let db = null;
let auth = null;
let fieldValue = null;

if (projectId && clientEmail && rawPrivateKey) {
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  try {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });

    db = admin.firestore();
    auth = admin.auth();
    fieldValue = admin.firestore.FieldValue;
    console.log('[Firebase] Initialized Firebase Admin SDK');
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase Admin SDK', error);
  }
} else {
  console.warn('[Firebase] Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY env vars. Firebase features disabled.');
}

function isFirebaseEnabled() {
  return Boolean(app && db && auth);
}

async function verifyIdToken(idToken) {
  if (!auth) {
    throw new Error('Firebase not configured.');
  }

  return auth.verifyIdToken(idToken);
}

module.exports = {
  admin,
  app,
  db,
  auth,
  fieldValue,
  isFirebaseEnabled,
  verifyIdToken
};

