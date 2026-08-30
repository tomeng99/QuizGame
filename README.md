# QuizGame

Cross-platform live quiz app with one client codebase for **iOS, Android, and web** using **Expo + React Native**, plus a **Node.js + Socket.IO** backend for hosted realtime games.

## Workspace layout

- `apps/client` - Expo app for host and player flows
- `apps/server` - Fastify + Socket.IO backend
- `packages/contracts` - shared TypeScript types for quiz, room, and leaderboard data

## Architecture

QuizGame is a realtime client-server application. A **Fastify + Socket.IO** server (`apps/server`) hosts live quiz rooms and brokers socket events, while the **Expo + React Native** client (`apps/client`) drives both the host and player flows against a single codebase running on iOS, Android, and web. Typed request/response and payload shapes for rooms, quizzes, and leaderboards are shared across the wire via `packages/contracts`, so the client and server stay in sync at compile time.

### Socket event flow

Gameplay is driven entirely by Socket.IO events. The host acts as the game authority, and the server broadcasts state transitions to every player in the room.

| Event | Emitted by | Payload | Server action / response |
| --- | --- | --- | --- |
| `host:create-room` | Host | `{ hostName, quiz }` | Creates a room, returns a **host token** |
| `player:check-room` | Player | `{ roomCode }` | Returns room info (used to validate the code before joining) |
| `player:join-room` | Player | `{ roomCode, name }` | Joins the room, returns a **player token** + room snapshot |
| `host:start-game` | Host | `{ roomCode }` | Starts the game, broadcasts the first **question** to all players |
| `player:submit-answer` | Player | `{ roomCode, optionId }` | Records the answer, broadcasts the live **answer count** |
| `host:show-leaderboard` | Host | `{ roomCode }` | Broadcasts the **leaderboard** with current scores |
| `host:next-question` | Host | `{ roomCode }` | Broadcasts the next question, or **finishes the quiz** if none remain |
| `host:reconnect` / `player:reconnect` | Host / Player | `{ token }` | Rejoins an active room using the previously issued token |

### Room state machine

Each room moves through a fixed lifecycle:

```
lobby ──▶ question ──▶ leaderboard ──┐
   ▲                       │         │
   │                       ▼         ▼
   └────────────────── (next question) ──▶ finished
```

- **lobby** – Players join; host waits to start.
- **question** – A question is broadcast; players submit answers.
- **leaderboard** – Scores are shown after the host reveals results.
- **next question** – If questions remain, the room loops back to `question`.
- **finished** – No more questions; the quiz ends.

### State storage

Room state, quizzes, and player/host tokens are currently held **in process memory** on the server. This keeps the first version simple and easy to run, but means state is lost on restart and cannot be shared across multiple server instances. A future migration to **Redis** (or another shared store) is planned so rooms can survive restarts and scale horizontally.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the shared contracts and server:

   ```bash
   npm run build
   ```

3. Start the backend:

   ```bash
   npm run dev:server
   ```

4. Start the web app in another terminal:

   ```bash
   npm run dev:client
   ```

5. For mobile development with Expo Go instead of the web app:

   ```bash
   npm run dev:mobile
   ```

## Notes

- The current backend keeps quizzes and live room state **in memory** to get the first playable version running quickly.
- Players should only ever need a **room code** and **name**. Backend URLs are resolved automatically in development or injected by deployment config.
- `http://localhost:3001/` is the backend API root, and `http://localhost:3001/health` is the health check.
- `npm run dev:client` starts the **web app**. If you open Expo's raw Metro server on port `8081`, seeing JSON is normal.
- On a physical phone in Expo Go, the app derives the backend URL from the Expo host automatically. For hosted environments, set `EXPO_PUBLIC_API_URL` during the client build.

## Deployment

- `main` is the production branch.
- `dev` is the development/staging branch.
- `.github/workflows/deploy.yml` builds and pushes GHCR images for both branches on push. Each image is tagged with the commit SHA and a rolling `<branch>-latest` tag.
- The client expects `EXPO_PUBLIC_API_URL` during deployment, and the workflow builds separate branch-tagged GHCR images for client and server.
- Deploys use commit-SHA image tags automatically, so each release points to an immutable image version without manual version bumping.

### ArgoCD / OpenShift (GitOps)

Deployment is handled by the [operations repo](https://github.com/tomeng99/operations) via ArgoCD on OpenShift. The workflow:

1. Push to `main` or `dev` triggers this repo's Build and Deploy workflow, which builds and pushes images to GHCR.
2. Update the image tags in `apps/quizgame/<prod|dev>/deployments.yaml` in the operations repo to the new commit SHA.
3. ArgoCD detects the change and rolls out the new pods automatically.

### Secrets

Per-environment secrets (values differ between prod and dev):

- `PROD_EXPO_PUBLIC_API_URL` / `DEV_EXPO_PUBLIC_API_URL`

GHCR credentials are not needed in the workflow — it uses the built-in `GITHUB_TOKEN` for image pushes.
