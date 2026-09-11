/** App-specific types that are not shared via @quizgame/contracts. */

import type { ClientToServerEvents, ServerToClientEvents } from "@quizgame/contracts";
import type { Socket } from "socket.io-client";

/**
 * The app's socket, pinned to the protocol in `@quizgame/contracts`.
 *
 * socket.io-client's bare `Socket` accepts any event name with any payload, so a
 * renamed server event or a changed payload shape would only show up as a screen
 * that quietly stops updating. Using this alias everywhere instead makes both a
 * compile error.
 */
export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
