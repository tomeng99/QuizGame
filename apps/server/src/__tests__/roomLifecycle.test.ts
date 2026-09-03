import type { FastifyBaseLogger } from "fastify";
import type { Server } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRoom } from "../index";
import {
  deleteRoom,
  ROOM_IDLE_TIMEOUT_MS,
  roomStore,
  sweepAbandonedRooms,
  tokenStore,
} from "../index";
import { makePlayer, makeRoom } from "./helpers";

const NOW = new Date("2025-01-01T12:00:00Z").getTime();

/** Only the two logger methods the lifecycle code calls. */
const makeLog = () => ({ info: vi.fn(), warn: vi.fn() }) as unknown as FastifyBaseLogger;

/**
 * Minimal stand-in for the socket.io Server: the sweep only needs the set of
 * connected socket ids and a room-scoped `emit`. `emitted` records what each
 * room channel was sent so tests can assert players are told the room closed.
 */
const makeIo = (connectedSocketIds: string[] = []) => {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const io = {
    sockets: { sockets: new Map(connectedSocketIds.map((id) => [id, {}])) },
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
  } as unknown as Server;
  return { io, emitted };
};

/** Registers a room in the shared store the way the event handlers do. */
const store = (room: StoredRoom) => {
  roomStore.setRoom(room.code, room);
  tokenStore.setToken(room.hostToken, { roomCode: room.code, role: "host" });
  for (const player of room.players.values()) {
    tokenStore.setToken(player.reconnectToken, {
      roomCode: room.code,
      role: "player",
      playerId: player.id,
    });
  }
  return room;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const room of Array.from(roomStore.getAllRooms())) {
    roomStore.deleteRoom(room.code);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("deleteRoom", () => {
  it("removes the room and every token it owns", () => {
    const player = makePlayer({ id: "p1", reconnectToken: "player-token" });
    const room = store(makeRoom({ code: "AAAAAA", hostToken: "host-token", players: [player] }));

    deleteRoom(makeLog(), room);

    expect(roomStore.hasRoom("AAAAAA")).toBe(false);
    expect(tokenStore.getToken("host-token")).toBeUndefined();
    expect(tokenStore.getToken("player-token")).toBeUndefined();
  });

  it("clears the cleanup and host-close timers, not just the question timer", () => {
    const room = store(
      makeRoom({
        code: "BBBBBB",
        questionAutoTimer: setTimeout(() => {}, 60_000),
        hostCloseTimer: setTimeout(() => {}, 60_000),
        cleanupTimer: setTimeout(() => {}, 60_000),
      }),
    );

    deleteRoom(makeLog(), room);

    // A timer left pending keeps the whole room object — quiz, players and their
    // answers — reachable for as long as it runs.
    expect(vi.getTimerCount()).toBe(0);
    expect(room.questionAutoTimer).toBeNull();
    expect(room.hostCloseTimer).toBeNull();
    expect(room.cleanupTimer).toBeNull();
  });

  it("is safe to call twice", () => {
    const room = store(makeRoom({ code: "CCCCCC" }));

    deleteRoom(makeLog(), room);
    expect(() => deleteRoom(makeLog(), room)).not.toThrow();
    expect(roomStore.hasRoom("CCCCCC")).toBe(false);
  });

  it("does not evict a different room that later reused the same code", () => {
    const original = store(makeRoom({ code: "DDDDDD", hostToken: "old-host-token" }));
    deleteRoom(makeLog(), original);

    const replacement = store(makeRoom({ code: "DDDDDD", hostToken: "new-host-token" }));

    // A stale timer firing after the code was recycled must not take the new room down.
    deleteRoom(makeLog(), original);

    expect(roomStore.getRoom("DDDDDD")).toBe(replacement);
  });
});

describe("sweepAbandonedRooms", () => {
  it("reaps a room whose host socket is no longer connected", () => {
    // The leak this closes: a host who returns to the start screen and hosts again
    // keeps the same socket, so socket.data.roomCode forgets the earlier room and
    // no disconnect handler ever claims it.
    store(makeRoom({ code: "ORPHAN", hostSocketId: "gone-socket" }));
    const { io, emitted } = makeIo(["live-socket"]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(1);
    expect(roomStore.hasRoom("ORPHAN")).toBe(false);
    expect(emitted).toContainEqual({
      room: "ORPHAN",
      event: "room:closed",
      payload: { message: "The host is no longer connected. This room is now closed." },
    });
  });

  it("keeps a room whose host socket is still connected", () => {
    store(makeRoom({ code: "ALIVE1", hostSocketId: "live-socket", lastActivityAt: NOW }));
    const { io } = makeIo(["live-socket"]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(0);
    expect(roomStore.hasRoom("ALIVE1")).toBe(true);
  });

  it("reaps a connected-but-idle room once past the idle timeout", () => {
    store(
      makeRoom({
        code: "IDLE01",
        hostSocketId: "live-socket",
        lastActivityAt: NOW - ROOM_IDLE_TIMEOUT_MS - 1,
      }),
    );
    const { io, emitted } = makeIo(["live-socket"]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(1);
    expect(roomStore.hasRoom("IDLE01")).toBe(false);
    expect(emitted[0]?.payload).toEqual({
      message: "This room was closed after a long period of inactivity.",
    });
  });

  it("keeps a connected room that is idle but inside the timeout", () => {
    store(
      makeRoom({
        code: "IDLE02",
        hostSocketId: "live-socket",
        lastActivityAt: NOW - ROOM_IDLE_TIMEOUT_MS + 1_000,
      }),
    );
    const { io } = makeIo(["live-socket"]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(0);
    expect(roomStore.hasRoom("IDLE02")).toBe(true);
  });

  it("leaves a room alone while the host-reconnect grace period owns it", () => {
    // hostSocketId is null during the grace period, which would otherwise read as idle.
    store(
      makeRoom({
        code: "GRACE1",
        hostSocketId: null,
        lastActivityAt: NOW - ROOM_IDLE_TIMEOUT_MS - 1,
        hostCloseTimer: setTimeout(() => {}, 60_000),
      }),
    );
    const { io } = makeIo([]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(0);
    expect(roomStore.hasRoom("GRACE1")).toBe(true);
  });

  it("leaves a finished room to its own post-game cleanup timer", () => {
    store(
      makeRoom({
        code: "DONE01",
        status: "finished",
        hostSocketId: "gone-socket",
        cleanupTimer: setTimeout(() => {}, 60_000),
      }),
    );
    const { io } = makeIo([]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(0);
    expect(roomStore.hasRoom("DONE01")).toBe(true);
  });

  it("reaps several rooms in one pass without skipping any", () => {
    // Guards the iterate-then-delete split: deleting inside the loop would mutate
    // the map being walked.
    store(makeRoom({ code: "MULTI1", hostSocketId: "gone-1" }));
    store(makeRoom({ code: "MULTI2", hostSocketId: "gone-2" }));
    store(makeRoom({ code: "MULTI3", hostSocketId: "gone-3" }));
    const { io } = makeIo([]);

    expect(sweepAbandonedRooms(io, makeLog(), NOW)).toBe(3);
    expect(roomStore.getRoomCount()).toBe(0);
  });

  it("releases the reconnect tokens of every player in a reaped room", () => {
    store(
      makeRoom({
        code: "TOKENS",
        hostSocketId: "gone-socket",
        hostToken: "reaped-host-token",
        players: [
          makePlayer({ id: "p1", reconnectToken: "reaped-p1" }),
          makePlayer({ id: "p2", reconnectToken: "reaped-p2" }),
        ],
      }),
    );
    const { io } = makeIo([]);

    sweepAbandonedRooms(io, makeLog(), NOW);

    expect(tokenStore.getToken("reaped-host-token")).toBeUndefined();
    expect(tokenStore.getToken("reaped-p1")).toBeUndefined();
    expect(tokenStore.getToken("reaped-p2")).toBeUndefined();
  });
});
