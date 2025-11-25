// Filipino Mahjong Game Logic

// Tile types
const SUITS = ['bamboo', 'character', 'dot'];
const HONORS = ['dragon-red', 'dragon-green', 'dragon-white', 'wind-east', 'wind-south', 'wind-west', 'wind-north'];
const FLOWERS = ['flower-1', 'flower-2', 'flower-3', 'flower-4'];

// Tile emojis for display
const TILE_EMOJIS = {
  'bamboo-1': '🀐', 'bamboo-2': '🀑', 'bamboo-3': '🀒', 'bamboo-4': '🀓', 'bamboo-5': '🀔',
  'bamboo-6': '🀕', 'bamboo-7': '🀖', 'bamboo-8': '🀗', 'bamboo-9': '🀘',
  'character-1': '🀇', 'character-2': '🀈', 'character-3': '🀉', 'character-4': '🀊', 'character-5': '🀋',
  'character-6': '🀌', 'character-7': '🀍', 'character-8': '🀎', 'character-9': '🀏',
  'dot-1': '🀙', 'dot-2': '🀚', 'dot-3': '🀛', 'dot-4': '🀜', 'dot-5': '🀝',
  'dot-6': '🀞', 'dot-7': '🀟', 'dot-8': '🀠', 'dot-9': '🀡',
  'dragon-red': '🀄', 'dragon-green': '🀅', 'dragon-white': '🀆',
  'wind-east': '🀀', 'wind-south': '🀁', 'wind-west': '🀂', 'wind-north': '🀃',
  'flower-1': '🀢', 'flower-2': '🀣', 'flower-3': '🀤', 'flower-4': '🀥'
};

// Check if tile is auto-redraw (dragons, winds, flowers)
function isAutoRedraw(tile) {
  return HONORS.includes(tile) || FLOWERS.includes(tile);
}

// Generate complete tile wall (144 tiles)
function generateTileWall() {
  const tiles = [];
  
  // 4 copies of each numbered suit tile (1-9 for each suit)
  SUITS.forEach(suit => {
    for (let num = 1; num <= 9; num++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(`${suit}-${num}`);
      }
    }
  });
  
  // 4 copies of each honor tile
  HONORS.forEach(honor => {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push(honor);
    }
  });
  
  // 1 copy of each flower tile
  FLOWERS.forEach(flower => {
    tiles.push(flower);
  });
  
  // Shuffle the tiles
  return shuffleArray(tiles);
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deal initial hands to players
function dealHands(wall) {
  const hands = [[], [], [], []];
  let tileIndex = 0;
  
  // Deal 13 tiles to each player
  for (let player = 0; player < 4; player++) {
    for (let i = 0; i < 13; i++) {
      hands[player].push(wall[tileIndex++]);
    }
  }
  
  return { hands, remainingWall: wall.slice(tileIndex) };
}

// Check if tiles form a valid Pong (3 identical tiles)
function isPong(tiles) {
  if (tiles.length !== 3) return false;
  return tiles[0] === tiles[1] && tiles[1] === tiles[2];
}

// Check if tiles form a valid Kong (4 identical tiles)
function isKong(tiles) {
  if (tiles.length !== 4) return false;
  return tiles[0] === tiles[1] && tiles[1] === tiles[2] && tiles[2] === tiles[3];
}

// Check if tiles form a valid Chow (3 consecutive tiles of same suit)
function isChow(tiles) {
  if (tiles.length !== 3) return false;
  
  // Extract suit and numbers
  const parsed = tiles.map(tile => {
    const parts = tile.split('-');
    return { suit: parts[0], num: parseInt(parts[1]) };
  });
  
  // All must be from numbered suits and same suit
  if (!SUITS.includes(parsed[0].suit)) return false;
  if (!parsed.every(t => t.suit === parsed[0].suit)) return false;
  if (parsed.some(t => isNaN(t.num))) return false;
  
  // Sort by number and check if consecutive
  const sorted = parsed.map(t => t.num).sort((a, b) => a - b);
  return sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1;
}

// Check if tiles form a valid pair (2 identical tiles)
function isPair(tiles) {
  if (tiles.length !== 2) return false;
  return tiles[0] === tiles[1];
}

// Check if tiles form a valid meld
function isValidMeld(tiles) {
  return isPong(tiles) || isChow(tiles) || isKong(tiles);
}

// Helper function to count tiles in an array
function countTiles(tileArray) {
  const counts = {};
  tileArray.forEach(tile => {
    counts[tile] = (counts[tile] || 0) + 1;
  });
  return counts;
}

// Helper function to remove tiles from counts
function removeTilesFromCounts(counts, tiles) {
  const newCounts = { ...counts };
  tiles.forEach(tile => {
    if (newCounts[tile]) {
      newCounts[tile]--;
      if (newCounts[tile] === 0) {
        delete newCounts[tile];
      }
    }
  });
  return newCounts;
}

// Helper function to find all possible melds from remaining tiles
function findAllPossibleMelds(counts) {
  const melds = [];
  
  // Find all possible pongs and kongs
  Object.entries(counts).forEach(([tile, count]) => {
    if (count >= 4) {
      melds.push({ type: 'kong', tiles: [tile, tile, tile, tile] });
      melds.push({ type: 'pong', tiles: [tile, tile, tile] }); // Can also use 3 for pong
    } else if (count >= 3) {
      melds.push({ type: 'pong', tiles: [tile, tile, tile] });
    }
    if (count >= 2) {
      melds.push({ type: 'pair', tiles: [tile, tile] });
    }
  });
  
  // Find all possible chows (sequences)
  const suits = ['bamboo', 'character', 'dot'];
  suits.forEach(suit => {
    for (let num = 1; num <= 7; num++) {
      const tile1 = `${suit}-${num}`;
      const tile2 = `${suit}-${num + 1}`;
      const tile3 = `${suit}-${num + 2}`;
      
      if (counts[tile1] >= 1 && counts[tile2] >= 1 && counts[tile3] >= 1) {
        melds.push({ type: 'chow', tiles: [tile1, tile2, tile3] });
      }
    }
  });
  
  return melds;
}

// Recursive function to try to form 4 melds + 1 pair
function tryFormWin(counts, declaredMelds, foundMelds, foundPair) {
  // Count total melds
  const totalMelds = declaredMelds.length + foundMelds.length;
  const remainingTiles = Object.values(counts).reduce((sum, c) => sum + c, 0);
  
  // Base case: we have exactly 4 melds and 1 pair, and all tiles are used
  if (totalMelds === 4 && foundPair && remainingTiles === 0) {
    return true;
  }
  
  // If we have more than 4 melds, invalid
  if (totalMelds > 4) return false;
  
  // If we have exactly 4 melds but no pair, check if remaining tiles form a pair
  if (totalMelds === 4 && !foundPair) {
    if (remainingTiles === 2) {
      // Check if the 2 remaining tiles form a pair
      const remainingTileTypes = Object.entries(counts).filter(([tile, count]) => count > 0);
      if (remainingTileTypes.length === 1 && remainingTileTypes[0][1] === 2) {
        return true; // Found a pair
      }
    }
    return false;
  }
  
  // If we already have 4 melds and a pair, check if everything is used
  if (totalMelds === 4 && foundPair) {
    return remainingTiles === 0;
  }
  
  // If we have no tiles left but don't have 4 melds + pair, invalid
  if (remainingTiles === 0) return false;
  
  // Try to form more melds or pair
  const possibleMelds = findAllPossibleMelds(counts);
  
  // Try each possible meld
  for (const meld of possibleMelds) {
    // Skip pairs if we already have one
    if (foundPair && meld.type === 'pair') continue;
    
    // Check if we can use this meld (all tiles are available with sufficient count)
    const meldCounts = countTiles(meld.tiles);
    let canUse = true;
    for (const [tile, neededCount] of Object.entries(meldCounts)) {
      if (!counts[tile] || counts[tile] < neededCount) {
        canUse = false;
        break;
      }
    }
    
    if (!canUse) continue;
    
    // Remove tiles used by this meld
    const newCounts = removeTilesFromCounts(counts, meld.tiles);
    const newFoundMelds = [...foundMelds];
    
    if (meld.type === 'pair' && !foundPair) {
      // Found a pair
      if (tryFormWin(newCounts, declaredMelds, newFoundMelds, true)) {
        return true;
      }
    } else if (meld.type !== 'pair') {
      // It's a regular meld (pong, chow, kong)
      newFoundMelds.push(meld);
      if (tryFormWin(newCounts, declaredMelds, newFoundMelds, foundPair)) {
        return true;
      }
    }
  }
  
  return false;
}

// Check if player has won (4 melds + 1 pair)
function checkWin(hand, melds) {
  // Total tiles should be 14: declared melds + hand
  // Each pong/chow uses 3 tiles, kong uses 4, pair uses 2
  
  // Count all tiles from declared melds
  const allDeclaredTiles = [];
  melds.forEach(meld => {
    allDeclaredTiles.push(...meld.tiles);
  });
  
  // Combine all tiles: declared meld tiles + hand tiles
  const allTiles = [...allDeclaredTiles, ...hand];
  
  // If not exactly 14 tiles, can't win
  if (allTiles.length !== 14) return false;
  
  // Validate all declared melds are valid
  if (!melds.every(meld => isValidMeld(meld.tiles))) return false;
  
  // Count tiles
  const tileCounts = countTiles(allTiles);
  
  // Verify we have exactly 4 melds (declared) or can form 4 total
  if (melds.length === 4) {
    // All melds are declared, just check if hand has a valid pair
    if (hand.length !== 2) return false;
    return isPair(hand);
  }
  
  // Not all melds are declared - need to check if we can form 4 melds + 1 pair total
  // Remove declared meld tiles from counts
  let remainingCounts = { ...tileCounts };
  melds.forEach(meld => {
    remainingCounts = removeTilesFromCounts(remainingCounts, meld.tiles);
  });
  
  // Try to form remaining melds + pair from hand
  return tryFormWin(remainingCounts, melds, [], false);
}

// Check if player can pong with a discarded tile
function canPong(hand, discardedTile) {
  // Count how many of the discarded tile the player has
  const count = hand.filter(tile => tile === discardedTile).length;
  return count >= 2; // Need 2 in hand + 1 discarded = 3 total
}

// Check if player can kong with a discarded tile
function canKong(hand, discardedTile) {
  // Count how many of the discarded tile the player has
  const count = hand.filter(tile => tile === discardedTile).length;
  return count >= 3; // Need 3 in hand + 1 discarded = 4 total
}

// Check if player can chow (only from previous player's discard)
function canChow(hand, discardedTile) {
  // Can only chow numbered suit tiles
  const parts = discardedTile.split('-');
  if (!SUITS.includes(parts[0])) return false;
  const suit = parts[0];
  const num = parseInt(parts[1]);
  if (isNaN(num)) return false;
  
  const possibleChows = [];
  
  // Pattern 1: discarded tile is first (e.g., 1-2-3)
  if (num <= 7) {
    const tile2 = `${suit}-${num + 1}`;
    const tile3 = `${suit}-${num + 2}`;
    if (hand.includes(tile2) && hand.includes(tile3)) {
      possibleChows.push([discardedTile, tile2, tile3]);
    }
  }
  
  // Pattern 2: discarded tile is middle (e.g., 2-3-4)
  if (num >= 2 && num <= 8) {
    const tile1 = `${suit}-${num - 1}`;
    const tile3 = `${suit}-${num + 1}`;
    if (hand.includes(tile1) && hand.includes(tile3)) {
      possibleChows.push([tile1, discardedTile, tile3]);
    }
  }
  
  // Pattern 3: discarded tile is last (e.g., 7-8-9)
  if (num >= 3) {
    const tile1 = `${suit}-${num - 2}`;
    const tile2 = `${suit}-${num - 1}`;
    if (hand.includes(tile1) && hand.includes(tile2)) {
      possibleChows.push([tile1, tile2, discardedTile]);
    }
  }
  
  return possibleChows;
}

// Sort hand for better display
function sortHand(hand) {
  return hand.sort((a, b) => {
    const aIndex = Object.keys(TILE_EMOJIS).indexOf(a);
    const bIndex = Object.keys(TILE_EMOJIS).indexOf(b);
    return aIndex - bIndex;
  });
}

module.exports = {
  TILE_EMOJIS,
  isAutoRedraw,
  generateTileWall,
  dealHands,
  isPong,
  isKong,
  isChow,
  isPair,
  isValidMeld,
  checkWin,
  canPong,
  canKong,
  canChow,
  sortHand
};

