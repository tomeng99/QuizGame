import type { QuizDraft, QuizQuestion } from "@quizgame/contracts";
import {
  MAX_QUESTIONS,
  MAX_OPTION_TEXT_LENGTH,
  MAX_PROMPT_LENGTH,
} from "./constants";

// ── Validation helpers ─────────────────────────────────────────────────────────

export const isString = (v: unknown): v is string => typeof v === "string";

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// ── Quiz normalisation (with runtime validation and size caps) ─────────────────

export const normalizeQuestion = (question: unknown, index: number): QuizQuestion | null => {
  if (typeof question !== "object" || question === null) return null;
  const q = question as Record<string, unknown>;

  const prompt = isString(q.prompt) ? q.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : "";
  const id = isString(q.id) && q.id ? q.id : `question-${index + 1}`;
  const type = q.type === "poll" || q.type === "number" || q.type === "ranking"
    ? q.type
    : "multiple-choice";

  if (!prompt) return null;

  if (type === "multiple-choice" || type === "poll") {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions
      .slice(0, 10)
      .map((option: unknown, optionIndex: number) => {
        const o = (typeof option === "object" && option !== null ? option : {}) as Record<
          string,
          unknown
        >;
        return {
          id: isString(o.id) && o.id ? o.id : `q${index + 1}-o${optionIndex + 1}`,
          text: isString(o.text) ? o.text.trim().slice(0, MAX_OPTION_TEXT_LENGTH) : "",
        };
      })
      .filter((option) => option.text.length > 0);

    if (options.length < 2) return null;

    if (type === "poll") {
      return {
        id,
        prompt,
        type,
        options,
      };
    }

    const correctOptionId =
      options.some((option) => option.id === q.correctOptionId)
        ? (q.correctOptionId as string)
        : options[0].id;

    return {
      id,
      prompt,
      type,
      options,
      correctOptionId,
    };
  }

  if (type === "number") {
    if (
      !isFiniteNumber(q.correctNumber) ||
      !isFiniteNumber(q.minValue) ||
      !isFiniteNumber(q.maxValue) ||
      q.minValue >= q.maxValue
    ) {
      return null;
    }

    return {
      id,
      prompt,
      type,
      correctNumber: q.correctNumber,
      minValue: q.minValue,
      maxValue: q.maxValue,
    };
  }

  const rawItems = Array.isArray(q.items) ? q.items : [];
  const items = rawItems
    .slice(0, 5)
    .map((item: unknown, itemIndex: number) => {
      const entry = (typeof item === "object" && item !== null ? item : {}) as Record<
        string,
        unknown
      >;
      return {
        id: isString(entry.id) && entry.id ? entry.id : `q${index + 1}-r${itemIndex + 1}`,
        text: isString(entry.text) ? entry.text.trim().slice(0, MAX_OPTION_TEXT_LENGTH) : "",
      };
    })
    .filter((item) => item.text.length > 0);

  if (items.length < 3 || items.length > 5) return null;

  const correctOrder = Array.isArray(q.correctOrder)
    ? q.correctOrder.filter((value): value is string => isString(value) && value.length > 0)
    : [];
  const itemIds = items.map((item) => item.id);
  const itemIdSet = new Set(itemIds);
  const orderSet = new Set(correctOrder);

  if (
    correctOrder.length !== items.length ||
    orderSet.size !== items.length ||
    itemIdSet.size !== items.length ||
    itemIds.some((itemId) => !orderSet.has(itemId))
  ) {
    return null;
  }

  return {
    id,
    prompt,
    type,
    items,
    correctOrder,
  };
};

export const normalizeQuiz = (raw: unknown): QuizDraft => {
  const q = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const title = isString(q.title) ? q.title.trim().slice(0, 200) : "";

  // Accept any numeric timeLimit from the client, but clamp it to a safe [10, 120] second range
  // and round to a whole number. Falls back to 30 s when the field is absent or non-numeric.
  const rawTimeLimit = typeof q.timeLimit === "number" ? q.timeLimit : 30;
  const timeLimit = Math.max(10, Math.min(120, Math.round(rawTimeLimit)));

  const rawQuestions = Array.isArray(q.questions) ? q.questions : [];
  return {
    title: title || "Untitled Quiz",
    timeLimit,
    questions: rawQuestions
      .slice(0, MAX_QUESTIONS)
      .map((question, index) => normalizeQuestion(question, index))
      .filter((question): question is QuizQuestion => question !== null),
  };
};
