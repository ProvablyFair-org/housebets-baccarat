// A same-account, same-engine capture that the ledger holds but this package does not ship (the earlier
// 450-round run of 12 Oct 2026, E05 row "capture-2026-10-12/baccarat/housebets-baccarat-450rounds.json") is recomputed by the
// package's own recompute core (src/recompute.ts) so that its exclusion hides nothing. The file is not shipped (it is the
// workshop's as-captured file); its sha256 is printed so the result is tied to the exact bytes.
//   npm run recompute:excluded -- <path to housebets-baccarat-450rounds.json>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { recompute } from './recompute.ts';
import { sha256Hex } from './rng.ts';
import type { Dataset } from './types.ts';

const path = process.argv[2];
if (!path) { console.error('usage: npm run recompute:excluded -- <dataset.json>'); process.exit(2); }
const raw = readFileSync(path);
const d = JSON.parse(raw.toString('utf8')) as Dataset;
const c = recompute(d);
const seedsOk = d.seeds.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
let links = 0; for (let i = 0; i + 1 < d.seeds.length; i++) if (d.seeds[i].hashedNextServerSeed === d.seeds[i + 1].hashedServerSeed) links++;
const nonceOk = d.seeds.filter((s) => { const ns = d.rounds.filter((r) => r.response.game.fairness.hashedServerSeed === s.hashedServerSeed).map((r) => r.response.game.fairness.nonce).sort((a, b) => a - b);
  return ns.length > 0 && ns.every((x, i) => x === i + 1) && ns.length === Number(s.serverNonceAtRotation); }).length;
const staked = c.per.reduce((t, x) => t + x.stake, 0n), paid = c.per.reduce((t, x) => t + x.total, 0n);
const ats = d.rounds.map((r: any) => r.at).sort();
const fmt = (u: bigint) => (Number(u) / 1e8).toFixed(8);
console.log(`excluded dataset ${basename(path)} sha256 ${createHash('sha256').update(raw).digest('hex')} (${raw.length} bytes), schema ${d.meta?.schema}, game ${d.meta?.gameType}`);
console.log(`  rounds ${c.n} in ${d.seeds.length} seed pairs, ${ats[0]} … ${ats[ats.length - 1]}; fairness version shoe8 ${c.version}/${c.n}`);
console.log(`  seeds: sha256(revealed) == committed ${seedsOk}/${d.seeds.length}; chain links ${links}/${d.seeds.length - 1}; nonces 1..N == the server's count ${nonceOk}/${d.seeds.length}`);
console.log(`  cards ${c.cards}/${c.n}, tableau ${c.tableau}/${c.n}, flags ${c.flags}/${c.n}; spot payouts ${c.spotPay}/${c.spotsCompared}, spot result labels ${c.spotLabels}/${c.spotsCompared}; round payout ${c.roundPay}/${c.n}, stake ${c.stakeOk}/${c.n}, server round record ${c.copies}/${c.n}`);
console.log(`  capture copy and round record == the answer ${c.answerCopies}/${c.n}; lookup ${c.lookupOk}/${c.lookupN}; money fields on the 1e-8 grid ${c.gridN - c.gridBad}/${c.gridN}; multiplier == payout / stake ${c.multOk}/${c.n}`);
console.log(`  staked ${fmt(staked)} paid ${fmt(paid)} (recomputed); a single floor per round would pay more on ${c.floorRounds} rounds (${c.floorUnits} units)`);
const ok = c.cards === c.n && c.tableau === c.n && c.flags === c.n && c.spotPay === c.spotsCompared && c.spotLabels === c.spotsCompared && c.roundPay === c.n && c.stakeOk === c.n && c.copies === c.n
  && c.answerCopies === c.n && c.lookupOk === c.lookupN && c.gridBad === 0 && c.multOk === c.n && c.bad.length === 0 && seedsOk === d.seeds.length && nonceOk === d.seeds.length;
console.log(ok ? 'RECOMPUTES: every round of the excluded dataset' : `DOES NOT RECOMPUTE: ${c.bad.slice(0, 3).join('; ')}`);
process.exitCode = ok ? 0 : 1;
