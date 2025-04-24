import PubNub from 'pubnub';
import dotenv from 'dotenv';
import { processMatchMaking } from './matcher';
import { subscribeToContraintsUpdates } from './constraints';

dotenv.config();

const INTERVAL_MS = 10000;
const channelID = 'demo-matchmaking';

let queue: Map<string, {userId: string; message: string}> = new Map();
let isRunning = false;

export async function startMatchmakingLoop(){
  const pubnub = new PubNub({
    publishKey: process.env.PUBLISH_KEY as string,
    subscribeKey: process.env.SUBSCRIBE_KEY as string,
    userId: "server"
  });

  pubnub.subscribe({ channels: [channelID]});
  subscribeToContraintsUpdates();

  pubnub.addListener({
    message: (event) => {
      const userId = event.publisher || (event.message && (event.message as any).userId);
      const message = (event.message && (event.message as any)) || '';
      console.log(message);

      if(userId && !queue.has(userId)){
        queue.set(userId, {userId, message});
      }
    }
  });

  setInterval(async () => {
    try {
      await processQueue(pubnub);
    }
    catch(e){
      console.log('Error in matchmaking loop: ', e);
    }
  }, INTERVAL_MS)
}

async function processQueue(pubnub: PubNub) {
  if(isRunning || queue.size < 2) return;
  isRunning = true;

  console.log("Processing Queue Running");

  try{
    const users = Array.from(queue.values());
    const userIds = users.map((entry) => entry.userId);

    for(const user of users){
      // Notify users that matchmaking has started
      await pubnub.publish({
        channel: `${user.userId}`,
        message: {
          status: 'Processing',
          matchedUsers: userIds
        }
      })
      queue.delete(user.userId);
    }

    const memberObjects = userIds.map((id) => ({ id }));
    await processMatchMaking(pubnub, memberObjects);
  }
  catch(e){
    console.error('Matchmaking error', e);
  } finally {
    isRunning = false;
  }
}