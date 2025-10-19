import React, { useState } from 'react';
import './Lobby.css';

function Lobby({ onCreateRoom, onJoinRoom, connected }) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState(null); // 'create' or 'join'

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (playerName.trim() && joinCode.trim()) {
      onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim());
    }
  };

  if (!mode) {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <h2>Welcome to Filipino Mahjong!</h2>
          <p className="subtitle">Choose an option to get started</p>
          
          <div className="button-group">
            <button 
              className="primary-button"
              onClick={() => setMode('create')}
              disabled={!connected}
            >
              🎮 Create Room
            </button>
            <button 
              className="secondary-button"
              onClick={() => setMode('join')}
              disabled={!connected}
            >
              🚪 Join Room
            </button>
          </div>
          
          {!connected && (
            <p className="warning">Connecting to server...</p>
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
            
            <button type="submit" className="primary-button">
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
            
            <button type="submit" className="primary-button">
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

