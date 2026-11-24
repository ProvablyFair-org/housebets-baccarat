#!/usr/bin/env node
// Reference copy; the as-run file (sha256 0a4584bb2587305397740ed4948af3a60f4099a4eb3b411eeec34b8bb646bd80, recorded in the Phase C, C $10 and Phase D datasets' meta) is held privately.
// Phase A's as-run copy (sha256 5894e82ffabd7677de12cf3ae17bd50d55cc9e54d17ab6f489751d1855b0aa62, recorded in the Phase A meta) was not kept.
// Redacted for the audit package: comment lines that name internal working files or notes are reworded; code unchanged.
/* ============================================================================
 *  HouseBets House Games — BACCARAT capture (new engine)  ·  ProvablyFair.org
 *  Written 2026-10-10; this version ran the supplementary captures of 13 Oct 2026 (see the audit package's MANIFEST.md).
 *  Tested offline against a local test server before the capture.
 *
 *  Design = the earlier single-request rigs: pre-capture anchor, CSPRNG client seeds (logged with
 *  their source), epochs of EPOCH rounds then rotate via POST /change_seed recording the revealed seed,
 *  seed-after-commitment witness, journal + --resume, credential-checked scrubbed output, --probe.
 *
 *  API (from platform-housegames-baccarat-game.js, sha256 1c38b483…, the game bundle):
 *    POST /housegames/baccarat/bet  {generation, amount:<round total>, bets:[{spot, amount}], currency}
 *    GET  /housegames/seeds?gameType=baccarat · POST /housegames/change_seed {gameType:"baccarat", clientSeed}
 *    GET  /housegames/limits/baccarat · GET /housegames/baccarat/fairness · GET /housegames/baccarat/game
 *    POST /housegames/baccarat/history {} · GET /housegames/provably_fair/rounds/baccarat/<roundId> →
 *    {gameRecordId} → GET /housegames/baccarat/game_detail/<gameRecordId>
 *
 *  PLAN (base stake per spot, default 0.02 USDT — the dice rig's floor after HouseBets refused 0.01):
 *    A 300 rounds · all 9 spots
 *    B  90 rounds · one spot per round, each spot 10× (CSPRNG-shuffled order in blocks of 9)
 *    C  60 rounds · 3 spots per round, chosen with crypto.randomInt
 *    = 450 rounds, epochs of 50 (9 epochs). Every spot ≥ 340 rounds staked.
 *
 *  RUN (from this folder):
 *    1) refresh.curl: the browser's Copy-as-cURL of POST /_api/housegames/refresh (not shipped)
 *    2) node capture-hb-baccarat.mjs --plan            # print plan + stake totals, no network
 *    3) node capture-hb-baccarat.mjs --probe           # anchor + 3 rounds + rotate + verify, then STOP
 *    4) node capture-hb-baccarat.mjs                   # full run (--resume after an interruption)
 *  Flags: --base-stake=<x> --currency=<code, default 1> --epoch=<n> --delay=<ms> --out=<dir> --curl=<file>
 *         --origin=<http://127.0.0.1:port> (offline test server only) --scale=<f> (shrink every phase)
 *
 *  SUPPLEMENTARY PHASES (Framework 1.0; separate dataset, checkpoint and journal; added 2026-10-12).
 *  Without --phase (or with --phase=A) everything above is unchanged.
 *    --phase=C  elevated stake: 300 rounds (× --scale) on the banker spot only · stake per round --base-stake
 *               (default 2.00 = 100 × the 0.02 Phase A base; below 100× is refused) · epochs of 50 (6 epochs).
 *               Banker wins ≈ 45.9 % of rounds (ties push), so ≈ 138 wins are expected; the verifier needs ≥ 100.
 *    --phase=D  player-set client seeds (rule 23): --client-seeds=s1,s2,... (≥ 2, all distinct, no commas) used in
 *               order: s1 for the anchor rotation (epoch 0), s2 for epoch 1, ... · one epoch of --epoch (50) rounds
 *               per seed (4 seeds = 200 rounds) · base stake · the Phase A spot mix: its three spot patterns (all 9
 *               spots / one spot / three spots) in Phase A's 300:90:60 proportion (200 rounds → 133/40/27), labelled
 *               DA/DB/DC · the rotation after the last epoch draws a CSPRNG seed (no round is played on it)
 *               --empty-seed-control: POST /change_seed with clientSeed "" once before epoch 0; the server's
 *               answer goes to meta.emptySeedControl (accepted or refused, both are results)
 *    Files: <out>/baccarat-phase<X>-checkpoint.json / -journal.jsonl, housebets-baccarat-phase<X>-<n>rounds.json.
 *    A phase run refuses to start while another baccarat run in the same --out is unfinished (same seed pair).
 * ==========================================================================*/
import { randomUUID, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { flags, makeCardClient, makeRun, loadAuth, scrub, writeJsonSafe, now, sleep, fileSha256, runVerifier, checkOrigin, assertNoUnfinishedRun, PLAYER_SET_SOURCE } from '../hb-card-common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const flag = flags();
const GAME = 'baccarat', GAME_TYPE = 'baccarat';
const SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair', 'eitherPair', 'perfectPair', 'playerBonus', 'bankerBonus'];   // bundle const Jq
// supplementary phase (null = the Phase A run, unchanged)
const PHASE = (() => { const v = flag('phase', null); if (v == null) return null; const p = String(v).toUpperCase(); if (p === 'A') return null; if (p !== 'C' && p !== 'D') throw new Error(`--phase=${v}: baccarat supplementary phases are C (elevated stake) and D (player-set seeds)`); return p; })();
const PHASE_A_BASE_STAKE = 0.02;   // the Phase A stake per spot the elevated tier is measured against (≥ 100×)
const CLIENT_SEEDS = (() => {
  const v = flag('client-seeds', null);
  if (PHASE !== 'D') { if (v != null) throw new Error('--client-seeds is for --phase=D only'); return null; }
  if (v == null || v === true) throw new Error('--phase=D needs --client-seeds=s1,s2,... (one per epoch, ≥ 2, all distinct)');
  const a = String(v).split(',');
  if (a.length < 2 || a.some((s) => s === '') || new Set(a).size !== a.length) throw new Error(`--client-seeds: need ≥ 2 non-empty, distinct seeds, got ${JSON.stringify(a)}`);
  return a;
})();
const EMPTY_CONTROL = !!flag('empty-seed-control', false);
if (EMPTY_CONTROL && PHASE !== 'D') throw new Error('--empty-seed-control is for --phase=D only');
const BASE_STAKE = Number(flag('base-stake', PHASE === 'C' ? 2 : 0.02));
if (PHASE === 'C' && !(Math.round(BASE_STAKE * 1e8) >= 100 * Math.round(PHASE_A_BASE_STAKE * 1e8))) throw new Error(`--phase=C: stake ${BASE_STAKE} is below 100 × the Phase A base ${PHASE_A_BASE_STAKE}`);
const CURRENCY = Number(flag('currency', 1));
const EPOCH = Number(flag('epoch', 50));
const DELAY = Number(flag('delay', 0));
const SCALE = Number(flag('scale', 1));
const OUT = flag('out', join(HERE, 'outputs'));
const ORIGIN = checkOrigin(flag('origin', 'https://www.housebets.com'));
const PROBE = !!flag('probe', false), RESUME = !!flag('resume', false), PLAN_ONLY = !!flag('plan', false);
if (PROBE && PHASE) throw new Error('--probe is for the Phase A run only');
// offline tests only: --die-after=N kills this process (SIGKILL) after the N-th journaled round; N:pre kills after the
// N-th response but BEFORE its journal line (a lost nonce). Refused against the real origin.
const DIE = (() => { const v = flag('die-after', null); if (!v) return null; if (!ORIGIN.startsWith('http://')) throw new Error('--die-after is for the offline mock only'); const [n, p] = String(v).split(':'); return { n: Number(n), pre: p === 'pre' }; })();
let diedCount = 0;
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const U = 1e8;                                   // the bundle computes money in integer 1e-8 units
const units = (x) => Math.round(Number(x) * U);
const money = (u) => Number((u / U).toFixed(8));
const SEED_PREFIX = PHASE === 'C' ? { start: 'pfbaccstart', core: 'pfbacc' } : PHASE === 'D' ? { start: 'pfbacdstart', core: 'pfbacd' } : { start: 'pfbacstart', core: 'pfbac' };

// phase D: Phase A's three spot patterns in its 300:90:60 proportion, scaled to (seeds × epoch) rounds
const D_TOTAL = PHASE === 'D' ? CLIENT_SEEDS.length * EPOCH : 0;
const D_A = Math.round(D_TOTAL * 300 / 450), D_B = Math.round(D_TOTAL * 90 / 450);
const PHASES = PHASE === 'C' ? [{ key: 'C', count: Math.max(1, Math.round(300 * SCALE)), spots: 'banker' }]
  : PHASE === 'D' ? [{ key: 'DA', count: D_A, spots: 'all' }, { key: 'DB', count: D_B, spots: 'single' }, { key: 'DC', count: D_TOTAL - D_A - D_B, spots: 'three' }].filter((p) => p.count > 0)
  : [
  { key: 'A', count: Math.max(1, Math.round(300 * SCALE)), spots: 'all' },
  { key: 'B', count: Math.max(1, Math.round(90 * SCALE)), spots: 'single' },
  { key: 'C', count: Math.max(1, Math.round(60 * SCALE)), spots: 'three' },
];
const TOTAL = PHASES.reduce((s, p) => s + p.count, 0);
const FILE_TAG = PHASE ? `phase${PHASE}` : null;
const spotsPerRound = (p) => (p.spots === 'all' ? 9 : p.spots === 'single' || p.spots === 'banker' ? 1 : 3);
const PLAN_STAKE_UNITS = PHASES.reduce((s, p) => s + p.count * spotsPerRound(p) * units(BASE_STAKE), 0);

// CSPRNG helpers (never Math.random)
function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = randomInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }
let singleQueue = [];
function spotsFor(phase) {
  if (phase.spots === 'banker') return ['banker'];
  if (phase.spots === 'all') return SPOTS.slice();
  if (phase.spots === 'single') { if (!singleQueue.length) singleQueue = shuffled(SPOTS); return [singleQueue.shift()]; }
  return shuffled(SPOTS).slice(0, 3);
}

function printPlan() {
  console.log(`baccarat ${PHASE ? `phase ${PHASE} ` : ''}plan: ${TOTAL} rounds · epochs of ${EPOCH} (${Math.ceil(TOTAL / EPOCH)} epochs) · base stake ${BASE_STAKE} per spot`);
  for (const p of PHASES) console.log(`  ${p.key} ${p.count} rounds × ${spotsPerRound(p)} spot(s)${p.spots === 'banker' ? ' (banker only)' : ''} × ${BASE_STAKE} = ${money(p.count * spotsPerRound(p) * units(BASE_STAKE))}`);
  console.log(`  total staked ${money(PLAN_STAKE_UNITS)} (currency code ${CURRENCY}); expected loss ≈ 1% (every spot returns 99% per the spec)`);
  if (PHASE === 'C') console.log(`  phase C: elevated stake ${BASE_STAKE} per round = ${units(BASE_STAKE) / units(PHASE_A_BASE_STAKE)} × the Phase A base ${PHASE_A_BASE_STAKE} · banker wins expected ≈ ${Math.round(TOTAL * 0.4586)} (verifier floor 100)`);
  if (PHASE === 'D') {
    console.log(`  phase D: player-set client seeds (predictable, disclosed), one epoch of ${EPOCH} rounds each: ${CLIENT_SEEDS.map((s, i) => `epoch ${i} ${JSON.stringify(s)}`).join(', ')}`);
    console.log(`  empty-seed control before epoch 0: ${EMPTY_CONTROL ? 'yes (POST /change_seed clientSeed "")' : 'no'}`);
  }
}

/** meta of a supplementary-phase dataset (never written by the Phase A run) */
function phaseMeta() {
  const m = { phase: PHASE, phaseLabel: PHASE === 'C' ? 'C: elevated stake, banker spot' : 'D: player-set client seeds (rule 23)',
    supplementaryOf: 'the Phase A baccarat dataset (separate file, own evidence ID: audit-rules §2.5)' };
  if (PHASE === 'C') m.elevatedStake = { stakePerRound: BASE_STAKE, spot: 'banker', phaseABaseStake: PHASE_A_BASE_STAKE, multipleOfPhaseABase: units(BASE_STAKE) / units(PHASE_A_BASE_STAKE), winsFloor: 100 };
  if (PHASE === 'D') Object.assign(m, { playerSetSeeds: { source: PLAYER_SET_SOURCE, seeds: CLIENT_SEEDS, epochOf: Object.fromEntries(CLIENT_SEEDS.map((s, i) => [i, s])), roundsPerEpoch: EPOCH,
    spotMix: 'Phase A sub-phase patterns A all 9 / B one spot / C three spots, in 300:90:60 proportion, labelled DA/DB/DC',
    afterLastEpoch: 'the closing rotation draws a CSPRNG seed (prefix ' + SEED_PREFIX.core + '); no round is played on it' }, emptySeedControlPlanned: EMPTY_CONTROL });
  return m;
}

const pairKeyOf = (r) => r.hashedServerSeed;
const nonceOf = (r) => r.nonce;

async function placeRound(hb, phase) {
  const spots = spotsFor(phase);
  const bets = spots.map((spot) => ({ spot, amount: money(units(BASE_STAKE)) }));
  const body = { generation: randomUUID(), amount: money(spots.length * units(BASE_STAKE)), bets, currency: CURRENCY };
  const resp = await hb.call('POST', `/${GAME}/bet`, body);
  const g = resp && resp.game;
  if (!g || !g.fairness) throw new Error('bet response has no game.fairness');
  return { at: now(), phase: phase.key, request: body, response: scrub(resp),
    roundId: g.roundId, nonce: g.fairness.nonce, clientSeed: g.fairness.clientSeed ?? null, hashedServerSeed: g.fairness.hashedServerSeed, fairnessVersion: g.fairness.version,
    stake: g.stake, payout: g.payout, outcome: g.outcome, balance: resp.balance ?? null };
}

async function lookup(hb, rec) {
  try {
    const a = await hb.call('GET', `/provably_fair/rounds/${GAME}/${rec.roundId}`);
    const id = a && (a.gameRecordId || a.gameRecordID);
    const d = id ? await hb.call('GET', `/${GAME}/game_detail/${id}`) : null;
    rec.lookup = { at: now(), round: scrub(a), detail: scrub(d) };
  } catch (e) { rec.lookup = { at: now(), error: e.message }; }
}

async function preflight(hb, run) {
  const get = async (path) => { try { return scrub(await hb.call('GET', path)); } catch (e) { return { error: e.message }; } };
  const limits = await get(`/limits/${GAME}`);
  run.dataset.meta.preflight = { at: now(), limits, fairnessSpec: await get(`/${GAME}/fairness`), activeGame: await get(`/${GAME}/game`) };
  const w = limits && limits.wallet && Number(limits.wallet.currency) === CURRENCY ? limits.wallet : limits;
  const min = w && Number(w.minBet) > 0 ? Number(w.minBet) : null;
  log(`limits: min ${min ?? 'n/a'} max ${w && w.maxBet} maxWin ${w && w.maxWin} (the bundle checks the ROUND total against min)`);
  if (min != null && units(BASE_STAKE) < units(min)) log(`  WARNING: one-spot rounds (phase B) at ${BASE_STAKE} are below the minimum ${min}; the server will refuse them — rerun with --base-stake=${min}`);
  if (PHASE === 'C') {
    const max = w && Number(w.maxBet) > 0 ? Number(w.maxBet) : null;
    if (max != null && units(BASE_STAKE) > units(max)) throw new Error(`phase C stake ${BASE_STAKE} is above the maximum bet ${max}`);
  }
}

async function main() {
  if (PLAN_ONLY) { printPlan(); return; }
  const auth = loadAuth(flag('curl', join(HERE, 'refresh.curl')));
  const hb = makeCardClient(auth, { origin: ORIGIN, referer: `${ORIGIN}/games/housegames-${GAME}`, log });
  await hb.refresh();
  log(`token ok (ttl ${hb.tokenTtl}s) · origin ${ORIGIN}`);
  const run = makeRun({ game: GAME, gameType: GAME_TYPE, outDir: PROBE ? join(OUT, 'probe') : OUT, schema: 'housebets-baccarat-capture-v1', pairKeyOf, nonceOf, log,
    fileTag: FILE_TAG, playerSeeds: CLIENT_SEEDS,
    meta: { origin: ORIGIN, currency: CURRENCY, baseStake: BASE_STAKE, epochSize: EPOCH, spots: SPOTS, seedPrefixes: SEED_PREFIX,
      phases: Object.fromEntries(PHASES.map((p) => [p.key, { rounds: p.count, spots: p.spots }])), spotChooser: 'crypto.randomInt (Fisher-Yates)',
      captureScript: { file: 'rig/baccarat/capture-hb-baccarat.mjs', sha256: fileSha256(fileURLToPath(import.meta.url)) }, bundleSha256: '1c38b483c0f683a3b09f095b2cadf28d1760861047e7b352ae03d91883dae245',
      ...(PHASE ? phaseMeta() : {}) } });
  printPlan();

  if (PROBE) {
    await preflight(hb, run);
    let pair = await run.anchor(hb, SEED_PREFIX.start);
    for (const ph of [{ key: 'PA', spots: 'all' }, { key: 'PB', spots: 'single' }, { key: 'PC', spots: 'three' }]) {
      const rec = await placeRound(hb, ph); run.dataset.rounds.push(Object.assign(rec, { idx: run.dataset.rounds.length }));
      await lookup(hb, rec);
      log(`  probe ${ph.key}: nonce ${rec.nonce} ${rec.outcome} stake ${rec.stake} payout ${rec.payout} version ${rec.fairnessVersion} lookup ${rec.lookup.error ? 'ERROR ' + rec.lookup.error : 'ok'}`);
    }
    pair = await run.closePair(hb, pair, SEED_PREFIX.core, { journal: false });
    run.finalSummary({ kind: 'probe', postCapture: { at: now(), activePair: scrub(pair) } });
    const file = join(OUT, 'probe', `baccarat-probe-${Date.now()}.json`); writeJsonSafe(file, run.dataset);
    log(`probe file ${file}`);
    await runVerifier(join(HERE, 'verify-baccarat.py'), file, (t) => console.log(t));
    return;
  }

  if (RESUME) run.load(); else if (run.hasState()) throw new Error(`${run.CHECKPOINT} or its journal exists — use --resume, or move both aside`);
  if (PHASE && !RESUME) assertNoUnfinishedRun(OUT, GAME, ['', 'phaseC', 'phaseD'].filter((t) => t !== FILE_TAG));
  if (PHASE && RESUME && (run.dataset.meta.phase !== PHASE || (PHASE === 'D' && JSON.stringify((run.dataset.meta.playerSetSeeds || {}).seeds) !== JSON.stringify(CLIENT_SEEDS))))
    throw new Error(`--resume: ${run.CHECKPOINT} is phase ${run.dataset.meta.phase}${PHASE === 'D' ? ` with seeds ${JSON.stringify((run.dataset.meta.playerSetSeeds || {}).seeds)}` : ''}; rerun with the same --phase${PHASE === 'D' ? ' and --client-seeds' : ''}`);
  let pair;
  if (!run.dataset.preCapture) { await preflight(hb, run); if (EMPTY_CONTROL && !run.dataset.meta.emptySeedControl) await run.emptySeedControl(hb); pair = await run.anchor(hb, SEED_PREFIX.start); run.save(); }
  else { pair = await hb.seeds(GAME_TYPE); run.declareLostNonces(pair); }
  let onPair = run.roundsOnPair(pair).length;
  process.on('SIGINT', () => { console.log('\ninterrupted — saving…'); run.save(); console.log(`saved ${run.dataset.rounds.length} rounds. Re-run with --resume.`); process.exit(0); });

  for (const ph of PHASES) {
    const done = run.dataset.rounds.filter((r) => r.phase === ph.key).length;
    if (done >= ph.count) { log(`phase ${ph.key}: complete (${done})`); continue; }
    log(`== PHASE ${ph.key}: ${ph.count - done} rounds (${ph.spots}) ==`);
    let errors = 0;
    for (let i = done; i < ph.count; i++) {
      if (onPair >= EPOCH) { pair = await run.closePair(hb, pair, SEED_PREFIX.core); onPair = 0; run.save(); }
      try {
        const rec = await placeRound(hb, ph);
        if (onPair === 0) await lookup(hb, rec);   // one provably_fair lookup per epoch
        if (DIE && DIE.pre && ++diedCount === DIE.n) process.kill(process.pid, 'SIGKILL');   // dry-run only
        run.pushRound(rec); onPair++; errors = 0;
        if (DIE && !DIE.pre && ++diedCount === DIE.n) process.kill(process.pid, 'SIGKILL');  // dry-run only
        if (run.dataset.rounds.length % 25 === 0) { run.save(); log(`  ${run.dataset.rounds.length}/${TOTAL} rounds · bal ${rec.balance}`); }
        if (DELAY) await sleep(DELAY);
      } catch (e) {
        errors++; log(`  ERROR ${ph.key} ${i + 1}: ${e.message} (${errors}/8)`); run.save();
        if (errors >= 8) { console.log('too many errors — saved, exiting. Re-run with --resume.'); process.exit(1); }
        await sleep(1500); i--;
      }
    }
  }
  if (onPair > 0) pair = await run.closePair(hb, pair, SEED_PREFIX.core);
  let history = null; try { history = scrub(await hb.call('POST', `/${GAME}/history`, {})); } catch (e) { history = { error: e.message }; }
  run.finalSummary({ postCapture: { at: now(), activePair: scrub(await hb.seeds(GAME_TYPE).catch(() => null)), history } });
  run.save();
  const file = join(OUT, `housebets-baccarat-${FILE_TAG ? FILE_TAG + '-' : ''}${run.dataset.rounds.length}rounds.json`); writeJsonSafe(file, run.dataset);
  const m = run.dataset.meta;
  log(`DONE ${PHASE ? `phase ${PHASE} ` : ''}${run.dataset.rounds.length}/${TOTAL} rounds · ${m.epochs} epochs · anchor ${run.dataset.preCapture && run.dataset.preCapture.anchorOk} · commit ${m.commitmentAllValid} · chain ${m.chainAllValid} · seed-after-commitment ${m.seedDrawnAfterCommitmentAllValid}${m.playerSetEpochs ? ` · player-set epochs ${m.playerSetEpochs.length}, hash published before each was sent ${m.playerSetHashPublishedBeforeSentAllValid}` : ''}`);
  log(`dataset ${file}`);
  await runVerifier(join(HERE, 'verify-baccarat.py'), file, (t) => console.log(t));
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
