# HouseBets Baccarat — Provably Fair Audit (new engine, October 2026)

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** PF-2026-HB02 · **Release:** `v1.0.0` (the first public release) · **Capture:** 12–13 October 2026

**Result: PROVABLY FAIR — Full Pass.** All 7,300 captured rounds recompute card for card from their revealed server seeds, every tableau and outcome replays under the published rules, and every staked spot is paid exactly as recomputed. Of the profile's 31 checks, 30 pass and 1 is informational; none fails and none is flagged. The capture never came near the max-win cap, so what the server does at the cap was not observed; BACCARAT-14 declares that branch unwitnessed, which its rule allows. All 7 package checks pass; BACCARAT-24 runs the ProvablyFair.org verifier module shipped here (`site-verifier/derive.js`) side by side with `src/rng.ts` on every captured round. Two rules panel sentences differ from what the server does, both reported, not scored: the panel says payouts are floored once per round, the server floors each spot, consistent with its fairness answer (operator finding OF-1, still in the copy of the bundle fetched on 19 Oct 2026, E08); and the panel text in the 10 Oct 2026 copy of the game bundle (E02) said the Banker draws on 0–5 after a Player natural, where the fairness answer and the server end the round on any natural (OF-2: no Banker card dealt in any of the 835 such rounds; corrected in the copy of the bundle fetched on 19 Oct 2026, last modified 16 Oct 2026; that the live page loaded either copy of the bundle is inferred, not observed). BACCARAT-16 (wallet reconciliation) passes on the platform's bet history and the account reconciliation; the comparison of consecutive balances the profile describes was not possible in this capture, because other games were captured on the same account at the same time (MANIFEST.md DL-3).

**Theoretical RTP: exactly 99% on every one of the nine spots** before the payout is floored to 1e-8, from an exact enumeration of the 8-deck deal (the published shuffle redraws so that every step is exactly uniform, so the enumeration is the implemented deal); HouseBets states 99% (E01, E02, E08). The floor lowers a spot's return by at most 2.709 × 10^-7. Theoretical RTP is not a promise about an individual session's return.

**Scope:** HouseBets House Games Baccarat (Punto Banco, fairness version `shoe8`, all nine spots: Player, Banker, Tie, Player Pair, Banker Pair, Either Pair, Perfect Pair, Player Dragon, Banker Dragon) in the USDT wallet, captured from one HouseBets account opened for the audit, in a logged-in browser session: 7,300 rounds on 146 revealed seed pairs, 12–13 October 2026.

**Observed return (variance, not RTP evidence):** Phase A's 6,500 rounds returned 98.5904% of the amount staked (845.86598549 paid on 857.96 staked, every spot together).

| Dataset | sha256 |
|---|---|
| `data/housebets-baccarat-6500rounds.json` (Phase A) | `061d54f26ef58aea3fb7a969b6c2ba310d6d6cc6dc932d4ea1f3776e1dd91717` |
| `data/supplementary/housebets-baccarat-phaseC-300rounds.json` | `88d0d49a69fdd1bba9297549b17399c96b14bee010e69fce91c539c0e71af636` |
| `data/supplementary/housebets-baccarat-phaseC-10usd-300rounds.json` | `e19e033bf03702736ff3d384d5a9b4fa70453f844ab59de927e5af92707a5035` |
| `data/supplementary/housebets-baccarat-phaseD-200rounds.json` | `137e3f335869e949a057e0688cb951f99b024033b9b4f37c1d02a3350290a1d7` |

[Audit report](https://audit.provablyfair.org/casino/housebets/games/baccarat/overview) · [Public repository](https://github.com/ProvablyFair-org/housebets-baccarat) · [MIT license](LICENSE) · the full write-up is [MANIFEST.md](MANIFEST.md).

## What was verified

- **6,500 real rounds** placed on 12 Oct 2026 at 0.02 USDT per spot, in 130 seed pairs of exactly 50 rounds, every one
  recomputed from its revealed server seed: the six cards off a freshly shuffled 8-deck shoe, the tableau, the outcome, the
  pair and Dragon results and the payout of every spot staked, against HouseBets' published algorithm (E01). The rules
  panel text in the game's page code (E02; that the live page loads that bundle is inferred, MANIFEST.md DL-6) was compared
  with it: where the two differ (OF-1, OF-2) the server follows E01, not the panel.
- **Supplementary sets** (13 Oct 2026): 300 Banker rounds at 2.00 (100 × the Phase A stake), 300 Banker rounds at $10, and
  200 rounds under four client seeds typed by the auditor.
- **Every round against the platform's own bet history** (E04), and the account's reconciliation (E05, an exhibit whose
  arithmetic and whose rows for this package's datasets are checked).
- **The deal, enumerated exactly:** all 416·415·414·413·412·411 ordered deals of the first six cards, reduced to 298 joint
  classes; they reproduce the 23 probabilities the server publishes and give the exact RTP of every spot.
- **Simulation:** 1,000,000 fresh-seed rounds with all nine spots settled on every round (for 7 of the 9 spots its band is
  wider than the 1 pp house edge, so the RTP evidence is the exact enumeration), and every one of the 146 revealed seeds
  (130 Phase A, 6 at 2.00, 6 at $10, 4 player-set) replayed over 10,000 nonces each to test for seed cherry-picking.
- **Two rules panel sentences differ from the server:** the panel says payouts are floored once per round; the server
  floors each spot, consistent with its fairness answer (MANIFEST.md OF-1, still in the copy of the bundle fetched on 19 Oct, E08). The panel text in the
  10 Oct copy of the bundle (E02) said the Banker draws on 0–5 when the Player stood on a natural; E01 and the server end the round
  on any natural, and in 835 captured rounds with a Player natural against a Banker 0–5 no Banker card was dealt; the live
  copy of the bundle, fetched on 19 Oct 2026 (E08, last modified 16 Oct 2026), has the corrected text; that the live page loaded
  either copy of the bundle is inferred, not observed (MANIFEST.md OF-2, DL-6). Both with the counts.

## Run the audit

Nothing to install: `node verify.js` runs on Node 22, `npm test` (the TypeScript sources) on Node 22.6 or later:

```sh
node verify.js          # the standalone verifier (generated from tests/verify.ts by npm run build:standalone)
npm ci && npm test      # the same suite from the TypeScript sources, plus the RNG reference vectors
```

Expected, at the end of `node verify.js`:

```
profile checks (31): 30 PASS, 0 FLAG (0 capture-origin), 0 FAIL, 0 OVERSTATED, 1 INFO, 0 GAP (none), 0 ABSENT
VERDICT: PROVABLY FAIR — Full Pass
Reproduction vs the committed outputs/verification-results.json on Node 22.23.1: REPRODUCED
```

and exit code 0. `verify` re-runs the whole simulation rather than trusting the stored results: 30.6 s measured on an
Apple M2 Max (12 cores) with Node 22.23.1, under load (load average 85–93 while it ran).

`npm run mutate` runs the falsifiability battery (each mutation must be caught by the step it names) and writes
`outputs/mutation-results.json`; `npm run gate:fresh` (run it in a disposable copy of the package: a passing run rewrites the pinned record
`outputs/fresh-copy.json`, which names the Node version, so on another Node 22 patch the rewritten record no longer equals its pin) re-runs the package from a fresh copy, compares the regenerated
artifacts with the committed ones and writes `outputs/fresh-copy.json`. Both records are committed and pinned. `verify.js`
refuses to run if a source beside it differs from, or is missing among, the ones it was built from. Rebuilding `verify.js`
(`npm run build:standalone`) needs [Bun](https://bun.sh); Bun 1.3.9 built the shipped file (its header and
RELEASE-MANIFEST.json record the version). Running it needs only Node 22. `node scripts/release-manifest.mjs --check`
compares the package with RELEASE-MANIFEST.json, which pins every file of the package except itself, and rebuilds
`site-verifier/derive.js` from `src/rng.ts` with Bun 1.3.9, requiring the shipped file byte for byte; a `verify.js` rebuilt on another Bun version can differ byte for byte from
the same sources, and the check then names the Bun version of each copy.

## Verdict and exit codes

`node verify.js` (and `npm run verify`) ends with one `VERDICT:` line and its exit code. Framework 1.1; RTP-CLAIM 1.2.0 is
switched on (Methodology v1.1). The codes and their order are the same in all 11 HouseBets new-engine packages:

| exit | verdict | when |
|---|---|---|
| 0 | PROVABLY FAIR — Full Pass | every scored check passes (a capture-origin FLAG is disclosed and does not move the verdict) |
| 2 | PROVABLY FAIR — Conditional Pass | an operator-origin FLAG, nothing worse |
| 5 | RTP FIGURE OVERSTATED | BACCARAT-19: the published RTP figure (the highest of E02, E01 and E08's five places, read at run time) is missed on the house side by more than 0.1 pp; the draws pass |
| 3 | INCOMPLETE | any of the profile's 31 checks has no status from this run, or `src/profile-map.ts` does not match the vendored framework profile (`profile/baccarat.profile.json`: a check missing or relabelled) |
| 1 | NOT PROVABLY FAIR | a scored check fails; or a step throws (a file missing, a dataset field null or absent: the checks it scores print FAIL with the error, the other steps still run); or a release-gate record (`outputs/fresh-copy.json`, `outputs/mutation-results.json`) is missing or is not the bytes RELEASE-MANIFEST.json pins (its check prints FAIL) |
| 4 | (no verdict) | `verify.js` was not built from the sources beside it; rebuild with `npm run build:standalone` |

When more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass.

## Verify a bet

Check your round at [provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets); the
page runs `site-verifier/derive.js` from this release (sha256 `8dc6a04274c84df1c68bebf3e75708d19c3c527529a108e327b607e549c83d21`).
BACCARAT-24 runs that file side by side with `src/rng.ts` on every captured round (MANIFEST.md, Player verifiers). The steps
and the script below check a round by hand, without the page.

1. **Save the hashed server seed before you bet.** Before the rounds you want to check, copy the hashed server seed of your
   active seed pair (the seed-pair answer's `hashedServerSeed`, with `hashedNextServerSeed`, `clientSeed` and `nonce`) and
   keep it. Where the game's screen shows it was not checked for this package. A match against a hash read only after your
   rounds shows the revealed seed is consistent with that hash; that the seed was fixed before your bet rests on the copy
   you saved first.
2. **Reveal the seed.** A round can only be checked once its server seed is revealed, which happens when you rotate the
   seed pair: the server's answer to the rotation (`POST /housegames/change_seed`) carries the previous server seed. That is
   the path the capture used for every seed in this package. The game's verify tab can also fetch a rotated-away seed by its
   hash (`GET /housegames/unhash?hs=<hash>`); it refuses the active and the next seed (E07). That is what the API shows; the
   rendered verify screen itself was not captured (MANIFEST.md DL-6).
3. **Collect the fields:** the revealed server seed, your client seed, and the round's nonce (HouseBets nonces start at 1
   on a fresh seed pair), plus the spots and amounts you staked.
4. **Check the commitment:** `sha256` of the server seed's text (UTF-8), as lowercase hex, must equal the hashed server
   seed you saved in step 1.
5. **Shuffle the shoe:** compute `HMAC-SHA256(key, message = "clientSeed:nonce:i")` for i = 0, 1, 2, …, where **the key is
   the server seed's 64-character hex text encoded as UTF-8, not the 32 bytes it hex-decodes to** (HouseBets does not
   hex-decode the seed: a hex-decoded key deals the served six cards in 0 of the 6,500 Phase A rounds, the text key in all
   6,500). Read the digests one after another as big-endian 32-bit numbers `u`. Start from the shoe `[0 … 415]`, where entry
   k holds card id `k mod 52`. Fisher–Yates from the top: for k = 0, 1, …, with n = 416 − k, take the next `u`, draw again
   while `u ≥ 2^32 − (2^32 mod n)`, then swap positions k and `k + (u mod n)`. Only the first six positions matter. Card id
   c has rank `c mod 13` (A 2 3 … 9 T J Q K) and suit `floor(c / 13)` (S H D C).
6. **Deal and settle** (E01, E02): Player takes shoe[0] and shoe[2], Banker shoe[1] and shoe[3]; A = 1, 2–9 face, T/J/Q/K
   = 0, totals mod 10; a two-card 8 or 9 on either side ends the round; otherwise Player draws on 0–5 and Banker follows the
   published table; third cards come off shoe[4], then shoe[5]. Each winning spot pays `floor(stake × num / den)` to the
   1e-8 unit with the fraction the server publishes (E01 `pays`; Dragon: `stake × (kDen + kNum × m) / kDen` at rung m,
   where m = 1 if the winning hand had a natural (any margin); otherwise m = 30, 10, 6, 4, 2, 1 for a win by 9, 8, 7, 6,
   5, 4 points; a non-natural win by 1–3 points or a non-natural tie loses.), **floored spot by spot**: the round's payout
   is the sum of the floored spots (the rules panel's "a floor per round" is not what the server does, MANIFEST.md OF-1).
   Player and Banker push on a tie; a Dragon Bonus pushes on a natural tie.

This script does steps 4 to 6 for one round (Node 18 or later, nothing to install; save it as a `.cjs` file and run it with `node`). The example is test vector V2 of
[docs/ALGORITHM.md](docs/ALGORITHM.md), Phase A round `d025c040-58d0-4402-a120-b0aed5a0ee27`, nonce 9: both hands draw a
third card.

```js
const crypto = require('crypto');
const serverSeed = '46704778f075bf19bed991e194ef893e215bce766c9e1813c5e6fde8bd817736';
const hashedServerSeed = '2b7a4d456e439cf7f2b470227abe06955d261cd807de423c8054ba9eb31da943'; // your own round: the hash you saved before betting
const clientSeed = 'pfbacstartd129e70a595fd7b316ac71b6baed15a2', nonce = 9;
const key = Buffer.from(serverSeed, 'utf8');   // the seed's 64-character text, NOT Buffer.from(serverSeed, 'hex')
let block = 0, buf = Buffer.alloc(0), off = 0;
const nextU = () => {
  if (off === buf.length) { buf = crypto.createHmac('sha256', key).update(`${clientSeed}:${nonce}:${block++}`).digest(); off = 0; }
  const u = buf.readUInt32BE(off); off += 4; return u;
};
const shoe = Array.from({ length: 416 }, (_, k) => k % 52);
for (let k = 0; k < 6; k++) {   // only the first six positions are dealt
  const n = 416 - k; let u;
  do { u = nextU(); } while (u >= 2 ** 32 - (2 ** 32 % n));
  const j = k + (u % n); [shoe[k], shoe[j]] = [shoe[j], shoe[k]];
}
const name = (c) => 'A23456789TJQK'[c % 13] + 'SHDC'[Math.floor(c / 13)];
const v = (c) => (c % 13 >= 9 ? 0 : (c % 13) + 1);
console.log('commitment matches:', crypto.createHash('sha256').update(key).digest('hex') === hashedServerSeed);
console.log('shoe[0..5]:', shoe.slice(0, 6).map(name).join(' '));
const P = [shoe[0], shoe[2]], B = [shoe[1], shoe[3]]; let next = 4;
const tot = (h) => h.reduce((s, c) => s + v(c), 0) % 10;
if (tot(P) < 8 && tot(B) < 8) {
  let p3 = null;
  if (tot(P) <= 5) { P.push(shoe[next++]); p3 = v(P[2]); }
  const b = tot(B);
  if (p3 === null ? b <= 5 : b <= 2 || (b === 3 && p3 !== 8) || (b === 4 && p3 >= 2 && p3 <= 7) || (b === 5 && p3 >= 4 && p3 <= 7) || (b === 6 && p3 >= 6 && p3 <= 7)) B.push(shoe[next++]);
}
console.log('Player', P.map(name).join(' '), '=', tot(P), '| Banker', B.map(name).join(' '), '=', tot(B));
// the Player spot only, at this example's 0.02 stake: the published fraction when Player wins, the stake back on a tie, 0 otherwise
const playerSpot = tot(P) > tot(B) ? 2000000n * 349436473927743n / 174259240827520n : tot(P) === tot(B) ? 2000000n : 0n;
console.log('Player spot at 0.02 pays', String(playerSpot), 'x 1e-8');
```

It prints:

```
commitment matches: true
shoe[0..5]: TH AS QD KD 5S 3H
Player TH QD 5S = 5 | Banker AS KD 3H = 4
Player spot at 0.02 pays 4010535 x 1e-8
```

These are the cards and the result the server served in that round: Player wins by 1 (no Dragon rung), and the Player
spot's 0.02 paid 0.04010535, the Player fraction of E01 `pays` floored to 1e-8; the round staked all nine spots and its
payout was that one spot. The last line settles the Player spot alone at a 0.02 stake (win, tie or loss); for any other spot or stake
use the fractions of step 6. For this example `hashedServerSeed` is the commitment the capture read before the seed pair's
first round; for your own round it is the one you saved in step 1. A matching round verifies that round against the inputs
supplied; it does not by itself establish that every other round is fair. `src/rng.ts` and `src/rules.ts` are these steps
in code.

## Files and evidence

`docs/` the algorithm written out ([ALGORITHM.md](docs/ALGORITHM.md), with test vectors) and the interface of `src/rng.ts`
([INTERFACE.md](docs/INTERFACE.md)) · `data/` the datasets (pinned in `src/loader.ts`) · `evidence/` E01–E08 · `capture/`
reference copies of the capture scripts (MANIFEST.md#dataset-and-capture) · `profile/` the framework's BACCARAT profile,
vendored byte for byte (the verifier binds its step list to it) · `outputs/` the pinned simulation census, RTP table and
verification record, and the committed mutation and fresh-copy records · `src/` the derivation and the exact enumeration ·
`tests/verify.ts` the 31 checks of the BACCARAT profile · `scripts/` mutation battery, fresh-copy gate, standalone build,
release manifest, evidence builder, site-verifier build · `site-verifier/derive.js` the ProvablyFair.org verifier module for
this game, generated from `src/rng.ts`. See MANIFEST.md#evidence.

The release commit and tag are signed with the ProvablyFair.org release key (SSH,
`SHA256:gEujiJm2pRyq7lQsfYQfQ1r97H/J7GdaKHbOW8GtikY`), which the release manifest records.
