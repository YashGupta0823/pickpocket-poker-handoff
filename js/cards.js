// cards.js — the deck and the BLACKJACK side of the rules (card values, hand totals).
// Poker ranking lives in pokerRank.js. No game state or drawing code in this file.
//
// A card is a plain object: { rank, suit, faceUp }
//   rank:   2..14, where 11 = J, 12 = Q, 13 = K, 14 = A (Ace is 14 so poker comparisons are simple)
//   suit:   one of SUITS
//   faceUp: true if every player can see it (and therefore steal it). Dealt cards start
//           face-down; drawn cards, stolen cards and replacements are face-up. See SPEC.md.

const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const BUST_LIMIT = 21;

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit, faceUp: false });
    }
  }
  return deck;
}

// Fisher–Yates shuffle, in place. Returns the same array for convenience.
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Blackjack value of a single card, counting an Ace as 11.
// handTotal() is what demotes Aces to 1 when needed — don't use this alone for totals.
function blackjackValue(card) {
  if (card.rank === 14) return 11;
  if (card.rank >= 11) return 10;
  return card.rank;
}

// Total of a hand using the blackjack Ace rule: every Ace starts at 11, and we demote
// Aces to 1 one at a time while the total is over 21.
function handTotal(cards) {
  let total = 0;
  let acesCountedAsEleven = 0;
  for (const card of cards) {
    total += blackjackValue(card);
    if (card.rank === 14) acesCountedAsEleven++;
  }
  while (total > BUST_LIMIT && acesCountedAsEleven > 0) {
    total -= 10;
    acesCountedAsEleven--;
  }
  return total;
}

function isBust(cards) {
  return handTotal(cards) > BUST_LIMIT;
}

// Human-readable label, e.g. "10♥", "A♠". Used by the message log and the renderer.
function cardLabel(card) {
  return (RANK_LABELS[card.rank] || String(card.rank)) + card.suit;
}

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

// Lets tests/run-tests.js load this file in Node. Browsers ignore this block
// (the game loads files with plain <script> tags so it works from file:// with no server).
if (typeof module !== 'undefined') {
  module.exports = { SUITS, BUST_LIMIT, createDeck, shuffleDeck, blackjackValue, handTotal, isBust, cardLabel, isRedSuit };
}
