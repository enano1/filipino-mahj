import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

// WebSocket URL - automatically uses production URL when deployed
const WS_URL = process.env.REACT_APP_WS_URL || 
  (window.location.protocol === 'https:' 
    ? `wss://${window.location.hostname}:3001`
    : 'ws://localhost:3001');

function App() {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(-1);
  const [gameState, setGameState] = useState(null);
  const [message, setMessage] = useState('');
  const [actionAvailable, setActionAvailable] = useState(null);
  
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
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
          setMessage(`Joined room: ${data.roomCode}`);
          break;
          
        case 'player-joined':
          setMessage(`${data.playerCount}/4 players in room`);
          break;
          
        case 'game-started':
          setMessage(data.message);
          break;
          
        case 'game-state':
          setGameState(data.state);
          break;
          
        case 'action-available':
          setActionAvailable({
            type: data.action,
            tile: data.tile,
            options: data.options
          });
          break;
          
        case 'auto-redraw':
          setMessage(data.message);
          setTimeout(() => setMessage(''), 3000);
          break;
          
        case 'game-won':
          setMessage(data.message);
          break;
          
        case 'game-over':
          setMessage(data.message);
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
    setWs(websocket);
  };

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
      
      {message && (
        <div className="message-banner">
          {message}
        </div>
      )}
      
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
            actionAvailable={actionAvailable}
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

