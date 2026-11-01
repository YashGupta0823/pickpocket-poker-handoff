// pokerRank.js — the POKER side of the rules: naming and comparing hands of 2–5 cards.
// Pure functions, no game state. Blackjack totals live in cards.js.
//
// Key house rule (SPEC.md, "Poker ranking"): straights, flushes, full houses and straight
// flushes need EXACTLY 5 cards. Hands with 2–4 cards can only be high card, pair, two pair,
// three of a kind or four of a kind.

// Higher number = better hand. Order matters: compareHands() relies on it.
const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
};

const CATEGORY_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

const CARDS_NEEDED_FOR_FIVE_CARD_COMBOS = 5;

// Returns { category, tiebreakRanks, name }.
//   category:      a HAND_CATEGORY value
//   tiebreakRanks: ranks to compare, most important first. For a pair of kings with 7 and 3
//                  this is [13, 7, 3]; for a full house it is [tripsRank, pairRank].
//   name:          display string like "Two Pair"
function evaluateHand(cards) {
  // Group cards by rank, then sort groups by size (quads before trips before pairs),
  // breaking ties by higher rank. This ordering *is* the poker tiebreak order.
  const countByRank = new Map();
  for (const card of cards) {
    countByRank.set(card.rank, (countByRank.get(card.rank) || 0) + 1);
  }
  const groups = [...countByRank.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const groupRanks = groups.map(g => g.rank);
  const groupSizes = groups.map(g => g.count);

  const hasFiveCards = cards.length === CARDS_NEEDED_FOR_FIVE_CARD_COMBOS;
  const isFlush = hasFiveCards && cards.every(c => c.suit === cards[0].suit);
  const straightHighRank = hasFiveCards ? findStraightHighRank(cards) : null;

  let category;
  let tiebreakRanks = groupRanks;

  if (isFlush && straightHighRank !== null) {
    category = HAND_CATEGORY.STRAIGHT_FLUSH;
    tiebreakRanks = [straightHighRank];
  } else if (groupSizes[0] === 4) {
    category = HAND_CATEGORY.FOUR_OF_A_KIND;
  } else if (groupSizes[0] === 3 && groupSizes[1] === 2) {
    category = HAND_CATEGORY.FULL_HOUSE; // only possible with exactly 5 cards
  } else if (isFlush) {
    category = HAND_CATEGORY.FLUSH;
  } else if (straightHighRank !== null) {
    category = HAND_CATEGORY.STRAIGHT;
    tiebreakRanks = [straightHighRank];
  } else if (groupSizes[0] === 3) {
    category = HAND_CATEGORY.THREE_OF_A_KIND;
  } else if (groupSizes[0] === 2 && groupSizes[1] === 2) {
    category = HAND_CATEGORY.TWO_PAIR;
  } else if (groupSizes[0] === 2) {
    category = HAND_CATEGORY.PAIR;
  } else {
    category = HAND_CATEGORY.HIGH_CARD;
  }

  return { category, tiebreakRanks, name: CATEGORY_NAMES[category] };
}

// For a 5-card hand: returns the high rank of the straight, or null if it isn't one.
// A-2-3-4-5 (the "wheel") counts, with 5 as its high card.
function findStraightHighRank(cards) {
  const ranks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== 5) return null;
  if (ranks[4] - ranks[0] === 4) return ranks[4];
  const isWheel = ranks.join(',') === '2,3,4,5,14';
  return isWheel ? 5 : null;
}

// Compares two evaluated hands (results of evaluateHand).
// Returns > 0 if handA wins, < 0 if handB wins, 0 for an exact tie.
// If one hand runs out of tiebreak ranks first, the hand with the extra kicker wins
// (SPEC.md: "If one hand runs out of kickers first, the hand with the extra kicker wins").
function compareHands(handA, handB) {
  if (handA.category !== handB.category) return handA.category - handB.category;
  const longest = Math.max(handA.tiebreakRanks.length, handB.tiebreakRanks.length);
  for (let i = 0; i < longest; i++) {
    const rankA = handA.tiebreakRanks[i];
    const rankB = handB.tiebreakRanks[i];
    if (rankA === undefined) return -1;
    if (rankB === undefined) return 1;
    if (rankA !== rankB) return rankA - rankB;
  }
  return 0;
}

if (typeof module !== 'undefined') {
  module.exports = { HAND_CATEGORY, CATEGORY_NAMES, evaluateHand, compareHands };
}
