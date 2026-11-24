// BACCARAT-18 — the exact joint distribution of one round on a fresh 8-deck shoe, by enumeration, from the spec's deck
// and tableau alone (no operator probability is read). A round's settlement on every spot depends only on
//   (outcome, natural, margin) — the main result and the Dragon rung — and (pPair, bPair, pPerf, bPerf),
// so the enumeration is over those 7 fields. The first four cards are enumerated by card id (rank × suit, 8 physical
// copies of each of the 52 ids, drawn without replacement); third cards matter only by value, so they are enumerated by
// value class (0 has 128 cards, 1..9 have 32 each) on the shoe the first four left.
// Weights are integer counts of ordered 6-card sequences over D = 416·415·414·413·412·411 = 4,998,398,275,503,360
// (< 2^53, so every partial sum is exact in a double; the totals are converted to BigInt). A round that ends with k
// cards dealt is weighted by the number of ways to fill the remaining 6 − k positions, so every leaf has the same
// denominator D.
import { valueOfRank, PAYS, DRAGON, RUNG, RUNG_NATURAL, SPOTS, type Spot } from './spec.ts';
import { bankerDrawsAfterPlayerThird, payUnits } from './rules.ts';

export const D = 416n * 415n * 414n * 413n * 412n * 411n;
export interface JointClass { outcome: 'player' | 'banker' | 'tie'; natural: boolean; margin: number; pPair: boolean; bPair: boolean; pPerf: boolean; bPerf: boolean; w: bigint }

const VALUE_CARDS = [128, 32, 32, 32, 32, 32, 32, 32, 32, 32];

/** The joint distribution (≤ 480 classes, weights summing to D). `corrupt` is the negative control of BACCARAT-18. */
export function enumerateJoint(corrupt?: { valueOfRank?: (r: number) => number }): JointClass[] {
  const vor = corrupt?.valueOfRank ?? valueOfRank;
  const acc = new Map<string, number>();
  const add = (o: string, nat: boolean, m: number, pp: boolean, bp: boolean, pf: boolean, bf: boolean, w: number) => {
    const k = `${o}|${+nat}|${m}|${+pp}|${+bp}|${+pf}|${+bf}`; acc.set(k, (acc.get(k) || 0) + w);
  };
  const vcards = VALUE_CARDS.slice();
  if (corrupt?.valueOfRank) { vcards.fill(0); for (let r = 0; r < 13; r++) vcards[vor(r)] += 32; }
  // third-card outcomes per (values of the first four): memoized list of [outcome, natural, margin, weight of the tail]
  const memo = new Map<string, [string, boolean, number, number][]>();
  const tails = (v0: number, v1: number, v2: number, v3: number): [string, boolean, number, number][] => {
    const key = `${v0}${v1}${v2}${v3}`; const hit = memo.get(key); if (hit) return hit;
    const rem = vcards.slice(); rem[v0]--; rem[v1]--; rem[v2]--; rem[v3]--;
    const out: [string, boolean, number, number][] = [];
    const res = (pt: number, bt: number, nat: boolean, w: number) => out.push([pt > bt ? 'player' : bt > pt ? 'banker' : 'tie', nat, Math.abs(pt - bt), w]);
    const pt = (v0 + v2) % 10, bt = (v1 + v3) % 10;
    if (pt >= 8 || bt >= 8) res(pt, bt, true, 412 * 411);
    else if (pt <= 5) {
      for (let a = 0; a < 10; a++) {
        const c3 = rem[a]; if (!c3) continue; const pt3 = (pt + a) % 10;
        if (bankerDrawsAfterPlayerThird(bt, a)) { for (let b = 0; b < 10; b++) { const c4 = rem[b] - (b === a ? 1 : 0); if (c4 > 0) res(pt3, (bt + b) % 10, false, c3 * c4); } }
        else res(pt3, bt, false, c3 * 411);
      }
    } else if (bt <= 5) { for (let b = 0; b < 10; b++) { const c4 = rem[b]; if (c4 > 0) res(pt, (bt + b) % 10, false, c4 * 411); } }
    else res(pt, bt, false, 412 * 411);
    memo.set(key, out); return out;
  };
  const cats = [0, 0, 0, 0];
  const ids = [0, 0, 0, 0];
  for (let r0 = 0; r0 < 13; r0++) for (let r1 = 0; r1 < 13; r1++) for (let r2 = 0; r2 < 13; r2++) for (let r3 = 0; r3 < 13; r3++) {
    cats.fill(0);
    for (let s0 = 0; s0 < 4; s0++) for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) for (let s3 = 0; s3 < 4; s3++) {
      ids[0] = s0 * 13 + r0; ids[1] = s1 * 13 + r1; ids[2] = s2 * 13 + r2; ids[3] = s3 * 13 + r3;
      let w = 1;
      for (let i = 0; i < 4; i++) { let same = 0; for (let j = 0; j < i; j++) if (ids[j] === ids[i]) same++; w *= 8 - same; }
      cats[(ids[0] === ids[2] ? 1 : 0) + (ids[1] === ids[3] ? 2 : 0)] += w;
    }
    const pp = r0 === r2, bp = r1 === r3;
    const t = tails(vor(r0), vor(r1), vor(r2), vor(r3));
    for (let c = 0; c < 4; c++) {
      const W = cats[c]; if (!W) continue;
      for (const [o, nat, m, tw] of t) add(o, nat, m, pp, bp, (c & 1) === 1, (c & 2) === 2, W * tw);
    }
  }
  return [...acc.entries()].map(([k, w]) => { const [o, nat, m, pp, bp, pf, bf] = k.split('|');
    return { outcome: o as JointClass['outcome'], natural: nat === '1', margin: Number(m), pPair: pp === '1', bPair: bp === '1', pPerf: pf === '1', bPerf: bf === '1', w: BigInt(w) }; })
    .sort((a, b) => (a.outcome + a.natural + a.margin + a.pPair + a.bPair + a.pPerf + a.bPerf).localeCompare(b.outcome + b.natural + b.margin + b.pPair + b.bPair + b.pPerf + b.bPerf));
}

// ── exact rationals (BigInt) ──
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
export const reduce = (n: bigint, d: bigint): string => { const g = gcd(n, d) || 1n; return `${n / g}/${d / g}`; };
export const sumW = (J: readonly JointClass[], f: (c: JointClass) => boolean): bigint => J.reduce((s, c) => (f(c) ? s + c.w : s), 0n);

/** The event probabilities the server publishes (E01 `probabilities` keys), from the enumeration, as reduced fractions. */
export function eventProbabilities(J: readonly JointClass[]): Record<string, string> {
  const P = (f: (c: JointClass) => boolean) => reduce(sumW(J, f), D);
  const out: Record<string, string> = {
    banker: P((c) => c.outcome === 'banker'), player: P((c) => c.outcome === 'player'), tie: P((c) => c.outcome === 'tie'),
    playerPair: P((c) => c.pPair), bankerPair: P((c) => c.bPair), eitherPair: P((c) => c.pPair || c.bPair), perfectPair: P((c) => c.pPerf || c.bPerf),
  };
  for (const [side, o] of [['playerBonus', 'player'], ['bankerBonus', 'banker']] as const) {
    out[`${side}/natural`] = P((c) => c.outcome === o && c.natural);
    for (const m of [9, 8, 7, 6, 5, 4]) out[`${side}/${m}`] = P((c) => c.outcome === o && !c.natural && c.margin === m);
    out[`${side}/push`] = P((c) => c.outcome === 'tie' && c.natural);
  }
  return out;
}

/** Exact RTP of a spot with the published fraction, NOT floored: Σ w × pay / D as a reduced fraction. */
export function exactRtp(J: readonly JointClass[], spot: Spot): { n: bigint; d: bigint } {
  // pay per unit stake as a rational with a common denominator
  let num = 0n; let den = 1n;
  const addR = (n: bigint, d: bigint) => { num = num * d + n * den; den = den * d; const g = gcd(num, den); num /= g; den /= g; };
  for (const c of J) {
    let pn = 0n, pd = 1n;
    if (spot === 'playerBonus' || spot === 'bankerBonus') {
      const [kn, kd] = DRAGON[spot]; const o = spot === 'playerBonus' ? 'player' : 'banker';
      if (c.outcome === 'tie') { if (c.natural) { pn = 1n; pd = 1n; } }
      else if (c.outcome === o) { const m = c.natural ? RUNG_NATURAL : RUNG[c.margin]; if (m !== undefined) { pn = kd + kn * m; pd = kd; } }
    } else {
      const [n, d] = PAYS[spot];
      const win = spot === 'player' ? c.outcome === 'player' : spot === 'banker' ? c.outcome === 'banker' : spot === 'tie' ? c.outcome === 'tie'
        : spot === 'playerPair' ? c.pPair : spot === 'bankerPair' ? c.bPair : spot === 'eitherPair' ? c.pPair || c.bPair : c.pPerf || c.bPerf;
      if (win) { pn = n; pd = d; } else if ((spot === 'player' || spot === 'banker') && c.outcome === 'tie') { pn = 1n; pd = 1n; }
    }
    if (pn) addR(c.w * pn, pd * D);
  }
  return { n: num, d: den };
}

/** Exact mean and second moment (1e-8 units, as rationals over D) of the summed payout of a spot set at the given stakes. */
export function moments(J: readonly JointClass[], stakes: readonly (readonly [Spot, bigint])[]): { mean: { n: bigint; d: bigint }; m2: { n: bigint; d: bigint } } {
  let s1 = 0n, s2 = 0n;
  for (const c of J) { let p = 0n; for (const [spot, a] of stakes) p += payUnits(spot, a, c); s1 += c.w * p; s2 += c.w * p * p; }
  return { mean: { n: s1, d: D }, m2: { n: s2, d: D } };
}

/** Floored RTP of a spot at stake a (1e-8 units): Σ w · floor-pay / (D · a), exact. */
export function flooredRtp(J: readonly JointClass[], spot: Spot, a: bigint): { n: bigint; d: bigint } {
  let s = 0n; for (const c of J) s += c.w * payUnits(spot, a, c); return { n: s, d: D * a };
}
export const ALL_SPOTS = SPOTS;
