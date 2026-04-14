FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

COPY apps/server apps/server
COPY packages packages

RUN npm run build -w @quizgame/contracts && npm run build -w @quizgame/server

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist

WORKDIR /app/apps/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
