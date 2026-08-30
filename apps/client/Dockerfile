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

# Inject the Umami tracker into Expo's generated index.html. Expo owns that file
# (there is no checked-in template), so it is patched after export rather than
# replaced - a hand-written public/index.html would have to reproduce Expo's
# bundle tags and would silently break the app if those ever change.
# No UMAMI_WEBSITE_ID (e.g. the dev branch) means no tracking and no failure.
ARG UMAMI_WEBSITE_ID
ARG UMAMI_SCRIPT_URL=https://analytics.eng.software/script.js
RUN if [ -n "$UMAMI_WEBSITE_ID" ]; then \
      f=apps/client/dist/index.html; \
      if [ ! -f "$f" ]; then echo "FATAL: expo export produced no $f"; exit 1; fi; \
      sed -i "s#</head>#<script defer src=\"$UMAMI_SCRIPT_URL\" data-website-id=\"$UMAMI_WEBSITE_ID\"></script></head>#" "$f"; \
      if grep -q "$UMAMI_WEBSITE_ID" "$f"; then echo "umami: tracker injected into $f"; \
      else echo "umami: WARNING - no </head> in $f, tracker not injected"; fi; \
    fi

FROM caddy:2-alpine

COPY apps/client/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/apps/client/dist /srv
