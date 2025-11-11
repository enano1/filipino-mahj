require('dotenv').config();
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
const {
  db: firebaseDb,
  fieldValue: FirebaseFieldValue,
  isFirebaseEnabled,
  verifyIdToken
} = require('./firebaseAdmin');

const PORT = process.env.PORT || 3001;
const FIREBASE_ACTIVE = isFirebaseEnabled();

async function ensurePlayerProfile(uid, profile = {}) {
  if (!FIREBASE_ACTIVE || !firebaseDb || !FirebaseFieldValue || !uid) {
    return null;
  }

  try {
    const playerRef = firebaseDb.collection('players').doc(uid);
    const snapshot = await playerRef.get();
    const timestamp = FirebaseFieldValue.serverTimestamp();

    const baseData = {
      displayName: profile.displayName || null,
      email: profile.email || null,
      photoURL: profile.photoURL || null,
      updatedAt: timestamp
    };

    if (!snapshot.exists) {
      await playerRef.set(
        {
          ...baseData,
          displayName: baseData.displayName || 'Player',
          totalGames: 0,
          wins: 0,
          losses: 0,
          createdAt: timestamp
        },
        { merge: true }
      );
    } else {
      await playerRef.set(baseData, { merge: true });
    }

    return playerRef;
  } catch (error) {
    console.error(`[Firebase] Failed to ensure player profile for uid=${uid}`, error);
    return null;
  }
}

async function recordGameResult(room, winningPlayerIndex) {
  if (!FIREBASE_ACTIVE || !firebaseDb || !FirebaseFieldValue) {
    return;
  }

  try {
    const batch = firebaseDb.batch();
    const timestamp = FirebaseFieldValue.serverTimestamp();
    let hasWrites = false;

    room.players.forEach((player, index) => {
      if (!player || !player.uid) {
        return;
      }

      const playerRef = firebaseDb.collection('players').doc(player.uid);
      const statsUpdate = {
        totalGames: FirebaseFieldValue.increment(1),
        updatedAt: timestamp,
        lastGameAt: timestamp,
        lastRoom: room.code || null,
        lastResult: index === winningPlayerIndex ? 'win' : 'loss'
      };

      if (index === winningPlayerIndex) {
        statsUpdate.wins = FirebaseFieldValue.increment(1);
      } else {
        statsUpdate.losses = FirebaseFieldValue.increment(1);
      }

      batch.set(playerRef, statsUpdate, { merge: true });
      hasWrites = true;
    });

    if (hasWrites) {
      await batch.commit();
      console.log('[Firebase] Recorded game result in Firestore');
    }
  } catch (error) {
    console.error('[Firebase] Failed to record game result', error);
  }
}

function normalizeDisplayName(name) {
  if (!name) return null;
  const trimmed = `${name}`.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40); // limit to 40 characters
}

function deriveDisplayName(requestedName, firebaseUser, fallbackNumber = 1) {
  const normalizedRequested = normalizeDisplayName(requestedName);
  if (normalizedRequested) {
    return normalizedRequested;
  }

  if (firebaseUser) {
    const claimsName =
      firebaseUser.displayName ||
      firebaseUser.name ||
      firebaseUser.email ||
      firebaseUser.uid;
    const normalizedClaims = normalizeDisplayName(claimsName);
    if (normalizedClaims) {
      return normalizedClaims;
    }
  }

  return `Player ${fallbackNumber}`;
}

function summarizePlayer(room, playerIndex) {
  const hand = room.hands[playerIndex] || [];
  const melds = room.melds[playerIndex] || [];
  const meldTileCount = melds.reduce(
    (sum, meld) => sum + (meld?.tiles?.length || 0),
    0
  );
  return {
    hand,
    melds,
    handCount: hand.length,
    meldTileCount,
    totalTiles: hand.length + meldTileCount
  };
}

function playerCanDraw(room, playerIndex) {
  if (room.currentTurn !== playerIndex) return false;
  const summary = summarizePlayer(room, playerIndex);
  return summary.totalTiles === 13 && !room.lastDiscard;
}

function playerCanDiscard(room, playerIndex) {
  if (room.currentTurn !== playerIndex) return false;
  const summary = summarizePlayer(room, playerIndex);
  return summary.totalTiles === 14;
}

function shouldEnableForceDraw(room, playerIndex) {
  if (room.currentTurn !== playerIndex) return false;
  return !playerCanDraw(room, playerIndex) && !playerCanDiscard(room, playerIndex);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

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
    players: [null, null, null, null],
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
    playerNames: ['', '', '', ''], // Store player names for rejoin
    playerIds: [null, null, null, null] // Track Firebase UIDs for rejoin
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
          players: room.players.map(p => p ? ({ id: p.id, uid: p.uid || null, name: p.name, isAI: p.isAI }) : null),
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
    if (room.discardPile.length === 0) {
      broadcastToRoom(room, {
        type: 'game-over',
        message: 'Game ended - no more tiles available!'
      });
      room.state = 'finished';
      return;
    }

    const reshuffledTiles = shuffleArray([...room.discardPile]);
    room.discardPile = [];
    room.wall = reshuffledTiles;
    room.lastDiscard = null;

    console.log(
      `[RESHUFFLE] Wall empty - reshuffled ${reshuffledTiles.length} tiles from discard pile back into the wall`
    );

    broadcastToRoom(room, {
      type: 'wall-reshuffled',
      message: `Wall was empty - reshuffled ${reshuffledTiles.length} tiles from discards`
    });
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
  
  const drawSummary = summarizePlayer(room, playerIndex);
  const meldSummaryString = drawSummary.melds.length > 0
    ? drawSummary.melds.map(m => `${m.type}:${m.tiles.join(' ')}`).join(' | ')
    : 'none';
  console.log(
    `[DRAW] P${playerIndex + 1} drew ${finalDrawnTile} | hand=${drawSummary.handCount} meldTiles=${drawSummary.meldTileCount} total=${drawSummary.totalTiles}`
  );
  console.log(`[DRAW]    Hand: ${drawSummary.hand.join(', ') || 'empty'}`);
  console.log(`[DRAW]    Melds: ${meldSummaryString}`);

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
  
  const discardSummary = summarizePlayer(room, playerIndex);
  const discardMeldSummary = discardSummary.melds.length > 0
    ? discardSummary.melds.map(m => `${m.type}:${m.tiles.join(' ')}`).join(' | ')
    : 'none';
  console.log(
    `[DISCARD] P${playerIndex + 1} discarded ${tile} | hand=${discardSummary.handCount} meldTiles=${discardSummary.meldTileCount} total=${discardSummary.totalTiles}`
  );
  console.log(`[DISCARD]    Hand: ${discardSummary.hand.join(', ') || 'empty'}`);
  console.log(`[DISCARD]    Melds: ${discardMeldSummary}`);
  console.log(`[TURN] Checking claim opportunities after discard by P${playerIndex + 1}`);
  
  // Determine next player in turn order
  const nextPlayer = (playerIndex + 1) % 4;
  room.currentTurn = nextPlayer;
  console.log(`[TURN] Next player set to P${nextPlayer + 1} after discard by P${playerIndex + 1}`);
  
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
  const chowOptions = canChow(room.hands[nextPlayer], tile);
  if (chowOptions.length > 0) {
    room.pendingActions.push({ 
      type: 'chow', 
      playerIndex: nextPlayer,
      options: chowOptions
    });
    console.log(`[TURN] Chow options available for P${nextPlayer + 1}: ${chowOptions.map(opt => opt.join('-')).join(' / ')}`);
  }
  
  if (room.pendingActions.length === 0) {
    // No claims possible, keep move with next player immediately
    console.log(`[TURN] No claims. Passing turn to P${room.currentTurn + 1}`);
    room.lastDiscard = null;
    room.claimWindowEnd = null;
  } else {
    // Set 5-second timer for claim window
    if (room.claimTimer) {
      clearTimeout(room.claimTimer);
    }
    
    room.claimTimer = setTimeout(() => {
      // If no one has claimed after 10 seconds, advance turn
      if (room.pendingActions.length > 0 && room.lastDiscard) {
        room.pendingActions = [];
        const originalDiscarder = room.lastDiscard.playerIndex;
        const nextPlayerIndex = (originalDiscarder + 1) % 4;
        room.lastDiscard = null;
        room.currentTurn = nextPlayerIndex;
        console.log(`[TURN] Claim window expired. Moving to player P${nextPlayerIndex + 1}`);
        
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
  
  let lastDrawnDuringClaim = null;

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
    
    if (claimType === 'kong') {
      // Kong: draw 1 tile
      if (room.wall.length === 0 && room.discardPile.length > 0) {
        const reshuffledTiles = shuffleArray([...room.discardPile]);
        room.discardPile = [];
        room.wall = reshuffledTiles;
        room.lastDiscard = null;
        console.log(
          `[RESHUFFLE] Wall empty - reshuffled ${reshuffledTiles.length} tiles from discard pile back into the wall (kong replacement)`
        );
        broadcastToRoom(room, {
          type: 'wall-reshuffled',
          message: `Wall was empty - reshuffled ${reshuffledTiles.length} tiles from discards`
        });
      }

      if (room.wall.length > 0) {
        let drawnTile = room.wall.shift();
        
        // Auto-redraw if it's an honor/flower tile
        while (isAutoRedraw(drawnTile) && room.wall.length > 0) {
          drawnTile = room.wall.shift();
        }
        
        hand.push(drawnTile);
        console.log(`[CLAIM] P${playerIndex + 1} drew replacement tile ${drawnTile} for kong`);
        lastDrawnDuringClaim = drawnTile;
      }
    }
    room.hands[playerIndex] = sortHand(hand);

    let claimSummary = summarizePlayer(room, playerIndex);

    while (claimSummary.totalTiles < 14) {
      if (room.wall.length === 0) {
        if (room.discardPile.length === 0) {
          console.log(`[CLAIM_TOPUP] P${playerIndex + 1} cannot draw additional tiles - wall and discard pile are empty.`);
          break;
        }
        const reshuffledTiles = shuffleArray([...room.discardPile]);
        room.discardPile = [];
        room.wall = reshuffledTiles;
        room.lastDiscard = null;
        console.log(
          `[RESHUFFLE] Wall empty - reshuffled ${reshuffledTiles.length} tiles from discard pile back into the wall (claim top-up)`
        );
        broadcastToRoom(room, {
          type: 'wall-reshuffled',
          message: `Wall was empty - reshuffled ${reshuffledTiles.length} tiles from discards`
        });
      }

      if (room.wall.length === 0) {
        break;
      }

      let topUpTile = room.wall.shift();
      while (isAutoRedraw(topUpTile) && room.wall.length > 0) {
        topUpTile = room.wall.shift();
      }
      hand.push(topUpTile);
      room.hands[playerIndex] = sortHand(hand);
      lastDrawnDuringClaim = topUpTile;
      claimSummary = summarizePlayer(room, playerIndex);
      console.log(
        `[CLAIM_TOPUP] P${playerIndex + 1} drew ${topUpTile} to reach ${claimSummary.totalTiles} total tiles`
      );
    }

    const claimMeldSummary = claimSummary.melds.length > 0
      ? claimSummary.melds.map(m => `${m.type}:${m.tiles.join(' ')}`).join(' | ')
      : 'none';
    console.log(
      `[CLAIM] P${playerIndex + 1} completed ${claimType} with ${meldTiles.join(', ')} | hand=${claimSummary.handCount} meldTiles=${claimSummary.meldTileCount} total=${claimSummary.totalTiles}`
    );
    console.log(`[CLAIM]    Hand: ${claimSummary.hand.join(', ') || 'empty'}`);
    console.log(`[CLAIM]    Melds: ${claimMeldSummary}`);
    
    // Remove from discard pile
    room.discardPile.pop();
    room.lastDiscard = null;
    room.pendingActions = [];
    
    // Clear drawn tile highlight after claiming
    if (!room.drawnTiles) {
      room.drawnTiles = [null, null, null, null];
    }
    room.drawnTiles[playerIndex] = lastDrawnDuringClaim;
    
    // Check for win
    const didWin = checkWin(room.hands[playerIndex], room.melds[playerIndex]);
    console.log(
      `[CHECK_WIN] P${playerIndex + 1} -> result=${didWin} | pair=${room.hands[playerIndex].join(', ') || 'none'} | melds=${room.melds[playerIndex].map(m => `${m.type}:${m.tiles.join(' ')}`).join(' | ') || 'none'}`
    );
    if (didWin) {
      room.winner = playerIndex;
      room.state = 'finished';
      recordGameResult(room, playerIndex);
      broadcastToRoom(room, {
        type: 'game-won',
        winner: playerIndex,
        message: `Player ${playerIndex + 1} wins!`
      });
      broadcastToRoom(room, {
        type: 'announcement',
        message: `🎉 Mahjong! Player ${playerIndex + 1} has won the hand!`
      });
      console.log(`[WIN] Player ${playerIndex + 1} declared Mahjong.`);
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
  } else {
    console.log(
      `[CLAIM_FAIL] P${playerIndex + 1} attempted ${claimType} but the tiles were invalid.`
    );
    handlePass(room, playerIndex);
    sendToPlayer(room.players[playerIndex], {
      type: 'claim-invalid',
      claimType,
      message: `Unable to ${claimType} - required tiles not in hand.`
    });
  }
}

// Handle player declaring Mahjong from their own hand
function handleMahjong(room, playerIndex) {
  if (room.state !== 'playing') return;

  if (room.currentTurn !== playerIndex) {
    console.log(`[MAHJONG] P${playerIndex + 1} attempted Mahjong but it's not their turn.`);
    sendToPlayer(room.players[playerIndex], {
      type: 'mahjong-invalid',
      message: 'You can only declare Mahjong on your turn.'
    });
    return;
  }

  const hand = room.hands[playerIndex] || [];
  const melds = room.melds[playerIndex] || [];

  const totalTiles = summarizePlayer(room, playerIndex).totalTiles;

  if (totalTiles < 14) {
    console.log(`[MAHJONG] P${playerIndex + 1} attempted Mahjong with only ${totalTiles} tiles.`);
    sendToPlayer(room.players[playerIndex], {
      type: 'mahjong-invalid',
      message: 'You need 14 tiles to declare Mahjong.'
    });
    return;
  }

  const didWin = checkWin(hand, melds);
  console.log(
    `[MAHJONG] Checking Mahjong for P${playerIndex + 1}: hand=${hand.join(', ') || 'empty'} | melds=${melds.map(m => `${m.type}:${m.tiles.join(' ')}`).join(' | ') || 'none'} | result=${didWin}`
  );

  if (didWin) {
    room.winner = playerIndex;
    room.state = 'finished';
    room.lastActivity = Date.now();

    if (room.claimTimer) {
      clearTimeout(room.claimTimer);
      room.claimTimer = null;
    }

    room.pendingActions = [];
    room.lastDiscard = null;

    recordGameResult(room, playerIndex);

    broadcastToRoom(room, {
      type: 'game-won',
      winner: playerIndex,
      message: `Player ${playerIndex + 1} wins!`
    });

    broadcastToRoom(room, {
      type: 'announcement',
      message: `🎉 Mahjong! Player ${playerIndex + 1} has won the hand!`
    });

    console.log(`[WIN] Player ${playerIndex + 1} declared Mahjong from their hand.`);
  } else {
    sendToPlayer(room.players[playerIndex], {
      type: 'mahjong-invalid',
      message: 'Not a winning hand yet. Keep playing!'
    });
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
    console.log(`[TURN] All claims resolved. Moving to player P${room.currentTurn + 1}`);
    broadcastGameState(room);
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');

  const clientId = uuidv4();
  let currentRoom = null;
  let playerIndex = -1;
  let authUser = null;

  const requireAuth = async (idToken) => {
    if (!FIREBASE_ACTIVE) {
      return null;
    }

    if (idToken) {
      try {
        authUser = await verifyIdToken(idToken);
        return authUser;
      } catch (error) {
        console.warn('[Firebase] Invalid auth token', error);
        throw new Error('Invalid authentication token');
      }
    }

    if (authUser) {
      return authUser;
    }

    throw new Error('Missing authentication token');
  };

  const persistProfile = async (user, displayName) => {
    if (!user || !user.uid) {
      return;
    }

    await ensurePlayerProfile(user.uid, {
      displayName,
      email: user.email || null,
      photoURL: user.picture || user.photoURL || null
    });
  };

  const findFirstAvailableSeat = (room) => {
    const index = room.players.findIndex(player => !player);
    return index === -1 ? room.players.length : index;
  };

  const sendError = (message, code = 'error') => {
    ws.send(JSON.stringify({ type: 'error', message, code }));
  };

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'create-room': {
          let firebaseUser = null;
          try {
            firebaseUser = await requireAuth(data.idToken);
          } catch (authError) {
            sendError(authError.message || 'Authentication required', 'auth');
            break;
          }

          const roomOwnerName = deriveDisplayName(data.playerName, firebaseUser, 1);
          await persistProfile(firebaseUser, roomOwnerName);

          let roomCode = generateRoomCode();
          while (rooms.has(roomCode)) {
            roomCode = generateRoomCode();
          }

          const newRoom = createRoom(roomCode);
          rooms.set(roomCode, newRoom);

          const player = {
            id: clientId,
            uid: firebaseUser ? firebaseUser.uid : null,
            name: roomOwnerName,
            ws,
            isAI: false
          };

          newRoom.players[0] = player;
          newRoom.playerNames[0] = player.name;
          newRoom.playerIds[0] = player.uid;
          newRoom.lastActivity = Date.now();

          currentRoom = newRoom;
          playerIndex = 0;

          ws.send(JSON.stringify({
            type: 'room-created',
            roomCode,
            playerIndex: 0
          }));
          break;
        }

        case 'join-room': {
          const requestedRoomCode = data.roomCode;
          if (!requestedRoomCode) {
            sendError('Missing room code');
            break;
          }

          const trimmedCode = requestedRoomCode.toUpperCase();

          // Special test room 9999 (optional auth)
          if (trimmedCode === '9999') {
            let testRoom = rooms.get('9999');

            if (!testRoom) {
              testRoom = createRoom('9999');
              testRoom.isTestRoom = true;
              testRoom.aiPlayers = [];

              for (let i = 1; i < 4; i++) {
                const aiPlayer = new AIPlayer(i, testRoom);
                testRoom.aiPlayers.push(aiPlayer);
                testRoom.players[i] = {
                  id: `ai-${i}`,
                  uid: `ai-${i}`,
                  name: aiPlayer.name,
                  ws: null,
                  isAI: true
                };
                testRoom.playerNames[i] = aiPlayer.name;
                testRoom.playerIds[i] = `ai-${i}`;
              }

              rooms.set('9999', testRoom);
              console.log('🤖 Created test room 9999 with 3 AI players');
            }

            const firebaseUser = FIREBASE_ACTIVE
              ? await requireAuth(data.idToken).catch(() => null)
              : null;

            const humanName = deriveDisplayName(data.playerName, firebaseUser, 1);
            await persistProfile(firebaseUser, humanName);

            const humanPlayer = {
              id: clientId,
              uid: firebaseUser ? firebaseUser.uid : null,
              name: humanName,
              ws,
              isAI: false
            };

            testRoom.players[0] = humanPlayer;
            testRoom.playerNames[0] = humanName;
            testRoom.playerIds[0] = humanPlayer.uid;
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
                players: testRoom.players.map(p => p ? ({ id: p.id, uid: p.uid || null, name: p.name, isAI: p.isAI }) : null),
                winner: testRoom.winner
              } : null
            }));

            broadcastToRoom(testRoom, {
              type: 'player-joined',
              playerCount: 4,
              players: testRoom.players.map(p => p ? ({ id: p.id, uid: p.uid || null, name: p.name, isAI: p.isAI }) : null),
              isTestRoom: true
            });

            if (testRoom.state === 'waiting') {
              setTimeout(() => startGame(testRoom), 1000);
            }

            break;
          }

          const room = rooms.get(trimmedCode);

          if (!room) {
            sendError('Room not found', 'room/not-found');
            break;
          }

          const now = Date.now();
          if (now - room.lastActivity > room.maxIdleTime) {
            rooms.delete(room.code);
            sendError('Room has expired (30 minutes timeout)', 'room/expired');
            break;
          }

          let firebaseUser = null;
          if (FIREBASE_ACTIVE) {
            try {
              firebaseUser = await requireAuth(data.idToken);
            } catch (authError) {
              sendError(authError.message || 'Authentication required', 'auth');
              break;
            }
          }

          const desiredName = deriveDisplayName(data.playerName, firebaseUser, 1);
          await persistProfile(firebaseUser, desiredName);

          let rejoinPlayerIndex = -1;
          let isRejoin = false;

          if (firebaseUser && room.playerIds.includes(firebaseUser.uid)) {
            rejoinPlayerIndex = room.playerIds.indexOf(firebaseUser.uid);
            isRejoin = true;
          } else if (data.playerName && room.playerNames.includes(data.playerName)) {
            rejoinPlayerIndex = room.playerNames.indexOf(data.playerName);
            isRejoin = true;
          }

          const occupiedCount = room.players.filter(p => p).length;

          if (!isRejoin && occupiedCount >= 4) {
            sendError('Room is full', 'room/full');
            break;
          }

          if (!isRejoin && room.state !== 'waiting') {
            sendError('Game already in progress. Use same account to rejoin.', 'room/in-progress');
            break;
          }

          if (rejoinPlayerIndex === -1) {
            rejoinPlayerIndex = findFirstAvailableSeat(room);
          }

          const joiningPlayer = {
            id: clientId,
            uid: firebaseUser ? firebaseUser.uid : null,
            name: desiredName,
            ws,
            isAI: false
          };

          const existingPlayer = room.players[rejoinPlayerIndex];
          if (existingPlayer && existingPlayer.ws && existingPlayer.ws !== ws) {
            try {
              existingPlayer.ws.close(4001, 'Replaced by new connection');
            } catch (error) {
              console.warn('[Room] Failed to close previous socket on rejoin', error);
            }
          }

          room.players[rejoinPlayerIndex] = joiningPlayer;
          room.playerNames[rejoinPlayerIndex] = joiningPlayer.name;
          room.playerIds[rejoinPlayerIndex] = joiningPlayer.uid;
          room.lastActivity = now;

          currentRoom = room;
          playerIndex = rejoinPlayerIndex;

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
              players: room.players.map(p => p ? ({ id: p.id, uid: p.uid || null, name: p.name, isAI: p.isAI }) : null),
              winner: room.winner
            } : null
          }));

          broadcastToRoom(room, {
            type: 'player-joined',
            playerCount: room.players.filter(p => p).length,
            players: room.players.map(p => p ? ({ id: p.id, uid: p.uid || null, name: p.name, isAI: p.isAI }) : null),
            isRejoin,
            rejoiningPlayer: isRejoin ? joiningPlayer.name : null
          });

          if (room.players.filter(p => p).length === 4 && room.state === 'waiting') {
            setTimeout(() => startGame(room), 1000);
          }
          break;
        }

        case 'draw': {
          if (currentRoom && playerIndex !== -1) {
            console.log(`🂡 Player ${playerIndex + 1} (${currentRoom.code}) requested to DRAW`);
            handleDraw(currentRoom, playerIndex);
          }
          break;
        }

        case 'discard': {
          if (currentRoom && playerIndex !== -1 && data.tile) {
            console.log(`🂧 Player ${playerIndex + 1} (${currentRoom.code}) discarded request for ${data.tile}`);
            handleDiscard(currentRoom, playerIndex, data.tile);
          }
          break;
        }

        case 'claim': {
          if (currentRoom && playerIndex !== -1 && data.claimType) {
            console.log(`🂩 Player ${playerIndex + 1} (${currentRoom.code}) attempting claim ${data.claimType}${data.tiles ? ' with ' + JSON.stringify(data.tiles) : ''}`);
            handleClaim(currentRoom, playerIndex, data.claimType, data.tiles);
          }
          break;
        }

        case 'mahjong': {
          if (currentRoom && playerIndex !== -1) {
            console.log(`🀄 Player ${playerIndex + 1} (${currentRoom.code}) requested Mahjong check`);
            handleMahjong(currentRoom, playerIndex);
          }
          break;
        }

        case 'pass': {
          if (currentRoom && playerIndex !== -1) {
            console.log(`🀄 Player ${playerIndex + 1} (${currentRoom.code}) chose to PASS on claims`);
            handlePass(currentRoom, playerIndex);
          }
          break;
        }

        case 'force-draw': {
          if (currentRoom && playerIndex !== -1) {
            console.log(`⚙️ Player ${playerIndex + 1} (${currentRoom.code}) requested FORCE DRAW`);
            const canDrawNow = playerCanDraw(currentRoom, playerIndex);
            const canDiscardNow = playerCanDiscard(currentRoom, playerIndex);

            if (!shouldEnableForceDraw(currentRoom, playerIndex)) {
              let reason = 'Force draw unavailable right now.';
              if (currentRoom.currentTurn !== playerIndex) {
                reason = 'Not your turn.';
              } else if (canDrawNow) {
                reason = 'You can draw normally.';
              } else if (canDiscardNow) {
                reason = 'You must discard before drawing.';
              }
              sendToPlayer(currentRoom.players[playerIndex], {
                type: 'force-draw-denied',
                message: reason
              });
              break;
            }

            if (currentRoom.claimTimer) {
              clearTimeout(currentRoom.claimTimer);
              currentRoom.claimTimer = null;
            }

            currentRoom.pendingActions = [];
            currentRoom.lastDiscard = null;
            currentRoom.claimWindowEnd = null;

            sendToPlayer(currentRoom.players[playerIndex], {
              type: 'force-draw',
              message: 'Force draw activated. Attempting draw...'
            });

            handleDraw(currentRoom, playerIndex);
          }
          break;
        }

        case 'reset-test-room': {
          if (currentRoom && currentRoom.code === '9999' && currentRoom.isTestRoom) {
            console.log('🔄 Resetting test room 9999');

            const humanPlayer = currentRoom.players[0];
            currentRoom.players = [humanPlayer, null, null, null];
            currentRoom.playerNames = [humanPlayer ? humanPlayer.name : '', '', '', ''];
            currentRoom.playerIds = [humanPlayer ? humanPlayer.uid || null : null, null, null, null];

            currentRoom.aiPlayers = [];
            for (let i = 1; i < 4; i++) {
              const aiPlayer = new AIPlayer(i, currentRoom);
              currentRoom.aiPlayers.push(aiPlayer);
              currentRoom.players[i] = {
                id: `ai-${i}`,
                uid: `ai-${i}`,
                name: aiPlayer.name,
                ws: null,
                isAI: true
              };
              currentRoom.playerNames[i] = aiPlayer.name;
              currentRoom.playerIds[i] = `ai-${i}`;
            }

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

            if (currentRoom.claimTimer) {
              clearTimeout(currentRoom.claimTimer);
              currentRoom.claimTimer = null;
            }

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
        }

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendError('Unexpected server error processing request.', 'internal');
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');

    if (currentRoom) {
      if (playerIndex !== -1) {
        currentRoom.players[playerIndex] = null;
        currentRoom.playerNames[playerIndex] = '';
        currentRoom.playerIds[playerIndex] = null;
      }

      const remainingPlayers = currentRoom.players.filter(p => p);

      if (remainingPlayers.length === 0) {
        rooms.delete(currentRoom.code);
      } else {
        broadcastToRoom(currentRoom, {
          type: 'player-left',
          playerCount: remainingPlayers.length,
          message: 'A player has disconnected'
        });
      }
    }
  });
});

let cleanupInterval = null;
if (require.main === module) {
  cleanupInterval = setInterval(() => {
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
}

module.exports = {
  server,
  wss,
  rooms,
  createRoom,
  startGame,
  handleDraw,
  handleDiscard,
  handleClaim,
  handleMahjong,
  summarizePlayer,
  detectMeldsInHand,
  playerCanDraw,
  playerCanDiscard,
  shouldEnableForceDraw,
  cleanupInterval
};

