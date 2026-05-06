export type RoomStatus = "lobby" | "question" | "leaderboard" | "finished";

export interface QuizOption {
  id: string;
  text: string;
}

export type QuestionType = "multiple-choice" | "poll" | "number" | "ranking";

export interface RankingItem {
  id: string;
  text: string;
}

export interface MultipleChoiceQuestion {
  id: string;
  prompt: string;
  type: "multiple-choice";
  options: QuizOption[];
  correctOptionId: string;
}

export interface PollQuestion {
  id: string;
  prompt: string;
  type: "poll";
  options: QuizOption[];
}

export interface NumberQuestion {
  id: string;
  prompt: string;
  type: "number";
  correctNumber: number;
  minValue: number;
  maxValue: number;
}

export interface RankingQuestion {
  id: string;
  prompt: string;
  type: "ranking";
  items: RankingItem[];
  correctOrder: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | PollQuestion
  | NumberQuestion
  | RankingQuestion;

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

export type PublicQuestion =
  | {
      id: string;
      prompt: string;
      index: number;
      total: number;
      timeLimit: number;
      type: "multiple-choice";
      options: QuizOption[];
    }
  | {
      id: string;
      prompt: string;
      index: number;
      total: number;
      timeLimit: number;
      type: "poll";
      options: QuizOption[];
    }
  | {
      id: string;
      prompt: string;
      index: number;
      total: number;
      timeLimit: number;
      type: "number";
      minValue: number;
      maxValue: number;
    }
  | {
      id: string;
      prompt: string;
      index: number;
      total: number;
      timeLimit: number;
      type: "ranking";
      items: RankingItem[];
    };

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

export type SubmitAnswerPayload =
  | { roomCode: string; type: "multiple-choice" | "poll"; optionId: string }
  | { roomCode: string; type: "number"; guess: number }
  | { roomCode: string; type: "ranking"; order: string[] };

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
  pending: boolean;
  isCorrect: boolean;
  pointsEarned: number;
  /** Current consecutive-correct streak for this player after this answer. */
  streak: number;
}

/**
 * Emitted to every client in the room just before "leaderboard:update".
 * Lets the client reveal the round result while the leaderboard is on screen.
 */
export type QuestionRevealPayload =
  | { type: "multiple-choice"; correctOptionId: string }
  | { type: "poll"; voteCounts: Record<string, number>; majorityOptionId: string }
  | { type: "number"; correctNumber: number }
  | { type: "ranking"; correctOrder: string[] };

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

export const createEmptyQuestion = (index: number): MultipleChoiceQuestion => ({
  id: `question-${index + 1}`,
  type: "multiple-choice",
  prompt: "",
  options: [
    { id: `q${index + 1}-a`, text: "" },
    { id: `q${index + 1}-b`, text: "" },
    { id: `q${index + 1}-c`, text: "" },
    { id: `q${index + 1}-d`, text: "" },
  ],
  correctOptionId: `q${index + 1}-a`,
});

export const createEmptyPollQuestion = (index: number): PollQuestion => ({
  id: `question-${index + 1}`,
  type: "poll",
  prompt: "",
  options: [
    { id: `q${index + 1}-a`, text: "" },
    { id: `q${index + 1}-b`, text: "" },
    { id: `q${index + 1}-c`, text: "" },
    { id: `q${index + 1}-d`, text: "" },
  ],
});

export const createEmptyNumberQuestion = (index: number): NumberQuestion => ({
  id: `question-${index + 1}`,
  type: "number",
  prompt: "",
  correctNumber: 0,
  minValue: 0,
  maxValue: 100,
});

export const createEmptyRankingQuestion = (index: number): RankingQuestion => ({
  id: `question-${index + 1}`,
  type: "ranking",
  prompt: "",
  items: [
    { id: `q${index + 1}-r1`, text: "" },
    { id: `q${index + 1}-r2`, text: "" },
    { id: `q${index + 1}-r3`, text: "" },
  ],
  correctOrder: [`q${index + 1}-r1`, `q${index + 1}-r2`, `q${index + 1}-r3`],
});

export const createStarterQuiz = (): QuizDraft => ({
  title: "",
  timeLimit: 30,
  questions: [createEmptyQuestion(0)],
});
