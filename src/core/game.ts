import PubNub from "pubnub";
import { sendIlluminateData, updatePlayerMetadata } from "../utils/pubnub";
import { getConstraints } from "./constraints";
import { PlayerWithMetadata } from "../utils/types";

export async function simulateGame(pubnub: PubNub, player1: PlayerWithMetadata, player2: PlayerWithMetadata, sessionId: string){
  const { SKILL_ADJUSTMENT_WEIGHT } = getConstraints();
  const K_FACTOR = 32;
  const NORMALIZED_ELO = 1500;

  const skill1 = player1.metadata.skill;
  const skill2 = player2.metadata.skill;

  const voiceChatBonus = 1; // Simplified; no VC logic here
  const player1Wins = Math.random() < (skill1 * voiceChatBonus) / (skill1 + skill2 * voiceChatBonus);

  const elo1 = player1.metadata.skill ?? NORMALIZED_ELO;
  const elo2 = player2.metadata.skill ?? NORMALIZED_ELO;

  const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
  let eloChange = K_FACTOR * ((player1Wins ? 1 : 0) - expected1);

  const adj1 = SKILL_ADJUSTMENT_WEIGHT / (1 + Math.exp(-(elo1 - NORMALIZED_ELO) / 200));
  const adj2 = SKILL_ADJUSTMENT_WEIGHT / (1 + Math.exp(-(elo2 - NORMALIZED_ELO) / 200));

  eloChange += player1Wins ? adj1 : -adj2;
  eloChange = Math.max(4, Math.min(32, Math.abs(eloChange))) * Math.sign(eloChange);
  const drift = (Math.random() - 0.5) * 10;

  const newElo1 = Math.round(Math.max(0, elo1 + eloChange + drift));
  const newElo2 = Math.round(Math.max(0, elo2 - eloChange - drift));

  await updatePlayerMetadata(pubnub, player1.id, { skill: newElo1 });
  await updatePlayerMetadata(pubnub, player2.id, { skill: newElo2 });

  await sendIlluminateData(pubnub, {
    sessionId,
    player1: player1.id,
    player2: player2.id,
    skillGap: Math.abs(newElo1 - newElo2),
    avgSkill: (newElo1 + newElo2) / 2
  });

  console.log(`🏁 Game finished: ${player1.id} (${newElo1}) vs ${player2.id} (${newElo2})`);
}