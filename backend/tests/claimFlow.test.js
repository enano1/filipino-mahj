const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRoom,
  handleDraw,
  handleDiscard,
  handleClaim,
  summarizePlayer,
  shouldEnableForceDraw
} = require('../server');
const { sortHand } = require('../gameLogic');

function setupRoom() {
  const room = createRoom('test-room');
  room.state = 'playing';
  room.players = [
    { id: 'p0', name: 'Player 1', ws: null, isAI: false },
    { id: 'p1', name: 'Player 2', ws: null, isAI: false },
    { id: 'p2', name: 'Player 3', ws: null, isAI: false },
    { id: 'p3', name: 'Player 4', ws: null, isAI: false }
  ];
  room.drawnTiles = [null, null, null, null];
  room.claimTimer = null;
  return room;
}

test('pong claim keeps claimant on turn and requires discard', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-1', 'bamboo-2', 'bamboo-3',
    'bamboo-5', 'bamboo-5', 'character-2', 'character-5',
    'dot-1', 'dot-3', 'dot-4', 'dot-6', 'dot-8'
  ]);
  room.hands[1] = sortHand([
    'character-1', 'character-3', 'character-4', 'character-6',
    'dot-2', 'dot-5', 'dot-7', 'bamboo-7', 'bamboo-8', 'bamboo-9',
    'character-8', 'character-9', 'dot-9'
  ]);
  room.hands[2] = sortHand([
    'bamboo-4', 'bamboo-6', 'character-7', 'character-5',
    'dot-3', 'dot-6', 'dot-8', 'character-2', 'character-4',
    'bamboo-2', 'bamboo-3', 'dot-4', 'dot-5'
  ]);
  room.hands[3] = sortHand([
    'character-1', 'character-2', 'character-6', 'character-7',
    'dot-1', 'dot-2', 'dot-7', 'dot-8', 'bamboo-6', 'bamboo-7',
    'bamboo-8', 'bamboo-9', 'character-9'
  ]);

  room.lastDiscard = { tile: 'bamboo-5', playerIndex: 1 };
  room.pendingActions = [{ playerIndex: 0, type: 'pong' }];
  room.currentTurn = 0;
  room.wall = ['dot-9', 'character-9'];

  handleClaim(room, 0, 'pong');
  const summaryAfterClaim = summarizePlayer(room, 0);

  assert.equal(summaryAfterClaim.melds.length, 1);
  assert.deepEqual(summaryAfterClaim.melds[0].tiles, ['bamboo-5', 'bamboo-5', 'bamboo-5']);
  assert.equal(summaryAfterClaim.handCount, 11);
  assert.equal(summaryAfterClaim.totalTiles, 14);
  assert.equal(room.currentTurn, 0);
  assert.equal(room.pendingActions.length, 0);

  const discardTile = room.hands[0][0];
  handleDiscard(room, 0, discardTile);
  const summaryAfterDiscard = summarizePlayer(room, 0);

  assert.equal(summaryAfterDiscard.handCount, 10);
  assert.equal(summaryAfterDiscard.totalTiles, 13);
  assert.equal(room.currentTurn, 1);
});

test('chow claim keeps claimant on turn and totals remain consistent', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-2', 'bamboo-3', 'bamboo-5', 'character-2',
    'character-3', 'character-4', 'character-6', 'dot-1',
    'dot-2', 'dot-4', 'dot-5', 'dot-7', 'dot-8'
  ]);
  room.hands[3] = sortHand([
    'bamboo-7', 'bamboo-8', 'bamboo-9', 'character-1',
    'character-2', 'character-5', 'character-7', 'dot-3',
    'dot-6', 'dot-7', 'dot-9', 'bamboo-6', 'character-8'
  ]);

  room.lastDiscard = { tile: 'bamboo-4', playerIndex: 3 };
  room.pendingActions = [{
    playerIndex: 0,
    type: 'chow',
    options: [['bamboo-2', 'bamboo-3', 'bamboo-4'], ['bamboo-3', 'bamboo-4', 'bamboo-5']]
  }];
  room.currentTurn = 0;
  room.wall = ['character-9'];

  handleClaim(room, 0, 'chow', ['bamboo-3', 'bamboo-4', 'bamboo-5']);
  const summaryAfterClaim = summarizePlayer(room, 0);

  assert.equal(summaryAfterClaim.melds.length, 1);
  assert.deepEqual(summaryAfterClaim.melds[0].tiles, ['bamboo-3', 'bamboo-4', 'bamboo-5']);
  assert.equal(summaryAfterClaim.handCount, 11);
  assert.equal(summaryAfterClaim.totalTiles, 14);
  assert.equal(room.currentTurn, 0);
  assert.equal(room.pendingActions.length, 0);

  const discardTile = room.hands[0].find(tile => !['bamboo-2', 'character-2', 'character-3'].includes(tile));
  handleDiscard(room, 0, discardTile);
  const summaryAfterDiscard = summarizePlayer(room, 0);

  assert.equal(summaryAfterDiscard.handCount, 10);
  assert.equal(summaryAfterDiscard.totalTiles, 13);
  assert.equal(room.currentTurn, 1);
});

test('kong claim draws replacement tile and increases meld size', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'dot-7', 'dot-7', 'dot-7', 'bamboo-2',
    'bamboo-3', 'bamboo-4', 'character-2', 'character-3',
    'character-4', 'dot-2', 'dot-3', 'dot-6', 'dot-8'
  ]);

  room.lastDiscard = { tile: 'dot-7', playerIndex: 2 };
  room.pendingActions = [{ playerIndex: 0, type: 'kong' }];
  room.currentTurn = 0;
  room.wall = ['character-9', 'character-8'];

  handleClaim(room, 0, 'kong');
  const summaryAfterClaim = summarizePlayer(room, 0);

  assert.equal(summaryAfterClaim.melds.length, 1);
  assert.deepEqual(summaryAfterClaim.melds[0].tiles, ['dot-7', 'dot-7', 'dot-7', 'dot-7']);
  assert.equal(summaryAfterClaim.handCount, 11);
  assert.equal(summaryAfterClaim.meldTileCount, 4);
  assert.equal(summaryAfterClaim.totalTiles, 15);
  assert.equal(room.currentTurn, 0);
  assert.equal(room.pendingActions.length, 0);
  assert.equal(room.wall.length, 1);
});

test('turn advances correctly across a full rotation without claims', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'character-1', 'character-2', 'character-3', 'character-4',
    'character-5', 'character-6', 'character-7', 'character-8',
    'character-9', 'dot-1', 'dot-2', 'dot-3', 'bamboo-1'
  ]);
  room.hands[1] = sortHand([
    'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5',
    'dot-6', 'dot-7', 'dot-8', 'dot-9', 'character-1',
    'character-2', 'character-3', 'bamboo-5'
  ]);
  room.hands[2] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4',
    'bamboo-5', 'bamboo-6', 'bamboo-7', 'bamboo-8',
    'bamboo-9', 'character-4', 'character-5', 'character-6', 'dot-4'
  ]);
  room.hands[3] = sortHand([
    'dot-1', 'dot-3', 'dot-5', 'dot-7', 'dot-9',
    'character-1', 'character-3', 'character-5', 'character-7',
    'bamboo-2', 'bamboo-4', 'bamboo-6', 'bamboo-8'
  ]);

  room.wall = ['bamboo-9', 'character-8', 'dot-9', 'bamboo-7'];
  room.currentTurn = 0;

  for (let i = 0; i < 4; i++) {
    const playerIndex = room.currentTurn;
    handleDraw(room, playerIndex);

    const summaryAfterDraw = summarizePlayer(room, playerIndex);
    assert.equal(summaryAfterDraw.handCount, 14); // 13 + draw

    const discardTile = room.drawnTiles[playerIndex];
    handleDiscard(room, playerIndex, discardTile);

    const summaryAfterDiscard = summarizePlayer(room, playerIndex);
    assert.equal(summaryAfterDiscard.handCount, 13);
    assert.equal(room.currentTurn, (playerIndex + 1) % 4);
    assert.equal(room.lastDiscard, null);
  }

  assert.equal(room.currentTurn, 0);
});

test('wall reshuffles when empty and discard pile has tiles', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4', 'bamboo-5',
    'bamboo-6', 'character-1', 'character-2', 'character-3',
    'dot-1', 'dot-2', 'dot-3', 'dot-4'
  ]);
  room.wall = [];
  room.discardPile = ['character-9', 'dot-9', 'bamboo-9', 'character-8'];
  room.currentTurn = 0;

  const originalRandom = Math.random;
  Math.random = () => 0; // deterministic shuffle

  try {
    handleDraw(room, 0);
  } finally {
    Math.random = originalRandom;
  }

  const summaryAfterDraw = summarizePlayer(room, 0);
  assert.equal(summaryAfterDraw.handCount, 14);
  assert.equal(room.wall.length, 3); // 4 reshuffled - 1 drawn
  assert.equal(room.discardPile.length, 0);
});

test('game ends when wall and discard pile are empty on draw', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4', 'bamboo-5',
    'bamboo-6', 'character-1', 'character-2', 'character-3',
    'dot-1', 'dot-2', 'dot-3', 'dot-4'
  ]);
  room.wall = [];
  room.discardPile = [];
  room.currentTurn = 0;

  handleDraw(room, 0);

  assert.equal(room.state, 'finished');
});

test('invalid chow attempt removes pending action and advances turn when no other claims', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-2', 'character-2', 'character-3', 'character-4',
    'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5', 'dot-6',
    'dot-7', 'dot-8', 'dot-9'
  ]);
  room.hands[3] = sortHand([
    'bamboo-5', 'bamboo-6', 'bamboo-7', 'character-1',
    'character-2', 'character-5', 'character-7', 'dot-3',
    'dot-6', 'dot-7', 'dot-9', 'bamboo-6', 'character-8'
  ]);

  room.lastDiscard = { tile: 'bamboo-4', playerIndex: 3 };
  room.pendingActions = [{
    playerIndex: 0,
    type: 'chow',
    options: [['bamboo-2', 'bamboo-3', 'bamboo-4']]
  }];
  room.currentTurn = 0;

  handleClaim(room, 0, 'chow', ['bamboo-2', 'bamboo-3', 'bamboo-4']);

  assert.equal(room.pendingActions.length, 0);
  assert.equal(room.lastDiscard, null);
  assert.equal(room.currentTurn, (3 + 1) % 4);
});

test('claim top-up restores total tiles to 14 when hand would be short', () => {
  const room = setupRoom();

  room.melds[0] = [
    { type: 'chow', tiles: ['dot-3', 'dot-4', 'dot-5'] }
  ];
  room.hands[0] = sortHand([
    'bamboo-5', 'bamboo-5', 'bamboo-5',
    'dot-7', 'dot-7', 'dot-7',
    'dot-8', 'dot-8'
  ]);
  room.lastDiscard = { tile: 'dot-8', playerIndex: 3 };
  room.pendingActions = [{ playerIndex: 0, type: 'pong' }];
  room.currentTurn = 0;
  room.wall = ['character-4', 'character-5', 'character-6', 'character-7'];

  handleClaim(room, 0, 'pong');

  const summary = summarizePlayer(room, 0);
  assert.equal(summary.totalTiles, 14);
  assert.equal(room.wall.length, 2);
  assert.equal(room.pendingActions.length, 0);
  assert.equal(room.currentTurn, 0);
  assert.ok(room.drawnTiles);
  assert.equal(room.drawnTiles[0], 'character-5');
});

test('current turn moves to next player when discard creates pending claims', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4',
    'bamboo-5', 'character-1', 'character-2', 'character-3',
    'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5'
  ]);
  room.hands[1] = sortHand([
    'bamboo-4', 'bamboo-4', 'bamboo-4', 'character-6',
    'character-7', 'character-8', 'dot-1', 'dot-2',
    'dot-3', 'dot-4', 'dot-5', 'dot-6', 'dot-7'
  ]);
  room.hands[2] = sortHand([
    'bamboo-2', 'bamboo-3', 'bamboo-5', 'character-2',
    'character-3', 'character-4', 'dot-1', 'dot-2',
    'dot-3', 'dot-4', 'dot-5', 'dot-6', 'dot-7'
  ]);
  room.hands[3] = sortHand([
    'bamboo-6', 'bamboo-7', 'bamboo-8', 'character-5',
    'character-6', 'character-7', 'dot-1', 'dot-2',
    'dot-3', 'dot-4', 'dot-5', 'dot-6', 'dot-7'
  ]);

  room.currentTurn = 0;
  room.wall = ['character-9', 'character-8', 'dot-9', 'dot-8'];

  handleDraw(room, 0);
  handleDiscard(room, 0, 'bamboo-4');

  assert.equal(room.currentTurn, 1);
  assert.equal(room.pendingActions.length > 0, true);
  assert.equal(room.pendingActions[0].playerIndex, 1);
  assert.equal(room.lastDiscard.playerIndex, 0);
});

test('force draw disabled when normal draw available', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'character-1', 'character-2',
    'character-3', 'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5', 'dot-6', 'dot-7'
  ]);
  room.currentTurn = 0;
  room.lastDiscard = null;

  assert.equal(shouldEnableForceDraw(room, 0), false);
});

test('force draw disabled when discard required', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'bamboo-4',
    'character-1', 'character-2', 'character-3', 'character-4',
    'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5', 'dot-6'
  ]);
  room.currentTurn = 0;
  room.lastDiscard = null;

  assert.equal(shouldEnableForceDraw(room, 0), false);
});

test('force draw enabled when stuck with lingering discard', () => {
  const room = setupRoom();

  room.hands[0] = sortHand([
    'bamboo-1', 'bamboo-2', 'bamboo-3', 'character-1', 'character-2',
    'character-3', 'dot-1', 'dot-2', 'dot-3', 'dot-4', 'dot-5', 'dot-6', 'dot-7'
  ]);
  room.currentTurn = 0;
  room.lastDiscard = { tile: 'character-9', playerIndex: 3, timestamp: Date.now() };
  room.pendingActions = [];

  assert.equal(shouldEnableForceDraw(room, 0), true);
});

