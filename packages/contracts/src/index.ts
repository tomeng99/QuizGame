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

export type QuizQuestion = MultipleChoiceQuestion | PollQuestion | NumberQuestion | RankingQuestion;

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

/**
 * Fields every public question carries, whatever its type.
 *
 * `endsAt` and `serverNow` make the countdown server-authoritative: the server owns
 * the deadline, and the client derives the seconds remaining from it rather than
 * counting down locally from `timeLimit`. `serverNow` is stamped fresh on every emit
 * so the client can correct for a device clock that disagrees with the server's.
 */
interface PublicQuestionBase {
  id: string;
  prompt: string;
  index: number;
  total: number;
  timeLimit: number;
  /** Epoch ms, on the server's clock, when this question stops accepting answers. */
  endsAt: number;
  /** The server's clock at the moment this payload was sent. */
  serverNow: number;
}

export type PublicQuestion =
  | (PublicQuestionBase & {
      type: "multiple-choice";
      options: QuizOption[];
    })
  | (PublicQuestionBase & {
      type: "poll";
      options: QuizOption[];
    })
  | (PublicQuestionBase & {
      type: "number";
      minValue: number;
      maxValue: number;
    })
  | (PublicQuestionBase & {
      type: "ranking";
      items: RankingItem[];
    });

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
  /**
   * This client's public identity in the room. Safe to compare against
   * `LeaderboardEntry.playerId` / `PlayerSummary.id`, both of which are
   * broadcast to everyone in the room.
   */
  playerId: string;
  /**
   * Secret credential proving this client owns the session, sent only to the
   * client it belongs to. Never appears in a RoomSnapshot — anyone holding it
   * can reclaim the session via "player:reconnect" / "host:reconnect".
   */
  reconnectToken: string;
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

/**
 * How one question went, recorded on the server as its round closed.
 *
 * Carries the prompt itself because the post-game recap outlives the question
 * payloads: by the time this is shown the client has long since dropped the
 * `PublicQuestion` it was rendering.
 */
export interface QuestionRoundResult {
  questionId: string;
  prompt: string;
  type: QuestionType;
  /** Zero-based position of this question in the quiz. */
  index: number;
  /** Players who got an answer in before the round closed. */
  answeredCount: number;
  /** Players in the room when the round closed. */
  playerCount: number;
  /**
   * Players who answered exactly right. `null` for polls, which have no correct
   * answer — so the recap can leave them out of accuracy figures entirely rather
   * than scoring them as zero.
   */
  correctCount: number | null;
}

/** One player's whole-game record, shown to them on the post-game recap. */
export interface PlayerGameStats {
  playerId: string;
  name: string;
  score: number;
  /** Rounds this player answered exactly right. Polls never count towards this. */
  correctAnswers: number;
  /** Rounds that closed without this player submitting anything. */
  missedQuestions: number;
  /** Longest run of consecutive correct answers reached during the game. */
  bestStreak: number;
}

/**
 * The end-of-game recap. Built once, when the game finishes, and sent with
 * "game:finished". The client cannot reconstruct any of it: per-round answers are
 * discarded as each question closes, so the server is the only place this exists.
 */
export interface GameSummary {
  /** Rounds actually played, in play order. */
  questions: QuestionRoundResult[];
  /** How many of those rounds had a right answer to get. Polls are excluded. */
  scorableQuestions: number;
  /** Ordered like `RoomSnapshot.leaderboard` — highest score first. */
  players: PlayerGameStats[];
}

/**
 * Payload of "game:finished". A superset of RoomSnapshot, so a client that
 * predates the recap still reads every snapshot field it knows and ignores
 * `summary` — which keeps an old client working against a new server mid-deploy.
 */
export interface GameFinishedPayload extends RoomSnapshot {
  summary: GameSummary;
}

export interface RoomRejoinedPayload {
  room: RoomSnapshot;
  currentQuestion: PublicQuestion | null;
  isHost: boolean;
  /**
   * This client's public identity in the room, re-sent so the client can find
   * itself in `room.leaderboard` without holding on to its reconnect token.
   */
  playerId: string;
}

export interface PlayerReconnectPayload {
  token: string;
}

export interface HostReconnectPayload {
  token: string;
}

// ── Socket protocol ───────────────────────────────────────────────────────────

/**
 * Every event the server sends, with the payload it carries.
 *
 * This is the wire protocol, and it is the reason the payload interfaces above
 * exist: passed to socket.io's generics on both sides, it makes a mistyped event
 * name or a payload of the wrong shape a compile error instead of an event that
 * silently never arrives. Add an event here before wiring it up anywhere else.
 *
 * Both apps move together when this changes — see the deploy note on
 * `GameFinishedPayload` for what an old client does with a newer payload.
 */
export interface ServerToClientEvents {
  "room:checked": (result: CheckRoomResult) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
  "room:rejoined": (payload: RoomRejoinedPayload) => void;
  "room:update": (snapshot: RoomSnapshot) => void;
  "room:answer-count": (payload: AnswerCountPayload) => void;
  "room:closed": (payload: ErrorMessagePayload) => void;
  "question:started": (question: PublicQuestion) => void;
  "question:revealed": (payload: QuestionRevealPayload) => void;
  "answer:accepted": (payload: AnswerAcceptedPayload) => void;
  "leaderboard:update": (snapshot: RoomSnapshot) => void;
  "game:finished": (payload: GameFinishedPayload) => void;
  "error:message": (payload: ErrorMessagePayload) => void;
}

/**
 * Every event a client sends, with the payload a well-behaved client sends with it.
 *
 * These shapes describe intent, not a guarantee: anyone can open a socket and emit
 * whatever they like, so the server still takes each of these as `unknown` and
 * validates it before use. What this buys on the server side is the event *names* —
 * a handler registered for an event no client sends is a compile error.
 */
export interface ClientToServerEvents {
  "host:create-room": (payload: HostCreateRoomPayload) => void;
  "host:start-game": (roomCode: string) => void;
  "host:show-leaderboard": (roomCode: string) => void;
  "host:next-question": (roomCode: string) => void;
  "host:reconnect": (payload: HostReconnectPayload) => void;
  "player:check-room": (payload: CheckRoomPayload) => void;
  "player:join-room": (payload: PlayerJoinPayload) => void;
  "player:reconnect": (payload: PlayerReconnectPayload) => void;
  "player:submit-answer": (payload: SubmitAnswerPayload) => void;
}

/**
 * What the server hangs off `socket.data` — the seat this connection currently holds.
 *
 * Server-side only (it never crosses the wire), but it lives here so socket.io's
 * `SocketData` generic is filled in from the same place as the rest of the protocol.
 * Every field is optional because a socket starts out holding no seat at all.
 */
export interface SocketSessionData {
  roomCode?: string;
  role?: "host" | "player";
  /** The seat's secret reconnect token. Never sent to anyone but its owner. */
  token?: string;
  /** This connection's public player id — the host's id when `role` is "host". */
  playerId?: string;
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
