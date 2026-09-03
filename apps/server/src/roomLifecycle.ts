import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import { ROOM_IDLE_TIMEOUT_MS, ROOM_SWEEP_INTERVAL_MS } from "./constants";
import { roomStore, tokenStore } from "./store";
import type { StoredRoom } from "./types";

// ── Activity tracking ─────────────────────────────────────────────────────────

/** Marks a room as still in use, so the sweep below leaves it alone. */
export const touchRoom = (room: StoredRoom, now = Date.now()) => {
  room.lastActivityAt = now;
};

// ── Deletion ──────────────────────────────────────────────────────────────────

/**
 * Removes a room along with every timer and token it owns.
 *
 * All three timers are cleared, not just the question timer: a room can be
 * deleted down one path while a timer scheduled by another is still pending, and
 * a pending timer keeps the whole StoredRoom — quiz, players and their answers —
 * reachable for as long as it runs. The store is only touched when it still holds
 * *this* room object, so a stale timer firing after the code was recycled cannot
 * delete an unrelated room that happens to share it.
 *
 * Safe to call more than once on the same room.
 */
export const deleteRoom = (log: FastifyBaseLogger, room: StoredRoom) => {
  for (const timer of [room.questionAutoTimer, room.hostCloseTimer, room.cleanupTimer]) {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
  room.questionAutoTimer = null;
  room.hostCloseTimer = null;
  room.cleanupTimer = null;

  tokenStore.deleteToken(room.hostToken);
  for (const player of room.players.values()) {
    tokenStore.deleteToken(player.reconnectToken);
  }

  if (roomStore.getRoom(room.code) === room) {
    roomStore.deleteRoom(room.code);
    log.info({ roomCode: room.code }, "room deleted");
  }
};

// ── Abandoned-room sweep ──────────────────────────────────────────────────────

/** Why a room was reaped. Drives both the log line and the message clients see. */
export type ReapReason = "orphaned" | "idle";

const REAP_MESSAGES: Record<ReapReason, string> = {
  orphaned: "The host is no longer connected. This room is now closed.",
  idle: "This room was closed after a long period of inactivity.",
};

/**
 * Deletes rooms that no longer have anyone driving them, and returns how many
 * were reaped.
 *
 * Two shapes of abandonment, neither covered by the existing timers:
 *
 *  - **orphaned** — the room's host socket is gone from this server, but no
 *    disconnect handler ever claimed the room. A host that goes back to the start
 *    screen and hosts again keeps the same socket, and `socket.data.roomCode`
 *    only remembers the newest room, so every earlier room is left with a dead
 *    `hostSocketId` that nothing will ever look at again.
 *  - **idle** — nothing has happened in the room for ROOM_IDLE_TIMEOUT_MS. Covers
 *    a host who walks away with the tab open, leaving a lobby, or a leaderboard
 *    that nothing auto-advances past, sitting in memory indefinitely.
 *
 * Rooms with a timer already counting down to their own deletion are skipped —
 * the host-reconnect grace period and the post-game cleanup both own their room
 * on a shorter fuse than this sweep.
 *
 * `io.sockets.sockets` is this process's socket map, which is the right check
 * while rooms live in this process's memory. A future multi-instance deployment
 * would need the adapter's view of connected sockets instead.
 */
export const sweepAbandonedRooms = (
  io: Server,
  log: FastifyBaseLogger,
  now = Date.now(),
): number => {
  const doomed: Array<{ room: StoredRoom; reason: ReapReason }> = [];

  for (const room of roomStore.getAllRooms()) {
    if (room.hostCloseTimer !== null || room.cleanupTimer !== null) {
      continue;
    }

    if (room.hostSocketId !== null && !io.sockets.sockets.has(room.hostSocketId)) {
      doomed.push({ room, reason: "orphaned" });
    } else if (now - room.lastActivityAt > ROOM_IDLE_TIMEOUT_MS) {
      doomed.push({ room, reason: "idle" });
    }
  }

  // Collected first, deleted after: deleteRoom mutates the store being iterated.
  for (const { room, reason } of doomed) {
    log.info({ roomCode: room.code, reason, players: room.players.size }, "reaping abandoned room");
    io.to(room.code).emit("room:closed", { message: REAP_MESSAGES[reason] });
    deleteRoom(log, room);
  }

  return doomed.length;
};

/**
 * Starts the periodic sweep. Unref'd so it never by itself keeps the process
 * alive. Returns the interval handle for callers that need to stop it.
 */
export const startRoomSweeper = (io: Server, log: FastifyBaseLogger) => {
  const interval = setInterval(() => {
    sweepAbandonedRooms(io, log);
  }, ROOM_SWEEP_INTERVAL_MS);

  interval.unref();

  return interval;
};
