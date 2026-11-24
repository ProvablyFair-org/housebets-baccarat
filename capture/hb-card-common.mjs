// Reference copy; the as-run copy was not kept.
// Redacted for the audit package: comment lines that name internal working files or notes are reworded; code unchanged.
// ============================================================================
//  HouseBets House Games (new engine) — shared capture plumbing for the card-game rigs
//  (blackjack = the live blackjack7 bundle, baccarat)  ·  ProvablyFair.org  ·  written 2026-10-10.
//
//  Reuses hb-capture-lib.mjs (unchanged): CSPRNG client seeds, scrubber, credential-checked
//  writes, refresh.curl parsing, pre-capture anchor record, seed-after-commitment witness.
//  What is new here, and why it is not the reference makeClient():
//   * the origin is a parameter, so the same code runs against an offline test server. Only
//     https://www.housebets.com or a loopback http origin is accepted.
//   * generic call(method, path) — the new engine has paths the old client does not know
//     (/blackjack7/action, /limits/<g>, /<g>/history, /provably_fair/rounds/...).
//   * 429 / pacing codes 7, 8, 13 back off by the server's retryAfterMs (bundle: both games honour
//     body.retryAfterMs) and retry; 401 refreshes once (bundle: /_api/housegames/refresh, same body as
//     the reference lib: {apiUrl, intent, token, selectorToken}).
//   * the epoch bookkeeping (anchor, rotation, journal, checkpoint, resume) generalised from
//     the earlier single-request rigs so a game rig only supplies "how to recognise a round's pair".
//  Supplementary phases (added 2026-10-12; every one is OFF unless the rig passes the option, so a Phase A run
//  writes the same files, names and records as before):
//   * fileTag     → <game>-<tag>-checkpoint.json / -journal.jsonl, so a phase run never shares state with Phase A
//   * playerSeeds → Phase D: epoch k plays on playerSeeds[k] (anchor = epoch 0), logged with a source starting
//                   "player-set"; epochs past the list fall back to CSPRNG
//   * emptySeedControl(hb) → POST /change_seed with clientSeed "" once, the server's answer kept in meta
//   * assertNoUnfinishedRun → refuses to start a phase while another run in the same --out has not finished:
//                   both play on the account's one seed pair per gameType, so a rotation would cut its epoch
// ============================================================================
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import {
  ORIGIN, loadAuth, jwtBody, ttl, scrub, writeJsonSafe, appendJsonlSafe, csprngClientSeed, clientSeedSourceOf,
  CLIENT_SEED_SOURCE, CLIENT_SEED_FORMAT, commitOf, nextCommitOf, buildPreCapture, commitmentWitness, checkWitness, drawnAtOf,
} from './reference/hb-capture-lib.mjs';

export { scrub, writeJsonSafe, appendJsonlSafe, csprngClientSeed, CLIENT_SEED_SOURCE, CLIENT_SEED_FORMAT, loadAuth };
export const sha256Hex = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex');
export const now = () => new Date().toISOString();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const fileSha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

export function flags(argv = process.argv.slice(2)) {
  return (n, d) => { const h = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`)); if (!h) return d; const i = h.indexOf('='); return i === -1 ? true : h.slice(i + 1); };
}

export function checkOrigin(o) {
  if (o === ORIGIN) return o;
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(o)) return o;
  throw new Error(`refusing origin ${o}: only ${ORIGIN} or a loopback http origin (the offline mock) is allowed`);
}

// ── HTTP client ──────────────────────────────────────────────────────────────
// Every path is relative to <origin>/housegames (the bundles' apiUrl default: origin + "/housegames").
export function makeCardClient(auth, { origin = ORIGIN, referer, log = () => {} } = {}) {
  checkOrigin(origin);
  let token = null;
  const base = () => ({ accept: 'application/json', 'user-agent': auth.ua, origin, referer: referer || `${origin}/house-games`, cookie: auth.cookie });
  async function refresh() {
    const r = await fetch(`${origin}/_api/housegames/refresh`, { method: 'POST', headers: { ...base(), 'content-type': 'application/json' },
      body: JSON.stringify({ apiUrl: `${origin}/housegames`, intent: 'refresh', token: auth.refreshJwt, selectorToken: auth.refreshJwt }) });
    let j = null; try { j = JSON.parse(await r.text()); } catch {}
    if (r.status !== 200 || !j || !j.token) throw new Error(`refresh ${r.status} — re-grab refresh.curl (cookie may be stale)`);
    token = j.token;
    return true;   // the token is never handed back
  }
  async function call(method, path, body, { retries = 6, allowStatus = [] } = {}) {
    for (let attempt = 0; ; attempt++) {
      if (!token || ttl(token) < 60) await refresh();
      const r = await fetch(`${origin}/housegames${path}`, { method, headers: { ...base(), 'content-type': 'application/json', 'x-token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
      const t = await r.text(); let j = null;
      try { j = t ? JSON.parse(t) : null; } catch { const e = new Error(`${method} ${path} ${r.status} non-JSON: ${String(scrub(t.slice(0, 140)))}`); e.status = r.status; throw e; }
      const code = j && typeof j === 'object' ? (typeof j.code === 'number' ? j.code : j.error && typeof j.error.code === 'number' ? j.error.code : null) : null;
      if (r.status === 401 && attempt === 0) { token = null; continue; }
      if ((r.status === 429 || code === 7 || code === 8 || code === 13) && attempt < retries) {
        const wait = Math.min(65000, Number(j && (j.retryAfterMs ?? (j.error && j.error.retryAfterMs))) || 1500);
        log(`  pacing (${r.status}${code != null ? ` code ${code}` : ''}) on ${method} ${path} — waiting ${wait} ms`);
        await sleep(wait); continue;
      }
      if (r.status !== 200 && !allowStatus.includes(r.status)) {
        const e = new Error(`${method} ${path} ${r.status}: ${JSON.stringify(scrub(j)).slice(0, 200)}`); e.status = r.status; e.code = code; e.json = scrub(j); throw e;
      }
      return allowStatus.length ? { status: r.status, json: j } : j;
    }
  }
  return {
    refresh, call, get userId() { const b = jwtBody(token); return b.id || b.sub || null; }, get tokenTtl() { return token ? ttl(token) : 0; },
    seedsRaw: (gameType) => call('GET', `/seeds?gameType=${gameType}`),
    seeds: async (gameType) => (await call('GET', `/seeds?gameType=${gameType}`)).seed,
    rotate: (gameType, clientSeed) => call('POST', '/change_seed', { gameType, clientSeed }),
  };
}

// ── dataset, journal, checkpoint, epochs ─────────────────────────────────────
/**
 * One capture run. `pairKeyOf(round)` returns the hashedServerSeed a round was played on (each game knows
 * where its response carries it). Epoch records follow the earlier single-request rigs field for field, minus the
 * per-bet recomputation (done by the audit package's verifier).
 */
export const PLAYER_SET_SOURCE = 'player-set: typed by the auditor (--client-seeds), chosen before the capture, predictable, disclosed';
const isPlayerSet = (e) => !!e && String(e.source || '').startsWith('player-set');

/** Phase runs only: refuse to start while a run of this game in the same --out has no meta.finishedAt. */
export function assertNoUnfinishedRun(outDir, game, tags) {
  for (const t of tags) {
    const cp = `${outDir}/${t ? `${game}-${t}` : game}-checkpoint.json`;
    if (!existsSync(cp)) continue;
    let m = {}; try { m = JSON.parse(readFileSync(cp, 'utf8')).meta || {}; } catch {}
    if (!m.finishedAt) throw new Error(`${cp} belongs to a run that has not finished (no meta.finishedAt). It plays on the same server seed pair; a new phase would rotate that pair and cut its open epoch. Finish it with --resume first.`);
  }
}

export function makeRun({ game, gameType, outDir, schema, meta, pairKeyOf, nonceOf, log, fileTag = null, playerSeeds = null }) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const stem = fileTag ? `${game}-${fileTag}` : game;
  const CHECKPOINT = `${outDir}/${stem}-checkpoint.json`, JOURNAL = `${outDir}/${stem}-journal.jsonl`;
  const seedEntry = (s) => run.seedLog().find((e) => e.clientSeed === s);
  /** commitment witness; a player-set seed was chosen before the capture, so it carries the time it was SENT instead of a draw time */
  const witnessOf = (committedHash, source, readAt, clientSeed) => {
    const w = commitmentWitness({ committedHash, source, readAt, clientSeed, clientSeedDrawnAt: drawnAtOf(run.seedLog(), clientSeed) });
    const e = seedEntry(clientSeed);
    if (isPlayerSet(e)) Object.assign(w, { playerSet: true, clientSeedSetAt: e.setAt ?? null, note: 'player-set seed (Phase D): chosen before the capture, so "drawn after the commitment" does not apply; clientSeedSetAt = when it was sent to POST /change_seed' });
    return w;
  };
  const run = {
    CHECKPOINT, JOURNAL,
    dataset: { meta: { platform: 'housebets.com', game, gameType, schema, createdAt: now(), clientSeedLog: [], curPrefix: null,
      clientSeedGenerator: { source: CLIENT_SEED_SOURCE, format: CLIENT_SEED_FORMAT, csprng: true }, commitmentWitnesses: {}, ...meta },
      preCapture: null, seeds: [], rounds: [] },
    seedLog() { return run.dataset.meta.clientSeedLog; },
    save() { run.dataset.meta.savedAt = now(); writeJsonSafe(CHECKPOINT, run.dataset); },
    journal(obj) { appendJsonlSafe(JOURNAL, obj); },
    hasState() { return existsSync(CHECKPOINT) || existsSync(JOURNAL); },
    roundsOnPair(pair) { return run.dataset.rounds.filter((r) => pairKeyOf(r) === pair.hashedServerSeed); },
    /** Load checkpoint, replay journal past it. `onStep` receives journal lines of other types (in-progress rounds). */
    load(onStep = () => {}) {
      if (existsSync(CHECKPOINT)) run.dataset = JSON.parse(readFileSync(CHECKPOINT, 'utf8'));
      let replayed = 0, recovered = 0;
      if (existsSync(JOURNAL)) {
        for (const line of readFileSync(JOURNAL, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          let j; try { j = JSON.parse(line); } catch { continue; }   // a line cut by the crash
          if (j.type === 'round') { if (j.rec.idx === run.dataset.rounds.length) { run.dataset.rounds.push(j.rec); replayed++; } }
          else if (j.type === 'rotation') { if (j.epoch === run.dataset.seeds.length) { run.finishPair(j); run.dataset.meta.curPrefix = j.nextPrefix; recovered++; } }
          else onStep(j);
        }
      }
      log(`resumed: ${run.dataset.rounds.length} rounds (${replayed} from journal), ${run.dataset.seeds.length} epochs (${recovered} finished from journaled rotations)`);
    },
    pushRound(rec) { rec.idx = run.dataset.rounds.length; run.dataset.rounds.push(rec); run.journal({ type: 'round', rec }); },

    /** client seed for epoch `epochIdx`: playerSeeds[epochIdx] when given (Phase D), else CSPRNG (unchanged default) */
    clientSeedFor(epochIdx, prefix) {
      const ps = playerSeeds && epochIdx < playerSeeds.length ? playerSeeds[epochIdx] : null;
      if (ps == null) return csprngClientSeed(prefix, run.seedLog());
      let e = seedEntry(ps);
      if (!e) { e = { clientSeed: ps, source: PLAYER_SET_SOURCE, prefix: null, epoch: epochIdx }; run.seedLog().push(e); }
      e.setAt = now();   // handed to POST /change_seed right after this
      return ps;
    },
    /** POST /change_seed; a refused player-set seed is recorded in meta.clientSeedRejected and stops the run */
    async rotateWith(hb, clientSeed, epochIdx) {
      if (!playerSeeds || !isPlayerSet(seedEntry(clientSeed))) return hb.rotate(gameType, clientSeed);
      try { return await hb.rotate(gameType, clientSeed); }
      catch (e) {
        (run.dataset.meta.clientSeedRejected ??= []).push({ at: now(), epoch: epochIdx, clientSeed, status: e.status ?? null, code: e.code ?? null, response: e.json ?? null, error: e.message });
        run.save();
        throw new Error(`server refused player-set client seed ${JSON.stringify(clientSeed)} for epoch ${epochIdx} (${e.message}); recorded in meta.clientSeedRejected of ${CHECKPOINT}`);
      }
    },

    /** Phase D empty-seed control: one POST /change_seed with clientSeed "" before epoch 0; the answer is recorded, never retried */
    async emptySeedControl(hb) {
      const rec = { at: now(), request: { method: 'POST', path: '/housegames/change_seed', body: { gameType, clientSeed: '' } } };
      let before = null, after = null;
      try { before = await hb.seeds(gameType); rec.seedsBefore = scrub(before); } catch (e) { rec.seedsBefore = { error: e.message }; }
      try {
        const resp = await hb.call('POST', '/change_seed', { gameType, clientSeed: '' });
        rec.status = 200; rec.response = scrub(resp); rec.accepted = !!(resp && (resp.seed || resp.oldServerSeed));
        if (!rec.accepted) rec.note = 'HTTP 200 without a seed in the answer';
      } catch (e) { rec.status = e.status ?? null; rec.code = e.code ?? null; rec.response = e.json ?? null; rec.error = e.message; rec.accepted = false; }
      rec.answeredAt = now();
      try { after = await hb.seeds(gameType); rec.seedsAfter = scrub(after); } catch (e) { rec.seedsAfter = { error: e.message }; }
      if (rec.accepted && before && after) {
        const old = rec.response.oldServerSeed ?? null;
        rec.revealedServerSeed = old;
        rec.revealCommitOk = old ? sha256Hex(old) === commitOf(before) : null;
        rec.chainOk = nextCommitOf(before) ? nextCommitOf(before) === commitOf(after) : null;
        rec.clientSeedAfter = after.clientSeed ?? null;
      }
      run.dataset.meta.emptySeedControl = rec;
      log(`  empty-seed control: POST /change_seed clientSeed "" → ${rec.status ?? 'no status'} ${rec.accepted ? `ACCEPTED (server client seed now ${JSON.stringify(rec.clientSeedAfter)}, reveal ${rec.revealCommitOk ? 'OK' : String(rec.revealCommitOk)})` : `refused${rec.error ? ': ' + rec.error.slice(0, 160) : ''}`}`);
      return rec;
    },

    async anchor(hb, prefix) {
      const recordedAt = now();
      const rawSeedsBefore = await hb.seedsRaw(gameType); const beforeReadAt = now();
      const before = rawSeedsBefore.seed;
      if (nextCommitOf(before) == null) log('  WARNING: GET /seeds exposed no hashedNextServerSeed before epoch 0 — anchor stays null (not filled in)');
      const clientSeedUsed = run.clientSeedFor(0, prefix);
      const { oldServerSeed, seed: rotateResponseSeed } = await run.rotateWith(hb, clientSeedUsed, 0);
      const after = await hb.seeds(gameType); after._readAt = now();
      run.dataset.meta.commitmentWitnesses[after.id] = witnessOf(nextCommitOf(before), 'preCapture.hashedNextServerSeed (read before the draw)', beforeReadAt, clientSeedUsed);
      const pc = buildPreCapture({ before, rawSeedsBefore, recordedAt, oldServerSeed, commitVerified: oldServerSeed ? sha256Hex(oldServerSeed) === commitOf(before) : null,
        after, rotateResponseSeed, clientSeedUsed, clientSeedSource: clientSeedSourceOf(run.seedLog(), clientSeedUsed) });
      run.dataset.preCapture = pc;
      log(`  pre-capture: pair ${pc.seedId} next ${pc.hashedNextServerSeed ? pc.hashedNextServerSeed.slice(0, 12) + '…' : 'null'} → epoch 0 pair ${pc.epoch0SeedId} hash ${String(pc.epoch0HashedServerSeed).slice(0, 12)}…  anchor ${pc.anchorOk === true ? 'OK' : pc.anchorOk === false ? 'MISMATCH' : 'n/a'}  reveal-commit ${pc.commitVerified ? 'OK' : 'FAIL'}`);
      return after;
    },

    async closePair(hb, pair, nextPrefix, { journal = true } = {}) {
      let serverNonceAtRotation = null, serverPairIdAtRotation = null, publishedNext = pair.hashedNextServerSeed ?? null, readAt = null;
      try { const cur = await hb.seeds(gameType); readAt = now(); serverNonceAtRotation = cur.nonce ?? null; serverPairIdAtRotation = cur.id ?? null; if (cur.id === pair.id && nextCommitOf(cur)) publishedNext = nextCommitOf(cur); } catch {}
      if (!readAt) readAt = pair._readAt ?? null;
      const nextSeed = run.clientSeedFor(run.dataset.seeds.length + 1, nextPrefix);
      const { oldServerSeed, seed: next } = await run.rotateWith(hb, nextSeed, run.dataset.seeds.length + 1);
      const rot = { type: 'rotation', at: now(), epoch: run.dataset.seeds.length, nextPrefix,
        pair: { id: pair.id, clientSeed: pair.clientSeed, hashedServerSeed: pair.hashedServerSeed, hashedNextServerSeed: pair.hashedNextServerSeed ?? null, nonce: pair.nonce ?? null },
        nextClientSeed: nextSeed, seedLogEntry: run.seedLog().find((e) => e.clientSeed === nextSeed) || null, oldServerSeed, next, serverNonceAtRotation, serverPairIdAtRotation,
        witnessForNext: witnessOf(publishedNext, `epoch ${run.dataset.seeds.length} hashedNextServerSeed (read before the draw)`, readAt, nextSeed) };
      if (journal) run.journal(rot);   // FIRST thing after the response: the revealed seed is never lost
      return run.finishPair(rot);
    },

    finishPair(rot) {
      const { pair, nextClientSeed, oldServerSeed, serverNonceAtRotation, serverPairIdAtRotation } = rot;
      const next = { ...rot.next, _readAt: now() };
      run.dataset.meta.commitmentWitnesses[next.id] = rot.witnessForNext;
      if (rot.seedLogEntry && !run.seedLog().some((e) => e.clientSeed === rot.seedLogEntry.clientSeed)) run.seedLog().push(rot.seedLogEntry);
      const commitOk = !!oldServerSeed && sha256Hex(oldServerSeed) === pair.hashedServerSeed;
      const chainLinkOk = pair.hashedNextServerSeed ? pair.hashedNextServerSeed === commitOf(next) : null;
      const mine = run.roundsOnPair(pair);
      const nonces = mine.map(nonceOf).filter((n) => n != null);
      const witness = checkWitness(run.dataset.meta.commitmentWitnesses[pair.id], pair.hashedServerSeed);
      run.dataset.seeds.push({
        seedId: pair.id, epoch: run.dataset.seeds.length, clientSeed: pair.clientSeed, clientSeedSource: clientSeedSourceOf(run.seedLog(), pair.clientSeed),
        hashedServerSeed: pair.hashedServerSeed, hashedNextServerSeed: pair.hashedNextServerSeed ?? null, revealedServerSeed: oldServerSeed ?? null,
        nonceStart: pair.nonce ?? null, nonceEnd: nonces.length ? Math.max(...nonces) : null, rounds: mine.length,
        serverNonceAtRotation, serverPairIdAtRotation, rotatedAt: rot.at, nextClientSeed,
        clientSeedDrawnAfterCommitment: witness, commitmentValid: commitOk, chainLinkOk,
      });
      const ps = witness.playerSet === true;
      const psOk = ps ? witness.equalsEpochHash === true && !!witness.commitmentReadAt && !!witness.clientSeedSetAt && Date.parse(witness.commitmentReadAt) <= Date.parse(witness.clientSeedSetAt) : null;
      const bad = !commitOk || chainLinkOk === false || witness.equalsEpochHash !== true || witness.readBeforeDraw === false || psOk === false;
      log(`  rotate pair ${pair.id}: ${mine.length} rounds · commit ${commitOk ? 'OK' : 'FAIL'} · chain ${chainLinkOk == null ? 'n/a' : chainLinkOk ? 'OK' : 'FAIL'} · ${ps ? `player-set seed ${JSON.stringify(pair.clientSeed)}, hash published before it was sent ${psOk ? 'OK' : 'FAIL'}` : `seed-after-commitment ${witness.equalsEpochHash === true ? 'OK' : String(witness.equalsEpochHash)}`}${bad ? '   <<< INTEGRITY' : ''}`);
      return next;
    },

    /** nonces the server consumed on `pair` that no recorded round carries (a kill between the response and its journal line) */
    declareLostNonces(pair) {
      const have = new Set(run.roundsOnPair(pair).map(nonceOf));
      const lost = []; for (let n = 1; n <= (pair.nonce ?? 0); n++) if (!have.has(n)) lost.push(n);
      if (lost.length) { (run.dataset.meta.lostNonces ??= []).push({ at: now(), seedId: pair.id, nonces: lost, reason: 'consumed by the server but no response recorded (process died before its journal line); recomputable from the revealed seed, served response not recorded' }); log(`  WARNING: pair ${pair.id}: nonce(s) ${lost.join(', ')} consumed but not recorded — declared in meta.lostNonces`); }
      return lost;
    },

    finalSummary(extra = {}) {
      const m = run.dataset.meta, s = run.dataset.seeds;
      m.totalRounds = run.dataset.rounds.length; m.epochs = s.length;
      m.commitmentAllValid = s.every((x) => x.commitmentValid);
      m.chainAllValid = s.every((x) => x.chainLinkOk !== false);
      const drawnOk = (x) => x.clientSeedDrawnAfterCommitment && x.clientSeedDrawnAfterCommitment.equalsEpochHash === true && x.clientSeedDrawnAfterCommitment.readBeforeDraw !== false;
      const psEp = s.filter((x) => x.clientSeedDrawnAfterCommitment && x.clientSeedDrawnAfterCommitment.playerSet === true);
      if (!psEp.length) m.seedDrawnAfterCommitmentAllValid = s.every(drawnOk);
      else {   // Phase D: the CSPRNG rule covers only the epochs that were not player-set (null = none)
        const rest = s.filter((x) => !psEp.includes(x));
        m.seedDrawnAfterCommitmentAllValid = rest.length ? rest.every(drawnOk) : null;
        m.playerSetEpochs = psEp.map((x) => ({ epoch: x.epoch, clientSeed: x.clientSeed, rounds: x.rounds, hashedServerSeed: x.hashedServerSeed }));
        m.playerSetHashPublishedBeforeSentAllValid = psEp.every((x) => { const w = x.clientSeedDrawnAfterCommitment; return w.equalsEpochHash === true && !!w.commitmentReadAt && !!w.clientSeedSetAt && Date.parse(w.commitmentReadAt) <= Date.parse(w.clientSeedSetAt); });
      }
      Object.assign(m, extra); m.finishedAt = now();
    },
  };
  return run;
}

/** Run the Python verifier on a dataset file and echo its output (python3 -I, stdlib only). */
export async function runVerifier(script, file, log = console.log) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('python3', ['-I', script, file], { encoding: 'utf8' });
  if (r.error) { log(`  (verifier not run: ${r.error.message})`); return null; }
  log((r.stdout || '') + (r.stderr || ''));
  return r.status;
}

export function appendText(file, text) { appendFileSync(file, text); }
