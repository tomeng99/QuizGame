import type { AnswerAcceptedPayload, QuestionRevealPayload } from "@quizgame/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMultipleChoiceQuiz, makeNumberQuiz, makePollQuiz, makeRankingQuiz } from "./helpers";
import { createHarness, type FakeSocket, resetServerState } from "./socketHarness";

/**
 * Scoring runs entirely inside the realtime handlers, so every test here drives
 * a real room: host creates it, players join, answers go in through
 * "player:submit-answer". The numbers asserted below are the ones a player sees
 * on screen — get them wrong and a live game silently pays out the wrong scores.
 */

beforeEach(() => {
  vi.useFakeTimers();
  resetServerState();
});

afterEach(() => {
  resetServerState();
  vi.useRealTimers();
});

// ── Multiple choice ───────────────────────────────────────────────────────────

describe("multiple-choice scoring", () => {
  /** Start a one-question game with a single player, ready to answer. */
  const startGame = (questionCount = 1, timeLimit = 30) => {
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(questionCount, timeLimit));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);
    return { harness, host, alice };
  };

  const answer = (socket: FakeSocket, roomCode: string, optionId: string) =>
    socket.send("player:submit-answer", { roomCode, type: "multiple-choice", optionId });

  const accepted = (socket: FakeSocket) =>
    socket.lastReceived<AnswerAcceptedPayload>("answer:accepted");

  it("awards the full 1000 points for an instant correct answer", () => {
    const { host, alice } = startGame();

    answer(alice.socket, host.roomCode, "q1-o2");

    expect(accepted(alice.socket)).toEqual({
      pending: false,
      isCorrect: true,
      pointsEarned: 1000,
      streak: 1,
    });
  });

  it("decays points linearly with elapsed time", () => {
    const { host, alice } = startGame();

    // Half of the 30 s limit gone: 1000 - 700 * 0.5.
    vi.advanceTimersByTime(15_000);
    answer(alice.socket, host.roomCode, "q1-o2");

    expect(accepted(alice.socket)?.pointsEarned).toBe(650);
  });

  it("never pays less than the 300-point floor, even past the deadline", () => {
    const { host, alice } = startGame();

    // Jump the clock past the deadline without running the auto-advance timer.
    // This is the state a delayed event loop lands in: the question is still
    // open, but more than timeLimit has elapsed since it started.
    vi.setSystemTime(Date.now() + 45_000);
    answer(alice.socket, host.roomCode, "q1-o2");

    expect(accepted(alice.socket)?.pointsEarned).toBe(300);
  });

  it("awards nothing for a wrong answer and reports it as incorrect", () => {
    const { harness, host, alice } = startGame();

    answer(alice.socket, host.roomCode, "q1-o1");

    expect(accepted(alice.socket)).toEqual({
      pending: false,
      isCorrect: false,
      pointsEarned: 0,
      streak: 0,
    });
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);
  });

  it("builds streak bonuses across consecutive correct answers", () => {
    const { host, alice } = startGame(5);
    const earned: number[] = [];

    for (let questionNumber = 1; questionNumber <= 5; questionNumber += 1) {
      if (questionNumber > 1) host.socket.send("host:next-question", host.roomCode);
      answer(alice.socket, host.roomCode, `q${questionNumber}-o2`);
      earned.push(accepted(alice.socket)?.pointsEarned ?? 0);
    }

    // Base 1000 each (answered instantly), plus the streak bonus for the streak
    // the answer just produced: none, none, +75, +150, +150, +300 at 5 in a row.
    expect(earned).toEqual([1000, 1075, 1150, 1150, 1300]);
  });

  it("resets the streak on a wrong answer", () => {
    const { host, alice } = startGame(3);

    answer(alice.socket, host.roomCode, "q1-o2");
    expect(accepted(alice.socket)?.streak).toBe(1);

    host.socket.send("host:next-question", host.roomCode);
    answer(alice.socket, host.roomCode, "q2-o1");
    expect(accepted(alice.socket)?.streak).toBe(0);

    // Back to a fresh streak of 1, so no bonus on top of the base points.
    host.socket.send("host:next-question", host.roomCode);
    answer(alice.socket, host.roomCode, "q3-o2");
    expect(accepted(alice.socket)).toMatchObject({ streak: 1, pointsEarned: 1000 });
  });

  it("rejects a second answer to the same question without paying twice", () => {
    // Two players, so the round stays open after the first one answers.
    const harness = createHarness();
    const host = harness.hostRoom(makeMultipleChoiceQuiz(1));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    harness.joinPlayer(host.roomCode, "Bob");
    host.socket.send("host:start-game", host.roomCode);

    answer(alice.socket, host.roomCode, "q1-o2");
    const scoreAfterFirst = harness.scoreOf(host.roomCode, alice.playerId);
    expect(scoreAfterFirst).toBe(1000);

    answer(alice.socket, host.roomCode, "q1-o2");

    expect(alice.socket.lastError()).toBe("You already answered this question.");
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(scoreAfterFirst);
  });

  it("rejects an option id that is not on the question", () => {
    const { harness, host, alice } = startGame();

    answer(alice.socket, host.roomCode, "q1-o99");

    expect(alice.socket.lastError()).toBe("That answer option is not valid.");
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);
  });

  it("rejects an answer whose type does not match the question", () => {
    const { harness, host, alice } = startGame();

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "number",
      guess: 42,
    });

    expect(alice.socket.lastError()).toBe("That answer does not match the current question type.");
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);
  });
});

// ── Poll ──────────────────────────────────────────────────────────────────────

describe("poll scoring", () => {
  it("pays the majority 1000 and the runner-up 400, and nothing below that", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makePollQuiz());
    const players = ["Alice", "Bob", "Cara", "Dan"].map((name) =>
      harness.joinPlayer(host.roomCode, name),
    );
    host.socket.send("host:start-game", host.roomCode);

    // Two votes for option 1, one each for options 2 and 3.
    const votes = ["q1-o1", "q1-o1", "q1-o2", "q1-o3"];
    players.forEach((player, index) => {
      player.socket.send("player:submit-answer", {
        roomCode: host.roomCode,
        type: "poll",
        optionId: votes[index],
      });
    });

    expect(players.map((player) => harness.scoreOf(host.roomCode, player.playerId))).toEqual([
      1000, 1000, 400, 0,
    ]);
  });

  it("holds scoring until the reveal and reports the answer as pending", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makePollQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    const bob = harness.joinPlayer(host.roomCode, "Bob");
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "poll",
      optionId: "q1-o1",
    });

    // Bob has not answered, so the round is still open and nobody has been paid.
    expect(alice.socket.lastReceived<AnswerAcceptedPayload>("answer:accepted")).toEqual({
      pending: true,
      isCorrect: false,
      pointsEarned: 0,
      streak: 0,
    });
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);

    bob.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "poll",
      optionId: "q1-o1",
    });

    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(1000);
  });

  it("breaks a vote tie by option order and reveals the vote counts", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makePollQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    const bob = harness.joinPlayer(host.roomCode, "Bob");
    host.socket.send("host:start-game", host.roomCode);

    // One vote each for options 2 and 3 — the earlier option wins the tie.
    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "poll",
      optionId: "q1-o3",
    });
    bob.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "poll",
      optionId: "q1-o2",
    });

    const reveal = harness.io.lastBroadcast<QuestionRevealPayload>(
      host.roomCode,
      "question:revealed",
    );

    expect(reveal).toEqual({
      type: "poll",
      majorityOptionId: "q1-o2",
      voteCounts: { "q1-o1": 0, "q1-o2": 1, "q1-o3": 1 },
    });
    expect(harness.scoreOf(host.roomCode, bob.playerId)).toBe(1000);
    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(400);
  });
});

// ── Number ────────────────────────────────────────────────────────────────────

describe("number scoring", () => {
  it("scales points by how close the guess is across the answer range", () => {
    const harness = createHarness();
    // Correct answer 50 in a 0–100 range, so the range used for scaling is 100.
    const host = harness.hostRoom(makeNumberQuiz());
    const players = ["Alice", "Bob", "Cara"].map((name) => harness.joinPlayer(host.roomCode, name));
    host.socket.send("host:start-game", host.roomCode);

    [50, 75, 100].forEach((guess, index) => {
      players[index].socket.send("player:submit-answer", {
        roomCode: host.roomCode,
        type: "number",
        guess,
      });
    });

    // Exact, then 25 and 50 away out of a range of 100.
    expect(players.map((player) => harness.scoreOf(host.roomCode, player.playerId))).toEqual([
      1000, 750, 500,
    ]);
  });

  it("pays nothing for a guess a full range away from the answer", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeNumberQuiz({ correctNumber: 0, minValue: 0, maxValue: 100 }));
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "number",
      guess: 100,
    });

    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);
  });

  it("rejects a guess outside the question's range", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeNumberQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "number",
      guess: 101,
    });

    expect(alice.socket.lastError()).toBe("That guess is outside the allowed range.");
  });

  it("rejects a non-numeric guess", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeNumberQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);

    alice.socket.send("player:submit-answer", {
      roomCode: host.roomCode,
      type: "number",
      guess: "50",
    });

    expect(alice.socket.lastError()).toBe("That guess is outside the allowed range.");
  });
});

// ── Ranking ───────────────────────────────────────────────────────────────────

describe("ranking scoring", () => {
  /** Start a ranking game with one player per submitted order. */
  const playOrders = (orders: string[][]) => {
    const harness = createHarness();
    const host = harness.hostRoom(makeRankingQuiz());
    const players = orders.map((_order, index) =>
      harness.joinPlayer(host.roomCode, `Player ${index + 1}`),
    );
    host.socket.send("host:start-game", host.roomCode);

    players.forEach((player, index) => {
      player.socket.send("player:submit-answer", {
        roomCode: host.roomCode,
        type: "ranking",
        order: orders[index],
      });
    });

    return {
      harness,
      host,
      players,
      scores: players.map((player) => harness.scoreOf(host.roomCode, player.playerId)),
    };
  };

  it("pays partial credit per correctly placed item", () => {
    // Correct order is r1, r2, r3: all three placed, then only r2, then none.
    const { scores } = playOrders([
      ["q1-r1", "q1-r2", "q1-r3"],
      ["q1-r3", "q1-r2", "q1-r1"],
      ["q1-r2", "q1-r3", "q1-r1"],
    ]);

    expect(scores).toEqual([1000, 333, 0]);
  });

  it("reveals the correct order once the round closes", () => {
    const { harness, host } = playOrders([["q1-r1", "q1-r2", "q1-r3"]]);

    expect(
      harness.io.lastBroadcast<QuestionRevealPayload>(host.roomCode, "question:revealed"),
    ).toEqual({
      type: "ranking",
      correctOrder: ["q1-r1", "q1-r2", "q1-r3"],
    });
  });

  it("rejects an order that is not a permutation of the question's items", () => {
    const harness = createHarness();
    const host = harness.hostRoom(makeRankingQuiz());
    const alice = harness.joinPlayer(host.roomCode, "Alice");
    host.socket.send("host:start-game", host.roomCode);

    const badOrders = [
      ["q1-r1", "q1-r2"], // too short
      ["q1-r1", "q1-r1", "q1-r2"], // duplicated item
      ["q1-r1", "q1-r2", "q1-r99"], // unknown item
    ];

    for (const order of badOrders) {
      alice.socket.clear();
      alice.socket.send("player:submit-answer", {
        roomCode: host.roomCode,
        type: "ranking",
        order,
      });
      expect(alice.socket.lastError()).toBe("That ranking order is not valid.");
    }

    expect(harness.scoreOf(host.roomCode, alice.playerId)).toBe(0);
  });
});
