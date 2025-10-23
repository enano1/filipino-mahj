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

// AI Player class for test room
class AIPlayer {
  constructor(playerIndex, room) {
    this.playerIndex = playerIndex;
    this.room = room;
    this.name = `AI Player ${playerIndex + 1}`;
    this.isAI = true;
  }

  // AI makes a move after a short delay
  makeMove() {
    setTimeout(() => {
      if (this.room.state !== 'playing' || this.room.currentTurn !== this.playerIndex) {
        return;
      }

      const hand = this.room.hands[this.playerIndex];
      
      // Simple AI: if we have 14 tiles, discard one randomly
      if (hand.length === 14) {
        const randomTile = hand[Math.floor(Math.random() * hand.length)];
        
        // Use handleDiscard to ensure proper turn management
        handleDiscard(this.room, this.playerIndex, randomTile);
        
        broadcastToRoom(this.room, {
          type: 'ai-move',
          message: `${this.name} discarded ${randomTile}`
        });
      }
      // If we have 13 tiles, draw one
      else if (hand.length === 13) {
        handleDraw(this.room, this.playerIndex);
      }
    }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
  }

  // AI responds to claims
  respondToClaim(actionType, tile) {
    setTimeout(() => {
      // Simple AI: sometimes claim, sometimes pass
      const shouldClaim = Math.random() < 0.3; // 30% chance to claim
      
      if (shouldClaim) {
        // For now, AI just passes on claims
        handlePass(this.room, this.playerIndex);
      } else {
        handlePass(this.room, this.playerIndex);
      }
    }, 500 + Math.random() * 1000); // Random delay 0.5-1.5 seconds
  }
}

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
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

// Send private message to specific player
function sendToPlayer(player, message) {
  if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
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
    message: room.isTestRoom ? 'Test game started! You vs 3 AI players.' : 'Game started! Player 1\'s turn.'
  });
}

// Detect melds in a hand (without removing tiles)
function detectMeldsInHand(hand) {
  const detectedMelds = [];
  const tileCounts = {};
  
  // Count tiles
  hand.forEach(tile => {
    tileCounts[tile] = (tileCounts[tile] || 0) + 1;
  });
  
  // Detect pongs and kongs
  Object.entries(tileCounts).forEach(([tile, count]) => {
    if (count >= 4) {
      detectedMelds.push({ type: 'kong', tiles: [tile, tile, tile, tile] });
    } else if (count >= 3) {
      detectedMelds.push({ type: 'pong', tiles: [tile, tile, tile] });
    }
  });
  
  // Detect chows (sequences)
  const suits = ['bamboo', 'character', 'dot'];
  suits.forEach(suit => {
    const suitTiles = hand.filter(t => t.startsWith(suit)).sort();
    const numbers = suitTiles.map(t => parseInt(t.split('-')[1]));
    
    for (let i = 0; i < numbers.length - 2; i++) {
      if (numbers[i] + 1 === numbers[i + 1] && numbers[i] + 2 === numbers[i + 2]) {
        detectedMelds.push({
          type: 'chow',
          tiles: [
            `${suit}-${numbers[i]}`,
            `${suit}-${numbers[i + 1]}`,
            `${suit}-${numbers[i + 2]}`
          ]
        });
      }
    }
  });
  
  return detectedMelds;
}

// Broadcast current game state to all players
function broadcastGameState(room) {
  room.players.forEach((player, index) => {
    if (player && player.ws) {
      const detectedMelds = detectMeldsInHand(room.hands[index]);
      
      sendToPlayer(player, {
        type: 'game-state',
        state: {
          playerIndex: index,
          hand: room.hands[index],
          melds: room.melds,
          detectedMelds: detectedMelds,
          discardPile: room.discardPile,
          currentTurn: room.currentTurn,
          lastDiscard: room.lastDiscard,
          wallRemaining: room.wall.length,
          players: room.players.map(p => p ? ({ id: p.id, name: p.name, isAI: p.isAI }) : null),
          winner: room.winner,
          isTestRoom: room.isTestRoom,
          drawnTile: room.drawnTiles ? room.drawnTiles[index] : null
        }
      });
    }
  });
  
  // Trigger AI moves for test room
  if (room.isTestRoom && room.state === 'playing') {
    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer && currentPlayer.isAI && room.aiPlayers) {
      const aiPlayer = room.aiPlayers.find(ai => ai.playerIndex === room.currentTurn);
      if (aiPlayer) {
        aiPlayer.makeMove();
      }
    }
  }
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
  let drawnTile = room.wall.shift();
  let finalDrawnTile = drawnTile;
  let redrawCount = 0;
  
  // Keep redrawing if it's an auto-redraw tile (honors/flowers)
  while (isAutoRedraw(drawnTile) && room.wall.length > 0) {
    redrawCount++;
    drawnTile = room.wall.shift();
    finalDrawnTile = drawnTile;
    
    broadcastToRoom(room, {
      type: 'auto-redraw',
      playerIndex,
      message: `Player ${playerIndex + 1} drew an auto-redraw tile (${redrawCount === 1 ? 'dragon/wind/flower' : 'again'}) and drew another.`
    });
  }
  
  // Add the final tile to hand
  room.hands[playerIndex].push(finalDrawnTile);
  room.hands[playerIndex] = sortHand(room.hands[playerIndex]);
  
  // Track the drawn tile for highlighting
  if (!room.drawnTiles) {
    room.drawnTiles = [null, null, null, null];
  }
  room.drawnTiles[playerIndex] = finalDrawnTile;
  
  // Clear last discard after drawing (new turn cycle)
  // If there were pending actions, they're now expired
  if (room.pendingActions && room.pendingActions.length > 0) {
    room.pendingActions.forEach(action => {
      sendToPlayer(room.players[action.playerIndex], {
        type: 'action-expired',
        message: 'Claim opportunity expired'
      });
    });
  }
  
  room.lastDiscard = null;
  room.pendingActions = [];
  
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
  
  // Clear the drawn tile highlight after discard
  if (room.drawnTiles) {
    room.drawnTiles[playerIndex] = null;
  }
  
  // Add to discard pile
  room.discardPile.push(tile);
  room.lastDiscard = {
    tile,
    playerIndex,
    timestamp: Date.now()
  };
  
  // Set claim window - 10 seconds for claims
  room.claimWindowEnd = Date.now() + 10000;
  
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
  
  // Check for chow from next player only (the one who's about to draw)
  // In turn order: if player X discards, only player X+1 can chow
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
    // No claims possible, move to next turn immediately
    room.currentTurn = (room.currentTurn + 1) % 4;
  } else {
    // Set 5-second timer for claim window
    if (room.claimTimer) {
      clearTimeout(room.claimTimer);
    }
    
    room.claimTimer = setTimeout(() => {
      // If no one has claimed after 10 seconds, advance turn
      if (room.pendingActions.length > 0 && room.lastDiscard) {
        room.pendingActions = [];
        room.lastDiscard = null;
        room.currentTurn = (playerIndex + 1) % 4;
        
        broadcastToRoom(room, {
          type: 'claim-window-expired',
          message: 'No one claimed - moving to next turn'
        });
        
        broadcastGameState(room);
      }
    }, 10000);
  }
  
  broadcastGameState(room);
  
  // Notify about pending actions
  if (room.pendingActions.length > 0) {
    room.pendingActions.forEach(action => {
      const player = room.players[action.playerIndex];
      
      // Send to human players
      sendToPlayer(player, {
        type: 'action-available',
        action: action.type,
        tile,
        options: action.options
      });
      
      // Trigger AI response if it's an AI player
      if (player && player.isAI && room.aiPlayers) {
        const aiPlayer = room.aiPlayers.find(ai => ai.playerIndex === action.playerIndex);
        if (aiPlayer) {
          aiPlayer.respondToClaim(action.type, tile);
        }
      }
    });
  }
}

// Handle player claiming a tile (pong, kong, chow)
function handleClaim(room, playerIndex, claimType, tiles) {
  if (room.state !== 'playing') return;
  if (!room.lastDiscard) return;
  
  // Check if this player has a pending action for this claim
  const hasPendingAction = room.pendingActions.some(
    action => action.playerIndex === playerIndex && action.type === claimType
  );
  
  if (!hasPendingAction) {
    console.log(`Player ${playerIndex} tried to claim ${claimType} but has no pending action`);
    return;
  }
  
  const discardedTile = room.lastDiscard.tile;
  const hand = room.hands[playerIndex];
  
  // Validate claim
  let valid = false;
  const meldTiles = [discardedTile]; // Start with the discarded tile
  
  if (claimType === 'pong') {
    if (canPong(hand, discardedTile)) {
      // Remove 2 tiles from hand
      for (let i = 0; i < 2; i++) {
        const idx = hand.indexOf(discardedTile);
        if (idx !== -1) {
          hand.splice(idx, 1);
          meldTiles.push(discardedTile); // Add each removed tile to meld
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
          meldTiles.push(discardedTile); // Add each removed tile to meld
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
        console.log(`Chow: Removed 2 tiles from hand, added 1 discarded tile. Hand now has ${hand.length} tiles`);
      }
    }
  }
  
  if (valid) {
    // Clear claim timer
    if (room.claimTimer) {
      clearTimeout(room.claimTimer);
      room.claimTimer = null;
    }
    
    // Add meld
    room.melds[playerIndex].push({
      type: claimType,
      tiles: meldTiles
    });
    
    // After claiming, handle tile count correctly
    // Pong: add 1 discarded, remove 3 from hand = 11 tiles (no drawing)
    // Chow: add 1 discarded, remove 3 from hand = 11 tiles (no drawing)  
    // Kong: add 1 discarded, remove 4 from hand = 10 tiles, draw 1 = 11 tiles
    console.log(`After ${claimType}: Player ${playerIndex} has ${hand.length} tiles before drawing`);
    
    if (claimType === 'kong') {
      // Kong: draw 1 tile
      let drawnTile = room.wall.shift();
      
      // Auto-redraw if it's an honor/flower tile
      while (isAutoRedraw(drawnTile) && room.wall.length > 0) {
        console.log(`Auto-redrawing ${drawnTile} after kong`);
        drawnTile = room.wall.shift();
      }
      
      hand.push(drawnTile);
      console.log(`After kong draw: Player ${playerIndex} has ${hand.length} tiles`);
    }
    // Pong and Chow: no drawing needed
    
    console.log(`Final tile count after ${claimType}: Player ${playerIndex} has ${hand.length} tiles`);
    room.hands[playerIndex] = sortHand(hand);
    
    // Remove from discard pile
    room.discardPile.pop();
    room.lastDiscard = null;
    room.pendingActions = [];
    
    // Clear drawn tile highlight after claiming
    if (room.drawnTiles) {
      room.drawnTiles[playerIndex] = null;
    }
    
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
      // Set turn to claiming player (they must discard now with 14 tiles)
      room.currentTurn = playerIndex;
      
      // Notify the claiming player
      broadcastToRoom(room, {
        type: 'claim-success',
        playerIndex,
        claimType,
        message: `Player ${playerIndex + 1} claimed ${claimType}! Select a tile to discard.`
      });
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
    // Clear claim timer
    if (room.claimTimer) {
      clearTimeout(room.claimTimer);
      room.claimTimer = null;
    }
    
    room.currentTurn = (room.lastDiscard.playerIndex + 1) % 4;
    room.lastDiscard = null;
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
          // Special test room 9999
          if (data.roomCode === '9999') {
            let testRoom = rooms.get('9999');
            
            if (!testRoom) {
              // Create test room with 3 AI players
              testRoom = createRoom('9999');
              testRoom.isTestRoom = true;
              testRoom.aiPlayers = [];
              
              // Create 3 AI players
              for (let i = 1; i < 4; i++) {
                const aiPlayer = new AIPlayer(i, testRoom);
                testRoom.aiPlayers.push(aiPlayer);
                testRoom.players[i] = {
                  id: `ai-${i}`,
                  name: aiPlayer.name,
                  ws: null,
                  isAI: true
                };
                testRoom.playerNames[i] = aiPlayer.name;
              }
              
              rooms.set('9999', testRoom);
              console.log('🤖 Created test room 9999 with 3 AI players');
            }
            
            // Join as player 0 (human player)
            const humanPlayer = {
              id: clientId,
              name: data.playerName || 'Test Player',
              ws,
              isAI: false
            };
            
            testRoom.players[0] = humanPlayer;
            testRoom.playerNames[0] = humanPlayer.name;
            testRoom.lastActivity = Date.now();
            
            currentRoom = testRoom;
            playerIndex = 0;
            
            ws.send(JSON.stringify({
              type: 'room-joined',
              roomCode: '9999',
              playerIndex: 0,
              isTestRoom: true,
              gameState: testRoom.state !== 'waiting' ? {
                playerIndex: 0,
                hand: testRoom.hands[0] || [],
                melds: testRoom.melds || [[], [], [], []],
                discardPile: testRoom.discardPile || [],
                currentTurn: testRoom.currentTurn,
                lastDiscard: testRoom.lastDiscard,
                wallRemaining: testRoom.wall.length,
                players: testRoom.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
                winner: testRoom.winner
              } : null
            }));
            
            broadcastToRoom(testRoom, {
              type: 'player-joined',
              playerCount: 4,
              players: testRoom.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
              isTestRoom: true
            });
            
            // Start game immediately in test room (always 4 players)
            if (testRoom.state === 'waiting') {
              setTimeout(() => startGame(testRoom), 1000);
            }
            
            break;
          }
          
          // Regular room joining logic
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
          let rejoinPlayerIndex = -1;
          let isRejoin = false;
          
          if (data.playerName && room.playerNames.includes(data.playerName)) {
            // Player is rejoining
            rejoinPlayerIndex = room.playerNames.indexOf(data.playerName);
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
            
            rejoinPlayerIndex = room.players.length;
          }
          
          const joiningPlayer = {
            id: clientId,
            name: data.playerName || `Player ${rejoinPlayerIndex + 1}`,
            ws
          };
          
          // Update player slot
          room.players[rejoinPlayerIndex] = joiningPlayer;
          room.playerNames[rejoinPlayerIndex] = joiningPlayer.name;
          room.lastActivity = now;
          
          currentRoom = room;
          playerIndex = rejoinPlayerIndex; // Set the outer playerIndex
          
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomCode: room.code,
            playerIndex: rejoinPlayerIndex,
            isRejoin,
            gameState: room.state !== 'waiting' ? {
              playerIndex: rejoinPlayerIndex,
              hand: room.hands[rejoinPlayerIndex] || [],
              melds: room.melds || [[], [], [], []],
              discardPile: room.discardPile || [],
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
          
        case 'reset-test-room':
          // Only allow reset for test room 9999
          if (currentRoom && currentRoom.code === '9999' && currentRoom.isTestRoom) {
            console.log('🔄 Resetting test room 9999');
            
            // Reset players array - keep human player at index 0, recreate AI players
            const humanPlayer = currentRoom.players[0];
            currentRoom.players = [humanPlayer, null, null, null];
            currentRoom.playerNames = [humanPlayer.name, '', '', ''];
            
            // Recreate AI players
            currentRoom.aiPlayers = [];
            for (let i = 1; i < 4; i++) {
              const aiPlayer = new AIPlayer(i, currentRoom);
              currentRoom.aiPlayers.push(aiPlayer);
              currentRoom.players[i] = {
                id: `ai-${i}`,
                name: aiPlayer.name,
                ws: null,
                isAI: true
              };
              currentRoom.playerNames[i] = aiPlayer.name;
            }
            
            // Reset room state
            const wall = generateTileWall();
            const { hands, remainingWall } = dealHands(wall);
            
            currentRoom.wall = remainingWall;
            currentRoom.hands = hands;
            currentRoom.melds = [[], [], [], []];
            currentRoom.discardPile = [];
            currentRoom.currentTurn = 0;
            currentRoom.lastDiscard = null;
            currentRoom.pendingActions = [];
            currentRoom.drawnTiles = [null, null, null, null];
            currentRoom.winner = null;
            currentRoom.state = 'playing';
            currentRoom.lastActivity = Date.now();
            
            // Clear claim timer
            if (currentRoom.claimTimer) {
              clearTimeout(currentRoom.claimTimer);
              currentRoom.claimTimer = null;
            }
            
            // Handle auto-redraws for initial hands
            currentRoom.hands.forEach((hand, idx) => {
              let hasAutoRedraw = true;
              while (hasAutoRedraw && currentRoom.wall.length > 0) {
                hasAutoRedraw = false;
                for (let i = hand.length - 1; i >= 0; i--) {
                  if (isAutoRedraw(hand[i])) {
                    hand.splice(i, 1);
                    hand.push(currentRoom.wall.shift());
                    hasAutoRedraw = true;
                  }
                }
              }
              currentRoom.hands[idx] = sortHand(hand);
            });
            
            broadcastToRoom(currentRoom, {
              type: 'game-reset',
              message: '🔄 Test room reset! New game starting...'
            });
            
            broadcastGameState(currentRoom);
            
            console.log('✅ Test room reset complete - 1 human + 3 AI players');
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

