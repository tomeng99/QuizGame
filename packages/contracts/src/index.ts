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

export const createEmptyQuestion = (index: number): QuizQuestion => ({
  id: `question-${index + 1}`,
  prompt: `Question ${index + 1}`,
  options: [
    { id: `q${index + 1}-a`, text: "Option 1" },
    { id: `q${index + 1}-b`, text: "Option 2" },
    { id: `q${index + 1}-c`, text: "Option 3" },
    { id: `q${index + 1}-d`, text: "Option 4" },
  ],
  correctOptionId: `q${index + 1}-a`,
});

export const createStarterQuiz = (): QuizDraft => ({
  title: "Friday Quiz Night",
  questions: [
    {
      id: "question-1",
      prompt: "Which technology is usually the most practical base for realtime multiplayer quiz logic?",
      options: [
        { id: "q1-a", text: "Client-server with realtime sockets" },
        { id: "q1-b", text: "Pure email" },
        { id: "q1-c", text: "Spreadsheet sync" },
        { id: "q1-d", text: "Manual scorekeeping only" }
      ],
      correctOptionId: "q1-a"
    }
  ]
});
