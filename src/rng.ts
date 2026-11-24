// HouseBets baccarat RNG (E01 derivation, fairness version "shoe8"), implemented from the published text only:
//   block_i = HMAC_SHA256(key = serverSeed as UTF-8, message = `${clientSeed}:${nonce}:${i}`), read as big-endian u32s;
//   shoe = [0..415], entry k = card id k mod 52; Fisher–Yates from the top: for k = 0..414: n = 416 − k, draw u,
//   redraw while u ≥ 2^32 − (2^32 mod n), j = k + (u mod n), swap shoe[k] and shoe[j]; cards are dealt shoe[0], shoe[1], …
// A round uses at most 6 cards and the swap at step k only touches positions ≥ k, so the first `take` positions of the
// full shuffle are final after `take` steps: shoeTop(…, 6) equals the first six cards of the full 415-step shuffle
// (tests/rng.test.ts checks this against the full shuffle).
import { createHmac, createHash } from 'node:crypto';
import { SHOE_CARDS } from './spec.ts';

export const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export const TWO32 = 4294967296;
/** The rejection threshold of a step on range n: u is redrawn while u ≥ limit(n). */
export const limitOf = (n: number): number => TWO32 - (TWO32 % n);

/** The u32 stream of one (serverSeed, clientSeed, nonce). */
export function* u32Stream(serverSeed: string, clientSeed: string, nonce: number): Generator<number> {
  const key = Buffer.from(serverSeed, 'utf8');
  for (let block = 0; ; block++) {
    const d = createHmac('sha256', key).update(`${clientSeed}:${nonce}:${block}`).digest();
    for (let o = 0; o < 32; o += 4) yield d.readUInt32BE(o);
  }
}

export interface Shoe { ids: number[]; draws: number; rejections: number }

/** The first `take` card ids of the shuffled shoe, with the u32 draws and rejections the steps used. */
export function shoeTop(serverSeed: string, clientSeed: string, nonce: number, take = 6): Shoe {
  return shuffleTop(u32Stream(serverSeed, clientSeed, nonce), take);
}

/** The shuffle steps on any u32 stream (BACCARAT-08 feeds it a synthetic stream to witness the rejection and the mod map). */
export function shuffleTop(it: Iterator<number>, take = 6): Shoe {
  const sh = new Map<number, number>();   // sparse shoe: position → id (positions never touched hold id = pos mod 52)
  const at = (p: number) => (sh.has(p) ? sh.get(p)! : p % 52);
  let draws = 0, rejections = 0;
  for (let k = 0; k < take; k++) {
    const n = SHOE_CARDS - k, lim = limitOf(n);
    let u = it.next().value as number; draws++;
    while (u >= lim) { u = it.next().value as number; draws++; rejections++; }
    const j = k + (u % n);
    const a = at(k), b = at(j); sh.set(k, b); sh.set(j, a);
  }
  return { ids: Array.from({ length: take }, (_, k) => at(k)), draws, rejections };
}

/** The full 415-step shuffle (tests only: shows shoeTop's first six positions are the full shuffle's). */
export function fullShoe(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const it = u32Stream(serverSeed, clientSeed, nonce);
  const sh = Array.from({ length: SHOE_CARDS }, (_, k) => k % 52);
  for (let k = 0; k < SHOE_CARDS - 1; k++) {
    const n = SHOE_CARDS - k, lim = limitOf(n);
    let u = it.next().value as number; while (u >= lim) u = it.next().value as number;
    const j = k + (u % n); [sh[k], sh[j]] = [sh[j], sh[k]];
  }
  return sh;
}
