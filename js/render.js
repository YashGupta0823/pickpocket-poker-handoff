// render.js — draws the whole table onto the canvas from the Game state. Read-only: it never
// changes the game. It also records where each card was drawn (cardHitboxes) so main.js can
// figure out which card was clicked.
//
// Drawing happens only when something changes (main.js calls renderTable after each action).
// There is NO animation loop yet. TODO (P4, SPEC criteria 23–24): the steal-slide and reveal-flip
// animations will need a requestAnimationFrame loop, probably owned by main.js.

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const CARD_WIDTH = 56;
const CARD_HEIGHT = 80;
const CARD_GAP = 8;

const TABLE_COLORS = {
  background: '#14110f',
  felt: '#1f4a2e',        // dark green felt
  feltEdge: '#5a3a22',    // wooden rail
  cardFace: '#f3ecdc',
  cardBack: '#7a1f1f',
  cardBackPattern: '#a33a2f',
  redSuit: '#b3261e',
  blackSuit: '#1a1a1a',
  text: '#e8dcc4',
  muted: '#a3967f',
  currentTurn: '#d4a84b', // gold outline around whoever is acting
  stealable: '#5fd3ff',   // outline on cards you can steal, in steal mode
  winner: '#d4a84b',
  bust: '#c0473a',
};

// Seat centers, by number of players. Index 0 is always the bottom seat. Seats go clockwise,
// which matches turn order (left of dealer = next index).
const SEAT_POSITIONS = {
  2: [{ x: 480, y: 520 }, { x: 480, y: 110 }],
  3: [{ x: 480, y: 520 }, { x: 175, y: 230 }, { x: 785, y: 230 }],
  4: [{ x: 480, y: 520 }, { x: 175, y: 315 }, { x: 480, y: 110 }, { x: 785, y: 315 }],
};

// Rebuilt on every render: [{ playerIndex, cardIndex, x, y, width, height }]
let cardHitboxes = [];

// view = {
//   viewerIndex: seat whose hidden cards and total are shown face-up, or -1 for nobody,
//   stealMode:   true while the current human is choosing a card to steal,
// }
// At showdown (phase !== TURNS), everyone's cards are shown regardless of viewerIndex.
function renderTable(context, game, view) {
  cardHitboxes = [];
  drawFelt(context);

  const isShowdown = game.phase !== GAME_PHASE.TURNS;
  const stealableKeys = new Set();
  if (view.stealMode) {
    for (const option of game.getStealableCards(game.currentPlayerIndex)) {
      stealableKeys.add(`${option.victimIndex}:${option.cardIndex}`);
    }
  }

  game.players.forEach((player, playerIndex) => {
    const position = SEAT_POSITIONS[game.players.length][playerIndex];
    const canSeeHiddenCards = isShowdown || playerIndex === view.viewerIndex;
    drawSeat(context, game, player, playerIndex, position, canSeeHiddenCards, stealableKeys);
  });

  drawCenterInfo(context, game);
}

// Returns { playerIndex, cardIndex } for the card under canvas point (x, y), or null.
// Later cards are drawn on top, so search from the end.
function findCardAt(x, y) {
  for (let i = cardHitboxes.length - 1; i >= 0; i--) {
    const box = cardHitboxes[i];
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
      return { playerIndex: box.playerIndex, cardIndex: box.cardIndex };
    }
  }
  return null;
}

function drawFelt(context) {
  context.fillStyle = TABLE_COLORS.background;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = TABLE_COLORS.feltEdge;
  roundedRect(context, 10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20, 120);
  context.fill();
  context.fillStyle = TABLE_COLORS.felt;
  roundedRect(context, 26, 26, CANVAS_WIDTH - 52, CANVAS_HEIGHT - 52, 106);
  context.fill();
}

function drawSeat(context, game, player, playerIndex, position, canSeeHiddenCards, stealableKeys) {
  const isEliminated = player.status === PLAYER_STATUS.ELIMINATED;
  const isCurrent = playerIndex === game.currentPlayerIndex;
  const isWinner = game.lastRoundResult && game.lastRoundResult.winners.includes(playerIndex);

  // Name line, above the cards
  context.textAlign = 'center';
  context.font = '18px Georgia';
  context.fillStyle = isCurrent ? TABLE_COLORS.currentTurn : TABLE_COLORS.text;
  const dealerMark = playerIndex === game.dealerIndex ? ' (D)' : '';
  const botMark = player.isBot ? ' [bot]' : '';
  context.fillText(`${player.name}${botMark}${dealerMark}`, position.x, position.y - CARD_HEIGHT / 2 - 26);

  // Chips + status line
  context.font = '14px Georgia';
  context.fillStyle = TABLE_COLORS.muted;
  let statusText = `${player.chips} chips`;
  if (isEliminated) statusText += ' · OUT';
  else if (player.status === PLAYER_STATUS.BUSTED) statusText += ' · BUST';
  if (canSeeHiddenCards && player.hand.length > 0 && !isEliminated) {
    statusText += ` · total ${handTotal(player.hand)}`;
  }
  if (game.lastRoundResult && game.lastRoundResult.evaluations[playerIndex]) {
    statusText += ` · ${game.lastRoundResult.evaluations[playerIndex].name}`;
  }
  context.fillStyle = player.status === PLAYER_STATUS.BUSTED ? TABLE_COLORS.bust : TABLE_COLORS.muted;
  context.fillText(statusText, position.x, position.y - CARD_HEIGHT / 2 - 8);

  if (isEliminated) return;

  // Cards, centered on the seat position
  const handWidth = player.hand.length * CARD_WIDTH + (player.hand.length - 1) * CARD_GAP;
  const startX = position.x - handWidth / 2;
  const cardY = position.y - CARD_HEIGHT / 2;
  player.hand.forEach((card, cardIndex) => {
    const cardX = startX + cardIndex * (CARD_WIDTH + CARD_GAP);
    const showFace = card.faceUp || canSeeHiddenCards;
    let outline = null;
    if (stealableKeys.has(`${playerIndex}:${cardIndex}`)) outline = TABLE_COLORS.stealable;
    else if (isWinner) outline = TABLE_COLORS.winner;
    drawCard(context, card, cardX, cardY, showFace, outline);
    cardHitboxes.push({ playerIndex, cardIndex, x: cardX, y: cardY, width: CARD_WIDTH, height: CARD_HEIGHT });
  });

  // Gold bar under whoever is acting
  if (isCurrent) {
    context.fillStyle = TABLE_COLORS.currentTurn;
    context.fillRect(position.x - 40, position.y + CARD_HEIGHT / 2 + 8, 80, 4);
  }
}

// showFace: draw rank/suit (true) or a card back (false).
// A hidden card the viewer is allowed to see gets a small "hidden" dot, so the owner can tell
// which of their cards opponents can't see (and therefore can't steal).
function drawCard(context, card, x, y, showFace, outlineColor) {
  context.fillStyle = showFace ? TABLE_COLORS.cardFace : TABLE_COLORS.cardBack;
  roundedRect(context, x, y, CARD_WIDTH, CARD_HEIGHT, 6);
  context.fill();

  if (showFace) {
    context.fillStyle = isRedSuit(card.suit) ? TABLE_COLORS.redSuit : TABLE_COLORS.blackSuit;
    context.textAlign = 'center';
    context.font = 'bold 20px Georgia';
    context.fillText(cardLabel(card).slice(0, -1), x + CARD_WIDTH / 2, y + 32);
    context.font = '24px Georgia';
    context.fillText(card.suit, x + CARD_WIDTH / 2, y + 62);
    if (!card.faceUp) {
      context.fillStyle = TABLE_COLORS.cardBack;
      context.beginPath();
      context.arc(x + CARD_WIDTH - 9, y + 9, 4, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.strokeStyle = TABLE_COLORS.cardBackPattern;
    context.lineWidth = 2;
    roundedRect(context, x + 6, y + 6, CARD_WIDTH - 12, CARD_HEIGHT - 12, 4);
    context.stroke();
  }

  if (outlineColor) {
    context.strokeStyle = outlineColor;
    context.lineWidth = 3;
    roundedRect(context, x - 2, y - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4, 7);
    context.stroke();
  }
}

function drawCenterInfo(context, game) {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2 + 5;
  context.textAlign = 'center';
  context.fillStyle = TABLE_COLORS.text;
  context.font = '26px Georgia';
  context.fillText(`Pot: ${game.pot}`, centerX, centerY - 10);
  context.font = '16px Georgia';
  context.fillStyle = TABLE_COLORS.muted;
  const turnText = game.phase === GAME_PHASE.TURNS
    ? `Round ${game.roundNumber} · Turn ${game.turnNumber} of ${TURNS_PER_ROUND} · Ante ${game.getCurrentAnte()}`
    : `Round ${game.roundNumber} · Showdown`;
  context.fillText(turnText, centerX, centerY + 18);
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
