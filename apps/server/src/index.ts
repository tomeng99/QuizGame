import { randomUUID } from "crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server, type Socket } from "socket.io";
import {
  AnswerAcceptedPayload,
  AnswerCountPayload,
  CheckRoomPayload,
  CheckRoomResult,
  HostReconnectPayload,
  LeaderboardEntry,
  PlayerJoinPayload,
  PlayerReconnectPayload,
  PlayerSummary,
  PublicQuestion,
  QuestionRevealPayload,
  QuizDraft,
  QuizQuestion,
  RoomRejoinedPayload,
  RoomSnapshot,
  SubmitAnswerPayload,
} from "@quizgame/contracts";

// ── Domain types ───────────────────────────────────────────────────────────────

interface StoredPlayer {
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

interface StoredRoom {
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

// ── App setup ──────────────────────────────────────────────────────────────────

const app = Fastify({ logger: true });

/** Active rooms keyed by room code. */
const rooms = new Map<string, StoredRoom>();

/** Maps a stable token (player/host UUID) to its room and role, enabling reconnects. */
const tokenStore = new Map<string, { roomCode: string; role: "host" | "player" }>();

/** Per-socket sliding-window rate limits: socketId → event → { count, windowStart }. */
const rateLimits = new Map<string, Map<string, { count: number; windowStart: number }>>();

let io: Server;

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PLAYERS_PER_ROOM = 100;
const MAX_QUESTIONS = 50;
const MAX_PROMPT_LENGTH = 500;
const MAX_OPTION_TEXT_LENGTH = 200;
const MAX_NAME_LENGTH = 50;
const HOST_RECONNECT_GRACE_MS = 60_000;  // 60 s before closing a host-less room
const ROOM_CLEANUP_DELAY_MS = 30 * 60_000; // 30 min after game finishes

// ── Origin helpers ─────────────────────────────────────────────────────────────

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins && configuredOrigins.length > 0 ? configuredOrigins : true;
};

const allowedOrigins = parseAllowedOrigins();

// ── Validation helpers ─────────────────────────────────────────────────────────

const isString = (v: unknown): v is string => typeof v === "string";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Returns true if the event is allowed under the per-socket sliding-window limit.
 * Automatically resets the window after `windowMs` milliseconds.
 */
const checkRateLimit = (
  socketId: string,
  event: string,
  maxCount: number,
  windowMs: number,
): boolean => {
  let socketLimits = rateLimits.get(socketId);
  if (!socketLimits) {
    socketLimits = new Map();
    rateLimits.set(socketId, socketLimits);
  }
  const now = Date.now();
  const entry = socketLimits.get(event);
  if (!entry || now - entry.windowStart > windowMs) {
    socketLimits.set(event, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxCount) {
    return false;
  }
  entry.count += 1;
  return true;
};

// ── Room code generation ───────────────────────────────────────────────────────

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

const createRoomCode = () => {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  return code;
};

// ── Quiz normalisation (with runtime validation and size caps) ─────────────────

const normalizeQuestion = (question: unknown, index: number): QuizQuestion | null => {
  if (typeof question !== "object" || question === null) return null;
  const q = question as Record<string, unknown>;

  const prompt = isString(q.prompt) ? q.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : "";
  const id = isString(q.id) && q.id ? q.id : `question-${index + 1}`;
  const type = q.type === "poll" || q.type === "number" || q.type === "ranking"
    ? q.type
    : "multiple-choice";

  if (!prompt) return null;

  if (type === "multiple-choice" || type === "poll") {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions
      .slice(0, 10)
      .map((option: unknown, optionIndex: number) => {
        const o = (typeof option === "object" && option !== null ? option : {}) as Record<
          string,
          unknown
        >;
        return {
          id: isString(o.id) && o.id ? o.id : `q${index + 1}-o${optionIndex + 1}`,
          text: isString(o.text) ? o.text.trim().slice(0, MAX_OPTION_TEXT_LENGTH) : "",
        };
      })
      .filter((option) => option.text.length > 0);

    if (options.length < 2) return null;

    if (type === "poll") {
      return {
        id,
        prompt,
        type,
        options,
      };
    }

    const correctOptionId =
      options.some((option) => option.id === q.correctOptionId)
        ? (q.correctOptionId as string)
        : options[0].id;

    return {
      id,
      prompt,
      type,
      options,
      correctOptionId,
    };
  }

  if (type === "number") {
    if (
      !isFiniteNumber(q.correctNumber) ||
      !isFiniteNumber(q.minValue) ||
      !isFiniteNumber(q.maxValue) ||
      q.minValue >= q.maxValue
    ) {
      return null;
    }

    return {
      id,
      prompt,
      type,
      correctNumber: q.correctNumber,
      minValue: q.minValue,
      maxValue: q.maxValue,
    };
  }

  const rawItems = Array.isArray(q.items) ? q.items : [];
  const items = rawItems
    .slice(0, 5)
    .map((item: unknown, itemIndex: number) => {
      const entry = (typeof item === "object" && item !== null ? item : {}) as Record<
        string,
        unknown
      >;
      return {
        id: isString(entry.id) && entry.id ? entry.id : `q${index + 1}-r${itemIndex + 1}`,
        text: isString(entry.text) ? entry.text.trim().slice(0, MAX_OPTION_TEXT_LENGTH) : "",
      };
    })
    .filter((item) => item.text.length > 0);

  if (items.length < 3 || items.length > 5) return null;

  const correctOrder = Array.isArray(q.correctOrder)
    ? q.correctOrder.filter((value): value is string => isString(value) && value.length > 0)
    : [];
  const itemIds = items.map((item) => item.id);
  const itemIdSet = new Set(itemIds);
  const orderSet = new Set(correctOrder);

  if (
    correctOrder.length !== items.length ||
    orderSet.size !== items.length ||
    itemIdSet.size !== items.length ||
    itemIds.some((itemId) => !orderSet.has(itemId))
  ) {
    return null;
  }

  return {
    id,
    prompt,
    type,
    items,
    correctOrder,
  };
};

const normalizeQuiz = (raw: unknown): QuizDraft => {
  const q = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const title = isString(q.title) ? q.title.trim().slice(0, 200) : "";

  // Accept any numeric timeLimit from the client, but clamp it to a safe [10, 120] second range
  // and round to a whole number. Falls back to 30 s when the field is absent or non-numeric.
  const rawTimeLimit = typeof q.timeLimit === "number" ? q.timeLimit : 30;
  const timeLimit = Math.max(10, Math.min(120, Math.round(rawTimeLimit)));

  const rawQuestions = Array.isArray(q.questions) ? q.questions : [];
  return {
    title: title || "Untitled Quiz",
    timeLimit,
    questions: rawQuestions
      .slice(0, MAX_QUESTIONS)
      .map((question, index) => normalizeQuestion(question, index))
      .filter((question): question is QuizQuestion => question !== null),
  };
};

// ── Snapshot builders ─────────────────────────────────────────────────────────

const toLeaderboard = (room: StoredRoom): LeaderboardEntry[] =>
  Array.from(room.players.values())
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score,
      answeredCurrentQuestion:
        room.currentQuestionIndex !== null &&
        player.lastAnsweredQuestionId === room.quiz.questions[room.currentQuestionIndex]?.id,
      streak: player.streak,
      // Compute the net points earned this round by diffing against the pre-question snapshot.
      // This gives the client a "score delta" without needing a separate event.
      pointsEarnedThisRound: player.score - player.scoreBeforeCurrentQuestion,
    }));

const toPlayers = (room: StoredRoom): PlayerSummary[] =>
  Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    connected: player.connected,
  }));

const toSnapshot = (room: StoredRoom): RoomSnapshot => ({
  roomCode: room.code,
  hostName: room.hostName,
  quizTitle: room.quiz.title,
  status: room.status,
  currentQuestionIndex: room.currentQuestionIndex,
  totalQuestions: room.quiz.questions.length,
  players: toPlayers(room),
  leaderboard: toLeaderboard(room),
});

const shuffleItems = <T,>(items: T[]): T[] => {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

const toPublicQuestion = (
  question: QuizQuestion,
  index: number,
  total: number,
  timeLimit: number,
): PublicQuestion => {
  const base = {
    id: question.id,
    prompt: question.prompt,
    index,
    total,
    timeLimit,
  };

  switch (question.type) {
    case "multiple-choice":
      return {
        ...base,
        type: "multiple-choice",
        options: question.options,
      };
    case "poll":
      return {
        ...base,
        type: "poll",
        options: question.options,
      };
    case "number":
      return {
        ...base,
        type: "number",
        minValue: question.minValue,
        maxValue: question.maxValue,
      };
    case "ranking":
      return {
        ...base,
        type: "ranking",
        items: shuffleItems(question.items),
      };
  }
};

// ── Emit helpers ──────────────────────────────────────────────────────────────

const emitRoomUpdate = (room: StoredRoom) => {
  io.to(room.code).emit("room:update", toSnapshot(room));
};

const emitRoomClosed = (room: StoredRoom, message: string) => {
  io.to(room.code).emit("room:closed", { message });
};

const emitLeaderboard = (room: StoredRoom) => {
  // Cancel any pending auto-advance timer so the leaderboard is only shown once.
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }

  const question =
    room.currentQuestionIndex !== null
      ? room.quiz.questions[room.currentQuestionIndex]
      : null;
  let revealPayload: QuestionRevealPayload | null = null;

  if (question) {
    switch (question.type) {
      case "multiple-choice": {
        revealPayload = {
          type: "multiple-choice",
          correctOptionId: question.correctOptionId,
        };
        break;
      }
      case "poll": {
        const voteCounts = Object.fromEntries(question.options.map((option) => [option.id, 0]));
        const rankedOptions = question.options.map((option, optionIndex) => ({
          optionId: option.id,
          optionIndex,
          count: 0,
        }));

        for (const player of room.players.values()) {
          if (player.currentAnswer?.type !== "poll") continue;
          voteCounts[player.currentAnswer.optionId] =
            (voteCounts[player.currentAnswer.optionId] ?? 0) + 1;
        }

        rankedOptions.forEach((entry) => {
          entry.count = voteCounts[entry.optionId] ?? 0;
        });
        rankedOptions.sort(
          (left, right) => right.count - left.count || left.optionIndex - right.optionIndex,
        );

        const majorityOptionId = rankedOptions[0]?.optionId ?? question.options[0]?.id ?? "";
        const secondOptionId = rankedOptions[1]?.optionId ?? null;

        for (const player of room.players.values()) {
          if (player.currentAnswer?.type !== "poll") continue;
          if (player.currentAnswer.optionId === majorityOptionId) {
            player.score += 1000;
          } else if (secondOptionId && player.currentAnswer.optionId === secondOptionId) {
            player.score += 400;
          }
        }

        revealPayload = {
          type: "poll",
          voteCounts,
          majorityOptionId,
        };
        break;
      }
      case "number": {
        const range = question.maxValue - question.minValue;

        for (const player of room.players.values()) {
          if (player.currentAnswer?.type !== "number") continue;
          const pointsEarned =
            range === 0
              ? 1000
              : Math.max(
                  0,
                  Math.round(
                    1000 * (1 - Math.abs(player.currentAnswer.guess - question.correctNumber) / range),
                  ),
                );
          player.score += pointsEarned;
        }

        revealPayload = {
          type: "number",
          correctNumber: question.correctNumber,
        };
        break;
      }
      case "ranking": {
        for (const player of room.players.values()) {
          if (player.currentAnswer?.type !== "ranking") continue;
          const rankingAnswer = player.currentAnswer;
          const correctlyPlacedCount = question.correctOrder.reduce(
            (count, itemId, itemIndex) =>
              count + (rankingAnswer.order[itemIndex] === itemId ? 1 : 0),
            0,
          );
          player.score += Math.round((1000 * correctlyPlacedCount) / question.correctOrder.length);
        }

        revealPayload = {
          type: "ranking",
          correctOrder: question.correctOrder,
        };
        break;
      }
    }
  }

  for (const player of room.players.values()) {
    player.currentAnswer = null;
  }

  room.status = "leaderboard";

  if (revealPayload) {
    io.to(room.code).emit("question:revealed", revealPayload);
  }

  io.to(room.code).emit("leaderboard:update", toSnapshot(room));
};

/**
 * Broadcasts a lightweight answer count to all room members.
 * Called after each answer instead of the full room snapshot, reducing
 * broadcast volume from O(N²) to O(N) during the answering phase.
 */
const emitAnswerCount = (room: StoredRoom) => {
  const question =
    room.currentQuestionIndex !== null
      ? room.quiz.questions[room.currentQuestionIndex]
      : null;
  const answeredCount = question
    ? Array.from(room.players.values()).filter(
        (p) => p.lastAnsweredQuestionId === question.id,
      ).length
    : 0;
  const payload: AnswerCountPayload = {
    answeredCount,
    totalPlayers: room.players.size,
  };
  io.to(room.code).emit("room:answer-count", payload);
};

const emitError = (socket: Socket, message: string) => {
  socket.emit("error:message", { message });
};

// ── Game lifecycle ────────────────────────────────────────────────────────────

const startQuestion = (room: StoredRoom, questionIndex: number) => {
  // Guard: cancel any previous auto-advance timer before starting a new question.
  // This prevents an edge case where a rapid "next question" from the host could
  // fire the leaderboard event on the newly-started question.
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }

  room.currentQuestionIndex = questionIndex;
  room.questionStartedAt = Date.now();
  room.status = "question";

  for (const player of room.players.values()) {
    // Snapshot each player's score at question start so we can compute pointsEarnedThisRound
    // when building the leaderboard entry after the question closes.
    player.scoreBeforeCurrentQuestion = player.score;
    player.lastAnsweredQuestionId = null;
    player.currentAnswer = null;
  }

  const question = room.quiz.questions[questionIndex];
  const { timeLimit } = room.quiz;
  room.activePublicQuestion = toPublicQuestion(
    question,
    questionIndex,
    room.quiz.questions.length,
    timeLimit,
  );
  app.log.info({ roomCode: room.code, questionIndex }, "question started");

  io.to(room.code).emit("question:started", room.activePublicQuestion);
  emitRoomUpdate(room);

  // Schedule the server-side auto-advance. When all players answer early the manual
  // path (emitLeaderboard) cancels this timer, so it only fires if time genuinely runs out.
  room.questionAutoTimer = setTimeout(() => {
    if (room.status === "question") {
      app.log.info({ roomCode: room.code, questionIndex }, "question timed out — auto-advancing");
      emitLeaderboard(room);
    }
  }, timeLimit * 1000);
};

/** Remove a room and all its associated token entries from every store. */
const deleteRoom = (room: StoredRoom) => {
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }
  tokenStore.delete(room.hostToken);
  for (const playerId of room.players.keys()) {
    tokenStore.delete(playerId);
  }
  rooms.delete(room.code);
  app.log.info({ roomCode: room.code }, "room deleted");
};

const finishGame = (room: StoredRoom) => {
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }
  room.status = "finished";
  room.currentQuestionIndex = null;
  room.questionStartedAt = null;
  room.activePublicQuestion = null;
  app.log.info({ roomCode: room.code, players: room.players.size }, "game finished");
  io.to(room.code).emit("game:finished", toSnapshot(room));

  // Schedule cleanup so finished rooms do not accumulate in memory indefinitely.
  room.cleanupTimer = setTimeout(() => deleteRoom(room), ROOM_CLEANUP_DELAY_MS);
};

// ── Reconnect helper ──────────────────────────────────────────────────────────

/**
 * Binds a (re)connecting socket to an existing room and sends the current
 * room state so the client can restore its UI without a full page reload.
 */
const restoreSocketToRoom = (
  socket: Socket,
  room: StoredRoom,
  token: string,
  role: "host" | "player",
) => {
  socket.data.roomCode = room.code;
  socket.data.role = role;
  socket.data.token = token;
  socket.join(room.code);

  const currentQuestion =
    (room.status === "question" || room.status === "leaderboard") &&
    room.currentQuestionIndex !== null
      ? room.activePublicQuestion ??
        toPublicQuestion(
          room.quiz.questions[room.currentQuestionIndex],
          room.currentQuestionIndex,
          room.quiz.questions.length,
          room.quiz.timeLimit,
        )
      : null;

  const payload: RoomRejoinedPayload = {
    room: toSnapshot(room),
    currentQuestion,
    isHost: role === "host",
  };
  socket.emit("room:rejoined", payload);
};

// ── Realtime event handlers ───────────────────────────────────────────────────

const registerRealtimeHandlers = () => {
  io.on("connection", (socket) => {
    // ── Host: create a new room ──────────────────────────────────────────────

    socket.on("host:create-room", (payload: unknown) => {
      if (!checkRateLimit(socket.id, "host:create-room", 5, 60_000)) {
        emitError(socket, "Too many requests. Please wait before creating another room.");
        return;
      }

      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const p = payload as Record<string, unknown>;
      const hostName = isString(p.hostName) ? p.hostName.trim().slice(0, MAX_NAME_LENGTH) : "";

      if (!hostName) {
        emitError(socket, "Host name is required.");
        return;
      }

      const quiz = normalizeQuiz(p.quiz);

      if (quiz.questions.length === 0) {
        emitError(socket, "Add at least one valid question before hosting.");
        return;
      }

      const code = createRoomCode();
      const hostToken = randomUUID();
      const room: StoredRoom = {
        code,
        hostSocketId: socket.id,
        hostToken,
        hostName,
        quiz,
        status: "lobby",
        currentQuestionIndex: null,
        questionStartedAt: null,
        activePublicQuestion: null,
        players: new Map(),
        hostCloseTimer: null,
        cleanupTimer: null,
        questionAutoTimer: null,
      };

      rooms.set(code, room);
      tokenStore.set(hostToken, { roomCode: code, role: "host" });
      socket.data.roomCode = code;
      socket.data.role = "host";
      socket.data.token = hostToken;
      socket.join(code);

      app.log.info({ roomCode: code, hostName }, "room created");

      socket.emit("room:joined", {
        playerId: hostToken,
        room: toSnapshot(room),
      });
    });

    // ── Player: check room before joining ────────────────────────────────────

    socket.on("player:check-room", (payload: unknown) => {
      if (!checkRateLimit(socket.id, "player:check-room", 5, 10_000)) {
        emitError(socket, "Too many requests. Please wait before checking again.");
        return;
      }

      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const p = payload as CheckRoomPayload;

      if (!isString(p.roomCode)) {
        emitError(socket, "Room code is required.");
        return;
      }

      const roomCode = p.roomCode.trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        emitError(socket, "Room not found. Check the code and try again.");
        return;
      }

      if (room.status === "question" || room.status === "leaderboard") {
        emitError(socket, "This quiz has already started.");
        return;
      }

      if (room.status === "finished") {
        emitError(socket, "This quiz has already finished.");
        return;
      }

      const result: CheckRoomResult = {
        roomCode: room.code,
        hostName: room.hostName,
        quizTitle: room.quiz.title,
        playerCount: room.players.size,
      };

      socket.emit("room:checked", result);
    });

    // ── Player: join a room ──────────────────────────────────────────────────

    socket.on("player:join-room", (payload: unknown) => {
      if (!checkRateLimit(socket.id, "player:join-room", 3, 30_000)) {
        emitError(socket, "Too many join attempts. Please wait before trying again.");
        return;
      }

      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const p = payload as PlayerJoinPayload;

      if (!isString(p.roomCode) || !isString(p.name)) {
        emitError(socket, "Room code and name are required.");
        return;
      }

      const roomCode = p.roomCode.trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        emitError(socket, "Room not found. Check the code and try again.");
        return;
      }

      if (room.status === "question" || room.status === "leaderboard") {
        emitError(socket, "This quiz has already started.");
        return;
      }

      if (room.status === "finished") {
        emitError(socket, "This quiz has already finished.");
        return;
      }

      const name = p.name.trim().slice(0, MAX_NAME_LENGTH);

      if (!name) {
        emitError(socket, "Player name is required.");
        return;
      }

      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        emitError(socket, "This room is full.");
        return;
      }

      const duplicateName = Array.from(room.players.values()).some(
        (player) => player.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicateName) {
        emitError(socket, "That player name is already taken in this room.");
        return;
      }

      const playerId = randomUUID();
      const player: StoredPlayer = {
        id: playerId,
        socketId: socket.id,
        name,
        score: 0,
        connected: true,
        lastAnsweredQuestionId: null,
        streak: 0,
        scoreBeforeCurrentQuestion: 0,
        currentAnswer: null,
      };

      room.players.set(playerId, player);
      tokenStore.set(playerId, { roomCode: room.code, role: "player" });
      socket.data.roomCode = room.code;
      socket.data.role = "player";
      socket.data.token = playerId;
      socket.join(room.code);

      app.log.info({ roomCode: room.code, playerName: name }, "player joined");

      socket.emit("room:joined", {
        playerId,
        room: toSnapshot(room),
      });
      emitRoomUpdate(room);
    });

    // ── Player: reconnect after socket drop ─────────────────────────────────

    socket.on("player:reconnect", (payload: unknown) => {
      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const p = payload as PlayerReconnectPayload;

      if (!isString(p.token)) {
        emitError(socket, "Reconnect token is required.");
        return;
      }

      const entry = tokenStore.get(p.token);

      if (!entry || entry.role !== "player") {
        emitError(socket, "Session not found. Please re-join the room.");
        return;
      }

      const room = rooms.get(entry.roomCode);

      if (!room) {
        emitError(socket, "The room no longer exists.");
        return;
      }

      const player = room.players.get(p.token);

      if (!player) {
        emitError(socket, "Player not found. Please re-join the room.");
        return;
      }

      player.socketId = socket.id;
      player.connected = true;
      app.log.info({ roomCode: room.code, playerName: player.name }, "player reconnected");

      restoreSocketToRoom(socket, room, p.token, "player");
      emitRoomUpdate(room);
    });

    // ── Host: reconnect after socket drop ────────────────────────────────────

    socket.on("host:reconnect", (payload: unknown) => {
      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const p = payload as HostReconnectPayload;

      if (!isString(p.token)) {
        emitError(socket, "Reconnect token is required.");
        return;
      }

      const entry = tokenStore.get(p.token);

      if (!entry || entry.role !== "host") {
        emitError(socket, "Host session not found. The room may have closed.");
        return;
      }

      const room = rooms.get(entry.roomCode);

      if (!room) {
        emitError(socket, "The room no longer exists.");
        return;
      }

      if (room.hostToken !== p.token) {
        emitError(socket, "Invalid host session.");
        return;
      }

      // Cancel the pending close timer if the host reconnected in time.
      if (room.hostCloseTimer !== null) {
        clearTimeout(room.hostCloseTimer);
        room.hostCloseTimer = null;
      }

      room.hostSocketId = socket.id;
      app.log.info({ roomCode: room.code }, "host reconnected");

      restoreSocketToRoom(socket, room, p.token, "host");
    });

    // ── Host: start the game ─────────────────────────────────────────────────

    socket.on("host:start-game", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());

      if (!room || room.hostSocketId !== socket.id) {
        emitError(socket, "Only the host can start the game.");
        return;
      }

      if (room.players.size === 0) {
        emitError(socket, "At least one player must join before starting.");
        return;
      }

      if (room.status !== "lobby") {
        emitError(socket, "The game has already started.");
        return;
      }

      app.log.info({ roomCode: room.code, players: room.players.size }, "game started");
      startQuestion(room, 0);
    });

    // ── Host: reveal the leaderboard ─────────────────────────────────────────

    socket.on("host:show-leaderboard", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());

      if (!room || room.hostSocketId !== socket.id) {
        emitError(socket, "Only the host can reveal the leaderboard.");
        return;
      }

      if (room.status !== "question") {
        emitError(socket, "There is no active question to score.");
        return;
      }

      emitLeaderboard(room);
    });

    // ── Host: advance to the next question ───────────────────────────────────

    socket.on("host:next-question", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());

      if (!room || room.hostSocketId !== socket.id) {
        emitError(socket, "Only the host can advance the game.");
        return;
      }

      if (room.status === "lobby") {
        emitError(socket, "Start the game before moving to the next question.");
        return;
      }

      // Guard against restarting a game that has already finished.
      if (room.status === "finished") {
        emitError(socket, "The game has already finished.");
        return;
      }

      const nextIndex =
        room.currentQuestionIndex === null ? 0 : room.currentQuestionIndex + 1;

      if (nextIndex >= room.quiz.questions.length) {
        finishGame(room);
        return;
      }

      startQuestion(room, nextIndex);
    });

    // ── Player: submit an answer ─────────────────────────────────────────────

    socket.on("player:submit-answer", (payload: unknown) => {
      if (!checkRateLimit(socket.id, "player:submit-answer", 10, 10_000)) {
        emitError(socket, "Too many requests.");
        return;
      }

      if (typeof payload !== "object" || payload === null) {
        emitError(socket, "Invalid request.");
        return;
      }

      const ans = payload as Partial<SubmitAnswerPayload> & Record<string, unknown>;

      if (!isString(ans.roomCode) || !isString(ans.type)) {
        emitError(socket, "Invalid answer payload.");
        return;
      }

      const room = rooms.get(ans.roomCode.toUpperCase());

      if (!room || room.status !== "question" || room.currentQuestionIndex === null) {
        emitError(socket, "There is no active question right now.");
        return;
      }

      const player = room.players.get(socket.data.token as string);

      if (!player) {
        emitError(socket, "Join the room before answering.");
        return;
      }

      const question = room.quiz.questions[room.currentQuestionIndex];

      if (player.lastAnsweredQuestionId === question.id) {
        emitError(socket, "You already answered this question.");
        return;
      }

      if (ans.type !== question.type) {
        emitError(socket, "That answer does not match the current question type.");
        return;
      }

      let acceptedPayload: AnswerAcceptedPayload;

      switch (question.type) {
        case "multiple-choice": {
          if (!isString(ans.optionId)) {
            emitError(socket, "That answer option is not valid.");
            return;
          }

          const selectedOption = question.options.find((option) => option.id === ans.optionId);

          if (!selectedOption) {
            emitError(socket, "That answer option is not valid.");
            return;
          }

          player.lastAnsweredQuestionId = question.id;
          player.currentAnswer = null;

          let isCorrect = false;
          let pointsEarned = 0;

          if (ans.optionId === question.correctOptionId) {
            isCorrect = true;
            player.streak += 1;

            const elapsedMs = Math.max(0, Date.now() - (room.questionStartedAt ?? Date.now()));
            const timeFraction = Math.min(elapsedMs / (room.quiz.timeLimit * 1000), 1);
            const basePoints = Math.max(300, Math.round(1000 - 700 * timeFraction));
            const streakBonus =
              player.streak >= 5 ? 300
              : player.streak >= 3 ? 150
              : player.streak >= 2 ? 75
              : 0;

            pointsEarned = basePoints + streakBonus;
            player.score += pointsEarned;
          } else {
            player.streak = 0;
          }

          acceptedPayload = {
            pending: false,
            isCorrect,
            pointsEarned,
            streak: player.streak,
          };
          break;
        }
        case "poll": {
          if (!isString(ans.optionId) || !question.options.some((option) => option.id === ans.optionId)) {
            emitError(socket, "That answer option is not valid.");
            return;
          }

          player.lastAnsweredQuestionId = question.id;
          player.currentAnswer = {
            roomCode: room.code,
            type: "poll",
            optionId: ans.optionId,
          };
          acceptedPayload = {
            pending: true,
            isCorrect: false,
            pointsEarned: 0,
            streak: player.streak,
          };
          break;
        }
        case "number": {
          if (
            !isFiniteNumber(ans.guess) ||
            ans.guess < question.minValue ||
            ans.guess > question.maxValue
          ) {
            emitError(socket, "That guess is outside the allowed range.");
            return;
          }

          player.lastAnsweredQuestionId = question.id;
          player.currentAnswer = {
            roomCode: room.code,
            type: "number",
            guess: ans.guess,
          };
          acceptedPayload = {
            pending: true,
            isCorrect: false,
            pointsEarned: 0,
            streak: player.streak,
          };
          break;
        }
        case "ranking": {
          const order = Array.isArray(ans.order)
            ? ans.order.filter((value): value is string => isString(value) && value.length > 0)
            : [];
          const itemIds = question.items.map((item) => item.id);
          const itemIdSet = new Set(itemIds);
          const orderSet = new Set(order);

          if (
            order.length !== itemIds.length ||
            orderSet.size !== itemIds.length ||
            itemIds.some((itemId) => !orderSet.has(itemId))
          ) {
            emitError(socket, "That ranking order is not valid.");
            return;
          }

          player.lastAnsweredQuestionId = question.id;
          player.currentAnswer = {
            roomCode: room.code,
            type: "ranking",
            order,
          };
          acceptedPayload = {
            pending: true,
            isCorrect: false,
            pointsEarned: 0,
            streak: player.streak,
          };
          break;
        }
      }

      socket.emit("answer:accepted", acceptedPayload);
      emitAnswerCount(room);

      const connectedPlayers = Array.from(room.players.values()).filter((pl) => pl.connected);
      const everyoneAnswered =
        connectedPlayers.length > 0 &&
        connectedPlayers.every((entry) => entry.lastAnsweredQuestionId === question.id);

      if (everyoneAnswered) {
        emitLeaderboard(room);
      }
    });

    // ── Socket disconnect ─────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      // Clean up per-socket rate-limit data to avoid memory growth.
      rateLimits.delete(socket.id);

      const { roomCode, role, token } = socket.data as {
        roomCode?: string;
        role?: "host" | "player";
        token?: string;
      };

      if (!roomCode) return;

      const room = rooms.get(roomCode);
      if (!room) return;

      if (role === "host") {
        // Give the host a grace period to reconnect before closing the room.
        room.hostSocketId = null;
        app.log.info({ roomCode }, "host disconnected — grace period started");

        room.hostCloseTimer = setTimeout(() => {
          const activeRoom = rooms.get(roomCode);
          if (activeRoom && activeRoom.hostSocketId === null) {
            app.log.info({ roomCode }, "host grace period expired — closing room");
            emitRoomClosed(activeRoom, "The host disconnected. This room is now closed.");
            deleteRoom(activeRoom);
          }
        }, HOST_RECONNECT_GRACE_MS);
      } else {
        // Look up the player by their stable token (O(1), no room scan needed).
        if (!token) return;
        const player = room.players.get(token);
        if (player) {
          player.connected = false;
          app.log.info({ roomCode, playerName: player.name }, "player disconnected");
          emitRoomUpdate(room);
        }
      }
    });
  });
};

// ── HTTP server ───────────────────────────────────────────────────────────────

const main = async () => {
  await app.register(cors, {
    origin: allowedOrigins,
  });

  app.get("/", async () => ({
    name: "QuizGame server",
    ok: true,
    endpoints: {
      health: "/health",
      socketIo: "/socket.io",
    },
  }));

  app.get("/health", async () => ({
    ok: true,
    rooms: rooms.size,
    players: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.size, 0),
  }));

  io = new Server(app.server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
    },
  });

  registerRealtimeHandlers();

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
};

void main();
