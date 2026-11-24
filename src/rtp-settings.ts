// RTP-CLAIM wiring — HouseBets baccarat: the per-spot exact RTP table and the claim it is held to.
// The rule is src/rtp-claim.ts, a byte-identical copy of the framework's core/rtp-claim.ts (conformance C-13 compares the
// SHA-256), version 1.2.0. The switch src/rtp-claim-switch.ts is ON (Methodology v1.1, 14 Oct 2026): the -19 check is
// scored; a house-side miss is OVERSTATED and the verdict RTP FIGURE OVERSTATED (exit 5), never NOT PROVABLY FAIR, and no
// other test of the -19 step can pre-empt it.
//
// SETTINGS. The 9 published spots (E01 pays + dragon): Player, Banker, Tie, Player Pair, Banker Pair, Either Pair, Perfect
// Pair, Player Dragon, Banker Dragon. A spot has no other setting.
// EXACT RTP. Σ over the 298 classes of the exact joint distribution (src/enumerate.ts, an 8-deck enumeration from the
// spec's deck and tableau only) of P(class) × the published fraction the spot pays on it (pushes return 1), as a reduced
// rational. NOT floored: the 1e-8 floor depends on the stake and is stated as a bound by BACCARAT-19.
// CLAIM. Read at verify time from the pinned exhibits by src/claims.ts, never from a
// constant: every place E02, E01 and E08 state a return figure (E02 rulesPaysFine; E01 return, summary and rules; E08
// rulesPaysFine, its 16 Oct rewording in the live copy), flat, held
// to the highest figure stated.
//   npm run rtp-claim:write    rewrite outputs/rtp-claim-table.json and print its SHA-256 to pin
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RtpClaimAccumulator, rtpClaimTable, rtpClaimGate } from './rtp-claim';
import type { RtpClaim, RtpClaimResult, RtpClaimGate } from './rtp-claim';
import { enumerateJoint, exactRtp, type JointClass } from './enumerate.ts';
import { SPOTS } from './spec.ts';
import { readPublishedClaim } from './claims.ts';
import { ROOT } from './loader.ts';

/** The claim, built from the exhibits when it is called (verify calls it after BACCARAT-26 has checked their pins). */
export function rtpClaimOf(): RtpClaim {
  const c = readPublishedClaim();
  const where: Record<string, string> = {
    'E02 rulesPaysFine': 'in the game\'s page code, the rules panel text (E02, cut from the baccarat game bundle platform-housegames-baccarat-game.js; that the live page loads this bundle is inferred, bundles/LIVE-BUNDLES.md 10 Oct 2026; not seen rendered)',
    'E01 return': 'in the game settings the site loads, the fairness answer (E01 return, GET /housegames/baccarat/fairness, which the game bundle also requests; not seen rendered)',
    'E01 summary': 'E01 summary', 'E01 rules': 'E01 rules',
    'E08 rulesPaysFine': 'the same rules panel key reworded on 16 Oct, in the live copy of that bundle (E08, fetched 19 Oct 2026, last-modified 16 Oct 2026; not seen rendered)',
  };
  return {
    kind: 'flat',
    rtp: c.figure,
    source: `HouseBets baccarat: ${c.places.map((p) => `${where[p.place] ?? p.place} "${p.text.length > 160 ? p.text.slice(0, 157) + '…' : p.text}"`).join('; ')}; held to the highest figure stated`,
  };
}
export const RTP_CLAIM_TABLE = join(ROOT, 'outputs', 'rtp-claim-table.json');
/** SHA-256 of the committed table — re-pin with the run that rewrote it (npm run rtp-claim:write). */
export const RTP_CLAIM_TABLE_SHA256 = '328dc198733911ce88f9d993963df929d4c438b8c7f4b9c072eb0c2207e0283f';

export function computeRtpClaim(J: readonly JointClass[] = enumerateJoint()): RtpClaimResult {
  const acc = new RtpClaimAccumulator(rtpClaimOf());
  for (const s of SPOTS) { const r = exactRtp(J, s); acc.add(`spot ${s}`, r.n, r.d, s.endsWith('Bonus') ? 'Dragon Bonus' : s.endsWith('Pair') ? 'pairs' : 'main'); }
  return acc.result();
}

export function rtpClaimTableText(r: RtpClaimResult): string {
  return rtpClaimTable(r, {
    package: 'housebets/baccarat', game: 'baccarat',
    settingSpace: 'the 9 published spots (Player, Banker, Tie, Player Pair, Banker Pair, Either Pair, Perfect Pair, Player Dragon, Banker Dragon)',
    rtpMethod: 'exact rational: Σ P(class) × published fraction over the exact 8-deck joint distribution (src/enumerate.ts), pushes return 1; not floored',
  });
}

export function runRtpClaimGate(J?: readonly JointClass[]): RtpClaimGate {
  const r = computeRtpClaim(J);
  return rtpClaimGate(r, rtpClaimTableText(r), RTP_CLAIM_TABLE, RTP_CLAIM_TABLE_SHA256);
}

if (process.argv[1] && /rtp-settings\.ts$/.test(process.argv[1])) {
  const text = rtpClaimTableText(computeRtpClaim());
  writeFileSync(RTP_CLAIM_TABLE, text);
  console.log(`wrote outputs/rtp-claim-table.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
