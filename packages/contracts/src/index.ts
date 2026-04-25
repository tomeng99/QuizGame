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
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  index: number;
  total: number;
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
  questions: [createEmptyQuestion(0)],
});
