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

// Check if player has won (4 melds + 1 pair)
function checkWin(hand, melds) {
  // Must have exactly 4 melds
  if (melds.length !== 4) return false;
  
  // All melds must be valid
  if (!melds.every(meld => isValidMeld(meld.tiles))) return false;
  
  // Hand must have exactly 2 tiles (the pair)
  if (hand.length !== 2) return false;
  
  // Those 2 tiles must form a pair
  return isPair(hand);
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

