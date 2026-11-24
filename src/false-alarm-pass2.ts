// BACCARAT-21 Pass 2 — its false-alarm rate on honest data, DECLARED here and re-checkable with `npm run false-alarm:pass2`.
// Pass 2 rejects when the aggregate early-window payout of the spot sets the capture played (7,300 slots: each captured
// round's own spots and stakes, every revealed seed of the package), standardized by its exact mean and variance, has a one-sided normal lower-tail p below
// 0.01. The payout is a sum of skewed per-round returns (Tie 10.4×, Perfect Pair 29.6×, Dragon up to 35.1×), so the true
// lower tail at the normal 1 % point can differ from 1 %. No closed form: a plain Monte Carlo that draws each slot's round
// from the EXACT joint distribution (src/enumerate.ts) and applies the rule.
import { revealedSets } from './loader.ts';
import { enumerateJoint, D } from './enumerate.ts';
import { payUnits } from './rules.ts';
import { stakesOf } from './simulate.ts';
import { normalLowerTailP } from './stats.ts';
import { SIM_PASS2_ALPHA } from './sim-config.ts';

export const PASS2_FALSE_ALARM = Object.freeze({
  rate: 0.00968,
  standardError: 0.000438,
  replicates: 50_000,
  seed: 20261013,
  method: 'plain Monte Carlo: each of the 7,300 slots (every captured round) draws its round class from the exact joint distribution (alias table over the 298 classes), pays its own spot set, rule applied to each replicate',
});

function xoshiro(seed: number) {
  let a = seed >>> 0, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  return (): number => {
    const r = (Math.imul(Math.imul(b, 5) << 7 | Math.imul(b, 5) >>> 25, 9)) >>> 0;
    const t = b << 9; c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return r / 4294967296;
  };
}

export function simulatePass2FalseAlarm(replicates: number, seed: number) {
  const rounds = revealedSets().flatMap(([, d]) => d.rounds); const J = enumerateJoint();
  const p = J.map((c) => Number(c.w) / Number(D));
  // Walker alias table
  const K = p.length, prob = new Float64Array(K), alias = new Int32Array(K), sc = p.map((x) => x * K), small: number[] = [], large: number[] = [];
  sc.forEach((x, i) => (x < 1 ? small : large).push(i));
  while (small.length && large.length) { const s = small.pop()!, l = large.pop()!; prob[s] = sc[s]; alias[s] = l; sc[l] = sc[l] + sc[s] - 1; (sc[l] < 1 ? small : large).push(l); }
  for (const i of [...small, ...large]) { prob[i] = 1; alias[i] = i; }
  // per distinct spot set: payout per class (1e-8 units as double, exact below 2^53), its mean and variance
  const sets = new Map<string, Float64Array>(); const slotTable: Float64Array[] = [];
  let mean = 0, v = 0;
  for (const r of rounds) {
    const st = stakesOf(r); const key = st.map(([s, a]) => `${s}:${a}`).join(',');
    let t = sets.get(key);
    if (!t) { t = Float64Array.from(J, (c) => { let s = 0n; for (const [sp, a] of st) s += payUnits(sp, a, c); return Number(s); }); sets.set(key, t); }
    slotTable.push(t);
    let m = 0, m2 = 0; for (let i = 0; i < K; i++) { m += p[i] * t[i]; m2 += p[i] * t[i] * t[i]; } mean += m; v += m2 - m * m;
  }
  const sd = Math.sqrt(v), rnd = xoshiro(seed); let rej = 0;
  for (let r = 0; r < replicates; r++) {
    let s = 0;
    for (const t of slotTable) { const u = rnd() * K, i = Math.floor(u); s += t[(u - i) < prob[i] ? i : alias[i]]; }
    if (normalLowerTailP((s - mean) / sd) < SIM_PASS2_ALPHA) rej++;
  }
  const rate = rej / replicates;
  return { rate: Number(rate.toFixed(5)), standardError: Number(Math.sqrt(rate * (1 - rate) / replicates).toPrecision(3)), replicates, seed, slots: slotTable.length };
}

if (process.argv[1] && /false-alarm-pass2\.ts$/.test(process.argv[1])) {
  const r = simulatePass2FalseAlarm(PASS2_FALSE_ALARM.replicates, PASS2_FALSE_ALARM.seed);
  const same = r.rate === PASS2_FALSE_ALARM.rate && r.standardError === PASS2_FALSE_ALARM.standardError;
  console.log(JSON.stringify(r), same ? '== the declaration' : '!= the declaration: update PASS2_FALSE_ALARM');
  process.exitCode = same ? 0 : 1;
}
