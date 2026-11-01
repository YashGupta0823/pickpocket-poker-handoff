// main.js — the UI controller. Wires the setup screen, buttons and canvas clicks to the Game,
// re-renders after every change, and runs bot turns on a timer.
//
// Flow: setup screen -> startGame() -> [player acts -> refresh()] ... -> game over -> restart.
// All rule decisions live in gameState.js; this file should only translate input into
// Game method calls and Game state into what's on screen.

const BOT_TURN_DELAY_MS = 1000; // SPEC: bots wait ~1 second so humans can follow along
const STEAL_ANIMATION_MS = 500;  // SPEC criterion 23: long enough to follow, short enough not to drag

const elements = {
  setupScreen: document.getElementById('setup-screen'),
  seatCount: document.getElementById('seat-count'),
  seatTypes: document.getElementById('seat-types'),
  startButton: document.getElementById('start-button'),
  gameScreen: document.getElementById('game-screen'),
  canvas: document.getElementById('table-canvas'),
  statusMessage: document.getElementById('status-message'),
  drawButton: document.getElementById('draw-button'),
  stealButton: document.getElementById('steal-button'),
  standButton: document.getElementById('stand-button'),
  nextRoundButton: document.getElementById('next-round-button'),
  messageLog: document.getElementById('message-log'),
  gameOverScreen: document.getElementById('game-over-screen'),
  gameOverMessage: document.getElementById('game-over-message'),
  restartButton: document.getElementById('restart-button'),
  passCover: document.getElementById('pass-cover'),
  passCoverMessage: document.getElementById('pass-cover-message'),
  passCoverButton: document.getElementById('pass-cover-button'),
};
const canvasContext = elements.canvas.getContext('2d');

let game = null;
let isChoosingStealTarget = false; // true after clicking Steal, until a card is picked or Steal is clicked again
let pendingBotTimer = null;
// The turn ("round:turn:seat") whose pass cover was last dismissed with Continue. Keyed per
// turn, not per seat, so the cover comes back for every human turn (SPEC: "before each
// human's turn"), even if the same human ends up acting twice in a row.
let passCoverDismissedTurnKey = null;
// The steal slide in progress, or null: { card, thiefIndex, fromX, fromY, startTime }.
// The Game has already moved the card; this only animates it. While it runs, all input, bot
// turns, the pass cover and the game-over screen wait, so nothing acts on a card mid-flight.
let stealAnimation = null;

// ---------- Setup screen ----------

function buildSeatTypeSelectors() {
  const count = Number(elements.seatCount.value);
  elements.seatTypes.innerHTML = '';
  for (let seat = 0; seat < count; seat++) {
    const label = document.createElement('label');
    // Default: seat 1 is you, the rest are bots (the most common way to play).
    const defaultType = seat === 0 ? 'human' : 'bot';
    label.innerHTML = `Seat ${seat + 1}
      <select data-seat="${seat}">
        <option value="human" ${defaultType === 'human' ? 'selected' : ''}>Human</option>
        <option value="bot" ${defaultType === 'bot' ? 'selected' : ''}>Bot</option>
      </select>`;
    elements.seatTypes.appendChild(label);
  }
}

function readSeatConfigs() {
  let humanCount = 0;
  let botCount = 0;
  return [...elements.seatTypes.querySelectorAll('select')].map(select => {
    const isBot = select.value === 'bot';
    const name = isBot ? `Bot ${++botCount}` : `Player ${++humanCount}`;
    return { name, isBot };
  });
}

function startGame() {
  clearTimeout(pendingBotTimer);
  pendingBotTimer = null;
  game = new Game(readSeatConfigs());
  game.startRound();
  isChoosingStealTarget = false;
  passCoverDismissedTurnKey = null; // a new game can repeat the last game's turn keys
  stealAnimation = null;
  elements.setupScreen.classList.add('hidden');
  elements.gameOverScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  refresh();
}

// ---------- Player input ----------

// True when a human may act right now. False while the pass cover is up or a steal is
// animating, so the buttons and canvas ignore input until then.
function isHumanTurn() {
  return game && game.phase === GAME_PHASE.TURNS && !game.getCurrentPlayer().isBot
    && !isPassCoverNeeded() && !stealAnimation;
}

// ---------- Hot-seat privacy (SPEC criteria 19–21) ----------

// Human seats still in the game. Once only one human is left (the others were eliminated),
// the table behaves like a 1-human game: no cover, and that human always sees their cards.
function getHumanSeatsInGame() {
  return game.players
    .map((p, i) => (!p.isBot && p.status !== PLAYER_STATUS.ELIMINATED ? i : -1))
    .filter(i => i >= 0);
}

function getCurrentTurnKey() {
  return `${game.roundNumber}:${game.turnNumber}:${game.currentPlayerIndex}`;
}

function isPassCoverNeeded() {
  return Boolean(game) && game.phase === GAME_PHASE.TURNS && !game.getCurrentPlayer().isBot
    && getHumanSeatsInGame().length >= 2
    && passCoverDismissedTurnKey !== getCurrentTurnKey()
    && !stealAnimation; // let everyone watch the steal first; the cover comes up right after
}

function onPassCoverContinueClicked() {
  if (!isPassCoverNeeded()) return;
  passCoverDismissedTurnKey = getCurrentTurnKey();
  refresh();
}

function onDrawClicked() {
  if (!isHumanTurn()) return;
  isChoosingStealTarget = false;
  showResult(game.draw());
}

function onStealClicked() {
  if (!isHumanTurn()) return;
  isChoosingStealTarget = !isChoosingStealTarget; // second click cancels
  refresh();
}

function onStandClicked() {
  if (!isHumanTurn()) return;
  isChoosingStealTarget = false;
  showResult(game.stand());
}

function onCanvasClicked(event) {
  if (!isHumanTurn() || !isChoosingStealTarget) return;
  // The canvas may be scaled by CSS, so convert from screen pixels to canvas pixels.
  const rect = elements.canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (elements.canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (elements.canvas.height / rect.height);
  const clicked = findCardAt(x, y);
  if (!clicked) return;
  const result = stealWithAnimation(clicked.playerIndex, clicked.cardIndex);
  if (result.ok) isChoosingStealTarget = false;
  showResult(result);
}

function onNextRoundClicked() {
  if (stealAnimation) return;
  game.startNextRound();
  refresh();
}

// Re-renders; if the action was rejected, shows why instead of the normal status line.
function showResult(result) {
  refresh();
  if (!result.ok) elements.statusMessage.textContent = result.reason;
}

// ---------- Bots ----------

function scheduleBotTurnIfNeeded() {
  if (pendingBotTimer || stealAnimation || !game || game.phase !== GAME_PHASE.TURNS) return;
  if (!game.getCurrentPlayer().isBot) return;
  pendingBotTimer = setTimeout(() => {
    pendingBotTimer = null;
    runBotTurn();
    refresh();
  }, BOT_TURN_DELAY_MS);
}

function runBotTurn() {
  const action = chooseBotAction(game, game.currentPlayerIndex);
  let result;
  if (action.type === 'draw') result = game.draw();
  else if (action.type === 'steal') result = stealWithAnimation(action.victimIndex, action.cardIndex);
  else result = game.stand();
  // A bot choosing an illegal move would freeze the game, so fall back to standing.
  if (!result.ok) game.stand();
}

// ---------- Steal animation (SPEC criterion 23) ----------

// Used for every steal, human or bot. Applies the steal to the Game right away (so the rules
// and log are unchanged), then slides the card from where it was last drawn to its slot in
// the thief's hand. If the card was never drawn (no hitbox), it just appears, as before.
function stealWithAnimation(victimIndex, cardIndex) {
  const fromBox = cardHitboxes.find(box => box.playerIndex === victimIndex && box.cardIndex === cardIndex);
  const card = game.players[victimIndex] && game.players[victimIndex].hand[cardIndex];
  const thiefIndex = game.currentPlayerIndex;
  const result = game.steal(victimIndex, cardIndex);
  if (result.ok && fromBox) {
    const animation = { card, thiefIndex, fromX: fromBox.x, fromY: fromBox.y, startTime: performance.now() };
    stealAnimation = animation;
    requestAnimationFrame(onStealAnimationFrame);
    // Browsers pause requestAnimationFrame in background tabs. Without this backstop, a bot
    // steal in a hidden tab would leave the game waiting on the animation until you came back.
    setTimeout(() => {
      if (stealAnimation === animation) finishStealAnimation();
    }, STEAL_ANIMATION_MS + 250);
  }
  return result;
}

function onStealAnimationFrame() {
  if (!stealAnimation) return; // finished by the backstop, or a new game was started
  if (performance.now() - stealAnimation.startTime >= STEAL_ANIMATION_MS) {
    finishStealAnimation();
    return;
  }
  renderTableFrame();
  requestAnimationFrame(onStealAnimationFrame);
}

function finishStealAnimation() {
  stealAnimation = null;
  refresh(); // final frame, plus whatever was waiting: pass cover, bot turn, game over
}

// Draws the table, with the stolen card mid-slide if a steal is animating. The card's own slot
// in the thief's hand is left empty until it lands, so it is never drawn twice.
function renderTableFrame() {
  const view = { viewerIndex: getViewerIndex(), stealMode: isChoosingStealTarget };
  if (!stealAnimation) {
    renderTable(canvasContext, game, view);
    return;
  }
  const { card, thiefIndex, fromX, fromY, startTime } = stealAnimation;
  const cardIndex = game.players[thiefIndex].hand.indexOf(card);
  view.cardInFlight = { playerIndex: thiefIndex, cardIndex };
  renderTable(canvasContext, game, view);

  const target = getCardSlotPosition(game, thiefIndex, cardIndex);
  const progress = Math.min(1, (performance.now() - startTime) / STEAL_ANIMATION_MS);
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2; // ease in-out
  drawCardInFlight(
    canvasContext, card,
    fromX + (target.x - fromX) * eased,
    fromY + (target.y - fromY) * eased,
  );
}

// ---------- Drawing the UI from game state ----------

// Whose hidden cards are shown face-up during play:
//  - exactly one human: always that human (bots don't look at the screen)
//  - several humans: whoever's turn it is, if human, once they've dismissed the pass cover.
//    Otherwise nobody (isHumanTurn() is false while the cover is up).
function getViewerIndex() {
  const humanSeats = getHumanSeatsInGame();
  if (humanSeats.length === 1) return humanSeats[0];
  if (isHumanTurn()) return game.currentPlayerIndex;
  return -1;
}

function refresh() {
  renderTableFrame();
  updateControls();
  updateStatusMessage();
  updateMessageLog();
  const showPassCover = isPassCoverNeeded();
  elements.passCover.classList.toggle('hidden', !showPassCover);
  if (showPassCover) elements.passCoverMessage.textContent = `Pass to ${game.getCurrentPlayer().name}`;
  if (game.phase === GAME_PHASE.GAME_OVER && !stealAnimation) {
    elements.gameOverMessage.textContent = `${game.players[game.gameWinnerIndex].name} wins the game!`;
    elements.gameOverScreen.classList.remove('hidden');
  }
  scheduleBotTurnIfNeeded();
}

function updateControls() {
  const humanTurn = isHumanTurn();
  const seat = game.currentPlayerIndex;
  elements.drawButton.disabled = !humanTurn || !game.canDraw(seat);
  elements.stealButton.disabled = !humanTurn || !game.canSteal(seat);
  elements.standButton.disabled = !humanTurn;
  elements.stealButton.classList.toggle('active', isChoosingStealTarget);
  elements.nextRoundButton.classList.toggle('hidden', game.phase !== GAME_PHASE.ROUND_OVER || Boolean(stealAnimation));
}

function updateStatusMessage() {
  let message;
  if (game.phase === GAME_PHASE.TURNS) {
    const player = game.getCurrentPlayer();
    if (player.isBot) message = `${player.name} is thinking...`;
    else if (isChoosingStealTarget) message = `${player.name}: click a highlighted face-up card to steal it (click Steal again to cancel).`;
    else message = `${player.name}, your move: Draw, Steal or Stand.`;
  } else if (game.phase === GAME_PHASE.ROUND_OVER) {
    message = game.log[game.log.length - 1];
  } else {
    message = 'Game over.';
  }
  elements.statusMessage.textContent = message;
}

function updateMessageLog() {
  // Newest at the top. Rebuilt from game.log every time; cheap at this size.
  elements.messageLog.innerHTML = '';
  for (const line of [...game.log].reverse().slice(0, 40)) {
    const item = document.createElement('li');
    item.textContent = line;
    elements.messageLog.appendChild(item);
  }
}

// ---------- Wire up ----------

elements.seatCount.addEventListener('change', buildSeatTypeSelectors);
elements.startButton.addEventListener('click', startGame);
elements.drawButton.addEventListener('click', onDrawClicked);
elements.stealButton.addEventListener('click', onStealClicked);
elements.standButton.addEventListener('click', onStandClicked);
elements.nextRoundButton.addEventListener('click', onNextRoundClicked);
elements.canvas.addEventListener('click', onCanvasClicked);
elements.passCoverButton.addEventListener('click', onPassCoverContinueClicked);
elements.restartButton.addEventListener('click', () => {
  elements.gameOverScreen.classList.add('hidden');
  elements.gameScreen.classList.add('hidden');
  elements.setupScreen.classList.remove('hidden');
});
buildSeatTypeSelectors();
