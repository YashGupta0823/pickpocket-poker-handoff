# CLAUDE.md: instructions for an AI assistant working in this repo

You are helping someone who **inherited** this project from its original author. They are
graded on finishing the game described in `SPEC.md` **while keeping at least 75% of the
original work**. Rewrites hurt them. Work inside the existing design.

## Read first, in this order
1. `SPEC.md`: rules, numbered acceptance criteria, and priorities (P1 > P2 > P3 > P4). This is
   the source of truth for what the game should do. Don't edit the author's text; propose
   additions in a clearly marked section at the bottom.
2. `README.md`: which criteria are met, the code map, known traps, and the next steps in order.
3. `prompt_log.md`: how the code got this way and which decisions the author made.

## Hard rules
- **Make small, scoped changes.** Change only what the request is about. Don't reformat,
  rename, reorder or "clean up" code you weren't asked to touch.
- **Keep the architecture:**
  - Plain `<script>` files that share globals.
  - **No** ES modules, bundlers, frameworks, TypeScript or npm dependencies. The game must keep
    working by double-clicking `index.html` from `file://`.
  - Keep the `Game` class, `chooseBotAction`, `renderTable`/`findCardAt`, and `refresh()`. Extend
    them; don't replace them.
- **Respect the layer boundaries:**
  - `gameState.js` holds all rules and never touches the DOM or canvas.
  - `render.js` only reads the game; it never changes it.
  - `bots.js` only decides; it returns an action object and never applies it.
  - `main.js` only translates input into `Game` calls and calls `refresh()`.
- **Game actions return `{ ok, reason }` and never throw.** New actions should follow the same
  pattern.
- **Match the naming style:** descriptive camelCase (`playerIndex`, `isChoosingStealTarget`),
  UPPER_SNAKE constants at the top of each file, and comments that explain *why*.
- **Script order matters.** A new file needs a `<script>` tag after its dependencies in
  `index.html`, plus a `module.exports` block and a `require` in `tests/run-tests.js` if it holds
  logic.
- **Canvas clicks must convert from CSS pixels to canvas pixels** (see `onCanvasClicked`).

## Before saying a change works
- Run `node tests/run-tests.js`. All tests must pass. Add a test for any rule you change or add,
  using `gameWithDeck()` to get a predictable deck.
- For UI changes, open `index.html` and actually play a round. The engine tests don't cover
  the UI.
- Update `README.md` (the criteria table, code map and known bugs) so it stays true. Never mark
  a criterion as met unless you've checked it.

## Decisions the author already made (don't relitigate)
- A bot "improving its poker rank" means a **category** upgrade (high card → pair, etc.), not a
  better kicker. Use `evaluateHand(...).category`, not `compareHands`, for that check.
- The ante starts at 10 and doubles every 3 rounds.
- Straights, flushes and full houses need exactly 5 cards.
- Busted players' face-up cards remain stealable.
