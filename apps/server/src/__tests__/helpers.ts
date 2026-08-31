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
