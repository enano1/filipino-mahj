const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const {
  TILE_EMOJIS,
  isAutoRedraw,
  generateTileWall,
  dealHands,
  checkWin,
  canPong,
  canKong,
  canChow,
  sortHand,
  isPong,
  isKong,
  isChow
} = require('./gameLogic');

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer((req, res) => {
  // Handle HTTP requests
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Filipino Mahjong WebSocket Server\n');
  }
});

// Attach WebSocket server to HTTP server
const wss = new WebSocket.Server({ 
  server,
  path: '/'
});

// Store active rooms
const rooms = new Map();

// Generate a unique 4-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new game room
function createRoom(roomCode) {
  const wall = generateTileWall();
  return {
    code: roomCode,
    players: [],
    state: 'waiting', // waiting, playing, finished
    wall: wall,
    hands: [[], [], [], []],
    melds: [[], [], [], []],
    discardPile: [],
    currentTurn: 0,
    lastDiscard: null,
    pendingActions: [], // For pong/kong/chow claims
    winner: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    maxIdleTime: 30 * 60 * 1000, // 30 minutes in milliseconds
    playerNames: ['', '', '', ''] // Store player names for rejoin
  };
}

// Broadcast message to all players in a room
function broadcastToRoom(room, message) {
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

// Send private message to specific player
function sendToPlayer(player, message) {
  if (player.ws.readyState === WebSocket.OPEN) {
    player.ws.send(JSON.stringify(message));
  }
}

// Start the game when 4 players are ready
function startGame(room) {
  room.state = 'playing';
  
  // Deal hands
  const { hands, remainingWall } = dealHands(room.wall);
  room.hands = hands;
  room.wall = remainingWall;
  
  // Handle auto-redraws for initial hands
  room.hands.forEach((hand, playerIndex) => {
    let hasAutoRedraw = true;
    while (hasAutoRedraw && room.wall.length > 0) {
      hasAutoRedraw = false;
      for (let i = hand.length - 1; i >= 0; i--) {
        if (isAutoRedraw(hand[i])) {
          hand.splice(i, 1);
          hand.push(room.wall.shift());
          hasAutoRedraw = true;
        }
      }
    }
    room.hands[playerIndex] = sortHand(hand);
  });
  
  room.currentTurn = 0;
  
  // Notify all players
  broadcastGameState(room);
  
  broadcastToRoom(room, {
    type: 'game-started',
    message: 'Game started! Player 1\'s turn.'
  });
}

// Broadcast current game state to all players
function broadcastGameState(room) {
  room.players.forEach((player, index) => {
    sendToPlayer(player, {
      type: 'game-state',
      state: {
        playerIndex: index,
        hand: room.hands[index],
        melds: room.melds,
        discardPile: room.discardPile,
        currentTurn: room.currentTurn,
        lastDiscard: room.lastDiscard,
        wallRemaining: room.wall.length,
        players: room.players.map(p => ({ id: p.id, name: p.name })),
        winner: room.winner
      }
    });
  });
}

// Handle player drawing a tile
function handleDraw(room, playerIndex) {
  if (room.state !== 'playing') return;
  if (room.currentTurn !== playerIndex) return;
  if (room.wall.length === 0) {
    broadcastToRoom(room, {
      type: 'game-over',
      message: 'Game ended - no more tiles in wall!'
    });
    room.state = 'finished';
    return;
  }
  
  room.lastActivity = Date.now(); // Update activity
  const drawnTile = room.wall.shift();
  
  // Check if it's an auto-redraw tile
  if (isAutoRedraw(drawnTile)) {
    // Automatically redraw
    if (room.wall.length > 0) {
      const newTile = room.wall.shift();
      room.hands[playerIndex].push(newTile);
      room.hands[playerIndex] = sortHand(room.hands[playerIndex]);
      
      broadcastToRoom(room, {
        type: 'auto-redraw',
        playerIndex,
        message: `Player ${playerIndex + 1} drew an auto-redraw tile and drew again.`
      });
    }
  } else {
    room.hands[playerIndex].push(drawnTile);
    room.hands[playerIndex] = sortHand(room.hands[playerIndex]);
  }
  
  room.lastDiscard = null;
  broadcastGameState(room);
}

// Handle player discarding a tile
function handleDiscard(room, playerIndex, tile) {
  if (room.state !== 'playing') return;
  if (room.currentTurn !== playerIndex) return;
  
  room.lastActivity = Date.now(); // Update activity
  
  const hand = room.hands[playerIndex];
  const tileIndex = hand.indexOf(tile);
  
  if (tileIndex === -1) return;
  
  // Remove tile from hand
  hand.splice(tileIndex, 1);
  room.hands[playerIndex] = sortHand(hand);
  
  // Add to discard pile
  room.discardPile.push(tile);
  room.lastDiscard = {
    tile,
    playerIndex,
    timestamp: Date.now()
  };
  
  // Check if other players can pong, kong, or chow
  room.pendingActions = [];
  
  // Check for pong/kong from any player (chaos rules)
  room.players.forEach((_, idx) => {
    if (idx !== playerIndex) {
      if (canKong(room.hands[idx], tile)) {
        room.pendingActions.push({ type: 'kong', playerIndex: idx });
      } else if (canPong(room.hands[idx], tile)) {
        room.pendingActions.push({ type: 'pong', playerIndex: idx });
      }
    }
  });
  
  // Check for chow from next player only
  const nextPlayer = (playerIndex + 1) % 4;
  const chowOptions = canChow(room.hands[nextPlayer], tile);
  if (chowOptions.length > 0) {
    room.pendingActions.push({ 
      type: 'chow', 
      playerIndex: nextPlayer,
      options: chowOptions
    });
  }
  
  if (room.pendingActions.length === 0) {
    // No claims, move to next turn
    room.currentTurn = (room.currentTurn + 1) % 4;
  }
  
  broadcastGameState(room);
  
  // Notify about pending actions
  if (room.pendingActions.length > 0) {
    room.pendingActions.forEach(action => {
      sendToPlayer(room.players[action.playerIndex], {
        type: 'action-available',
        action: action.type,
        tile,
        options: action.options
      });
    });
  }
}

// Handle player claiming a tile (pong, kong, chow)
function handleClaim(room, playerIndex, claimType, tiles) {
  if (room.state !== 'playing') return;
  if (!room.lastDiscard) return;
  
  const discardedTile = room.lastDiscard.tile;
  const hand = room.hands[playerIndex];
  
  // Validate claim
  let valid = false;
  const meldTiles = [discardedTile];
  
  if (claimType === 'pong') {
    if (canPong(hand, discardedTile)) {
      // Remove 2 tiles from hand
      for (let i = 0; i < 2; i++) {
        const idx = hand.indexOf(discardedTile);
        if (idx !== -1) {
          hand.splice(idx, 1);
          meldTiles.push(discardedTile);
        }
      }
      valid = meldTiles.length === 3 && isPong(meldTiles);
    }
  } else if (claimType === 'kong') {
    if (canKong(hand, discardedTile)) {
      // Remove 3 tiles from hand
      for (let i = 0; i < 3; i++) {
        const idx = hand.indexOf(discardedTile);
        if (idx !== -1) {
          hand.splice(idx, 1);
          meldTiles.push(discardedTile);
        }
      }
      valid = meldTiles.length === 4 && isKong(meldTiles);
    }
  } else if (claimType === 'chow') {
    // tiles parameter contains the complete chow
    if (tiles && tiles.length === 3) {
      // Remove the other 2 tiles from hand (not the discarded one)
      const otherTiles = tiles.filter(t => t !== discardedTile);
      let canForm = true;
      otherTiles.forEach(tile => {
        const idx = hand.indexOf(tile);
        if (idx !== -1) {
          hand.splice(idx, 1);
        } else {
          canForm = false;
        }
      });
      if (canForm) {
        valid = isChow(tiles);
        meldTiles.length = 0;
        meldTiles.push(...tiles);
      }
    }
  }
  
  if (valid) {
    // Add meld
    room.melds[playerIndex].push({
      type: claimType,
      tiles: meldTiles
    });
    
    room.hands[playerIndex] = sortHand(hand);
    
    // Remove from discard pile
    room.discardPile.pop();
    room.lastDiscard = null;
    room.pendingActions = [];
    
    // Check for win
    if (checkWin(room.hands[playerIndex], room.melds[playerIndex])) {
      room.winner = playerIndex;
      room.state = 'finished';
      broadcastToRoom(room, {
        type: 'game-won',
        winner: playerIndex,
        message: `Player ${playerIndex + 1} wins!`
      });
    } else {
      // Set turn to claiming player (they must discard)
      room.currentTurn = playerIndex;
    }
    
    broadcastGameState(room);
  }
}

// Handle player passing on a claim
function handlePass(room, playerIndex) {
  if (room.state !== 'playing') return;
  
  // Remove this player's pending actions
  room.pendingActions = room.pendingActions.filter(a => a.playerIndex !== playerIndex);
  
  // If no more pending actions, move to next turn
  if (room.pendingActions.length === 0 && room.lastDiscard) {
    room.currentTurn = (room.lastDiscard.playerIndex + 1) % 4;
    broadcastGameState(room);
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  const clientId = uuidv4();
  let currentRoom = null;
  let playerIndex = -1;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'create-room':
          let roomCode = generateRoomCode();
          while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
          }
          
          const newRoom = createRoom(roomCode);
          rooms.set(roomCode, newRoom);
          
          const player = {
            id: clientId,
            name: data.playerName || `Player 1`,
            ws
          };
          
          newRoom.players.push(player);
          currentRoom = newRoom;
          playerIndex = 0;
          
          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode,
            playerIndex: 0
          }));
          break;
          
        case 'join-room':
          const room = rooms.get(data.roomCode);
          
          if (!room) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Room not found'
            }));
            break;
          }
          
          // Check if room has expired (30 minutes)
          const now = Date.now();
          if (now - room.lastActivity > room.maxIdleTime) {
            rooms.delete(room.code);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Room has expired (30 minutes timeout)'
            }));
            break;
          }
          
          // Check if this is a rejoin attempt
          let playerIndex = -1;
          let isRejoin = false;
          
          if (data.playerName && room.playerNames.includes(data.playerName)) {
            // Player is rejoining
            playerIndex = room.playerNames.indexOf(data.playerName);
            isRejoin = true;
            
            // Remove old WebSocket connection if exists
            room.players = room.players.filter(p => p.id !== clientId);
          } else {
            // New player joining
            if (room.players.length >= 4) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Room is full'
              }));
              break;
            }
            
            if (room.state !== 'waiting' && !isRejoin) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Game already in progress. Use same name to rejoin.'
              }));
              break;
            }
            
            playerIndex = room.players.length;
          }
          
          const joiningPlayer = {
            id: clientId,
            name: data.playerName || `Player ${playerIndex + 1}`,
            ws
          };
          
          // Update player slot
          room.players[playerIndex] = joiningPlayer;
          room.playerNames[playerIndex] = joiningPlayer.name;
          room.lastActivity = now;
          
          currentRoom = room;
          
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomCode: room.code,
            playerIndex,
            isRejoin,
            gameState: room.state !== 'waiting' ? {
              playerIndex,
              hand: room.hands[playerIndex] || [],
              melds: room.melds[playerIndex] || [],
              discardPile: room.discardPile,
              currentTurn: room.currentTurn,
              lastDiscard: room.lastDiscard,
              wallRemaining: room.wall.length,
              players: room.players.map(p => ({ id: p.id, name: p.name })),
              winner: room.winner
            } : null
          }));
          
          broadcastToRoom(room, {
            type: 'player-joined',
            playerCount: room.players.filter(p => p).length,
            players: room.players.map(p => p ? { id: p.id, name: p.name } : null),
            isRejoin,
            rejoiningPlayer: isRejoin ? joiningPlayer.name : null
          });
          
          // Start game if 4 players and in waiting state
          if (room.players.filter(p => p).length === 4 && room.state === 'waiting') {
            setTimeout(() => startGame(room), 1000);
          }
          break;
          
        case 'draw':
          if (currentRoom) {
            handleDraw(currentRoom, playerIndex);
          }
          break;
          
        case 'discard':
          if (currentRoom) {
            handleDiscard(currentRoom, playerIndex, data.tile);
          }
          break;
          
        case 'claim':
          if (currentRoom) {
            handleClaim(currentRoom, playerIndex, data.claimType, data.tiles);
          }
          break;
          
        case 'pass':
          if (currentRoom) {
            handlePass(currentRoom, playerIndex);
          }
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    
    if (currentRoom) {
      // Remove player from room
      currentRoom.players = currentRoom.players.filter(p => p.id !== clientId);
      
      if (currentRoom.players.length === 0) {
        // Delete empty room
        rooms.delete(currentRoom.code);
      } else {
        // Notify remaining players
        broadcastToRoom(currentRoom, {
          type: 'player-left',
          playerCount: currentRoom.players.length,
          message: 'A player has disconnected'
        });
      }
    }
  });
});

// Clean up expired rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.lastActivity > room.maxIdleTime) {
      console.log(`🗑️ Cleaning up expired room: ${roomCode}`);
      rooms.delete(roomCode);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`🀄 Filipino Mahjong server running on port ${PORT}`);
  console.log(`   HTTP: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Room timeout: 30 minutes`);
});

