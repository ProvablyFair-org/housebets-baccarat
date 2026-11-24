# Module interface of `src/rng.ts` (written by the auditor, not from the casino)

`src/rng.ts` is TypeScript (strict), uses only the Node `crypto` module and has no dependencies beyond `SHOE_CARDS` (416)
from `src/spec.ts`. It exports exactly these names; their semantics are in [ALGORITHM.md](ALGORITHM.md), and this file
fixes only names, types and the package's own conventions. Server seeds are the 64-character lowercase hex text the casino
reveals; the HMAC key and the commitment both use that text as UTF-8, never the bytes it encodes. Card ids are integers
0 … 51 (rank `id mod 13`, suit `floor(id / 13)`); shoe positions are 0 … 415.

```ts
// SHA-256 of a string's UTF-8 bytes, lowercase hex: the commitment of a server seed.
export const sha256Hex: (s: string) => string;
// 2^32.
export const TWO32: number;
// The redraw threshold of a shuffle step over n positions: u is redrawn while u ≥ limitOf(n) = 2^32 − (2^32 mod n).
export const limitOf: (n: number) => number;
// The u32 stream of (serverSeed, clientSeed, nonce): HMAC-SHA256 blocks 0, 1, 2, … with key = UTF-8(serverSeed) and
// message `${clientSeed}:${nonce}:${block}`, each read as eight big-endian 32-bit words, in order. Unbounded.
export function u32Stream(serverSeed: string, clientSeed: string, nonce: number): Generator<number>;
// The first `take` card ids of the shuffled shoe, the u32 words the steps used and how many were redraws.
export interface Shoe { ids: number[]; draws: number; rejections: number }
export function shoeTop(serverSeed: string, clientSeed: string, nonce: number, take?: number): Shoe;   // take defaults to 6
// The same shuffle steps on any u32 stream (lets a test feed a synthetic stream to reach the redraw branch).
export function shuffleTop(it: Iterator<number>, take?: number): Shoe;
// The full 415-step shuffle, all 416 card ids (tests only: its first six equal shoeTop's).
export function fullShoe(serverSeed: string, clientSeed: string, nonce: number): number[];
```

The deal, the pair and perfect-pair flags, the Dragon Bonus rungs and the spot settlements are NOT part of this module; they
are in `src/rules.ts` (`deal`, `bankerDrawsAfterPlayerThird`, `dragonRung`, `payUnits`, `names`, `units8`), with the
published fractions in `src/spec.ts` (`PAYS`, `DRAGON`, `RUNG`, `RUNG_NATURAL`, `cardName`, `valueOfRank`).
