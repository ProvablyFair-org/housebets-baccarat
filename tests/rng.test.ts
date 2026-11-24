// BACCARAT-09 reference vectors: the server's published worked examples (E01 examples) and a captured round, re-dealt by
// src/rng.ts from the published algorithm; plus the equivalence of the 6-step partial shuffle with the full 415-step one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shoeTop, fullShoe } from '../src/rng.ts';
import { deal, names } from '../src/rules.ts';
import { cardName } from '../src/spec.ts';
import { readPublishedSpec } from '../src/claims.ts';
// the worked examples are read from E01 itself, not from a copy in src/spec.ts
const SPEC_VECTORS = readPublishedSpec().examples;
import { ROOT } from '../src/loader.ts';

test('the 5 worked examples of the published spec (E01) re-deal card for card', () => {
  for (const v of SPEC_VECTORS) assert.equal(shoeTop(v.serverSeed, v.clientSeed, v.nonce).ids.map(cardName).join(' '), v.deck);
});

test('the 6-step partial shuffle equals the first six cards of the full 415-step shuffle', () => {
  for (const v of SPEC_VECTORS) assert.deepEqual(shoeTop(v.serverSeed, v.clientSeed, v.nonce).ids, fullShoe(v.serverSeed, v.clientSeed, v.nonce).slice(0, 6));
});

test('E01 example 2: the full tableau (Player 5H 7D TD = 2, Banker 7H 4C JH = 1, Player wins, no natural)', () => {
  const ex = JSON.parse(readFileSync(join(ROOT, 'evidence', 'E01-baccarat-fairness-spec-2026-10-12.json'), 'utf8')).answer.examples[1];
  const d = deal(shoeTop(ex.serverSeed, ex.clientSeed, ex.nonce).ids);
  assert.deepEqual(names(d.P), ex.player); assert.deepEqual(names(d.B), ex.banker);
  assert.equal(d.pt, ex.playerTotal); assert.equal(d.bt, ex.bankerTotal); assert.equal(d.outcome, ex.outcome); assert.equal(d.natural, ex.natural);
});

test('captured round idx 0 of the Phase A dataset re-deals from its revealed seed', () => {
  const ds = JSON.parse(readFileSync(join(ROOT, 'data', 'housebets-baccarat-6500rounds.json'), 'utf8'));
  const r = ds.rounds[0]; const f = r.response.game.fairness; const s = ds.seeds.find((x: any) => x.hashedServerSeed === f.hashedServerSeed);
  assert.deepEqual(names(shoeTop(s.revealedServerSeed, f.clientSeed, f.nonce).ids), r.response.game.deck);
});
