import type { QuestionRoundResult, QuizQuestion } from "@quizgame/contracts";
import { describe, expect, it } from "vitest";
import { isAnswerExactlyCorrect, toGameSummary } from "../index";
import { makePlayer, makeRoom } from "./helpers";

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

const numberQuestion: QuizQuestion = {
  id: "question-2",
  prompt: "How tall is the Eiffel Tower, in metres?",
  type: "number",
  correctNumber: 330,
  minValue: 0,
  maxValue: 1000,
};

const rankingQuestion: QuizQuestion = {
  id: "question-3",
  prompt: "Order these by size",
  type: "ranking",
  items: [
    { id: "r1", text: "Small" },
    { id: "r2", text: "Medium" },
    { id: "r3", text: "Large" },
  ],
  correctOrder: ["r1", "r2", "r3"],
};

const pollQuestion: QuizQuestion = {
  id: "question-4",
  prompt: "Favourite colour?",
  type: "poll",
  options: [
    { id: "p1", text: "Red" },
    { id: "p2", text: "Blue" },
  ],
};

const makeRound = (overrides: Partial<QuestionRoundResult> = {}): QuestionRoundResult => ({
  questionId: overrides.questionId ?? "question-1",
  prompt: overrides.prompt ?? "What is 2 + 2?",
  type: overrides.type ?? "multiple-choice",
  index: overrides.index ?? 0,
  answeredCount: overrides.answeredCount ?? 0,
  playerCount: overrides.playerCount ?? 0,
  correctCount: overrides.correctCount === undefined ? 0 : overrides.correctCount,
});

describe("isAnswerExactlyCorrect", () => {
  it("accepts the correct multiple-choice option and rejects the others", () => {
    expect(
      isAnswerExactlyCorrect(mcQuestion, {
        roomCode: "ABCDEF",
        type: "multiple-choice",
        optionId: "q1-o2",
      }),
    ).toBe(true);
    expect(
      isAnswerExactlyCorrect(mcQuestion, {
        roomCode: "ABCDEF",
        type: "multiple-choice",
        optionId: "q1-o1",
      }),
    ).toBe(false);
  });

  it("treats a missing answer as incorrect", () => {
    expect(isAnswerExactlyCorrect(mcQuestion, null)).toBe(false);
    expect(isAnswerExactlyCorrect(numberQuestion, null)).toBe(false);
    expect(isAnswerExactlyCorrect(rankingQuestion, null)).toBe(false);
  });

  it("requires an exact number, not a close one", () => {
    expect(
      isAnswerExactlyCorrect(numberQuestion, { roomCode: "ABCDEF", type: "number", guess: 330 }),
    ).toBe(true);
    // Scoring awards partial credit for 329; the recap's accuracy count does not.
    expect(
      isAnswerExactlyCorrect(numberQuestion, { roomCode: "ABCDEF", type: "number", guess: 329 }),
    ).toBe(false);
  });

  it("requires the whole ranking order, not a partially correct one", () => {
    expect(
      isAnswerExactlyCorrect(rankingQuestion, {
        roomCode: "ABCDEF",
        type: "ranking",
        order: ["r1", "r2", "r3"],
      }),
    ).toBe(true);
    // First item right, last two swapped — partial credit when scoring, still not "correct".
    expect(
      isAnswerExactlyCorrect(rankingQuestion, {
        roomCode: "ABCDEF",
        type: "ranking",
        order: ["r1", "r3", "r2"],
      }),
    ).toBe(false);
  });

  it("returns null for polls, which have no correct answer", () => {
    expect(
      isAnswerExactlyCorrect(pollQuestion, { roomCode: "ABCDEF", type: "poll", optionId: "p1" }),
    ).toBeNull();
    expect(isAnswerExactlyCorrect(pollQuestion, null)).toBeNull();
  });

  it("rejects an answer whose type does not match the question", () => {
    expect(
      isAnswerExactlyCorrect(mcQuestion, { roomCode: "ABCDEF", type: "number", guess: 4 }),
    ).toBe(false);
  });
});

describe("toGameSummary", () => {
  it("orders players highest score first, matching the final leaderboard", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "Low", score: 100 }),
        makePlayer({ id: "p2", name: "High", score: 900 }),
        makePlayer({ id: "p3", name: "Mid", score: 500 }),
      ],
    });

    expect(toGameSummary(room).players.map((entry) => entry.name)).toEqual(["High", "Mid", "Low"]);
  });

  it("breaks ties by name, the same way the leaderboard does", () => {
    const room = makeRoom({
      players: [
        makePlayer({ id: "p1", name: "Zoe", score: 500 }),
        makePlayer({ id: "p2", name: "Aaron", score: 500 }),
      ],
    });

    expect(toGameSummary(room).players.map((entry) => entry.name)).toEqual(["Aaron", "Zoe"]);
  });

  it("carries each player's accumulated counters", () => {
    const room = makeRoom({
      players: [
        makePlayer({
          id: "p1",
          name: "Alice",
          score: 2400,
          correctAnswerCount: 3,
          missedQuestionCount: 1,
          bestStreak: 2,
        }),
      ],
    });

    expect(toGameSummary(room).players[0]).toEqual({
      playerId: "p1",
      name: "Alice",
      score: 2400,
      correctAnswers: 3,
      missedQuestions: 1,
      bestStreak: 2,
    });
  });

  it("counts only rounds with a right answer as scorable", () => {
    const room = makeRoom({
      roundResults: [
        makeRound({ questionId: "question-1", index: 0, correctCount: 2 }),
        makeRound({ questionId: "question-4", index: 1, type: "poll", correctCount: null }),
        makeRound({ questionId: "question-2", index: 2, type: "number", correctCount: 0 }),
      ],
    });

    const summary = toGameSummary(room);
    expect(summary.questions).toHaveLength(3);
    expect(summary.scorableQuestions).toBe(2);
  });

  it("reports zero scorable rounds for a game that ended before any question closed", () => {
    const summary = toGameSummary(makeRoom({ players: [makePlayer({ id: "p1" })] }));
    expect(summary.questions).toEqual([]);
    expect(summary.scorableQuestions).toBe(0);
  });
});
