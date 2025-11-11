#!/usr/bin/env node

/**
 * Manually award wins to a player document in Firestore.
 *
 * Usage:
 *   node scripts/awardWin.js <firebase-uid> [winCount]
 *
 * Example:
 *   node scripts/awardWin.js abc123 2
 *
 * Requirements:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   must be set (e.g., via backend/.env) so firebaseAdmin can initialize.
 */

const { db, fieldValue, isFirebaseEnabled } = require('../firebaseAdmin');

async function main() {
  if (!isFirebaseEnabled()) {
    console.error('Firebase Admin SDK is not configured. Check your environment variables.');
    process.exit(1);
  }

  const [, , uid, winArg] = process.argv;

  if (!uid) {
    console.error('Usage: node scripts/awardWin.js <firebase-uid> [winCount]');
    process.exit(1);
  }

  const winsToAdd = Number.isFinite(Number(winArg)) ? Number(winArg) : 1;

  try {
    const playerRef = db.collection('players').doc(uid);
    const snapshot = await playerRef.get();

    if (!snapshot.exists) {
      console.error(`No player document found for uid=${uid}.`);
      process.exit(1);
    }

    await playerRef.set(
      {
        wins: fieldValue.increment(winsToAdd),
        totalGames: fieldValue.increment(winsToAdd),
        lastResult: 'win',
        lastRoom: snapshot.get('lastRoom') || null,
        updatedAt: fieldValue.serverTimestamp(),
        lastGameAt: fieldValue.serverTimestamp()
      },
      { merge: true }
    );

    console.log(`✅ Awarded ${winsToAdd} win(s) to player ${uid}.`);
  } catch (error) {
    console.error('Failed to award win:', error);
    process.exit(1);
  }
}

main();

