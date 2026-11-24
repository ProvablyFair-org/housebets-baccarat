// The BACCARAT profile's 31 checks (id, name, layer, kind, policy), generated from the framework's games/baccarat/profile.json
// (profileVersion 1.0.2-public, framework 1.1, sha256 47bb372f91578c3b3bdce9f7048709da034ce8457fd929a16a32ed22304d6d52; the public form of the vendored 1.0.2). Regenerate (tools/gen-profile-map.py) rather than edit.
export type Policy = 'HARD_FAIL' | 'FLAG' | 'INFORMATIONAL' | 'GRADED' | 'RELEASE_GATE';
export interface ProfileCheck { id: string; name: string; layer: string; kind: 'verifier-step' | 'package-check'; policy: Policy }
export const PROFILE_SHA256 = '47bb372f91578c3b3bdce9f7048709da034ce8457fd929a16a32ed22304d6d52';
export const PROFILE_VERSION = "1.0.2-public";
/** The framework profile itself, vendored byte for byte (sha256 == PROFILE_SHA256, cited in MANIFEST.md). verify
 *  reads it at run time and holds PROFILE below to it: a check id missing here or carrying another policy is INCOMPLETE (exit 3). */
export const PROFILE_VENDORED = 'profile/baccarat.profile.json';
export const PROFILE: readonly ProfileCheck[] = [
  { id: "BACCARAT-01", name: "Seed hash integrity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-02", name: "Forward commitment chain", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-03", name: "Hash consistency within epoch", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-04", name: "Nonce continuity", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-05", name: "Population & epoch size (G-BIND)", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-06", name: "Client-seed influence & Phase D recomputation", layer: "S1", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-07", name: "Card recomputation in deal order", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-08", name: "Draw bias bound", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-09", name: "RNG reference vectors", layer: "S2", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-10", name: "Tableau replay & outcome", layer: "S2", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-11", name: "Payout arithmetic", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-12", name: "Bet-size invariance (Phase C)", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-13", name: "Spot pay provenance (exact fractions)", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-14", name: "Pay bounds & push rules", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "BACCARAT-15", name: "Spot & outcome-class coverage", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "BACCARAT-16", name: "Wallet / balance reconciliation", layer: "S3", kind: "verifier-step", policy: "FLAG" },
  { id: "BACCARAT-17", name: "Spot-set independence", layer: "S3", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-18", name: "Anti-circularity (outcome probabilities)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-19", name: "Per-spot RTP by exact enumeration vs claim", layer: "S4", kind: "verifier-step", policy: "FLAG" },
  { id: "BACCARAT-20", name: "Simulation Pass 1 (fresh seeds)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-21", name: "Simulation Pass 2 (cherry-pick)", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-22", name: "Live-sample fit", layer: "S4", kind: "verifier-step", policy: "INFORMATIONAL" },
  { id: "BACCARAT-23", name: "S5 fairness-integrity matrix", layer: "S5", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-24", name: "Player-verifier parity", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-25", name: "Player check path documented", layer: "S6", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-26", name: "Dataset & config pins", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-27", name: "Artifacts of record", layer: "S7", kind: "verifier-step", policy: "HARD_FAIL" },
  { id: "BACCARAT-28", name: "Fresh-clone reproduction", layer: "S7", kind: "package-check", policy: "RELEASE_GATE" },
  { id: "BACCARAT-29", name: "Mutation battery", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-30", name: "Disclosure register & evidence appendix", layer: "S7", kind: "package-check", policy: "GRADED" },
  { id: "BACCARAT-31", name: "Side-bet settlement", layer: "S4", kind: "verifier-step", policy: "HARD_FAIL" },
];
