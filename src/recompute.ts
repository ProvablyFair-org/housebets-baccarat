// The per-round recompute core of tests/verify.ts, in its own module so that the excluded same-engine capture can be
// recomputed by the same code (src/recompute-excluded.ts). Nothing here reads a served card, outcome, flag,
// label, payout or multiplier as an input — served fields are only compared.
//   cards     the first six cards of the shuffled shoe, the Player / Banker hands (BACCARAT-07)
//   tableau   totals and outcome; flags natural / margin / pair / perfect (BACCARAT-10)
//   spots     every staked spot's payout AND its served result label (win / lose / push) == recomputed (BACCARAT-11)
//   copies    the capture's round record and the server's round record == the server's answer; the round lookup == the
//             answer (BACCARAT-03)
//   grid      every money field on the wallet's 1e-8 grid; the served multiplier == payout / stake (BACCARAT-11)
//   floor     per round: what a single floor of the round's exact total would pay against the served per-spot floors
//             (the operator finding E02 "a floor per round" vs E01 "every payout is rounded down once", BACCARAT-11)
import { shoeTop } from './rng.ts';
import { deal, names, payUnits, units8, type Deal } from './rules.ts';
import { FAIRNESS_VERSION, PAYS, DRAGON, type Spot } from './spec.ts';
import { dragonRung } from './rules.ts';
import type { Dataset, Round, Seed } from './types.ts';

/** On the wallet's 1e-8 grid: the JSON number is exactly the double of an 8-decimal value (an off-grid 0.020000001 is not). */
export const onGrid = (x: unknown): boolean => typeof x === 'number' && Number.isFinite(x) && Number(x.toFixed(8)) === x;

/** The exact (unfloored) pay of one spot as a fraction [num, den] of 1e-8 units. */
export function exactPay(spot: Spot, a: bigint, d: Pick<Deal, 'outcome' | 'natural' | 'margin' | 'pPair' | 'bPair' | 'pPerf' | 'bPerf'>): [bigint, bigint] {
  if (spot === 'playerBonus' || spot === 'bankerBonus') {
    const [kn, kd] = DRAGON[spot];
    if (d.outcome === 'tie') return [d.natural ? a : 0n, 1n];
    const m = dragonRung(spot === 'playerBonus' ? 'player' : 'banker', d);
    return m === null ? [0n, 1n] : [a * (kd + kn * m), kd];
  }
  const fl = payUnits(spot, a, d);
  if (fl === 0n || fl === a) return [fl, 1n];          // a loss or a push is exact
  const [n, den] = PAYS[spot]; return [a * n, den];
}
const labelOf = (pay: bigint, a: bigint): string => (pay > a ? 'win' : pay === a && pay > 0n ? 'push' : 'lose');

export interface Per { r: Round; s: Seed | undefined; d: Deal | null; ids: number[] | null; total: bigint; stake: bigint; payOk: boolean; cardsOk: boolean; floorGap: bigint }
export interface RC { n: number; cards: number; tableau: number; flags: number; spotPay: number; spotsCompared: number; spotLabels: number; roundPay: number; copies: number; stakeOk: number;
  version: number; clientOk: number; rejections: number; answerCopies: number; lookupN: number; lookupOk: number; gridN: number; gridBad: number; gridWhere: string[]; multOk: number;
  floorRounds: number; floorUnits: bigint; floorBy: Record<string, number>; bad: string[]; per: Per[] }

export function recompute(d: Dataset): RC {
  const bySeed = new Map(d.seeds.map((s) => [s.hashedServerSeed, s]));
  const c: RC = { n: 0, cards: 0, tableau: 0, flags: 0, spotPay: 0, spotsCompared: 0, spotLabels: 0, roundPay: 0, copies: 0, stakeOk: 0, version: 0, clientOk: 0, rejections: 0,
    answerCopies: 0, lookupN: 0, lookupOk: 0, gridN: 0, gridBad: 0, gridWhere: [], multOk: 0, floorRounds: 0, floorUnits: 0n, floorBy: {}, bad: [], per: [] };
  for (const r of d.rounds) {
    c.n++; const g = r.response.game as any, f = g.fairness, s = bySeed.get(f.hashedServerSeed);
    const rr = r.response.round as any, rc = r as any;
    // every money field of the request, the answer, the server's round record, the capture's copy and the lookup
    const lk = rc.lookup?.detail?.game;
    const grid: [string, unknown][] = [['request', r.request.amount], ...r.request.bets.map((b) => ['request', b.amount] as [string, unknown]), ['answer', g.stake], ['answer', g.payout], ['answer', g.maxWin],
      ...g.bets.flatMap((b: any) => [['answer', b.amount], ['answer', b.payout]] as [string, unknown][]), ['round record', rr?.stake], ['round record', rr?.payout], ['round record', rr?.delta],
      ['copy', rc.stake], ['copy', rc.payout], ...(lk ? [['lookup', lk.stake], ['lookup', lk.payout], ...lk.bets.flatMap((b: any) => [['lookup', b.amount], ['lookup', b.payout]])] as [string, unknown][] : [])];
    for (const v of [r.response.balance, rr?.balance, rc.balance]) if (v !== undefined && v !== null) grid.push(['balance', v]);
    for (const [w, v] of grid) { c.gridN++; if (!onGrid(v)) { c.gridBad++; if (c.gridWhere.length < 3) c.gridWhere.push(`round ${r.idx} ${w}: ${v}`); } }
    // the served multiplier is a ratio, not money: it must be the round's payout / stake as a double
    if (g.multiplier === g.payout / g.stake) c.multOk++; else c.bad.push(`round ${r.idx}: multiplier ${g.multiplier} != payout / stake`);
    // the capture's copy of the round, the server's round record and the round lookup == the server's answer
    const bal = r.response.balance;
    const copyOk = r.roundId === g.roundId && rc.nonce === f.nonce && rc.clientSeed === f.clientSeed && rc.hashedServerSeed === f.hashedServerSeed && rc.fairnessVersion === f.version
      && rc.outcome === g.outcome && units8(rc.stake) === units8(g.stake) && units8(rc.payout) === units8(g.payout) && (bal === undefined ? rc.balance === undefined || rc.balance === null : rc.balance === bal)
      && !!rr && rr.roundId === g.roundId && units8(rr.stake) === units8(g.stake) && units8(rr.payout) === units8(g.payout) && units8(rr.delta) === units8(g.payout) - units8(g.stake)
      && (bal === undefined ? rr.balance === undefined : rr.balance === bal);
    if (copyOk) c.answerCopies++; else c.bad.push(`round ${r.idx}: the capture copy or the server's round record differs from the answer`);
    if (lk) { c.lookupN++; if (lk.roundId === g.roundId && JSON.stringify(lk.deck) === JSON.stringify(g.deck) && lk.outcome === g.outcome && JSON.stringify(lk.fairness) === JSON.stringify(f)
      && units8(lk.stake) === units8(g.stake) && units8(lk.payout) === units8(g.payout) && JSON.stringify(lk.bets) === JSON.stringify(g.bets)) c.lookupOk++; else c.bad.push(`round ${r.idx}: the round lookup differs from the answer`); }
    if (!s) { c.bad.push(`round ${r.idx}: no revealed seed for its hash`); c.per.push({ r, s, d: null, ids: null, total: 0n, stake: 0n, payOk: false, cardsOk: false, floorGap: 0n }); continue; }
    if (f.version === FAIRNESS_VERSION) c.version++;
    if (f.clientSeed === s.clientSeed) c.clientOk++; else c.bad.push(`round ${r.idx}: answer clientSeed != epoch client seed`);
    const sh = shoeTop(s.revealedServerSeed, s.clientSeed, f.nonce); c.rejections += sh.rejections;
    const dd = deal(sh.ids);
    const cardsOk = JSON.stringify(names(sh.ids)) === JSON.stringify(g.deck) && JSON.stringify(names(dd.P)) === JSON.stringify(g.player.cards) && JSON.stringify(names(dd.B)) === JSON.stringify(g.banker.cards);
    if (cardsOk) c.cards++; else c.bad.push(`round ${r.idx}: cards ${names(sh.ids).join(' ')} served ${g.deck?.join(' ')}`);
    const tabOk = dd.pt === g.player.total && dd.bt === g.banker.total && dd.outcome === g.outcome;
    if (tabOk) c.tableau++; else c.bad.push(`round ${r.idx}: totals/outcome ${dd.pt}-${dd.bt} ${dd.outcome} served ${g.player.total}-${g.banker.total} ${g.outcome}`);
    // every served flag must be present and equal the recomputed deal (an absent flag fails)
    const flOk = g.playerPair === dd.pPair && g.bankerPair === dd.bPair && g.playerPerfect === dd.pPerf && g.bankerPerfect === dd.bPerf
      && g.natural === dd.natural && g.margin === dd.margin;
    if (flOk) c.flags++; else c.bad.push(`round ${r.idx}: served flags differ from the recomputed deal`);
    let total = 0n, spotsOk = true, xn = 0n, xd = 1n;
    for (const b of r.request.bets) {
      const a = units8(b.amount), p = payUnits(b.spot, a, dd); total += p;
      const [en, ed] = exactPay(b.spot, a, dd); xn = xn * ed + en * xd; xd = xd * ed;
      const sv = g.bets.find((x: any) => x.spot === b.spot);
      if (sv) {
        c.spotsCompared++; if (units8(sv.payout) === p && units8(sv.amount) === a) c.spotPay++; else { spotsOk = false; c.bad.push(`round ${r.idx}: ${b.spot} pays ${p} served ${sv.payout}`); }
        // the served per-spot result label is compared, not only the payout
        if (sv.result === labelOf(p, a)) c.spotLabels++; else { spotsOk = false; c.bad.push(`round ${r.idx}: ${b.spot} labelled ${sv.result}, recomputed ${labelOf(p, a)}`); }
      }
      else { spotsOk = false; c.bad.push(`round ${r.idx}: ${b.spot} staked but not in the answer`); }
    }
    if (g.bets.length !== r.request.bets.length) { spotsOk = false; c.bad.push(`round ${r.idx}: answer carries ${g.bets.length} spots, ${r.request.bets.length} staked`); }
    const stake = r.request.bets.reduce((s2, b) => s2 + units8(b.amount), 0n);
    if (units8(g.stake) === stake) c.stakeOk++; else c.bad.push(`round ${r.idx}: stake ${g.stake} vs sent ${stake}`);
    const payOk = spotsOk && units8(g.payout) === total; if (payOk) c.roundPay++; else c.bad.push(`round ${r.idx}: round payout ${g.payout} vs ${total}`);
    if (rr && rr.roundId === g.roundId && rr.roundId === r.roundId && units8(rr.stake) === stake && units8(rr.payout) === total) c.copies++; else c.bad.push(`round ${r.idx}: round record != recomputed`);
    // the operator finding: a single floor of the round's exact total minus the sum of the per-spot floors (≥ 0, in 1e-8 units)
    const floorGap = xn / xd - total;
    if (floorGap > 0n) { c.floorRounds++; c.floorUnits += floorGap; c.floorBy[String(floorGap)] = (c.floorBy[String(floorGap)] || 0) + 1; }
    c.per.push({ r, s, d: dd, ids: sh.ids, total, stake, payOk, cardsOk: cardsOk && tabOk, floorGap });
  }
  return c;
}
