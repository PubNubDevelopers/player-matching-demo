import PubNub, { Payload } from "pubnub";
import { PlayerMetadata } from "./types";

export async function updatePlayerMetadata(pubnub: PubNub, userId: string, newCustomData: Partial<PlayerMetadata>){
  try {
    const current = await pubnub.objects.getUUIDMetadata({
      uuid: userId,
      include: { customFields: true }
    });

    const updated = {
      ...current.data.custom,
      ...newCustomData
    };

    await pubnub.objects.setUUIDMetadata({
      uuid: userId,
      data: {
        custom: updated
      }
    });

    console.log(`Updated metadata for ${userId}`);
  }
  catch(e){
    console.error(`Failed to update metadata for ${userId}: `, e);
  }
}

export async function sendIlluminateData(pubnub: PubNub, message: Payload){
  await pubnub.publish({
    channel: 'illuminate-data',
    message: message
  });
}