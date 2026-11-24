// Shapes of the HouseBets baccarat capture (schema housebets-baccarat-capture-v1, rig 12 Oct 2026).
// Only the fields the verifier reads are typed; the dataset carries more (the full server answer under `response`).
import type { Spot } from './spec.ts';

export interface ServedBet { spot: Spot; amount: number; result?: string; payout: number }
export interface Round {
  idx: number;
  phase: string;            // the capture plan's sub-phase label (A all 9 spots / B one spot / C three spots; C; DA/DB/DC)
  roundId: string;
  nonce: number;
  request: { bets: { spot: Spot; amount: number }[]; amount: number };
  response: {
    balance?: number;
    game: {
      roundId: string; stake: number; payout: number; outcome: string; natural?: boolean; margin?: number;
      deck: string[]; player: { cards: string[]; total: number }; banker: { cards: string[]; total: number };
      playerPair: boolean; bankerPair: boolean; playerPerfect?: boolean; bankerPerfect?: boolean; bets: ServedBet[];
      fairness: { version: string; hashedServerSeed: string; clientSeed: string; nonce: number };
    };
    round: { roundId: string; stake: number; payout: number };
  };
}
export interface Seed {
  seedId: number; epoch: number; clientSeed: string; clientSeedSource: string; hashedServerSeed: string; hashedNextServerSeed: string;
  revealedServerSeed: string; nonceStart: number; nonceEnd: number; rounds: number; serverNonceAtRotation: number;
  clientSeedDrawnAfterCommitment?: { committedHash: string; commitmentReadAt: string; clientSeed: string; clientSeedSetAt?: string; readBeforeDraw?: boolean };
}
export interface Dataset {
  meta: any;
  preCapture: { clientSeed: string; hashedServerSeed: string; hashedNextServerSeed: string };
  seeds: Seed[];
  rounds: Round[];
}
