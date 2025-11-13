import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import './App.css';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import ProfileWidget from './components/ProfileWidget';
import Leaderboard from './components/Leaderboard';
import EnvDebug from './EnvDebug';
import { auth, googleProvider, hasFirebaseConfig, db } from './firebase';

// WebSocket URL - must be set in environment variables for production
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

// Log the WebSocket URL for debugging
console.log('WebSocket URL:', WS_URL);
console.log('All REACT_APP_ env vars:', Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')));

function App() {
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(-1);
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState('');
  const [actionAvailable, setActionAvailable] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [authReady, setAuthReady] = useState(!hasFirebaseConfig);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [playerStats, setPlayerStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(hasFirebaseConfig);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(hasFirebaseConfig);
  const [headerProfileOpen, setHeaderProfileOpen] = useState(false);
  const [headerLeaderboardOpen, setHeaderLeaderboardOpen] = useState(false);
  
  const wsRef = useRef(null);
  const authTokenRef = useRef(null);
  const headerProfileRef = useRef(null);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      setAuthReady(true);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          const token = await user.getIdToken();
          authTokenRef.current = token;
          setAuthError(null);
        } catch (err) {
          console.error('Failed to fetch Firebase ID token:', err);
          authTokenRef.current = null;
          setAuthError('Unable to refresh login. Please sign in again.');
        }
      } else {
        authTokenRef.current = null;
      }

      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const requestIdToken = async () => {
    if (!auth || !auth.currentUser) {
      setMessage('You need to sign in before playing.');
      return null;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      authTokenRef.current = token;
      return token;
    } catch (err) {
      console.error('Failed to retrieve Firebase ID token', err);
      setMessage('Session expired. Please sign in again.');
      authTokenRef.current = null;
      return null;
    }
  };

  const handleSignIn = async () => {
    if (!hasFirebaseConfig || !auth || !googleProvider) {
      setAuthError('Firebase is not configured for the frontend.');
      return;
    }

    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in failed', err);
      setAuthError(err?.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    setIsSigningOut(true);
    try {
      await signOut(auth);
      setMessage('Signed out successfully.');
    } catch (err) {
      console.error('Sign-out failed', err);
      setAuthError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const connectWebSocket = useCallback(() => {
    const websocket = new WebSocket(WS_URL);
    
    websocket.onopen = () => {
      console.log('Connected to server');
      setConnected(true);
      setMessage('Connected to server');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      switch (data.type) {
        case 'room-created':
          setRoomCode(data.roomCode);
          setPlayerIndex(data.playerIndex);
          setMessage(`Room created: ${data.roomCode}`);
          break;
          
        case 'room-joined':
          setRoomCode(data.roomCode);
          setPlayerIndex(data.playerIndex);
          setMessage(data.isRejoin 
            ? `Rejoined room: ${data.roomCode}` 
            : data.isTestRoom 
              ? `Joined test room ${data.roomCode} - You vs 3 AI players!`
              : `Joined room: ${data.roomCode}`);
          
          // If rejoining mid-game, set the game state
          if (data.gameState) {
            setGameState(data.gameState);
          }
          break;
          
        case 'player-joined':
          if (data.isRejoin && data.rejoiningPlayer) {
            setMessage(`${data.rejoiningPlayer} rejoined the game`);
          } else {
            setMessage(`${data.playerCount}/4 players in room`);
          }
          break;
          
        case 'game-started':
          setMessage(data.message);
          break;
          
        case 'ai-move':
          setMessage(data.message);
          setTimeout(() => setMessage(''), 2000);
          break;
          
        case 'game-state':
          setGameState(data.state);
          
          // Clear action availability if lastDiscard is null (tile was claimed or turn advanced)
          if (!data.state.lastDiscard) {
            setActionAvailable(null);
          }
          break;
          
        case 'action-available':
          setActionAvailable({
            type: data.action,
            tile: data.tile,
            options: data.options,
            discardTimestamp: Date.now() // Track when this action became available
          });
          break;
          
        case 'auto-redraw':
          setMessage(`🔄 ${data.message}`);
          setTimeout(() => setMessage(''), 3000);
          break;
          
        case 'action-expired':
          setActionAvailable(null);
          setMessage('⏰ Claim opportunity expired!');
          setTimeout(() => setMessage(''), 2000);
          break;
          
        case 'claim-success':
          setMessage(`✅ ${data.message}`);
          setActionAvailable(null); // Clear any pending actions
          setTimeout(() => setMessage(''), 3000);
          break;
          
        case 'claim-window-expired':
          setActionAvailable(null);
          setMessage('⏱️ No claims - turn advancing');
          setTimeout(() => setMessage(''), 2000);
          break;

        case 'force-draw':
          setMessage('⚙️ Force draw triggered. You should be able to draw now.');
          setTimeout(() => setMessage(''), 3000);
          break;

        case 'force-draw-denied':
          setMessage('🚫 Force draw denied: ' + (data.message || 'Not your turn.'));
          setTimeout(() => setMessage(''), 3000);
          break;
          
        case 'game-won':
          setMessage(data.message);
          break;
          
        case 'game-over':
          setMessage(data.message);
          break;
          
        case 'game-reset':
          setMessage(data.message);
          setTimeout(() => setMessage(''), 3000);
          break;
          
        case 'mahjong-invalid':
          setMessage(data.message || 'Hand is not Mahjong yet.');
          setTimeout(() => setMessage(''), 3000);
          break;

        case 'announcement':
          setMessage(data.message);
          setTimeout(() => setMessage(''), 3000);
          break;

        case 'player-left':
          setMessage(data.message);
          break;
          
        case 'error':
          setMessage(data.message);
          setTimeout(() => setMessage(''), 3000);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    };
    
    websocket.onclose = () => {
      console.log('Disconnected from server');
      setConnected(false);
      setMessage('Disconnected from server');
      
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current = websocket;
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (!headerProfileOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        headerProfileRef.current &&
        !headerProfileRef.current.contains(event.target)
      ) {
        setHeaderProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setHeaderProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [headerProfileOpen]);

  useEffect(() => {
    if (!headerLeaderboardOpen) {
      return;
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setHeaderLeaderboardOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [headerLeaderboardOpen]);

  useEffect(() => {
    if (!currentUser) {
      setHeaderProfileOpen(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!hasFirebaseConfig || !db) {
      setPlayerStats(null);
      setStatsLoading(false);
      return;
    }

    if (!currentUser) {
      setPlayerStats(null);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);
    const playerDocRef = doc(db, 'players', currentUser.uid);
    const unsubscribe = onSnapshot(
      playerDocRef,
      (snapshot) => {
        setPlayerStats(snapshot.exists() ? snapshot.data() : null);
        setStatsLoading(false);
      },
      (error) => {
        console.error('[Firestore] Failed to fetch player stats', error);
        setStatsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!hasFirebaseConfig || !db) {
      setLeaderboard([]);
      setLeaderboardLoading(false);
      return;
    }

    setLeaderboardLoading(true);
    const leaderboardQuery = query(
      collection(db, 'players'),
      orderBy('wins', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        const entries = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          const wins = data.wins || 0;
          const totalGames = data.totalGames || 0;
          const winRate = totalGames > 0
            ? `${Math.round((wins / totalGames) * 100)}%`
            : '0%';

          return {
            id: docSnap.id,
            displayName: data.displayName || data.email || 'Player',
            email: data.email || null,
            wins,
            totalGames,
            winRate
          };
        }).filter((entry) => entry.totalGames > 0 || entry.wins > 0);

        setLeaderboard(entries);
        setLeaderboardLoading(false);
      },
      (error) => {
        console.error('[Firestore] Failed to fetch leaderboard', error);
        setLeaderboard([]);
        setLeaderboardLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const sendMessage = (data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const sendAuthedMessage = async (data) => {
    const payload = { ...data };

    if (hasFirebaseConfig) {
      const token = await requestIdToken();
      if (!token) {
        return false;
      }
      payload.idToken = token;
    }

    sendMessage(payload);
    return true;
  };

  const createRoom = (playerName) => {
    return sendAuthedMessage({ type: 'create-room', playerName });
  };

  const joinRoom = (code, playerName) => {
    return sendAuthedMessage({ type: 'join-room', roomCode: code, playerName });
  };

  const drawTile = () => {
    sendMessage({ type: 'draw' });
  };

  const discardTile = (tile) => {
    sendMessage({ type: 'discard', tile });
    setActionAvailable(null);
  };

  const claimTile = (claimType, tiles) => {
    sendMessage({ type: 'claim', claimType, tiles });
    setActionAvailable(null);
  };

  const passClaim = () => {
    sendMessage({ type: 'pass' });
    setActionAvailable(null);
  };

  const declareMahjong = () => {
    sendMessage({ type: 'mahjong' });
  };

  const forceDraw = () => {
    sendMessage({ type: 'force-draw' });
  };

  const feedKongTile = () => {
    sendMessage({ type: 'test-feed-kong' });
  };

  const resetTestRoom = () => {
    if (roomCode === '9999') {
      sendMessage({ type: 'reset-test-room' });
    }
  };


  // Show debug page if ?debug is in URL
  if (window.location.search.includes('debug')) {
    return <EnvDebug />;
  }

  return (
    <div className="App">
      <header className={`App-header ${headerCollapsed ? 'collapsed' : ''}`}>
        <button
          className="header-toggle"
          onClick={() => setHeaderCollapsed(prev => !prev)}
          aria-expanded={!headerCollapsed}
          aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
        >
          {headerCollapsed ? '▼' : '▲'}
        </button>

        {!headerCollapsed && (
          <>
            <h1>🀄 Filipino Mahjong</h1>
            <div className="status-bar">
              <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
                {connected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
              {roomCode && <span className="room-code">Room: {roomCode}</span>}
              {hasFirebaseConfig && (
                <>
                  <button
                    type="button"
                    className="header-leaderboard-btn"
                    onClick={() => setHeaderLeaderboardOpen(true)}
                    disabled={leaderboardLoading}
                    title="View leaderboard"
                  >
                    🏆 Leaderboard
                  </button>
                  <div
                    className="auth-status"
                    ref={headerProfileRef}
                  >
                    {!authReady && (
                      <span className="auth-status-message">Loading account...</span>
                    )}

                    {authReady && currentUser && (
                      <>
                        <button
                          type="button"
                          className="auth-button profile"
                          onClick={() => setHeaderProfileOpen((prev) => !prev)}
                          aria-haspopup="true"
                          aria-expanded={headerProfileOpen}
                          title="View your stats"
                        >
                          {currentUser.photoURL ? (
                            <img
                              className="auth-avatar"
                              src={currentUser.photoURL}
                              alt={currentUser.displayName || currentUser.email || 'Player avatar'}
                            />
                          ) : (
                            <span className="auth-initial">
                              {(currentUser.displayName || currentUser.email || 'P')
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                          <span className="auth-name">
                            {currentUser.displayName || currentUser.email || 'Signed in'}
                          </span>
                          <span className="auth-caret">▾</span>
                        </button>

                        {headerProfileOpen && (
                          <div
                            className="header-profile-popover"
                            role="dialog"
                            aria-label="Your stats"
                          >
                            <ProfileWidget
                              user={currentUser}
                              stats={playerStats}
                              loading={statsLoading}
                              onSignOut={handleSignOut}
                              signingOut={isSigningOut}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {authReady && !currentUser && (
                      <button
                        className="auth-button primary"
                        onClick={handleSignIn}
                        disabled={isSigningIn}
                      >
                        {isSigningIn ? 'Signing in…' : 'Sign in'}
                      </button>
                    )}

                    {authReady && authError && (
                      <span className="auth-status-message error">{authError}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </header>
      
      <main className="App-main">
        {!roomCode ? (
          <Lobby 
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            connected={connected}
            user={currentUser}
            authReady={authReady}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            signingIn={isSigningIn}
            signingOut={isSigningOut}
          authError={authError}
          playerStats={playerStats}
          statsLoading={statsLoading}
          leaderboard={leaderboard}
          leaderboardLoading={leaderboardLoading}
          firebaseEnabled={hasFirebaseConfig}
          />
        ) : gameState ? (
          <GameBoard
            gameState={gameState}
            playerIndex={playerIndex}
            onDraw={drawTile}
            onDiscard={discardTile}
            onClaim={claimTile}
            onPass={passClaim}
            onForceDraw={forceDraw}
            onFeedKongTile={feedKongTile}
            onMahjong={declareMahjong}
            actionAvailable={actionAvailable}
            isTestRoom={roomCode === '9999'}
            onResetTestRoom={resetTestRoom}
            message={message}
            user={currentUser}
            playerStats={playerStats}
            statsLoading={statsLoading}
            leaderboard={leaderboard}
            leaderboardLoading={leaderboardLoading}
            firebaseEnabled={hasFirebaseConfig}
          />
        ) : (
          <div className="waiting-room">
            <h2>Waiting for players...</h2>
            <p>Share room code: <strong>{roomCode}</strong></p>
            <div className="spinner"></div>
          </div>
        )}
      </main>
      
      {headerLeaderboardOpen && (
        <div
          className="leaderboard-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
          onClick={() => setHeaderLeaderboardOpen(false)}
        >
          <div
            className="leaderboard-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="leaderboard-dialog__close"
              onClick={() => setHeaderLeaderboardOpen(false)}
              aria-label="Close leaderboard"
            >
              ✕
            </button>
            <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;