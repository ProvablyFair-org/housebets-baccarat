// HouseBets baccarat rules (E01 deal + rules, E02 rules panel), restated from the published text: the tableau and the
// per-spot settlement in integer 1e-8 units. Nothing here reads an operator outcome, flag or multiplier.
import { cardName, valueOfRank, PAYS, DRAGON, RUNG, RUNG_NATURAL, type Spot } from './spec.ts';

export interface Deal {
  P: number[]; B: number[];            // card ids, in deal order
  pt: number; bt: number;              // totals
  natural: boolean;                    // a two-card 8 or 9 either side
  outcome: 'player' | 'banker' | 'tie';
  third: 'natural' | 'none' | 'P' | 'B' | 'PB';
  pPair: boolean; bPair: boolean; pPerf: boolean; bPerf: boolean;
  margin: number;                      // |pt − bt|
  cardsUsed: number;
}

const val = (id: number): number => valueOfRank(id % 13);
/** E01 "Banker then: … draws by the Player-third-card rule (bt 0..2 always; 3 unless v=8; 4 on 2..7; 5 on 4..7; 6 on 6..7; 7 never)". */
export const bankerDrawsAfterPlayerThird = (bt: number, v: number): boolean =>
  bt <= 2 || (bt === 3 && v !== 8) || (bt === 4 && v >= 2 && v <= 7) || (bt === 5 && v >= 4 && v <= 7) || (bt === 6 && v >= 6 && v <= 7);

/** E01 deal: P1 B1 P2 B2 from shoe[0..3]; third cards from shoe[4], shoe[5] in order, the Player's first. */
export function deal(ids: readonly number[]): Deal {
  const P = [ids[0], ids[2]], B = [ids[1], ids[3]];
  const tot = (h: number[]) => h.reduce((s, c) => s + val(c), 0) % 10;
  let pt = tot(P), bt = tot(B), i = 4;
  const natural = pt >= 8 || bt >= 8;
  let p3: number | null = null;
  if (!natural) {
    if (pt <= 5) { p3 = ids[i++]; P.push(p3); pt = tot(P); }
    const draws = p3 === null ? bt <= 5 : bankerDrawsAfterPlayerThird(bt, val(p3));
    if (draws) { B.push(ids[i++]); bt = tot(B); }
  }
  const third = natural ? 'natural' : (((p3 !== null ? 'P' : '') + (B.length === 3 ? 'B' : '')) || 'none') as Deal['third'];
  return { P, B, pt, bt, natural, outcome: pt > bt ? 'player' : bt > pt ? 'banker' : 'tie', third,
    pPair: P[0] % 13 === P[1] % 13, bPair: B[0] % 13 === B[1] % 13, pPerf: P[0] === P[1], bPerf: B[0] === B[1],
    margin: Math.abs(pt - bt), cardsUsed: i };
}

export const names = (ids: readonly number[]): string[] => ids.map(cardName);

/** The rung a Dragon Bonus side wins on (null = no win): natural win → 1; non-natural win by 9..4 → 30/10/6/4/2/1. */
export function dragonRung(side: 'player' | 'banker', d: Pick<Deal, 'outcome' | 'natural' | 'margin'>): bigint | null {
  if (d.outcome !== side) return null;
  if (d.natural) return RUNG_NATURAL;
  return RUNG[d.margin] ?? null;
}

/** Settlement of one spot in 1e-8 units for stake `a` (1e-8 units): floored once (E01 rules, last line). */
export function payUnits(spot: Spot, a: bigint, d: Pick<Deal, 'outcome' | 'natural' | 'margin' | 'pPair' | 'bPair' | 'pPerf' | 'bPerf'>): bigint {
  if (spot === 'playerBonus' || spot === 'bankerBonus') {
    const [kn, kd] = DRAGON[spot];
    if (d.outcome === 'tie') return d.natural ? a : 0n;          // a natural tie pushes; a non-natural tie loses
    const m = dragonRung(spot === 'playerBonus' ? 'player' : 'banker', d);
    return m === null ? 0n : (a * (kd + kn * m)) / kd;
  }
  const [n, den] = PAYS[spot];
  const o = d.outcome;
  const win = spot === 'player' ? o === 'player' : spot === 'banker' ? o === 'banker' : spot === 'tie' ? o === 'tie'
    : spot === 'playerPair' ? d.pPair : spot === 'bankerPair' ? d.bPair : spot === 'eitherPair' ? d.pPair || d.bPair : d.pPerf || d.bPerf;
  if (win) return (a * n) / den;
  if ((spot === 'player' || spot === 'banker') && o === 'tie') return a;   // Player and Banker push the stake on a tie
  return 0n;
}

/** Decimal string or number → integer 1e-8 units (exact for the 8-decimal values HouseBets serves). */
export function units8(x: string | number): bigint {
  const s = typeof x === 'number' ? x.toFixed(8) : x;
  const neg = s.startsWith('-'); const [i, f = ''] = (neg ? s.slice(1) : s).split('.');
  const v = BigInt(i || '0') * 100000000n + BigInt((f + '00000000').slice(0, 8));
  return neg ? -v : v;
}
