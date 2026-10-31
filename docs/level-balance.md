# Level balance

Since a job is cleared only when **every** target is down (the 50% partial win is gone),
a level that clears only for a pixel-perfect placement turns into a wall. This pass measures
how much slack each campaign job gives around its recorded solution, then fixes the outliers.

## How it is measured

`tests/level-balance.test.ts` is an off-by-default probe that plays each level with real
Matter.js physics (the same `playSolution` harness the level tests use) with small mistakes
a player makes:

- **Placement:** every solution charge moved on a grid of −20…+20 px horizontally (5 px steps)
  and −15…+15 px vertically: 44 near misses per charge.
- **Timing:** each delay, the Fire moment (traffic jobs) and each detonator press moved by
  ±0.1 and ±0.2 s.
- **Wide misses** (shown separately): ±30/40 px and ±0.3/0.4 s.

A variant that the game would refuse (outside the zone, too close to another charge) is not
counted. **Clear rate** = share of the counted near-miss variants that still clear the job.
Crane-only Berlin jobs (`w7-01/03/04/06/08`) have no charge to misplace and show "—".

```bash
BALANCE=balance.json npx vitest run tests/level-balance.test.ts
```

`BALANCE_ONLY=w3-01,w4-09` limits the run to some levels. The whole campaign takes about two minutes.

**Blocks** counts the structural blocks (not anchored roads/viaducts and not protected buildings).
The difficulty column is `difficultyOf` from `src/core/difficulty.ts`.

## What was wrong

Almost every spike had the same cause: **the "down" rule meets a structure that lands upright.**
A target is down only when it ends at most 46% of its starting clearance above the ground
(`TUNING.downFraction`). Blocks are welded to each other and to the ground (`joints.ts`), so:

- **Two-storey towers** (w2-03, w4-02, w3-02): the ground floor goes, the upper storey drops
  as one welded piece and often lands upright on the rubble at 50–60% of its old height. Fixed
  by making the ground floor tall and the upper floor short, so even an upright landing is a
  real fall.
- **Single cut on concrete** (w3-01, w4-04): concrete columns survive a near miss (90%+ damage,
  still standing), and the far column stays welded to the ground, holding the deck as a
  cantilever. Fixed with wood columns close enough together that one blast cuts both sets of
  joints (w3-01), or a two-charge solution on a taller frame (w4-04, par was already 2).
- **Upright landings** (w3-04 crane, w4-09 dome): the whole top drops straight down on its
  wide base. Fixed with taller legs/drum under a shorter mast/dome.
- **Deck held by the far pier** (w1-07): concrete piers survive, the deck cantilevers from the
  other one. Wood piers on concrete footings now break cleanly; two lamp posts make it less bare.
- **Chain falls short** (w9-05): the second barrel's blast reached only the near leg of the
  depot. A third barrel closes the gap. (w9-08): the second cart often went off on the
  barrier rubble, short of the tower; the tower now stands 120 px closer.
- **Direction luck** (w4-07): the bell tower fell either way from the same spot. A low buttress
  on the right makes the left (the site side) the natural fall. Still the trickiest medium job (61%).
- **Footprint too tight for an easy job** (w4-02, w4-03): site widened / ratio eased.
  w4-03 is the implosion tutorial; its arcade is unchanged so the tutorial placement keeps working
  (that route went from 66% to 80%); the precision route moved only from 55% to 59%.

## Thin levels

33 jobs have 3–5 structural blocks (another 14 have none: pure traffic, tram and train jobs,
where the vehicles are the content). Most thin jobs are tutorials or single-idea jobs and
measure fine (w1-01, w2-01, w9-01 … at 100%). The weakest thin ones got richer layouts:

| Level | Before | After |
|---|---|---|
| w1-07 Köprü | two bare concrete piers, a deck | wood piers on concrete footings, two posts on the deck (8 blocks) |
| w3-02 Üç Kolon | one concrete storey (5) | tall wood ground floor and a short penthouse (8) |
| w3-04 Kule Vinci | two legs, platform, mast (5) | two-tier legs under a shorter mast (7) |
| w4-04 Mermer Sütunlar | two columns, a deck (4) | taller columns with an entablature (5), two-charge solution |

Candidates for a later richer pass (thin, fine to play, but visually plain): w1-04, w1-05,
w2-04, w2-05, w2-08, w4-06, w5-04, w5-05.

## Results

✱ = changed in this pass. Before/after use the same probe.

| Level | Difficulty | Charges / par | Blocks | Clear rate (before) | Clear rate (after) | Wide misses (after) |
|---|---|---|---|---|---|---|
| w1-01 | easy | 1 / 1 | 4 | 100% | 100% | 100% |
| w1-02 | easy | 1 / 1 | 8 | 97% | 97% | 50% |
| w1-03 | easy | 1 / 1 | 4 | 100% | 100% | 100% |
| w1-04 | medium | 1 / 1 | 4 | 100% | 100% | 100% |
| w1-05 | medium | 2 / 2 | 4 | 74% | 74% | 75% |
| w1-06 | medium | 1 / 1 | 6 | 83% | 83% | 50% |
| w1-07 ✱ | medium | 1 / 1 | 4 → 8 | 45% | 89% | 75% |
| w1-08 | hard | 1 / 1 | 4 | 100% | 100% | 50% |
| w1-09 | hard | 2 / 2 | 9 | 100% | 100% | 100% |
| w1-10 | hard | 2 / 2 | 15 | 57% | 57% | 25% |
| w2-01 | easy | 1 / 1 | 4 | 100% | 100% | 100% |
| w2-02 | easy | 1 / 1 | 7 | 91% | 91% | 50% |
| w2-03 ✱ | easy | 1 / 1 | 7 | 63% | 100% | 50% |
| w2-04 | medium | 1 / 1 | 3 | 100% | 100% | 100% |
| w2-05 | medium | 1 / 1 | 3 | 100% | 100% | 100% |
| w2-06 | medium | 2 / 2 | 6 | 100% | 100% | 100% |
| w2-07 | medium | 2 / 2 | 7 | 100% | 100% | 100% |
| w2-08 | hard | 1 / 1 | 3 | 100% | 100% | 100% |
| w2-09 | hard | 1 / 1 | 8 | 58% | 58% | 0% |
| w2-10 | hard | 2 / 2 | 11 | 88% | 88% | 83% |
| w3-01 ✱ | easy | 1 / 1 | 7 | 25% | 82% | 0% |
| w3-02 ✱ | easy | 1 / 1 | 5 → 8 | 48% | 82% | 100% |
| w3-03 | easy | 2 / 2 | 0 | 100% | 100% | 82% |
| w3-04 ✱ | medium | 1 / 1 | 5 → 7 | 43% | 100% | 100% |
| w3-05 | medium | 2 / 2 | 0 | 100% | 100% | 100% |
| w3-06 | medium | 1 / 1 | 7 | 89% | 89% | 100% |
| w3-07 | hard | 3 / 3 | 8 | 99% | 99% | 95% |
| w3-08 | expert | 3 / 3 | 0 | 96% | 96% | 69% |
| w3-09 | hard | 1 / 1 | 6 | 77% | 77% | 67% |
| w3-10 | hard | 3 / 3 | 4 | 100% | 100% | 78% |
| w4-01 | easy | 1 / 1 | 4 | 82% | 82% | 50% |
| w4-02 ✱ | easy | 1 / 1 | 7 | 23% | 82% | 75% |
| w4-03 ✱ | easy | 1 / 1 | 5 | 55% | 59% | 0% |
| w4-04 ✱ | medium | 2 / 2 | 4 → 5 | 41% | 86% | 57% |
| w4-05 | medium | 2 / 2 | 8 | 76% | 76% | 80% |
| w4-06 | medium | 1 / 2 | 3 | 98% | 98% | 50% |
| w4-07 ✱ | medium | 1 / 1 | 7 → 8 | 34% | 61% | 0% |
| w4-08 | hard | 2 / 2 | 6 | 65% | 65% | 67% |
| w4-09 ✱ | hard | 2 / 2 | 7 | 18% | 90% | 75% |
| w4-10 | hard | 2 / 3 | 11 | 48% | 48% | 17% |
| w5-01 | medium | 1 / 1 | 4 | 100% | 100% | 100% |
| w5-02 | medium | 2 / 2 | 8 | 99% | 99% | 80% |
| w5-03 | medium | 1 / 1 | 4 | 94% | 94% | 100% |
| w5-04 | hard | 1 / 2 | 5 | 98% | 98% | 100% |
| w5-05 | hard | 1 / 1 | 4 | 98% | 98% | 100% |
| w5-06 | hard | 1 / 1 | 0 | 100% | 100% | 100% |
| w5-07 | hard | 2 / 2 | 8 | 98% | 98% | 70% |
| w5-08 | expert | 1 / 1 | 4 | 90% | 90% | 100% |
| w5-09 | expert | 2 / 2 | 0 | 100% | 100% | 82% |
| w5-10 | expert | 1 / 2 | 5 | 77% | 77% | 100% |
| w6-01 | medium | 1 / 1 | 7 | 98% | 98% | 75% |
| w6-02 | medium | 1 / 1 | 6 | 62% | 62% | 75% |
| w6-03 | medium | 1 / 1 | 7 | 98% | 98% | 100% |
| w6-04 | hard | 2 / 2 | 8 | 81% | 81% | 71% |
| w6-05 | hard | 2 / 2 | 7 | 89% | 89% | 46% |
| w6-06 | hard | 1 / 1 | 7 | 71% | 71% | 75% |
| w6-07 | hard | 1 / 1 | 0 | 100% | 100% | 62% |
| w6-08 | expert | 2 / 2 | 14 | 86% | 86% | 47% |
| w6-09 | expert | 1 / 1 | 4 | 98% | 98% | 67% |
| w6-10 | expert | 2 / 2 | 31 | 61% | 61% | 71% |
| w7-01 | medium | 0 / 1 | 7 | — | — | — |
| w7-02 | medium | 1 / 1 | 4 | 100% | 100% | 25% |
| w7-03 | medium | 0 / 1 | 7 | — | — | — |
| w7-04 | hard | 0 / 1 | 7 | — | — | — |
| w7-05 | hard | 1 / 1 | 4 | 84% | 84% | 100% |
| w7-06 | hard | 0 / 1 | 6 | — | — | — |
| w7-07 | hard | 1 / 1 | 4 | 96% | 96% | 0% |
| w7-08 | expert | 0 / 1 | 5 | — | — | — |
| w7-09 | expert | 1 / 1 | 5 | 100% | 100% | 0% |
| w7-10 | expert | 2 / 2 | 25 | 40% | 40% | 29% |
| w8-01 | medium | 1 / 1 | 0 | 100% | 100% | 100% |
| w8-02 | medium | 2 / 2 | 0 | 100% | 100% | 100% |
| w8-03 | medium | 1 / 1 | 0 | 100% | 100% | 62% |
| w8-04 | hard | 2 / 2 | 4 | 100% | 100% | 100% |
| w8-05 | hard | 0 / 1 | 0 | 100% | 100% | 100% |
| w8-06 | hard | 1 / 1 | 0 | 98% | 98% | 83% |
| w8-07 | hard | 2 / 2 | 0 | 100% | 100% | 100% |
| w8-08 | expert | 1 / 1 | 0 | 100% | 100% | 100% |
| w8-09 | expert | 2 / 2 | 0 | 100% | 100% | 100% |
| w8-10 | expert | 2 / 2 | 4 | 80% | 80% | 80% |
| w9-01 | medium | 1 / 1 | 4 | 100% | 100% | 100% |
| w9-02 | medium | 1 / 1 | 4 | 100% | 100% | 100% |
| w9-03 | medium | 2 / 2 | 8 | 100% | 100% | 100% |
| w9-04 | hard | 2 / 2 | 8 | 66% | 66% | 20% |
| w9-05 ✱ | hard | 1 / 1 | 4 | 23% | 100% | 100% |
| w9-06 | hard | 1 / 1 | 4 | 100% | 100% | 100% |
| w9-07 | hard | 2 / 2 | 8 | 69% | 69% | 0% |
| w9-08 ✱ | expert | 2 / 2 | 5 | 50% | 90% | 20% |
| w9-09 | expert | 3 / 3 | 12 | 98% | 98% | 75% |
| w9-10 | expert | 2 / 2 | 8 | 89% | 89% | 50% |

## Notes

- **First jobs are easy:** every city's first job now clears for at least 82% of near misses
  (w3-01 was at 25%).
- **Finales:** the finale is the least forgiving job in Ankara, Rome, Tokyo, Istanbul, Berlin
  and Madrid. In Paris (88%), London (100%) and New York (89%) the finale is forgiving on aim
  but is the hardest to *plan* (three charges and delays, or a loadout). Making them less forgiving
  would make stuck players more likely under the strict rule, so they were left as they are.
- **Still below 60% on purpose:** w7-10 (Berlin finale, 40%) and w4-10 (Rome finale, 48%).
  The hint after 2 failures and the solution after 4 (`play-controller.ts`) cover these.
- Physics here is chaotic: a 5 px change can flip the result, so read single-digit
  differences as noise. 44 samples per charge keeps the error to roughly ±10 points.
