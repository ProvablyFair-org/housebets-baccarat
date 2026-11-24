// HouseBets baccarat — FROZEN SIMULATION DESIGN, single-sourced so the producer (src/simulate.ts) and the verifier
// (tests/verify.ts, BACCARAT-20 / BACCARAT-21) cannot pin different experiments. Every seed of the experiment is a fixed
// string, so the census is a deterministic function of this file and the dataset: a re-run reproduces it byte for byte;
// the verifier re-runs it in full and never trusts a statistic the artifact reports about itself.

// ── The BACCARAT profile's floors (games/baccarat/profile.json 1.0.0), held apart from the design so a cheaper design
// cannot lower them: the verifier compares the census against THESE.
export const FLOOR_PASS1_ROUNDS = 1_000_000;   // BACCARAT-20 "≥ 1,000,000 rounds … every spot settles on every round"
export const FLOOR_PASS2_NONCES = 10_000;      // BACCARAT-21 "every revealed seed × 10,000 nonces"

export const ALPHA = 0.01;
/** Pass 1 screens: 6 position-uniformity chi² tests + lag-1 + runs = 8, each at α/8 (Bonferroni). */
export const PASS1_SCREENS = 8;
export const ALPHA_SCREEN = ALPHA / PASS1_SCREENS;

// ── Pass 1: 100 fresh seeds × nonces 1..10,000 = 1,000,000 rounds; every spot settles on every round at 1.00 (1e8 units)
export const PASS1_SEEDS = 100;
export const PASS1_NONCES = 10_000;
export const PASS1_ROUNDS = PASS1_SEEDS * PASS1_NONCES;
export const PASS1_STAKE_UNITS = 100_000_000n;   // 1.00 per spot, so the 1e-8 floor costs ≤ 1e-8 of RTP per spot
export const PASS1_POSITIONS = 6;                 // card-id uniformity at shoe positions 0..5 (52 bins each, df 51)
export const pass1Seed = (i: number): { server: string; client: string } =>
  ({ server: `housebets-baccarat-audit/sim/pass1/server/${i}`, client: `housebets-baccarat-audit/sim/pass1/client/${i}` });
/** Outcome-class / spot RTP tolerance: |sim − exact| ≤ 5·SE + buffer, SE = σ/√n from the exact enumeration. */
export const CLASS_SIGMAS = 5;
export const CLASS_BUFFER = 1e-4;
export const RTP_SIGMAS = 5;
export const RTP_BUFFER = 1e-4;
/** Convergence marks (rounds) recorded per spot for the RTP convergence rows. */
export const SIM_CONVERGENCE_MARKS: readonly number[] = Object.freeze([10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]);

// ── Pass 2, cherry-pick: every revealed seed of the package (Phase A 130, C 6, C $10 6, D 4; src/loader.ts
// EXPECTED_PASS2_EPOCHS) × nonces 1..10,000; early window = nonces 1..50 (the captured depth per epoch, the same in every
// set), reference window = 51..10,000; statistic = the summed payout (1e-8 units) of the spot sets the capture actually
// played in that epoch (cycled in nonce order), standardized by its EXACT mean and variance from the enumeration
// (src/enumerate.ts moments), aggregated across the 146 epochs; pre-registered one-sided lower tail at ALPHA.
export const SIM_PASS2_NONCES = 10_000;
export const SIM_PASS2_EARLY_WINDOW = 50;
export const SIM_PASS2_ALPHA = ALPHA;

/** The fresh-seed server seeds are the sha256 hex of these strings (64 hex chars, the platform's seed shape). */
export const FRESH_SEED_RULE = 'serverSeed = sha256(label) as lowercase hex; clientSeed = label';
