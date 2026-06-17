import type {
  PublicQuestion,
  QuizDraft,
  RoomSnapshot,
  SubmitAnswerPayload,
} from "@quizgame/contracts";

// ── Domain types ───────────────────────────────────────────────────────────────

export interface StoredPlayer {
  id: string;       // stable UUID — the reconnect token for this player
  socketId: string; // current socket.id (changes on reconnect)
  name: string;
  score: number;
  connected: boolean;
  lastAnsweredQuestionId: string | null;
  /** Consecutive correct answers in a row. Resets to 0 on a wrong answer. */
  streak: number;
  /** Snapshot of score at the start of the current question round. */
  scoreBeforeCurrentQuestion: number;
  /** The player's answer for the current question (for pending-scoring types). */
  currentAnswer: SubmitAnswerPayload | null;
}

export interface StoredRoom {
  code: string;
  hostSocketId: string | null; // null while host grace-period timer is running
  hostToken: string;           // stable UUID — the reconnect token for the host
  hostName: string;
  quiz: QuizDraft;
  status: RoomSnapshot["status"];
  currentQuestionIndex: number | null;
  questionStartedAt: number | null;
  activePublicQuestion: PublicQuestion | null;
  players: Map<string, StoredPlayer>; // keyed by player.id (UUID)
  hostCloseTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  /** Auto-advance timer: fires emitLeaderboard after the question time limit expires. */
  questionAutoTimer: ReturnType<typeof setTimeout> | null;
}
