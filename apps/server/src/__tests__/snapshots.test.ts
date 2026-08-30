import type { PublicQuestion, QuizQuestion } from "@quizgame/contracts";
import { describe, expect, it, vi } from "vitest";
import { toLeaderboard, toPlayers, toPublicQuestion, toSnapshot, withServerClock } from "../index";
import { makePlayer, makeRoom } from "./helpers";

/** An arbitrary fixed deadline; the exact value only matters where a test asserts on it. */
const FIXED_ENDS_AT = 1_760_000_030_000;

/**
 * Widens a public question into a plain field bag so a test can assert that a secret
 * field (correctOptionId, correctNumber, correctOrder) is absent. Reading a key that is
 * not on the union is a compile error otherwise, which is exactly what these tests check.
 */
const asFields = (question: PublicQuestion): Record<string, unknown> =>
  question as unknown as Record<string, unknown>;

const mcQuestion: QuizQuestion = {
  id: "question-1",
  prompt: "What is 2 + 2?",
  type: "multiple-choice",
  options: [
    { id: "q1-o1", text: "3" },
    { id: "q1-o2", text: "4" },
  ],
  correctOptionId: "q1-o2",
};

describe("toLeaderboard", () => {
  it("sorts by score descending", () => {
    const room = makeRoom({
      currentQuestionIndex: 0,
      players: [
        makePlayer({ id: "p1", name: "Low", score: 100 }),
        makePlayer({ id: "p2", name: "High", score: 900 }),
        makePlayer({ id: "p3", name: "Mid", score: 500 }),
      ],
    });

    const board = toLeaderboard(room);
    expect(board.map((e) => e.name)).toEqual(["High", "Mid", "Low"]);
  });

  it("breaks ties by name ascending", () => {
    const room = makeRoom({
      currentQuestionIndex: 0,
      players: [
        makePlayer({ id: "p1", name: "Zoe", score: 500 }),
        makePlayer({ id: "p2", name: "Aaron", score: 500 }),
        makePlayer({ id: "p3", name: "Mike", score: 500 }),
      ],
    });

    const board = toLeaderboard(room);
    expect(board.map((e) => e.name)).toEqual(["Aaron", "Mike", "Zoe"]);
  });

  it("maps all player fields correctly", () => {
    const room = makeRoom({
      currentQuestionIndex: 0,
      players: [
        makePlayer({
          id: "p1",
          name: "Alice",
          score: 750,
          streak: 3,
          scoreBeforeCurrentQuestion: 600,
          lastAnsweredQuestionId: "question-1",
        }),
      ],
    });

    const [entry] = toLeaderboard(room);
    expect(entry).toEqual({
      playerId: "p1",
      name: "Alice",
      score: 750,
      answeredCurrentQuestion: true,
      streak: 3,
      pointsEarnedThisRound: 150,
    });
  });

  it("marks answeredCurrentQuestion false when no current question", () => {
    const room = makeRoom({
      currentQuestionIndex: null,
      players: [
        makePlayer({ id: "p1", name: "Alice", score: 0, lastAnsweredQuestionId: "question-1" }),
      ],
    });
    const [entry] = toLeaderboard(room);
    expect(entry.answeredCurrentQuestion).toBe(false);
  });

  it("marks answeredCurrentQuestion false when player answered a different question", () => {
    const room = makeRoom({
      currentQuestionIndex: 0,
      players: [makePlayer({ id: "p1", name: "Alice", lastAnsweredQuestionId: "other-id" })],
    });
    const [entry] = toLeaderboard(room);
    expect(entry.answeredCurrentQuestion).toBe(false);
  });
});

describe("toPlayers", () => {
  it("maps each player to a summary", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "Alice", score: 10, connected: true }),
        makePlayer({ id: "p2", name: "Bob", score: 20, connected: false }),
      ],
    });

    expect(toPlayers(room)).toEqual([
      { id: "p1", name: "Alice", score: 10, connected: true },
      { id: "p2", name: "Bob", score: 20, connected: false },
    ]);
  });

  it("returns an empty array for a room with no players", () => {
    const room = makeRoom({ players: [] });
    expect(toPlayers(room)).toEqual([]);
  });
});

describe("toSnapshot", () => {
  it("includes all expected fields", () => {
    const room = makeRoom({
      code: "WXYZ12",
      hostName: "GameMaster",
      status: "question",
      currentQuestionIndex: 0,
      players: [makePlayer({ id: "p1", name: "Alice", score: 10, connected: true })],
    });

    const snapshot = toSnapshot(room);
    expect(snapshot).toEqual({
      roomCode: "WXYZ12",
      hostName: "GameMaster",
      quizTitle: "Test Quiz",
      status: "question",
      currentQuestionIndex: 0,
      totalQuestions: 1,
      players: [{ id: "p1", name: "Alice", score: 10, connected: true }],
      leaderboard: [expect.objectContaining({ playerId: "p1", name: "Alice", score: 10 })],
    });
  });

  it("reports totalQuestions from the quiz", () => {
    const room = makeRoom({
      quiz: {
        title: "Multi",
        timeLimit: 20,
        questions: [mcQuestion, mcQuestion, mcQuestion],
      },
    });
    expect(toSnapshot(room).totalQuestions).toBe(3);
  });
});

describe("toPublicQuestion", () => {
  it("strips correctOptionId from a multiple-choice question", () => {
    const publicQ = asFields(toPublicQuestion(mcQuestion, 0, 5, 30, FIXED_ENDS_AT));
    expect(publicQ.correctOptionId).toBeUndefined();
    expect(publicQ).toMatchObject({
      id: "question-1",
      prompt: "What is 2 + 2?",
      type: "multiple-choice",
      index: 0,
      total: 5,
      timeLimit: 30,
    });
    expect(publicQ.options).toEqual(mcQuestion.options);
  });

  it("includes options for a poll question without correctOptionId", () => {
    const poll: QuizQuestion = {
      id: "q2",
      prompt: "Best color?",
      type: "poll",
      options: [
        { id: "a", text: "Red" },
        { id: "b", text: "Blue" },
      ],
    };
    const publicQ = asFields(toPublicQuestion(poll, 1, 3, 20, FIXED_ENDS_AT));
    expect(publicQ.correctOptionId).toBeUndefined();
    expect(publicQ.type).toBe("poll");
    expect(publicQ.options).toEqual(poll.options);
  });

  it("includes range fields for a number question", () => {
    const numberQ: QuizQuestion = {
      id: "q3",
      prompt: "Guess a number",
      type: "number",
      correctNumber: 42,
      minValue: 0,
      maxValue: 100,
    };
    const publicQ = asFields(toPublicQuestion(numberQ, 2, 4, 15, FIXED_ENDS_AT));
    expect(publicQ.correctNumber).toBeUndefined();
    expect(publicQ).toMatchObject({ type: "number", minValue: 0, maxValue: 100 });
  });

  it("includes shuffled items for a ranking question (no correctOrder)", () => {
    const rankingQ: QuizQuestion = {
      id: "q4",
      prompt: "Order these",
      type: "ranking",
      items: [
        { id: "r1", text: "A" },
        { id: "r2", text: "B" },
        { id: "r3", text: "C" },
      ],
      correctOrder: ["r1", "r2", "r3"],
    };
    const publicQ = toPublicQuestion(rankingQ, 3, 6, 30, FIXED_ENDS_AT) as {
      type: string;
      items: { id: string }[];
      correctOrder?: unknown;
    };
    expect(publicQ.type).toBe("ranking");
    expect(publicQ.correctOrder).toBeUndefined();
    // Items are a permutation of the originals.
    const ids = publicQ.items.map((i) => i.id).sort();
    expect(ids).toEqual(["r1", "r2", "r3"]);
  });
});

describe("public question timing", () => {
  it("carries the deadline through and stamps serverNow from the current clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(FIXED_ENDS_AT - 30_000);
      const publicQ = toPublicQuestion(mcQuestion, 0, 5, 30, FIXED_ENDS_AT);

      expect(publicQ.endsAt).toBe(FIXED_ENDS_AT);
      expect(publicQ.serverNow).toBe(FIXED_ENDS_AT - 30_000);
      // A client joining at the start gets the full time limit.
      expect(publicQ.endsAt - publicQ.serverNow).toBe(30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shrinks the remaining time as the question runs, without moving the deadline", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(FIXED_ENDS_AT - 30_000);
      const started = toPublicQuestion(mcQuestion, 0, 5, 30, FIXED_ENDS_AT);

      // A player drops and reconnects 22 seconds into a 30 second question.
      vi.setSystemTime(FIXED_ENDS_AT - 8_000);
      const restamped = withServerClock(started);

      // The deadline is unchanged, so the reconnecting client sees the 8 seconds that
      // are genuinely left rather than restarting at the full 30.
      expect(restamped.endsAt).toBe(FIXED_ENDS_AT);
      expect(restamped.endsAt - restamped.serverNow).toBe(8_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves every other field of the question untouched when re-stamping", () => {
    const started = toPublicQuestion(mcQuestion, 0, 5, 30, FIXED_ENDS_AT);
    const restamped = withServerClock(started);

    expect(restamped).toEqual({ ...started, serverNow: restamped.serverNow });
  });

  it("still hides the correct answer after re-stamping", () => {
    const restamped = asFields(
      withServerClock(toPublicQuestion(mcQuestion, 0, 5, 30, FIXED_ENDS_AT)),
    );

    expect(restamped.correctOptionId).toBeUndefined();
  });
});
