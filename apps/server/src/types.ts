import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketSessionData,
} from "@quizgame/contracts";
import type { Server, Socket } from "socket.io";

// Re-export domain types from the room store module so that the rest of the
// server code can keep importing them from "./types" without coupling to the
// store implementation.
export type { StoredPlayer, StoredRoom } from "./roomStore";

// ── Typed socket.io ───────────────────────────────────────────────────────────

/**
 * socket.io's own `Server` and `Socket` accept any event name with any payload.
 * These aliases pin both to the protocol in `@quizgame/contracts`, so an event
 * handler can only emit events the client actually listens for, carrying the
 * payload the client expects to find. Use these two throughout the server —
 * a plain `Server`/`Socket` anywhere opts that file back out of the checking.
 *
 * The third generic (inter-server events) is unused: rooms live in this
 * process's memory, so there is nothing to say to another node.
 */
export type QuizServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketSessionData
>;

export type QuizSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketSessionData
>;
