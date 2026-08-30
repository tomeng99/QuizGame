import { describe, expect, it } from "vitest";
import { MAX_OPTION_TEXT_LENGTH, MAX_PROMPT_LENGTH, normalizeQuestion } from "../index";

describe("normalizeQuestion", () => {
  describe("multiple-choice", () => {
    it("normalizes a valid question", () => {
      const result = normalizeQuestion(
        {
          prompt: "What is 2 + 2?",
          type: "multiple-choice",
          options: [
            { id: "a", text: "3" },
            { id: "b", text: "4" },
          ],
          correctOptionId: "b",
        },
        0,
      );

      expect(result).toEqual({
        id: "question-1",
        prompt: "What is 2 + 2?",
        type: "multiple-choice",
        options: [
          { id: "a", text: "3" },
          { id: "b", text: "4" },
        ],
        correctOptionId: "b",
      });
    });

    it("returns null when prompt is missing", () => {
      expect(normalizeQuestion({ options: [{ text: "x" }, { text: "y" }] }, 0)).toBeNull();
    });

    it("returns null when prompt is whitespace-only", () => {
      expect(
        normalizeQuestion({ prompt: "   ", options: [{ text: "x" }, { text: "y" }] }, 0),
      ).toBeNull();
    });

    it("returns null when options are missing", () => {
      expect(normalizeQuestion({ prompt: "q" }, 0)).toBeNull();
    });

    it("returns null when fewer than 2 valid options", () => {
      expect(normalizeQuestion({ prompt: "q", options: [{ text: "only" }] }, 0)).toBeNull();
    });

    it("returns null when options is not an array", () => {
      expect(normalizeQuestion({ prompt: "q", options: "nope" }, 0)).toBeNull();
    });

    it("caps options at 10", () => {
      const options = Array.from({ length: 15 }, (_, i) => ({ id: `o${i}`, text: `opt${i}` }));
      const result = normalizeQuestion({ prompt: "q", options }, 0);
      expect(result).not.toBeNull();
      expect((result as { options: unknown[] }).options).toHaveLength(10);
    });

    it("trims and caps option text length", () => {
      const longText = "x".repeat(MAX_OPTION_TEXT_LENGTH + 50);
      const result = normalizeQuestion(
        { prompt: "q", options: [{ text: `  ${longText}  ` }, { text: "y" }] },
        0,
      );
      expect(result).not.toBeNull();
      const options = (result as { options: { text: string }[] }).options;
      expect(options[0].text).toHaveLength(MAX_OPTION_TEXT_LENGTH);
      // leading/trailing whitespace removed before slicing
      expect(options[0].text).toBe("x".repeat(MAX_OPTION_TEXT_LENGTH));
    });

    it("filters out options with empty text", () => {
      const result = normalizeQuestion(
        { prompt: "q", options: [{ text: "   " }, { text: "y" }, { text: "z" }] },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { options: unknown[] }).options).toHaveLength(2);
    });

    it("falls back to first option id when correctOptionId is invalid", () => {
      const result = normalizeQuestion(
        {
          prompt: "q",
          options: [
            { id: "a", text: "x" },
            { id: "b", text: "y" },
          ],
          correctOptionId: "does-not-exist",
        },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { correctOptionId: string }).correctOptionId).toBe("a");
    });

    it("falls back to first option id when correctOptionId is missing", () => {
      const result = normalizeQuestion(
        {
          prompt: "q",
          options: [
            { id: "a", text: "x" },
            { id: "b", text: "y" },
          ],
        },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { correctOptionId: string }).correctOptionId).toBe("a");
    });

    it("auto-generates question and option ids when absent", () => {
      const result = normalizeQuestion({ prompt: "q", options: [{ text: "x" }, { text: "y" }] }, 2);
      expect(result).not.toBeNull();
      const r = result as { id: string; options: { id: string }[] };
      expect(r.id).toBe("question-3");
      expect(r.options[0].id).toBe("q3-o1");
      expect(r.options[1].id).toBe("q3-o2");
    });

    it("uses provided question id and option ids", () => {
      const result = normalizeQuestion(
        {
          id: "custom-q",
          prompt: "q",
          options: [
            { id: "opt-a", text: "x" },
            { id: "opt-b", text: "y" },
          ],
          correctOptionId: "opt-b",
        },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { id: string }).id).toBe("custom-q");
    });

    it("trims and caps the prompt", () => {
      const longPrompt = "p".repeat(MAX_PROMPT_LENGTH + 100);
      const result = normalizeQuestion(
        { prompt: `  ${longPrompt}  `, options: [{ text: "x" }, { text: "y" }] },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { prompt: string }).prompt).toHaveLength(MAX_PROMPT_LENGTH);
    });

    it("defaults type to multiple-choice for unknown type", () => {
      const result = normalizeQuestion(
        { prompt: "q", type: "bogus", options: [{ text: "x" }, { text: "y" }] },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { type: string }).type).toBe("multiple-choice");
    });

    it("returns null for a non-object input", () => {
      expect(normalizeQuestion("nope", 0)).toBeNull();
      expect(normalizeQuestion(null, 0)).toBeNull();
      expect(normalizeQuestion(undefined, 0)).toBeNull();
    });
  });

  describe("poll", () => {
    it("normalizes a poll question without correctOptionId", () => {
      const result = normalizeQuestion(
        { prompt: "Pick one", type: "poll", options: [{ text: "a" }, { text: "b" }] },
        0,
      );
      expect(result).not.toBeNull();
      expect(result).toEqual({
        id: "question-1",
        prompt: "Pick one",
        type: "poll",
        options: [
          { id: "q1-o1", text: "a" },
          { id: "q1-o2", text: "b" },
        ],
      });
      expect((result as unknown as Record<string, unknown>).correctOptionId).toBeUndefined();
    });
  });

  describe("number", () => {
    it("normalizes a valid number question", () => {
      const result = normalizeQuestion(
        {
          prompt: "Guess",
          type: "number",
          correctNumber: 42,
          minValue: 0,
          maxValue: 100,
        },
        0,
      );
      expect(result).toEqual({
        id: "question-1",
        prompt: "Guess",
        type: "number",
        correctNumber: 42,
        minValue: 0,
        maxValue: 100,
      });
    });

    it("returns null when range is invalid (min >= max)", () => {
      expect(
        normalizeQuestion(
          { prompt: "q", type: "number", correctNumber: 5, minValue: 10, maxValue: 10 },
          0,
        ),
      ).toBeNull();
    });

    it("returns null when numeric fields are missing/non-finite", () => {
      expect(
        normalizeQuestion({ prompt: "q", type: "number", minValue: 0, maxValue: 10 }, 0),
      ).toBeNull();
      expect(
        normalizeQuestion(
          { prompt: "q", type: "number", correctNumber: NaN, minValue: 0, maxValue: 10 },
          0,
        ),
      ).toBeNull();
    });
  });

  describe("ranking", () => {
    it("normalizes a valid ranking question", () => {
      const result = normalizeQuestion(
        {
          prompt: "Order these",
          type: "ranking",
          items: [{ text: "a" }, { text: "b" }, { text: "c" }],
          correctOrder: ["q1-r1", "q1-r2", "q1-r3"],
        },
        0,
      );
      expect(result).not.toBeNull();
      expect((result as { type: string }).type).toBe("ranking");
      expect((result as { correctOrder: string[] }).correctOrder).toEqual([
        "q1-r1",
        "q1-r2",
        "q1-r3",
      ]);
    });

    it("returns null when fewer than 3 items", () => {
      expect(
        normalizeQuestion(
          { prompt: "q", type: "ranking", items: [{ text: "a" }, { text: "b" }] },
          0,
        ),
      ).toBeNull();
    });

    it("returns null when correctOrder does not match items", () => {
      expect(
        normalizeQuestion(
          {
            prompt: "q",
            type: "ranking",
            items: [{ text: "a" }, { text: "b" }, { text: "c" }],
            correctOrder: ["q1-r1", "q1-r2"],
          },
          0,
        ),
      ).toBeNull();
    });
  });
});
