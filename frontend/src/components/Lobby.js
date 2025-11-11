import React, { useState, useEffect } from 'react';
import './Lobby.css';

function Lobby({
  onCreateRoom,
  onJoinRoom,
  connected,
  user,
  authReady,
  onSignIn,
  onSignOut,
  signingIn,
  signingOut,
  authError
}) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState(null); // 'create' or 'join'

  useEffect(() => {
    if (user?.displayName && !playerName) {
      setPlayerName(user.displayName);
    }
  }, [user, playerName]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!user) {
      onSignIn?.();
      return;
    }

    if (playerName.trim()) {
      await onCreateRoom(playerName.trim());
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!user) {
      onSignIn?.();
      return;
    }

    if (playerName.trim() && joinCode.trim()) {
      await onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim());
    }
  };

  const renderAuthSection = () => (
    <div className="auth-card">
      <h2>Account</h2>
      {!authReady && <p className="auth-status-text">Loading authentication…</p>}

      {authReady && !user && (
        <>
          <p className="auth-status-text">
            Sign in to create rooms, invite friends, and track your wins.
          </p>
          <button
            className="auth-primary-button"
            onClick={onSignIn}
            disabled={signingIn}
          >
            {signingIn ? 'Signing in…' : 'Continue with Google'}
          </button>
          {authError && <p className="auth-error">{authError}</p>}
        </>
      )}

      {authReady && user && (
        <div className="auth-user-info">
          {user.photoURL && (
            <img
              className="auth-user-avatar"
              src={user.photoURL}
              alt={user.displayName || user.email || 'Player avatar'}
            />
          )}
          <div>
            <p className="auth-user-name">{user.displayName || user.email}</p>
            <button
              className="auth-secondary-button"
              onClick={onSignOut}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!authReady) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <p className="auth-status-text">Loading authentication…</p>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          {renderAuthSection()}

          <h2>Welcome to Filipino Mahjong!</h2>
          <p className="subtitle">Choose an option to get started</p>
          
          <div className="button-group">
            <button 
              className="primary-button"
              onClick={() => setMode('create')}
              disabled={!connected || !user}
            >
              🎮 Create Room
            </button>
            <button 
              className="secondary-button"
              onClick={() => setMode('join')}
              disabled={!connected || !user}
            >
              🚪 Join Room
            </button>
          </div>
          
          {!connected && (
            <p className="warning">Connecting to server...</p>
          )}

          {user && (
            <p className="helper-text">
              Signed in as <strong>{user.displayName || user.email}</strong>
            </p>
          )}

          {!user && (
            <p className="helper-text warning">
              Sign in above to enable multiplayer features.
            </p>
          )}
          
          {authError && (
            <p className="auth-error">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <button className="back-button" onClick={() => setMode(null)}>
            ← Back
          </button>
          
          {renderAuthSection()}

          <h2>Create a Room</h2>
          <p className="subtitle">Start a new game and invite friends</p>
          
          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label htmlFor="playerName">Your Name</label>
              <input
                id="playerName"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                required
              />
            </div>
            
            <button type="submit" className="primary-button" disabled={!user || !connected}>
              Create Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <button className="back-button" onClick={() => setMode(null)}>
            ← Back
          </button>
          
          {renderAuthSection()}

          <h2>Join a Room</h2>
          <p className="subtitle">Enter the room code to join</p>
          
          <form onSubmit={handleJoinRoom}>
            <div className="form-group">
              <label htmlFor="joinCode">Room Code</label>
              <input
                id="joinCode"
                type="text"
                placeholder="e.g., ABC1"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="playerNameJoin">Your Name</label>
              <input
                id="playerNameJoin"
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                required
              />
            </div>
            
            <button type="submit" className="primary-button" disabled={!user || !connected}>
              Join Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

export default Lobby;

