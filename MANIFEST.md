# HouseBets Baccarat — Consolidated Audit Overview (new engine)

**Release:** `v1.0.0` (the first public release) · **Audit ID:** PF-2026-HB02 · **Auditor:** ProvablyFair.org · **Framework:** 1.1

`v1.0.0` is the first public release of this audit, published as one commit; the machine-readable release identity is
[RELEASE-MANIFEST.json](RELEASE-MANIFEST.json). The written algorithm is [docs/ALGORITHM.md](docs/ALGORITHM.md). Verdict of record: the one `node verify.js`
prints. The profile it runs is `games/baccarat/profile.json` version `1.0.2-public`: `1.0.0` as approved on 14 Oct 2026 (Methodology v1.1; DL-5), with the generated status fields removed (1.0.1), that adoption recorded in the file (1.0.2) and its internal working notes removed for publication (1.0.2-public), checks unchanged.
Audit report: https://audit.provablyfair.org/casino/housebets/games/baccarat/overview · public repository:
https://github.com/ProvablyFair-org/housebets-baccarat.
Framework 1.1 (Methodology v1.1, 14 Oct 2026): RTP-CLAIM 1.2.0 is switched on, so an RTP figure overstated on the
house side is reported as **RTP FIGURE OVERSTATED** (exit 5), never NOT PROVABLY FAIR; exit codes under
[Reproduce the audit](#reproduce-the-audit).

## Contents

[Conclusion and scope](#conclusion-and-scope) · [Dataset and capture](#dataset-and-capture) ·
[Game and algorithm](#game-and-algorithm) · [Payouts and RTP](#payouts-and-rtp) ·
[Verification results](#verification-results) · [Fairness-integrity matrix](#fairness-integrity-matrix) ·
[Player verifiers](#player-verifiers) · [Reproduce the audit](#reproduce-the-audit) · [Evidence](#evidence) ·
[Limitations and trust](#limitations-and-trust) · [Release history](#release-history)

## Conclusion and scope

**PROVABLY FAIR — Full Pass.** Of the profile's 31 checks, 30 pass and 1 is informational (BACCARAT-22); none fails and
none is flagged. The max-win
cap branch was never exercised; BACCARAT-14 declares it unwitnessed (DL-11), which its rule allows. Two rules panel sentences differ from what the server does ([operator findings OF-1 and OF-2](#operator-finding)):
OF-1 is still in the copy of the bundle fetched on 19 Oct 2026 (E08), where OF-2 is corrected (bundle last modified 16 Oct 2026; that the live page loads this bundle is inferred, not observed, as for E02); both reported, not scored.

Each of the 7,300 rounds in this package (the 6,500-round Phase A capture and the three supplementary sets) recomputes
exactly from its revealed server seed under the algorithm HouseBets publishes: the six cards off a freshly shuffled 8-deck
shoe, the tableau, the outcome, and the settlement of every spot staked — its payout to the last 1e-8 unit and its served
win / lose / push label. Each of the 7,300 rounds appears in the platform's own bet history with the same stake and payout.
Each shuffle step is exactly uniform over its range given uniform 32-bit inputs (rejection sampling with a threshold that is a
multiple of the range, BACCARAT-08). An exact enumeration of the deal reproduces all 23 probabilities the server publishes,
and every one of the nine spots returns exactly 99/100 before the payout is floored to 1e-8, as the game page says. Two
rules panel sentences do not match what the server does. The panel says payouts are floored once per round, the server
floors each spot (consistent with its fairness answer, which says every payout is rounded down once), which pays less than a single floor would on 2,785 of the 6,500 Phase A
rounds, by 3,286 × 1e-8 USDT in all ([operator finding OF-1](#operator-finding), still in the 19 Oct copy of the bundle, E08). The rules panel text in the 10 Oct 2026
copy of the bundle (E02; that the live page used this copy during the capture is inferred, not observed, DL-6) said the Banker draws on 0–5 when the Player stood on a natural; the fairness answer (E01) and
the server end the round on any natural: no Banker card was dealt in any of the 835 captured rounds with a Player natural
against a Banker 0–5, and the panel's note would have changed the result of 90 of them ([operator finding
OF-2](#operator-finding), corrected in the 19 Oct copy of the bundle, E08). Replaying every one of the 146 revealed
seeds (130 Phase A, 6 at 2.00, 6 at $10, 4 player-set) over 10,000 nonces each finds no early-window deficit (z 0.663,
p 0.7463; Phase A alone z −0.222). The statistic is the money staked and paid, so the higher-stake sets weigh most in it:
it detects an 11.64 pp RTP deficit on the amount staked at 80 % power (5.85 pp over the Phase A seeds alone, before the
widening), and a smaller or partial selection is not excluded (BACCARAT-21).

Scope: HouseBets House Games **baccarat** on the October 2026 engine (fairness version `shoe8`), the USDT wallet, all nine
spots (Player, Banker, Tie, Player Pair, Banker Pair, Either Pair, Perfect Pair, Player Dragon, Banker Dragon). Not in
scope: other House Games (their own packages), the security of the platform, and anything a client-side capture cannot reach
(server-side code, concurrency inside the server).

## Dataset and capture

| file | what | rounds | seeds |
|---|---|---|---|
| `data/housebets-baccarat-6500rounds.json` | **Phase A, primary**: 130 whole seed pairs of exactly 50 rounds, 0.02 USDT per spot staked, 12 Oct 2026 17:07–19:52 UTC (BACCARAT-05 prints each set's window) | 6,500 | 130 |
| `data/supplementary/housebets-baccarat-phaseC-300rounds.json` | **Phase C**: Banker only at 2.00 (100 × the Phase A stake), 13 Oct 2026 11:53–11:59 UTC | 300 | 6 |
| `data/supplementary/housebets-baccarat-phaseC-10usd-300rounds.json` | **Phase C, $10 set**: Banker only at 10.00, 13 Oct 2026 12:41–12:43 UTC | 300 | 6 |
| `data/supplementary/housebets-baccarat-phaseD-200rounds.json` | **Phase D**: one auditor-typed client seed per pair, 0.02 per spot, 13 Oct 2026 12:00–12:03 UTC | 200 | 4 |

The capture ran inside a logged-in browser tab on an account opened for the audit, placing rounds through the game's own
API calls. For every seed pair it read the pair (the hash of the server seed and the hash of the next one), drew the client
seed from `node:crypto randomBytes(16)` after reading the hash, except on the 4 Phase D pairs, whose client seeds were chosen before the capture (DL-2), played 50 rounds, read the server's nonce count, and rotated
(`POST /housegames/change_seed`), whose answer reveals the server seed. A pre-capture read anchors the chain before the first
pair and a post-capture read closes it after the last.

Phase A's spot sets come from a CSPRNG plan (`crypto.randomInt`, Fisher–Yates; `src/loader.ts` PLAN_SUBPHASES): 4,333 rounds
staking all nine spots, 1,300 staking one spot and 867 staking three, so every spot was staked on 4,750–4,793 rounds. The
plan's split was adjusted once, 586 rounds in (`meta.planChange`), so that every seed pair holds exactly 50 rounds (DL-1).
Phase D mixes the same three kinds of spot set (133 / 40 / 27 rounds, BACCARAT-15).

A 450-round pilot run on the same engine and account (12 Oct 2026, 13:41–13:44 UTC, before Phase A) is not part of this
audit's population; E05 lists it with the account's other datasets.

**Capture scripts.** `capture/` holds reference copies of the capture scripts: `capture-hb-baccarat.mjs` (the rounds, the
spot plan, the seed reads and rotations), `hb-card-common.mjs` (the seed-pair epochs, the commitment witnesses and the
rotations) and `hb-capture-lib.mjs` (the client-seed generator, `csprngClientSeed`: `node:crypto randomBytes(16)`, and the
output scrubber). Each dataset's `meta.captureScript` records the sha256 of the game script it ran: the three
supplementary sets `0a4584bb…`, Phase A `5894e82f…`. Every file in `capture/` is a reference copy, redacted (the comment lines
that name internal working files or notes are reworded; code unchanged), never the as-run file: the supplementary sets'
as-run script (`0a4584bb…`, the file `capture-hb-baccarat.mjs` was made from) is held privately, and Phase A's as-run script
(`5894e82f…`) was not kept. The other two files carry no recorded sha256; their as-run copies were not kept. They are a reference record of the method, not a runnable tool (their imports follow the capture workshop's
layout, and they need the account's session).

## Game and algorithm

From HouseBets' published spec (E01, the fairness answer recorded with the capture) and the rules panel text in the game's
page code (E02, cut from the baccarat game bundle; that the live page loads that bundle is inferred, DL-6). Where the two
differ the server follows E01 (OF-1, OF-2):

- **Shuffle.** `block_i = HMAC-SHA256(key = serverSeed as UTF-8, message = "clientSeed:nonce:i")`, read as big-endian 32-bit
  numbers `u`. The shoe is `[0 … 415]` with entry k holding card id `k mod 52`. Fisher–Yates from the top: for k = 0 … 414,
  n = 416 − k, draw `u`, redraw while `u ≥ 2^32 − (2^32 mod n)`, `j = k + (u mod n)`, swap. Cards are dealt shoe[0],
  shoe[1], … A round uses at most six cards, and the first six positions are final after six steps (BACCARAT-09 checks the
  six-step shuffle against the full 415-step one). The five worked examples E01 publishes, read from E01 when the verifier
  runs, re-deal card for card.
- **Cards.** Rank `id mod 13` (A 2 … 9 T J Q K), suit `floor(id / 13)` (S H D C); A = 1, 2–9 face value, T/J/Q/K = 0.
- **Deal** (E01, verbatim): "deal order P1 B1 P2 B2: Player shoe[0], shoe[2]; Banker shoe[1], shoe[3]; then each third card
  the rules call for takes the next card (the Player's third first)" · "a two-card total of 8 or 9 either side (a natural)
  ends the round" · "else Player draws its third on 0..5, stands on 6..7" · Banker "draws by the Player-third-card rule (bt
  0..2 always; 3 unless v=8; 4 on 2..7; 5 on 4..7; 6 on 6..7; 7 never)". The rules panel text in the 10 Oct 2026 copy of the
  bundle (E02 `rulesBankerFine`; its use on the live page during the capture is inferred, DL-6) has the Banker draw on 0–5 "when the player stood (natural or 6–7)"; the server ends the round on
  any natural, as E01 says, and the copy of the bundle fetched on 19 Oct (E08) says so too (OF-2).
- **Commitment.** The hashed server seed shown before the rounds is `sha256` of the seed's UTF-8 text (146 of 146 revealed
  seeds, BACCARAT-01); each pair also shows the hash of the next seed, and the chain links (BACCARAT-02).
- **Nonces** start at 1 on a fresh pair and count every round (BACCARAT-04).
- **Bias.** Every range n = 416 … 2 has its threshold `2^32 − (2^32 mod n)`, a multiple of n, so each accepted step is exactly
  uniform; the largest chance that a step redraws is 9.45 × 10^-8. No redraw occurred in the 7,300 captured rounds; Pass 1 saw
  0 in 6,000,000 draws (BACCARAT-08, BACCARAT-20).

## Payouts and RTP

- **Pays.** Each spot pays a fraction the server publishes (E01 `pays`), e.g. Banker 349436473927743/179082231752960 (about
  1.9513×), Tie 128864955540321/12386130897740 (about 10.40×), Player/Banker Pair 8217/620 (13.2532…×). A Dragon Bonus pays
  `stake × (kDen + kNum × m) / kDen` at rung m = 1 for a natural win and 30, 10, 6, 4, 2, 1 for a non-natural win by 9 … 4
  points. Each spot's payout is floored once to the wallet's 1e-8 unit, consistent with E01 ("every payout is rounded down
  once") and as the server does on 7,300/7,300 rounds; the rules panel (E02) says "a floor per round", which the server does
  not do (OF-1).
- **Pushes.** Player and Banker return the stake on a tie (922 of 922 in the data); a Dragon Bonus returns the stake on a
  natural tie (149 of 149) and loses on any other tie (782 of 782). BACCARAT-14.
- **Cap.** The max win is a cap on what a round wins above its stake (E08, the bundle fetched 19 Oct 2026, rulesMaxWinCap: "Most a spin can win above its
  stake: {cap}"). The largest pay of any one spot at the 20,006.20192259 maximum bet is 703,173.96780127 (Banker Dragon, win
  by 9), 683,167.76587868 above the stake, under the 1,000,310.0961298 max-win cap (E03); every answer names that cap
  (`maxWin`, 7,300/7,300). E03 does not say whether the maximum bet is per spot or per round. If per spot, a round with all
  nine spots at the maximum can pay up to 2,002,330.18246287 (Banker by 9 with a perfect pair, both pairs), 1,822,274.36515956
  above its stake, and the winnings above the stake first exceed the cap at 10,982.10354654 per spot; if per round, no round
  can win more than 683,167.76587868 above its stake, since a round pays at most its total stake times its best spot's
  multiple. The capture's largest round paid 19.51262671, so what the server does at the cap (refuse the bet or cap the pay)
  was never observed: BACCARAT-14
  declares that branch unwitnessed (DL-11) and passes, as its rule allows. The game client, read in the bundle E02 is cut from (`platform-housegames-baccarat-game.js`,
  sha256 `1c38b483…`), checks the round's total stake, not each spot, against the minimum and maximum bet (`Ba` sums every
  spot into `w.total`; `Cu` passes it to `gf`), and blocks a bet whose best-case profit over the outcome classes exceeds the
  max win (`ff` with `ci`, code `payout-cap`), offering a stake scaled to fit (`Si`, `Zp`); that is the client, not the
  server, and the page loading that bundle is inferred.
- **RTP.** The figure appears in five places in our evidence: the rules panel text in the game's page code (E02
  `rulesPaysFine`, "Every spot returns exactly 99% of stake over the long run (1% house edge; no commission)"; the page loading
  that bundle is inferred, DL-6), and the fairness answer, the game settings the site loads (E01 `return` and `summary`, "99%
  on every spot", and E01 `rules`, "a spot's return never exceeds 99%"). HouseBets reworded the rules panel sentence after
  the capture: the live copy of the same bundle (fetched 19 Oct 2026, last-modified Fri, 16 Oct 2026 09:18:09 GMT) reads
  "Theoretical RTP before payout rounding: 99% (1% house edge; no commission)." (E08 `rulesPaysFine`, the fifth place).
  None was seen rendered. The verifier reads all five
  from the exhibits when it runs and holds every spot to the highest figure stated (99 %); nothing in `src/` copies it. The
  exact enumeration (all 416·415·414·413·412·411 ordered deals of six cards, 298 joint classes) gives every one of the nine
  spots an RTP of exactly 99/100 before the floor. Under the framework rule RTP-CLAIM 1.2.0 (switched on, Methodology v1.1)
  the claim holds (`outputs/rtp-claim-table.json`, BACCARAT-19 PASS), and the rule alone sets BACCARAT-19's status: a figure
  raised in any one place is RTP FIGURE OVERSTATED (exit 5), a lower figure in one place is not a miss. The 1e-8
  floor lowers a spot's return by at most 2.709 × 10^-7 (Player at the 0.01000311 minimum stake), which E01 states: "a spot's
  return never exceeds 99%" (DL-8).
- **Simulation.** 1,000,000 fresh-seed rounds at 1.00 on all nine spots: every spot's return lands within 5 SE + 1e-4 of its
  exact RTP (Player 0.9908, Banker 0.9892, Tie 0.9847, Player Pair 0.9938, Banker Pair 0.9900, Either Pair 0.9922, Perfect
  Pair 0.9903, Player Dragon 0.9913, Banker Dragon 0.9879; worst 1.75 SE). The bands are 5·σ/√n + 1e-4 with σ each spot's
  exact standard deviation (BACCARAT-20 prints them): Player ±0.487 pp, Banker ±0.474 pp, Tie ±1.536 pp, Player and Banker
  Pair ±1.752 pp, Either Pair ±1.218 pp, Perfect Pair ±2.671 pp, Player Dragon ±1.274 pp, Banker Dragon ±1.303 pp. **For 7
  of the 9 spots the band is wider than the 1 pp house edge, so the simulation cannot detect an edge of that size on those
  spots from this sample**; it checks the shuffle, the deal and the settlement end to end, and the RTP evidence is the exact
  enumeration (BACCARAT-18, 19). Live-round returns are variance only.

## Verification results

`node verify.js` runs the 31 checks of the framework's BACCARAT profile (`src/profile-map.ts`, generated from `games/baccarat/profile.json` 1.0.2-public, sha256
`47bb372f91578c3b3bdce9f7048709da034ce8457fd929a16a32ed22304d6d52`, vendored byte for byte as `profile/baccarat.profile.json`).
The step list is bound to that profile at run time: a check of the profile missing from `src/profile-map.ts`, or carrying
another policy there, prints `INCOMPLETE` and exits 3. 17 Nov 2026, Node 22.23.1, all 31 checks of the profile: **30 PASS,
0 FLAG**, **1 INFO** (BACCARAT-22), 0 GAP, 0 FAIL; package checks 7 of 7 PASS; verdict
**PROVABLY FAIR — Full Pass**. The verdict is decided by the 23 scored checks (HARD_FAIL and FLAG: 23 PASS), and bound to the profile: a run in which any of the 31 checks has no status prints `INCOMPLETE` and
exits 3, never a pass (the battery's deleted-step mutation M07d proves it). The full per-check output is
`outputs/verification-results.json`. That record holds every check of the run except BACCARAT-27, BACCARAT-28 and
BACCARAT-29, which attest the record itself: BACCARAT-27 compares it with the run, and BACCARAT-28 and BACCARAT-29 read the
gate records (`outputs/fresh-copy.json`, `outputs/mutation-results.json`), BACCARAT-28 also the record's own verdict; verify
prints those three and does not record them, so the record's summary (and RELEASE-MANIFEST.json's) counts 22 of the 23
scored passes.

| check | status | result |
|---|---|---|
| BACCARAT-01 seeds | PASS | 146/146 revealed seeds hash to their commitments (130 Phase A); 0 rounds on an unrevealed seed |
| BACCARAT-02 chain | PASS | Phase A 129/129 links, C 5/5, C $10 5/5, D 3/3; every set anchored before its first pair and closed by the pair active after it; E07: the active pair (Phase A's pre-capture pair) and its next hash (Phase A epoch 0's commitment) refused by `/unhash` at 13:59 UTC, before Phase A's first round at 17:07 UTC, a rotated-away hash answered with a seed that hashes to it |
| BACCARAT-03 / 04 | PASS / PASS | 146/146 pairs: one hash and client seed per pair; the capture's copy of each round and the server's round record == the server's answer 7,300/7,300, the round lookup == the answer 146/146; nonces exactly 1..50, N == the server's count |
| BACCARAT-05 population | PASS | 6,500 / 130 / 130 × 50 against code constants; C 300 (6 × 50), C $10 300 (6 × 50), D 200 (4 × 50) |
| BACCARAT-06 client seed | PASS | a wrong client seed changes the first four cards in 6,500/6,500 rounds (0 identical); Phase D 200/200 recompute under 4 player seeds, 200/200 differ under the previous seed; 142/142 seeds labelled as drawn from `node:crypto randomBytes(16)` (the label is checked); empty seed refused (E06) |
| BACCARAT-07 / 10 | PASS / PASS | cards 6,500/6,500 in deal order; totals and outcome 6,500/6,500; natural, margin, pair and perfect flags 6,500/6,500 |
| BACCARAT-08 | PASS | each shuffle step exactly uniform; the shuffle applies the threshold (synthetic stream); 0 redraws in the run |
| BACCARAT-09 (package) | PASS | 5/5 published examples (read from E01), 5/5 six-step == full shuffle, captured round idx 0 |
| BACCARAT-11 | PASS | 42,898/42,898 Phase A spot settlements; round payout, stake and the server's round record 6,500/6,500; Phase D 200/200; served win / lose / push labels 44,816/44,816; 224,098/224,098 money values on the 1e-8 grid; the served multiplier == payout / stake 7,300/7,300; OF-1 counted (2,785 of 6,500 Phase A rounds; 2,874 of 7,300 in all, 3,393 × 1e-8; at most 3 × 1e-8 in a captured round, 4 × 1e-8 possible with all nine spots at 0.02, 5 × 1e-8 at any stake), the E02 and E01 rounding sentences quoted from the exhibits |
| BACCARAT-12 | PASS | Phase C 300/300 (146 Banker wins) and the $10 set 300/300 (145 wins) recompute and pay by the same fraction |
| BACCARAT-13 | PASS | every winning spot paid by its published fraction: Player 2,171, Banker 2,555, Tie 460, Player Pair 378, Banker Pair 378, Either Pair 719, Perfect Pair 151, Player Dragon 1,405, Banker Dragon 1,433 |
| BACCARAT-14 | PASS | one spot at the max bet pays under the cap; every answer names the cap; the cap branch is reachable if the max bet is per spot and was never exercised, declared unwitnessed (DL-11); pushes as published (above) |
| BACCARAT-15 | PASS | plan met (4,333 × 9, 1,300 × 1, 867 × 3; Phase D 133 × 9, 40 × 1, 27 × 3); 23/23 outcome classes; every per-spot settlement class reached on the rounds that staked the spot; all five third-card branches; win margins 1–9 |
| BACCARAT-16 | PASS | 7,300/7,300 package rounds in the platform's bet history with the same stake, payout and status (E04); E05 checked by its numbers: 60 rows each net == paid − staked and summing to TOTAL, 86,979 = 86,966 + 0 + 13 with matched == TOTAL rounds, before == after − net + open stakes, and this package's four datasets equal their E05 rows; the one same-engine row not shipped (the 450-round pilot run) listed; DL-3's balance-step count emitted with its rule; the pass rests on that bet history and that account reconciliation: the comparison of consecutive balances the profile describes was not possible in this capture (DL-3) |
| BACCARAT-17 | PASS | the RNG message has no spot or stake field; cards recompute without the spots on 7,300/7,300 rounds, over 94 distinct Phase A spot sets and the Banker-only Phase C |
| BACCARAT-18 / 19 | PASS / PASS | enumeration == the 23 probabilities read from E01, negative controls rejected; 9/9 spots exactly 99/100 against the claim read at run time from E02, E01 and E08 (five places, 99 % each), 0 house-side beyond the 0.1 pp band; the E02 rounding sentence compared with the served per-spot floors (OF-1) |
| BACCARAT-20 | PASS | 1,000,000 rounds: card uniformity at positions 0–5 p 0.808/0.867/0.842/0.448/0.938/0.130, lag-1 z 0.60, runs z −1.91; 23/23 outcome classes and 9/9 spot RTPs inside their bands (7 of 9 spot bands wider than the 1 pp edge) |
| BACCARAT-21 | PASS | every revealed seed, 146 (Phase A 130, C 6, C $10 6, D 4) × 10,000 nonces: early-window z 0.663, p 0.7463 over the 7,300 played rounds (Phase A alone z −0.222, C 1.299, C $10 0.431, D 0.566); 76 pairs below expectation, 70 at or above; power: an 11.64 pp RTP deficit on the amount staked at 80 % |
| BACCARAT-22 | INFO | 6,500 live rounds: Banker 2,976 / Player 2,890 / Tie 634, chi² 0.43 p 0.805 |
| BACCARAT-23 (package) | PASS | the S5-MATRIX block below: 8/8 rows with the framework's ids and names in order, each with a status (Pass 7, Not tested 1) |
| BACCARAT-24 (package) | PASS | `site-verifier/derive.js`, sha256 `8dc6a04274c84df1c68bebf3e75708d19c3c527529a108e327b607e549c83d21`, generated from `src/rng.ts`: equals its pins (`src/artifact-pins.ts`, RELEASE-MANIFEST.json) and returns what `src/rng.ts` returns on all 7,300 captured rounds (29,762 calls, 0 differing results; [Player verifiers](#player-verifiers)) |
| BACCARAT-25 (package) | PASS | README "Verify a bet": where the seed is revealed, the fields, the commitment encoding and the shuffle, 6/6 markers |
| BACCARAT-26 / 27 | PASS / PASS | 4 datasets, 8 exhibits and 3 artifacts match their pins; the paytable in code == E01 and the limits in code == E03, read at run time; regenerated census, RTP table and verification record == committed |
| BACCARAT-28 / 29 (package) | PASS / PASS | read the committed run records `outputs/fresh-copy.json` and `outputs/mutation-results.json`, pinned in `src/artifact-pins.ts` and RELEASE-MANIFEST and bound to this `tests/verify.ts`; 29: 59/59 mutations killed, including the deleted-step (M07d), forged server-answer (M03b, M04, M11c), RTP-figure-overstated (M19o: the figure raised in E02, E01 and E08; M19e: in E02 alone; M19l: in E08 alone; all three exit 5), profile-binding (M07p exit 3, M11r), Pass 2 narrowed back to Phase A (M21c) and S5 row renamed (M23) mutations, the exhibit-side ones (M09, M18, M26e) and M19p (a reached Tie cell lowered: -19 OVERSTATED, exit 1 because the captured settlements fail), and 1/1 control held (M19b: E02 at 97 %, player side, stays Full Pass); 28: the fresh-copy record reproduces and the audit ID is PF-2026-HB02; a record that is missing or is not the bytes its pin names prints FAIL and fails the verdict (exit 1) |
| BACCARAT-30 (package) | PASS | 13 declared-limitation rows, the load-bearing premises, every exhibit E01…E08 listed by file name |
| BACCARAT-31 | PASS | side bets recomputed on every round that carries them (Phase A + D): Player Pair 4,909, Banker Pair 4,940, Either Pair 4,917, Perfect Pair 4,901, Player Dragon 4,931, Banker Dragon 4,904 |

**BACCARAT-14 is scored by the profile's rule text.** Its rule asks that "every quoted pay lies within the declared max-win
cap" and that the push rules be "declared and witnessed in data where the capture holds them", a violation disclosed, not
failed. Every quoted pay lies within the cap, every push rule is witnessed (922 ties, 149 natural ties, 782 other ties), and
the cap branch, reachable within the bet limits if the maximum bet is per spot, was never exercised and is declared
unwitnessed (DL-11): the rule does not ask for that branch to be exercised, so the check passes.

### False-alarm rates

Pass 1 screens at α/8 = 0.00125 each (six position screens, lag-1, runs); outcome classes and spot RTPs at 5σ + 1e-4. Pass 2
0.0097 ± 0.000438 (`src/false-alarm-pass2.ts`, 50,000 replicates drawn from the exact joint distribution over the 7,300
played rounds, DL-7) — consistent with the 1 % cap for a failing step (95 % upper bound 0.0105, BACCARAT-21), not shown to
be under it. Pass 2 replays every revealed seed of the package, all 146; on the 130 Phase A seeds alone, with the same rule, window
and threshold, it gives z −0.222, p 0.4122.

## Fairness-integrity matrix

S5: fairness-integrity matrix.

<!-- S5-MATRIX:BEGIN -->
| Test ID | Category | What the framework tests | Result | Tied to |
|---|---|---|---|---|
| S5-1 | Replay protection | A completed bet ID cannot be replayed to duplicate a payout | Pass | HB-BACCARAT-REPLAY-001, HB-BACCARAT-IDEMP-001, HB-BACCARAT-IDEMP-003: Identical bets sent in parallel, with and without a shared request key, settled one round per pair, and a bet abandoned by the client and retried with the same key returned its round with no second debit. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no replay request was sent during the capture. Observed only: each of the 7,300 rounds settled once and is in the platform's bet history with one stake and one payout (BACCARAT-11, 16). DL-13 |
| S5-2 | Input validation | Invalid, out-of-range or malformed parameters are rejected | Pass | HB-BACCARAT-PARAM-001, HB-BACCARAT-PARAM-004, HB-BACCARAT-SEED-001: Unknown, padded, wrong-case and malformed spots, mistyped bets and bets naming one spot two or three times were rejected; empty, omitted, oversized and whitespace client seeds were refused. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: the capture sent only valid bets. Observed only: an empty client seed was refused, HTTP 400, the seed pair unchanged (E06, BACCARAT-06). DL-13 |
| S5-3 | Seed integrity under adversarial input | Server and client seed fields cannot be injected or overridden via the API | Pass | HB-BACCARAT-MAXWIN-002: A bet carrying injected outcome, payout, multiplier, hand, deck, seed and round fields was rejected at validation and nothing was reflected; the control bet settled as published and recomputed from the revealed seed. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no injection was attempted. Observed only: every round's answer carries its pair's committed hash and client seed (BACCARAT-03), and the 4 player-set Phase D seeds are the ones the cards were computed with (BACCARAT-06). DL-13 |
| S5-4 | Cross-player isolation | One player's seeds, nonces or outcomes are not observable or influenced by another | Pass on 1 of 2 controls; 1 not tested | HB-BACCARAT-AUTH-001: Bets carrying foreign and malformed user identifiers were rejected; the control bet stayed in the caller's own seed and balance chain and no bet was attributed to another account. Not covered: observation by another account was not tested; influence was tested from one account, by sending another account's identifier. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: single account (P-4). DL-13 |
| S5-5 | Payout field integrity | Client-supplied payout or multiplier values are ignored by the server | Pass | HB-BACCARAT-MAXWIN-002: A bet carrying injected outcome, payout, multiplier, hand, deck, seed and round fields was rejected at validation and nothing was reflected; the control bet settled as published and recomputed from the revealed seed. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: the capture never sent a payout or multiplier field. Observed only: every staked spot's payout and result label equals the settlement recomputed from the cards and the published fraction (BACCARAT-11, 13, 31). DL-13 |
| S5-6 | Nonce sequence enforcement | Nonces cannot be forced, replayed or skipped via the API | Pass | HB-BACCARAT-NONCE-001, HB-BACCARAT-NONCE-002, HB-BACCARAT-NONCE-003, HB-BACCARAT-NONCE-004, HB-BACCARAT-RACE-001, HB-BACCARAT-RACE-003: Bets carrying reused, skipped-ahead, boundary and malformed nonces, and overflow-sized nonces, were rejected at validation and the sequence continued by one; under parallel bets, with the same or different spots, accepted nonces were unique and in sequence. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no nonce was supplied by the client. Observed only: 146/146 pairs run exactly 1..50 with the server's count equal to 50 (BACCARAT-04). DL-13 |
| S5-7 | Parameter boundary enforcement | Bet amounts, configuration values and game parameters outside valid ranges are rejected | Pass on 1 of 2 controls; 1 not tested | HB-BACCARAT-MAXWIN-001, HB-BACCARAT-PREC-001: An extremely small and an extremely large stake, and positive stakes below the minimum, were refused; the balance moved only by the control bet. Not covered: no test sent a configuration value or game parameter outside a range (the spot is not a ranged value: S5-2). Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no out-of-range stake or spot was sent, and the max-win cap branch was not exercised (DL-11). Observed only: every answer names the cap, equal to E03 (BACCARAT-14). DL-13 |
| S5-8 | Game-specific state | For Baccarat: a bet on a round already settled, a spot added or changed after the deal | Not tested | None was attempted. Baccarat settles a round in the answer to its bet (EC-5). DL-13 |
<!-- S5-MATRIX:END -->

Of the eight framework rows, **5 pass on every control the row names**, **2 pass on part of the controls they name** (S5-4,
S5-7: the row's status says how many of its controls were tested, and its evidence cell what was not) and **1 remains Not
tested** (S5-8). The passing rows rest on fairness-integrity tests run separately on HouseBets' running service by
ProvablyFair.org; they are recorded in the ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing),
not in this package's data, so nothing in this package reproduces them. The matrix names 16 of that section's 25 tests, each
under the row whose control it tests; the other 9 tests check controls outside these eight rows and are in the report only.
This package's own capture recorded normal play and sent no adversarial request to HouseBets' API. The "Observed only" notes
state what the captured data shows; none substitutes for the adversarial test, and reproducing a test from this package
needs a deliberate probe capture (DL-13).

The offline consistency checks are this audit's own ids, not the framework's S5 rows (they were numbered S5-1 … S5-8 before
release, which collided with the framework ids):

| Check | Category | What was tested | Result | Finding |
|---|---|---|---|---|
| EC-1 | Seed substitution | Can a revealed seed be swapped for a better one that still matches the commitment? | Pass | sha256 commitment shown before the rounds: 146/146 seeds hash to their commitments and the chains link in order from a pre-capture anchor to the pair active after the capture; these are consistency checks, the timing rests on the capture's reads before each pair (P-1). [BACCARAT-01, BACCARAT-02] |
| EC-2 | Client-seed manipulation | Does the client seed enter the derivation? | Pass | A different client seed changes the cards: 6,500/6,500 rounds deal different first four cards under a wrong client seed; Phase D 200/200 recompute under player-set seeds, 200/200 differ from the previous seed's cards. [BACCARAT-06] |
| EC-3 | Stake-conditional outcome | Do the captured higher-stake rounds replay and settle under the same published rules? | Pass | Stake enters only the payout: Phase C at 100 × the Phase A stake (300 rounds) and the $10 set (300 rounds) recompute and pay by the same fraction; the RNG message holds no stake or spot. [BACCARAT-12, BACCARAT-17] |
| EC-4 | Server-seed cherry-picking | Can the operator pre-select seeds unfavourable for the early nonces? | Pass | Player-chosen client seed after the commitment, no early-window skew: the cards depend on the client seed, set after the hash is shown (P-1): drawn after the read on 142 of 146 pairs; the 4 Phase D client seeds were chosen before the capture (DL-2), so the structural argument does not cover those pairs, which are in the Pass 2 screen; Pass 2 over all 146 revealed pairs × 10,000 nonces: early-window z 0.663, p 0.7463, detection power 11.64 pp on the amount staked. Nothing here rules out selection across the capture as a whole. [BACCARAT-21, BACCARAT-06] |
| EC-5 | Seed-rotation race | Can a rotation during an in-flight round change its seed? | Not tested | Each round settles on the seed committed when accepted: baccarat settles in one request; no round is pending against an unrevealed seed. The capture plays one round at a time per game, so a concurrent rotate/bet race was not exercised. |
| EC-6 | Pay tampering | Is any spot credited at a fraction other than the published one? | Pass | Published fraction, never read from the served field: every spot settlement recomputed from the cards and the E01 fraction, 42,898/42,898 Phase A, every supplementary round, all side bets; the paytable in code is compared with E01 before anything runs. [BACCARAT-11, BACCARAT-13, BACCARAT-31, BACCARAT-26] |
| EC-7 | Nonce manipulation | Are nonces skipped, reused or reordered? | Pass | Contiguous 1..N, N == server count: 146/146 pairs run exactly 1..50 with the server's count equal to 50. [BACCARAT-04] |
| EC-8 | Range-mapping bias | Does the digest-to-card map favour some cards? | Pass | Bias ≤ 2^-32: rejection sampling with a threshold that is a multiple of every range, bias 0; Pass 1 card uniformity at positions 0–5 in tolerance. [BACCARAT-08, BACCARAT-20] |

## Player verifiers

The ProvablyFair.org verifier for HouseBets is at
[provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets). The module it runs for this
game ships in this release as `site-verifier/derive.js`, sha256
`8dc6a04274c84df1c68bebf3e75708d19c3c527529a108e327b607e549c83d21`. The live verifier serves exactly these bytes.

**How the module is built.** `npm run build:site-verifier` (`scripts/build-site-verifier.mjs`, bun 1.3.9) bundles
`src/rng.ts` and the constants it imports from `src/spec.ts` into one ES module with no import, which exports the same
functions under the same names (`TWO32`, `fullShoe`, `limitOf`, `sha256Hex`, `shoeTop`, `shuffleTop`, `u32Stream`) and runs
in a browser and in Node. `src/rng.ts` takes SHA-256 and HMAC-SHA256 from Node; a browser page has no such module, so the
build puts its own implementation of the two inside the file. Nothing else differs from `src/rng.ts`. The same sources give
the same bytes: the file's header carries the sha256 of `src/rng.ts` and of `src/spec.ts` and no date, host or path, the bun
version is fixed, and `node scripts/release-manifest.mjs --check` rebuilds the module in a throwaway folder and requires the
shipped file to equal the rebuild byte for byte.

**What BACCARAT-24 checks, on every run.** The file on disk has the sha256 pinned in `src/artifact-pins.ts`
(`SITE_VERIFIER_PIN`) and in RELEASE-MANIFEST.json, and this document and the README quote it. The module is then loaded
from that file and run side by side with `src/rng.ts` on every captured round of the four shipped datasets: 7,300 rounds
and 146 revealed seeds, 29,762 calls over its seven exports, 0 differing results. Per round it compares the six-card
deal (`shoeTop`), the shuffle steps on the round's stream (`shuffleTop`), the first 16 values of the stream (`u32Stream`) and
the full 416-card shoe (`fullShoe`); `limitOf` is compared on every range from 2 to 416. Two mutations cover the check
(`tests/mutations.json`): M24a changes the swap position of the shuffle step inside the module and re-pins it everywhere, so
only the side-by-side run can catch it; M24b breaks the pin and leaves the module alone. To confirm the bytes a page serves,
compare the sha256 of the module it loads with the one above.

The README's "Verify a bet" steps and script check a round by hand, without the page. HouseBets' own
verify tab was not tested against this package (DL-6).

## Reproduce the audit

`node verify.js` on Node 22, or `npm test` on Node 22.6 or later, with nothing installed. Re-generation of the artifacts of record:
`npm run simulate` (the census, `outputs/simulation-results.json`), `npm run rtp-claim:write` (the RTP table),
`npm run record` (the verification record) — each re-pinned in `src/artifact-pins.ts` (and `src/rtp-settings.ts`) in the
same change. `npm run build:site-verifier` rebuilds `site-verifier/derive.js` from `src/rng.ts` and writes its pin.
`npm run false-alarm:pass2` re-runs the Pass 2 false-alarm Monte Carlo against its declaration.
`npm run mutate` runs the mutation battery in throwaway copies and writes `outputs/mutation-results.json`; `npm run
gate:fresh` runs the package from a fresh copy and writes `outputs/fresh-copy.json`; both are committed, pinned in
`src/artifact-pins.ts` (RUN_RECORD_PINS) and RELEASE-MANIFEST.json, and re-pinned in the same change (BACCARAT-28, 29 read
them). `npm run build:standalone` rebuilds `verify.js`, whose header carries the sha256 of every source it was built from;
`node verify.js` refuses to run, with no verdict, when one of those sources differs or is missing (exit 4). Rebuilding
needs Bun; running it needs only Node 22. Bun 1.3.9 built the shipped `verify.js`: its header says so ("Built with Bun
1.3.9") and RELEASE-MANIFEST.json records it (`toolchain.bun`). `node scripts/release-manifest.mjs --check` recomputes the
release manifest from the files on disk (it pins every file of the package except itself), rebuilds
`site-verifier/derive.js` from `src/rng.ts` in a throwaway folder (bun) and requires the shipped file to equal the rebuild
byte for byte, and prints OK or STALE; when STALE it names the files that differ, and when
`verify.js` is one of them it prints the Bun version that built the release's copy and the one on disk. Another Bun
version can emit different bytes from the same sources (local names in the bundle), so a STALE that names only `verify.js`
after a rebuild on another Bun is a toolchain difference; `node verify.js` still refuses to run if its sources changed.

A release-gate record that is missing or is not the bytes its pins name fails the verdict (exit 1), and every mutant copy
reads the fresh-copy record, so the records are regenerated in this order: `npm run build:standalone`, `npm run gate:fresh`,
re-pin `RUN_RECORD_PINS.freshCopy`, `npm run build:standalone`, `npm run release-manifest`, `npm run mutate`, re-pin
`RUN_RECORD_PINS.mutation`, `npm run build:standalone`, `npm run release-manifest`. BACCARAT-24 reads the module's pin
from RELEASE-MANIFEST.json, so after a change of `src/rng.ts` these come first: `npm run build:site-verifier`,
`npm run release-manifest`.

Exit codes of `node verify.js` / `npm run verify`, the same in all 11 HouseBets new-engine packages (the ranking of
RTP-CLAIM 1.2.0, `rtpClaimVerdict`): 0 PROVABLY FAIR — Full Pass · 2 PROVABLY FAIR — Conditional Pass · 5 RTP FIGURE
OVERSTATED · 3 INCOMPLETE (a profile check has no status, or the step list does not match the vendored profile) · 1 NOT
PROVABLY FAIR · 4 `verify.js` is a stale build of the sources beside it (no verdict). When
more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass.

## Evidence

| exhibit | file | role |
|---|---|---|
| E01 | `evidence/E01-baccarat-fairness-spec-2026-10-12.json` | the server's published baccarat spec (shuffle, cards, deal, rules, pays, Dragon rungs, 23 probabilities, five worked examples), as recorded with the capture |
| E02 | `evidence/E02-baccarat-rules-panel-2026-10-10.json` | the rules panel text (English), cut from the baccarat game bundle `platform-housegames-baccarat-game.js`, with the bundle's hash; that the live page loads this bundle is inferred, not observed (the workshop's `bundles/LIVE-BUNDLES.md`, not shipped, 10 Oct 2026: no "2" file exists for baccarat), and the capture meta's `bundleSha256` is a constant written into the capture script, not a reading from the page (DL-6) |
| E03 | `evidence/E03-baccarat-limits-2026-10-12.json` | the limits answer: minimum stake 0.01000311, maximum bet 20,006.20192259, max win 1,000,310.0961298 USDT, wallet decimals 8 |
| E04 | `evidence/E04-baccarat-bet-history-2026-10-13.json` | the platform's bet-history rows of all 7,300 package rounds |
| E05 | `evidence/E05-account-reconcile-2026-10-13.txt` | the full output (68 lines) of `python3 -I reconcile-full.py --ledger ledger/ledger-2026-10-13-final.json --before 986.84718000`, written by `scripts/make-evidence.py`, which keeps it only on exit 0 and a final RECONCILED; the script and the ledger are not shipped, so E05 is an exhibit, not re-derived here. It shows every captured dataset of the account with its rounds, staked, paid and net, among them the 450-round baccarat pilot run of 12 Oct, which is not part of this audit's population; 86,979 history entries = 86,966 captured rounds matched exactly + 0 open + 13 from 10 Oct, unexplained 0; the wallet balance after (914.19723945) and the balance before derived from it as after − net + open stakes (986.84718000); RECONCILED. BACCARAT-16 checks its arithmetic and this package's four rows against the datasets |
| E06 | `evidence/E06-baccarat-empty-seed-control-2026-10-13.json` | the server's answer to an empty client seed: refused, HTTP 400, seed pair unchanged |
| E07 | `evidence/E07-seed-reveal-check-2026-10-12.json` | `/unhash` on the baccarat pair, 12 Oct 2026 13:59 UTC, with the hashes queried and the answers: the active hash (`ca566218…`, Phase A's pre-capture pair) refused (500 `seed_is_still_active`), its next hash (`2b7a4d45…`, Phase A epoch 0's commitment) refused (404), a rotated-away hash of the 450-round pilot run (`ec2041dd…`) answered with a seed that hashes to it (BACCARAT-02) |
| E08 | `evidence/E08-baccarat-rules-panel-live-2026-10-19.json` | the same rules panel text in the live copy of the baccarat bundle, fetched 19 Oct 2026 (last-modified Fri, 16 Oct 2026 09:18:09 GMT, sha256 and etag recorded), with every key changed since E02 (rulesPaysFine's RTP sentence reworded; rulesBankerFine corrected to end the round on a natural, OF-2; a new Limits section: Min bet, Max bet and the max-win cap); that the live page loads this bundle is inferred, as for E02 |

`scripts/make-evidence.py` records the source path and sha256 of each exhibit; `scripts/make-live-rules.py` builds E08 from the
live bundle copy of 19 Oct and stops unless its reading reproduces every key of E02 from the 10 Oct copy.

## Limitations and trust

### Load-bearing premises

| ID | Premise | Why it holds | Witness artifact | Could the data contradict it? |
|---|---|---|---|---|
| P-1 | Each commitment was shown before its rounds. On the 142 of 146 pairs whose client seed the capture drew (every pair outside Phase D), the seed was drawn after the commitment was read; the 4 Phase D client seeds were chosen before the capture (DL-2), and each of their commitments was read before the pair's first round | The capture read the hash, then drew the seed, then played; read and draw times logged per pair | each dataset's `seeds[].clientSeedDrawnAfterCommitment` and `meta.commitmentWitnesses` | Partly: a commitment that did not match its revealed seed would fail BACCARAT-01; the order of reads is the capture's record, not the server's |
| P-2 | E02 is the text players see | E02 is cut from the baccarat game bundle; that the live page loads this bundle is inferred (`bundles/LIVE-BUNDLES.md`: "inferred" for baccarat, no "2" file exists), not checked on the page; the capture meta's `bundleSha256` equals the bundle's hash only because the capture script carries it as a constant | E02 `source.sha256` and `source.loadedByLivePage` | No: the rendered panel was not captured and the page's script tag was not read; a different panel would not show in the data |
| P-3 | E01 is the spec the server applies | Every card, total, outcome and spot settlement of 7,300 rounds recomputes from it | E01; BACCARAT-07, 10, 11, 13, 31 | Yes: one round dealt or paid any other way would fail BACCARAT-07, 10, 11, 13 or 31 |
| P-4 | The account was used only by the capture | E05 shows the history holding the captured rounds and 13 earlier bets, nothing else | E05 (an exhibit; its arithmetic checked by BACCARAT-16) | Yes: any other bet would be an unexplained history entry |

### Declared limitations register

| ID | Limitation | Effect | Closure / evidence |
|---|---|---|---|
| DL-1 | The Phase A plan's split was adjusted 586 rounds into the capture (from 4,350 / 1,305 / 870 to 4,333 / 1,300 / 867) so that 6,500 rounds fill whole 50-round pairs | Verdict-neutral: the spot sets stay CSPRNG-drawn; BACCARAT-15 holds the data to the adjusted plan in code | `meta.planChange` in the dataset records the time, the counts and the reason |
| DL-2 | Phase D client seeds are predictable strings chosen by the auditor (`provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890`) | All 4 Phase D pairs are exposed to an operator who could foresee them; Phase D tests recomputation, not unpredictability | Phases A–C client seeds are labelled in the capture as drawn from `node:crypto randomBytes(16)` (142/142; BACCARAT-06 checks the label, not the randomness) |
| DL-3 | The per-round balance field cannot be checked round to round: other games were captured on the account at the same time. Of the 6,471 consecutive Phase A answers that both carry the 4-dp balance (14 carry none), the balance step equals the round's own payout − stake within 1e-4 (the resolution of the difference of two 4-dp readings) on 79 and does not on 6,392 (BACCARAT-16 prints both) | Reconciliation uses the platform history (E04) and the account reconciliation (E05) instead | E05 RECONCILED; its arithmetic checked by BACCARAT-16 |
| DL-4 | Commitment timing rests on the capture's reads (P-1) | Hash equality is a consistency check | — |
| DL-5 | Resolved 14 Oct 2026: the BACCARAT profile, a proposal (`1.0.0-proposed`) when this package was built, is `1.0.0`, approved as cited with no content change (Methodology v1.1) | None: the check list and policies are the ones this package runs | Profile sha256 recorded in `src/profile-map.ts` |
| DL-6 | The player-facing reveal path was observed in the API (the rotation answer carries the previous server seed), not on the rendered verify screen; the rules panel is read from the bundle, not the rendered screen, and that the live baccarat page loads that bundle is inferred (`bundles/LIVE-BUNDLES.md`), not observed; the capture meta's bundle hash is the capture script's constant | README "Verify a bet" step 2 is scoped to that; E02 and P-2 say "inferred" | Closing item: read the live baccarat page's script tag in a read-only page load |
| DL-7 | Pass 2's false-alarm rate has no closed form: the payout is skewed (Tie about 10.4×, Dragon up to about 35×) | Estimated by Monte Carlo from the exact joint distribution: 0.0097 ± 0.000438 | `npm run false-alarm:pass2` reproduces the declared figure |
| DL-8 | "Exactly 99 %" holds before the 1e-8 floor; the floor lowers a spot's return by at most 2.709 × 10^-7 | Below the claim, never above it; E01 says so ("never exceeds 99%") | BACCARAT-19 computes the bound exactly at 0.02, 2, 10 and the minimum stake |
| DL-9 | Phase A staked 0.02 per spot, not the 0.01000311 minimum | The floor's effect at the minimum is computed exactly (DL-8), not captured | — |
| DL-10 | The audit account's HouseBets user id | Not in this package: the baccarat server answers carry no user-id field, and a search of every shipped file for the account's id returns 0 hits, so nothing was redacted | — |
| DL-11 | The max-win cap branch was never exercised: E03 does not say whether the 20,006.20192259 maximum bet is per spot or per round; if per spot, a round can pay more than the 1,000,310.0961298 cap (up to 2,002,330.18246287 with all nine spots staked), and what the server then does (refuse the bet, or cap the pay) was never observed; the capture's largest round paid 19.51262671. The game client (the bundle E02 is cut from) checks the round's total stake against the minimum and maximum bet and blocks a bet whose best-case profit exceeds the max win, offering a stake scaled to fit (bundle functions `Ba`, `Cu`, `gf`, `ff`, `ci`, `Si`, `Zp`); that is the client, not the server | BACCARAT-14 declares the branch unwitnessed and passes (its rule asks that every quoted pay lie within the cap and the push rules be witnessed where the capture holds them; it does not ask for the cap branch to be exercised) | Closing item for the next capture: one bet whose possible win exceeds the cap |
| DL-12 | E05 is an exhibit: `reconcile-full.py` and the 51.5 MB ledger are not shipped | BACCARAT-16 checks E05's arithmetic (rows, TOTAL, ledger line, balance line) and that this package's four rows equal the recomputed datasets; the ledger's own content beyond E04's 7,300 rows is not re-derived here | `scripts/make-evidence.py` records the ledger's sha256 in E04 |
| DL-13 | This package's capture sent no adversarial request to the API, so its data cannot reproduce a fairness-integrity test; single account | The tests behind the S5 matrix were run separately on HouseBets' running service by ProvablyFair.org and are recorded in the ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing), not in this package: 7 of 8 rows Pass on them (5 on every control the row names, 2 on part), 1 remains Not tested ([Fairness-integrity matrix](#fairness-integrity-matrix)) | The matrix names the tests behind each row and states what the captured data shows. Reproducing a test from this package needs a deliberate probe capture |

### Operator finding

| ID | Finding | Measured | Effect | Scoring |
|---|---|---|---|---|
| OF-1 | The rules panel (E02 `rulesPaysFine`; the same sentence in the live copy of 19 Oct, E08) says payouts are "computed in integer 1e-8 units with a floor per round". The server floors each spot instead, consistent with its fairness answer (E01 rules: "every payout is rounded down once to the wallet's smallest unit") and what the profile asserts (BACCARAT-13) | The served round payout equals the sum of per-spot floors on 7,300/7,300 rounds. A single floor of the round's exact total would pay more on 2,785 of 6,500 Phase A rounds (2,294 by 1e-8, 481 by 2e-8, 10 by 3e-8; 3,286 × 1e-8 = 0.00003286 USDT), on 2,874 of the 7,300 rounds in all four sets (3,393 × 1e-8), and on 0 of the 600 one-spot rounds of Phase C and the $10 set (BACCARAT-11) | Against the player relative to the panel's sentence: by at most 3 × 1e-8 in a captured round; up to 4 × 1e-8 is possible in a round with all nine spots at 0.02 (exact, over every outcome class of the deal), and at most 5 × 1e-8 at any stake (a class pays a non-integer multiple of the stake on at most 6 spots); BACCARAT-11 prints all three. No spot's return exceeds 99 % either way (DL-8) | Reported, not scored: no profile check asserts the panel's rounding sentence, and the served per-spot floor is the published E01 rule the profile checks |
| OF-2 | The rules panel text in the 10 Oct 2026 copy of the bundle (E02 `rulesBankerFine`; that the live page used this copy during the capture is inferred, not observed, DL-6) says "When the player stood (natural or 6–7), the banker draws on 0–5 and stands on 6–7." The published spec (E01 deal: "a two-card total of 8 or 9 either side (a natural) ends the round") and the server end the round on any natural. The live copy (E08, bundle last modified Fri, 16 Oct 2026, fetched 19 Oct) corrects it: "If neither initial hand is a natural (8 or 9) and Player stands on 6–7, Banker draws on 0–5 and stands on 6–7." | 835 of the 7,300 rounds in all four sets (733 of 6,500 Phase A) have a Player two-card natural against a Banker two-card total of 0–5; the server dealt no Banker third card in any of them (835/835). Under the panel's note the Banker would take shoe[4], which changes the result of 90 of the 835 (78 Phase A): 62 Player wins become a tie, 28 a Banker win. Example: Phase A round `NFVJjbH3z17HyR1iFNRL2`, nonce 46 (the README script with `nonce = 46`): Player 6C 3D = 9, Banker 4S 7H = 1; under the note the Banker draws 8S to 9, a tie; the server ended the round and paid the Player spot (0.02 → 0.04010535). `node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/of2-banker-note.mjs` prints these counts | None on the verdict, the replay, the payouts or the RTP: the server deals by E01, which the tableau checks replay (BACCARAT-07 / 10), and the RTP is enumerated under E01 (BACCARAT-18 / 19). In the 90 rounds the Player hand kept a win the panel's note would have made a tie or a loss | Reported, not scored: no profile check asserts the panel's Banker note, and the server follows the published E01 rule; corrected in the copy of the bundle fetched on 19 Oct 2026 (E08); that the live page loaded either copy is inferred, not observed |

## Terms

**G-BIND:** the framework's population rule (BACCARAT-05): the counts a dataset is checked against are code constants in
`src/loader.ts`, never the dataset's own header.

## Release history

| Release | What changed | Verdict |
|---|---|---|
| `v1.0.0` | First public release, 24 Nov 2026. | PROVABLY FAIR — Full Pass |

Pilot run: a 450-round run on the same engine and account on 12 Oct 2026, before Phase A, is not part of this audit's
population; E05 lists it with the account's other datasets.
