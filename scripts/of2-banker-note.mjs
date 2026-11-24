#!/usr/bin/env node
// OF-2 (MANIFEST.md, Operator finding): the capture-time rules panel's Banker note against E01 and the server.
// E02 rulesBankerFine: "When the player stood (natural or 6–7), the banker draws on 0–5 and stands on 6–7."
// E01 deal: "a two-card total of 8 or 9 either side (a natural) ends the round".
// For every round of the four datasets, re-deals the first six cards from the revealed seeds (src/rng.ts), finds the rounds
// where the Player's two cards make a natural and the Banker's two cards total 0–5, checks the server dealt no Banker third
// card in them, and counts the rounds whose result the panel's note would change (the Banker taking shoe[4]).
// Run from the package root:
//   node --experimental-strip-types --no-warnings --import ./scripts/ts-resolve.mjs scripts/of2-banker-note.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { shoeTop } = await import(join(ROOT, 'src', 'rng.ts'));
const { names } = await import(join(ROOT, 'src', 'rules.ts'));
const { valueOfRank } = await import(join(ROOT, 'src', 'spec.ts'));
const val = (id) => valueOfRank(id % 13);
const e02 = JSON.parse(readFileSync(join(ROOT, 'evidence', 'E02-baccarat-rules-panel-2026-10-10.json'), 'utf8')).rulesPanelEnglish.rulesBankerFine;
const e08 = JSON.parse(readFileSync(join(ROOT, 'evidence', 'E08-baccarat-rules-panel-live-2026-10-19.json'), 'utf8')).rulesPanelEnglish.rulesBankerFine;
console.log(`E02 rulesBankerFine: "${e02}"`);
console.log(`E08 rulesBankerFine: "${e08}"`);
const SETS = [['Phase A', 'housebets-baccarat-6500rounds.json'], ['Phase C', 'supplementary/housebets-baccarat-phaseC-300rounds.json'],
  ['Phase C $10', 'supplementary/housebets-baccarat-phaseC-10usd-300rounds.json'], ['Phase D', 'supplementary/housebets-baccarat-phaseD-200rounds.json']];
const all = { rounds: 0, n: 0, dealt: 0, changed: 0, toTie: 0, toBanker: 0 };
for (const [label, file] of SETS) {
  const d = JSON.parse(readFileSync(join(ROOT, 'data', file), 'utf8'));
  const seedBy = new Map(d.seeds.map((s) => [s.hashedServerSeed, s]));
  const c = { rounds: d.rounds.length, n: 0, dealt: 0, changed: 0, toTie: 0, toBanker: 0, deckOff: 0 };
  for (const r of d.rounds) {
    const g = r.response.game, f = g.fairness, s = seedBy.get(f.hashedServerSeed);
    const ids = shoeTop(s.revealedServerSeed, s.clientSeed, f.nonce).ids;
    if (names(ids).join() !== g.deck.join()) c.deckOff++;
    const pt = (val(ids[0]) + val(ids[2])) % 10, bt = (val(ids[1]) + val(ids[3])) % 10;
    if (!(pt >= 8 && bt <= 5)) continue;
    c.n++;
    if (g.banker.cards.length !== 2 || g.cardsUsed !== 4) c.dealt++;
    const bt3 = (bt + val(ids[4])) % 10;   // the panel's note: Banker draws the next card, shoe[4]
    const panel = pt > bt3 ? 'player' : bt3 > pt ? 'banker' : 'tie';
    if (panel !== g.outcome) { c.changed++; if (panel === 'tie') c.toTie++; else if (panel === 'banker') c.toBanker++; }
    if (label === 'Phase A' && f.nonce === 46 && g.publicId === 'NFVJjbH3z17HyR1iFNRL2') {
      const pl = g.bets.find((b) => b.spot === 'player');
      console.log(`example: Phase A round ${g.publicId}, nonce 46: Player ${names([ids[0], ids[2]]).join(' ')} = ${pt}, Banker ${names([ids[1], ids[3]]).join(' ')} = ${bt}; under the note the Banker draws ${names([ids[4]])[0]} to ${bt3}: ${panel}; served ${g.outcome}, Banker ${g.banker.cards.join(' ')}, Player spot ${pl.amount} → ${pl.result} ${pl.payout}`);
    }
  }
  console.log(`${label}: ${c.rounds} rounds (served deck != re-dealt: ${c.deckOff}); Player two-card natural vs Banker 0–5: ${c.n}; a Banker third card served in ${c.dealt}; result the note would change: ${c.changed} (Player → tie ${c.toTie}, Player → Banker ${c.toBanker})`);
  for (const k of Object.keys(all)) all[k] += c[k];
}
console.log(`all four sets: ${all.rounds} rounds; Player two-card natural vs Banker 0–5: ${all.n}; a Banker third card served in ${all.dealt}; result the note would change: ${all.changed} (Player → tie ${all.toTie}, Player → Banker ${all.toBanker})`);
process.exitCode = all.dealt === 0 ? 0 : 1;
