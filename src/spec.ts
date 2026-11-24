// HouseBets House Baccarat (new engine, fairness version "shoe8") — the published spec this package audits, restated as
// code. Every constant below is copied from the server's own answer to GET /housegames/baccarat/fairness (E01, captured
// 12 Oct 2026 17:07Z) or the limits answer (E03); none is measured from the data it is then compared with, and BACCARAT-26
// compares each with its exhibit before any step runs (a mismatch is a reproduction failure, exit 1).

export const FAIRNESS_VERSION = 'shoe8';
export const SHOE_CARDS = 416;          // E01 derivation: "A fresh 8-deck shoe (416 cards) per round"
export const DECKS = 8;
export const DEAL_POSITIONS = 6;        // a round uses at most 6 cards (P1 B1 P2 B2 + two third cards)
/** E01 cards: rank = id mod 13 (A, 2..10, J, Q, K), suit = floor(id / 13) (0 ♠, 1 ♥, 2 ♦, 3 ♣). */
export const RANKS = 'A23456789TJQK';
export const SUITS = 'SHDC';
export const cardName = (id: number): string => RANKS[id % 13] + SUITS[Math.floor(id / 13)];
/** E01 values: A = 1, 2..9 face, 10/J/Q/K = 0. */
export const valueOfRank = (r: number): number => (r === 0 ? 1 : r >= 9 ? 0 : r + 1);

export const SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair', 'eitherPair', 'perfectPair', 'playerBonus', 'bankerBonus'] as const;
export type Spot = (typeof SPOTS)[number];
export const MAIN_SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair', 'eitherPair', 'perfectPair'] as const;

/** E01 pays: payout = floor(stake × num / den) on a win (1e-8 units), the exact fractions the server publishes. */
export const PAYS: Readonly<Record<string, readonly [bigint, bigint]>> = Object.freeze({
  player: [349436473927743n, 174259240827520n],
  banker: [349436473927743n, 179082231752960n],
  tie: [128864955540321n, 12386130897740n],
  playerPair: [8217n, 620n],
  bankerPair: [8217n, 620n],
  eitherPair: [234159849n, 34016300n],
  perfectPair: [33451407n, 1130260n],
});
/** E01 dragon: pay = stake × (kDen + kNum·m) / kDen on rung m; a natural tie returns the stake; anything else 0. */
export const DRAGON: Readonly<Record<string, readonly [bigint, bigint]>> = Object.freeze({
  playerBonus: [266415435632443n, 259965648810080n],
  bankerBonus: [269184974484283n, 236488131746080n],
});
/** E01 rungs: natural win m = 1; non-natural win by 9, 8, 7, 6, 5, 4 → m = 30, 10, 6, 4, 2, 1; by 1..3 → loses. */
export const RUNG: Readonly<Record<number, bigint>> = Object.freeze({ 9: 30n, 8: 10n, 7: 6n, 6: 4n, 5: 2n, 4: 1n });
export const RUNG_NATURAL = 1n;

/** E01 probabilities, the worked examples and every RTP figure are NOT copied here:
 *  BACCARAT-09, 18 and 19 read them from the pinned exhibits at run time (src/claims.ts). */

/** E03 limits (GET /housegames/limits/baccarat, wallet answer): the minimum bet and the max-win cap on the 1e-8 grid;
 *  BACCARAT-26 compares them with E03 before any step runs. */
export const MIN_STAKE = '0.01000311';
export const MAX_BET = '20006.20192259';
export const MAX_WIN = '1000310.0961298';
