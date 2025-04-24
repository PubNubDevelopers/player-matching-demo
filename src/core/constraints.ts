import PubNub from "pubnub";
import dotenv from 'dotenv';

let constraints = {
  MAX_SKILL_DIFF: 1000,
  MAX_LATENCY_DIFF: 50,
  REQUIRE_SAME_REGION: true,
  REQUIRE_SAME_PLAYSTYLE: true,
  BLOCK_HIGH_TOXICITY: true,
  TOXICITY_THRESHOLD: "medium",
  SKILL_ADJUSTMENT_WEIGHT: 1.0
}

dotenv.config();

const pubnub = new PubNub({
  publishKey: process.env.PUBLISH_KEY!,
  subscribeKey: process.env.SUBSCRIBE_KEY!,
  userId: "Illuminate-Sim"
});

export function updateConstraints(newConstraints: Partial<typeof constraints>){
  constraints = { ...constraints, ...newConstraints };
  console.log("Constraints updated: ", constraints);
}

export function subscribeToContraintsUpdates(){
  pubnub.subscribe({ channels: ["conditions"]});

  pubnub.addListener({
    message: (messageEvent: any) => {
      const { message } = messageEvent;

      // Check if the message contains valid keys to update constraints
      if(typeof message === "object" && message != null){
        const updatedConstraints: Partial<typeof constraints> = {};

        // Update only known constraints
        if(message.hasOwnProperty("max_skill_gap")){
          updatedConstraints.MAX_SKILL_DIFF = message.max_skill_gap;
        }

        // Update constraints and log changes
        if(Object.keys(updatedConstraints).length > 0){
          updateConstraints(updatedConstraints);
        }
        else{
          console.warn("Received message, but no valid constraint updates found:", message);
        }
      }
      else{
        console.warn("Inavalid message format received on conditions channel");
      }
    },
    status: (statusEvent) => {
      if(statusEvent.category === "PNConnectedCategory"){
        console.log("Subscribed to conditions channel");
      }
      else{
        console.log("Status event: ", statusEvent);
      }
    }
  })
}

export function getConstraints() {
  return constraints;
}

