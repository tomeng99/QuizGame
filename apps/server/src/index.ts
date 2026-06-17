import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";

import { registerRealtimeHandlers } from "./events";
import { rooms } from "./store";

// ── Re-exports for testability ────────────────────────────────────────────────
export { normalizeQuestion, normalizeQuiz, isString, isFiniteNumber } from "./validation";
export { checkRateLimit, rateLimits } from "./rateLimit";
export { randomCode, createRoomCode } from "./roomCode";
export { toLeaderboard, toPlayers, toSnapshot, toPublicQuestion } from "./snapshots";
export {
  MAX_PLAYERS_PER_ROOM,
  MAX_QUESTIONS,
  MAX_PROMPT_LENGTH,
  MAX_OPTION_TEXT_LENGTH,
  MAX_NAME_LENGTH,
  HOST_RECONNECT_GRACE_MS,
  ROOM_CLEANUP_DELAY_MS,
} from "./constants";
export type { StoredPlayer, StoredRoom } from "./types";

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
    rooms: rooms.size,
    players: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.size, 0),
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

void main();
