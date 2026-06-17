# Contributing to QuizGame

Thanks for your interest in contributing to QuizGame! This guide covers how to set
up the project, the branching and PR workflow, and the code style we follow.

## Development environment setup

QuizGame is a TypeScript monorepo managed with npm workspaces. It requires
**Node.js >= 22**.

```bash
# 1. Clone the repository
git clone https://github.com/tomeng99/QuizGame.git
cd QuizGame

# 2. Switch to the development branch
git checkout dev

# 3. Install dependencies (installs all workspaces)
npm install

# 4. Build shared packages and typecheck the whole project
npm run build

# 5. Start the backend (Fastify + Socket.IO)
npm run dev:server

# 6. In another terminal, start the client (Expo web)
npm run dev:client
```

Additional scripts:

- `npm run dev:web` — alias for `dev:client` (Expo web)
- `npm run dev:mobile` — start Expo for iOS/Android
- `npm run typecheck` — typecheck all workspaces (builds contracts first)
- `npm run check` — run `typecheck` followed by `build`

## Branching convention

- **`main`** is the production branch. Only stable, released code lives here.
- **`dev`** is the active development branch. All new work integrates here.
- **Feature branches** should branch from `dev` (not `main`) and be merged back
  into `dev` via pull request.

```bash
git checkout dev
git pull
git checkout -b feature/my-new-feature
```

## Pull request process

1. **Branch from `dev`** and target `dev` in your PR.
2. **Run typechecks before submitting:**
   ```bash
   npm run typecheck
   ```
3. **Describe your changes** clearly in the PR description. The repo provides a
   pull request template — fill in the Summary, Testing, and Notes sections.
4. **Keep PRs focused** — one logical change per PR makes review faster.
5. Make sure your code builds (`npm run build`) and passes typechecking.

## Code style

- **TypeScript everywhere.** All packages use TypeScript; avoid `any` and keep
  types explicit in public/shared APIs.
- **Shared types live in `packages/contracts`.** If a type is used by both the
  client and server, define it there so both sides stay in sync. Build contracts
  before working in client/server (`npm run build -w @quizgame/contracts`).
- Follow the existing formatting and naming conventions in each package.

## Project structure

```
.
├── apps/
│   ├── client/        # Expo + React Native client (web, iOS, Android)
│   └── server/        # Fastify + Socket.IO backend
├── packages/
│   └── contracts/     # Shared TypeScript types and contracts
├── .github/
│   ├── ISSUE_TEMPLATE/  # Issue templates (bug report, feature request)
│   └── pull_request_template.md
└── package.json        # Root workspace config and scripts
```

- **`apps/client`** — The cross-platform client built with Expo and React Native.
  Runs on web, iOS, and Android from a single codebase.
- **`apps/server`** — The backend API and real-time layer (Fastify + Socket.IO).
- **`packages/contracts`** — Shared TypeScript types used by both the client and
  server. This is the single source of truth for cross-package interfaces.

## Reporting bugs

Bugs are tracked via GitHub issue templates. To report a bug:

1. Go to the [Issues](https://github.com/tomeng99/QuizGame/issues/new/choose) tab.
2. Select the **Bug report** template.
3. Fill in the description, steps to reproduce, expected/actual behavior,
   platform, and browser/app version. Screenshots and additional context are
   welcome.

For new feature ideas, use the **Feature request** template instead.

---

Questions or ideas beyond a bug or feature request? Open a discussion or reach
out to the maintainers. Happy contributing!
