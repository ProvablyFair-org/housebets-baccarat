// Dataset pins and the population of record, stated as CODE next to the pin (the framework's G-BIND rule: a dataset
// that agrees with its own header proves nothing; the scored steps compare against these constants, never meta).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { Dataset } from './types.ts';

/** The package root: the nearest folder above this module holding package.json "housebets-baccarat-audit" (works from
 *  src/ under Node and from the bundled verify.js at the root). */
function findRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = join(d, 'package.json');
    if (existsSync(p) && /"name":\s*"housebets-baccarat-audit"/.test(readFileSync(p, 'utf8'))) return d;
    d = dirname(d);
  }
  throw new Error('package root not found');
}
export const ROOT = findRoot();
export const DATA = join(ROOT, 'data');

// Phase A primary: the 130 whole epochs of the 12 Oct 2026 capture (every epoch already exactly 50 rounds: no split)
export const PRIMARY_FILE = 'housebets-baccarat-6500rounds.json';
export const PRIMARY_SHA256 = '061d54f26ef58aea3fb7a969b6c2ba310d6d6cc6dc932d4ea1f3776e1dd91717';
// Supplementary phases (13 Oct 2026), each its own dataset and evidence id (audit-rules §2.5)
export const PHASE_C_FILE = 'supplementary/housebets-baccarat-phaseC-300rounds.json';
export const PHASE_C_SHA256 = '88d0d49a69fdd1bba9297549b17399c96b14bee010e69fce91c539c0e71af636';
export const PHASE_C10_FILE = 'supplementary/housebets-baccarat-phaseC-10usd-300rounds.json';
export const PHASE_C10_SHA256 = 'e19e033bf03702736ff3d384d5a9b4fa70453f844ab59de927e5af92707a5035';
export const PHASE_D_FILE = 'supplementary/housebets-baccarat-phaseD-200rounds.json';
export const PHASE_D_SHA256 = '137e3f335869e949a057e0688cb951f99b024033b9b4f37c1d02a3350290a1d7';

/** Evidence exhibits (scripts/make-evidence.py), all pinned. */
export const EVIDENCE_PINS: readonly (readonly [string, string])[] = [
  ['evidence/E01-baccarat-fairness-spec-2026-10-12.json', '97c9e7216086d7df115430bfc3e6d99db60be388daaf77ffc3f143de3fcd7f39'],
  ['evidence/E02-baccarat-rules-panel-2026-10-10.json', '4237d41a39cb4f2c412819feafbbdea7d1663a500efa783c5fbdc3090c556432'],
  ['evidence/E03-baccarat-limits-2026-10-12.json', '0cabca5b8c75d9125d3d56f448a48df7093ef8619ce4e3988436fa8be7a38899'],
  ['evidence/E04-baccarat-bet-history-2026-10-13.json', '251bfd6e7bd89536b7e3366429eb68859acddb168de9847c195d6badb1f02480'],
  ['evidence/E05-account-reconcile-2026-10-13.txt', 'edbda5cf5231e917b212f3d075550f2470f667b343d35365424d02b52b94df39'],
  ['evidence/E06-baccarat-empty-seed-control-2026-10-13.json', '5c2c6280c306c33d2d0feff1da7164bce999b06fbd6add4c690e0af6df3f2c03'],
  ['evidence/E07-seed-reveal-check-2026-10-12.json', '7ab028dd834d1ced2c3c90046e7c6b204a9030f18d19e316275219179a34f283'],
  ['evidence/E08-baccarat-rules-panel-live-2026-10-19.json', '49416944f17b04c21b57b4249b0cd30491aa04a01974febe77c0bd6cf9b953f2'],
];

// The population of record (G-BIND)
export const EXPECTED_ROUNDS = 6500;
export const EXPECTED_SEEDS = 130;
export const EXPECTED_EPOCHS = 130;
export const EXPECTED_EPOCH_SIZE = 50;
export const EXPECTED_PHASE_C_ROUNDS = 300;      // 6 epochs × 50, banker spot, 2.00 (= 100 × the Phase A base 0.02)
export const EXPECTED_PHASE_C10_ROUNDS = 300;    // 6 epochs × 50, banker spot, 10.00 (the $10 set)
export const EXPECTED_PHASE_D_ROUNDS = 200;      // 4 epochs × 50, one player-set client seed per epoch
export const PHASE_A_STAKE = '0.02';             // per spot staked (the Phase A base)
export const PHASE_C_STAKE = '2';
export const PHASE_C10_STAKE = '10';
export const PHASE_D_SEEDS = ['provablyfair-1', 'provablyfair-2', 'player-seed-abc', '1234567890'] as const;
export const NONCE_BASE = 1;   // HouseBets nonces start at 1 on a fresh pair
/** Pass 2 (BACCARAT-21) replays every revealed seed of the package, in this order: Phase A (130), C (6), C $10 (6), D (4).
 *  The profile asks for every revealed seed. */
export const EXPECTED_PASS2_EPOCHS = EXPECTED_EPOCHS + (EXPECTED_PHASE_C_ROUNDS + EXPECTED_PHASE_C10_ROUNDS + EXPECTED_PHASE_D_ROUNDS) / EXPECTED_EPOCH_SIZE;
/** Phase A capture plan (capture-hb-baccarat.mjs; meta.planChange): sub-phase A every spot, B one spot, C three spots,
 *  spots drawn by crypto.randomInt; counts after the 17:19Z scale change that made every epoch 50 rounds. */
export const PLAN_SUBPHASES: Readonly<Record<string, { rounds: number; spots: number }>> = Object.freeze({ A: { rounds: 4333, spots: 9 }, B: { rounds: 1300, spots: 1 }, C: { rounds: 867, spots: 3 } });
export const SPOT_FLOOR = 50;   // BACCARAT-15: Phase A ≥ 50 rounds per spot

export const sha256Bytes = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
export const sha256File = (rel: string): string => sha256Bytes(readFileSync(join(ROOT, rel.startsWith('evidence/') || rel.startsWith('outputs/') ? rel : join('data', rel))));
export const load = (rel: string): Dataset => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as Dataset;
export const readJson = (rel: string): any => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
/** Every dataset of the package with its label, in the order Pass 2 replays their revealed seeds. */
export const revealedSets = (): [string, Dataset][] =>
  [['Phase A', load(PRIMARY_FILE)], ['C', load(PHASE_C_FILE)], ['C $10', load(PHASE_C10_FILE)], ['D', load(PHASE_D_FILE)]];
