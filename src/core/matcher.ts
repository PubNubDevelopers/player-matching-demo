import PubNub from 'pubnub';
import { getConstraints } from './constraints';
import { PlayerWithMetadata, PlayerMetadata } from '../utils/types';
import { simulateGame } from './game';
import { createSessionAPI, deleteSessionAPI, startSessionAPI } from '../api/sessions';


export async function processMatchMaking(
  pubnub: PubNub,
  members: {id: string}[]
){
  const validPlayers: PlayerWithMetadata[] = [];

  console.log("Members: ", members);

  for(const member of members){
    try{
      const result = await pubnub.objects.getUUIDMetadata({
        uuid: member.id,
        include: {customFields: true }
      });

      const meta = result.data?.custom;

      // Check if metadata is valid
      if(isValidMetadata(meta)){
        validPlayers.push({
          id: member.id,
          metadata: meta as PlayerMetadata
        });
      } else {
        console.warn(`Skipping ${member.id}: Incomplete meadata`);
      }
    }
    catch(e){
      console.error(`Failed to fetch metadata for ${member.id}`, e);
    }
  }

  console.log("VALID PLAYERS ARE: ", validPlayers);

  const pairs = pairUsersWithConstraints(validPlayers);

  for(const [player1, player2] of pairs){
    console.log(`Matched created: ${player1.id} vs ${player2.id}`);

    const sessionId = `session-${Date.now()}`;

    await createSessionAPI(player1.id, player2.id);

    await notifyPlayers(pubnub, player1.id, player2.id);

    await startSessionAPI(sessionId);

    await simulateGame(pubnub, player1, player2, sessionId);

    await deleteSessionAPI(sessionId);
  }
}

function isValidMetadata(meta: any): meta is PlayerMetadata {
  return (
    meta &&
    typeof meta.skill === 'number' &&
    typeof meta.latency === 'number' &&
    typeof meta.inputDevice === 'string' &&
    typeof meta.favoriteWeapon === 'string' &&
    typeof meta.region === 'string' &&
    typeof meta.toxicity === 'string' &&
    typeof meta.playStyle === 'string'
  )
}

async function notifyPlayers(pubnub: PubNub, player1Id: string, player2Id: string){
  const lobbyChannel = `game-lobby-${player1Id}-${player2Id}`;

  console.log("Game Lobby Created with ID: ", lobbyChannel);

  await pubnub.publish({
    channel: `${player1Id}`,
    message: { status: 'Matched', lobby: lobbyChannel, opponent: player2Id }
  });

  await pubnub.publish({
    channel: `${player2Id}`,
    message: { status: 'Matched', lobby: lobbyChannel, opponent: player1Id }
  });

  await pubnub.publish({
    channel: lobbyChannel,
    message: { status: `Starting game for ${player1Id} vs ${player2Id}`}
  });

  console.log(`Matched ${player1Id} with ${player2Id}`);
}

type ToxicityLevel = 'low' | 'medium' | 'high';

const toxicityRank: Record<ToxicityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3
}

function pairUsersWithConstraints(players: PlayerWithMetadata[]): [PlayerWithMetadata, PlayerWithMetadata][]{
  const pairs: [PlayerWithMetadata, PlayerWithMetadata][] = [];
  const unmatched: PlayerWithMetadata[] = [...players];

  const constraints = getConstraints();

  const {
    TOXICITY_THRESHOLD,
    MAX_SKILL_DIFF,
    MAX_LATENCY_DIFF,
    REQUIRE_SAME_REGION,
    REQUIRE_SAME_PLAYSTYLE,
    BLOCK_HIGH_TOXICITY
  } = constraints;

  while (unmatched.length > 1){
    const player = unmatched.shift()!;
    let bestMatchIndex = -1;

    for(let i = 0; i < unmatched.length; i++){
      const other = unmatched[i];

      const skillDiff = Math.abs(player.metadata.skill - other.metadata.skill);
      const latencyDiff = Math.abs(player.metadata.latency - other.metadata.latency);
      const sameRegion = player.metadata.region === other.metadata.region;
      const samePlayStyle = player.metadata.playStyle === other.metadata.playStyle;

      const bothLowToxicity =
        toxicityRank[player.metadata.toxicity as ToxicityLevel] <= toxicityRank[TOXICITY_THRESHOLD as ToxicityLevel] &&
        toxicityRank[other.metadata.toxicity as ToxicityLevel] <= toxicityRank[TOXICITY_THRESHOLD as ToxicityLevel];

      const passesConstraints =
        skillDiff <= MAX_SKILL_DIFF &&
        latencyDiff <= MAX_LATENCY_DIFF &&
        (!REQUIRE_SAME_REGION || sameRegion) &&
        (!REQUIRE_SAME_PLAYSTYLE || samePlayStyle) &&
        (!BLOCK_HIGH_TOXICITY || bothLowToxicity);

      if(passesConstraints){
        bestMatchIndex = i;
        break;
      }
    }

    if(bestMatchIndex >= 0){
      const matched = unmatched.splice(bestMatchIndex, 1)[0];
      pairs.push([player, matched]);
    }
  }

  return pairs;
}