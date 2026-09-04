import type { QuizDraft } from "@quizgame/contracts";
import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import { registerRealtimeHandlers } from "../index";
import { rateLimits } from "../rateLimit";
// roomStore/tokenStore are imported from their own module rather than "../index":
// they are the process-wide state these tests have to reset between cases, not
// part of the surface under test.
import { roomStore, tokenStore } from "../store";
import type { TokenEntry } from "../tokenStore";
import type { StoredRoom } from "../types";

// ── Recording types ───────────────────────────────────────────────────────────

/** One emit captured on its way out of the server. */
export interface RecordedEmit {
  event: string;
  payload: unknown;
}

/** A room-wide broadcast, i.e. `io.to(room).emit(event, payload)`. */
export interface RecordedBroadcast extends RecordedEmit {
  room: string;
}

// ── Fake socket ───────────────────────────────────────────────────────────────

let nextSocketId = 0;

/**
 * Stands in for a socket.io `Socket` on both sides of the wire.
 *
 * The server sees the handful of members `events.ts` actually uses (`id`,
 * `data`, `on`, `emit`, `join`). A test drives the same socket from the client
 * side with `send`, which invokes the handler the server registered for that
 * event — exactly what socket.io does when a real client emits.
 */
export class FakeSocket {
  readonly id: string;
  /** Server-held per-connection state: roomCode, role, token, playerId. */
  readonly data: Record<string, unknown> = {};
  /** Everything the server emitted to this socket alone, in order. */
  readonly emits: RecordedEmit[] = [];
  /** Room names this socket has been joined to. */
  readonly joined = new Set<string>();

  private readonly handlers = new Map<string, (payload: unknown) => void>();

  constructor() {
    nextSocketId += 1;
    this.id = `socket-${nextSocketId}`;
  }

  // ── The socket.io surface events.ts relies on ──

  on(event: string, handler: (payload: unknown) => void) {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload?: unknown) {
    this.emits.push({ event, payload });
  }

  join(room: string) {
    this.joined.add(room);
  }

  // ── Client-side driving and assertions ──

  /** Emit `event` from this client, running the server's handler for it. */
  send(event: string, payload?: unknown) {
    const handler = this.handlers.get(event);
    if (!handler) throw new Error(`No server handler is registered for "${event}"`);
    handler(payload);
  }

  /** Every payload this socket received for `event`, oldest first. */
  received<T = unknown>(event: string): T[] {
    return this.emits.filter((entry) => entry.event === event).map((entry) => entry.payload as T);
  }

  /** The most recent payload for `event`, or undefined if it never arrived. */
  lastReceived<T = unknown>(event: string): T | undefined {
    return this.received<T>(event).at(-1);
  }

  /** Messages from every "error:message" this socket was sent. */
  errors(): string[] {
    return this.received<{ message: string }>("error:message").map((payload) => payload.message);
  }

  /** The message of the most recent "error:message", or undefined if there was none. */
  lastError(): string | undefined {
    return this.errors().at(-1);
  }

  /** Drop everything recorded so far, so an assertion can target one action. */
  clear() {
    this.emits.length = 0;
  }
}

// ── Fake server ───────────────────────────────────────────────────────────────

/** Stands in for the socket.io `Server`: captures broadcasts and hands out sockets. */
export class FakeIo {
  /** Every `io.to(room).emit(...)` the server made, in order. */
  readonly broadcasts: RecordedBroadcast[] = [];

  private connectionHandler: ((socket: FakeSocket) => void) | null = null;

  on(event: string, handler: (socket: FakeSocket) => void) {
    if (event === "connection") this.connectionHandler = handler;
  }

  to(room: string) {
    return {
      emit: (event: string, payload?: unknown) => {
        this.broadcasts.push({ room, event, payload });
      },
    };
  }

  /** Open a new connection, running the server's connection handler against it. */
  connect(): FakeSocket {
    if (!this.connectionHandler) throw new Error("registerRealtimeHandlers was never called");
    const socket = new FakeSocket();
    this.connectionHandler(socket);
    return socket;
  }

  /** Every payload broadcast to `room` for `event`, oldest first. */
  broadcastsTo<T = unknown>(room: string, event: string): T[] {
    return this.broadcasts
      .filter((entry) => entry.room === room && entry.event === event)
      .map((entry) => entry.payload as T);
  }

  /** The most recent payload broadcast to `room` for `event`. */
  lastBroadcast<T = unknown>(room: string, event: string): T | undefined {
    return this.broadcastsTo<T>(room, event).at(-1);
  }

  clear() {
    this.broadcasts.length = 0;
  }
}

// ── Logger ────────────────────────────────────────────────────────────────────

const noop = () => {};

/** A silent FastifyBaseLogger — the handlers log freely and tests do not care. */
const createSilentLogger = (): FastifyBaseLogger => {
  const logger = {
    level: "silent",
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    fatal: noop,
    trace: noop,
    silent: noop,
    child: () => logger,
  };

  return logger as unknown as FastifyBaseLogger;
};

// ── Harness ───────────────────────────────────────────────────────────────────

/** A host connection plus the identifiers `host:create-room` handed back. */
export interface HostHandle {
  socket: FakeSocket;
  roomCode: string;
  /** The host's secret reconnect credential. */
  hostToken: string;
  /** The host's public id. */
  hostId: string;
}

/** A player connection plus the identifiers `player:join-room` handed back. */
export interface PlayerHandle {
  socket: FakeSocket;
  playerId: string;
  /** This player's secret reconnect credential. */
  reconnectToken: string;
}

export interface Harness {
  io: FakeIo;
  /** Open a bare connection with no room attached. */
  connect(): FakeSocket;
  /** Create a room through the real `host:create-room` handler. */
  hostRoom(quiz: QuizDraft, hostName?: string): HostHandle;
  /** Join a player through the real `player:join-room` handler. */
  joinPlayer(roomCode: string, name: string): PlayerHandle;
  /** The stored room for `code`. Throws if it is gone, so assertions read cleanly. */
  room(code: string): StoredRoom;
  /** True while `code` is still in the room store. */
  hasRoom(code: string): boolean;
  /** The current score of `playerId`, read off the server's own state. */
  scoreOf(roomCode: string, playerId: string): number;
}

/**
 * Wipes the process-wide server state the handlers share. `roomStore`,
 * `tokenStore` and `rateLimits` are module singletons, so without this a room
 * or a spent rate-limit window would leak from one test into the next.
 */
export const resetServerState = () => {
  for (const room of Array.from(roomStore.getAllRooms())) {
    if (room.hostCloseTimer !== null) clearTimeout(room.hostCloseTimer);
    if (room.cleanupTimer !== null) clearTimeout(room.cleanupTimer);
    if (room.questionAutoTimer !== null) clearTimeout(room.questionAutoTimer);
    tokenStore.deleteToken(room.hostToken);
    for (const player of room.players.values()) tokenStore.deleteToken(player.reconnectToken);
    roomStore.deleteRoom(room.code);
  }
  rateLimits.clear();
};

/**
 * Writes a token entry straight into the store, bypassing the handlers.
 *
 * Only for building a token entry that disagrees with the room or player record
 * it points at. The reconnect handlers re-check every token against that record
 * precisely to reject such an entry, and no sequence of public events can
 * produce one — so this is the only way to hold that guard in place.
 */
export const seedTokenEntry = (token: string, entry: TokenEntry) => {
  tokenStore.setToken(token, entry);
};

/**
 * Registers the real realtime handlers against a fake io/logger pair and
 * returns helpers for driving a game through them. Every action below goes
 * through the production handlers — nothing reaches into the stores to set up
 * state that a real client could not produce.
 */
export const createHarness = (): Harness => {
  const io = new FakeIo();
  registerRealtimeHandlers(io as unknown as Server, createSilentLogger());

  const room = (code: string): StoredRoom => {
    const stored = roomStore.getRoom(code);
    if (!stored) throw new Error(`No room stored under "${code}"`);
    return stored;
  };

  return {
    io,

    connect: () => io.connect(),

    hostRoom: (quiz, hostName = "Host") => {
      const socket = io.connect();
      socket.send("host:create-room", { hostName, quiz });

      const joined = socket.lastReceived<{
        playerId: string;
        reconnectToken: string;
        room: { roomCode: string };
      }>("room:joined");

      if (!joined) throw new Error(`host:create-room failed: ${socket.lastError() ?? "no error"}`);

      return {
        socket,
        roomCode: joined.room.roomCode,
        hostToken: joined.reconnectToken,
        hostId: joined.playerId,
      };
    },

    joinPlayer: (roomCode, name) => {
      const socket = io.connect();
      socket.send("player:join-room", { roomCode, name });

      const joined = socket.lastReceived<{ playerId: string; reconnectToken: string }>(
        "room:joined",
      );

      if (!joined) throw new Error(`player:join-room failed: ${socket.lastError() ?? "no error"}`);

      return { socket, playerId: joined.playerId, reconnectToken: joined.reconnectToken };
    },

    room,

    hasRoom: (code) => roomStore.hasRoom(code),

    scoreOf: (roomCode, playerId) => {
      const player = room(roomCode).players.get(playerId);
      if (!player) throw new Error(`No player "${playerId}" in room "${roomCode}"`);
      return player.score;
    },
  };
};
