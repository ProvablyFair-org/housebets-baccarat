# HouseBets Baccarat: algorithm specification

HouseBets House Games **Baccarat** (Punto Banco with pair and Dragon Bonus side bets), the engine HouseBets serves since
October 2026 (fairness version `shoe8`).

This document states, in one place, how a round's cards, tableau and the payout of every spot follow from the seeds, the
nonce and the stakes. It is written from HouseBets' published fairness spec (E01) and from this package's `src/rng.ts`,
`src/rules.ts` and `src/spec.ts`; every formula below is the one that code runs, and every step names where it came from:

- **PUBLISHED**: HouseBets' fairness spec, `GET /housegames/baccarat/fairness`, answered to the capture on 12 Oct 2026
  17:07:28Z ([E01](../evidence/E01-baccarat-fairness-spec-2026-10-12.json)): derivation, cards, deal, rules, pays,
  Dragon Bonus rungs, 23 exact probabilities, return, worked examples.
- **PAGE**: the rules panel strings in the game page's code (E02, 10 Oct 2026; the live copy of 19 Oct, E08).
- **DATA**: the captured rounds of this package (table below). The data fixes what E01 leaves unstated (the key encoding).
- **STANDARD**: the standard provably-fair construction (SHA-256 commitment to the server seed; HMAC-SHA256 keyed by the
  server seed over `clientSeed:nonce:cursor`) and the Punto Banco tableau.

Datasets:

| File | Rounds | Seed pairs | Captured |
|---|---|---|---|
| `data/housebets-baccarat-6500rounds.json` (Phase A) | 6,500 | 130 | 12 Oct 2026 |
| `data/supplementary/housebets-baccarat-phaseC-300rounds.json` | 300 | 6 | 13 Oct 2026 |
| `data/supplementary/housebets-baccarat-phaseC-10usd-300rounds.json` | 300 | 6 | 13 Oct 2026 |
| `data/supplementary/housebets-baccarat-phaseD-200rounds.json` | 200 | 4 | 13 Oct 2026 |

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | 64 lowercase hex characters; secret until the seed pair is rotated | DATA: 146 of 146 revealed seeds |
| `clientSeed` | text set by the player | DATA: `pfbac` + hex (CSPRNG, Phases A and C); `provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890` (Phase D). An empty client seed is refused (E06) |
| `nonce` | positive integer, **1** on the first round after a rotation, +1 per round | PUBLISHED (E01 examples start at nonce 1) + DATA: nonces 1 … 50 |
| `bets` | one or more `{ spot, amount }`, spot one of `player`, `banker`, `tie`, `playerPair`, `bankerPair`, `eitherPair`, `perfectPair`, `playerBonus`, `bankerBonus` | PUBLISHED (E01 `pays`, `dragon`) + DATA: request `bets` |

The cards read **only** `serverSeed`, `clientSeed` and `nonce`. The spots and amounts never enter the shuffle: the HMAC
message has no spot or stake field.

### 1.2 Commitment

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

i.e. hash the **64-character text** of the seed, not the 32 bytes it encodes.

- SOURCE: STANDARD (SHA-256 commitment) + DATA (encoding): 146 of 146 revealed seeds hash to their commitment as text;
  hashing the hex-decoded bytes matches 0 of the 130 Phase A seeds.
- Code: `sha256Hex` in `src/rng.ts`.
- Verify: every round's hashed server seed must equal `commitment` of one revealed seed. Each pair also shows the hash of
  the next server seed; it equals the next pair's commitment (BACCARAT-02).

---

## 2. Outcome derivation

### 2.1 The u32 stream

```
key       = UTF-8(serverSeed)                                   # the 64-character text, NOT hex-decoded
block(i)  = HMAC-SHA256(key, UTF-8( clientSeed + ":" + decimal(nonce) + ":" + decimal(i) ))   # i = 0, 1, 2, …
stream    = block(0) ‖ block(1) ‖ …  read as unsigned 32-bit BIG-ENDIAN integers u, in order (8 per block)
```

- `decimal(x)`: base 10, no padding, no sign. Example: `pfbacstartd129e70a595fd7b316ac71b6baed15a2:1:0`.
- SOURCE: PUBLISHED (E01 `derivation`: "block_i = HMAC_SHA256(key = serverSeed, message = clientSeed:nonce:i); the stream
  block_0 ‖ block_1 ‖ … is read as big-endian 32-bit numbers u") + DATA (key encoding: E01 says "key = serverSeed" without an
  encoding; the seed's text as the key gives the six cards in order on 6,500 of 6,500 Phase A rounds, the hex-decoded 32
  bytes on 0 of 6,500).
- Code: `u32Stream(serverSeed, clientSeed, nonce)` in `src/rng.ts`.

### 2.2 Shoe and shuffle

```
shoe = [0, 1, …, 415]  with entry k holding card id  k mod 52          # a fresh 8-deck shoe every round
for k = 0 … 414:
    n     = 416 − k
    limit = 2^32 − (2^32 mod n)                                       # a multiple of n
    u     = next u from the stream
    while u ≥ limit:  u = next u from the stream                      # redraw
    j     = k + (u mod n)
    swap shoe[k], shoe[j]
cards are dealt shoe[0], shoe[1], …
```

- A round uses at most six cards, and the swap at step k only touches positions ≥ k, so the first six positions are final
  after six steps. The code runs six steps (`shoeTop(…, 6)`); `fullShoe` runs all 415 and the unit tests check that its first
  six cards equal `shoeTop`'s.
- **Bias.** Every accepted step is exactly uniform over its n values, because the limit is a multiple of n. The largest
  chance that a step redraws is 9.45 × 10^-8 (n = 410). No redraw occurred in the 7,300 captured rounds (BACCARAT-08).
- SOURCE: PUBLISHED (E01 `derivation`, verbatim: "shoe = [0..415] with entry k holding card id k mod 52, shuffled by
  Fisher–Yates from the top: for k = 0..414: n = 416 − k, draw u, redraw while u ≥ 2^32 − (2^32 mod n), j = k + (u mod n),
  swap shoe[k] and shoe[j]. Cards are dealt shoe[0], shoe[1], …") + DATA (7,300 of 7,300 rounds).
- Code: `limitOf(n)`, `shuffleTop(stream, take)`, `shoeTop(serverSeed, clientSeed, nonce, take)` and `fullShoe` in
  `src/rng.ts`; `SHOE_CARDS = 416` in `src/spec.ts`.

### 2.3 Cards

```
rank  = id mod 13          # 0..12 = A 2 3 4 5 6 7 8 9 T J Q K
suit  = floor(id / 13)     # 0 S (spades), 1 H (hearts), 2 D (diamonds), 3 C (clubs)
value = A → 1, 2..9 → face value, T J Q K → 0
```

SOURCE: PUBLISHED (E01 `cards`). The round record serves cards as rank + suit letters (`"3C"`, `"TH"`); `T` stands for the
10. Code: `cardName` and `valueOfRank` in `src/spec.ts`.

### 2.4 The deal (tableau)

```
Player = shoe[0], shoe[2]      Banker = shoe[1], shoe[3]          # deal order P1 B1 P2 B2
pt, bt = the hands' totals, Σ value mod 10
if pt ≥ 8 or bt ≥ 8:  natural, the round ends
else:
    if pt ≤ 5:  Player draws the next card (shoe[4]); v = its value
    if Player stood:  Banker draws on bt ≤ 5
    else Banker draws when:  bt ≤ 2;  bt = 3 and v ≠ 8;  bt = 4 and v ∈ 2..7;  bt = 5 and v ∈ 4..7;  bt = 6 and v ∈ 6..7
        (Banker's third card is the next card: shoe[5] if Player drew, else shoe[4])
    pt, bt = the hands' totals again, each over all its cards (Σ value mod 10)
outcome = player if pt > bt, banker if bt > pt, tie otherwise
margin  = |pt − bt|
playerPair  = Player's first two cards share a rank;   bankerPair likewise
playerPerfect = Player's first two cards are the same card id (rank AND suit);   bankerPerfect likewise
```

SOURCE: PUBLISHED (E01 `deal`, verbatim: "deal order P1 B1 P2 B2: Player shoe[0], shoe[2]; Banker shoe[1], shoe[3]; then
each third card the rules call for takes the next card (the Player's third first)"; "a two-card total of 8 or 9 either side
(a natural) ends the round"; "else Player draws its third on 0..5, stands on 6..7"; "Banker then: if Player stood, draws its
third on 0..5; else draws by the Player-third-card rule (bt 0..2 always; 3 unless v=8; 4 on 2..7; 5 on 4..7; 6 on 6..7; 7
never)"; E01 rules for the pairs) + DATA (tableau and flags 7,300 of 7,300). Code: `deal(ids)` and
`bankerDrawsAfterPlayerThird(bt, v)` in `src/rules.ts`.

**Operator finding OF-2.** The rules panel text in the 10 Oct 2026 copy of the bundle (E02 `rulesBankerFine`) says "When the player stood
(natural or 6–7), the banker draws on 0–5". The server ends the round on any natural, as E01 says: in the 835 captured rounds
with a Player natural against a Banker 0–5 it dealt no Banker card, and the panel's note would have changed the result of
90 of them. The copy of the bundle fetched on 19 Oct 2026 (E08, last modified 16 Oct 2026) has the corrected note; that the live
page loaded either copy is inferred, not observed (E02, E08) (MANIFEST.md, Operator finding).

---

## 3. Win condition and payout

All money is in integer 1e-8 units (`a` = a spot's stake × 10^8). Every fraction below is E01's, exactly (`src/spec.ts`
`PAYS`, `DRAGON`, `RUNG`).

### 3.1 Main spots and pair spots

```
pay(spot) = floor( a × num / den )     when the spot wins
          = a                          Player or Banker spot on a tie (push)
          = 0                          otherwise
```

| spot | wins when | num / den (E01 `pays`) | about |
|---|---|---|---|
| `player` | outcome = player | 349436473927743 / 174259240827520 | 2.00527× |
| `banker` | outcome = banker | 349436473927743 / 179082231752960 | 1.95126× |
| `tie` | outcome = tie | 128864955540321 / 12386130897740 | 10.40397× |
| `playerPair` | playerPair | 8217 / 620 | 13.25323× |
| `bankerPair` | bankerPair | 8217 / 620 | 13.25323× |
| `eitherPair` | playerPair or bankerPair | 234159849 / 34016300 | 6.88375× |
| `perfectPair` | playerPerfect or bankerPerfect (paid once) | 33451407 / 1130260 | 29.59621× |

The pair spots win regardless of the Player/Banker outcome (E01 rules).

### 3.2 Dragon Bonus

```
m    = 1                       if the side wins and the round was a natural
     = 30, 10, 6, 4, 2, 1      if the side wins a non-natural round by 9, 8, 7, 6, 5, 4 points
     = none                    a non-natural win by 1..3, or a loss
pay  = floor( a × (kDen + kNum × m) / kDen )    when m is defined
     = a                       on a natural tie (push)
     = 0                       otherwise (including a non-natural tie)

playerBonus: kNum / kDen = 266415435632443 / 259965648810080
bankerBonus: kNum / kDen = 269184974484283 / 236488131746080
```

SOURCE: PUBLISHED (E01 `dragon`, E01 rules). Code: `dragonRung(side, deal)` and `payUnits(spot, a, deal)` in `src/rules.ts`.

### 3.3 Round payout: floored spot by spot

```
round payout = Σ over the staked spots of pay(spot)      # each spot floored on its own, then summed
```

- SOURCE: PUBLISHED (E01 rules, last line: "every payout is rounded down once to the wallet's smallest unit (1e-8), so a
  spot's return never exceeds 99%") + DATA: the served round payout equals the sum of per-spot floors on 7,300 of 7,300
  rounds, and every served spot payout equals `pay(spot)` (table in §7).
- **Operator finding OF-1.** The rules panel (E02 `rulesPaysFine`, the same sentence in E08) says payouts are computed "with a
  floor per round". The server floors each spot, as E01 says. A single floor of the round's exact total would pay more on
  2,785 of the 6,500 Phase A rounds, by 3,286 × 1e-8 USDT in all (MANIFEST.md, Operator finding).
- **Max win.** Every answer carries `maxWin` 1,000,310.0961298 (E03). What the server does at the cap was never observed
  (MANIFEST.md DL-11).

### 3.4 Return

Every spot returns exactly 99/100 before the floor, on a fresh 8-deck shoe (E01 `return`). An exact enumeration of the deal
(`src/enumerate.ts`) reproduces all 23 probabilities E01 publishes, read from E01 at run time (BACCARAT-18).

### 3.5 Fields an implementation must not read

`deck`, `cards`, the hands' `cards` and `total`, `outcome`, `natural`, `margin`, the pair and perfect flags, every spot's
`result` and `payout`, the round `payout` and `multiplier` are the operator's claims, to be checked. The derivation reads
`serverSeed`, `clientSeed`, `nonce` and the staked spots and amounts.

---

## 4. Source per step (summary)

| Step | Source | Evidence |
|---|---|---|
| Inputs: server seed, client seed, nonce from 1 | PUBLISHED + DATA | E01 examples; 7,300 rounds, nonces 1 … 50 |
| Commitment = SHA-256 of the seed's UTF-8 text, hex | STANDARD + DATA | 146/146 (hex-decoded bytes 0/130 on Phase A) |
| HMAC-SHA256 stream, key = the seed's UTF-8 text, message `clientSeed:nonce:i`, u32 big-endian | PUBLISHED + DATA | 6,500/6,500 Phase A (hex-decoded key 0/6,500) |
| Fisher–Yates from the top with redraw at 2^32 − (2^32 mod n) | PUBLISHED + DATA | 7,300/7,300 rounds, six cards in order; 0 redraws |
| Card id → rank, suit, value | PUBLISHED | E01 `cards` |
| Deal and third-card rules | PUBLISHED + STANDARD + DATA | E01 `deal`; tableau 7,300/7,300 (E02's Banker note is OF-2) |
| Spot pays = floor(a × num / den); pushes | PUBLISHED + DATA | E01 `pays`, rules; 44,816/44,816 spot settlements |
| Dragon Bonus rungs | PUBLISHED + DATA | E01 `dragon` |
| Round payout = Σ per-spot floors | PUBLISHED + DATA | E01 rules; 7,300/7,300 (E02's "floor per round" is OF-1) |
| Worked examples | PUBLISHED | E01 `examples`, re-dealt card for card (BACCARAT-09) |

---

## 5. Test vectors

**E01 examples.** The five worked rounds E01 publishes; the code re-deals all five card for card, with the published totals
and outcome:
```
serverSeed 5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a   clientSeed housebets
  nonce 1  KC JH QC 9D 9C JC   Player KC QC = 0        Banker JH 9D = 9        banker (natural)
  nonce 7  TD 9H AC AH JH JD   Player TD AC JH = 1     Banker 9H AH JD = 0     player
serverSeed housebets-demo-server-seed-0001   clientSeed demo-client
  nonce 1  5H 7H 7D 4C TD JH   Player 5H 7D TD = 2     Banker 7H 4C JH = 1     player
  nonce 2  4D KC QH 7D 6C QC   Player 4D QH 6C = 0     Banker KC 7D = 7        banker
  nonce 3  2D 6H 6D 8S QC 7S   Player 2D 6D = 8        Banker 6H 8S = 4        player (natural)
```

The other vectors are copied from Phase A rounds (round id and public id given), each with all nine spots staked at 0.02 USDT
(2,000,000 units); the server seed is the revealed seed whose `commitment` equals the round's hashed server seed. "block 0"
is `HMAC-SHA256(UTF-8(serverSeed), "clientSeed:nonce:0")`, "u" its first six 32-bit words, and "j" = k + (u mod (416 − k))
for k = 0 … 5 (no redraw occurred in these rounds). Pays are in 1e-8 units; spots not listed pay 0.

All four use the same seed pair:
```
serverSeed  46704778f075bf19bed991e194ef893e215bce766c9e1813c5e6fde8bd817736
commitment  2b7a4d456e439cf7f2b470227abe06955d261cd807de423c8054ba9eb31da943
clientSeed  pfbacstartd129e70a595fd7b316ac71b6baed15a2
```

**V1: round `6561e28f-453a-4e75-80a1-89558267051e` (public id `pm10clzxXhzbATMzpdsrf`)**, nonce 1, a Banker natural
```
block 0     c8661c8d1cd59670d2f8e453f85b1950644ddefcd676a454ae17f59ef42f1d73
u           3362135181 483759728 3539526739 4166719824 1682824956 3598099540
j           301 39 207 410 248 45
ids         41 39 51 46 40 45   → 3C AC KC 8C 2C 7C                       (served deck identical)
Player 3C KC = 3   Banker AC 8C = 9 → natural, banker wins
banker      floor(2000000 × 349436473927743 / 179082231752960) = 3902525  (served 3902525, win)
bankerBonus natural win, m = 1 → floor(2000000 × (kDen + kNum) / kDen) = 4276519   (served 4276519, win)
round payout 8179044 = 0.08179044                                       (served 0.08179044)
```

**V2: round `d025c040-58d0-4402-a120-b0aed5a0ee27` (public id `ODRfCaEoUXwc72AzRc5Eo`)**, nonce 9, both hands draw
```
block 0     8e47cf421688f7eba38772115ef65d63a40210d89b182f440a1e6b318085e51a
u           2387070786 378075115 2743562769 1593204067 2751598808 2602053444
j           386 156 89 402 368 119
ids         22 0 37 38 4 15   → TH AS QD KD 5S 3H                         (served deck identical)
Player TH QD = 0 → draws 5S (v 5) = 5   Banker AS KD = 1 → draws (bt ≤ 2) 3H = 4
player wins by 1 (non-natural: no Dragon rung)
player      floor(2000000 × 349436473927743 / 174259240827520) = 4010535  (served 4010535, win)
round payout 0.04010535                                                 (served 0.04010535)
```

**V3: round `25602488-a1d8-4c27-9a6a-794bb048c921` (public id `AfZGyytKi0xhp7I0YzZNE`)**, nonce 8, a natural tie
```
block 0     eebe11ef987cb98cbd3b9c855737459966eaf6e2bbe6551e8256067f037c29d8
u           4005433839 2558310796 3174800517 1463240089 1726674658 3152434462
j           303 137 119 90 378 351
ids         43 33 15 38 14 39   → 5C 8D 3H KD 2H AC                       (served deck identical)
Player 5C 3H = 8   Banker 8D KD = 8 → natural tie
tie         floor(2000000 × 128864955540321 / 12386130897740) = 20807943 (served 20807943, win)
player, banker, playerBonus, bankerBonus   push, 2000000 each              (served 2000000 each, push)
round payout 28807943 = 0.28807943                                      (served 0.28807943)
```

**V4: round `c237fc96-8d4b-4e77-affa-569fe1220337` (public id `BNg1DZqZ9RJqnQQAgo6GM`)**, nonce 16, Player stands, Dragon rung 7
```
block 0     5412aaf4710c7f995215a9ab6fbd5844a1a1d8a28464a0fa53897c2b1c8bd978
u           1410509556 1896644505 1377151403 1874679876 2711738530 2221187322
j           404 301 277 191 266 299
ids         40 41 17 35 6 39   → 2C 3C 5H TD 7S AC                        (served deck identical)
Player 2C 5H = 7 → stands   Banker 3C TD = 3 → Player stood, draws on ≤ 5: 7S → 0
player wins by 7 (non-natural)
player      4010535                                                     (served 4010535, win)
playerBonus m = 6 → floor(2000000 × (kDen + 6·kNum) / kDen) = 14297721     (served 14297721, win)
round payout 18308256 = 0.18308256                                      (served 0.18308256)
```

---

## 6. Open points the published spec and the data do not settle

- **O1: key encoding is not written down.** E01 says "key = serverSeed" without saying whether the key is the seed's text or
  the bytes it encodes. The data settles it for the text (§2.1).
- **O2: the redraw branch is not exercised.** No captured round needed a redraw (§2.2); the branch is the published rule and
  the code implements it, but the data cannot confirm the server takes the next word of the stream rather than, say, the next
  block.
- **O3: rounding wording (OF-1).** E01 and the server floor each spot; the rules panel says a floor per round (§3.3).
- **O4: maximum bet and the max-win cap.** E03 does not say whether the maximum bet is per spot or per round, and what the
  server does at the cap was not observed (MANIFEST.md DL-11).
- **O5: the reveal path.** The capture revealed every seed by rotating the pair (`POST /housegames/change_seed`).
  `GET /housegames/unhash?hs=<hash>` refuses the active and the next seed (E07); the rendered verify screen was not captured
  (MANIFEST.md DL-6).
- **O6: other currencies.** Every captured round is in the USDT wallet with 8 decimals. The rounding unit of other wallets is
  not witnessed.

---

## 7. Reproduction of this specification

`npm test` (or `node verify.js`) recomputes every round in the package with `src/rng.ts` and `src/rules.ts` (BACCARAT-01,
-07, -09, -10, -11). The counts quoted above were taken on 21 Oct 2026, Node 22.23.1, with a script that runs the package's
own per-round recompute core (`src/recompute.ts`) over the four datasets:

```
data/housebets-baccarat-6500rounds.json: rounds 6500; commitments 130/130; cards 6500/6500; tableau 6500/6500; spot payouts 42898/42898; round payout 6500/6500; rejections 0
data/supplementary/housebets-baccarat-phaseC-10usd-300rounds.json: rounds 300; commitments 6/6; cards 300/300; tableau 300/300; spot payouts 300/300; round payout 300/300; rejections 0
data/supplementary/housebets-baccarat-phaseC-300rounds.json: rounds 300; commitments 6/6; cards 300/300; tableau 300/300; spot payouts 300/300; round payout 300/300; rejections 0
data/supplementary/housebets-baccarat-phaseD-200rounds.json: rounds 200; commitments 4/4; cards 200/200; tableau 200/200; spot payouts 1318/1318; round payout 200/200; rejections 0
```

A second implementation in Python (standard library `hmac` and `hashlib` only, not importing the package) gave, on the
6,500 Phase A rounds:

```
six cards in order: utf8 key 6500/6500; hex-decoded key 0/6500
commit hexbytes 0 of 130
```

---

## 8. Files this specification was written from

`evidence/E01-baccarat-fairness-spec-2026-10-12.json`, `src/rng.ts`, `src/rules.ts`, `src/spec.ts`, `src/recompute.ts`, the
four dataset files listed at the top, and MANIFEST.md (for the exhibit references, OF-1 and OF-2).
