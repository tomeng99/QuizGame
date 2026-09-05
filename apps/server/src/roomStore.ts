import type {
  PublicQuestion,
  QuestionRoundResult,
  QuizDraft,
  RoomSnapshot,
  SubmitAnswerPayload,
} from "@quizgame/contracts";

// ── Domain types ───────────────────────────────────────────────────────────────

export interface StoredPlayer {
  id: string; // stable UUID — this player's PUBLIC id, broadcast in every snapshot
  /**
   * Secret UUID that proves ownership of this player's session on
   * "player:reconnect". Distinct from `id` on purpose: `id` is broadcast to
   * every client in the room, so reusing it as the credential would let any
   * player read another player's token out of a snapshot and take over their
   * session. Never put this in a payload sent to anyone but its owner.
   */
  reconnectToken: string;
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
  /**
   * Whole-game counters behind the post-game recap. Accumulated as each round
   * closes, because the per-round answers they are derived from are cleared
   * immediately afterwards.
   */
  /** Rounds answered exactly right. Polls never count towards this. */
  correctAnswerCount: number;
  /** Rounds that closed without this player submitting anything. */
  missedQuestionCount: number;
  /** Highest value `streak` reached at any point in the game. */
  bestStreak: number;
}

export interface StoredRoom {
  code: string;
  hostSocketId: string | null; // null while host grace-period timer is running
  hostId: string; // stable UUID — the host's public id (never a credential)
  hostToken: string; // secret UUID — the reconnect token for the host
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
  /** One entry per round that has closed, in play order. Feeds the post-game recap. */
  roundResults: QuestionRoundResult[];
}

// ── RoomStore interface ────────────────────────────────────────────────────────

/**
 * Abstraction over room persistence. The in-memory implementation mirrors the
 * previous bare `Map<string, StoredRoom>`. A Redis-backed implementation can be
 * dropped in later for persistence across restarts and horizontal scaling.
 */
export interface RoomStore {
  /** Returns the room for `code`, or `undefined` if no such room exists. */
  getRoom(code: string): StoredRoom | undefined;
  /** Inserts or replaces the room stored under `room.code`. */
  setRoom(code: string, room: StoredRoom): void;
  /** Removes the room stored under `code`. No-op if it does not exist. */
  deleteRoom(code: string): void;
  /** Returns true if a room is stored under `code`. */
  hasRoom(code: string): boolean;
  /** Returns an iterable over every stored room. */
  getAllRooms(): Iterable<StoredRoom>;
  /** Returns the number of rooms currently stored. */
  getRoomCount(): number;
}

// ── In-memory implementation ──────────────────────────────────────────────────

/**
 * Backed by a plain `Map`. This is functionally identical to the previous
 * module-level `const rooms = new Map<string, StoredRoom>()`.
 */
export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, StoredRoom>();

  getRoom(code: string): StoredRoom | undefined {
    return this.rooms.get(code);
  }

  setRoom(code: string, room: StoredRoom): void {
    this.rooms.set(code, room);
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code);
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  getAllRooms(): Iterable<StoredRoom> {
    return this.rooms.values();
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
