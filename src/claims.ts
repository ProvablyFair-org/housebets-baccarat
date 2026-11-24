// What the verifier holds this package to, read at verify time from the
// pinned exhibits, never from a hand copy. BACCARAT-26 checks every exhibit pin before anything calls these readers, and
// compares each constant src/spec.ts keeps (paytable, Dragon k and rungs, limits) with the value read here; a mismatch is a
// reproduction failure (exit 1).
//
// The RTP claim (every place the figure appears in our evidence):
//   E02 rulesPaysFine   "Every spot returns exactly 99% of stake over the long run (1% house edge; no commission)." — the
//                       rules panel text in the game's page code (cut from the baccarat bundle; that the live page loads
//                       that bundle is inferred, bundles/LIVE-BUNDLES.md); not seen rendered
//   E01 return          "99% on every spot, …" — the fairness answer, the game settings the site loads; not seen rendered
//   E01 summary         the same "99% on every spot" sentence
//   E01 rules           "… so a spot's return never exceeds 99%"
//   E08 rulesPaysFine   "Theoretical RTP before payout rounding: 99% (1% house edge; no commission)." — the same rules panel key
//                       reworded on 16 Oct, in the live copy of the baccarat bundle fetched 19 Oct (last-modified 16 Oct 2026)
// Every spot is held to the HIGHEST figure any place states (the strictest reading for the house), so raising the figure
// in any one place is a claim RTP-CLAIM tests, and a lower, player-side figure in one place cannot hide another.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './loader.ts';
import { parseRational, cmp, ratStr, type Rational } from './rtp-claim';

export const E01_FILE = 'evidence/E01-baccarat-fairness-spec-2026-10-12.json';
export const E02_FILE = 'evidence/E02-baccarat-rules-panel-2026-10-10.json';
export const E03_FILE = 'evidence/E03-baccarat-limits-2026-10-12.json';
export const E08_FILE = 'evidence/E08-baccarat-rules-panel-live-2026-10-19.json';

const read = (rel: string): any => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
export interface Stated { place: string; text: string; figures: string[] }
export interface PublishedClaim { ok: boolean; why: string[]; places: Stated[]; figure: string; figurePct: string }

/** The sentence of `text` that holds `re`, whole (sentences end at . ! or ? followed by a space and a capital or a digit,
 *  so a decimal point never cuts one). */
export function sentenceOf(text: string, re: RegExp): string {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9"])/).find((s) => re.test(s))?.trim() ?? '';
}
/** Every return percentage a text states (a figure followed by "house edge" is the edge, not a return), as an exact fraction of 1: "99%" → 99/100, "99.5 %" → 199/200. */
export function percentsOf(text: string): string[] {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s?%(?!\s*house edge)/g)].map((m) => { const r = parseRational(m[1]); return ratStr({ n: r.n, d: r.d * 100n }); });
}
const pct6 = (r: Rational): string => { const s = (r.n * 100n * 1000000n * 2n + r.d) / (2n * r.d); const t = s.toString().padStart(7, '0'); return `${t.slice(0, -6)}.${t.slice(-6)}`; };

/** The flat RTP claim: every place E01, E02 and E08 state a return figure, held to the highest. */
export function readPublishedClaim(): PublishedClaim {
  const why: string[] = [];
  const e01 = read(E01_FILE).answer, pf = String(read(E02_FILE).rulesPanelEnglish?.rulesPaysFine ?? '');
  const ruleRtp = ((e01.rules ?? []) as string[]).find((x) => /return never exceeds/.test(x)) ?? '';
  const pf8 = String(read(E08_FILE).rulesPanelEnglish?.rulesPaysFine ?? '');
  const places: Stated[] = [
    { place: 'E02 rulesPaysFine', text: sentenceOf(pf, /returns exactly/) },
    { place: 'E01 return', text: sentenceOf(String(e01.return ?? ''), /on every spot/) },
    { place: 'E01 summary', text: sentenceOf(String(e01.summary ?? ''), /\d+(?:\.\d+)?\s?% on every spot/) },
    { place: 'E01 rules', text: ruleRtp },
    { place: 'E08 rulesPaysFine', text: sentenceOf(pf8, /^Theoretical RTP before payout rounding/) },
  ].map((p) => ({ ...p, figures: p.text ? percentsOf(p.text) : [] }));
  for (const p of places) if (!p.figures.length) why.push(`no figure in ${p.place}`);
  const all = places.flatMap((p) => p.figures).map((x) => parseRational(x));
  const top = all.length ? all.reduce((a, b) => (cmp(b, a) > 0 ? b : a)) : { n: 0n, d: 1n };
  return { ok: why.length === 0, why, places, figure: ratStr(top), figurePct: pct6(top) };
}

/** The rounding sentence of the rules panel (E02 rulesPaysFine) and of the fairness answer (E01 rules), quoted whole. */
export function readRoundingTexts(): { panel: string; panelPerRound: boolean; e01: string } {
  const pf = String(read(E02_FILE).rulesPanelEnglish?.rulesPaysFine ?? '');
  const panel = sentenceOf(pf, /Payouts are computed/);
  const e01 = ((read(E01_FILE).answer.rules ?? []) as string[]).find((x) => /rounded down/.test(x)) ?? '';
  return { panel, panelPerRound: /per round/i.test(panel), e01 };
}

/** E01's published probabilities and worked examples, and E03's limits, as the exhibits state them. */
export function readPublishedSpec(): { probabilities: Record<string, string>; examples: { serverSeed: string; clientSeed: string; nonce: number; deck: string; ex: any }[];
  minBet: string; maxBet: string; maxWin: string } {
  const e01 = read(E01_FILE).answer, w = read(E03_FILE).answer?.wallet ?? {};
  return { probabilities: { ...(e01.probabilities ?? {}) },
    examples: ((e01.examples ?? []) as any[]).map((x) => ({ serverSeed: String(x.serverSeed), clientSeed: String(x.clientSeed), nonce: Number(x.nonce), deck: (x.deck ?? []).join(' '), ex: x })),
    minBet: String(w.minBet), maxBet: String(w.maxBet), maxWin: String(w.maxWin) };
}
