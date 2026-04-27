export type RoomStatus = "lobby" | "question" | "leaderboard" | "finished";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
}

export interface QuizDraft {
  title: string;
  /** Seconds players have to answer each question. Range 10–120, default 30. */
  timeLimit: number;
  questions: QuizQuestion[];
}

export interface PlayerSummary {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  answeredCurrentQuestion: boolean;
  /** Consecutive correct answers in a row (0 if none yet). */
  streak: number;
  /** Points earned in the most recent question round. */
  pointsEarnedThisRound: number;
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  index: number;
  total: number;
  /** Seconds the players have to answer this question. */
  timeLimit: number;
}

export interface RoomSnapshot {
  roomCode: string;
  hostName: string;
  quizTitle: string;
  status: RoomStatus;
  currentQuestionIndex: number | null;
  totalQuestions: number;
  players: PlayerSummary[];
  leaderboard: LeaderboardEntry[];
}

export interface HostCreateRoomPayload {
  hostName: string;
  quiz: QuizDraft;
}

export interface PlayerJoinPayload {
  roomCode: string;
  name: string;
}

export interface SubmitAnswerPayload {
  roomCode: string;
  optionId: string;
}

export interface RoomJoinedPayload {
  playerId: string;
  room: RoomSnapshot;
}

export interface ErrorMessagePayload {
  message: string;
}

export interface CheckRoomPayload {
  roomCode: string;
}

export interface CheckRoomResult {
  roomCode: string;
  hostName: string;
  quizTitle: string;
  playerCount: number;
}

export interface AnswerCountPayload {
  answeredCount: number;
  totalPlayers: number;
}

/**
 * Emitted exclusively to the player who just submitted an answer ("answer:accepted").
 * Gives the client everything it needs to render a result card immediately, without
 * waiting for the full room snapshot that arrives with "leaderboard:update".
 */
export interface AnswerAcceptedPayload {
  isCorrect: boolean;
  pointsEarned: number;
  /** Current consecutive-correct streak for this player after this answer. */
  streak: number;
}

/**
 * Emitted to every client in the room just before "leaderboard:update".
 * Lets the client highlight the correct option in green (and the player's wrong
 * pick in red) while the leaderboard is on screen.
 */
export interface QuestionRevealPayload {
  /** The option ID that was the correct answer for the question just scored. */
  correctOptionId: string;
}

export interface RoomRejoinedPayload {
  room: RoomSnapshot;
  currentQuestion: PublicQuestion | null;
  isHost: boolean;
}

export interface PlayerReconnectPayload {
  token: string;
}

export interface HostReconnectPayload {
  token: string;
}

export const createEmptyQuestion = (index: number): QuizQuestion => ({
  id: `question-${index + 1}`,
  prompt: "",
  options: [
    { id: `q${index + 1}-a`, text: "" },
    { id: `q${index + 1}-b`, text: "" },
    { id: `q${index + 1}-c`, text: "" },
    { id: `q${index + 1}-d`, text: "" },
  ],
  correctOptionId: `q${index + 1}-a`,
});

export const createStarterQuiz = (): QuizDraft => ({
  title: "",
  timeLimit: 30,
  questions: [createEmptyQuestion(0)],
});
