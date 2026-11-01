# Pickpocket Poker — Game Spec

## The game in one paragraph

Pickpocket Poker is a card game that crosses poker with blackjack. You are trying to build the
best **poker hand**, but your cards also have **blackjack values**, and if your total goes over
**21 you bust** and are out of the round. Everyone starts with 2 hidden cards. On each turn you
either **draw** a card from the deck, **steal** a face-up card from another player, or **stand**.
Every card you draw is dealt face-up, which means that anything you take can be taken from you.
After 4 turns, hands are revealed and the best poker hand that isn't bust wins the pot.

## Why it's fun

- **Greed vs. bust.** Two kings are a strong pair and already sit at 20. Chasing a flush or a
  full house means holding more cards, and more cards means a higher total.
- **Everything you draw is exposed.** You can see exactly which cards your opponents could use,
  and they can see yours. Drawing helps you but also hands your rivals new options.
- **Stealing can hurt twice.** When you steal a card, the victim immediately draws a
  replacement, and that replacement can bust them.

## Intended feel

A smoky backroom card game: dark green felt, dim warm lighting, chips stacked in front of each
seat. Steals should feel a little tense, with the card visibly sliding from one seat to another.
The atmosphere is quiet and deliberate rather than flashy.

---

## Full rules

### Setup
- 2–4 seats. On the setup screen, each seat is set to **Human** or **Bot**.
- Each player starts with **100 chips**.
- A standard 52-card deck, freshly shuffled at the start of every round.

### Card values (the blackjack side)
- 2–10 are worth their number. J, Q and K are worth 10.
- An Ace counts as **11, unless that would put the total over 21, in which case it counts as 1**
  (normal blackjack rule; this applies to each Ace separately).
- A hand's **total** is the sum of these values.

### A round
1. **Ante:** each player still in the game puts the ante into the pot. The ante starts at
   **10 chips and doubles every 3 rounds** (rounds 1–3: 10, rounds 4–6: 20, rounds 7–9: 40, …),
   so games end in about 10–15 rounds instead of dragging on. A player with less than the ante
   puts in everything they have. *(Added after Phase 1 testing: with a flat 10-chip ante,
   simulated games averaged ~200 rounds.)*
2. **Deal:** each player gets **2 cards face-down**. Hidden cards are visible only to their owner.
3. **Turns:** there are **4 turns per round**. Each turn, every non-busted player acts once, in
   seat order, starting with the seat to the left of the dealer. The dealer button moves one seat
   each round.
4. On your turn, choose **exactly one** action:
   - **Draw:** take the top card of the deck and place it in your hand **face-up**.
   - **Steal:** take any **face-up** card from another player's hand (the player may be busted).
     The card stays face-up in your hand. The victim **immediately draws a replacement** from the
     deck, face-up. If that replacement takes the victim over 21, the victim busts.
   - **Stand:** take nothing this turn. You still get your later turns.
5. **Hand limit:** a hand holds at most **5 cards**. A player holding 5 cards can only Stand.
   (A player with 5 cards can still be stolen from; their replacement brings them back to 5.)
6. **Bust:** the moment a player's total goes over 21, they are **busted**. They take no more
   turns this round and cannot win the pot. Their face-up cards stay on the table and can still
   be stolen. Their hidden cards stay hidden until the reveal.
7. **Reveal (showdown):** after the 4th turn, all hands are revealed. Among the players who
   haven't busted, the best poker hand wins the pot.

The deck never runs out: the worst case is 8 dealt + 16 draws + 16 replacements = 40 of 52 cards.

### Poker ranking (the poker side)
Standard poker ranks, from high to low: straight flush, four of a kind, full house, flush,
straight, three of a kind, two pair, pair, high card.

- **Straights, flushes, full houses and straight flushes require exactly 5 cards.** A hand with
  2–4 cards can only make high card, pair, two pair, three of a kind or four of a kind.
- Aces rank **high** for poker comparison, and A-2-3-4-5 also counts as a straight.
- Within the same category, compare card ranks in the usual way: the rank of the pair or trips
  first, then kickers from highest to lowest. If one hand runs out of kickers first, the hand
  with the extra kicker wins.
- (Blackjack totals do **not** affect poker rank, except through the tie rules below.)

### Pot, ties and elimination
- **Single winner:** takes the whole pot.
- **Tie (identical poker hands):** the pot is split evenly. Any leftover chip goes to the tied
  player with the **lowest card total**; if totals are equal too, it goes to the first of them in
  seat order.
- **Everyone busted:** nobody wins, and the pot **carries over** to the next round.
- A player with **0 chips** is eliminated. The **last player with chips wins the game**, and a
  game-over screen offers a restart.

### Bots
On its turn, a bot follows these steps in order:
1. **Steal** if some face-up card on the table would **improve its poker rank without busting
   it**. If several would, it takes the one that gives the best resulting hand. "Improve" means
   the hand **category** goes up (high card → pair, pair → two pair, etc.). A better kicker
   alone does not count.
2. Otherwise **draw** if its total is **15 or less** and it holds fewer than 5 cards.
3. Otherwise **stand**.

Bots wait about **1 second** before acting, so a human can follow what happened.

### Hot-seat privacy
- With **more than one human**, a full-screen "Pass to Player N" cover appears before each
  human's turn and hides every card. The table appears when that player clicks to continue.
- Hidden cards are drawn face-up only for the human whose turn it currently is. Everyone else's
  hidden cards are shown as card backs.
- With **exactly one human** (everyone else is a bot), the cover never appears and that human's
  hidden cards are always visible.

### Presentation
- A green felt table with seats around it. Each seat shows the player's name, chips, cards,
  card total (only to the owner), and a status (active / standing / BUST).
- The pot and turn count ("Turn 2 of 4") are in the center, with a short message log of recent
  actions (e.g. "Bot 2 stole 7♥ from You").
- Polish (lower priority): card-flip animation on reveal, steal animation where the card slides
  between seats, chip sounds, card sounds.

---

## Acceptance criteria

### P1 — Core round loop (must work; the game doesn't exist without it)
1. Opening `index.html` in a modern browser starts the game with no install or build step.
2. A setup screen lets the player choose 2–4 seats and set each seat to Human or Bot, then start.
3. Each player starts with 100 chips; at the start of each round, every player pays the ante
   (10, doubling every 3 rounds; or all their chips if they have less) and the pot shows the total.
4. Each player is dealt 2 face-down cards at the start of the round.
5. Card totals follow the blackjack rules (J/Q/K = 10, each Ace = 11 unless that would bust, then 1).
6. On a human's turn, Draw, Steal and Stand buttons work as described in the rules. Stealing lets
   you click a face-up card in another player's hand.
7. Only face-up cards can be stolen; clicking a hidden card does nothing.
8. Drawn and stolen cards are face-up, and a victim instantly draws a face-up replacement.
9. A player whose total exceeds 21 is immediately marked BUST and skipped for the rest of the round.
10. A player with 5 cards can only Stand (Draw and Steal are disabled).
11. A round has exactly 4 turns, then all hands are revealed.
12. At reveal, the best non-busted poker hand (per the ranking rules, including "5-card combos
    need 5 cards") wins the pot, and the winning hand's name is shown (e.g. "Bot 1 wins with Two Pair").
13. Ties split the pot, with the leftover chip going as described; if everyone busts, the pot
    carries over to the next round.
14. The dealer button moves one seat each round.
15. Players with 0 chips are eliminated; when one player remains, a game-over screen announces the
    winner and a button restarts the game.

### P2 — Bots (needed for solo play)
16. Bot seats take their turns automatically, following the 3-step bot rule above.
17. Each bot waits about 1 second before acting, and its action appears in the message log.
18. A game with 1 human + 3 bots can be played start to finish without errors.

### P3 — Hot-seat privacy
19. With 2+ humans, a "Pass to Player N" cover hides all cards before each human's turn.
20. Only the current human sees their own hidden cards and total; other hidden cards show as backs.
21. With exactly 1 human, no cover appears.

### P4 — Casino polish
22. Green felt background and a dim, warm color palette.
23. Stolen cards visibly slide from the victim's seat to the thief's seat.
24. Hidden cards flip over with an animation at reveal.
25. Sound effects for drawing, stealing, busting and winning the pot (and a mute button).

## Priorities: what to cut first

Cut from the bottom up: **P4, then P3, then P2.** Never cut P1.

- **P1** is the game itself. A clean P1 with no bots, playable by passing one laptop around, is
  better than a buggy version with everything.
- **P2 (bots)** is next because it lets one person actually play.
- **P3 (privacy)** matters only when several people share one screen.
- **P4 (polish)** is the most fun to add but the least important. Within P4, the steal animation
  (23) matters most, because stealing is the signature move.

If one specific rule turns out to be hard, simplify it rather than skipping the whole criterion,
and note this in the README. For example, the tie-breaking chip rule (13) can fall back to
"leftover chip to the first winner in seat order".

## Out of scope
Betting, raising and folding; online multiplayer; saving games; more than 4 players; difficulty settings.
