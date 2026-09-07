import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { releasePlayerSeat } from "../index";
import { roomStore, tokenStore } from "../store";
import type { StoredRoom } from "../types";
import { makePlayer, makeRoom } from "./helpers";

/** Only the logger method the helper calls. */
const makeLog = () => ({ info: vi.fn() }) as unknown as FastifyBaseLogger;

/**
 * Minimal stand-in for the socket.io Server: the helper only broadcasts to a
 * room channel. `emitted` records what each channel was sent so tests can assert
 * the remaining players are told the seat is gone.
 */
const makeIo = () => {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
  } as unknown as Server;
  return { io, emitted };
};

/** Minimal stand-in for a connected socket that is already seated in a room. */
const makeSocket = (data: Record<string, unknown>, id = "socket-1") => {
  const left: string[] = [];
  const socket = {
    id,
    data,
    leave: (room: string) => {
      left.push(room);
    },
  } as unknown as Socket;
  return { socket, left, data };
};

/** Registers a room in the shared store the way the event handlers do. */
const store = (room: StoredRoom) => {
  roomStore.setRoom(room.code, room);
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
  for (const room of Array.from(roomStore.getAllRooms())) {
    roomStore.deleteRoom(room.code);
  }
});

describe("releasePlayerSeat", () => {
  it("removes the player record from the room the socket was seated in", () => {
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    const room = store(makeRoom({ code: "SEAT01", players: [player] }));
    const { socket } = makeSocket({ roomCode: "SEAT01", role: "player", playerId: "p1" });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    expect(room.players.has("p1")).toBe(false);
    expect(room.players.size).toBe(0);
  });

  it("frees the seat against the room's player cap for someone else to take", () => {
    // The abuse this closes: one connection joining repeatedly used to seat a new
    // player every time and orphan the previous one, consuming the room's capacity.
    const staying = makePlayer({ id: "p1", name: "Alice", socketId: "socket-9" });
    const leaving = makePlayer({ id: "p2", name: "Bob", socketId: "socket-1" });
    const room = store(makeRoom({ code: "SEAT02", players: [staying, leaving] }));
    const { socket } = makeSocket({ roomCode: "SEAT02", role: "player", playerId: "p2" });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    expect(Array.from(room.players.values()).map((p) => p.name)).toEqual(["Alice"]);
  });

  it("leaves no player behind that would stall the early-advance check", () => {
    // Every remaining player must be a real, reachable one: the round-closes-early
    // check waits on every player flagged `connected`, so an abandoned record that
    // never answers holds the round open until the timer expires.
    const present = makePlayer({ id: "p1", socketId: "socket-9", connected: true });
    const abandoned = makePlayer({ id: "p2", socketId: "socket-1", connected: true });
    const room = store(makeRoom({ code: "SEAT03", players: [present, abandoned] }));
    const { socket } = makeSocket({ roomCode: "SEAT03", role: "player", playerId: "p2" });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    const waitedOn = Array.from(room.players.values()).filter((p) => p.connected);
    expect(waitedOn.map((p) => p.socketId)).toEqual(["socket-9"]);
  });

  it("deletes the released player's reconnect token", () => {
    const player = makePlayer({ id: "p1", reconnectToken: "released-token", socketId: "socket-1" });
    store(makeRoom({ code: "SEAT04", players: [player] }));
    const { socket } = makeSocket({ roomCode: "SEAT04", role: "player", playerId: "p1" });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    // Otherwise the vacated seat could be reclaimed by "player:reconnect".
    expect(tokenStore.getToken("released-token")).toBeUndefined();
  });

  it("clears the socket's seat data so the disconnect handler cannot remove it twice", () => {
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    store(makeRoom({ code: "SEAT05", players: [player] }));
    const { socket, data } = makeSocket({
      roomCode: "SEAT05",
      role: "player",
      token: "player-1-token",
      playerId: "p1",
    });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    expect(data).toEqual({
      roomCode: undefined,
      role: undefined,
      token: undefined,
      playerId: undefined,
    });
  });

  it("takes the socket out of the room's broadcast channel", () => {
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    store(makeRoom({ code: "SEAT06", players: [player] }));
    const { socket, left } = makeSocket({ roomCode: "SEAT06", role: "player", playerId: "p1" });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    // A socket left in the channel keeps receiving the old room's questions.
    expect(left).toEqual(["SEAT06"]);
  });

  it("tells the rest of the room the player list changed", () => {
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    store(makeRoom({ code: "SEAT07", players: [player] }));
    const { socket } = makeSocket({ roomCode: "SEAT07", role: "player", playerId: "p1" });
    const { io, emitted } = makeIo();

    releasePlayerSeat(io, makeLog(), socket);

    expect(emitted.map((e) => ({ room: e.room, event: e.event }))).toEqual([
      { room: "SEAT07", event: "room:update" },
    ]);
  });

  it("also re-sends the answer count while a question is live", () => {
    const answered = makePlayer({
      id: "p1",
      socketId: "socket-9",
      lastAnsweredQuestionId: "question-1",
    });
    const leaving = makePlayer({ id: "p2", socketId: "socket-1" });
    store(
      makeRoom({
        code: "SEAT08",
        status: "question",
        currentQuestionIndex: 0,
        players: [answered, leaving],
      }),
    );
    const { socket } = makeSocket({ roomCode: "SEAT08", role: "player", playerId: "p2" });
    const { io, emitted } = makeIo();

    releasePlayerSeat(io, makeLog(), socket);

    // The tally counts seats, so leaving mid-question makes "1 of 2" stale.
    expect(emitted.find((e) => e.event === "room:answer-count")?.payload).toEqual({
      answeredCount: 1,
      totalPlayers: 1,
    });
  });

  it("does not re-send the answer count outside a live question", () => {
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    store(makeRoom({ code: "SEAT09", status: "lobby", players: [player] }));
    const { socket } = makeSocket({ roomCode: "SEAT09", role: "player", playerId: "p1" });
    const { io, emitted } = makeIo();

    releasePlayerSeat(io, makeLog(), socket);

    expect(emitted.some((e) => e.event === "room:answer-count")).toBe(false);
  });

  it("leaves a host socket's room untouched", () => {
    // A host abandoning a room needs the room torn down, not a seat freed.
    const player = makePlayer({ id: "p1", socketId: "socket-9" });
    const room = store(makeRoom({ code: "SEAT10", players: [player] }));
    const { socket, left } = makeSocket({
      roomCode: "SEAT10",
      role: "host",
      playerId: "host-1",
    });

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    expect(roomStore.hasRoom("SEAT10")).toBe(true);
    expect(room.players.size).toBe(1);
    expect(left).toEqual([]);
  });

  it("is a no-op for a socket that holds no seat", () => {
    const room = store(makeRoom({ code: "SEAT11", players: [makePlayer({ id: "p1" })] }));
    const { socket, left } = makeSocket({});

    expect(() => releasePlayerSeat(makeIo().io, makeLog(), socket)).not.toThrow();
    expect(room.players.size).toBe(1);
    expect(left).toEqual([]);
  });

  it("does not evict a player another socket has since reclaimed", () => {
    // The player dropped and reconnected on a new socket; this stale one must not
    // take the live session's seat away.
    const player = makePlayer({ id: "p1", reconnectToken: "live-token", socketId: "socket-2" });
    const room = store(makeRoom({ code: "SEAT12", players: [player] }));
    const { socket } = makeSocket(
      { roomCode: "SEAT12", role: "player", playerId: "p1" },
      "socket-1",
    );

    releasePlayerSeat(makeIo().io, makeLog(), socket);

    expect(room.players.has("p1")).toBe(true);
    expect(tokenStore.getToken("live-token")).toBeDefined();
  });

  it("survives the room having already been deleted", () => {
    const { socket } = makeSocket({ roomCode: "GONE01", role: "player", playerId: "p1" });

    expect(() => releasePlayerSeat(makeIo().io, makeLog(), socket)).not.toThrow();
  });
});
