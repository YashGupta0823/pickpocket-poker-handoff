const { test } = require('node:test');
const assert = require('node:assert/strict');

const { shouldShowPassCover } = require('../js/uiLogic.js');

test('pass cover appears before a human turn in a multiplayer game', () => {
  const result = shouldShowPassCover({
    isTurnsPhase: true,
    isCurrentPlayerBot: false,
    humanSeatsInGameCount: 2,
    currentTurnKey: 'round1-player1',
    dismissedTurnKey: null,
    isStealAnimating: false
  });

  assert.equal(result, true);
});

const { chooseViewerIndex, computeStealCardPosition } = require('../js/uiLogic.js');

// Tolerance for floating-point comparisons of interpolated positions.
const EPSILON = 1e-9;
function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < EPSILON,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// ---------- shouldShowPassCover ----------

// A situation where the cover SHOULD show; each test flips one input away from it.
// Turn keys use the same "round:turn:player" shape main.js builds in getCurrentTurnKey().
function passCoverInputs(overrides = {}) {
  return {
    isTurnsPhase: true,
    isCurrentPlayerBot: false,
    humanSeatsInGameCount: 2,
    currentTurnKey: '1:3:2',
    dismissedTurnKey: null,
    isStealAnimating: false,
    ...overrides,
  };
}

test('pass cover is hidden when fewer than two humans remain (0 and 1), shown at exactly 2 and above', () => {
  assert.equal(shouldShowPassCover(passCoverInputs({ humanSeatsInGameCount: 0 })), false);
  assert.equal(shouldShowPassCover(passCoverInputs({ humanSeatsInGameCount: 1 })), false);
  assert.equal(shouldShowPassCover(passCoverInputs({ humanSeatsInGameCount: 2 })), true);
  assert.equal(shouldShowPassCover(passCoverInputs({ humanSeatsInGameCount: 4 })), true);
});

test('pass cover is hidden on a bot turn even when several humans are in the game', () => {
  assert.equal(shouldShowPassCover(passCoverInputs({ isCurrentPlayerBot: true })), false);
});

test('pass cover is hidden outside the turns phase (e.g. deal or showdown)', () => {
  assert.equal(shouldShowPassCover(passCoverInputs({ isTurnsPhase: false })), false);
});

test('pass cover stays down once dismissed for the same turn key', () => {
  const inputs = passCoverInputs({ currentTurnKey: '1:3:2', dismissedTurnKey: '1:3:2' });
  assert.equal(shouldShowPassCover(inputs), false);
});

test('pass cover comes back when the turn key differs from the dismissed one', () => {
  // Dismissed for player 2's turn; now it is player 0's turn, then the next round.
  assert.equal(
    shouldShowPassCover(passCoverInputs({ currentTurnKey: '1:4:0', dismissedTurnKey: '1:3:2' })),
    true
  );
  assert.equal(
    shouldShowPassCover(passCoverInputs({ currentTurnKey: '2:3:2', dismissedTurnKey: '1:3:2' })),
    true
  );
});

test('pass cover waits while a steal animation is playing', () => {
  assert.equal(shouldShowPassCover(passCoverInputs({ isStealAnimating: true })), false);
});

// ---------- chooseViewerIndex ----------

// Multi-human, human turn, cover down, no steal: the current player should see their cards.
function viewerInputs(overrides = {}) {
  return {
    humanSeatsInGame: [0, 2],
    currentPlayerIndex: 2,
    isTurnsPhase: true,
    isCurrentPlayerBot: false,
    isPassCoverShown: false,
    isStealAnimating: false,
    ...overrides,
  };
}

test('with exactly one human, that human always sees their cards — even on bot turns, outside play, or mid-steal', () => {
  const lone = { humanSeatsInGame: [3], currentPlayerIndex: 1 };
  assert.equal(chooseViewerIndex(viewerInputs({ ...lone, isCurrentPlayerBot: true })), 3);
  assert.equal(chooseViewerIndex(viewerInputs({ ...lone, isTurnsPhase: false, currentPlayerIndex: -1 })), 3);
  assert.equal(chooseViewerIndex(viewerInputs({ ...lone, isStealAnimating: true })), 3);
  assert.equal(chooseViewerIndex(viewerInputs({ ...lone, isPassCoverShown: true })), 3);
});

test('with two humans, the current human sees their own cards once the cover is dismissed', () => {
  assert.equal(chooseViewerIndex(viewerInputs({ currentPlayerIndex: 2 })), 2);
  assert.equal(chooseViewerIndex(viewerInputs({ currentPlayerIndex: 0 })), 0);
});

test('with two humans, nobody sees private cards while the pass cover is showing', () => {
  assert.equal(chooseViewerIndex(viewerInputs({ isPassCoverShown: true })), -1);
});

test('with two humans, nobody sees private cards on a bot turn', () => {
  assert.equal(
    chooseViewerIndex(viewerInputs({ currentPlayerIndex: 1, isCurrentPlayerBot: true })),
    -1
  );
});

test('with two humans, nobody sees private cards during a steal animation', () => {
  assert.equal(chooseViewerIndex(viewerInputs({ isStealAnimating: true })), -1);
});

test('with two humans, nobody sees private cards outside the turns phase', () => {
  assert.equal(
    chooseViewerIndex(viewerInputs({ isTurnsPhase: false, currentPlayerIndex: -1 })),
    -1
  );
});

test('with no humans left, a bot turn reveals nobody', () => {
  assert.equal(
    chooseViewerIndex(viewerInputs({ humanSeatsInGame: [], currentPlayerIndex: 1, isCurrentPlayerBot: true })),
    -1
  );
});

test('with no humans in the array, a non-bot turn returns currentPlayerIndex as-is (falls through to the multi-human branch)', () => {
  // Documents current behavior: an empty seat list is not special-cased, so the
  // "several humans" rule applies and the current player index is returned unchanged.
  assert.equal(chooseViewerIndex(viewerInputs({ humanSeatsInGame: [], currentPlayerIndex: 4 })), 4);
});

// ---------- computeStealCardPosition ----------

test('steal card starts exactly at its origin at elapsed time 0', () => {
  const pos = computeStealCardPosition({ fromX: 100, fromY: 50, toX: 400, toY: 300, elapsedMs: 0, durationMs: 600 });
  assert.deepEqual(pos, { x: 100, y: 50 });
});

test('steal card lands exactly on its destination at elapsed === duration', () => {
  const pos = computeStealCardPosition({ fromX: 100, fromY: 50, toX: 400, toY: 300, elapsedMs: 600, durationMs: 600 });
  assert.deepEqual(pos, { x: 400, y: 300 });
});

test('steal card stays clamped on its destination after the duration has passed', () => {
  const pos = computeStealCardPosition({ fromX: 100, fromY: 50, toX: 400, toY: 300, elapsedMs: 5000, durationMs: 600 });
  assert.deepEqual(pos, { x: 400, y: 300 });
});

test('steal card is exactly at the midpoint halfway through', () => {
  const pos = computeStealCardPosition({ fromX: 100, fromY: 50, toX: 400, toY: 300, elapsedMs: 300, durationMs: 600 });
  assertClose(pos.x, 250, 'x');
  assertClose(pos.y, 175, 'y');
});

test('steal card eases in-out: 12.5% of the way at quarter time, 87.5% at three-quarter time', () => {
  // Ease in-out quad: 2p² for p < 0.5, 1 - (2 - 2p)²/2 otherwise. Linear motion would give 25%/75%.
  const args = { fromX: 0, fromY: 0, toX: 800, toY: 400, durationMs: 1000 };
  const quarter = computeStealCardPosition({ ...args, elapsedMs: 250 });
  assertClose(quarter.x, 100, 'quarter x');
  assertClose(quarter.y, 50, 'quarter y');
  const threeQuarter = computeStealCardPosition({ ...args, elapsedMs: 750 });
  assertClose(threeQuarter.x, 700, 'three-quarter x');
  assertClose(threeQuarter.y, 350, 'three-quarter y');
});

test('steal card interpolates X and Y independently, including movement up and to the left', () => {
  // Moving toward smaller X and smaller Y with different distances on each axis.
  const pos = computeStealCardPosition({ fromX: 500, fromY: 400, toX: 100, toY: 300, elapsedMs: 250, durationMs: 1000 });
  // eased = 0.125 → x = 500 - 400*0.125, y = 400 - 100*0.125
  assertClose(pos.x, 450, 'x');
  assertClose(pos.y, 387.5, 'y');
});

test('steal card with negative elapsed time drifts slightly toward the target (progress is not clamped at 0)', () => {
  // Documents current behavior: only the upper bound is clamped. p = -0.1 → eased = 2·0.01 = 0.02,
  // so the card is 2% of the way along instead of sitting at the origin.
  const pos = computeStealCardPosition({ fromX: 0, fromY: 0, toX: 1000, toY: 500, elapsedMs: -100, durationMs: 1000 });
  assertClose(pos.x, 20, 'x');
  assertClose(pos.y, 10, 'y');
});

test('steal card with zero duration: positive elapsed lands on target, but elapsed 0 yields NaN', () => {
  // Documents current behavior. elapsed/0 = Infinity → clamped to 1 → destination.
  const later = computeStealCardPosition({ fromX: 10, fromY: 20, toX: 30, toY: 40, elapsedMs: 16, durationMs: 0 });
  assert.deepEqual(later, { x: 30, y: 40 });
  // 0/0 = NaN, Math.min(1, NaN) = NaN, so the position is NaN on both axes.
  const immediate = computeStealCardPosition({ fromX: 10, fromY: 20, toX: 30, toY: 40, elapsedMs: 0, durationMs: 0 });
  assert.ok(Number.isNaN(immediate.x), `expected x to be NaN, got ${immediate.x}`);
  assert.ok(Number.isNaN(immediate.y), `expected y to be NaN, got ${immediate.y}`);
});
