// gameState.js — the Game class: players, chips, the pot, turn order, the three actions
// (draw / steal / stand), busting, and the showdown. This is the rules engine.
//
// It knows NOTHING about the canvas, buttons or bots. The UI (main.js) calls these methods
// and then re-renders. Every method that changes state validates its input and returns
// { ok: true } or { ok: false, reason } instead of throwing, so the UI can show the reason.
//
// Depends on globals from cards.js and pokerRank.js (loaded first in index.html).

const STARTING_CHIPS = 100;
const BASE_ANTE = 10;
// The ante doubles every few rounds (10, 10, 10, 20, 20, 20, 40...). Without this, a flat
// ante made simulated games last ~200 rounds; with it they finish in a sitting.
const ANTE_DOUBLES_EVERY_ROUNDS = 3;
const TURNS_PER_ROUND = 4;
const STARTING_HAND_SIZE = 2;
const MAX_HAND_SIZE = 5;

// Per-round player status. A player with 0 chips is 'eliminated' for the rest of the game.
const PLAYER_STATUS = {
  ACTIVE: 'active',
  BUSTED: 'busted',
  ELIMINATED: 'eliminated',
};

// What the game is waiting for. The UI decides what to show based on this.
const GAME_PHASE = {
  TURNS: 'turns',          // someone (currentPlayerIndex) must act
  ROUND_OVER: 'roundOver', // showdown happened; lastRoundResult is set; call startNextRound()
  GAME_OVER: 'gameOver',   // one player has all the chips; gameWinnerIndex is set
};

class Game {
  // seatConfigs: [{ name: 'Player 1', isBot: false }, ...], 2–4 entries, in seat order.
  // options.createShuffledDeck: optional function returning a deck. Tests pass a fixed deck
  //   so rounds are predictable. Cards are taken from the FRONT of the deck (deck.shift()).
  constructor(seatConfigs, options = {}) {
    this.players = seatConfigs.map(seat => ({
      name: seat.name,
      isBot: seat.isBot,
      chips: STARTING_CHIPS,
      hand: [],
      status: PLAYER_STATUS.ACTIVE,
    }));
    this.createShuffledDeck = options.createShuffledDeck || (() => shuffleDeck(createDeck()));
    this.deck = [];
    this.pot = 0;
    // startRound() moves the button one seat before dealing, so starting on the last seat
    // puts the first round's button on seat 0.
    this.dealerIndex = this.players.length - 1;
    this.turnNumber = 0;          // 1..TURNS_PER_ROUND during a round
    this.turnOrder = [];          // seat indexes for this round, starting left of the dealer
    this.turnOrderPosition = 0;   // index into turnOrder of whoever is acting
    this.currentPlayerIndex = -1; // seat index of whoever must act now
    this.phase = GAME_PHASE.TURNS;
    this.roundNumber = 0;
    this.lastRoundResult = null;  // set by showdown(), see that method for the shape
    this.gameWinnerIndex = -1;
    this.log = [];                // newest last; strings shown in the UI's message log
  }

  // ---------- Round lifecycle ----------

  // Call once after constructing, and again (via startNextRound) after each showdown.
  startRound() {
    this.roundNumber++;
    this.dealerIndex = this.nextSeatWithChips(this.dealerIndex);
    this.deck = this.createShuffledDeck();
    this.lastRoundResult = null;

    for (const player of this.players) {
      player.hand = [];
      player.status = player.chips > 0 ? PLAYER_STATUS.ACTIVE : PLAYER_STATUS.ELIMINATED;
    }

    // Turn order: every seat still in the game, starting with the one left of the dealer.
    this.turnOrder = [];
    for (let offset = 1; offset <= this.players.length; offset++) {
      const seat = (this.dealerIndex + offset) % this.players.length;
      if (this.players[seat].status !== PLAYER_STATUS.ELIMINATED) this.turnOrder.push(seat);
    }

    // Ante. A short-stacked player antes everything they have. If the last round's pot
    // carried over (everyone busted), these antes are added on top of it.
    const roundAnte = this.getCurrentAnte();
    for (const seat of this.turnOrder) {
      const player = this.players[seat];
      const ante = Math.min(roundAnte, player.chips);
      player.chips -= ante;
      this.pot += ante;
    }

    // Deal 2 face-down cards to each player, in turn order.
    for (const seat of this.turnOrder) {
      for (let i = 0; i < STARTING_HAND_SIZE; i++) {
        const card = this.deck.shift();
        card.faceUp = false;
        this.players[seat].hand.push(card);
      }
    }

    this.addLog(`Round ${this.roundNumber} — ${this.players[this.dealerIndex].name} deals. Ante ${roundAnte}, pot ${this.pot}`);

    // Two starting cards can never bust (max is A+A = 12), so nobody busts on the deal.
    this.turnNumber = 1;
    this.turnOrderPosition = 0;
    this.phase = GAME_PHASE.TURNS;
    this.currentPlayerIndex = this.turnOrder[0];
  }

  startNextRound() {
    if (this.phase !== GAME_PHASE.ROUND_OVER) return { ok: false, reason: 'Round is not over' };
    this.startRound();
    return { ok: true };
  }

  // ---------- Queries the UI (and later the bots) use ----------

  // Ante for the current round (roundNumber starts at 1).
  getCurrentAnte() {
    return BASE_ANTE * 2 ** Math.floor((this.roundNumber - 1) / ANTE_DOUBLES_EVERY_ROUNDS);
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  canDraw(seat) {
    return this.isPlayersTurn(seat) && this.players[seat].hand.length < MAX_HAND_SIZE;
  }

  // True if `seat` may steal at all right now (there is at least one face-up card to take).
  canSteal(seat) {
    if (!this.isPlayersTurn(seat) || this.players[seat].hand.length >= MAX_HAND_SIZE) return false;
    return this.getStealableCards(seat).length > 0;
  }

  // Every card `thiefSeat` could steal: [{ victimIndex, cardIndex, card }].
  // Busted players' face-up cards are included on purpose (SPEC.md, Bust rule).
  getStealableCards(thiefSeat) {
    const options = [];
    this.players.forEach((victim, victimIndex) => {
      if (victimIndex === thiefSeat || victim.status === PLAYER_STATUS.ELIMINATED) return;
      victim.hand.forEach((card, cardIndex) => {
        if (card.faceUp) options.push({ victimIndex, cardIndex, card });
      });
    });
    return options;
  }

  isPlayersTurn(seat) {
    return this.phase === GAME_PHASE.TURNS && this.currentPlayerIndex === seat;
  }

  // ---------- The three actions. Each one ends the current player's turn. ----------

  draw() {
    const seat = this.currentPlayerIndex;
    if (!this.canDraw(seat)) return { ok: false, reason: 'You cannot draw right now' };
    const player = this.players[seat];
    const card = this.deck.shift();
    card.faceUp = true;
    player.hand.push(card);
    this.addLog(`${player.name} drew ${cardLabel(card)}`);
    this.checkForBust(seat);
    this.advanceTurn();
    return { ok: true };
  }

  steal(victimIndex, cardIndex) {
    const thiefSeat = this.currentPlayerIndex;
    const thief = this.players[thiefSeat];
    const victim = this.players[victimIndex];
    if (!this.isPlayersTurn(thiefSeat)) return { ok: false, reason: 'Not your turn' };
    if (thief.hand.length >= MAX_HAND_SIZE) return { ok: false, reason: 'Your hand is full (5 cards)' };
    if (!victim || victimIndex === thiefSeat) return { ok: false, reason: 'Pick another player\'s card' };
    if (victim.status === PLAYER_STATUS.ELIMINATED) return { ok: false, reason: 'That player is out of the game' };
    const card = victim.hand[cardIndex];
    if (!card) return { ok: false, reason: 'No such card' };
    if (!card.faceUp) return { ok: false, reason: 'You can only steal face-up cards' };

    victim.hand.splice(cardIndex, 1);
    thief.hand.push(card); // stays face-up
    this.addLog(`${thief.name} stole ${cardLabel(card)} from ${victim.name}`);

    // The victim immediately draws a face-up replacement. This can bust them — intended.
    const replacement = this.deck.shift();
    replacement.faceUp = true;
    victim.hand.push(replacement);
    this.addLog(`${victim.name} drew replacement ${cardLabel(replacement)}`);

    // Order matters only for the log: victim first, since their replacement came first.
    // Note: a victim who was ALREADY busted stays busted (checkForBust only goes one way).
    this.checkForBust(victimIndex);
    this.checkForBust(thiefSeat);
    this.advanceTurn();
    return { ok: true };
  }

  stand() {
    const seat = this.currentPlayerIndex;
    if (!this.isPlayersTurn(seat)) return { ok: false, reason: 'Not your turn' };
    this.addLog(`${this.players[seat].name} stands`);
    this.advanceTurn();
    return { ok: true };
  }

  // ---------- Internals ----------

  checkForBust(seat) {
    const player = this.players[seat];
    if (player.status === PLAYER_STATUS.ACTIVE && isBust(player.hand)) {
      player.status = PLAYER_STATUS.BUSTED;
      this.addLog(`${player.name} BUSTS!`);
    }
  }

  // Moves to the next ACTIVE player in turn order, rolling over into the next turn number.
  // Busted players are skipped. After turn TURNS_PER_ROUND, runs the showdown. If nobody is
  // active anymore (everyone busted), goes straight to the showdown.
  advanceTurn() {
    // At most one full lap per remaining turn, so this loop always terminates.
    const maxSteps = this.turnOrder.length * (TURNS_PER_ROUND + 1);
    for (let step = 0; step < maxSteps; step++) {
      this.turnOrderPosition++;
      if (this.turnOrderPosition >= this.turnOrder.length) {
        this.turnOrderPosition = 0;
        this.turnNumber++;
        if (this.turnNumber > TURNS_PER_ROUND) break;
      }
      const seat = this.turnOrder[this.turnOrderPosition];
      if (this.players[seat].status === PLAYER_STATUS.ACTIVE) {
        this.currentPlayerIndex = seat;
        return;
      }
    }
    this.showdown();
  }

  // Reveals all hands, pays the pot, eliminates broke players.
  // Sets this.lastRoundResult = {
  //   winners: [seat, ...],            // empty if everyone busted
  //   handName: 'Two Pair' | null,     // the winning hand's name
  //   potWon: number,                  // 0 if the pot carried over
  //   carriedOver: boolean,
  //   evaluations: { [seat]: evaluateHand result } // for non-busted players only
  // }
  showdown() {
    this.phase = GAME_PHASE.ROUND_OVER;
    this.currentPlayerIndex = -1;

    const contenders = this.turnOrder.filter(seat => this.players[seat].status === PLAYER_STATUS.ACTIVE);
    const evaluations = {};
    for (const seat of contenders) evaluations[seat] = evaluateHand(this.players[seat].hand);

    if (contenders.length === 0) {
      this.lastRoundResult = { winners: [], handName: null, potWon: 0, carriedOver: true, evaluations };
      this.addLog(`Everyone busted! The pot of ${this.pot} carries over.`);
    } else {
      let winners = [contenders[0]];
      for (const seat of contenders.slice(1)) {
        const comparison = compareHands(evaluations[seat], evaluations[winners[0]]);
        if (comparison > 0) winners = [seat];
        else if (comparison === 0) winners.push(seat);
      }
      const potWon = this.pot;
      this.splitPot(winners);
      const handName = evaluations[winners[0]].name;
      this.lastRoundResult = { winners, handName, potWon, carriedOver: false, evaluations };
      const names = winners.map(seat => this.players[seat].name).join(' and ');
      this.addLog(`${names} ${winners.length > 1 ? 'split' : 'wins'} ${potWon} with ${handName}`);
    }

    // Eliminate broke players. Note: if the pot carried over, a player who anted their last
    // chips into it is still eliminated and forfeits that stake. See README "Known issues".
    for (const player of this.players) {
      if (player.chips === 0 && player.status !== PLAYER_STATUS.ELIMINATED) {
        player.status = PLAYER_STATUS.ELIMINATED;
        this.addLog(`${player.name} is out of chips and eliminated`);
      }
    }

    const playersWithChips = this.players.filter(p => p.chips > 0);
    if (playersWithChips.length <= 1) {
      this.phase = GAME_PHASE.GAME_OVER;
      // Edge case: if everyone busted on the final pot, chips can sit in the pot with nobody
      // left to win it. Then nobody has chips; we fall back to seat 0. Very unlikely in practice.
      this.gameWinnerIndex = playersWithChips.length === 1 ? this.players.indexOf(playersWithChips[0]) : 0;
      this.addLog(`${this.players[this.gameWinnerIndex].name} wins the game!`);
    }
  }

  // Even split. The leftover chip(s) go to the tied winner with the lowest blackjack total,
  // then to the lowest seat index (SPEC.md, "Pot, ties and elimination").
  splitPot(winners) {
    const share = Math.floor(this.pot / winners.length);
    let remainder = this.pot - share * winners.length;
    for (const seat of winners) this.players[seat].chips += share;
    if (remainder > 0) {
      const remainderSeat = [...winners].sort(
        (a, b) => handTotal(this.players[a].hand) - handTotal(this.players[b].hand) || a - b
      )[0];
      this.players[remainderSeat].chips += remainder;
    }
    this.pot = 0;
  }

  nextSeatWithChips(fromSeat) {
    for (let offset = 1; offset <= this.players.length; offset++) {
      const seat = (fromSeat + offset) % this.players.length;
      if (this.players[seat].chips > 0) return seat;
    }
    return fromSeat;
  }

  addLog(message) {
    this.log.push(message);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Game, GAME_PHASE, PLAYER_STATUS, STARTING_CHIPS, BASE_ANTE, ANTE_DOUBLES_EVERY_ROUNDS, TURNS_PER_ROUND, MAX_HAND_SIZE };
}
