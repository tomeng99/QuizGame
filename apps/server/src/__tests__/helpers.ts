import type { QuizDraft, QuizQuestion, RoomSnapshot } from "@quizgame/contracts";
import type { StoredPlayer, StoredRoom } from "../index";

/** Build a minimal StoredPlayer with sensible defaults for tests. */
export const makePlayer = (overrides: Partial<StoredPlayer> = {}): StoredPlayer => ({
  id: overrides.id ?? "player-1",
  reconnectToken: overrides.reconnectToken ?? "player-1-token",
  socketId: overrides.socketId ?? "socket-1",
  name: overrides.name ?? "Alice",
  score: overrides.score ?? 0,
  connected: overrides.connected ?? true,
  lastAnsweredQuestionId: overrides.lastAnsweredQuestionId ?? null,
  streak: overrides.streak ?? 0,
  scoreBeforeCurrentQuestion: overrides.scoreBeforeCurrentQuestion ?? 0,
  currentAnswer: overrides.currentAnswer ?? null,
});

const defaultMultipleChoice: QuizQuestion = {
  id: "question-1",
  prompt: "What is 2 + 2?",
  type: "multiple-choice",
  options: [
    { id: "q1-o1", text: "3" },
    { id: "q1-o2", text: "4" },
  ],
  correctOptionId: "q1-o2",
};

const defaultQuiz: QuizDraft = {
  title: "Test Quiz",
  timeLimit: 30,
  questions: [defaultMultipleChoice],
};

/** Build a minimal StoredRoom with sensible defaults for tests. */
export const makeRoom = (
  overrides: Omit<Partial<StoredRoom>, "players"> & { players?: StoredPlayer[] } = {},
): StoredRoom => {
  const players = overrides.players ?? [];
  return {
    code: overrides.code ?? "ABCDEF",
    hostSocketId: overrides.hostSocketId ?? "host-socket-1",
    hostId: overrides.hostId ?? "host-1",
    hostToken: overrides.hostToken ?? "host-token-1",
    hostName: overrides.hostName ?? "Host",
    quiz: overrides.quiz ?? defaultQuiz,
    status: overrides.status ?? "lobby",
    currentQuestionIndex: overrides.currentQuestionIndex ?? null,
    questionStartedAt: overrides.questionStartedAt ?? null,
    activePublicQuestion: overrides.activePublicQuestion ?? null,
    players: new Map(players.map((player) => [player.id, player])),
    hostCloseTimer: overrides.hostCloseTimer ?? null,
    cleanupTimer: overrides.cleanupTimer ?? null,
    questionAutoTimer: overrides.questionAutoTimer ?? null,
  };
};

export type { RoomSnapshot };
export { defaultMultipleChoice, defaultQuiz };

// ── Quiz drafts for end-to-end handler tests ──────────────────────────────────
//
// These are shaped as a client would send them to "host:create-room", so they go
// through normalizeQuiz on the way in. Every id below survives normalisation,
// which is what lets a test name the option or item it is answering with.

/** `count` two-option questions; option 2 is always the correct one. */
export const makeMultipleChoiceQuiz = (count = 1, timeLimit = 30): QuizDraft => ({
  title: "Multiple Choice Quiz",
  timeLimit,
  questions: Array.from({ length: count }, (_unused, index) => ({
    id: `question-${index + 1}`,
    prompt: `Question ${index + 1}?`,
    type: "multiple-choice" as const,
    options: [
      { id: `q${index + 1}-o1`, text: "Wrong" },
      { id: `q${index + 1}-o2`, text: "Right" },
    ],
    correctOptionId: `q${index + 1}-o2`,
  })),
});

/** One poll question with three options and no correct answer. */
export const makePollQuiz = (timeLimit = 30): QuizDraft => ({
  title: "Poll Quiz",
  timeLimit,
  questions: [
    {
      id: "question-1",
      prompt: "Best snack?",
      type: "poll",
      options: [
        { id: "q1-o1", text: "Crisps" },
        { id: "q1-o2", text: "Chocolate" },
        { id: "q1-o3", text: "Fruit" },
      ],
    },
  ],
});

/** One number question. Defaults span 0–100 with 50 correct, so the range is 100. */
export const makeNumberQuiz = (
  { correctNumber = 50, minValue = 0, maxValue = 100 } = {},
  timeLimit = 30,
): QuizDraft => ({
  title: "Number Quiz",
  timeLimit,
  questions: [
    {
      id: "question-1",
      prompt: "How many?",
      type: "number",
      correctNumber,
      minValue,
      maxValue,
    },
  ],
});

/** One ranking question over three items; the correct order is r1, r2, r3. */
export const makeRankingQuiz = (timeLimit = 30): QuizDraft => ({
  title: "Ranking Quiz",
  timeLimit,
  questions: [
    {
      id: "question-1",
      prompt: "Order these",
      type: "ranking",
      items: [
        { id: "q1-r1", text: "First" },
        { id: "q1-r2", text: "Second" },
        { id: "q1-r3", text: "Third" },
      ],
      correctOrder: ["q1-r1", "q1-r2", "q1-r3"],
    },
  ],
});
