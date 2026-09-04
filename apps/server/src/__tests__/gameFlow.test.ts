import type { PublicQuestion, RoomRejoinedPayload, RoomSnapshot } from "@quizgame/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOST_RECONNECT_GRACE_MS, MAX_PLAYERS_PER_ROOM, ROOM_CLEANUP_DELAY_MS } from "../index";
import { makeMultipleChoiceQuiz } from "./helpers";
import { createHarness, resetServerState, seedTokenEntry } from "./socketHarness";

/**
 * The room state machine: who is allowed to drive a game forward, which
 * transitions are legal, and what happens when a socket drops. All of it lives
 * in the realtime handlers, so these tests exercise it the way clients do.
 */

beforeEach(() => {
  vi.useFakeTimers();
  resetServerState();
});

afterEach(() => {
  resetServerState();
  vi.useRealTimers();
});

// ── Room creation ─────────────────────────────────────────────────────────────

describe("host:create-room", () => {
  it("opens a room in the lobby and hands the host its credentials", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(3), "Quizmaster");

    const room = harness.room(host.roomCode);
    expect(room.status).toBe("lobby");
    expect(room.hostSocketId).toBe(host.socket.id);
    expect(host.socket.joined.has(host.roomCode)).toBe(true);

    const joined = host.socket.lastReceived<{ room: RoomSnapshot }>("room:joined");
    expect(joined?.room).toMatchObject({
      hostName: "Quizmaster",
      status: "lobby",
      totalQuestions: 3,
      players: [],
    });
  });

  it("keeps the host token out of the room snapshot", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());

    const joined = host.socket.lastReceived<{ room: RoomSnapshot }>("room:joined");
    expect(JSON.stringify(joined?.room)).not.toContain(host.hostToken);
  });

  it("refuses a quiz with no usable questions", () => {
    const harness = createHarness();
    const socket = harness.connect();

    socket.send("host:create-room", {
      hostName: "Host",
      quiz: { title: "Empty", timeLimit: 30, questions: [] },
    });

    expect(socket.lastError()).toBe("Add at least one valid question before hosting.");
    expect(socket.received("room:joined")).toHaveLength(0);
  });

  it("refuses a blank host name", () => {
    const harness = createHarness();
    const socket = harness.connect();

    socket.send("host:create-room", { hostName: "   ", quiz: makeMultipleChoiceQuiz() });

    expect(socket.lastError()).toBe("Host name is required.");
  });
});

// ── Joining ───────────────────────────────────────────────────────────────────

describe("player:join-room", () => {
  it("adds the player to the room and tells everyone", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.io.clear();

    const alice = harness.joinPlayer(host.roomCode, "Alice");

    expect(harness.room(host.roomCode).players.size).toBe(1);
    expect(alice.socket.joined.has(host.roomCode)).toBe(true);

    const update = harness.io.lastBroadcast<RoomSnapshot>(host.roomCode, "room:update");
    expect(update?.players).toEqual([
      { id: alice.playerId, name: "Alice", score: 0, connected: true },
    ]);
  });

  it("keeps the player's reconnect token out of the broadcast snapshot", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");

    const update = harness.io.lastBroadcast<RoomSnapshot>(host.roomCode, "room:update");
    expect(JSON.stringify(update)).not.toContain(alice.reconnectToken);
  });

  it("rejects a duplicate name regardless of casing", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    const second = harness.connect();
    second.send("player:join-room", { roomCode: host.roomCode, name: "ALICE" });

    expect(second.lastError()).toBe("That player name is already taken in this room.");
    expect(harness.room(host.roomCode).players.size).toBe(1);
  });

  it("rejects an unknown room code", () => {
    const harness = createHarness();
    const socket = harness.connect();

    socket.send("player:join-room", { roomCode: "ZZZZZZ", name: "Alice" });

    expect(socket.lastError()).toBe("Room not found. Check the code and try again.");
  });

  it("rejects a join once the game is under way", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);

    const latecomer = harness.connect();
    latecomer.send("player:join-room", { roomCode: host.roomCode, name: "Bob" });
    expect(latecomer.lastError()).toBe("This quiz has already started.");

    latecomer.clear();
    latecomer.send("player:check-room", { roomCode: host.roomCode });
    expect(latecomer.lastError()).toBe("This quiz has already started.");
  });

  it("turns players away once the room is full", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());

    for (let index = 0; index < MAX_PLAYERS_PER_ROOM; index += 1) {
      harness.joinPlayer(host.roomCode, `Player ${index}`);
    }

    const overflow = harness.connect();
    overflow.send("player:join-room", { roomCode: host.roomCode, name: "One Too Many" });

    expect(overflow.lastError()).toBe("This room is full.");
    expect(harness.room(host.roomCode).players.size).toBe(MAX_PLAYERS_PER_ROOM);
  });
});

// ── Host authorisation ────────────────────────────────────────────────────────

describe("host-only controls", () => {
  /** A started game plus a player socket that is not the host. */
  const setup = () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(3));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    return { harness, host, alice };
  };

  it("does not let a player start someone else's game", () => {
    const { harness, host, alice } = setup();

    alice.socket.send("host:start-game", host.roomCode);

    expect(alice.socket.lastError()).toBe("Only the host can start the game.");
    expect(harness.room(host.roomCode).status).toBe("lobby");
  });

  it("does not let a player force the leaderboard open", () => {
    const { harness, host, alice } = setup();
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.clear();
    alice.socket.send("host:show-leaderboard", host.roomCode);

    expect(alice.socket.lastError()).toBe("Only the host can reveal the leaderboard.");
    expect(harness.room(host.roomCode).status).toBe("question");
  });

  it("does not let a player skip the room to the next question", () => {
    const { harness, host, alice } = setup();
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.clear();
    alice.socket.send("host:next-question", host.roomCode);

    expect(alice.socket.lastError()).toBe("Only the host can advance the game.");
    expect(harness.room(host.roomCode).currentQuestionIndex).toBe(0);
  });

  it("does not let a host drive a room they do not own", () => {
    const harness = createHarness();
    const first = harness.hostRoom(makeMultipleChoiceQuiz());
    const second = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(second.roomCode, "Alice");

    // The host of the first room aims a control event at the second room.
    first.socket.send("host:start-game", second.roomCode);

    expect(first.socket.lastError()).toBe("Only the host can start the game.");
    expect(harness.room(second.roomCode).status).toBe("lobby");
  });
});

// ── Progression ───────────────────────────────────────────────────────────────

describe("game progression", () => {
  it("refuses to start a game nobody has joined", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());

    host.socket.send("host:start-game", host.roomCode);

    expect(host.socket.lastError()).toBe("At least one player must join before starting.");
    expect(harness.room(host.roomCode).status).toBe("lobby");
  });

  it("refuses to start a game twice", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(2));
    harness.joinPlayer(host.roomCode, "Alice");

    host.socket.send("host:start-game", host.roomCode);
    host.socket.clear();
    host.socket.send("host:start-game", host.roomCode);

    expect(host.socket.lastError()).toBe("The game has already started.");
    expect(harness.room(host.roomCode).currentQuestionIndex).toBe(0);
  });

  it("walks lobby → question → leaderboard → question → finished", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(2));
    harness.joinPlayer(host.roomCode, "Alice");
    const room = harness.room(host.roomCode);

    expect(room.status).toBe("lobby");

    host.socket.send("host:start-game", host.roomCode);
    expect(room.status).toBe("question");
    expect(room.currentQuestionIndex).toBe(0);

    host.socket.send("host:show-leaderboard", host.roomCode);
    expect(room.status).toBe("leaderboard");

    host.socket.send("host:next-question", host.roomCode);
    expect(room.status).toBe("question");
    expect(room.currentQuestionIndex).toBe(1);

    host.socket.send("host:next-question", host.roomCode);
    expect(room.status).toBe("finished");
    expect(room.currentQuestionIndex).toBeNull();
    expect(harness.io.broadcastsTo(host.roomCode, "game:finished")).toHaveLength(1);
  });

  it("refuses to advance a game that has not started", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    host.socket.send("host:next-question", host.roomCode);

    expect(host.socket.lastError()).toBe("Start the game before moving to the next question.");
  });

  it("refuses to restart a finished game", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);
    host.socket.send("host:next-question", host.roomCode);
    expect(harness.room(host.roomCode).status).toBe("finished");

    host.socket.clear();
    host.socket.send("host:next-question", host.roomCode);

    expect(host.socket.lastError()).toBe("The game has already finished.");
    expect(harness.room(host.roomCode).status).toBe("finished");
  });

  it("refuses to score a round when no question is open", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(2));
    harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);
    host.socket.send("host:show-leaderboard", host.roomCode);

    host.socket.clear();
    host.socket.send("host:show-leaderboard", host.roomCode);

    expect(host.socket.lastError()).toBe("There is no active question to score.");
  });
});

// ── Round timing ──────────────────────────────────────────────────────────────

describe("round timing", () => {
  const startGame = (timeLimit = 30) => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(2, timeLimit));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    const bob = harness.joinPlayer(host.roomCode, "Bob");
    host.socket.send("host:start-game", host.roomCode);
    return { harness, host, alice, bob };
  };

  it("closes the round automatically when the time limit expires", () => {
    const { harness, host } = startGame();

    expect(harness.room(host.roomCode).status).toBe("question");

    vi.advanceTimersByTime(30_000);

    expect(harness.room(host.roomCode).status).toBe("leaderboard");
    expect(harness.io.broadcastsTo(host.roomCode, "leaderboard:update")).toHaveLength(1);
  });

  it("closes the round early once every connected player has answered", () => {
    const { harness, host, alice, bob } = startGame();

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "multiple-choice",
      optionId: "q1-o2",
    });
    expect(harness.room(host.roomCode).status).toBe("question");

    bob.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "multiple-choice",
      optionId: "q1-o1",
    });

    expect(harness.room(host.roomCode).status).toBe("leaderboard");
  });

  it("does not wait on a player who has dropped out", () => {
    const { harness, host, alice, bob } = startGame();

    bob.socket.send("disconnect");

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "multiple-choice",
      optionId: "q1-o2",
    });

    expect(harness.room(host.roomCode).status).toBe("leaderboard");
  });

  it("does not fire the auto-close a second time after a manual reveal", () => {
    const { harness, host } = startGame();

    host.socket.send("host:show-leaderboard", host.roomCode);
    vi.advanceTimersByTime(60_000);

    expect(harness.io.broadcastsTo(host.roomCode, "leaderboard:update")).toHaveLength(1);
  });

  it("cancels the previous round's timer when the host skips ahead", () => {
    const { harness, host } = startGame();

    // 20 s into question 1, the host skips to question 2. Question 1's timer was
    // due at 30 s; if it survived it would close question 2 only 10 s in.
    vi.advanceTimersByTime(20_000);
    host.socket.send("host:next-question", host.roomCode);
    expect(harness.room(host.roomCode).currentQuestionIndex).toBe(1);

    vi.advanceTimersByTime(10_000);
    expect(harness.room(host.roomCode).status).toBe("question");
    expect(harness.io.broadcastsTo(host.roomCode, "leaderboard:update")).toHaveLength(0);

    // Question 2's own deadline, a full time limit after it started.
    vi.advanceTimersByTime(20_000);
    expect(harness.room(host.roomCode).status).toBe("leaderboard");
  });

  it("keeps the correct answer off the wire until the round closes", () => {
    const { harness, host } = startGame();

    const started = harness.io.lastBroadcast<PublicQuestion>(host.roomCode, "question:started");
    expect(started).toBeDefined();
    // The option ids themselves are public — players click them. What must not
    // ship is the field naming which one is right.
    expect(started as unknown as Record<string, unknown>).not.toHaveProperty("correctOptionId");
    expect(harness.io.broadcastsTo(host.roomCode, "question:revealed")).toHaveLength(0);

    host.socket.send("host:show-leaderboard", host.roomCode);

    expect(harness.io.lastBroadcast(host.roomCode, "question:revealed")).toEqual({
      type: "multiple-choice",
      correctOptionId: "q1-o2",
    });
  });
});

// ── Reconnect ─────────────────────────────────────────────────────────────────

describe("reconnect", () => {
  it("restores a player's session and score on a fresh socket", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(2));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    harness.joinPlayer(host.roomCode, "Bob");
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "multiple-choice",
      optionId: "q1-o2",
    });
    alice.socket.send("disconnect");
    expect(harness.room(host.roomCode).players.get(alice.playerId)?.connected).toBe(false);

    const revived = harness.connect();
    revived.send("player:reconnect", { token: alice.reconnectToken });

    const rejoined = revived.lastReceived<RoomRejoinedPayload>("room:rejoined");
    expect(rejoined?.isHost).toBe(false);
    expect(rejoined?.playerId).toBe(alice.playerId);
    expect(
      rejoined?.room.leaderboard.find((entry) => entry.playerId === alice.playerId),
    ).toMatchObject({ name: "Alice", score: 1000 });
    expect(harness.room(host.roomCode).players.get(alice.playerId)?.connected).toBe(true);
  });

  it("hands a reconnecting player the original deadline, not a fresh countdown", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(1, 30));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    harness.joinPlayer(host.roomCode, "Bob");

    const startedAt = Date.now();
    host.socket.send("host:start-game", host.roomCode);

    vi.advanceTimersByTime(10_000);
    alice.socket.send("disconnect");
    const revived = harness.connect();
    revived.send("player:reconnect", { token: alice.reconnectToken });

    const rejoined = revived.lastReceived<RoomRejoinedPayload>("room:rejoined");
    // Two thirds of the round is left, not a whole new 30 s.
    expect(rejoined?.currentQuestion?.endsAt).toBe(startedAt + 30_000);
    expect(rejoined?.currentQuestion?.serverNow).toBe(startedAt + 10_000);
  });

  it("rejects an unknown reconnect token", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    const socket = harness.connect();
    socket.send("player:reconnect", { token: "not-a-real-token" });

    expect(socket.lastError()).toBe("Session not found. Please re-join the room.");
    expect(socket.received("room:rejoined")).toHaveLength(0);
  });

  it("will not let a host token claim a player session", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    const socket = harness.connect();
    socket.send("player:reconnect", { token: host.hostToken });

    expect(socket.lastError()).toBe("Session not found. Please re-join the room.");
    expect(socket.received("room:rejoined")).toHaveLength(0);
  });

  it("rejects a player token entry that disagrees with the player's own record", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");

    // An entry that points at Alice while Alice's record holds a different
    // token — what a stale or reissued entry would leave behind.
    seedTokenEntry("stale-player-token", {
      roomCode: host.roomCode,
      role: "player",
      playerId: alice.playerId,
    });

    const socket = harness.connect();
    socket.send("player:reconnect", { token: "stale-player-token" });

    expect(socket.lastError()).toBe("Player not found. Please re-join the room.");
    expect(socket.received("room:rejoined")).toHaveLength(0);
  });

  it("rejects a host token entry that disagrees with the room's own record", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());

    seedTokenEntry("stale-host-token", { roomCode: host.roomCode, role: "host" });

    const socket = harness.connect();
    socket.send("host:reconnect", { token: "stale-host-token" });

    expect(socket.lastError()).toBe("Invalid host session.");
    expect(socket.received("room:rejoined")).toHaveLength(0);
    expect(harness.room(host.roomCode).hostSocketId).toBe(host.socket.id);
  });

  it("will not let a player token claim the host session", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");

    const socket = harness.connect();
    socket.send("host:reconnect", { token: alice.reconnectToken });

    expect(socket.lastError()).toBe("Host session not found. The room may have closed.");
    expect(socket.received("room:rejoined")).toHaveLength(0);
  });
});

// ── Disconnect and cleanup ────────────────────────────────────────────────────

describe("host disconnect", () => {
  it("closes and deletes the room once the grace period expires", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    host.socket.send("disconnect");
    expect(harness.room(host.roomCode).hostSocketId).toBeNull();
    expect(harness.io.broadcastsTo(host.roomCode, "room:closed")).toHaveLength(0);

    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS);

    expect(harness.io.lastBroadcast(host.roomCode, "room:closed")).toEqual({
      message: "The host disconnected. This room is now closed.",
    });
    expect(harness.hasRoom(host.roomCode)).toBe(false);
  });

  it("keeps the room alive when the host reconnects inside the grace period", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    host.socket.send("disconnect");
    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS / 2);

    const revived = harness.connect();
    revived.send("host:reconnect", { token: host.hostToken });
    expect(revived.lastReceived<RoomRejoinedPayload>("room:rejoined")?.isHost).toBe(true);

    // Well past when the original close timer would have fired.
    vi.advanceTimersByTime(HOST_RECONNECT_GRACE_MS);

    expect(harness.hasRoom(host.roomCode)).toBe(true);
    expect(harness.room(host.roomCode).hostSocketId).toBe(revived.id);
    expect(harness.io.broadcastsTo(host.roomCode, "room:closed")).toHaveLength(0);
  });

  it("marks a dropped player as disconnected without removing them", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");

    alice.socket.send("disconnect");

    const player = harness.room(host.roomCode).players.get(alice.playerId);
    expect(player?.connected).toBe(false);
    expect(player?.name).toBe("Alice");
  });
});

describe("finished-room cleanup", () => {
  it("drops a finished room from memory after the cleanup delay", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz());
    harness.joinPlayer(host.roomCode, "Alice");

    host.socket.send("host:start-game", host.roomCode);
    host.socket.send("host:next-question", host.roomCode);
    expect(harness.room(host.roomCode).status).toBe("finished");

    vi.advanceTimersByTime(ROOM_CLEANUP_DELAY_MS);

    expect(harness.hasRoom(host.roomCode)).toBe(false);
  });
});
