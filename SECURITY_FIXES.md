# Security Fixes for Firestore Statistics

## Vulnerabilities Identified

### 1. **Missing Firestore Security Rules** ⚠️ CRITICAL
**Issue:** No Firestore security rules file was present, which means:
- If default rules allow writes, users could modify their statistics directly from the client
- Malicious users could use browser console or modified client code to write to Firestore
- Statistics could be manipulated without server validation

**Impact:** High - Users could inflate their win counts, modify game history, etc.

### 2. **Client-Side Write Access** ⚠️ HIGH
**Issue:** Without security rules, the Firebase client SDK could write directly to Firestore documents.

**Impact:** High - Direct manipulation of statistics from browser console

### 3. **Profile Update Function** ⚠️ LOW
**Issue:** The `ensurePlayerProfile` function uses `merge: true` which could theoretically overwrite fields if misused.

**Impact:** Low - Function is only called server-side with controlled data, and only updates profile fields

## Fixes Applied

### 1. Created Firestore Security Rules (`firestore.rules`)
- **Prevents client-side writes to statistics fields:**
  - `wins`, `losses`, `totalGames`, `lastResult`, `lastRoom`, `lastGameAt`, `createdAt`
- **Allows client-side updates to profile fields only:**
  - `displayName`, `email`, `photoURL`, `updatedAt`
- **Allows authenticated users to read player documents** (needed for leaderboard)
- **Prevents document deletion**

### 2. Added Documentation
- Created `FIRESTORE_SECURITY.md` with deployment instructions
- Added comments to `ensurePlayerProfile` function clarifying it never touches statistics

### 3. Backend Code Review
- Verified `recordGameResult()` is the only function that updates statistics
- Confirmed it uses server-side Admin SDK (bypasses security rules)
- Confirmed it uses atomic `increment()` operations
- Confirmed it validates game state before recording

## Deployment Steps

1. **Deploy Firestore Security Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```
   Or manually copy `firestore.rules` to Firebase Console → Firestore → Rules

2. **Verify Rules Are Active:**
   - Test that client-side writes to statistics fail
   - Verify leaderboard still works (read access)
   - Verify profile updates still work

3. **Monitor:**
   - Check Firestore logs for any denied write attempts
   - Verify statistics are only updated through `recordGameResult()`

## How Statistics Are Protected

1. **Server-Side Only Updates:**
   - Statistics are only updated by `recordGameResult()` in `backend/server.js`
   - Uses Firebase Admin SDK which bypasses security rules
   - Only called when a game actually completes

2. **Atomic Operations:**
   - Uses `FirebaseFieldValue.increment()` to prevent race conditions
   - Batch writes ensure consistency

3. **Validation:**
   - Skips test rooms (`isTestRoom` check)
   - Skips AI players
   - Only records when game state is `finished`

4. **Client-Side Protection:**
   - Security rules prevent direct writes
   - Frontend code only reads (no write operations)
   - Even if frontend code is modified, security rules block writes

## Testing

To verify the security rules work:

1. **Test from Browser Console:**
   ```javascript
   // This should FAIL after deploying rules
   import { doc, updateDoc } from 'firebase/firestore';
   const playerRef = doc(db, 'players', 'your-uid');
   await updateDoc(playerRef, { wins: 9999 }); // Should throw permission error
   ```

2. **Test Profile Update:**
   ```javascript
   // This should SUCCEED (if updating own document)
   await updateDoc(playerRef, { displayName: 'New Name' }); // Should work
   ```

## Additional Recommendations

1. **Monitor Firestore Logs:** Set up alerts for denied write attempts
2. **Regular Audits:** Periodically check for suspicious statistics patterns
3. **Rate Limiting:** Consider adding rate limiting to game result recording
4. **Backup Validation:** Consider adding server-side validation to ensure statistics make sense (e.g., wins + losses = totalGames)

