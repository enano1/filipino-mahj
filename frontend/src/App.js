import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import EnvDebug from './EnvDebug';

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
  
  const wsRef = useRef(null);

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

  const sendMessage = (data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const createRoom = (playerName) => {
    sendMessage({ type: 'create-room', playerName });
  };

  const joinRoom = (code, playerName) => {
    sendMessage({ type: 'join-room', roomCode: code, playerName });
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

  const forceDraw = () => {
    sendMessage({ type: 'force-draw' });
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
      <header className="App-header">
        <h1>🀄 Filipino Mahjong</h1>
        <div className="status-bar">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
          {roomCode && <span className="room-code">Room: {roomCode}</span>}
        </div>
      </header>
      
      <main className="App-main">
        {!roomCode ? (
          <Lobby 
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            connected={connected}
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
            actionAvailable={actionAvailable}
            isTestRoom={roomCode === '9999'}
            onResetTestRoom={resetTestRoom}
            message={message}
          />
        ) : (
          <div className="waiting-room">
            <h2>Waiting for players...</h2>
            <p>Share room code: <strong>{roomCode}</strong></p>
            <div className="spinner"></div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;