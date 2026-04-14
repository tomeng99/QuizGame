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
- `.github/workflows/deploy.yml` deploys both branches, using **branch-specific secrets** so each branch can publish to its own hosted environment.
- The client expects `EXPO_PUBLIC_API_URL` during deployment, and the workflow builds separate branch-tagged GHCR images for client and server.

### Deploy secrets

Production (`main`) branch secrets:

- `PROD_VPS_HOST`
- `PROD_VPS_USER`
- `PROD_VPS_SSH_KEY`
- `PROD_VPS_PORT`
- `PROD_APP_DIR`
- `PROD_WEB_HTTP_PORT`
- `PROD_ALLOWED_ORIGINS`
- `PROD_EXPO_PUBLIC_API_URL`

Development (`dev`) branch secrets:

- `DEV_VPS_HOST`
- `DEV_VPS_USER`
- `DEV_VPS_SSH_KEY`
- `DEV_VPS_PORT`
- `DEV_APP_DIR`
- `DEV_WEB_HTTP_PORT`
- `DEV_ALLOWED_ORIGINS`
- `DEV_EXPO_PUBLIC_API_URL`

Shared secrets:

- `GHCR_USER`
- `GHCR_PAT`
