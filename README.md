# Pickpocket Poker

Poker crossed with blackjack: build the best poker hand without your cards going over 21, and
steal your opponents' face-up cards. **Read [SPEC.md](SPEC.md) first.** It has the full rules,
the numbered acceptance criteria, and the priority order.

This README describes the Phase 1 state (end of the in-class build). Everything here was
checked against the code; if something is broken or missing, it says so.

## Run it

- **Play:** open `index.html` in Chrome, Firefox or Safari (double-click it). No install, no build
  step, no server. Plain HTML/CSS/JS.
- **Engine tests:** `node tests/run-tests.js` from the repo root (any recent Node; no
  `npm install`). Currently 38 tests, all passing. These cover the rules only, not the UI.

## How to play

1. On the setup screen, pick 2–4 seats and set each to Human or Bot, then click **Deal me in**.
   (Default: you plus 3 bots.)
2. Everyone antes and gets 2 hidden cards. On your turn, click one of:
   - **Draw:** take a card from the deck, face-up.
   - **Steal:** then click a highlighted (blue-outlined) face-up card in another player's hand.
     Click **Steal** again to cancel. The victim automatically draws a replacement.
   - **Stand:** do nothing this turn.
3. Going over 21 busts you for the round. After 4 turns, the best poker hand among players who
   haven't busted takes the pot. Click **Next round**.
4. The ante doubles every 3 rounds. Last player with chips wins.

What's on screen:
- The gold name and gold bar mark whose turn it is. **(D)** marks the dealer.
- Your hidden cards are shown face-up to you with a small red dot in the corner. The dot means
  opponents can't see that card and can't steal it.
- Your card total is shown only to you, until the showdown.
- The log on the right shows the newest action first.
- The **How to play** box under the log has the rules in short form. Click its title to
  collapse it.

## Acceptance criteria status (numbers match SPEC.md)

"Verified" below means: engine behaviour is covered by `tests/run-tests.js`, and the UI was
exercised by a scripted headless-Chrome run that played a complete 1-human + 3-bot game (11
rounds, 9 human steals made through the canvas click handler, game-over screen shown, no
errors). That script called the UI functions directly; it did not use real mouse clicks.

### P1: core round loop. All met.
| # | Status | Notes |
|---|--------|-------|
| 1 | ✅ Met | Opens from `file://`, no server needed. |
| 2 | ✅ Met | Setup screen with 2–4 seats, Human/Bot per seat. Names are automatic ("Player 1", "Bot 2"); there is no name entry. |
| 3 | ✅ Met | 100 chips; ante is collected and the pot is shown. Ante rises per the updated SPEC. |
| 4 | ✅ Met | |
| 5 | ✅ Met | Tested, including multiple Aces. |
| 6 | ✅ Met | |
| 7 | ✅ Met | Clicking a hidden card in steal mode does nothing except show "You can only steal face-up cards". |
| 8 | ✅ Met | Tested, including a replacement card busting the victim. |
| 9 | ✅ Met | |
| 10 | ✅ Met | At 5 cards, Draw and Steal are disabled. |
| 11 | ✅ Met | |
| 12 | ✅ Met | The status line and log show e.g. "Bot 1 wins 40 with Pair", and each seat shows its hand name at showdown. |
| 13 | ✅ Met | Tested: split pot, odd-chip rule, carry-over. |
| 14 | ✅ Met | |
| 15 | ✅ Met | The game-over overlay's **Play again** returns to the setup screen. |

### P2: bots. All met (Phase 2).
| # | Status | Notes |
|---|--------|-------|
| 16 | ✅ Met | All 3 steps. Step 1 (`findBestSteal()` in `js/bots.js`): steal only if the card raises the hand **category** without busting, picking the best resulting hand. Tested, including bust, kicker-only and 5-card cases. |
| 17 | ✅ Met | 1-second delay; bot actions appear in the log. |
| 18 | ✅ Met | Re-checked with bot stealing: 3 full 1 human + 3 bots games in headless Chrome (5–8 bot steals each, no errors), and an engine test plays 200 all-bot games to game over with only legal moves. |

### P3: hot-seat privacy. All met (Phase 2).
| # | Status | Notes |
|---|--------|-------|
| 19 | ✅ Met | With 2+ humans still in the game, an opaque "Pass to Player N" cover (`#pass-cover`) appears before every human turn and hides the whole page. Draw/Steal/Stand and canvas clicks are ignored until that player clicks **Continue**. Once only one human is left (the others eliminated), it behaves like #21. |
| 20 | ✅ Met | `getViewerIndex()` returns -1 while the cover is up and during bot turns, and the current human's seat after **Continue**, so only they see their hidden cards and total. |
| 21 | ✅ Met | With exactly 1 human the cover never appears, and that human's hidden cards are always visible. |

### P4: casino polish. Barely started.
| # | Status | Notes |
|---|--------|-------|
| 22 | 🟡 Partial | Green felt, wooden rail, dark warm page palette. No lighting or texture. |
| 23 | ❌ Not met | No steal animation. |
| 24 | ❌ Not met | No flip animation; cards just appear face-up at showdown. |
| 25 | ❌ Not met | No sound and no mute button. |

## Code map

The order below is also the `<script>` load order in `index.html`. Each file uses globals from
the files above it.

| File | Responsibility | Go here to change… |
|------|----------------|--------------------|
| `index.html` | Page structure: setup screen, canvas, buttons, log, the **How to play** rules box, game-over overlay. The "Pass to Player N" cover (`#pass-cover`). | Adding screens, overlays or buttons |
| `css/style.css` | Page styling only (not the table). | Button and panel look, page palette |
| `js/cards.js` | Deck creation and shuffle; **blackjack** values (`handTotal`, `isBust`); `cardLabel`. Cards are `{ rank: 2–14, suit, faceUp }`, with Ace = 14. | Card values, Ace rule |
| `js/pokerRank.js` | **Poker** hand evaluation for 2–5 cards (`evaluateHand`) and comparison (`compareHands`). Enforces "straights/flushes need 5 cards". | Hand ranking, tie-breaking |
| `js/gameState.js` | `Game` class, the rules engine: antes, dealing, turn order, `draw()`, `steal()`, `stand()`, busting, `showdown()`, pot splitting, elimination. Tunable constants are at the top. No DOM access. | Any game rule, turn flow, chips |
| `js/bots.js` | `chooseBotAction(game, seat)` returns `{type:'draw'|'stand'|'steal', ...}`. Decision only; it doesn't apply the action. `findBestSteal()` is step 1 of the bot rule. | Bot behaviour |
| `js/render.js` | `renderTable()` draws everything on the canvas from game state. Records `cardHitboxes`, which `findCardAt(x, y)` uses for clicks. Colors and seat positions are at the top. | Visuals and P4 polish, layout |
| `js/main.js` | UI controller: setup screen, button and canvas handlers, bot turn timer, `refresh()` after every change, `getViewerIndex()` (who sees hidden cards), the hot-seat pass cover (`isPassCoverNeeded()`). | Input, flow between screens, hot-seat privacy |
| `tests/run-tests.js` | Node test runner for the engine. Use `gameWithDeck()` to build a game with a fixed deck. | Add a test whenever you change a rule |

How the pieces talk:
- Every `Game` action returns `{ ok: true }` or `{ ok: false, reason }` and never throws.
- `main.js` calls the action and then `refresh()`.
- `refresh()` re-renders the canvas, updates the buttons and log, and schedules the next bot turn
  if one is due.
- `game.phase` (`'turns'`, `'roundOver'` or `'gameOver'`) drives what the UI shows.

## What I'd do next (priority order)

1. ~~**Bot stealing** (criterion 16)~~: done in Phase 2.
2. ~~**Pass-device cover** (criteria 19–21)~~: done in Phase 2.
3. **Steal slide animation** (criterion 23). This is the most important polish item, because
   stealing is the signature move. It needs an animation loop; see the TODO in `render.js`.
4. **Reveal flip** (criterion 24), then **sounds and a mute button** (criterion 25), then palette
   and lighting (criterion 22).

## Known bugs and traps

- **Script order matters.** The files are plain `<script>` tags that share globals, not ES
  modules, on purpose: modules are blocked when you open `index.html` from `file://`. If you add
  a file, add its `<script>` tag in dependency order. For the Node tests, also `require` it in
  `tests/run-tests.js` and add a `module.exports` block like the other files have.
- **Canvas scaling.** The canvas is 960×640 internally but CSS scales it down on narrow windows.
  Click positions are converted in `onCanvasClicked()`; any new canvas click handling must do the
  same conversion.
- **`cardHitboxes` is rebuilt on every render.** Clicks therefore match whatever was drawn last.
  If you add animations, make sure hitboxes don't point at cards that are mid-flight.
- **The pass cover is keyed per turn** (`round:turn:seat` in `main.js`), not per player, so it
  appears before every human turn, even when the same human acts twice in a row because
  everyone else busted.
- **A player can steal or draw themselves into a bust.** This is intended (it's legal), but
  humans get no warning.
- **Eliminated players forfeit chips in a carried-over pot.** If everyone busts and a player
  anted their last chips into that pot, they're still eliminated at the end of the round. The
  spec doesn't cover this case.
- **Edge case:** if the very last pot carries over and nobody has chips left, `showdown()` names
  seat 0 the winner as a fallback. I've never seen this happen.
- **All-bot games stop at each round end** until someone clicks **Next round**. That's harmless,
  but an all-bot table doesn't run by itself.
- **The How to play box is static HTML.** If you change a rule (in `gameState.js` or SPEC.md),
  update the bullets in `index.html` too, or they'll be wrong.
- **Steal-mode click on your own card** shows "Pick another player's card" in the status line.
- **`compareHands()` counts an extra kicker as better** (spec rule: "the hand with the extra
  kicker wins"). This is correct for the showdown but wrong for bot steal decisions; see
  `bots.js`.

## Corners cut, and why

- **No animation loop.** The canvas only redraws when the state changes. It was simpler and
  enough for the core loop; P4 will need a `requestAnimationFrame` loop.
- **The message log is HTML, not canvas.** Text in HTML gets scrolling and wrapping for free.
- **No name entry**, to save time; names are generated in `readSeatConfigs()` in `main.js`.
- **UI tests are scripted, not automated.** Only the engine has a test file. The UI was checked
  with a throwaway headless-Chrome script that isn't in the repo.
- **Spec changes after the first commit:** the rising ante and the clarified bot steal rule
  were added to SPEC.md after Phase 1 testing (both are marked in the spec). The git history
  shows exactly what changed.
