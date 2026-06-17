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
- `.github/workflows/deploy.yml` deploys both branches to the same VPS, using `<APP_DIR>/prod` for `main` and `<APP_DIR>/dev` for `dev`.
- The client expects `EXPO_PUBLIC_API_URL` during deployment, and the workflow builds separate branch-tagged GHCR images for client and server.
- Deploys use commit-SHA image tags automatically, so each release points to an immutable image version without manual version bumping.

### Deploy secrets

VPS credentials (shared — same server for prod and dev):

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` _(optional, defaults to 22)_
- `APP_DIR` _(base directory, e.g. `quizgame`; pipeline appends `/prod` or `/dev`)_

Per-environment secrets (values differ between prod and dev):

- `PROD_WEB_HTTP_PORT` / `DEV_WEB_HTTP_PORT`
- `PROD_SERVER_HTTP_PORT` / `DEV_SERVER_HTTP_PORT`
- `PROD_ALLOWED_ORIGINS` / `DEV_ALLOWED_ORIGINS`
- `PROD_EXPO_PUBLIC_API_URL` / `DEV_EXPO_PUBLIC_API_URL`

GHCR credentials (shared):

- `GHCR_USER`
- `GHCR_PAT`

### Host reverse proxy routing

When deploying behind a host-level Caddy reverse proxy (recommended), publish both containers on localhost-only ports and route backend paths directly to the backend service port:

```caddy
quiz.eng.software {
    encode gzip zstd

    @api path /api/*
    reverse_proxy @api 127.0.0.1:3001

    @socket path /socket.io/*
    reverse_proxy @socket 127.0.0.1:3001

    @uploads path /uploads/*
    reverse_proxy @uploads 127.0.0.1:3001

    @health path /health
    reverse_proxy @health 127.0.0.1:3001

    reverse_proxy 127.0.0.1:8080
}
```

Use `PROD_WEB_HTTP_PORT` / `DEV_WEB_HTTP_PORT` for the frontend port and `PROD_SERVER_HTTP_PORT` / `DEV_SERVER_HTTP_PORT` for the backend port.

The client container Caddy config serves Expo's hashed web bundles from `/_expo/static/*` with long-lived immutable caching, while the HTML app shell (`index.html` and SPA fallback routes) is served with `no-cache` headers so browsers revalidate on each visit and pick up new deploys quickly.
