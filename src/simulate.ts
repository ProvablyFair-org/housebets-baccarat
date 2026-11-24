// HouseBets baccarat — the simulation CENSUS (BACCARAT-20 Pass 1, BACCARAT-21 Pass 2). A pure function of
// src/sim-config.ts and the revealed seeds of every dataset: integer counts and exact 1e-8-unit sums only, plus the lag-1 and
// runs sums of the position-0 card sequence (re-derived by the verifier, which re-runs this census in full).
//   npm run simulate        rewrite outputs/simulation-results.json (the pinned artifact) and print its sha256
//   npm run simulate:run    write outputs/run/simulation-results.json (a regeneration, compared by scripts/fresh-copy-check.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { shoeTop, sha256Hex } from './rng.ts';
import { deal, payUnits, units8, dragonRung, type Deal } from './rules.ts';
import { enumerateJoint, moments, D } from './enumerate.ts';
import { SPOTS, type Spot } from './spec.ts';
import { ROOT, revealedSets } from './loader.ts';
import { PASS1_SEEDS, PASS1_NONCES, PASS1_STAKE_UNITS, PASS1_POSITIONS, pass1Seed, SIM_CONVERGENCE_MARKS, SIM_PASS2_NONCES, SIM_PASS2_EARLY_WINDOW,
  FRESH_SEED_RULE } from './sim-config.ts';
import type { Dataset } from './types.ts';

/** The outcome classes Pass 1 counts (each compared with its exact probability by the verifier). */
export const CLASS_KEYS = ['banker', 'player', 'tie', 'natural', 'playerPair', 'bankerPair', 'eitherPair', 'perfectPair',
  'playerBonus/natural', 'playerBonus/9', 'playerBonus/8', 'playerBonus/7', 'playerBonus/6', 'playerBonus/5', 'playerBonus/4',
  'bankerBonus/natural', 'bankerBonus/9', 'bankerBonus/8', 'bankerBonus/7', 'bankerBonus/6', 'bankerBonus/5', 'bankerBonus/4', 'naturalTie'] as const;
export function classesOf(d: Pick<Deal, 'outcome' | 'natural' | 'margin' | 'pPair' | 'bPair' | 'pPerf' | 'bPerf'>): string[] {
  const k: string[] = [d.outcome];
  if (d.natural) k.push('natural');
  if (d.pPair) k.push('playerPair'); if (d.bPair) k.push('bankerPair'); if (d.pPair || d.bPair) k.push('eitherPair'); if (d.pPerf || d.bPerf) k.push('perfectPair');
  for (const side of ['player', 'banker'] as const) { const r = dragonRung(side, d); if (r !== null) k.push(`${side}Bonus/${d.natural ? 'natural' : d.margin}`); }
  if (d.outcome === 'tie' && d.natural) k.push('naturalTie');
  return k;
}

export interface Window { rounds: number; ret: string; meanNumD: string; varNumD2: string }
export interface Census {
  design: Record<string, unknown>;
  pass1: { rounds: number; draws: number; rejections: number; positions: number[][]; lag1: { n: number; sumXY: string; sumX: string; sumX2: string };
    runs: { n: number; n1: number; runs: number; threshold: number }; classes: Record<string, number>;
    spots: Record<string, { paidUnits: string; marks: { n: number; paidUnits: string }[] }> };
  pass2: { epochs: { set: string; epoch: number; seedHash: string; early: Window; ref: Window; rejections: number }[] };
}

const fresh = (label: string): string => sha256Hex(label);
type Stakes = readonly (readonly [Spot, bigint])[];
export const stakesOf = (r: { request: { bets: { spot: Spot; amount: number }[] } }): Stakes => r.request.bets.map((b) => [b.spot, units8(b.amount)] as const);
const stakesKey = (s: Stakes) => s.map(([sp, a]) => `${sp}:${a}`).join(',');

export function census(sets: readonly (readonly [string, Dataset])[], onProgress?: (s: string) => void): Census {
  // ── Pass 1
  const positions = Array.from({ length: PASS1_POSITIONS }, () => new Array(52).fill(0));
  const classes: Record<string, number> = {}; const paid: Record<string, bigint> = {}; const marks: Record<string, { n: number; paidUnits: string }[]> = {};
  for (const s of SPOTS) { paid[s] = 0n; marks[s] = []; }
  let sx = 0n, sx2 = 0n, sxy = 0n, prev = -1, n = 0, n1 = 0, runs = 0, last: boolean | null = null, draws = 0, rejections = 0;
  const THR = 26;   // above = position-0 id ≥ 26: exactly 26 of the 52 ids
  for (let i = 0; i < PASS1_SEEDS; i++) {
    const { server, client } = pass1Seed(i); const S = fresh(server);
    for (let nonce = 1; nonce <= PASS1_NONCES; nonce++) {
      const sh = shoeTop(S, client, nonce, PASS1_POSITIONS); draws += sh.draws; rejections += sh.rejections;
      for (let p = 0; p < PASS1_POSITIONS; p++) positions[p][sh.ids[p]]++;
      const x = sh.ids[0]; const X = BigInt(x); sx += X; sx2 += X * X; if (prev >= 0) sxy += BigInt(prev) * X; prev = x; n++;
      const above = x >= THR; if (above) n1++; if (above !== last) { runs++; last = above; }
      const d = deal(sh.ids);
      for (const k of classesOf(d)) classes[k] = (classes[k] || 0) + 1;
      for (const s of SPOTS) paid[s] += payUnits(s, PASS1_STAKE_UNITS, d);
      if (SIM_CONVERGENCE_MARKS.includes(n)) for (const s of SPOTS) marks[s].push({ n, paidUnits: String(paid[s]) });
    }
  }
  onProgress?.(`pass 1: ${n} rounds`);

  // ── Pass 2: every revealed epoch of every dataset (Phase A, C, C $10, D, in that order) × nonces 1..10,000, the epoch's
  // 50 played spot sets cycled in nonce order
  const J = enumerateJoint();
  const memo = new Map<string, { s1: bigint; v: bigint }>();
  const mom = (st: Stakes) => { const k = stakesKey(st); let m = memo.get(k);
    if (!m) { const r = moments(J, st); m = { s1: r.mean.n, v: r.m2.n * D - r.mean.n * r.mean.n }; memo.set(k, m); } return m; };
  const epochs: Census['pass2']['epochs'] = [];
  for (const [set, ds] of sets) {
    const byEpoch = new Map<string, typeof ds.rounds>();
    for (const r of ds.rounds) { const h = r.response.game.fairness.hashedServerSeed; if (!byEpoch.has(h)) byEpoch.set(h, []); byEpoch.get(h)!.push(r); }
    for (const sd of ds.seeds) {
      const played = (byEpoch.get(sd.hashedServerSeed) || []).slice().sort((a, b) => a.nonce - b.nonce).map(stakesOf);
      const z = () => ({ rounds: 0, ret: 0n, m: 0n, v: 0n }); const acc = { early: z(), ref: z() }; let rej = 0;
      for (let nonce = 1; nonce <= SIM_PASS2_NONCES; nonce++) {
        const st = played[(nonce - 1) % played.length]; const sh = shoeTop(sd.revealedServerSeed, sd.clientSeed, nonce); rej += sh.rejections;
        const d = deal(sh.ids); let p = 0n; for (const [sp, a] of st) p += payUnits(sp, a, d);
        const w = nonce <= SIM_PASS2_EARLY_WINDOW ? acc.early : acc.ref; const m = mom(st);
        w.rounds++; w.ret += p; w.m += m.s1; w.v += m.v;
      }
      const out = (w: ReturnType<typeof z>): Window => ({ rounds: w.rounds, ret: String(w.ret), meanNumD: String(w.m), varNumD2: String(w.v) });
      epochs.push({ set, epoch: Number(sd.epoch), seedHash: sd.hashedServerSeed, early: out(acc.early), ref: out(acc.ref), rejections: rej });
    }
  }
  onProgress?.(`pass 2: ${epochs.length} epochs × ${SIM_PASS2_NONCES}`);

  return {
    design: { freshSeedRule: FRESH_SEED_RULE, pass1: { seeds: PASS1_SEEDS, nonces: PASS1_NONCES, positions: PASS1_POSITIONS, stakeUnits: String(PASS1_STAKE_UNITS), runsAbove: 'position-0 id >= 26' },
      pass2: { nonces: SIM_PASS2_NONCES, earlyWindow: SIM_PASS2_EARLY_WINDOW, dataset: 'every revealed seed: Phase A (data/housebets-baccarat-6500rounds.json), then C, C $10 and D (data/supplementary)',
        units: 'ret = summed payout of the played spot set in 1e-8 units; meanNumD / D = the exact expected payout; varNumD2 / D^2 = the exact variance (src/enumerate.ts, D = 416·415·414·413·412·411)' } },
    pass1: { rounds: n, draws, rejections, positions, lag1: { n, sumXY: String(sxy), sumX: String(sx), sumX2: String(sx2) }, runs: { n, n1, runs, threshold: THR },
      classes: Object.fromEntries(Object.entries(classes).sort(([a], [b]) => a.localeCompare(b))),
      spots: Object.fromEntries(SPOTS.map((s) => [s, { paidUnits: String(paid[s]), marks: marks[s] }])) },
    pass2: { epochs },
  };
}

export const censusText = (c: Census): string => JSON.stringify(c, null, 2) + '\n';

if (process.argv[1] && /simulate\.ts$/.test(process.argv[1])) {
  const t0 = Date.now();
  const c = census(revealedSets(), (s) => console.log(`  ${s}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`));
  const text = censusText(c);
  const emit = process.env.PF_EMIT === '1';
  const dir = emit ? join(ROOT, 'outputs') : join(ROOT, 'outputs', 'run'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'simulation-results.json'), text);
  console.log(`wrote ${emit ? 'outputs' : 'outputs/run'}/simulation-results.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
