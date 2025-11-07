const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkWin,
  canChow,
  sortHand
} = require('../gameLogic');

test('checkWin returns true for four melds and a pair', () => {
  const hand = ['bamboo-9', 'bamboo-9'];
  const melds = [
    { type: 'pong', tiles: ['bamboo-1', 'bamboo-1', 'bamboo-1'] },
    { type: 'chow', tiles: ['character-3', 'character-4', 'character-5'] },
    { type: 'pong', tiles: ['dot-2', 'dot-2', 'dot-2'] },
    { type: 'chow', tiles: ['bamboo-4', 'bamboo-5', 'bamboo-6'] }
  ];

  assert.equal(checkWin(hand, melds), true);
});

test('checkWin returns false when meld count is not four', () => {
  const hand = ['bamboo-9', 'bamboo-9'];
  const melds = [
    { type: 'pong', tiles: ['bamboo-1', 'bamboo-1', 'bamboo-1'] },
    { type: 'chow', tiles: ['character-3', 'character-4', 'character-5'] },
    { type: 'pong', tiles: ['dot-2', 'dot-2', 'dot-2'] }
  ];

  assert.equal(checkWin(hand, melds), false);
});

test('checkWin returns false when pair is invalid', () => {
  const hand = ['bamboo-9', 'bamboo-8'];
  const melds = [
    { type: 'pong', tiles: ['bamboo-1', 'bamboo-1', 'bamboo-1'] },
    { type: 'chow', tiles: ['character-3', 'character-4', 'character-5'] },
    { type: 'pong', tiles: ['dot-2', 'dot-2', 'dot-2'] },
    { type: 'chow', tiles: ['bamboo-4', 'bamboo-5', 'bamboo-6'] }
  ];

  assert.equal(checkWin(hand, melds), false);
});

test('canChow identifies valid chow options', () => {
  const hand = sortHand(['bamboo-2', 'bamboo-3', 'bamboo-5', 'bamboo-6', 'character-4']);
  const options = canChow(hand, 'bamboo-4');
  const expected = [
    ['bamboo-2', 'bamboo-3', 'bamboo-4'],
    ['bamboo-3', 'bamboo-4', 'bamboo-5'],
    ['bamboo-4', 'bamboo-5', 'bamboo-6']
  ];

  const normalize = combos => combos.map(opt => opt.join('|')).sort();
  assert.deepEqual(normalize(options), normalize(expected));
});

