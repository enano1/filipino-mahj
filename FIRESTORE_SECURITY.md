# Firestore Security Rules

This document describes the Firestore security rules that protect player statistics from unauthorized modification.

## Security Rules File

The `firestore.rules` file contains security rules that prevent users from modifying their statistics directly through the client-side Firebase SDK.

## Key Protections

1. **Statistics Fields are Read-Only for Clients**
   - `wins`, `losses`, `totalGames`, `lastResult`, `lastRoom`, `lastGameAt`, `createdAt` cannot be modified by client-side code
   - These fields can only be updated by the backend server using the Firebase Admin SDK (which bypasses security rules)

2. **Profile Fields Can Be Updated**
   - Users can update their own profile fields: `displayName`, `email`, `photoURL`, `updatedAt`
   - Users can only update their own document (must match their authenticated UID)

3. **Read Access**
   - Authenticated users can read any player document (needed for the leaderboard)

4. **Document Creation**
   - Users can create their own player document, but cannot include statistics fields
   - Statistics fields are initialized by the server

## Deployment

To deploy these security rules to your Firebase project:

1. **Using Firebase CLI:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Using Firebase Console:**
   - Go to Firebase Console → Firestore Database → Rules
   - Copy the contents of `firestore.rules`
   - Paste into the rules editor
   - Click "Publish"

## How Statistics Are Updated

Statistics are updated **only** by the backend server in the `recordGameResult()` function in `backend/server.js`. This function:

- Uses the Firebase Admin SDK (which bypasses security rules)
- Uses atomic `increment()` operations to prevent race conditions
- Only updates statistics when a game actually completes
- Validates that the game is not a test room
- Validates that the winner is not an AI player

## Testing Security Rules

You can test these rules using the Firebase Console Rules Playground or by attempting to write statistics from client-side code (which should fail).

## Important Notes

- The Admin SDK bypasses all security rules, so server-side code can always write statistics
- Client-side code using the Firebase Web SDK is subject to these rules
- These rules prevent malicious users from modifying their statistics via browser console or modified client code

