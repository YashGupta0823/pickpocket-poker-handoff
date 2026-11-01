// Engine tests. Run from the repo root with:   node tests/run-tests.js
// No test framework, no npm install. Covers the rules engine only (cards, pokerRank, gameState);
// the canvas UI is tested by playing it.

// The game files are browser scripts that share globals, so load them into the global scope
// in the same order index.html does.
Object.assign(globalThis, require('../js/cards.js'));
Object.assign(globalThis, require('../js/pokerRank.js'));
Object.assign(globalThis, require('../js/gameState.js'));
Object.assign(globalThis, require('../js/bots.js'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.log(`FAIL: ${name}\n   ${error.message}`);
  }
}
function assertEqual(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} expected ${e}, got ${a}`);
}

// Card shorthand: c('KH') = King of hearts, c('10S'), c('AD').
const SUIT_LETTERS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LETTERS = { J: 11, Q: 12, K: 13, A: 14 };
function c(code) {
  const suit = SUIT_LETTERS[code.slice(-1)];
  const rankText = code.slice(0, -1);
  return { rank: RANK_LETTERS[rankText] || Number(rankText), suit, faceUp: false };
}
function cards(codes) {
  return codes.split(' ').map(c);
}

// A Game whose deck is exactly `codes` (in deal order), padded with filler so it never runs out.
// Filler is 2s (low value) so it won't cause surprise busts.
function gameWithDeck(seatCount, codes) {
  const seats = Array.from({ length: seatCount }, (_, i) => ({ name: `P${i}`, isBot: false }));
  const makeDeck = () => [...cards(codes), ...Array.from({ length: 40 }, () => c('2C'))];
  const game = new Game(seats, { createShuffledDeck: makeDeck });
  game.startRound();
  return game;
}

// ---------- cards.js ----------

test('deck has 52 unique cards', () => {
  const deck = createDeck();
  assertEqual(deck.length, 52);
  assertEqual(new Set(deck.map(cardLabel)).size, 52);
});

test('face cards are worth 10', () => assertEqual(handTotal(cards('KH QS JD')), 30));
test('ace is 11 when safe', () => assertEqual(handTotal(cards('AH 9S')), 20));
test('ace drops to 1 to avoid bust', () => assertEqual(handTotal(cards('AH 9S 5D')), 15));
test('two aces = 12', () => assertEqual(handTotal(cards('AH AS')), 12));
test('22 is bust, 21 is not', () => {
  assertEqual(isBust(cards('KH QS 2D')), true);
  assertEqual(isBust(cards('KH QS AD')), false);
});

// ---------- pokerRank.js ----------

test('pair', () => assertEqual(evaluateHand(cards('KH KS')).name, 'Pair'));
test('two pair (4 cards)', () => assertEqual(evaluateHand(cards('3H 3S 2D 2C')).name, 'Two Pair'));
test('four of a kind (4 cards)', () => assertEqual(evaluateHand(cards('2H 2S 2D 2C')).name, 'Four of a Kind'));
test('5-card straight', () => assertEqual(evaluateHand(cards('2H 3S 4D 5C 6H')).name, 'Straight'));
test('wheel straight A-2-3-4-5', () => {
  const hand = evaluateHand(cards('AH 2S 3D 4C 5H'));
  assertEqual(hand.name, 'Straight');
  assertEqual(hand.tiebreakRanks, [5]);
});
test('4-card run is NOT a straight', () => assertEqual(evaluateHand(cards('2H 3S 4D 5C')).name, 'High Card'));
test('4 same-suit cards are NOT a flush', () => assertEqual(evaluateHand(cards('2H 5H 9H KH')).name, 'High Card'));
test('5-card flush', () => assertEqual(evaluateHand(cards('2H 5H 9H 3H 4H')).name, 'Flush'));
test('full house', () => assertEqual(evaluateHand(cards('3H 3S 3D 2C 2H')).name, 'Full House'));
test('straight flush', () => assertEqual(evaluateHand(cards('2H 3H 4H 5H 6H')).name, 'Straight Flush'));

test('higher pair beats lower pair', () => {
  const result = compareHands(evaluateHand(cards('KH KS')), evaluateHand(cards('QH QS 4D')));
  assertEqual(result > 0, true);
});
test('same pair: higher kicker wins', () => {
  const result = compareHands(evaluateHand(cards('5H 5S 9D')), evaluateHand(cards('5D 5C 8H')));
  assertEqual(result > 0, true);
});
test('same pair, one hand has an extra kicker: extra kicker wins', () => {
  const result = compareHands(evaluateHand(cards('5H 5S 2D')), evaluateHand(cards('5D 5C')));
  assertEqual(result > 0, true);
});
test('identical ranks tie', () => {
  assertEqual(compareHands(evaluateHand(cards('9H 9S')), evaluateHand(cards('9D 9C'))), 0);
});

// ---------- gameState.js ----------

test('start of round: antes collected, 2 face-down cards each, seat 1 acts first', () => {
  const game = gameWithDeck(3, '');
  assertEqual(game.dealerIndex, 0);
  assertEqual(game.pot, 30);
  assertEqual(game.players.map(p => p.chips), [90, 90, 90]);
  assertEqual(game.players.map(p => p.hand.length), [2, 2, 2]);
  assertEqual(game.players.every(p => p.hand.every(card => !card.faceUp)), true);
  assertEqual(game.currentPlayerIndex, 1);
});

test('draw adds a face-up card and passes the turn', () => {
  const game = gameWithDeck(2, '');
  game.draw();
  assertEqual(game.players[1].hand.length, 3);
  assertEqual(game.players[1].hand[2].faceUp, true);
  assertEqual(game.currentPlayerIndex, 0);
});

test('cannot steal a face-down card', () => {
  const game = gameWithDeck(2, '');
  const result = game.steal(0, 0);
  assertEqual(result.ok, false);
});

test('steal moves the card and the victim draws a face-up replacement', () => {
  // Deal order with dealer 0 in a 2-player game: seat 1 gets 2 cards, then seat 0 gets 2.
  // Seat 1 draws 7H. Seat 0 steals it, so seat 1 (the victim) draws the replacement 4D.
  const game = gameWithDeck(2, '2H 3H 2S 3S 7H 4D');
  game.draw(); // seat 1 draws 7H
  const result = game.steal(1, 2);
  assertEqual(result.ok, true);
  assertEqual(cardLabel(game.players[0].hand[2]), '7♥');
  assertEqual(game.players[0].hand[2].faceUp, true);
  assertEqual(cardLabel(game.players[1].hand[2]), '4♦');
  assertEqual(game.players[1].hand[2].faceUp, true);
});

test('replacement card can bust the victim', () => {
  // Seat 1: KH QH (20), then draws AS (ace counts as 1 -> 21).
  // Seat 0 steals the AS; seat 1's replacement 5D makes 25 -> bust.
  const game = gameWithDeck(2, 'KH QH 2S 3S AS 5D');
  game.draw();
  assertEqual(handTotal(game.players[1].hand), 21);
  game.steal(1, 2);
  assertEqual(game.players[1].status, PLAYER_STATUS.BUSTED);
});

test('busting skips your remaining turns', () => {
  const game = gameWithDeck(3, 'KH QH 2S 3S 2D 3D 5C');
  game.draw(); // seat 1: K Q 5 = 25, busts
  assertEqual(game.players[1].status, PLAYER_STATUS.BUSTED);
  game.stand(); // seat 2
  game.stand(); // seat 0
  assertEqual(game.currentPlayerIndex, 2); // seat 1 skipped in turn 2
  assertEqual(game.turnNumber, 2);
});

test('5 cards: can only stand', () => {
  const game = gameWithDeck(2, '');
  game.players[1].hand.push(c('2D'), c('2H'), c('2S'));
  assertEqual(game.canDraw(1), false);
  assertEqual(game.draw().ok, false);
  assertEqual(game.stand().ok, true);
});

test('after 4 turns: showdown, best hand wins pot', () => {
  // seat 1: KH KS (pair of kings). seat 0: 9H 4S.
  const game = gameWithDeck(2, 'KH KS 9H 4S');
  for (let i = 0; i < 8; i++) game.stand();
  assertEqual(game.phase, GAME_PHASE.ROUND_OVER);
  assertEqual(game.lastRoundResult.winners, [1]);
  assertEqual(game.lastRoundResult.handName, 'Pair');
  assertEqual(game.players[1].chips, 110);
  assertEqual(game.players[0].chips, 90);
});

test('tie splits pot; odd chip goes to lowest total', () => {
  // Seat 0 has only 5 chips, so it antes 5 and the pot is an odd 25.
  const seats = [0, 1, 2].map(i => ({ name: `P${i}`, isBot: false }));
  const deck = cards('9H 9S 9D 9C 2H 3H');
  const game = new Game(seats, { createShuffledDeck: () => deck.map(card => ({ ...card })) });
  game.players[0].chips = 5;
  game.startRound(); // dealer 0; order 1,2,0. seat1: 9H 9S, seat2: 9D 9C, seat0: 2H 3H
  assertEqual(game.pot, 25);
  for (let i = 0; i < 12; i++) game.stand();
  assertEqual(game.lastRoundResult.winners.sort(), [1, 2]);
  // Both total 18; equal totals -> lowest seat index (1) gets the extra chip.
  assertEqual(game.players[1].chips, 90 + 13);
  assertEqual(game.players[2].chips, 90 + 12);
});

test('everyone busts: pot carries over into next round', () => {
  const game = gameWithDeck(2, 'KH QH KS QS 5C 5D');
  game.draw(); // seat 1 busts
  game.draw(); // seat 0 busts -> immediate showdown
  assertEqual(game.phase, GAME_PHASE.ROUND_OVER);
  assertEqual(game.lastRoundResult.carriedOver, true);
  assertEqual(game.pot, 20);
  game.startNextRound();
  assertEqual(game.pot, 40);
  assertEqual(game.dealerIndex, 1); // button moved
});

test('ante doubles every 3 rounds', () => {
  const game = gameWithDeck(2, '');
  const antes = [];
  for (let round = 1; round <= 7; round++) {
    game.roundNumber = round;
    antes.push(game.getCurrentAnte());
  }
  assertEqual(antes, [10, 10, 10, 20, 20, 20, 40]);
});

test('player with 0 chips is eliminated and game ends', () => {
  const game = gameWithDeck(2, 'KH KS 9H 4S');
  game.players[0].chips = 0; // seat 0 anted their last 10
  for (let i = 0; i < 8; i++) game.stand();
  assertEqual(game.players[0].status, PLAYER_STATUS.ELIMINATED);
  assertEqual(game.phase, GAME_PHASE.GAME_OVER);
  assertEqual(game.gameWinnerIndex, 1);
});

// ---------- bots.js ----------
// In a 2-seat game the button starts on seat 0, so seat 1 is dealt first and acts first.
// In a 3-seat game the deal and turn order is seat 1, seat 2, seat 0.

test('bot steals a face-up card that upgrades its category (high card -> pair)', () => {
  // seat 1: KH 5S, seat 0: 9H 4S. Seat 1 draws 4D, then bot seat 0 can pair its 4.
  const game = gameWithDeck(2, 'KH 5S 9H 4S 4D');
  game.draw();
  assertEqual(chooseBotAction(game, 0), { type: 'steal', victimIndex: 1, cardIndex: 2 });
});

test('bot does not steal a card that would bust it', () => {
  // Bot seat 0 holds KH QS (20). Stealing KD would make a pair but total 30.
  const game = gameWithDeck(2, 'KC 5S KH QS KD');
  game.draw();
  assertEqual(chooseBotAction(game, 0), { type: 'stand' });
});

test('bot does not steal for a better kicker alone; falls back to drawing', () => {
  // Bot seat 0 holds a pair of 4s (8). Stealing 2D adds only a kicker, so it draws instead.
  const game = gameWithDeck(2, '3C 5S 4H 4S 2D');
  game.draw();
  assertEqual(chooseBotAction(game, 0), { type: 'draw' });
});

test('bot picks the steal that gives the best resulting hand, not the first one', () => {
  // Bot seat 0 holds 7H 2S. Seat 1 shows 2D (pair of 2s), seat 2 shows 7D (pair of 7s).
  const game = gameWithDeck(3, 'KC 3S QC 4S 7H 2S 2D 7D');
  game.draw();
  game.draw();
  assertEqual(chooseBotAction(game, 0), { type: 'steal', victimIndex: 2, cardIndex: 2 });
});

test('bot with 5 cards never steals', () => {
  // Bot seat 0 ends up with 2H 3S AD 5C 7D (high card, 18). Stealing 2D would pair it at 20,
  // so only the 5-card limit stops the steal.
  const game = gameWithDeck(2, 'KH 5S 2H 3S 2D');
  game.draw();
  game.players[0].hand.push(...cards('AD 5C 7D'));
  assertEqual(findBestSteal(game, 0), null);
  assertEqual(chooseBotAction(game, 0), { type: 'stand' });
});

test('all-bot games run to game over with legal moves, steals happen, chips are conserved', () => {
  let steals = 0;
  for (let g = 0; g < 200; g++) {
    const seatCount = 2 + (g % 3);
    const seats = Array.from({ length: seatCount }, (_, i) => ({ name: `Bot ${i}`, isBot: true }));
    const game = new Game(seats);
    game.startRound();
    for (let step = 0; step < 10000 && game.phase !== GAME_PHASE.GAME_OVER; step++) {
      if (game.phase === GAME_PHASE.ROUND_OVER) {
        const chipsInPlay = game.players.reduce((sum, p) => sum + p.chips, 0) + game.pot;
        assertEqual(chipsInPlay, STARTING_CHIPS * seatCount, 'chips in play');
        game.startNextRound();
        continue;
      }
      const action = chooseBotAction(game, game.currentPlayerIndex);
      if (action.type === 'steal') steals++;
      const result = action.type === 'draw' ? game.draw()
        : action.type === 'steal' ? game.steal(action.victimIndex, action.cardIndex)
        : game.stand();
      assertEqual(result.ok, true, `bot ${action.type} was legal`);
    }
    assertEqual(game.phase, GAME_PHASE.GAME_OVER, 'game finished');
  }
  if (steals === 0) throw new Error('bots never stole in 200 games');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
