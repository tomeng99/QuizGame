/** App-specific types that are not shared via @quizgame/contracts. */

export type Screen = "join-code" | "join-name" | "host-setup" | "game";
export type ConnectionState = "connecting" | "connected" | "disconnected";
export type PendingAction =
  | "check-room"
  | "create-room"
  | "join-room"
  | "start-game"
  | "show-leaderboard"
  | "next-question"
  | "submit-answer"
  | null;
export type FeedbackTone = "info" | "success" | "error";

export interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}
