import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";

import { registerRealtimeHandlers } from "./events";
import { roomStore } from "./store";

export {
  HOST_RECONNECT_GRACE_MS,
  MAX_NAME_LENGTH,
  MAX_OPTION_TEXT_LENGTH,
  MAX_PLAYERS_PER_ROOM,
  MAX_PROMPT_LENGTH,
  MAX_QUESTIONS,
  ROOM_CLEANUP_DELAY_MS,
} from "./constants";
export { isAnswerExactlyCorrect, releasePlayerSeat } from "./events";
export { checkRateLimit, rateLimits } from "./rateLimit";
export { createRoomCode, randomCode } from "./roomCode";
export {
  toGameSummary,
  toLeaderboard,
  toPlayers,
  toPublicQuestion,
  toSnapshot,
  withServerClock,
} from "./snapshots";
export type { StoredPlayer, StoredRoom } from "./types";
// ── Re-exports for testability ────────────────────────────────────────────────
export { isFiniteNumber, isString, normalizeQuestion, normalizeQuiz } from "./validation";

// ── Origin helpers ─────────────────────────────────────────────────────────────

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins && configuredOrigins.length > 0 ? configuredOrigins : true;
};

const allowedOrigins = parseAllowedOrigins();

// ── HTTP server ───────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

let io: Server;

const main = async () => {
  await app.register(cors, {
    origin: allowedOrigins,
  });

  app.get("/", async () => ({
    name: "QuizGame server",
    ok: true,
    endpoints: {
      health: "/health",
      socketIo: "/socket.io",
    },
  }));

  app.get("/health", async () => ({
    ok: true,
    rooms: roomStore.getRoomCount(),
    players: Array.from(roomStore.getAllRooms()).reduce((sum, room) => sum + room.players.size, 0),
  }));

  io = new Server(app.server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  registerRealtimeHandlers(io, app.log);

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
};

// Only start the server when executed directly (e.g. `tsx src/index.ts` in
// dev mode or `node dist/index.js`). Vitest sets `VITEST=true`, which prevents
// the server from binding to a port while tests import the module.
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  void main();
}
