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

  // TODO (P2, SPEC criterion 16): step 1, stealing, is NOT implemented yet. Bots never
  // steal right now. Suggested approach:
  //   - for each option in game.getStealableCards(botSeat) (only if game.canSteal(botSeat)):
  //       const newHand = [...bot.hand, option.card];
  //       skip if isBust(newHand)
  //       keep it only if evaluateHand(newHand).category > evaluateHand(bot.hand).category
  //   - pick the option whose evaluateHand(newHand) is best (use compareHands to sort)
  //   - return { type: 'steal', victimIndex: option.victimIndex, cardIndex: option.cardIndex }
  // DECIDED BY THE AUTHOR: "improve" means the hand CATEGORY goes up (e.g. high card -> pair,
  // pair -> two pair). Compare evaluateHand(newHand).category > evaluateHand(bot.hand).category.
  // Do NOT use compareHands() for this check: any extra card adds a kicker, which compareHands
  // counts as better, and bots would steal nearly every turn. (compareHands IS the right tool
  // for choosing the BEST of several qualifying steals.)

  if (game.canDraw(botSeat) && handTotal(bot.hand) <= BOT_DRAW_THRESHOLD) {
    return { type: 'draw' };
  }
  return { type: 'stand' };
}

if (typeof module !== 'undefined') {
  module.exports = { chooseBotAction, BOT_DRAW_THRESHOLD };
}
