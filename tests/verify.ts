// HouseBets House Baccarat (new engine, shoe8) — verification suite: the 31 checks of the BACCARAT profile
// (src/profile-map.ts, generated from the framework's games/baccarat/profile.json, Framework 1.1). Run: npm run
// verify (Node 22, no install).
// Status by policy: HARD_FAIL → PASS | FAIL; FLAG → PASS | FLAG (origin operator or capture); INFORMATIONAL → INFO;
// GRADED / RELEASE_GATE (package checks) → PASS | GAP, reported, not in the verdict — except a release-gate record
// (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing or not the bytes RELEASE-MANIFEST.json pins: FAIL,
// and the verdict is NOT PROVABLY FAIR. A step that throws is scored FAIL, never skipped (step(), below).
// Verdict, ranked as RTP-CLAIM 1.2.0's rtpClaimVerdict: any FAIL → NOT PROVABLY FAIR (exit 1) > a profile check with no status from
// this run → INCOMPLETE (exit 3; never a pass) > BACCARAT-19 OVERSTATED → RTP FIGURE OVERSTATED (exit 5, Methodology
// v1.1) > an operator-origin FLAG → Conditional Pass (exit 2) > Full Pass (exit 0). A stale verify.js → exit 4, no verdict.
// A capture-origin FLAG is disclosed with a limitation row and is verdict-neutral (policy decided 2026-09-17).
// verify writes only outputs/run/ and never rewrites a pinned artifact.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, sha256File, sha256Bytes, readJson, PRIMARY_FILE, PRIMARY_SHA256, PHASE_C_FILE, PHASE_C_SHA256, PHASE_C10_FILE, PHASE_C10_SHA256,
  PHASE_D_FILE, PHASE_D_SHA256, EVIDENCE_PINS, EXPECTED_ROUNDS, EXPECTED_SEEDS, EXPECTED_EPOCHS, EXPECTED_EPOCH_SIZE, EXPECTED_PHASE_C_ROUNDS, EXPECTED_PASS2_EPOCHS,
  EXPECTED_PHASE_C10_ROUNDS, EXPECTED_PHASE_D_ROUNDS, PHASE_A_STAKE, PHASE_C_STAKE, PHASE_C10_STAKE, PHASE_D_SEEDS, NONCE_BASE, PLAN_SUBPHASES,
  SPOT_FLOOR } from '../src/loader.ts';
import { shoeTop, shuffleTop, fullShoe, sha256Hex, limitOf, TWO32 } from '../src/rng.ts';
import * as RNG from '../src/rng.ts';
import { deal, names, payUnits, units8, dragonRung, type Deal } from '../src/rules.ts';
import { SPOTS, PAYS, DRAGON, RUNG, FAIRNESS_VERSION, MAX_BET, MAX_WIN, MIN_STAKE, cardName, type Spot } from '../src/spec.ts';
import { readPublishedClaim, readPublishedSpec, readRoundingTexts } from '../src/claims.ts';
import { enumerateJoint, eventProbabilities, exactRtp, flooredRtp, moments, D, sumW, type JointClass } from '../src/enumerate.ts';
import { PROFILE, PROFILE_SHA256, PROFILE_VERSION, PROFILE_VENDORED, type Policy } from '../src/profile-map.ts';
import { census, censusText, classesOf, CLASS_KEYS, stakesOf, type Census } from '../src/simulate.ts';
import { FLOOR_PASS1_ROUNDS, FLOOR_PASS2_NONCES, ALPHA_SCREEN, PASS1_POSITIONS, PASS1_STAKE_UNITS, PASS1_ROUNDS, CLASS_SIGMAS, CLASS_BUFFER,
  RTP_SIGMAS, RTP_BUFFER, SIM_PASS2_NONCES, SIM_PASS2_EARLY_WINDOW, SIM_PASS2_ALPHA } from '../src/sim-config.ts';
import { chiSquaredPValue, runsStatisticFromCounts, twoSidedNormalP, normalLowerTailP, normalQuantile } from '../src/stats.ts';
import { FAIL_FALSE_ALARM_CAP, fmtRate } from '../src/false-alarm.ts';
import { PASS2_FALSE_ALARM } from '../src/false-alarm-pass2.ts';
import { computeRtpClaim, runRtpClaimGate } from '../src/rtp-settings.ts';
import { RTP_CLAIM_RULE_ENFORCED, rtpClaimVerdict } from '../src/rtp-claim';
import { ARTIFACT_PINS, AUDIT_ID, RUN_RECORD_PINS, SITE_VERIFIER_PIN } from '../src/artifact-pins.ts';
import { loadSiteModule, replay, exportNames, type Probe } from '../src/site-verifier.ts';
import { fieldDiff, beyondTolerance } from '../src/diff.ts';
import { recompute, exactPay, type RC } from '../src/recompute.ts';
import type { Dataset } from '../src/types.ts';

type Status = 'PASS' | 'FAIL' | 'FLAG' | 'INFO' | 'GAP' | 'ABSENT' | 'OVERSTATED';
interface Row { id: string; name: string; policy: Policy; status: Status; origin?: 'operator' | 'capture'; detail: string }
const rows: Row[] = [];
// ═══ A step that throws is scored, never skipped ═══
// Every check below runs inside step(). An exception in a step (a file missing, a dataset field null or absent) marks the
// check(s) that step scores FAIL, with the error in the detail, and the next step still runs. A shared input that cannot be
// computed (input()) becomes a value that throws on first use and names itself, so every step that reads it fails on its own
// row. Any such error makes the verdict NOT PROVABLY FAIR (exit 1). An exception outside every step still prints every row,
// each check it left unscored as FAIL, and exits 1.
const RUN_ERRORS: string[] = [];
const TAINT = new Map<string, string>();
const errText = (e: unknown): string => { const x = e as { code?: string; name?: string; message?: string } | null; return `${x?.code ?? x?.name ?? 'Error'}: ${String(x?.message ?? e).split('\n')[0]}`; };
function step(ids: string[], fn: () => void): void {
  try { fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`${ids.join(', ') || 'a shared computation'}: ${why}`);
    for (const id of ids) if (!TAINT.has(id)) TAINT.set(id, why);
  }
}
function input<T>(name: string, fn: () => T, ...fallback: [T?]): T {
  try { return fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`input ${name}: ${why}`);
    // a boolean condition that cannot be computed is false (it fails the check it feeds); any other input is poisoned
    if (fallback.length) return fallback[0] as T;
    const poison = (): never => { throw new Error(`input ${name} could not be computed (${why})`); };
    return new Proxy(function () {}, { get: poison, apply: poison, construct: poison, has: poison, ownKeys: poison, getOwnPropertyDescriptor: poison }) as unknown as T;
  }
}
function failRow(id: string, detail: string): void {
  const r = rows.find((x) => x.id === id);
  if (r) { const was = `${r.status}: ${r.detail}`; r.status = 'FAIL'; delete r.origin; r.detail = `${detail} (recorded before the error: ${was})`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); }
}
/** Called first in finish(): every check whose step threw becomes FAIL. */
function applyTaint(): void {
  for (const [id, why] of TAINT) failRow(id, `NOT SCORED, the step threw ${why} (an input it reads is missing or malformed); scored FAIL, never skipped`);
  TAINT.clear();
}
/** A release-gate record (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing, not pinned, or not the
 *  bytes RELEASE-MANIFEST.json pins for it: its check is FAIL, and the verdict fails (extraFails). A record that matches its
 *  pin but reports a shortfall stays a GAP. */
function pinFail(id: string, why: string): void {
  const d = `FAIL: the release-gate record is not the one RELEASE-MANIFEST.json pins (${why}); a deleted or edited record fails the verdict`;
  const r = rows.find((x) => x.id === id);
  if (r) { r.status = 'FAIL'; delete r.origin; r.detail = `${d}; ${r.detail}`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail: d }); }
}
/** Verdict-bearing failures outside the scored HARD_FAIL / FLAG rows: a FAIL on a package check (a release-gate record that
 *  is missing or differs from its RELEASE-MANIFEST.json pin) and any run error. */
const extraFails = (): number => rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').length + RUN_ERRORS.length;
process.on('uncaughtException', (e) => {
  try {
    const why = errText(e); RUN_ERRORS.push(`the run stopped outside any step: ${why}`);
    for (const c of PROFILE) if (!rows.some((r) => r.id === c.id) && !TAINT.has(c.id)) TAINT.set(c.id, `${why}; the run stopped before this check`);
    finish();
  } catch (e2) { console.log(`VERDICT: NOT PROVABLY FAIR — the verifier stopped: ${errText(e)}; ${errText(e2)}`); }
  process.exit(1);
});
/** Lines printed under a step's row (never part of the record): BACCARAT-19 prints the RTP-CLAIM gate's own lines. */
const extraLines = new Map<string, string[]>();
// The step list is bound to the framework profile the MANIFEST cites, vendored byte for byte (PROFILE_VENDORED, its
// sha256 == PROFILE_SHA256). Every check of that profile must be in src/profile-map.ts with the same policy, and no other:
// a check missing or relabelled (e.g. a scored check made INFORMATIONAL) gives INCOMPLETE, exit 3, never a pass.
type PB = { ok: boolean; present: boolean; pinned: boolean; cited: boolean; checks: { id: string; name: string; policy: Policy }[]; missing: string[]; relabelled: string[]; extra: string[] };
let pbMemo: PB | null = null;
function profileBinding(): PB {
  if (pbMemo) return pbMemo;
  const f = join(ROOT, PROFILE_VENDORED), raw = existsSync(f) ? readFileSync(f) : null;
  let checks: PB['checks'] = [];
  try { checks = raw ? JSON.parse(raw.toString('utf8')).checks.map((c: any) => ({ id: String(c.id), name: String(c.name), policy: c.policy as Policy })) : []; } catch { checks = []; }
  const man = existsSync(join(ROOT, 'MANIFEST.md')) ? readFileSync(join(ROOT, 'MANIFEST.md'), 'utf8') : '';
  const pinned = !!raw && sha256Bytes(raw) === PROFILE_SHA256, cited = man.includes(PROFILE_SHA256);
  const missing = checks.filter((c) => !PROFILE.some((p) => p.id === c.id)).map((c) => c.id);
  const relabelled = checks.flatMap((c) => { const p = PROFILE.find((x) => x.id === c.id); return p && p.policy !== c.policy ? [`${c.id} ${c.policy} → ${p.policy}`] : []; });
  const extra = PROFILE.filter((p) => !checks.some((c) => c.id === p.id)).map((p) => p.id);
  return (pbMemo = { ok: !!raw && pinned && cited && checks.length > 0 && !missing.length && !relabelled.length && !extra.length, present: !!raw, pinned, cited, checks, missing, relabelled, extra });
}
const prof = (id: string) => { const p = PROFILE.find((c) => c.id === id) ?? profileBinding().checks.find((c) => c.id === id); if (!p) throw new Error(`no profile check ${id}`); return p; };
function record(id: string, ok: boolean, detail: string, origin: 'operator' | 'capture' = 'operator') {
  const p = prof(id); let status: Status;
  if (p.policy === 'INFORMATIONAL') status = 'INFO';
  else if (p.policy === 'HARD_FAIL') status = ok ? 'PASS' : 'FAIL';
  else if (p.policy === 'FLAG') status = ok ? 'PASS' : 'FLAG';
  else status = ok ? 'PASS' : 'GAP';
  rows.push({ id, name: p.name, policy: p.policy, status, ...(status === 'FLAG' ? { origin } : {}), detail });
}
/** RTP-CLAIM 1.2.0 (Methodology v1.1; src/rtp-claim-switch.ts ON): the -19 status. `ok` carries the step's own
 *  conditions besides the rule (the exact derivation, the claim read from the exhibits): if one fails, the profile's policy
 *  applies as before. With those clean the rule decides: PASS, or OVERSTATED for a house-side miss of the published figure
 *  (verdict RTP FIGURE OVERSTATED, exit 5 — never NOT PROVABLY FAIR, the draws are checked by the other steps). A committed
 *  RTP table that does not equal this run's is a reproduction failure: FAIL, whatever the rule says. */
function recordRtpClaim(id: string, ok: boolean, gate: { status: 'INFO' | 'PASS' | 'OVERSTATED' | 'FAIL'; tableMatches: boolean }, detail: string) {
  const p = prof(id);
  if (!gate.tableMatches || gate.status === 'FAIL') { rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); return; }
  if (!ok) { record(id, false, detail); return; }
  rows.push({ id, name: p.name, policy: p.policy, status: gate.status, detail });
}
const captureFlag = (id: string, detail: string) => { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FLAG', origin: 'capture', detail }); };
const pct = (a: number, b: number) => `${a}/${b}`;
const t0 = Date.now();

// verify.js and tests/verify.ts cannot drift — the standalone bundle carries the sha256 of every
// source it was built from (scripts/build-standalone.mjs) and refuses to run, with no verdict, when the sources beside it differ.
{
  const self = process.argv[1] ?? '';
  if (/verify\.js$/.test(self) && existsSync(self)) {
    const m = readFileSync(self, 'utf8').slice(0, 20000).match(/Sources sha256: (\{[^\n]*\})/);
    const built: Record<string, string> = m ? JSON.parse(m[1]) : {};
    const here = existsSync(join(ROOT, 'src')) ? readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.ts')).map((f) => `src/${f}`) : [];
    // a source the bundle was built from that no longer exists is stale too
    const stale = [...Object.entries(built).filter(([f, h]) => !existsSync(join(ROOT, f)) || sha256Bytes(readFileSync(join(ROOT, f))) !== h).map(([f]) => `${f}${existsSync(join(ROOT, f)) ? '' : ' (missing)'}`), ...here.filter((f) => !(f in built))];
    if (!m || stale.length) { console.log(`STALE STANDALONE BUNDLE: verify.js was not built from the sources in this folder (${!m ? 'no source list in its header' : stale.join(', ')}) — run npm run build:standalone; no verdict`); process.exit(4); }
  }
}

// ═══ BACCARAT-26 dataset & config pins — before anything reads the data ═══
const dataPins: [string, string][] = [[PRIMARY_FILE, PRIMARY_SHA256], [PHASE_C_FILE, PHASE_C_SHA256], [PHASE_C10_FILE, PHASE_C10_SHA256], [PHASE_D_FILE, PHASE_D_SHA256]];
const pinBad = [...dataPins, ...EVIDENCE_PINS].filter(([f, h]) => sha256File(f) !== h);
// the paytable the derivation reads (src/spec.ts) must equal the server's published fractions (E01) — a config pin
const e01 = pinBad.length ? null : readJson('evidence/E01-baccarat-fairness-spec-2026-10-12.json').answer;
// The limits src/spec.ts copies from E03 are compared with E03 here; E01's probabilities and
// worked examples and every RTP figure are not copied at all (read at run time by BACCARAT-09, 18, 19), so each place must parse
const pub = pinBad.length ? null : readPublishedSpec(), pubClaim = pinBad.length ? null : readPublishedClaim();
const limitsOk = !!pub && pub.minBet === MIN_STAKE && pub.maxBet === MAX_BET && pub.maxWin === MAX_WIN;
const claimRead = !!pubClaim && pubClaim.ok && !!pub && Object.keys(pub.probabilities).length > 0 && pub.examples.length > 0;
const payTableOk = !!e01 && e01.version === FAIRNESS_VERSION
  && e01.pays.every((p: any) => PAYS[p.spot] && BigInt(p.num) === PAYS[p.spot][0] && BigInt(p.den) === PAYS[p.spot][1]) && e01.pays.length === Object.keys(PAYS).length
  && e01.dragon.every((d: any) => DRAGON[d.spot] && BigInt(d.kNum) === DRAGON[d.spot][0] && BigInt(d.kDen) === DRAGON[d.spot][1]
    && d.rungs.every((g: any) => (g.name === 'natural' ? g.m === 1 : BigInt(g.m) === RUNG[Number(g.name)]))) && e01.dragon.length === Object.keys(DRAGON).length;
record('BACCARAT-26', pinBad.length === 0 && payTableOk && limitsOk && claimRead, pinBad.length ? `mismatch: ${pinBad.map(([f]) => f).join(', ')} — abort before any step`
  : `${dataPins.length} datasets + ${EVIDENCE_PINS.length} evidence exhibits match their sha256 pinned in src/loader.ts; the paytable the derivation reads (src/spec.ts PAYS, DRAGON, RUNG) equals the server's published fractions (E01 pays, dragon, rungs): ${payTableOk}; the limits src/spec.ts copies (MIN_STAKE, MAX_BET, MAX_WIN) equal E03, read now: ${limitsOk}; E01's probabilities and worked examples and a return figure in each of ${pubClaim?.places.length ?? 0} places (E02, E01) read from the exhibits: ${claimRead}`);
if (pinBad.length || !payTableOk || !limitsOk || !claimRead) { finish(); process.exit(1); }

const ds = input('ds', () => (load(PRIMARY_FILE))), pC = input('pC', () => (load(PHASE_C_FILE))), pC10 = input('pC10', () => (load(PHASE_C10_FILE))), pD = input('pD', () => (load(PHASE_D_FILE)));
const ALL: [string, Dataset][] = input('ALL', () => ([['Phase A', ds], ['C', pC], ['C $10', pC10], ['D', pD]]));
const J = input('J', () => (enumerateJoint()));

const RA = input('RA', () => (recompute(ds))), RCe = input('RCe', () => (recompute(pC))), RC10 = input('RC10', () => (recompute(pC10))), RD = input('RD', () => (recompute(pD)));

// ═══ BACCARAT-05 population & epoch size (G-BIND) ═══
step(['BACCARAT-05'], () => {
  const sizes = (d: Dataset) => { const m = new Map<string, number>(); for (const r of d.rounds) m.set(r.response.game.fairness.hashedServerSeed, (m.get(r.response.game.fairness.hashedServerSeed) || 0) + 1); return m; };
  const sA = sizes(ds); const allFifty = (d: Dataset) => [...sizes(d).values()].every((n) => n === EXPECTED_EPOCH_SIZE) && sizes(d).size === d.seeds.length;
  const ok = ds.rounds.length === EXPECTED_ROUNDS && ds.seeds.length === EXPECTED_SEEDS && sA.size === EXPECTED_EPOCHS && allFifty(ds)
    && pC.rounds.length === EXPECTED_PHASE_C_ROUNDS && pC10.rounds.length === EXPECTED_PHASE_C10_ROUNDS && pD.rounds.length === EXPECTED_PHASE_D_ROUNDS
    && allFifty(pC) && allFifty(pC10) && allFifty(pD);
  record('BACCARAT-05', ok, `Phase A ${ds.rounds.length} rounds / ${ds.seeds.length} seeds / ${sA.size} epochs, every epoch ${EXPECTED_EPOCH_SIZE}: ${allFifty(ds)}; supplementary C ${pC.rounds.length} (${pC.seeds.length} epochs), C $10 ${pC10.rounds.length} (${pC10.seeds.length}), D ${pD.rounds.length} (${pD.seeds.length}), every epoch ${EXPECTED_EPOCH_SIZE}: ${allFifty(pC) && allFifty(pC10) && allFifty(pD)} — against src/loader.ts constants, never meta; time windows (capture log, UTC): ${ALL.map(([k, d]) => { const a = d.rounds.map((r: any) => r.at).sort(); return `${k} ${a[0].slice(0, 10)} ${a[0].slice(11, 19)}–${a[a.length - 1].slice(11, 19)}`; }).join(', ')}`);
});

// ═══ BACCARAT-01 seed hash integrity ═══
step(['BACCARAT-01'], () => {
  const all = ALL.flatMap(([, d]) => d.seeds);
  const ok = all.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  const prim = ds.seeds.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  const unverifiable = ALL.reduce((n, [, d]) => n + d.rounds.filter((r) => !d.seeds.some((s) => s.hashedServerSeed === r.response.game.fairness.hashedServerSeed)).length, 0);
  record('BACCARAT-01', ok === all.length && prim === EXPECTED_SEEDS && unverifiable === 0, `sha256(utf8(revealed)) == committed: ${pct(prim, EXPECTED_SEEDS)} Phase A seeds, ${pct(ok, all.length)} across Phase A, C, C $10 and D; ${unverifiable} rounds on an unrevealed seed`);
});

// ═══ BACCARAT-02 forward commitment chain, anchored before epoch 0 and closed after the last ═══
step(['BACCARAT-02'], () => {
  const chainOf = (d: Dataset) => { let n = 0; for (let i = 0; i + 1 < d.seeds.length; i++) if (d.seeds[i].hashedNextServerSeed === d.seeds[i + 1].hashedServerSeed) n++; return n; };
  const anchor = (d: Dataset) => d.preCapture && d.preCapture.hashedNextServerSeed === d.seeds[0].hashedServerSeed;
  const end = (d: Dataset) => { const post = d.meta.postCapture?.activePair; return !!post && d.seeds[d.seeds.length - 1].hashedNextServerSeed === post.hashedServerSeed; };
  const res = ALL.map(([k, d]) => ({ k, n: chainOf(d), of: d.seeds.length - 1, a: anchor(d), e: end(d) }));
  // the measured /unhash evidence (E07, 12 Oct 13:59Z): the active pair (Phase A's pre-capture pair) refused,
  // its next hash (Phase A epoch 0's commitment) refused, before Phase A's first round; a rotated-away hash returned a seed hashing to it
  const e7 = readJson('evidence/E07-seed-reveal-check-2026-10-12.json'); const ans = e7.answers ?? {};
  const firstAt = ds.rounds.map((r: any) => r.at).sort()[0];
  const e7ok = ans['baccarat:active']?.hs === ds.preCapture.hashedServerSeed && ans['baccarat:active']?.status === 500 && ans['baccarat:next']?.hs === ds.seeds[0].hashedServerSeed
    && ans['baccarat:next']?.status === 404 && ans['baccarat']?.status === 200 && sha256Hex(String(ans['baccarat']?.body?.seed)) === ans['baccarat']?.hs && e7.at < firstAt;
  const ok = res.every((x) => x.n === x.of && x.a) && res[0].e && e7ok;
  record('BACCARAT-02', ok, res.map((x) => `${x.k} ${pct(x.n, x.of)} links, pre-capture anchor ${x.a}, last next-hash == the pair active after the capture ${x.e}`).join('; ') + `; the active seed was not revealed early (E07, GET /housegames/unhash at ${e7.at}): the active pair's hash (Phase A's pre-capture pair) refused ${ans['baccarat:active']?.status}, its next hash (Phase A epoch 0's commitment) refused ${ans['baccarat:next']?.status}, both before Phase A's first round at ${firstAt}, and a rotated-away hash answered ${ans['baccarat']?.status} with a seed that hashes to it: ${e7ok}`);
});

// ═══ BACCARAT-03 hash consistency within epoch ═══
step(['BACCARAT-03'], () => {
  let ok = 0, n = 0;
  for (const [, d] of ALL) for (const s of d.seeds) { n++; const rs = d.rounds.filter((r) => r.response.game.fairness.hashedServerSeed === s.hashedServerSeed); if (rs.length && rs.every((r) => r.response.game.fairness.clientSeed === s.clientSeed && r.hashedServerSeed === s.hashedServerSeed)) ok++; }
  // the server's own answer is compared with the copies — the capture's round record (roundId, nonce, client seed,
  // seed hash, version, outcome, stake, payout, balance), the server's round record (roundId, stake, payout, delta, balance) and
  // the round lookup (deck, outcome, fairness, stake, payout, every spot's amount, result and payout) == the answer
  const sets = [RA, RCe, RC10, RD], cp = sets.reduce((t2, c) => t2 + c.answerCopies, 0), rn = sets.reduce((t2, c) => t2 + c.n, 0);
  const lkN = sets.reduce((t2, c) => t2 + c.lookupN, 0), lkOk = sets.reduce((t2, c) => t2 + c.lookupOk, 0);
  record('BACCARAT-03', ok === n && cp === rn && lkOk === lkN, `${pct(ok, n)} epochs (Phase A, C, C $10, D): every round's answer carries its epoch's server-seed hash and client seed; the capture's copy of the round and the server's round record == the server's answer ${pct(cp, rn)} rounds; the round lookup == the answer (deck, outcome, fairness, stake, payout, every spot's amount, result and payout) ${pct(lkOk, lkN)} rounds where it was read`);
});

// ═══ BACCARAT-04 nonce continuity ═══
step(['BACCARAT-04'], () => {
  let ok = 0, n = 0; const bad: string[] = [];
  for (const [k, d] of ALL) for (const s of d.seeds) {
    n++; const ns = d.rounds.filter((r) => r.response.game.fairness.hashedServerSeed === s.hashedServerSeed).map((r) => r.response.game.fairness.nonce).sort((a, b) => a - b);
    if (ns.length === EXPECTED_EPOCH_SIZE && ns.every((x, i) => x === NONCE_BASE + i) && ns.length === Number(s.serverNonceAtRotation)) ok++; else bad.push(`${k} epoch ${s.epoch}`);
  }
  record('BACCARAT-04', ok === n, `${pct(ok, n)} epochs: nonces exactly ${NONCE_BASE}..${EXPECTED_EPOCH_SIZE} once each, no gap, repeat or reorder, and N == the server's nonce read at rotation (base is the declared constant, not the minimum observed)${bad.length ? `; bad: ${bad.slice(0, 5).join(', ')}` : ''}`);
});

// ═══ BACCARAT-07 card recomputation in deal order ═══
step(['BACCARAT-07'], () => { const sup: [string, RC][] = [['C', RCe], ['C $10', RC10], ['D', RD]];
  record('BACCARAT-07', RA.cards === RA.n && RA.n === EXPECTED_ROUNDS && RA.version === RA.n && RA.clientOk === RA.n && sup.every(([, c]) => c.cards === c.n && c.version === c.n && c.clientOk === c.n),
  `the first six cards of the shuffled 8-deck shoe (E01: HMAC-SHA256(serverSeed, clientSeed:nonce:i) u32s, top-down Fisher–Yates with rejection) == the served deck, and the Player / Banker hands == the served hands in deal order: ${pct(RA.cards, RA.n)} Phase A rounds (coverage ${RA.n} == expectedRounds ${EXPECTED_ROUNDS}); fairness.version "${FAIRNESS_VERSION}" ${pct(RA.version, RA.n)}; answer client seed == epoch client seed ${pct(RA.clientOk, RA.n)}; the supplementary sets, each required in full: ${sup.map(([k, c]) => `${k} cards ${pct(c.cards, c.n)}, version ${pct(c.version, c.n)}, client seed ${pct(c.clientOk, c.n)}`).join('; ')}${[RA, RCe, RC10, RD].some((c) => c.bad.length) ? ' — ' + [RA, RCe, RC10, RD].flatMap((c) => c.bad).slice(0, 3).join('; ') : ''}`); });

// ═══ BACCARAT-08 draw bias bound: every shuffle range with its rejection threshold, and the run's rejection census ═══
step(['BACCARAT-08'], () => {
  let maxRej = 0, exact = true;
  for (let n = 416; n >= 2; n--) { const lim = limitOf(n); if (lim % n !== 0 || lim > TWO32) exact = false; maxRej = Math.max(maxRej, (TWO32 - lim) / TWO32); }
  // with rejection each accepted u is uniform on [0, lim) and lim is a multiple of n, so u mod n is exactly uniform
  // the shuffle applies it: on a synthetic stream, u = 2^32 − 1 (≥ the n = 416 threshold) is redrawn, u = 0 then takes
  // position 0 (id 0); u = threshold − 1 is accepted and maps to j = 415 (id 415 mod 52 = 51)
  const syn = (us: number[]) => shuffleTop(us[Symbol.iterator](), 1);
  const a = syn([TWO32 - 1, 0]), b = syn([limitOf(416) - 1]);
  const applied = a.rejections === 1 && a.draws === 2 && a.ids[0] === 0 && b.rejections === 0 && b.ids[0] === 415 % 52;
  const totalRej = RA.rejections + RCe.rejections + RC10.rejections + RD.rejections;
  const draws = (RA.n + RCe.n + RC10.n + RD.n) * 6;
  record('BACCARAT-08', exact && applied, `every range n = 416 … 2 has its threshold 2^32 − (2^32 mod n), a multiple of n: ${exact} — each accepted step is exactly uniform (bias 0 ≤ 2^-32); the shuffle applies the threshold and the mod map (synthetic stream: u = 2^32 − 1 redrawn, u = 0 → id 0; u = threshold − 1 accepted → id 51): ${applied}; the largest rejection probability of any step is ${maxRej.toExponential(3)} (n = 416 … 2); rejection census of this run: ${totalRej} redraws in the first six steps of ${RA.n + RCe.n + RC10.n + RD.n} recomputed rounds (≈ ${draws} accepted draws), Pass 1 census in BACCARAT-20`);
});

// ═══ BACCARAT-09 RNG reference vectors ═══
step(['BACCARAT-09'], () => {
  // the worked examples are read from E01, not from a copy in src/spec.ts
  const SPEC_VECTORS = pub!.examples;
  const v = SPEC_VECTORS.filter((x) => shoeTop(x.serverSeed, x.clientSeed, x.nonce).ids.map(cardName).join(' ') === x.deck).length;
  const full = SPEC_VECTORS.filter((x) => JSON.stringify(shoeTop(x.serverSeed, x.clientSeed, x.nonce).ids) === JSON.stringify(fullShoe(x.serverSeed, x.clientSeed, x.nonce).slice(0, 6))).length;
  const r0 = RA.per[0]; const capOk = r0.cardsOk && r0.payOk;
  record('BACCARAT-09', v === SPEC_VECTORS.length && full === SPEC_VECTORS.length && capOk, `the ${SPEC_VECTORS.length} worked examples of the published spec (E01 examples, read from the exhibit now) re-deal ${pct(v, SPEC_VECTORS.length)}; the 6-step partial shuffle == the first six cards of the full 415-step shuffle ${pct(full, SPEC_VECTORS.length)}; captured round idx ${r0.r.idx} (${r0.r.response.game.deck.join(' ')}) recomputes and pays: ${capOk}; also tests/rng.test.ts`);
});

// ═══ BACCARAT-10 tableau replay & outcome ═══
step(['BACCARAT-10'], () => { const sup: [string, RC][] = [['C', RCe], ['C $10', RC10], ['D', RD]];
  // the tableau comparison is required on every dataset of the package, not on Phase A alone: a served total, outcome or
  // flag that differs from the replayed deal in any of the four sets fails this check
  record('BACCARAT-10', RA.tableau === RA.n && RA.flags === RA.n && sup.every(([, c]) => c.tableau === c.n && c.flags === c.n), `from the recomputed cards (E01 deal: values mod 10, naturals 8/9 stop, Player draws on 0–5, Banker by the published table): totals and outcome == served ${pct(RA.tableau, RA.n)} Phase A rounds; served natural / margin / pair / perfect flags == recomputed ${pct(RA.flags, RA.n)}; the supplementary sets, each required in full: ${sup.map(([k, c]) => `${k} totals and outcome ${pct(c.tableau, c.n)}, flags ${pct(c.flags, c.n)}`).join('; ')} (the outcome is replayed, the served field only compared)`); });

// ═══ BACCARAT-11 payout arithmetic (Phase A and Phase D at the base stake) ═══
step(['BACCARAT-11'], () => {
  const sets = [RA, RCe, RC10, RD];
  const gN = sets.reduce((t2, c) => t2 + c.gridN, 0), gBad = sets.reduce((t2, c) => t2 + c.gridBad, 0), gWhere = sets.flatMap((c) => c.gridWhere);
  const lab = sets.reduce((t2, c) => t2 + c.spotLabels, 0), labN = sets.reduce((t2, c) => t2 + c.spotsCompared, 0), mult = sets.reduce((t2, c) => t2 + c.multOk, 0), rn = sets.reduce((t2, c) => t2 + c.n, 0);
  const fR = sets.reduce((t2, c) => t2 + c.floorRounds, 0), fU = sets.reduce((t2, c) => t2 + c.floorUnits, 0n);
  // how much more a single floor per round could pay, from the data and as a bound. Captured: the largest
  // gap of any recomputed round. Exact over the deal: every outcome class with all nine spots staked at the Phase A stake.
  // Any stake: floor(Σ exact) − Σ floor(exact) = floor(Σ fractional parts) < k, k the spots a class pays a non-integer
  // multiple of the stake on, so at most k − 1 units.
  const capGap = sets.reduce((m, c) => c.per.reduce((m2, x) => (x.floorGap > m2 ? x.floorGap : m2), m), 0n);
  const gcd = (a: bigint, b: bigint): bigint => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
  const classGap = (a: bigint) => J.reduce((m, c) => { let xn = 0n, xd = 1n, tot = 0n; for (const s of SPOTS) { const [en, ed] = exactPay(s, a, c); xn = xn * ed + en * xd; xd *= ed; tot += payUnits(s, a, c); } const g = xn / xd - tot; return g > m ? g : m; }, 0n);
  const gapA = classGap(units8(PHASE_A_STAKE));
  const kMax = J.reduce((m, c) => Math.max(m, SPOTS.filter((s) => { const [en, ed] = exactPay(s, 1n, c); return en > 0n && ed / gcd(en, ed) > 1n; }).length), 0);
  const rt = readRoundingTexts();
  const ok = RA.spotPay === RA.spotsCompared && RA.roundPay === RA.n && RA.copies === RA.n && RA.stakeOk === RA.n && RD.roundPay === RD.n && RD.copies === RD.n && gBad === 0 && lab === labN && mult === rn;
  record('BACCARAT-11', ok, `every staked spot paid floor(stake × published fraction) on the 1e-8 grid, 0 on a loss, the stake on a Player/Banker tie push: ${pct(RA.spotPay, RA.spotsCompared)} Phase A spot settlements; round payout == Σ spots ${pct(RA.roundPay, RA.n)}; stake == Σ sent ${pct(RA.stakeOk, RA.n)}; the server's round record (roundId, stake, payout) == recomputed ${pct(RA.copies, RA.n)}; Phase D ${pct(RD.roundPay, RD.n)} rounds, record ${pct(RD.copies, RD.n)}; the served per-spot result label (win / lose / push) == recomputed ${pct(lab, labN)} spot settlements (Phase A, C, C $10, D); money values on the 1e-8 grid (request, answer, round record, capture copy, lookup, balances) ${pct(gN - gBad, gN)}${gWhere.length ? ` — off grid: ${gWhere.join('; ')}` : ''}; the served multiplier (a ratio, never read) == payout / stake ${pct(mult, rn)}; rounding as published, quoted from the exhibits: E02 rulesPaysFine "${rt.panel}"; E01 rules "${rt.e01}"; the profile asserts a per-spot floor (BACCARAT-13); ${rt.panelPerRound ? 'operator finding (OF-1): the server floors each spot, not once per round as the E02 sentence says' : 'the E02 sentence does not say "per round": no finding'}; a single floor of a round's exact total would pay more on ${RA.floorRounds} of ${RA.n} Phase A rounds (${Object.entries(RA.floorBy).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `${v} by ${k}e-8`).join(', ')}; ${RA.floorUnits} units = ${(Number(RA.floorUnits) / 1e8).toFixed(8)} USDT), ${fR} of ${rn} rounds in all four sets (${fU} units); on the one-spot sets C ${RCe.floorRounds}/${RCe.n} and C $10 ${RC10.floorRounds}/${RC10.n}; by at most ${capGap}e-8 in a captured round; over every outcome class of the 8-deck deal with all nine spots at ${PHASE_A_STAKE} by at most ${gapA}e-8 (exact); at any stake by at most ${kMax - 1}e-8 (at most ${kMax} spots pay a non-integer multiple of the stake in one class) — reported, not scored${RA.bad.length ? ' — ' + RA.bad.slice(0, 3).join('; ') : ''}`);
});

// ═══ BACCARAT-12 bet-size invariance (Phase C at 100 × the Phase A base, and the $10 set) ═══
step(['BACCARAT-12'], () => {
  const chk = (d: Dataset, c: RC, stake: string) => {
    const a = units8(stake);
    const banker = d.rounds.every((r) => r.request.bets.length === 1 && r.request.bets[0].spot === 'banker' && units8(r.request.bets[0].amount) === a
      && r.response.game.bets.length === 1 && r.response.game.bets[0].spot === 'banker' && units8(r.response.game.stake) === a);
    const wins = c.per.filter((x) => x.d && x.d.outcome === 'banker' && x.payOk).length;
    return { banker, wins, ok: c.cards === c.n && c.tableau === c.n && c.roundPay === c.n && c.copies === c.n && banker && wins >= 100 };
  };
  const a = chk(pC, RCe, PHASE_C_STAKE), b = chk(pC10, RC10, PHASE_C10_STAKE);
  const multOk = units8(PHASE_C_STAKE) === 100n * units8(PHASE_A_STAKE) && units8(PHASE_C10_STAKE) >= 100n * units8(PHASE_A_STAKE);
  record('BACCARAT-12', a.ok && b.ok && multOk, `Phase C ${pC.rounds.length} rounds on the Banker spot at ${PHASE_C_STAKE} (= 100 × the Phase A base ${PHASE_A_STAKE}: ${multOk}): cards ${pct(RCe.cards, RCe.n)}, tableau ${pct(RCe.tableau, RCe.n)}, pays by the same fraction ${pct(RCe.roundPay, RCe.n)}, record ${pct(RCe.copies, RCe.n)}, banker-only as sent and served ${a.banker}, ${a.wins} elevated Banker wins (≥ 100); $10 set ${pC10.rounds.length} rounds at ${PHASE_C10_STAKE}: cards ${pct(RC10.cards, RC10.n)}, pays ${pct(RC10.roundPay, RC10.n)}, banker-only ${b.banker}, ${b.wins} wins (≥ 100); the stake is not an input to the deal`);
});

// ═══ BACCARAT-13 spot pay provenance (exact fractions) ═══
step(['BACCARAT-13'], () => {
  const per: Record<string, { wins: number; ok: number; push: number }> = {}; for (const s of SPOTS) per[s] = { wins: 0, ok: 0, push: 0 };
  for (const c of [RA, RCe, RC10, RD]) for (const x of c.per) {
    if (!x.d) continue;
    for (const b of x.r.request.bets) {
      const a = units8(b.amount); const sv = x.r.response.game.bets.find((y) => y.spot === b.spot); if (!sv) continue;
      const p = payUnits(b.spot, a, x.d);
      if (p > a) { per[b.spot].wins++; if (units8(sv.payout) === p) per[b.spot].ok++; }
      else if (p === a && p > 0n) per[b.spot].push++;
    }
  }
  const ok = SPOTS.every((s) => per[s].ok === per[s].wins && per[s].wins > 0);
  record('BACCARAT-13', ok, `winning spots paid floor(stake × num/den) with the E01 fraction (Dragon: stake × (kDen + kNum·m)/kDen at the recomputed rung), rounded down once: ${SPOTS.map((s) => `${s} ${pct(per[s].ok, per[s].wins)}`).join(', ')}; the fractions are the server's own (BACCARAT-26 compares src/spec.ts with E01); no operator odds, probability or multiplier field is read by the derivation (the served "multiplier" is never used)`);
});

// ═══ BACCARAT-14 pay bounds & push rules ═══
step(['BACCARAT-14'], () => {
  const lim = readJson('evidence/E03-baccarat-limits-2026-10-12.json').answer.wallet;
  const maxBet = units8(String(lim.maxBet)), maxWin = units8(String(lim.maxWin));
  let worst = 0n, worstSpot = '';
  for (const s of SPOTS) { const pay = payUnits(s, maxBet, s.endsWith('Bonus') ? { outcome: s === 'playerBonus' ? 'player' : 'banker', natural: false, margin: 9, pPair: false, bPair: false, pPerf: false, bPerf: false }
      : { outcome: s === 'player' ? 'player' : s === 'banker' ? 'banker' : 'tie', natural: false, margin: 0, pPair: true, bPair: true, pPerf: true, bPerf: true });
    if (pay > worst) { worst = pay; worstSpot = s; } }
  let tiePush = 0, tieSeen = 0, dragPush = 0, dragSeen = 0, nonNatTieLoss = 0, nonNatTieSeen = 0;
  for (const c of [RA, RD]) for (const x of c.per) {
    if (!x.d) continue;
    for (const sv of x.r.response.game.bets) {
      const a = units8(sv.amount);
      if ((sv.spot === 'player' || sv.spot === 'banker') && x.d.outcome === 'tie') { tieSeen++; if (units8(sv.payout) === a) tiePush++; }
      if ((sv.spot === 'playerBonus' || sv.spot === 'bankerBonus') && x.d.outcome === 'tie') {
        if (x.d.natural) { dragSeen++; if (units8(sv.payout) === a) dragPush++; } else { nonNatTieSeen++; if (units8(sv.payout) === 0n) nonNatTieLoss++; }
      }
    }
  }
  const capOk = worst <= maxWin && String(lim.maxWin) === MAX_WIN && String(lim.maxBet) === MAX_BET;
  const witnessed = tieSeen > 0 && dragSeen > 0;
  // the cap branch. E03 does not say whether the max bet is per spot or per round; if per spot, a
  // round staking every spot at the max bet can pay more than the cap (exact, over the 298 joint classes). What the server
  // does then (refuse the bet or cap the pay) the capture never saw: its largest round payout is printed beside it.
  let multi = 0n, multiAt = '';
  // the cap is on the winnings above the stake (E08 rulesMaxWinCap, quoted in the detail), so a round is compared with it
  // by its pay minus its total stake. netAll(c, a) = what a round with all nine spots at a per spot wins above its stake in class c
  const nSpots = BigInt(SPOTS.length);
  const netAll = (c: (typeof J)[number], a: bigint) => SPOTS.reduce((t2, s) => t2 + payUnits(s, a, c), 0n) - nSpots * a;
  for (const c of J) { const pay = SPOTS.reduce((t2, s) => t2 + payUnits(s, maxBet, c), 0n); if (pay > multi) { multi = pay; multiAt = `${c.outcome}${c.natural ? ' natural' : ` by ${c.margin}`}${c.pPerf || c.bPerf ? ', perfect pair' : ''}${c.pPair && c.bPair ? ', both pairs' : c.pPair ? ', player pair' : c.bPair ? ', banker pair' : ''}`; } }
  const multiNet = multi - nSpots * maxBet;   // that round's winnings above its total stake
  // the smallest per-spot stake (1e-8 units) at which some class wins more than the cap above the stake: a bisection per
  // class that exceeds it at the max bet, the smallest of them, then stepped down while any class still exceeds one unit lower
  let bindsFrom = 0n, bindsAt = '';
  for (const c of J) { if (netAll(c, maxBet) <= maxWin) continue;
    let lo = 1n, hi = maxBet; while (lo < hi) { const mid = (lo + hi) / 2n; if (netAll(c, mid) > maxWin) hi = mid; else lo = mid + 1n; }
    if (bindsFrom === 0n || lo < bindsFrom) { bindsFrom = lo; bindsAt = `${c.outcome}${c.natural ? ' natural' : ` by ${c.margin}`}${c.pPerf || c.bPerf ? ', perfect pair' : ''}${c.pPair && c.bPair ? ', both pairs' : c.pPair ? ', player pair' : c.bPair ? ', banker pair' : ''}`; } }
  while (bindsFrom > 1n && J.some((c) => netAll(c, bindsFrom - 1n) > maxWin)) bindsFrom -= 1n;
  const bindsNet = bindsFrom > 0n ? J.reduce((m, c) => { const v = netAll(c, bindsFrom); return v > m ? v : m; }, 0n) : 0n;
  const e8cap = String(readJson('evidence/E08-baccarat-rules-panel-live-2026-10-19.json').rulesPanelEnglish?.rulesMaxWinCap ?? 'NOT IN E08');
  const f8u = (v: bigint) => `${v / 100000000n}.${String(v % 100000000n).padStart(8, '0')}`;
  const servedCap = [RA, RCe, RC10, RD].reduce((t2, c) => t2 + c.per.filter((x) => units8((x.r.response.game as any).maxWin) === maxWin).length, 0), rnAll = RA.n + RCe.n + RC10.n + RD.n;
  const largest = [RA, RCe, RC10, RD].reduce((m, c) => c.per.reduce((m2, x) => (x.total > m2 ? x.total : m2), m), 0n);
  const capReachable = multiNet > maxWin;
  const capText = `cap branch: every answer names the cap ${lim.maxWin} (maxWin field == E03) ${pct(servedCap, rnAll)}; if the max bet applies per spot (E03 does not say), a round with all nine spots at ${lim.maxBet} pays up to ${f8u(multi)} (${multiAt}), ${f8u(multiNet)} above its stake of ${f8u(nSpots * maxBet)}; the winnings above the stake first exceed the cap at ${f8u(bindsFrom)} per spot (${bindsAt}: ${f8u(bindsNet)} above the stake; one unit lower no outcome exceeds it), so the cap is reachable within the bet limits; the capture never came near it (largest round payout ${(Number(largest) / 1e8).toFixed(8)}), so whether the server refuses such a bet or caps its pay was never observed`;
  const detail = `the largest pay on any one spot at the max bet ${lim.maxBet} is ${Number(worst) / 1e8} (${worstSpot}, Dragon rung 9; ${f8u(worst - maxBet)} above the stake) ≤ the max-win cap ${lim.maxWin} (E03; a cap on the winnings above the stake, E08 rulesMaxWinCap "${e8cap}"): ${capOk}; ${capText}; push rules (E01 rules, E02 rulesPaysFine) witnessed in data: Player/Banker push on a tie ${pct(tiePush, tieSeen)}, Dragon push on a natural tie ${pct(dragPush, dragSeen)}, Dragon loses on a non-natural tie ${pct(nonNatTieLoss, nonNatTieSeen)} (Phase A + D)`;
  if (!capOk || tiePush !== tieSeen || dragPush !== dragSeen || nonNatTieLoss !== nonNatTieSeen || servedCap !== rnAll) record('BACCARAT-14', false, detail);
  // scored by the profile's rule text: every quoted pay within the declared cap, the push rules declared and "witnessed in
  // data where the capture holds them", a violation disclosed. A branch the capture never produced (the cap branch; a push
  // class not reached) is declared unwitnessed, which the rule allows: PASS with the declaration, never a silent pass
  else if (!witnessed) record('BACCARAT-14', true, detail + ' — scored by the rule text: a push class the capture does not hold is declared unwitnessed, as the rule allows');
  else if (capReachable) record('BACCARAT-14', true, detail + ' — scored by the rule text: every quoted pay lies within the cap and every push rule is witnessed; the cap branch, reachable within the bet limits and never exercised, is declared unwitnessed (DL-11), as the rule allows');
  else record('BACCARAT-14', true, detail);
});

// ═══ BACCARAT-15 spot & outcome-class coverage, against the capture plan in code ═══
step(['BACCARAT-15'], () => {
  const perSpot: Record<string, number> = {}; for (const s of SPOTS) perSpot[s] = 0;
  const sub: Record<string, number> = {};
  for (const r of ds.rounds) { sub[r.phase] = (sub[r.phase] || 0) + 1; for (const b of r.request.bets) perSpot[b.spot]++; }
  const planOk = Object.entries(PLAN_SUBPHASES).every(([k, v]) => sub[k] === v.rounds && ds.rounds.filter((r) => r.phase === k).every((r) => r.request.bets.length === v.spots));
  const short = SPOTS.filter((s) => perSpot[s] < SPOT_FLOOR);
  const seen: Record<string, number> = {};
  for (const x of RA.per) if (x.d) { for (const k of classesOf(x.d)) seen[k] = (seen[k] || 0) + 1; seen[`third:${x.d.third}`] = (seen[`third:${x.d.third}`] || 0) + 1; if (!x.d.natural && x.d.outcome !== 'tie') seen[`margin ${x.d.margin}`] = (seen[`margin ${x.d.margin}`] || 0) + 1; }
  const neverClasses = CLASS_KEYS.filter((k) => !seen[k]);
  // per spot, its own settlement classes (main: win / push / lose; pairs: win / lose; Dragon: natural, 9 … 4, push, lose):
  // the share of the spot's theoretical RTP carried by classes never reached on the Phase A rounds that staked it
  const payClass = (s: Spot, c: { outcome: string; natural: boolean; margin: number; pPair: boolean; bPair: boolean; pPerf: boolean; bPerf: boolean }): string => {
    if (s === 'playerBonus' || s === 'bankerBonus') { if (c.outcome === 'tie') return c.natural ? 'push' : 'lose'; const r = dragonRung(s === 'playerBonus' ? 'player' : 'banker', c as any); return r === null ? 'lose' : c.natural ? 'natural' : String(c.margin); }
    const p = payUnits(s, 100000000n, c as any); return p > 100000000n ? 'win' : p === 100000000n ? 'push' : 'lose';
  };
  let worstShare = 0, worstSpot = '', unreached: string[] = [];
  for (const s of SPOTS) {
    const reached = new Set(RA.per.filter((x) => x.d && x.r.request.bets.some((b) => b.spot === s)).map((x) => payClass(s, x.d!)));
    const all = J.reduce((t, c) => t + Number(c.w) * Number(payUnits(s, 100000000n, c)), 0);
    const missC = J.filter((c) => !reached.has(payClass(s, c)));
    const miss = missC.reduce((t, c) => t + Number(c.w) * Number(payUnits(s, 100000000n, c)), 0);
    for (const k of new Set(missC.map((c) => payClass(s, c)))) unreached.push(`${s}:${k}`);
    if (miss / all > worstShare) { worstShare = miss / all; worstSpot = s; }
  }
  const ok = planOk && short.length === 0 && neverClasses.length === 0;
  const subD: Record<string, number> = {}; for (const r of pD.rounds) subD[`${r.phase} × ${r.request.bets.length}`] = (subD[`${r.phase} × ${r.request.bets.length}`] || 0) + 1;
  const detail = `capture plan (src/loader.ts PLAN_SUBPHASES, crypto.randomInt spot draws): ${Object.entries(PLAN_SUBPHASES).map(([k, v]) => `${k} ${sub[k] ?? 0}/${v.rounds} × ${v.spots} spot(s)`).join(', ')}: ${planOk}; Phase D sub-phases (rounds × spots per round): ${Object.entries(subD).sort().map(([k, v]) => `${k}: ${v}`).join(', ')}; Phase A rounds per spot ${SPOTS.map((s) => `${s} ${perSpot[s]}`).join(', ')} (floor ${SPOT_FLOOR}${short.length ? `, short: ${short.join(',')}` : ''}); outcome classes reached: ${CLASS_KEYS.length - neverClasses.length}/${CLASS_KEYS.length}${neverClasses.length ? ` (never: ${neverClasses.join(', ')})` : ''}; third-card branches ${['natural', 'none', 'P', 'B', 'PB'].map((t) => `${t} ${seen['third:' + t] || 0}`).join(', ')}; win margins 1–9 ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((m) => seen['margin ' + m] || 0).join('/')}; per-spot settlement classes never reached on the rounds that staked the spot: ${unreached.length ? unreached.join(', ') : 'none'}, carrying ${(worstShare * 100).toFixed(4)} % of the worst spot's theoretical RTP${worstSpot ? ` (${worstSpot})` : ''}`;
  // coverage is the capture's: a short plan or an unreached class is disclosed, never held against the operator
  if (!planOk || short.length || neverClasses.length) captureFlag('BACCARAT-15', detail);
  else record('BACCARAT-15', true, detail);
});

// ═══ BACCARAT-16 wallet / balance reconciliation (the platform's bet history, E04; the account reconciliation, E05) ═══
step(['BACCARAT-16'], () => {
  const e4 = readJson('evidence/E04-baccarat-bet-history-2026-10-13.json'); const led = new Map<string, any>(e4.rows.map((r: any) => [r.id, r]));
  let n = 0, ok = 0;
  for (const c of [RA, RCe, RC10, RD]) for (const x of c.per) {
    n++; const y = led.get(x.r.roundId);
    if (y && units8(y.stake) === x.stake && units8(y.payout) === x.total && y.game === 'housegames-baccarat' && y.status === (x.total > 0n ? 'won' : 'lost')) ok++;
  }
  // E05 is the full reconciliation output; its numbers are checked, not its shape — every row's net ==
  // paid − staked, the rows sum to TOTAL, the ledger line adds up (entries == matched + open + earlier, matched == TOTAL
  // rounds), the balance line adds up (before == after − net + open stakes), and this package's own datasets equal their
  // E05 rows (rounds, staked, paid recomputed here). Same-engine rows E05 holds that this package does not ship are listed.
  const e5 = readFileSync(join(ROOT, 'evidence', 'E05-account-reconcile-2026-10-13.txt'), 'utf8');
  const d8 = (s: string): bigint => { const neg = s.startsWith('-'); const [i, f = ''] = s.replace(/^[+-]/, '').split('.'); const v = BigInt(i) * 100000000n + BigInt((f + '00000000').slice(0, 8)); return neg ? -v : v; };
  const e5rows = [...e5.matchAll(/^(\S+\.json)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([+-][\d.]+)$/gm)].map((m) => ({ name: m[1], n: Number(m[2]), staked: d8(m[3]), paid: d8(m[4]), net: d8(m[5]) }));
  const tm = e5.match(/^TOTAL\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([+-][\d.]+)$/m);
  const lm = e5.match(/^ledger: (\d+) entries = (\d+) captured rounds matched exactly \+ (\d+) open \+ (\d+) from (.+); unexplained (\d+)$/m);
  const am = e5.match(/^wallet cash balance after \(server, 8 dp\): ([\d.]+)/m), bm = e5.match(/^balance before = after - net ([+-][\d.]+) \+ open stakes ([\d.]+) = ([\d.]+)$/m);
  const lastm = e5.match(/last answer \S+: balance ([\d.]+) \(4 dp\)/);
  const rowsNet = e5rows.every((r) => r.net === r.paid - r.staked);
  const sumN = e5rows.reduce((a, r) => a + r.n, 0), sumS = e5rows.reduce((a, r) => a + r.staked, 0n), sumP = e5rows.reduce((a, r) => a + r.paid, 0n);
  const totalOk = !!tm && sumN === Number(tm[1]) && sumS === d8(tm[2]) && sumP === d8(tm[3]) && sumP - sumS === d8(tm[4]);
  const ledgerOk = !!lm && !!tm && Number(lm[1]) === Number(lm[2]) + Number(lm[3]) + Number(lm[4]) && Number(lm[2]) === Number(tm[1]) && Number(lm[6]) === 0;
  const after = am ? d8(am[1]) : -1n;
  const balOk = !!bm && !!tm && d8(bm[1]) === d8(tm[4]) && d8(bm[3]) === after - d8(bm[1]) + d8(bm[2]) && !!lastm && (after + 5000n) / 10000n === d8(lastm[1]) / 10000n;
  const rec = /^RECONCILED$/m.test(e5) && !/NOT RECONCILED/.test(e5) && !/^FAIL /m.test(e5);
  const own: [string, string, RC][] = [['Phase A', 'phaseA/' + PRIMARY_FILE, RA], ['C', PHASE_C_FILE, RCe], ['C $10', PHASE_C10_FILE, RC10], ['D', PHASE_D_FILE, RD]];
  const ownRes = own.map(([k, f, c]) => { const base = f.split('/').pop()!; const row = e5rows.filter((r) => r.name.split('/').pop() === base);
    const st = c.per.reduce((a, x) => a + x.stake, 0n), pd = c.per.reduce((a, x) => a + x.total, 0n);
    return { k, ok: row.length === 1 && row[0].n === c.n && row[0].staked === st && row[0].paid === pd }; });
  const ownBases = new Set(own.map(([, f]) => f.split('/').pop()!));
  const excluded = e5rows.filter((r) => /baccarat/.test(r.name) && !ownBases.has(r.name.split('/').pop()!));
  const e5ok = rowsNet && totalOk && ledgerOk && balOk && rec && ownRes.every((x) => x.ok);
  const fmt8 = (u: bigint) => (Number(u) / 1e8).toFixed(8);
  // DL-3: why the per-answer balance cannot reconcile round to round. Phase A in capture order; a step between two
  // consecutive answers that both carry the 4-dp balance is "the round's own delta" when |step − (payout − stake)| ≤ 1e-4 (the
  // difference of two 4-dp readings is within 1e-4 of the exact step whether each reading is rounded or cut); everything else moved the balance too
  const seq = [...ds.rounds].sort((a, b) => a.idx - b.idx); let pairs = 0, own4 = 0, noBal = 0;
  for (let i = 0; i < seq.length; i++) { const b = seq[i].response.balance; if (b === undefined || b === null) { noBal++; continue; }
    const pb = i > 0 ? seq[i - 1].response.balance : undefined; if (pb === undefined || pb === null) continue;
    pairs++; const step = units8(b) - units8(pb), delta = units8(seq[i].response.game.payout) - units8(seq[i].response.game.stake);
    if ((step > delta ? step - delta : delta - step) <= 10000n) own4++; }
  record('BACCARAT-16', ok === n && e4.rows.length === n && e5ok, `every baccarat round of the package is in the platform's bet history with the recomputed stake and payout and the won/lost status: ${pct(ok, n)} (E04, ${e4.rows.length} rows); E05 (the full output of the account reconciliation, an exhibit: the ledger and reconcile-full.py are not shipped, so E05 is checked for its arithmetic and against this package's own data, not re-derived): ${e5rows.length} dataset rows, every row's net == paid − staked: ${rowsNet}; the rows sum to TOTAL ${tm ? `${tm[1]} rounds, staked ${tm[2]}, paid ${tm[3]}` : 'not found'}: ${totalOk}; ledger ${lm ? `${lm[1]} entries = ${lm[2]} matched + ${lm[3]} open + ${lm[4]} from ${lm[5]}, unexplained ${lm[6]}` : 'line not found'}, adds up and matched == TOTAL rounds: ${ledgerOk}; balance before ${bm ? bm[3] : '?'} == after ${am ? am[1] : '?'} − net ${bm ? bm[1] : '?'} + open stakes ${bm ? bm[2] : '?'} (derived in E05, not read), and the last answer's 4-dp balance == after: ${balOk}; RECONCILED and no FAIL line: ${rec}; this package's datasets == their E05 rows (rounds, staked, paid, recomputed here): ${ownRes.map((x) => `${x.k} ${x.ok}`).join(', ')}; same-engine rows in E05 that this package does not ship: ${excluded.length ? excluded.map((r) => `${r.name} (${r.n} rounds, staked ${fmt8(r.staked)}, paid ${fmt8(r.paid)})`).join('; ') : 'none'}; the per-round balance field is not used: of ${pairs} consecutive Phase A answers that both carry the 4-dp balance (${noBal} answers carry none), the balance step is the round's own payout − stake within 1e-4 on ${own4} and is not on ${pairs - own4} — several games were captured concurrently on the account, so other games' settlements interleave`);
});

// ═══ BACCARAT-17 spot-set independence ═══
step(['BACCARAT-17'], () => {
  const sets = new Set(ds.rounds.map((r) => r.request.bets.map((b) => b.spot).sort().join(',')));
  const recomputedWithoutSpots = RA.cards + RCe.cards + RC10.cards + RD.cards, total = RA.n + RCe.n + RC10.n + RD.n;
  const msgOk = !/spot|stake|amount|bet/i.test(readJson('evidence/E01-baccarat-fairness-spec-2026-10-12.json').answer.derivation.match(/message = ([^)]+)\)/)?.[1] ?? 'x');
  record('BACCARAT-17', recomputedWithoutSpots === total && sets.size >= 2 && msgOk, `the RNG message is clientSeed:nonce:i (E01 derivation; no spot, stake or side-bet field): ${msgOk}; witnessed on data: every round's cards recompute from (serverSeed, clientSeed, nonce) with the spots excluded from the derivation, ${pct(recomputedWithoutSpots, total)} rounds across ${sets.size} distinct Phase A spot sets and the banker-only Phase C — no player choice steers the cards after the commitment`);
});

// ═══ BACCARAT-18 anti-circularity: exact enumeration vs the published probabilities, with negative controls ═══
step(['BACCARAT-18'], () => {
  // E01's published probabilities are read from the exhibit, not from a copy in src/spec.ts
  const PUBLISHED_PROBABILITIES = pub!.probabilities;
  const P = eventProbabilities(J); const keys = Object.keys(PUBLISHED_PROBABILITIES);
  const match = keys.filter((k) => P[k] === PUBLISHED_PROBABILITIES[k]).length;
  const total = sumW(J, () => true) === D;
  const bad = eventProbabilities(enumerateJoint({ valueOfRank: (r) => (r === 0 ? 1 : r >= 9 ? 0 : r === 4 ? 6 : r + 1) }));   // 5 counted as 6
  const ctrlCard = bad.banker !== PUBLISHED_PROBABILITIES.banker;
  const ctrlFrac = (() => { const r = exactRtp(J, 'banker'); const n2 = r.n * 1000001n, d2 = r.d * 1000000n; return n2 * 100n !== 99n * d2; })();   // a 1e-6 fraction error moves the RTP off 99/100
  record('BACCARAT-18', match === keys.length && total && ctrlCard && ctrlFrac, `exact enumeration of the 8-deck deal (src/enumerate.ts: ${J.length} joint classes over D = 416·415·414·413·412·411, weights sum to D: ${total}) reproduces the server's published probabilities (E01 probabilities, read from the exhibit now and compared, never used by the derivation) ${pct(match, keys.length)} as reduced fractions; negative controls rejected: a corrupted card value (5 counted as 6) moves P(Banker) to ${bad.banker} (≠ published): ${ctrlCard}; a fraction off by 1e-6 moves the Banker RTP off 99/100: ${ctrlFrac}`);
});

// ═══ BACCARAT-19 per-spot RTP by exact enumeration vs the claim (with the 1e-8 floor stated as a bound) ═══
// The claim is read from the exhibits at run time (src/claims.ts: E02 rulesPaysFine, E01
// return, summary and rules, E08 rulesPaysFine, held to the highest figure), and RTP-CLAIM 1.2.0 alone decides the status: no claim or "== 99/100"
// test runs before it (a spot below its claim is OVERSTATED, exit 5; a lower, player-side figure in one place is PASS).
const rtp = input('rtp', () => (computeRtpClaim(J)));
const gate = input('gate', () => (runRtpClaimGate(J)));
step(['BACCARAT-19'], () => { extraLines.set('BACCARAT-19', gate.lines); });
step(['BACCARAT-19'], () => {
  const exact = SPOTS.map((s) => { const r = exactRtp(J, s); return { s, r, ok: r.n * 100n === 99n * r.d }; });
  const stakes = [['0.02', units8(PHASE_A_STAKE)], ['2', units8(PHASE_C_STAKE)], ['10', units8(PHASE_C10_STAKE)], ['min ' + MIN_STAKE, units8(MIN_STAKE)]] as const;
  let worst = 0, worstAt = '';
  // the floor's cost against the spot's own exact (unfloored) RTP, never against the claim
  for (const [lab, a] of stakes) for (const { s, r: ex } of exact) { const r = flooredRtp(J, s, a); const v = Number((ex.n * r.d - r.n * ex.d) * 10n ** 15n / (ex.d * r.d)) / 1e15; if (v > worst) { worst = v; worstAt = `${s} at ${lab}`; } }
  const pc = readPublishedClaim(), rt = readRoundingTexts();
  const ok = pc.ok;   // the claim was read from every place; the rule's outcome and the committed table: recordRtpClaim
  recordRtpClaim('BACCARAT-19', ok, gate, `exact RTP (unfloored) of the ${rtp.settings} spots: true min ${rtp.trueMin.rtpPct} %, true max ${rtp.trueMax.rtpPct} % (each == 99/100: ${pct(exact.filter((x) => x.ok).length, SPOTS.length)}, information only); the claim, read from the exhibits now, held to the highest figure stated (${pc.figurePct} %): ${pc.places.map((p) => `${p.place} "${p.text.length > 120 ? p.text.slice(0, 117) + '…' : p.text}" → ${p.figures.map((f) => { const [a, b] = f.split('/').map(Number); return `${+(a / b * 100).toFixed(6)} %`; }).join(', ')}`).join('; ')} → RTP-CLAIM ${rtp.outcome} (rule ${rtp.rule} ${rtp.ruleVersion.split(' ')[0]}, enforced ${RTP_CLAIM_RULE_ENFORCED}: ${gate.status}), house side beyond the ${rtp.bandPp} pp band ${rtp.houseSideFailures}, worst ${rtp.worst.setting} at ${rtp.worst.gapPp} pp; the 1e-8 floor lowers a spot's exact RTP by at most ${worst.toExponential(3)} (${worstAt}; stakes 0.02, 2, 10 and the ${MIN_STAKE} minimum, exact) — disclosed, never above it; rounding as published: E01 rules "${rt.e01}", E02 rulesPaysFine "${rt.panel}" — the served round payout == the sum of per-spot floors on ${pct(RA.roundPay + RCe.roundPay + RC10.roundPay + RD.roundPay, RA.n + RCe.n + RC10.n + RD.n)} rounds (BACCARAT-11, which also counts the rounds a single floor per round would pay more)${rt.panelPerRound ? ': the server floors each spot, consistent with E01 and as the profile (BACCARAT-13) asserts, not once per round as the E02 text says — an operator finding (OF-1), reported, not scored' : ''}; committed table matches: ${gate.tableMatches}`);
});

// ═══ BACCARAT-20 / 21 the simulation, re-run in full and compared with the pinned census ═══
/** '' when the pinned census ships; else the words the census checks print (and censusSame is false: FAIL). */
function censusMissing(): string { return existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? '' : ' (outputs/simulation-results.json is MISSING: the re-run has nothing to equal, FAIL)'; }
let cen: Census; let censusSame = false;
step(['BACCARAT-20'], () => {
  cen = census(ALL);
  const committed = (existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? readFileSync(join(ROOT, 'outputs', 'simulation-results.json'), 'utf8') : null);
  censusSame = censusText(cen) === committed;
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'simulation-results.json'), censusText(cen));
});
step(['BACCARAT-20'], () => {
  const p1 = cen.pass1;
  const posP = p1.positions.map((bins) => { const e = p1.rounds / 52; const chi2 = bins.reduce((s, o) => s + (o - e) ** 2 / e, 0); return { chi2, p: chiSquaredPValue(chi2, 51) }; });
  const n = p1.lag1.n, sx = Number(BigInt(p1.lag1.sumX)), sx2 = Number(BigInt(p1.lag1.sumX2)), sxy = Number(BigInt(p1.lag1.sumXY));
  const mean = sx / n, varr = sx2 / n - mean * mean, r1 = (sxy / (n - 1) - mean * mean) / varr, z1 = r1 * Math.sqrt(n), pLag = twoSidedNormalP(z1);
  const runs = runsStatisticFromCounts(p1.runs.runs, p1.runs.n1, p1.runs.n), pRuns = twoSidedNormalP(runs.z);
  const screens = posP.every((x) => x.p >= ALPHA_SCREEN) && pLag >= ALPHA_SCREEN && pRuns >= ALPHA_SCREEN;
  const P = eventProbabilities(J);
  const exactOf = (k: string) => { if (k === 'natural') return Number(sumW(J, (c) => c.natural)) / Number(D); if (k === 'naturalTie') return Number(sumW(J, (c) => c.natural && c.outcome === 'tie')) / Number(D);
    const [a, b] = P[k].split('/').map(Number); return a / b; };
  const cls = CLASS_KEYS.map((k) => { const pE = exactOf(k), obs = (p1.classes[k] || 0) / p1.rounds, se = Math.sqrt(pE * (1 - pE) / p1.rounds); return { k, ok: Math.abs(obs - pE) <= CLASS_SIGMAS * se + CLASS_BUFFER, z: (obs - pE) / se, band: CLASS_SIGMAS * se + CLASS_BUFFER }; });
  const spots = SPOTS.map((s) => {
    const fl = flooredRtp(J, s, PASS1_STAKE_UNITS); const rE = Number(fl.n * 10n ** 15n / fl.d) / 1e15;
    const m = moments(J, [[s, PASS1_STAKE_UNITS]]); const mu = Number(m.mean.n) / Number(D) / 1e8, m2 = Number(m.m2.n) / Number(D) / 1e16; const sd = Math.sqrt(m2 - mu * mu);
    const obs = Number(BigInt(p1.spots[s].paidUnits)) / 1e8 / p1.rounds, se = sd / Math.sqrt(p1.rounds);
    return { s, ok: Math.abs(obs - rE) <= RTP_SIGMAS * se + RTP_BUFFER, z: (obs - rE) / se, obs, band: RTP_SIGMAS * se + RTP_BUFFER, edge: 1 - rE };
  });
  const depth = p1.rounds === PASS1_ROUNDS && p1.rounds >= FLOOR_PASS1_ROUNDS && p1.positions.length === PASS1_POSITIONS;
  const ok = censusSame && screens && cls.every((x) => x.ok) && spots.every((x) => x.ok) && depth;
  record('BACCARAT-20', ok, `census re-run in full == the pinned outputs/simulation-results.json byte for byte: ${censusSame}${censusMissing()}; ${p1.rounds.toLocaleString('en')} fresh-seed rounds (≥ ${FLOOR_PASS1_ROUNDS.toLocaleString('en')}: ${depth}), every spot settled on every round: card-id uniformity at shoe positions 0–5 chi² p ${posP.map((x) => x.p.toFixed(3)).join('/')} (df 51), lag-1 r ${r1.toExponential(2)} z ${z1.toFixed(2)} p ${pLag.toFixed(3)}, runs z ${runs.z.toFixed(2)} p ${pRuns.toFixed(3)} (each ≥ α/8 = ${ALPHA_SCREEN.toFixed(5)}: ${screens}); ${cls.filter((x) => x.ok).length}/${cls.length} outcome classes within 5σ + 1e-4 of the exact enumeration (worst |z| ${Math.max(...cls.map((x) => Math.abs(x.z))).toFixed(2)}, ${cls.reduce((a, b) => (Math.abs(b.z) > Math.abs(a.z) ? b : a)).k}); ${spots.filter((x) => x.ok).length}/${spots.length} spot RTPs within 5·SE + 1e-4 of the exact floored RTP at 1.00 (${spots.map((x) => `${x.s} ${x.obs.toFixed(4)}`).join(', ')}; worst |z| ${Math.max(...spots.map((x) => Math.abs(x.z))).toFixed(2)}); bands (5·σ/√n + 1e-4, σ the spot's exact standard deviation at 1.00, n = ${p1.rounds.toLocaleString('en')}): ${spots.map((x) => `${x.s} ±${(x.band * 100).toFixed(3)} pp`).join(', ')} against a ${(spots[0].edge * 100).toFixed(3)} pp house edge (floored at 1.00) — ${spots.filter((x) => x.band > x.edge).length} of ${spots.length} bands are wider than the edge, so for those spots this check cannot detect an edge of that size from this sample (the RTP evidence is the exact enumeration, BACCARAT-18/19); outcome-class bands ±${(Math.min(...cls.map((x) => x.band)) * 100).toFixed(3)} … ±${(Math.max(...cls.map((x) => x.band)) * 100).toFixed(3)} pp (5·√(p(1−p)/n) + 1e-4); shuffle rejections ${p1.rejections} in ${p1.draws.toLocaleString('en')} draws`);
});
step(['BACCARAT-21'], () => {
  const ep = cen.pass2.epochs;
  const agg = (w: 'early' | 'ref') => { let R = 0n, M = 0n, V = 0n, n = 0; for (const e of ep) { R += BigInt(e[w].ret); M += BigInt(e[w].meanNumD); V += BigInt(e[w].varNumD2); n += e[w].rounds; }
    const mean = Number(M) / Number(D), sd = Math.sqrt(Number(V) / Number(D) / Number(D)); const z = (Number(R) - mean) / sd; return { z, p: normalLowerTailP(z), n, sd, mean, R }; };
  const early = agg('early'), ref = agg('ref');
  // the early window is the capture itself: its summed payout must equal the served round payouts of the captured rounds
  // (every round of every set, since every revealed seed is replayed)
  const served = ALL.reduce((t, [, d]) => t + d.rounds.reduce((s, r) => s + units8(r.response.game.payout), 0n), 0n);
  const below = ep.filter((e) => Number(BigInt(e.early.ret)) < Number(BigInt(e.early.meanNumD)) / Number(D)).length;
  const zPow = -normalQuantile(SIM_PASS2_ALPHA) + normalQuantile(0.8);
  const staked = ALL.reduce((t, [, d]) => t + d.rounds.reduce((s, r) => s + units8(r.request.amount), 0n), 0n);
  // every revealed seed of the package, in the declared order (Phase A, C, C $10, D), each once; the z of each set alone is
  // printed as information (the pooled z is the pre-registered statistic; payouts weight the sets by their stakes)
  const revealed = ALL.flatMap(([k, d]) => d.seeds.map((s) => [k, s.hashedServerSeed] as const));
  const bySet = ALL.map(([k, d]) => { const es = ep.filter((e) => e.set === k); let R = 0n, M = 0n, V = 0n; for (const e of es) { R += BigInt(e.early.ret); M += BigInt(e.early.meanNumD); V += BigInt(e.early.varNumD2); }
    const z = (Number(R) - Number(M) / Number(D)) / Math.sqrt(Number(V) / Number(D) / Number(D)); return `${k} ${es.length}/${d.seeds.length} (z ${z.toFixed(3)})`; }).join(', ');
  const deficitPp = (zPow * early.sd) / Number(staked) * 100;
  const depthOk = ep.length === EXPECTED_PASS2_EPOCHS && ep.length === revealed.length && SIM_PASS2_NONCES >= FLOOR_PASS2_NONCES && ep.every((e) => e.early.rounds === SIM_PASS2_EARLY_WINDOW && e.early.rounds + e.ref.rounds === SIM_PASS2_NONCES)
    && revealed.every(([k, h], i) => ep[i].set === k && ep[i].seedHash === h);
  const ok = censusSame && depthOk && served === early.R && early.p >= SIM_PASS2_ALPHA && PASS2_FALSE_ALARM.rate <= FAIL_FALSE_ALARM_CAP;
  record('BACCARAT-21', ok, `${censusMissing() ? `census${censusMissing()}; ` : ''}${ep.length} revealed epochs, every revealed seed of the package (${bySet}; ${EXPECTED_PASS2_EPOCHS} expected, in that order: ${depthOk}) × ${SIM_PASS2_NONCES.toLocaleString('en')} nonces (early = 1..${SIM_PASS2_EARLY_WINDOW}, reference = ${SIM_PASS2_EARLY_WINDOW + 1}..${SIM_PASS2_NONCES}), each epoch's played spot sets cycled in nonce order; early-window payout of the ${early.n} played rounds vs its exact mean and variance (enumeration): z ${early.z.toFixed(3)}, one-sided p ${early.p.toFixed(4)} (≥ ${SIM_PASS2_ALPHA}: ${early.p >= SIM_PASS2_ALPHA}); ${below} epochs below expectation, ${ep.length - below} at or above; reference window z ${ref.z.toFixed(3)}; early window == the served payouts of the captured rounds: ${served === early.R}; detection power: a ${deficitPp.toFixed(2)} pp RTP deficit on the staked amount at 80 %; false-alarm rate ${fmtRate(PASS2_FALSE_ALARM.rate)} ± ${PASS2_FALSE_ALARM.standardError} (src/false-alarm-pass2.ts, ${PASS2_FALSE_ALARM.replicates.toLocaleString('en')} replicates from the exact joint distribution; the point estimate is ≤ the ${FAIL_FALSE_ALARM_CAP} cap, its 95 % upper bound rate + 1.96·SE = ${(PASS2_FALSE_ALARM.rate + 1.96 * PASS2_FALSE_ALARM.standardError).toFixed(4)}: consistent with the cap, not shown under it)`);
});

// ═══ BACCARAT-22 live-sample fit (INFORMATIONAL) ═══
step(['BACCARAT-22'], () => {
  const P = eventProbabilities(J); const pr = (k: string) => { const [a, b] = P[k].split('/').map(Number); return a / b; };
  const cnt = { banker: 0, player: 0, tie: 0, pp: 0, bp: 0, perf: 0 };
  for (const x of RA.per) if (x.d) { cnt[x.d.outcome]++; if (x.d.pPair) cnt.pp++; if (x.d.bPair) cnt.bp++; if (x.d.pPerf || x.d.bPerf) cnt.perf++; }
  const n = RA.n; const e = { banker: n * pr('banker'), player: n * pr('player'), tie: n * pr('tie') };
  const chi2 = (['banker', 'player', 'tie'] as const).reduce((s, k) => s + (cnt[k] - e[k]) ** 2 / e[k], 0);
  const z = (o: number, p: number) => (o - n * p) / Math.sqrt(n * p * (1 - p));
  record('BACCARAT-22', true, `${n} captured Phase A rounds: Banker ${cnt.banker} / Player ${cnt.player} / Tie ${cnt.tie} vs the exact enumeration chi² ${chi2.toFixed(2)} (df 2) p ${chiSquaredPValue(chi2, 2).toFixed(4)}; Player Pair z ${z(cnt.pp, pr('playerPair')).toFixed(2)}, Banker Pair z ${z(cnt.bp, pr('bankerPair')).toFixed(2)}, Perfect Pair z ${z(cnt.perf, pr('perfectPair')).toFixed(2)} — informational (a few-thousand-round sample has little power and never bears the verdict)`);
});

// ═══ BACCARAT-06 client-seed influence, Phase D recomputation, client-seed generator ═══
step(['BACCARAT-06'], () => {
  let changed = 0;
  for (const x of RA.per) { if (!x.s) continue; const w = shoeTop(x.s.revealedServerSeed, x.s.clientSeed + '#wrong', x.r.response.game.fairness.nonce).ids; if (JSON.stringify(w.slice(0, 4)) !== JSON.stringify(x.ids!.slice(0, 4))) changed++; }
  // P(the same first four card ids under an unrelated draw) = Σ over 4-id sequences of P² ≤ (8/416)·(8/415)·(8/414)·(8/413) (each position at most 8/n)
  const collP = (8 / 416) * (8 / 415) * (8 / 414) * (8 / 413), lam = RA.n * collP, bound = lam + 5 * Math.sqrt(lam) + 5;
  const coll = RA.n - changed;
  const seedsInOrder = pD.seeds.map((s) => s.clientSeed);
  const playerSet = PHASE_D_SEEDS.every((x, i) => seedsInOrder[i] === x) && new Set(seedsInOrder).size >= 2;
  let dChanged = 0;
  for (const x of RD.per) { if (!x.s) continue; const i = pD.seeds.indexOf(x.s); const prev = i === 0 ? pD.preCapture.clientSeed : pD.seeds[i - 1].clientSeed;
    if (JSON.stringify(shoeTop(x.s.revealedServerSeed, prev, x.r.response.game.fairness.nonce).ids) !== JSON.stringify(x.ids)) dChanged++; }
  const gen = [...ds.seeds, ...pC.seeds, ...pC10.seeds].map((s) => s.clientSeedSource);
  const csprng = gen.every((g) => g === 'node:crypto randomBytes(16) hex');
  const esc = readJson('evidence/E06-baccarat-empty-seed-control-2026-10-13.json').record;
  const ok = changed > 0 && coll <= bound && RD.cards === RD.n && RD.roundPay === RD.n && playerSet && dChanged === RD.n && csprng && esc.status === 400 && esc.request.body.clientSeed === '';
  record('BACCARAT-06', ok, `a wrong client seed changes the first four dealt cards in ${pct(changed, RA.n)} Phase A rounds (${coll} identical, bound ${bound.toFixed(2)} from P ≤ ${collP.toExponential(2)}); Phase D: player-set seeds ${JSON.stringify(seedsInOrder)} (predictable, disclosed DL-2, all 4 epochs exposed), ${pct(RD.cards, RD.n)} rounds' cards and ${pct(RD.roundPay, RD.n)} payouts recompute, ${pct(dChanged, RD.n)} deal different cards under the previous client seed; phases A–C client seeds labelled by the capture as drawn from node:crypto randomBytes(16) (a CSPRNG) on ${pct(gen.filter((g) => g === 'node:crypto randomBytes(16) hex').length, gen.length)} seeds (the label is checked, not the randomness); empty-seed control: POST /housegames/change_seed {clientSeed: ""} refused, HTTP ${esc.status} (E06)`);
});

// ═══ BACCARAT-31 side-bet settlement ═══
step(['BACCARAT-31'], () => {
  const sides = ['playerPair', 'bankerPair', 'eitherPair', 'perfectPair', 'playerBonus', 'bankerBonus'] as const;
  const per: Record<string, { n: number; ok: number; wins: number }> = {}; for (const s of sides) per[s] = { n: 0, ok: 0, wins: 0 };
  let flagsOk = 0, flagsN = 0;
  for (const c of [RA, RD]) for (const x of c.per) {
    if (!x.d) continue; const g = x.r.response.game;
    flagsN++; if (g.playerPair === x.d.pPair && g.bankerPair === x.d.bPair && g.playerPerfect === x.d.pPerf && g.bankerPerfect === x.d.bPerf) flagsOk++;   // an absent flag fails
    for (const sv of g.bets) { if (!(sides as readonly string[]).includes(sv.spot)) continue; const p = payUnits(sv.spot, units8(sv.amount), x.d); per[sv.spot].n++; if (units8(sv.payout) === p) per[sv.spot].ok++; if (p > units8(sv.amount)) per[sv.spot].wins++; }
  }
  const ok = sides.every((s) => per[s].ok === per[s].n && per[s].n > 0) && flagsOk === flagsN;
  record('BACCARAT-31', ok, `every side bet recomputed from the cards on every round that carries it (Phase A + D): ${sides.map((s) => `${s} ${pct(per[s].ok, per[s].n)} (${per[s].wins} wins)`).join(', ')}; pair = the hand's first two cards share a rank, regardless of the main result; Either = either hand; Perfect = same rank and suit, paid once; Dragon on a natural win or a non-natural margin 9…4 at its rung, push on a natural tie; served pair / perfect flags == recomputed ${pct(flagsOk, flagsN)}`);
});

// ═══ Package checks: BACCARAT-23, 24, 25, 27, 28, 29, 30 ═══
const manifest = input('manifest', () => (existsSync(join(ROOT, 'MANIFEST.md')) ? readFileSync(join(ROOT, 'MANIFEST.md'), 'utf8') : ''));
const readme = input('readme', () => (existsSync(join(ROOT, 'README.md')) ? readFileSync(join(ROOT, 'README.md'), 'utf8') : ''));
step(['BACCARAT-23'], () => {
  // the framework's standardized fairness-integrity matrix: row ids S5-1 … S5-8 and their names, as the framework lists them
  // (its Plinko profile's -23). If the vendored profile's -23 lists the names, they must
  // equal these. MANIFEST.md carries the matrix between the S5-MATRIX markers, one row per id, in order, with the id's name
  // in the Category column and a status; a row renamed, reordered, missing or added fails.
  const S5 = ['Replay protection', 'Input validation', 'Seed integrity under adversarial input', 'Cross-player isolation', 'Payout field integrity',
    'Nonce sequence enforcement', 'Parameter boundary enforcement', 'Game-specific state'];
  const listed = ((profileBinding().checks.length ? JSON.parse(readFileSync(join(ROOT, PROFILE_VENDORED), 'utf8')).checks.find((c: any) => c.id === 'BACCARAT-23')?.asserts : '') ?? '').match(/S5-1 … S5-8 \(([^)]*)\)/);
  const profNames = listed ? listed[1].split(/,\s*/) : null;
  const profOk = !profNames || (profNames.length === S5.length && profNames.every((n, i) => n.toLowerCase() === S5[i].toLowerCase()));
  const block = (manifest.match(/<!-- S5-MATRIX:BEGIN -->\n([\s\S]*?)<!-- S5-MATRIX:END -->/) || [])[1] ?? '';
  const mrows = block.split('\n').filter((l) => /^\| S5-/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const ok8 = mrows.length === S5.length && mrows.every((c, i) => c[0] === `S5-${i + 1}` && c[1] === S5[i] && /^(Pass|Flag|Hard Fail|Not tested)\b/.test(c[3] ?? ''));
  // the printed tally separates a row that passes on every control it names from one that passes on part of them and from
  // one that is Not tested (a status that starts "Pass on" is a partial pass)
  const s5cov = (st: string[]) => { const full = st.filter((s) => /^Pass\b/.test(s) && !/^Pass on\b/.test(s)).length, part = st.filter((s) => /^Pass on\b/.test(s)).length, nt = st.filter((s) => /^Not tested\b/.test(s)).length, fl = st.filter((s) => /^Flag\b/.test(s)).length, hf = st.filter((s) => /^Hard Fail\b/.test(s)).length;
    return `${full} Pass on every control the row names, ${part} Pass on part of the controls it names, ${nt} Not tested${fl ? `, ${fl} Flag` : ''}${hf ? `, ${hf} Hard Fail` : ''}`; };
  const bad = S5.map((n, i) => `S5-${i + 1}`).filter((id, i) => !(mrows[i] && mrows[i][0] === id && mrows[i][1] === S5[i] && /^(Pass|Flag|Hard Fail|Not tested)\b/.test(mrows[i][3] ?? '')));
  record('BACCARAT-23', !!block && ok8 && profOk, `MANIFEST.md S5-MATRIX block: ${mrows.length} rows; ids and names == the framework's standardized matrix (${S5.map((n, i) => `S5-${i + 1} ${n}`).join(', ')}) in order, each with a status: ${ok8}${bad.length ? ` (wrong or missing: ${bad.join(', ')})` : ''}; statuses ${s5cov(mrows.map((c) => c[3] ?? ''))}; names listed in the vendored profile's BACCARAT-23: ${profNames ? `${profNames.length}, equal: ${profOk}` : 'none (the framework list above applies)'}`);
});
// -24: the site-verifier module (site-verifier/derive.js, generated from src/rng.ts by scripts/build-site-verifier.mjs).
// Two legs, both needed. The pins: the file on disk has the sha256 of SITE_VERIFIER_PIN (src/artifact-pins.ts) and of its
// RELEASE-MANIFEST.json entry, and MANIFEST.md and README.md quote that sha256. The replay: the module is loaded from that
// file (never bundled into verify.js), must export what src/rng.ts exports, and every function is run side by side with
// src/rng.ts on every captured round of the four shipped datasets (the six-card deal, the u32 stream, the shuffle steps and
// the full 416-card shoe of each round); one differing result fails the check. The pins alone would pass a module that
// derives something else and was re-pinned; the replay alone would pass a file nobody pinned.
const SITE = await loadSiteModule(ROOT, SITE_VERIFIER_PIN[0]);
step(['BACCARAT-24'], () => {
  const [file, pin] = SITE_VERIFIER_PIN;
  const relPin: string | null = (() => { try { return readJson('RELEASE-MANIFEST.json').files?.[file] ?? null; } catch { return null; } })();
  const pinOk = SITE.sha256 !== null && SITE.sha256 === pin, relOk = SITE.sha256 !== null && SITE.sha256 === relPin;
  const cited = SITE.sha256 !== null && manifest.includes(SITE.sha256) && readme.includes(SITE.sha256);
  const names = exportNames(RNG), exportsOk = !!SITE.mod && JSON.stringify(exportNames(SITE.mod)) === JSON.stringify(names);
  const STREAM = 16;   // u32s read from each round's stream: two HMAC blocks
  function* probes(): Generator<Probe> {
    yield ['TWO32', (m) => m.TWO32];
    for (let n = 2; n <= 416; n++) yield ['limitOf', (m) => m.limitOf(n)];   // every range the shuffle of a 416-card shoe uses
    for (const [, d] of ALL) {
      for (const s of d.seeds) if (s.revealedServerSeed) yield ['sha256Hex', (m) => m.sha256Hex(s.revealedServerSeed)];
      const bySeed = new Map(d.seeds.map((s) => [s.hashedServerSeed, s]));
      for (const r of d.rounds) {
        const f = r.response.game.fairness, s = bySeed.get(f.hashedServerSeed);
        if (!s || !s.revealedServerSeed) continue;   // a round with no revealed seed is not replayed, and the round count below then fails
        const seed = s.revealedServerSeed, client = s.clientSeed, nonce = f.nonce;
        yield ['u32Stream', (m) => { const it = m.u32Stream(seed, client, nonce); return Array.from({ length: STREAM }, () => it.next().value); }];
        yield ['shuffleTop', (m) => m.shuffleTop(m.u32Stream(seed, client, nonce), 6)];
        yield ['shoeTop', (m) => m.shoeTop(seed, client, nonce)];
        yield ['fullShoe', (m) => m.fullShoe(seed, client, nonce)];
      }
    }
  }
  const rounds = ALL.reduce((n, [, d]) => n + d.rounds.length, 0);
  const rp = exportsOk ? replay(RNG, SITE.mod!, probes()) : null;
  const covered = rp ? names.filter((n) => rp.byLabel[n] > 0).length : 0;
  const replayOk = !!rp && rp.differences === 0 && rp.byLabel.shoeTop === rounds && rp.byLabel.fullShoe === rounds
    && rounds === EXPECTED_ROUNDS + EXPECTED_PHASE_C_ROUNDS + EXPECTED_PHASE_C10_ROUNDS + EXPECTED_PHASE_D_ROUNDS && covered === names.length;
  record('BACCARAT-24', pinOk && relOk && cited && exportsOk && replayOk, `${file} (generated from src/rng.ts by scripts/build-site-verifier.mjs): ${SITE.sha256 === null ? 'missing' : `sha256 ${SITE.sha256}`}; == SITE_VERIFIER_PIN in src/artifact-pins.ts: ${pinOk}; == its RELEASE-MANIFEST.json pin: ${relOk}; quoted in MANIFEST.md and README.md: ${cited}; ${SITE.mod ? `the module loaded from that file exports what src/rng.ts exports (${names.join(', ')}): ${exportsOk}` : `the module did not load (${SITE.error})`}; ${rp ? `run side by side with src/rng.ts on every captured round of the ${ALL.length} shipped datasets: ${rounds} rounds, ${rp.calls} calls (${Object.entries(rp.byLabel).map(([k, v]) => `${k} ${v}`).join(', ')}; ${covered}/${names.length} exports exercised; u32Stream compared on its first ${STREAM} values, fullShoe on all 416 cards), ${rp.differences} differing result${rp.differences === 1 ? '' : 's'}${rp.first ? ` (first: ${rp.first})` : ''}` : 'not replayed'}`);
});
step(['BACCARAT-25'], () => {
  const need = ['Verify a bet', 'rotate', 'sha256', 'HMAC-SHA256', 'Fisher', '2^32'];
  const has = need.filter((w) => readme.includes(w));
  record('BACCARAT-25', has.length === need.length, `README.md "Verify a bet" carries where the seed is revealed, the fields, the commitment encoding and the shuffle: ${has.length}/${need.length} markers`);
});
const artifactBad = input('artifactBad', () => (ARTIFACT_PINS.filter(([f, h]) => !existsSync(join(ROOT, f)) || sha256File(f) !== h)));
// BACCARAT-28 and 29 read committed run records (un-ignored, pinned in src/artifact-pins.ts RUN_RECORD_PINS
// and in RELEASE-MANIFEST.json, regenerated by npm run gate:fresh / npm run mutate), never the unpinned outputs/run/. A
// record that is missing or not the pinned bytes is a FAIL that fails the verdict (pinFail); one that is not internally
// consistent, or was made against another tests/verify.ts (or mutation registry), prints GAP; the status is never taken from
// the record's own summary fields alone.
const shaOf = (rel: string): string | null => existsSync(join(ROOT, rel)) ? sha256Bytes(readFileSync(join(ROOT, rel))) : null;
// the same records' pins in RELEASE-MANIFEST.json: a record must equal both pins; one that is missing or differs is a FAIL
// that fails the verdict (pinFail), never a GAP
const relPins: Record<string, string> = input('relPins', () => (existsSync(join(ROOT, 'RELEASE-MANIFEST.json')) ? (readJson('RELEASE-MANIFEST.json').files ?? {}) : {}));
const pinWhy = (f: string, h: string): string => !existsSync(join(ROOT, f)) ? `${f} missing` : shaOf(f) !== h ? `${f} differs from its pin in src/artifact-pins.ts RUN_RECORD_PINS`
  : relPins[f] !== h ? `${f} differs from its RELEASE-MANIFEST.json pin` : '';
const verifySha = input('verifySha', () => (shaOf('tests/verify.ts')));
const committedVerdict = input('committedVerdict', () => (existsSync(join(ROOT, 'outputs', 'verification-results.json')) ? readJson('outputs/verification-results.json').verdict : null));
step(['BACCARAT-28'], () => {
  const [f, h] = RUN_RECORD_PINS.freshCopy; const fc = existsSync(join(ROOT, f)) ? readJson(f) : null;
  const pinned = !!fc && pinWhy(f, h) === '', current = !!fc && fc.verifySha256 === verifySha;
  const ok = pinned && current && fc.exit === 0 && fc.rngTestsExit === 0 && fc.standaloneExit === 0 && fc.reproduced === true && fc.beyondTolerance === 0 && fc.pinnedUnchanged === true && AUDIT_ID !== null;
  record('BACCARAT-28', ok, fc ? `committed fresh-copy record ${f} (npm run gate:fresh, Node ${fc.node}): matches its pin ${pinned}; made against this tests/verify.ts ${current}; in the fresh copy: RNG tests exit ${fc.rngTestsExit}, verify exit ${fc.exit} (its verdict line == the committed record's verdict: ${!!committedVerdict && fc.verdict === committedVerdict}), standalone exit ${fc.standaloneExit}, record reproduced ${fc.reproduced}, regeneration vs committed ${fc.beyondTolerance} fields beyond tolerance, pinned artifacts unchanged ${fc.pinnedUnchanged}; audit ID ${AUDIT_ID ?? 'NOT ASSIGNED (pending, assigned by ProvablyFair.org)'}` : `no committed fresh-copy record (${f}); audit ID ${AUDIT_ID ?? 'not assigned (pending, assigned by ProvablyFair.org)'}`);
  if (!pinned) pinFail('BACCARAT-28', pinWhy(f, h));   // missing or edited: FAIL, verdict-bearing (a record of another tests/verify.ts stays a GAP)
});
step(['BACCARAT-29'], () => {
  const [f, h] = RUN_RECORD_PINS.mutation; const mr = existsSync(join(ROOT, f)) ? readJson(f) : null;
  const reg = readJson('tests/mutations.json').mutations as { id: string; kills: string; class?: string }[];
  const pinned = !!mr && pinWhy(f, h) === '', current = !!mr && mr.verifySha256 === verifySha && mr.registrySha256 === shaOf('tests/mutations.json');
  const all: any[] = mr?.results ?? [], res = all.filter((r) => !r.control), ctl = all.filter((r) => r.control);
  const exitOk = (r: any) => r.expectExit === undefined || r.expectExit === null || [].concat(r.expectExit).includes(r.exit);
  // a control (an edit that must NOT move its check, e.g. a lower, player-side figure in one place) is held when the
  // check keeps the baseline status and the run ends with the declared verdict and exit
  const consistent = !!mr && mr.total === res.length && mr.killed === res.filter((r) => r.killed === true).length && all.length === reg.length
    && reg.every((m) => all.filter((r) => r.id === m.id && r.kills === m.kills).length === 1)
    && res.every((r) => r.killed === (r.status !== 'MISSING' && r.status !== 'ERROR' && r.status !== r.baseline && (!r.expectVerdict || (r.verdict === r.expectVerdict && r.exit !== 0)) && exitOk(r)))
    && ctl.every((r) => r.held === (r.status === r.baseline && (!r.expectVerdict || r.verdict === r.expectVerdict) && exitOk(r)));
  const ctlHeld = ctl.filter((r) => r.held === true).length;
  const scoredIds = profileChecks().filter((c) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG').map((c) => c.id);
  const uncovered = scoredIds.filter((id) => !res.some((r) => r.kills === id && r.killed === true));
  const survivors = res.filter((r) => r.killed !== true);
  const cls = (c: string) => reg.filter((m) => m.class === c).map((m) => m.id);
  const classKilled = (c: string) => cls(c).length > 0 && cls(c).every((id) => res.some((r) => r.id === id && r.killed === true));
  const ok = pinned && current && consistent && survivors.length === 0 && uncovered.length === 0 && classKilled('deleted-step') && classKilled('forged-server-answer')
    && classKilled('rtp-overstated') && classKilled('profile-binding') && ctl.length > 0 && ctlHeld === ctl.length;
  record('BACCARAT-29', ok, mr ? `committed mutation record ${f} (npm run mutate): matches its pin ${pinned}; made against this tests/verify.ts and tests/mutations.json ${current}; internally consistent (one result per registry mutation, killed == status changed against the baseline, counts add up) ${consistent}; ${res.filter((r) => r.killed === true).length}/${res.length} killed by their named step; survivors ${survivors.length}; scored checks with no killing mutation (counted here from the results): ${uncovered.join(', ') || 'none'}; deleted-step mutation ${cls('deleted-step').join(', ') || 'none'} killed: ${classKilled('deleted-step')}; forged server-answer mutation ${cls('forged-server-answer').join(', ') || 'none'} killed: ${classKilled('forged-server-answer')}; RTP figure overstated, exit 5 ${cls('rtp-overstated').join(', ') || 'none'} killed: ${classKilled('rtp-overstated')}; step list unbound from the profile ${cls('profile-binding').join(', ') || 'none'} killed: ${classKilled('profile-binding')}; controls that must not move their check held ${ctlHeld}/${ctl.length}` : `no committed mutation record (${f})`);
  if (!pinned) pinFail('BACCARAT-29', pinWhy(f, h));   // missing or edited: FAIL, verdict-bearing (a record of another tests/verify.ts stays a GAP)
});
step(['BACCARAT-30'], () => {
  const dl = (manifest.match(/^\| DL-\d+ \|/gm) || []).length;
  const prem = /Could the data contradict it\?/.test(manifest);
  const ev = EVIDENCE_PINS.every(([f]) => manifest.includes(f.split('/').pop()!));
  record('BACCARAT-30', dl > 0 && prem && ev, `MANIFEST.md: ${dl} declared-limitation rows; load-bearing premises with "Could the data contradict it?": ${prem}; every exhibit E01…E${String(EVIDENCE_PINS.length).padStart(2, '0')} listed by file name: ${ev}`);
});

// BACCARAT-27 runs last, after every check the committed record holds has its row, so its comparison sees the whole record
step(['BACCARAT-27'], () => {
  const gi = existsSync(join(ROOT, '.gitignore')) ? readFileSync(join(ROOT, '.gitignore'), 'utf8') : '';
  const unignored = ARTIFACT_PINS.every(([f]) => gi.includes('!' + f));
  const noMeta = ARTIFACT_PINS.every(([f]) => existsSync(join(ROOT, f)) && !/"(runAt|generatedAt|timestamp|hostname|nodeVersion)"/.test(readFileSync(join(ROOT, f), 'utf8')));
  // the committed record must be this run's record (every scored check but this one is already in `rows`)
  const cf = join(ROOT, 'outputs', 'verification-results.json');
  const recDiffs = existsSync(cf) ? beyondTolerance(fieldDiff(JSON.parse(readFileSync(cf, 'utf8')), recordOf())).length : -1;
  record('BACCARAT-27', artifactBad.length === 0 && unignored && noMeta && censusSame && gate.tableMatches && recDiffs === 0,
    `${ARTIFACT_PINS.length - artifactBad.length}/${ARTIFACT_PINS.length} artifacts match the sha256 pinned in src/artifact-pins.ts${artifactBad.length ? ` (mismatch: ${artifactBad.map(([f]) => f).join(', ')})` : ''}; un-ignored by name in .gitignore: ${unignored}; no run metadata: ${noMeta}; census regenerated == committed: ${censusSame}${censusMissing()}; RTP table regenerated == committed: ${gate.tableMatches}; committed verification record == this run's: ${recDiffs === 0}${recDiffs > 0 ? ` (${recDiffs} fields differ)` : recDiffs < 0 ? ' (not recorded)' : ''}; verify writes only outputs/run/`);
});

finish();

/** The verdict is bound to the profile's check list. EXPECTED_STEPS is every check id of the profile; a run in
 *  which any of them has no status (a step deleted, skipped or aborted) or more than one gives verdict INCOMPLETE, never a pass. */
function coverage(EXPECTED_STEPS: string[] = profileChecks().map((c) => c.id)) {
  const ran = new Map<string, number>(); for (const r of rows) if (EXPECTED_STEPS.includes(r.id) && r.status !== 'ABSENT') ran.set(r.id, (ran.get(r.id) || 0) + 1);
  const missing = EXPECTED_STEPS.filter((id) => !ran.has(id)), doubled = [...ran].filter(([, k]) => k > 1).map(([id]) => id);
  const complete = ran.size === EXPECTED_STEPS.length && missing.length === 0 && doubled.length === 0 && profileBinding().ok;
  return { complete, missing, doubled };
}
/** The check list of record: the vendored framework profile, or src/profile-map.ts if it cannot be read (INCOMPLETE then). */
function profileChecks(): { id: string; name: string; policy: Policy }[] { const pb = profileBinding(); return pb.checks.length ? pb.checks : [...PROFILE]; }
/** RTP-CLAIM 1.2.0: the framework's ranking, NOT PROVABLY FAIR (1) > INCOMPLETE (3) > RTP FIGURE OVERSTATED (5) > Conditional (2) > Full (0). */
function verdictOf(fails: number, opFlags: number, complete: boolean, overstated = 0) { return rtpClaimVerdict({ fails, complete, overstated: overstated > 0, opFlags }); }

/** The verification record: every scored check except BACCARAT-27 (which compares the record) plus the informational one. */
function recordOf() {
  const order = (id: string) => Number(id.split('-')[1]);
  // every package check (GRADED / RELEASE_GATE) is recorded too, except BACCARAT-28, BACCARAT-29: they attest this record itself
  // (BACCARAT-28 reads its verdict; with both in the record the mutation battery did not settle, measured 22 Oct), so verify
  // prints them and does not record them
  const pkgRows = rows.filter((r) => (r.policy === 'GRADED' || r.policy === 'RELEASE_GATE') && !['BACCARAT-28', 'BACCARAT-29'].includes(r.id));
  // placeholder rows (ABSENT, added by finish()) stay out of the record, so a record regenerated from a run with a step
  // missing equals the one BACCARAT-27 builds mid-run; the missing ids are in summary.missing
  const recRows = rows.filter((r) => (r.policy === 'HARD_FAIL' || r.policy === 'FLAG') && r.id !== 'BACCARAT-27' && r.status !== 'ABSENT').sort((a, b) => order(a.id) - order(b.id));
  const rf = recRows.filter((r) => r.status === 'FAIL').length, ro = recRows.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length;
  // the record holds every scored check but BACCARAT-27 (which compares it), so its own completeness is over those ids
  const cv = coverage(profileChecks().filter((c) => (c.policy === 'HARD_FAIL' || c.policy === 'FLAG') && c.id !== 'BACCARAT-27').map((c) => c.id)); const recVerdict = verdictOf(rf, ro, cv.complete, recRows.filter((r) => r.status === 'OVERSTATED').length).verdict;
  return { suite: 'housebets-baccarat', profileSha256: PROFILE_SHA256, verdict: recVerdict,
    summary: { passes: recRows.filter((r) => r.status === 'PASS').length, fails: rf, overstated: recRows.filter((r) => r.status === 'OVERSTATED').length, operatorFlags: ro, captureFlags: recRows.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length, packageChecks: pkgRows.length, excluded: ['BACCARAT-27'], ...(cv.complete ? {} : { missing: cv.missing, duplicated: cv.doubled }) },
    steps: [...recRows.concat(rows.filter((r) => r.policy === 'INFORMATIONAL').sort((a, b) => order(a.id) - order(b.id))), ...pkgRows].sort((a, b) => order(a.id) - order(b.id)).map((r) => ({ id: r.id, status: r.status, origin: r.origin ?? null, detail: r.detail })) };
}

function finish() {
  applyTaint();
  const order = (id: string) => Number(id.split('-')[1]);
  const cv = coverage();
  // a profile check with no status from this run is printed as ABSENT (never PASS) so the gap is visible line by line
  for (const id of cv.missing) { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'ABSENT', detail: 'no status from this run: the step was deleted, skipped or aborted — the verdict is at best INCOMPLETE' }); }
  rows.sort((a, b) => order(a.id) - order(b.id));
  const scored = rows.filter((r) => (r.policy === 'HARD_FAIL' || r.policy === 'FLAG') && r.status !== 'ABSENT');
  const fails = scored.filter((r) => r.status === 'FAIL').length;
  const opFlags = scored.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length;
  const over = scored.filter((r) => r.status === 'OVERSTATED').length;
  const capFlags = scored.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length;
  const passes = scored.filter((r) => r.status === 'PASS').length;
  const v = verdictOf(fails + extraFails(), opFlags, cv.complete, over), verdict = v.verdict;   // + FAILs outside the scored rows and run errors
  const pkg = rows.filter((r) => (r.policy === 'GRADED' || r.policy === 'RELEASE_GATE') && r.status !== 'ABSENT');
  console.log(`HouseBets House Baccarat (new engine, shoe8) — verification (profile BACCARAT ${PROFILE_VERSION} ${PROFILE_SHA256.slice(0, 12)}…, ${rows.length} checks)`);
  for (const r of rows) { console.log(`  ${r.id.padEnd(11)} ${(r.status + (r.origin === 'capture' ? '*' : '')).padEnd(6)} ${r.policy.padEnd(13)} ${r.name.padEnd(46)} ${r.detail}`); for (const l of extraLines.get(r.id) ?? []) console.log(`      ${l}`); }
  console.log(`  (* capture-origin FLAG: disclosed, verdict-neutral)`);
  console.log(`scored checks (HARD_FAIL + FLAG): ${passes} PASS, ${fails} FAIL, ${over} OVERSTATED, ${opFlags} operator FLAG, ${capFlags} capture FLAG of ${scored.length}; informational ${rows.filter((r) => r.status === 'INFO').length}; package checks ${pkg.filter((r) => r.status === 'PASS').length}/${pkg.length} PASS (${pkg.filter((r) => r.status === 'GAP').map((r) => r.id).join(', ') || 'no gaps'})`);
  const pb = profileBinding(), nP = profileChecks().length;
  const byStatus = (s: Status) => rows.filter((r) => r.status === s && r.status !== 'ABSENT').length;
  console.log(`profile checks (${nP}): ${byStatus('PASS')} PASS, ${byStatus('FLAG')} FLAG (${rows.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length} capture-origin), ${byStatus('FAIL')} FAIL, ${byStatus('OVERSTATED')} OVERSTATED, ${byStatus('INFO')} INFO, ${byStatus('GAP')} GAP (${rows.filter((r) => r.status === 'GAP').map((r) => r.id).join(', ') || 'none'}), ${rows.filter((r) => r.status === 'ABSENT').length} ABSENT`);
  console.log(`profile coverage: ${nP - cv.missing.length}/${nP} profile checks have exactly one status from this run${cv.missing.length || cv.doubled.length ? ` — missing: ${cv.missing.join(', ') || 'none'}; duplicated: ${cv.doubled.join(', ') || 'none'}` : ''}`);
  console.log(`profile binding: ${PROFILE_VENDORED} ${pb.present ? 'present' : 'ABSENT'}, sha256 == the pin ${PROFILE_SHA256.slice(0, 12)}… ${pb.pinned}, that sha256 cited in MANIFEST.md ${pb.cited}; ${pb.checks.length} checks; src/profile-map.ts missing ${pb.missing.join(', ') || 'none'}, relabelled ${pb.relabelled.join(', ') || 'none'}, not in the profile ${pb.extra.join(', ') || 'none'}: ${pb.ok ? 'bound' : 'NOT BOUND — INCOMPLETE'}`);
  const failOutside = rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').map((r) => r.id);
  if (failOutside.length) console.log(`FAIL outside the scored checks (verdict-bearing): ${failOutside.join(', ')}`);
  if (RUN_ERRORS.length) console.log(`run errors (${RUN_ERRORS.length}; any one fails the verdict): ${RUN_ERRORS.join(' | ')}`);
  console.log(`VERDICT: ${verdict}`);
  const rec = recordOf();
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'verification-results.json'), JSON.stringify(rec, null, 2) + '\n');
  const cf = join(ROOT, 'outputs', 'verification-results.json');
  if (existsSync(cf)) {
    const diffs = beyondTolerance(fieldDiff(JSON.parse(readFileSync(cf, 'utf8')), rec));
    console.log(`Reproduction vs the committed outputs/verification-results.json on Node ${process.versions.node}: ${diffs.length === 0 ? 'REPRODUCED' : `DIFFERS (${diffs.length} fields, e.g. ${diffs.slice(0, 2).map((d: any) => d.path).join(', ')})`}`);
  }
  console.log(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = v.exit;
}
