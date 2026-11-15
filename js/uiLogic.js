// uiLogic.js — pure UI decisions pulled out of main.js so they can be tested without a
// browser. Every function here takes explicit arguments and returns a value: no DOM, canvas,
// timers, performance.now() or global game state. main.js gathers the inputs from the live
// game and does all the rendering, event handling and animation scheduling.
//
// Plain script (not an ES module) so index.html still works from file://. Load it after
// gameState.js and before main.js.

// Whether the hot-seat "Pass to Player N" cover should be up (SPEC criteria 19–21).
// Needed only on a human's turn during play, when 2+ humans are still in the game, the cover
// for this exact turn hasn't been dismissed yet, and no steal is mid-slide (everyone gets to
// watch the steal first; the cover comes up right after).
function shouldShowPassCover({
  isTurnsPhase,
  isCurrentPlayerBot,
  humanSeatsInGameCount,
  currentTurnKey,
  dismissedTurnKey,
  isStealAnimating,
}) {
  return isTurnsPhase && !isCurrentPlayerBot
    && humanSeatsInGameCount >= 1
    && dismissedTurnKey !== currentTurnKey
    && !isStealAnimating;
}

// Seat whose hidden cards are shown face-up during play, or -1 for nobody:
//  - exactly one human in the game: always that human (bots don't look at the screen)
//  - several humans: whoever's turn it is, if human, the cover is down and no steal is
//    animating. Otherwise nobody.
function chooseViewerIndex({
  humanSeatsInGame,
  currentPlayerIndex,
  isTurnsPhase,
  isCurrentPlayerBot,
  isPassCoverShown,
  isStealAnimating,
}) {
  if (humanSeatsInGame.length === 1) return humanSeatsInGame[0];
  if (isTurnsPhase && !isCurrentPlayerBot && !isPassCoverShown && !isStealAnimating) {
    return currentPlayerIndex;
  }
  return -1;
}

// Where the stolen card is drawn mid-slide (SPEC criterion 23): ease in-out from (fromX, fromY)
// to (toX, toY). Progress is capped at 1 so a late frame lands exactly on the target.
function computeStealCardPosition({ fromX, fromY, toX, toY, elapsedMs, durationMs }) {
  const progress = Math.min(1, elapsedMs / durationMs);
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2; // ease in-out
  return {
    x: fromX + (toX - fromX) * eased,
    y: fromY + (toY - fromY) * eased,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { shouldShowPassCover, chooseViewerIndex, computeStealCardPosition };
}
