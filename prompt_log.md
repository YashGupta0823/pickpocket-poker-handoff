# Prompt log: Phase 1

**Tool:** Claude Code (CLI), running in the terminal. **Model:** Claude Opus 5.5 (`claude-opus-5-5`).

**How this was built:** I asked Claude to ask me design questions instead of designing the game
itself. Claude asked multiple-choice questions, and I picked answers or wrote my own. Claude
then wrote SPEC.md from those answers, committed it alone (no code), and built the foundation.
My prompts are quoted verbatim below, typos included. I also list every option I picked, so the
next person can tell which rules were **my design choices** and which were **Claude's defaults**.

---

## 1. Kickoff

> ask me questions along the way as you make the first half of this project

*(Followed by the full HW7 assignment page, pasted in. It isn't reproduced here; it's the
course's HW7: Code Handoff page.)*

Claude listed the constraints it would follow: I design the spec, the first commit is SPEC.md
only, and the AI-directed "hotdog" line on the assignment page gets ignored.

## 2. Game concept, language, repo

**Q: What's your game idea?** My answer, verbatim:
> a variation of poker and blackjack wehre it is a combination of both, you can choose to pick up a random card or take someone else's, build on this

- **Language:** JS + HTML canvas (opens in a browser, no install).
- **Repo:** create a new one.
- **Timing:** real submission.

## 3. Core rules (my choices)

| Question | My answer |
|----------|-----------|
| How do you win a round? | **Poker hand, 21 cap.** Best poker hand wins, but going over 21 in blackjack value busts you. |
| Who's at the table? | **Both:** hot-seat humans and computer bots. |
| What can you steal? | **Face-up cards only.** |
| When does a round end; is there betting? | **Fixed turns, no betting.** |

## 4. Hand mechanics (my choices)

| Question | My answer |
|----------|-----------|
| Hand size | **Start with 2, grow to 5.** More cards help the poker hand but risk a bust. |
| What happens to a steal victim | **They draw a replacement** from the deck immediately. |
| Which cards are face-up | **Drawn cards are face-up.** The 2 starting cards are hidden. |
| Game structure | **Chips: winner takes the pot.** Everyone antes; last player with chips wins. |

## 5. Turn rules (my choices)

| Question | My answer |
|----------|-----------|
| Turn actions | **Draw, steal, or stand** (standing isn't permanent). |
| Hands with fewer than 5 cards | **5-card combos need 5.** Straights, flushes and full houses need exactly 5 cards. |
| Aces | **1 or 11**, as in blackjack. |
| Everyone busts / ties | **Pot carries over**; ties split the pot (leftover chip to the lowest card total). |

## 6. Numbers, bots, feel (my choices)

| Question | My answer |
|----------|-----------|
| Numbers | **4 turns per round, 100 starting chips, 10 ante** (the ante was changed later, see §9) |
| Bust timing and hand limit | **Bust instantly; 5 cards = full** (at 5 cards you can only stand) |
| Bot logic | **Simple threshold:** steal if it improves the hand without busting, draw if total ≤ 15, else stand |
| Feel | **Smoky backroom casino** |

## 7. Priorities

Claude asked which features must ship. I checked **all four**: full round loop, bots, hot-seat
privacy, and casino polish. Then I told it:

> you can chooose these kind of preferences on your own

So **Claude chose** these:
- **Priority order:** P1 round loop > P2 bots > P3 hot-seat privacy > P4 polish.
- **Phase 1 scope:** rules engine plus a basic clickable table.
- **The name:** "Pickpocket Poker".

Claude also filled small gaps in the spec, which it flagged when committing:
- 4 seats maximum.
- Busted players' face-up cards stay stealable.
- The kicker rule for hands of different sizes.
- A 1-second bot delay.
- Leftover chips on a split go first to the lowest total, then the lowest seat.

## 8. Clarifying the scope

> is this total project work or just thew ork you want us to do and for the other person to take it from there?

Claude's answer: SPEC.md describes the **whole** game. Phase 1 (me) builds the foundation, which
is the rules engine plus a basic table. Phase 2 (my partner) continues down the priority list.

## 9. Design problems found while building

Claude simulated 500 bot-only games. With a flat 10-chip ante, games averaged about **208
rounds**. It asked me how games should end:
- **My choice: rising ante.** The ante doubles every 3 rounds. After the change, simulated games
  average about 12 rounds.

Claude noticed that "improve its poker rank" (bot rule 1) was ambiguous, because any extra card
adds a kicker. It asked what should count:
- **My choice: category upgrade only.** Bots steal only if the hand type goes up (e.g. high card
  → pair).

Both changes were added to SPEC.md and marked as post-testing additions.

## 10. Documentation

> make sure to add conversation log, but with this add in all the preferences I selected, and make sure to create a claude.md for the next user

That produced this file and `CLAUDE.md`. `CLAUDE.md` gives the next person's AI assistant
rules for staying inside this design: no rewrites, no ES modules or frameworks, keep the layer
boundaries, and run the tests.

---

## Notes for whoever inherits this

- **Code style:** Claude wrote all the code from the spec, with no line-by-line prompting. The
  structure was chosen deliberately: a rules engine with no DOM access, a read-only renderer,
  bot logic that returns decisions without applying them, and a thin controller. That way each
  remaining criterion maps to one file.
- **Verification:** Claude ran the engine tests (`node tests/run-tests.js`) and headless-Chrome
  screenshots after each step, plus a scripted full game through the UI functions. See the
  README for exactly what was and wasn't verified.
