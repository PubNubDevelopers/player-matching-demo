import PubNub from 'pubnub';
import dotenv from 'dotenv';

dotenv.config();

const pubnub = new PubNub({
  publishKey: process.env.PUBLISH_KEY as string,
  subscribeKey: process.env.SUBSCRIBE_KEY as string,
  userId: "server"
});

const matchmakingChannel = 'demo-matchmaking';

const players = [
  { id: 'player1', skill: 250, latency: 42, inputDevice: 'controller', favoriteWeapon: 'Sniper', region: 'NA', toxicity: 'low', playStyle: 'casual' },
  { id: 'player2', skill: 600, latency: 90, inputDevice: 'Mouse', favoriteWeapon: 'Assault Rifle', region: 'EU', toxicity: 'low', playStyle: 'casual' },
  { id: 'player3', skill: 200, latency: 23, inputDevice: 'controller', favoriteWeapon: 'Knife', region: 'NA', toxicity: 'low', playStyle: 'casual' },
  { id: 'player4', skill: 380, latency: 80, inputDevice: 'Mobile', favoriteWeapon: 'Sniper', region: 'Asia', toxicity: 'low', playStyle: 'competitive' },

  // Over 500 skill gap from player1 (250)
  { id: 'player5', skill: 850, latency: 30, inputDevice: 'controller', favoriteWeapon: 'Rocket Launcher', region: 'NA', toxicity: 'low', playStyle: 'casual' },
  { id: 'player6', skill: 900, latency: 25, inputDevice: 'Mouse', favoriteWeapon: 'Pistol', region: 'NA', toxicity: 'low', playStyle: 'casual' },

  // Under 500 skill gap from player1
  { id: 'player7', skill: 450, latency: 50, inputDevice: 'controller', favoriteWeapon: 'Assault Rifle', region: 'NA', toxicity: 'low', playStyle: 'casual' },
  { id: 'player8', skill: 200, latency: 40, inputDevice: 'controller', favoriteWeapon: 'Knife', region: 'NA', toxicity: 'low', playStyle: 'casual' },
  { id: 'player9', skill: 600, latency: 70, inputDevice: 'Mobile', favoriteWeapon: 'Sniper', region: 'NA', toxicity: 'low', playStyle: 'casual' }
];

async function simulatePlayerJoin(player: typeof players[number]){
  const playerPubNub = new PubNub({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: player.id
  });

  await playerPubNub.publish({
    channel: matchmakingChannel,
    message: {
      userId: player.id,
      status: "join_queue"
    }
  });

  console.log(`${player.id} published matchmaking join message.`);
}

async function setMetadataAndJoin(){
  for (const player of players){
    try{
      await pubnub.objects.setUUIDMetadata({
        uuid: player.id,
        data: {
          name: player.id,
          custom: {
            skill: player.skill,
            latency: player.latency,
            inputDevice: player.inputDevice,
            favoriteWeapon: player.favoriteWeapon,
            region: player.region,
            toxicity: player.toxicity,
            playStyle: player.playStyle
          }
        },
        include: { customFields: true }
      });

      console.log(`Metadata set for ${player.id}`);
      await simulatePlayerJoin(player);
    }
    catch(e){
      console.error(`Error setting metadata or publishing for ${player.id}`, e);
    }
  }
}

(async () => {
  await setMetadataAndJoin();
})();