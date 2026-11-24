#!/usr/bin/env node
// The falsifiability battery (BACCARAT-29): every mutation in tests/mutations.json is applied to a throwaway copy of the
// package, verify runs there, and the mutation is KILLED when the check it names changes status against an unmutated
// baseline copy (PASS → FAIL / FLAG / GAP, or a capture-origin FLAG → an operator FLAG or FAIL). A check that does not
// print at all (an earlier abort) is MISSING and counts as a survivor. Writes outputs/run/mutation-results.json (never a
// pinned artifact). Runs PF_MUT_JOBS copies at a time (default 5).
// A mutation may edit several files ("edits": [{file, op, …}], each like a single edit, applied in order),
// regenerate several artifacts in order ("regen": "simulate" | "rtp-table" | "record" or a list of them), and require an exit
// code ("expectExit": n or [n, m]). A "control": true entry is the opposite of a mutation: an edit that must NOT move its
// check (status == baseline, the declared verdict and exit) — e.g. a published RTP figure raised but still within the band.
// 'repinPackage': the mutated file's sha256 is also replaced in the copy's RELEASE-MANIFEST.json, MANIFEST.md and README.md
// (with 'repin': every place that holds it follows the forgery).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const reg = JSON.parse(readFileSync(join(ROOT, 'tests', 'mutations.json'), 'utf8'));
const only = process.argv.slice(2);
const list = reg.mutations.filter((m) => !only.length || only.includes(m.id));
const JOBS = Number(process.env.PF_MUT_JOBS || 5);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const NODE = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/ts-resolve.mjs'];

function walk(obj, path) {   // "rounds[7].response.game.payout" -> [parent, key]
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let o = obj; for (const p of parts.slice(0, -1)) o = o[p];
  return [o, parts[parts.length - 1]];
}
const addDec = (x, d) => { const s = typeof x === 'string'; const v = Math.round((Number(x) + d) * 1e8) / 1e8; return s ? v.toFixed(8) : v; };
// 'rm' deletes 'file' from the copy (an artifact of record that is simply absent). 'truncate' keeps the first
// floor(n * value) records of the array at 'path' and, with 'coherent', sets every other count in the file that equalled n to
// the new length (a population shrink with a header that agrees). 'null' sets each of 'keys' to null in every record of the
// array at 'path' (every reveal withheld). Added 30 Oct 2026: a verifier that throws on one of these prints no row for the
// check it names, and this battery scores that as a survivor.
function truncateAt(root, arr, value, coherent) {
  if (!Array.isArray(arr)) throw new Error('truncate: path is not an array');
  const n0 = arr.length, n1 = Math.floor(n0 * value); arr.length = n1;
  if (coherent) (function fix(o) { if (!o || typeof o !== 'object' || o === arr) return; for (const q of Object.keys(o)) { if (o[q] === n0) o[q] = n1; else if (o[q] === String(n0)) o[q] = String(n1); else fix(o[q]); } })(root);
}
function nullKeys(arr, keys) {
  if (!Array.isArray(arr)) throw new Error('null: path is not an array');
  let n = 0; for (const r of arr) for (const q of keys) if (r && typeof r === 'object' && q in r) { r[q] = null; n++; }
  if (!n) throw new Error('null: no record carries ' + keys.join('/'));
}
function repinAll(dir, oldSha, newSha) {
  for (const f of readdirSync(join(dir, 'src'))) { const p = join(dir, 'src', f); const t = readFileSync(p, 'utf8'); if (t.includes(oldSha)) writeFileSync(p, t.split(oldSha).join(newSha)); }
}
const run = (dir, args) => new Promise((res) => { const c = spawn(process.execPath, [...NODE, ...args], { cwd: dir }); let out = ''; c.stdout.on('data', (d) => out += d); c.stderr.on('data', (d) => out += d); c.on('close', (code) => res({ code, out })); });
const statusOf = (out, id) => { const row = out.split('\n').find((l) => l.trim().startsWith(id + ' ')); return row ? row.trim().split(/\s+/)[1] : 'MISSING'; };
const copy = (tag) => { const dir = mkdtempSync(join(tmpdir(), `hbbac-${tag}-`)); cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(join('outputs', 'run')) && !s.includes('node_modules') }); return dir; };

// the baseline: the unmutated package in a copy, every check's printed status
const baseDir = copy('baseline');
const base = await run(baseDir, ['tests/verify.ts']); rmSync(baseDir, { recursive: true, force: true });
console.log(`  baseline: ${(base.out.match(/VERDICT: (.+)/) || [])[1] || 'none'}`);

function edit(dir, id, e) {
  const fp = join(dir, e.file); const before = readFileSync(fp);
  if (e.op === 'rm') rmSync(fp);
    else if (e.op === 'text') {
    const t = before.toString('utf8'); if (!t.includes(e.find)) throw new Error(`${id}: text not found in ${e.file}`);
    writeFileSync(fp, e.all ? t.split(e.find).join(e.replace) : t.replace(e.find, e.replace));
  } else {
    const obj = JSON.parse(before.toString('utf8'));
    for (const p of e.paths || [e.path]) {
      const [o, k] = walk(obj, p);
      if (o === undefined || o === null || (e.op === 'add' && !(k in o))) throw new Error(`${id}: path ${p} not found`);
      if (e.op === 'set') o[k] = e.value; else if (e.op === 'add') o[k] = addDec(o[k], e.value); else if (e.op === 'delete') o.splice(Number(k), 1); else if (e.op === 'truncate') truncateAt(obj, o[k], e.value, e.coherent); else if (e.op === 'null') nullKeys(o[k], e.keys);
    }
    writeFileSync(fp, JSON.stringify(obj, null, 2) + (before.toString('utf8').endsWith('\n') ? '\n' : ''));
  }
  if (e.repin) repinAll(dir, sha(before), sha(readFileSync(fp)));
  if (e.repinPackage) {   // the forgery follows the file's sha256 outside src/ too: the manifest pin and the two documents that quote it
    for (const f of ['RELEASE-MANIFEST.json', 'MANIFEST.md', 'README.md']) {
      const pp = join(dir, f); const pt = readFileSync(pp, 'utf8');
      if (!pt.includes(sha(before))) throw new Error(`${id}: the sha256 of ${e.file} is not in ${f}`);
      writeFileSync(pp, pt.split(sha(before)).join(sha(readFileSync(fp))));
    }
  }
}
async function one(m) {
  const dir = copy(m.id);
  try {
    for (const e of m.edits || [m]) edit(dir, m.id, e);
    const regens = [].concat(m.regen ?? []);
    for (const g of regens) await regen(dir, m.id, g);
    const { code, out } = await run(dir, ['tests/verify.ts']);
    const was = statusOf(base.out, m.kills), status = statusOf(out, m.kills);
    const verdict = (out.match(/VERDICT: (.+)/) || [])[1] || 'none';
    const exitOk = m.expectExit === undefined || [].concat(m.expectExit).includes(code);
    if (m.control) {
      // a control is held when its check keeps the baseline status and the run ends with the declared verdict and exit
      const held = status === was && (!m.expectVerdict || verdict === m.expectVerdict) && exitOk;
      return { id: m.id, kills: m.kills, what: m.what, control: true, baseline: was, status, held, killed: null, verdict, exit: code, expectVerdict: m.expectVerdict ?? null, expectExit: m.expectExit ?? null };
    }
    // killed only when the named check's status differs from the baseline (MISSING = an abort = a survivor); a mutation that
    // declares expectVerdict (a deleted step) is killed only if the run also prints that verdict and exits non-zero; one that
    // declares expectExit only if it exits with that code
    const killed = status !== 'MISSING' && status !== was && (!m.expectVerdict || (verdict === m.expectVerdict && code !== 0)) && exitOk;
    return { id: m.id, kills: m.kills, what: m.what, baseline: was, status, killed, verdict, exit: code, ...(m.expectVerdict ? { expectVerdict: m.expectVerdict } : {}), ...(m.expectExit !== undefined ? { expectExit: m.expectExit } : {}) };
  } catch (e) { return { id: m.id, kills: m.kills, what: m.what, ...(m.control ? { control: true, held: false, killed: null } : { killed: false }), status: 'ERROR', error: String(e.message) }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
}
async function regen(dir, id, g) {
    if (g === 'rtp-table') {
      // the committed RTP table rewritten by the package's own script (npm run rtp-claim:write) and re-pinned
      const tf = join(dir, 'outputs', 'rtp-claim-table.json'); const old = sha(readFileSync(tf));
      const r = await run(dir, ['src/rtp-settings.ts']); if (r.code !== 0) throw new Error(`${id}: rtp-claim:write failed: ${r.out.slice(0, 200)}`);
      repinAll(dir, old, sha(readFileSync(tf)));
    }
    if (g === 'record') {
      // a deleted step with the committed record regenerated and re-pinned (the package's documented workflow, npm run
      // record), so BACCARAT-27's record comparison cannot be what catches it — only the verdict binding can
      const rf = join(dir, 'outputs', 'verification-results.json'); const old = sha(readFileSync(rf));
      await run(dir, ['tests/verify.ts']);
      writeFileSync(rf, readFileSync(join(dir, 'outputs', 'run', 'verification-results.json')));
      repinAll(dir, old, sha(readFileSync(rf)));
    }
    if (g === 'simulate') {
      const old = sha(readFileSync(join(dir, 'outputs', 'simulation-results.json')));
      const r = await new Promise((res) => { const c = spawn(process.execPath, [...NODE, 'src/simulate.ts'], { cwd: dir, env: { ...process.env, PF_EMIT: '1' } }); c.on('close', res); });
      if (r !== 0) throw new Error(`${id}: simulate failed`);
      repinAll(dir, old, sha(readFileSync(join(dir, 'outputs', 'simulation-results.json'))));
    }
}

const results = []; let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, async () => { while (next < list.length) { const m = list[next++]; const r = await one(m); results.push(r); console.log(`  ${r.id.padEnd(5)} ${r.kills}  ${r.control ? (r.held ? 'HELD (control)' : 'CONTROL BROKEN') : r.killed ? 'KILLED' : 'SURVIVED'} (${r.baseline ?? '?'} → ${r.status}; ${r.verdict ?? r.error}; exit ${r.exit ?? '?'})  ${r.what}`); } }));
results.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
// every scored check (HARD_FAIL / FLAG) of the profile must have at least one killing mutation
// the scored list is read from the vendored framework profile (profile/baccarat.profile.json), not from src/
const scored = JSON.parse(readFileSync(join(ROOT, 'profile', 'baccarat.profile.json'), 'utf8')).checks.filter((c) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG').map((c) => c.id);
const muts = results.filter((r) => !r.control), controls = results.filter((r) => r.control);
const uncoveredSteps = only.length ? [] : scored.filter((id) => !muts.some((r) => r.kills === id && r.killed));
const out = { total: muts.length, killed: muts.filter((r) => r.killed).length, survivors: muts.filter((r) => !r.killed).map((r) => ({ id: r.id, kills: r.kills, status: r.status, limitation: null })),
  controls: controls.length, controlsHeld: controls.filter((r) => r.held === true).length, uncoveredSteps, results };
mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
writeFileSync(join(ROOT, 'outputs', 'run', 'mutation-results.json'), JSON.stringify(out, null, 2) + '\n');
// A full battery also writes the committed record BACCARAT-29 reads (outputs/mutation-results.json, un-ignored,
// pinned in src/artifact-pins.ts RUN_RECORD_PINS and in RELEASE-MANIFEST.json), bound to the tests/verify.ts and the
// registry it ran against; re-pin it in the same change. No timestamps: the same package gives the same bytes.
if (!only.length) {
  const committed = { registrySha256: sha(readFileSync(join(ROOT, 'tests', 'mutations.json'))), verifySha256: sha(readFileSync(join(ROOT, 'tests', 'verify.ts'))), ...out };
  writeFileSync(join(ROOT, 'outputs', 'mutation-results.json'), JSON.stringify(committed, null, 2) + '\n');
  console.log(`wrote outputs/mutation-results.json sha256 ${sha(readFileSync(join(ROOT, 'outputs', 'mutation-results.json')))} — re-pin it in src/artifact-pins.ts RUN_RECORD_PINS.mutation`);
}
console.log(`mutations: ${out.killed}/${out.total} killed; survivors ${out.survivors.length}; scored checks with no killing mutation: ${uncoveredSteps.join(', ') || 'none'}; controls held ${out.controlsHeld}/${out.controls}`);
process.exitCode = out.survivors.length || uncoveredSteps.length || out.controlsHeld !== out.controls ? 1 : 0;
