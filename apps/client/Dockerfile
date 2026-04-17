FROM node:22-alpine AS builder

WORKDIR /app

ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN npm ci

COPY apps/client apps/client
COPY apps/server apps/server
COPY packages packages

RUN npm run build -w @quizgame/contracts && npm run export:web -w @quizgame/client

FROM caddy:2-alpine

COPY apps/client/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/client/dist /srv
