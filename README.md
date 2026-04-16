# QuizGame

Cross-platform live quiz app with one client codebase for **iOS, Android, and web** using **Expo + React Native**, plus a **Node.js + Socket.IO** backend for hosted realtime games.

## Workspace layout

- `apps/client` - Expo app for host and player flows
- `apps/server` - Fastify + Socket.IO backend
- `packages/contracts` - shared TypeScript types for quiz, room, and leaderboard data

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
