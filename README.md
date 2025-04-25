# Real-time Player Matching Server with PubNub and EOS

An end-to-end matchmaking system built using **C++20**, **JavaScript**, **Crow**, [**PubNub**](https://www.pubnub.com/), and [**Epic Online Services (EOS)**](https://dev.epicgames.com/docs/dev-portal). This hybrid architecture enables real-time, skill-based multiplayer matchmaking using persistent player profiles, adaptive decisioning, and secure session orchestration.

---

## Purpose

This project demonstrates how to build an **intelligent matchmaking engine** that:
- Adapts in real-time to player skill, latency, and behavioral metadata
- Creates and manages multiplayer sessions securely using EOS
- Leverages **PubNub’s low-latency data transport** and **Illuminate's streaming analytics** for adaptive match optimization

The outcome: **fairer matches, lower churn, and higher retention** — all without sacrificing speed or developer control.

---

## Key Features

- Real-Time Player Metadata Syncing with [PubNub App Context](https://www.pubnub.com/docs/general/metadata/basics)
Store and update structured player attributes such as ELO, latency, play style, input device, and toxicity. These profiles drive matchmaking logic and are continuously updated after each game.
- Live Decision Analytics via [PubNub Illuminate](https://www.pubnub.com/products/illuminate/)
Illuminate is used to stream real-time metrics after each match — including ELO gap, latency fairness, completion rate, and behavioral flags. These insights help evolve your matchmaking model without changing the server code.
- Trusted Multiplayer Session Management with EOS SDK
Matchmaking sessions are securely managed via Epic Online Services, with the full lifecycle handled server-side through a lightweight C++ API:
  - POST /matchmaking: Initializes and creates a new session using [EOS_Sessions_CreateSessionModification](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-create-session-modification), with a custom bucket ID, player count, and session name.
  - POST /session/start/:id: Starts the session via [EOS_Sessions_StartSession](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-start-session), making it ready for gameplay once both users are confirmed.
  - DELETE /session/:id: Cleans up resources using [EOS_Sessions_DestroySession](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-destroy-session), ensuring no lingering sessions or stale metadata.
The server also continuously ticks the EOS platform loop, using a platform-agnostic event loop (with native CoreFoundation support on macOS) to process real-time EOS events and callbacks.
- Low-latency PubNub Messaging for Matchmaking Triggers
Messages like "join_queue" and "match_found" are published instantly to PubNub channels, allowing clients to enter matchmaking, receive updates, and connect to game lobbies in real time.
- C++20 Architecture with Crow and Boost.JSON
The server is built with the modern C++20 standard, using Crow for HTTP routing and Boost.JSON for lightweight and fast JSON parsing. This makes it ideal for performance-sensitive environments where you want low overhead and high control.

---

## Stack Overview

| Layer              | Technology                  | Purpose |
|-------------------|-----------------------------|---------|
| Transport Layer    | `PubNub Core SDK`            | Real-time messaging |
| Data Layer         | `PubNub App Context`         | Persistent metadata for players |
| Analytics Layer    | `PubNub Illuminate`          | Metric tracking & decision logic |
| Session Backend    | `Epic Online Services SDK`   | Session lifecycle management |
| API Server         | `Crow C++ Web Framework`     | Lightweight HTTP interface |

---

## Quick Setup PubNub Server

This layer handles matchmaking triggers, player metadata, and real-time analytics.

1. Clone the Project
```bash
git clone https://github.com/PubNubDevelopers/player-matching-demo.git
cd player-matching-demo
```

2. Create a .env file for PubNub
```env
PUBLISH_KEY=your_pubnub_publish_key
SUBSCRIBE_KEY=your_pubnub_subscribe_key
```
You can get your PubNub keys by creating a free account at https://admin.pubnub.com/#/login

3. Install Node Dependencies
```bash
npm install
```

4. Build the JS Project
```bash
npm run build
```

5. Start the Server
```bash
npm run start
```

6. Run a Test to Publish Player Metadata (Optional)
```bash
npm run test-metadata
```

---

## Quick Setup EOS Server

This layer handles secure multiplayer session creation, starting, and destruction.

1. Install EOS SDK and Prerequisites

Ensure you have:
	•	EOS SDK downloaded and extracted
	•	Boost (brew install boost)
	•	Crow headers placed in /usr/local/include/crow

2. Create a .env File for EOS

```env
EOS_PRODUCT_ID=your_product_id
EOS_SANDBOX_ID=your_sandbox_id
EOS_DEPLOYMENT_ID=your_deployment_id
EOS_CLIENT_ID=your_client_id
EOS_CLIENT_SECRET=your_client_secret
EOS_SDK_PATH=/Users/markus.kohler/Desktop/EOS-SDK-41373641-v1.17.0/SDK
SERVER_PORT=8080
```

3. Export Environment Variables (macOS/Linux)

```bash
export $(grep -v '^#' .env | xargs)
```
⚠️ This step is required to make the .env values available to your C++ app.

4. Build the EOS API Server

```bash
g++ -std=c++20 eos_api.cpp -o eos_api \
  -I/opt/homebrew/include \
  -I/usr/local/include \
  -I/usr/local/include/crow \
  -I$EOS_SDK_PATH/Include \
  -L$EOS_SDK_PATH/Bin \
  -L/opt/homebrew/lib \
  -Wl,-rpath,$EOS_SDK_PATH/Bin \
  -Wl,-rpath,/opt/homebrew/lib \
  -lEOSSDK-Mac-Shipping \
  -lboost_json \
  -lboost_system \
  -lpthread \
  -framework CoreFoundation
```

5. Run the EOS Server

```bash
./eos_api
```

This will launch your local REST API on the port defined in SERVER_PORT.

---

## Architecture Overview

This project combines two coordinated layers:

### JavaScript (Orchestration Layer)
#### Uses the PubNub Core JavaScript SDK, App Context and PubNub Illuminate to:

Manage live player state like ELO, latency, region, input device, play style, and toxicity — stored in App Context.

  Example:
  ```JavaScript
  await pubnub.objects.setUUIDMetadata({
    uuid: player.id,
    data: {
      name: player.id,
      custom: {
        "elo": 1420,
        "region": "NA",
        "latency": 35,
        "playStyle": "aggressive",
        "toxicity": "low"
      }
    },
    include: { customFields: true }
  });
  ```

Publish matchmaking triggers to signal that a player wants to join the matchmaking queue. This is done using the PubnubSubsystem in Unreal Engine, sending messages to the shared "demo-matchmaking" channel.

  Example:
  ```cpp
    #include "MyGameMode.h"
    #include "PubnubSubsystem.h"
    #include "Kismet/GameplayStatics.h"

    void AMyGameMode::JoinMatchmakingQueue(FString PlayerId)
    {
        UGameInstance* GameInstance = UGameplayStatics::GetGameInstance(this);
        UPubnubSubsystem* PubnubSubsystem = GameInstance->GetSubsystem<UPubnubSubsystem>();

        PubnubSubsystem->SetUserID(PlayerId);

        FString Channel = "demo-matchmaking";
        FString Message = FString::Printf(TEXT("{\"status\":\"join_queue\", \"userId\":\"%s\"}"), *PlayerId);

        FPubnubPublishSettings Settings;
        Settings.CustomMessageType = "matchmaking-request";

        PubnubSubsystem->PublishMessage(Channel, Message, Settings);
    }
  ```

Send real-time session updates to players, including matched opponents and lobby IDs, using PubNub’s publish/subscribe system.

  Example:
  ```JavaScript
  pubnub.publish({
    channel: "user123",
    message: { status: "Matched", lobby: "game-lobby-user123-user456" }
  });
  ```

Record and update match results (e.g., ELO adjustments, toxicity changes, win streaks) and persist the updates back to App Context for future matchmaking decisions.

  Example:
  ```JavaScript
  await pubnub.objects.setUUIDMetadata({
    uuid: player.id,
    data: {
      name: player.id,
      custom: {
        elo: 1480,
        consecutiveWins: 3,
        playStyle: "aggressive"
      }
    },
    include: { customFields: true }
  });
  ```

Stream match metrics to PubNub Illuminate to evaluate performance, fairness, and behavior — all in real time, without needing to redeploy.

  Example:
  ```JavaScript
  await pubnub.publish({
    channel: "illuminate-ingest",
    message: {
      eloGap: 120,
      latency: 42,
      playStyle: "balanced",
      toxicityDetected: "low",
      completionRate: 98
    }
  });
  ```

#### Sends HTTP requests to a local EOS API server (written in C++) to:

- Create multiplayer sessions using the /matchmaking endpoint, which initializes EOS and creates a session via [EOS_Sessions_CreateSessionModification](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-create-session-modification).
- Start a session using the /session/start/:id route, which begins the match lifecycle by calling [EOS_Sessions_StartSession](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-start-session).
- Destroy sessions via /session/:id, which uses [EOS_Sessions_DestroySession](https://dev.epicgames.com/docs/en-US/api-ref/functions/eos-sessions-destroy-session) to clean up resources.

### C++ (EOS Session Layer)

Implements secure, server-side session control using the Epic Online Services SDK:
- Initializes EOS Platform & Sessions using credentials from the .env file and runs EOS_Platform_Tick() continuously to handle real-time EOS callbacks.
- API Routes Exposed via Crow:
- POST /matchmaking:
Accepts two players and creates a session with a unique session ID and custom bucket name.

Internally uses:
```cpp
EOS_Sessions_CreateSessionModification
EOS_Sessions_UpdateSession
```

- POST /session/start/:id:
Starts the EOS session after both players are ready.

Internally uses:
```cpp
EOS_Sessions_StartSession
```

- DELETE /session/:id:
Destroys the active session to free resources.

Internally uses:
```cpp
EOS_Sessions_DestroySession
```

- Multithreaded Tick Loop:
A dedicated thread runs the EOS event loop using either [CFRunLoopRunInMode](https://developer.apple.com/documentation/corefoundation/cfrunloopruninmode(_:_:_:)) (macOS) or a standard while(true) loop (Linux/Windows), keeping the platform active and responsive to session changes.



