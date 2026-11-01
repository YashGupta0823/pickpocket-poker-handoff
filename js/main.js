// main.js — the UI controller. Wires the setup screen, buttons and canvas clicks to the Game,
// re-renders after every change, and runs bot turns on a timer.
//
// Flow: setup screen -> startGame() -> [player acts -> refresh()] ... -> game over -> restart.
// All rule decisions live in gameState.js; this file should only translate input into
// Game method calls and Game state into what's on screen.

const BOT_TURN_DELAY_MS = 1000; // SPEC: bots wait ~1 second so humans can follow along

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
};
const canvasContext = elements.canvas.getContext('2d');

let game = null;
let isChoosingStealTarget = false; // true after clicking Steal, until a card is picked or Steal is clicked again
let pendingBotTimer = null;

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
  elements.setupScreen.classList.add('hidden');
  elements.gameOverScreen.classList.add('hidden');
  elements.gameScreen.classList.remove('hidden');
  refresh();
}

// ---------- Player input ----------

function isHumanTurn() {
  return game && game.phase === GAME_PHASE.TURNS && !game.getCurrentPlayer().isBot;
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
  const result = game.steal(clicked.playerIndex, clicked.cardIndex);
  if (result.ok) isChoosingStealTarget = false;
  showResult(result);
}

function onNextRoundClicked() {
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
  if (pendingBotTimer || !game || game.phase !== GAME_PHASE.TURNS) return;
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
  else if (action.type === 'steal') result = game.steal(action.victimIndex, action.cardIndex);
  else result = game.stand();
  // A bot choosing an illegal move would freeze the game, so fall back to standing.
  if (!result.ok) game.stand();
}

// ---------- Drawing the UI from game state ----------

// Whose hidden cards are shown face-up during play:
//  - exactly one human: always that human (bots don't look at the screen)
//  - several humans: whoever's turn it is, if human. Otherwise nobody.
// TODO (P3, SPEC criteria 19–21): with several humans, show a "Pass to Player N" cover
// before each human turn. Right now player B can see player A's hidden cards on A's turn.
function getViewerIndex() {
  const humanSeats = game.players.map((p, i) => (p.isBot ? -1 : i)).filter(i => i >= 0);
  if (humanSeats.length === 1) return humanSeats[0];
  if (isHumanTurn()) return game.currentPlayerIndex;
  return -1;
}

function refresh() {
  renderTable(canvasContext, game, { viewerIndex: getViewerIndex(), stealMode: isChoosingStealTarget });
  updateControls();
  updateStatusMessage();
  updateMessageLog();
  if (game.phase === GAME_PHASE.GAME_OVER) {
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
  elements.nextRoundButton.classList.toggle('hidden', game.phase !== GAME_PHASE.ROUND_OVER);
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
elements.restartButton.addEventListener('click', () => {
  elements.gameOverScreen.classList.add('hidden');
  elements.gameScreen.classList.add('hidden');
  elements.setupScreen.classList.remove('hidden');
});
buildSeatTypeSelectors();
