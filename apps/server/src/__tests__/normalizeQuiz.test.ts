import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, normalizeQuiz } from "../index";

const validQuestion = {
  prompt: "What is 2 + 2?",
  type: "multiple-choice" as const,
  options: [
    { id: "a", text: "3" },
    { id: "b", text: "4" },
  ],
  correctOptionId: "b",
};

describe("normalizeQuiz", () => {
  it("normalizes a valid quiz", () => {
    const result = normalizeQuiz({
      title: "My Quiz",
      timeLimit: 45,
      questions: [validQuestion],
    });

    expect(result).toEqual({
      title: "My Quiz",
      timeLimit: 45,
      questions: [
        {
          id: "question-1",
          prompt: "What is 2 + 2?",
          type: "multiple-choice",
          options: [
            { id: "a", text: "3" },
            { id: "b", text: "4" },
          ],
          correctOptionId: "b",
        },
      ],
    });
  });

  it("defaults an empty title to 'Untitled Quiz'", () => {
    const result = normalizeQuiz({ title: "   ", questions: [validQuestion] });
    expect(result.title).toBe("Untitled Quiz");
  });

  it("defaults a missing title to 'Untitled Quiz'", () => {
    const result = normalizeQuiz({ questions: [validQuestion] });
    expect(result.title).toBe("Untitled Quiz");
  });

  it("caps questions at MAX_QUESTIONS", () => {
    const questions = Array.from({ length: MAX_QUESTIONS + 10 }, () => ({ ...validQuestion }));
    const result = normalizeQuiz({ questions });
    expect(result.questions).toHaveLength(MAX_QUESTIONS);
  });

  it("filters out invalid questions", () => {
    const result = normalizeQuiz({
      questions: [
        validQuestion,
        { prompt: "", options: [{ text: "x" }] }, // invalid: empty prompt
        { type: "number" }, // invalid: missing numeric fields
        validQuestion,
      ],
    });
    expect(result.questions).toHaveLength(2);
  });

  it("returns empty questions array when none are valid", () => {
    const result = normalizeQuiz({ questions: [{ prompt: "" }] });
    expect(result.questions).toHaveLength(0);
  });

  it("defaults timeLimit to 30 when missing or non-numeric", () => {
    expect(normalizeQuiz({ questions: [] }).timeLimit).toBe(30);
    expect(normalizeQuiz({ timeLimit: "fast", questions: [] }).timeLimit).toBe(30);
  });

  it("clamps timeLimit to [10, 120]", () => {
    expect(normalizeQuiz({ timeLimit: 1, questions: [] }).timeLimit).toBe(10);
    expect(normalizeQuiz({ timeLimit: 999, questions: [] }).timeLimit).toBe(120);
  });

  it("rounds timeLimit to a whole number", () => {
    expect(normalizeQuiz({ timeLimit: 27.6, questions: [] }).timeLimit).toBe(28);
  });

  it("caps title to 200 characters", () => {
    const longTitle = "T".repeat(300);
    const result = normalizeQuiz({ title: longTitle, questions: [] });
    expect(result.title).toHaveLength(200);
  });

  it("handles a completely non-object input", () => {
    const result = normalizeQuiz(null);
    expect(result.title).toBe("Untitled Quiz");
    expect(result.timeLimit).toBe(30);
    expect(result.questions).toEqual([]);
  });
});
