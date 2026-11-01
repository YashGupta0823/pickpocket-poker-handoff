// bots.js — decides what a bot does on its turn. Pure decision logic: it returns an action
// object and does NOT change the game. main.js applies the action and handles the 1-second delay.
//
// Returns one of:
//   { type: 'draw' }
//   { type: 'stand' }
//   { type: 'steal', victimIndex, cardIndex }
//
// SPEC.md "Bots", in order:
//   1. Steal if some face-up card would improve the bot's poker rank without busting it
//      (choose the steal that gives the best resulting hand).
//   2. Otherwise draw if total <= 15 and the bot holds fewer than 5 cards.
//   3. Otherwise stand.

const BOT_DRAW_THRESHOLD = 15; // draw while total is at or below this

function chooseBotAction(game, botSeat) {
  const bot = game.players[botSeat];

  const bestSteal = findBestSteal(game, botSeat);
  if (bestSteal) {
    return { type: 'steal', victimIndex: bestSteal.victimIndex, cardIndex: bestSteal.cardIndex };
  }

  if (game.canDraw(botSeat) && handTotal(bot.hand) <= BOT_DRAW_THRESHOLD) {
    return { type: 'draw' };
  }
  return { type: 'stand' };
}

// Step 1: returns the stealable option ({ victimIndex, cardIndex, card }) that gives the best
// resulting hand, among those that raise the hand CATEGORY without busting. null if none do.
// DECIDED BY THE AUTHOR: "improve" means the hand CATEGORY goes up (e.g. high card -> pair,
// pair -> two pair). Do NOT use compareHands() for that check: any extra card adds a kicker,
// which compareHands counts as better, and bots would steal nearly every turn. (compareHands IS
// the right tool for choosing the BEST of several qualifying steals.)
function findBestSteal(game, botSeat) {
  if (!game.canSteal(botSeat)) return null;
  const hand = game.players[botSeat].hand;
  const currentCategory = evaluateHand(hand).category;

  let bestOption = null;
  let bestEvaluation = null;
  for (const option of game.getStealableCards(botSeat)) {
    const newHand = [...hand, option.card];
    if (isBust(newHand)) continue;
    const evaluation = evaluateHand(newHand);
    if (evaluation.category <= currentCategory) continue;
    // Strictly better only, so equal options go to the first one found (seat order).
    if (!bestOption || compareHands(evaluation, bestEvaluation) > 0) {
      bestOption = option;
      bestEvaluation = evaluation;
    }
  }
  return bestOption;
}

if (typeof module !== 'undefined') {
  module.exports = { chooseBotAction, findBestSteal, BOT_DRAW_THRESHOLD };
}
