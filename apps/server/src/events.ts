import type {
  AnswerAcceptedPayload,
  AnswerCountPayload,
  CheckRoomPayload,
  CheckRoomResult,
  GameFinishedPayload,
  HostReconnectPayload,
  PlayerJoinPayload,
  PlayerReconnectPayload,
  QuestionRevealPayload,
  QuizQuestion,
  RoomRejoinedPayload,
  SubmitAnswerPayload,
} from "@quizgame/contracts";
import { randomUUID } from "crypto";
import type { FastifyBaseLogger } from "fastify";
import type { Server, Socket } from "socket.io";
import {
  HOST_RECONNECT_GRACE_MS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS_PER_ROOM,
  ROOM_CLEANUP_DELAY_MS,
} from "./constants";
import { checkRateLimit, rateLimits } from "./rateLimit";
import { createRoomCode } from "./roomCode";
import { toGameSummary, toPublicQuestion, toSnapshot, withServerClock } from "./snapshots";
import { roomStore, tokenStore } from "./store";
import type { StoredPlayer, StoredRoom } from "./types";
import { isFiniteNumber, isString, normalizeQuiz } from "./validation";

// ── Emit helpers ──────────────────────────────────────────────────────────────

const emitRoomUpdate = (io: Server, room: StoredRoom) => {
  io.to(room.code).emit("room:update", toSnapshot(room));
};

const emitRoomClosed = (io: Server, room: StoredRoom, message: string) => {
  io.to(room.code).emit("room:closed", { message });
};

// ── Round bookkeeping ─────────────────────────────────────────────────────────

/**
 * Whether a player's answer was exactly right, for the purposes of the recap's
 * accuracy figures.
 *
 * Deliberately stricter than the scoring above: number and ranking questions award
 * partial credit for being close, but "you got 4 of 7 right" only means something if
 * "right" means right. Polls have no correct answer at all, so they return `null` and
 * are left out of the counts rather than being scored as a miss.
 */
export const isAnswerExactlyCorrect = (
  question: QuizQuestion,
  answer: SubmitAnswerPayload | null,
): boolean | null => {
  switch (question.type) {
    case "poll":
      return null;
    case "multiple-choice":
      return answer?.type === "multiple-choice" && answer.optionId === question.correctOptionId;
    case "number":
      return answer?.type === "number" && answer.guess === question.correctNumber;
    case "ranking":
      return (
        answer?.type === "ranking" &&
        answer.order.length === question.correctOrder.length &&
        question.correctOrder.every((itemId, itemIndex) => answer.order[itemIndex] === itemId)
      );
  }
};

/**
 * Records how a round went, for the post-game recap.
 *
 * Must run before `currentAnswer` is cleared, since that is the only place a player's
 * answer for the closing round still exists.
 */
const recordRoundResult = (room: StoredRoom, question: QuizQuestion) => {
  let answeredCount = 0;
  let correctCount = 0;

  for (const player of room.players.values()) {
    if (player.lastAnsweredQuestionId === question.id) {
      answeredCount += 1;
    } else {
      player.missedQuestionCount += 1;
    }

    if (isAnswerExactlyCorrect(question, player.currentAnswer) === true) {
      correctCount += 1;
      player.correctAnswerCount += 1;
    }
  }

  room.roundResults.push({
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    index: room.currentQuestionIndex ?? room.roundResults.length,
    answeredCount,
    playerCount: room.players.size,
    correctCount: question.type === "poll" ? null : correctCount,
  });
};

const emitLeaderboard = (io: Server, log: FastifyBaseLogger, room: StoredRoom) => {
  // Cancel any pending auto-advance timer so the leaderboard is only shown once.
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }

  const question =
    room.currentQuestionIndex !== null ? room.quiz.questions[room.currentQuestionIndex] : null;
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
                    1000 *
                      (1 - Math.abs(player.currentAnswer.guess - question.correctNumber) / range),
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

  // Record the round while the answers are still around — the loop below drops them.
  if (question) {
    recordRoundResult(room, question);
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
const emitAnswerCount = (io: Server, room: StoredRoom) => {
  const question =
    room.currentQuestionIndex !== null ? room.quiz.questions[room.currentQuestionIndex] : null;
  const answeredCount = question
    ? Array.from(room.players.values()).filter((p) => p.lastAnsweredQuestionId === question.id)
        .length
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

const startQuestion = (
  io: Server,
  log: FastifyBaseLogger,
  room: StoredRoom,
  questionIndex: number,
) => {
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
  // The deadline the auto-advance timer below will fire on. Sending it to clients keeps
  // their countdown honest across reconnects and backgrounded tabs, where a locally
  // counted-down timer drifts away from when the server actually closes the question.
  const endsAt = (room.questionStartedAt ?? Date.now()) + timeLimit * 1000;
  room.activePublicQuestion = toPublicQuestion(
    question,
    questionIndex,
    room.quiz.questions.length,
    timeLimit,
    endsAt,
  );
  log.info({ roomCode: room.code, questionIndex }, "question started");

  io.to(room.code).emit("question:started", room.activePublicQuestion);
  emitRoomUpdate(io, room);

  // Schedule the server-side auto-advance. When all players answer early the manual
  // path (emitLeaderboard) cancels this timer, so it only fires if time genuinely runs out.
  room.questionAutoTimer = setTimeout(() => {
    if (room.status === "question") {
      log.info({ roomCode: room.code, questionIndex }, "question timed out — auto-advancing");
      emitLeaderboard(io, log, room);
    }
  }, timeLimit * 1000);
};

/** Remove a room and all its associated token entries from every store. */
const deleteRoom = (log: FastifyBaseLogger, room: StoredRoom) => {
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }
  tokenStore.deleteToken(room.hostToken);
  for (const player of room.players.values()) {
    tokenStore.deleteToken(player.reconnectToken);
  }
  roomStore.deleteRoom(room.code);
  log.info({ roomCode: room.code }, "room deleted");
};

const finishGame = (io: Server, log: FastifyBaseLogger, room: StoredRoom) => {
  if (room.questionAutoTimer !== null) {
    clearTimeout(room.questionAutoTimer);
    room.questionAutoTimer = null;
  }
  room.status = "finished";
  room.currentQuestionIndex = null;
  room.questionStartedAt = null;
  room.activePublicQuestion = null;
  log.info({ roomCode: room.code, players: room.players.size }, "game finished");

  // A superset of the old snapshot payload, so a client still running the previous
  // build reads the fields it knows and ignores the recap.
  const payload: GameFinishedPayload = {
    ...toSnapshot(room),
    summary: toGameSummary(room),
  };
  io.to(room.code).emit("game:finished", payload);

  // Schedule cleanup so finished rooms do not accumulate in memory indefinitely.
  room.cleanupTimer = setTimeout(() => deleteRoom(log, room), ROOM_CLEANUP_DELAY_MS);
};

// ── Reconnect helper ──────────────────────────────────────────────────────────

/**
 * Binds a (re)connecting socket to an existing room and sends the current
 * room state so the client can restore its UI without a full page reload.
 */
const restoreSocketToRoom = (
  io: Server,
  socket: Socket,
  room: StoredRoom,
  token: string,
  role: "host" | "player",
  playerId: string,
) => {
  socket.data.roomCode = room.code;
  socket.data.role = role;
  socket.data.token = token;
  socket.data.playerId = playerId;
  socket.join(room.code);

  // Re-stamp the cached question with the current server clock so the reconnecting client
  // measures its skew against "now" and lands on the original deadline, rather than
  // restarting a full-length countdown for a question that is already half over.
  const currentQuestion =
    (room.status === "question" || room.status === "leaderboard") &&
    room.currentQuestionIndex !== null
      ? withServerClock(
          room.activePublicQuestion ??
            toPublicQuestion(
              room.quiz.questions[room.currentQuestionIndex],
              room.currentQuestionIndex,
              room.quiz.questions.length,
              room.quiz.timeLimit,
              (room.questionStartedAt ?? Date.now()) + room.quiz.timeLimit * 1000,
            ),
        )
      : null;

  const payload: RoomRejoinedPayload = {
    room: toSnapshot(room),
    currentQuestion,
    isHost: role === "host",
    playerId,
  };
  socket.emit("room:rejoined", payload);
};

// ── Realtime event handlers ───────────────────────────────────────────────────

export const registerRealtimeHandlers = (io: Server, log: FastifyBaseLogger) => {
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
      const hostId = randomUUID();
      const hostToken = randomUUID();
      const room: StoredRoom = {
        code,
        hostSocketId: socket.id,
        hostId,
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
        roundResults: [],
      };

      roomStore.setRoom(code, room);
      tokenStore.setToken(hostToken, { roomCode: code, role: "host" });
      socket.data.roomCode = code;
      socket.data.role = "host";
      socket.data.token = hostToken;
      socket.data.playerId = hostId;
      socket.join(code);

      log.info({ roomCode: code, hostName }, "room created");

      // hostToken goes only to this socket — it is the host's credential, and the
      // room snapshot deliberately carries no trace of it.
      socket.emit("room:joined", {
        playerId: hostId,
        reconnectToken: hostToken,
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
      const room = roomStore.getRoom(roomCode);

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
      const room = roomStore.getRoom(roomCode);

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
      const reconnectToken = randomUUID();
      const player: StoredPlayer = {
        id: playerId,
        reconnectToken,
        socketId: socket.id,
        name,
        score: 0,
        connected: true,
        lastAnsweredQuestionId: null,
        streak: 0,
        scoreBeforeCurrentQuestion: 0,
        currentAnswer: null,
        correctAnswerCount: 0,
        missedQuestionCount: 0,
        bestStreak: 0,
      };

      room.players.set(playerId, player);
      tokenStore.setToken(reconnectToken, { roomCode: room.code, role: "player", playerId });
      socket.data.roomCode = room.code;
      socket.data.role = "player";
      socket.data.token = reconnectToken;
      socket.data.playerId = playerId;
      socket.join(room.code);

      log.info({ roomCode: room.code, playerName: name }, "player joined");

      // reconnectToken goes only to this socket. The snapshot below is broadcast to
      // the whole room and carries the public playerId only.
      socket.emit("room:joined", {
        playerId,
        reconnectToken,
        room: toSnapshot(room),
      });
      emitRoomUpdate(io, room);
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

      const entry = tokenStore.getToken(p.token);

      if (!entry || entry.role !== "player") {
        emitError(socket, "Session not found. Please re-join the room.");
        return;
      }

      const room = roomStore.getRoom(entry.roomCode);

      if (!room) {
        emitError(socket, "The room no longer exists.");
        return;
      }

      const player = entry.playerId ? room.players.get(entry.playerId) : undefined;

      // Re-check the token against the player record itself, so a stale or
      // mismatched token entry can never bind a socket to someone else's player.
      if (!player || player.reconnectToken !== p.token) {
        emitError(socket, "Player not found. Please re-join the room.");
        return;
      }

      player.socketId = socket.id;
      player.connected = true;
      log.info({ roomCode: room.code, playerName: player.name }, "player reconnected");

      restoreSocketToRoom(io, socket, room, p.token, "player", player.id);
      emitRoomUpdate(io, room);
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

      const entry = tokenStore.getToken(p.token);

      if (!entry || entry.role !== "host") {
        emitError(socket, "Host session not found. The room may have closed.");
        return;
      }

      const room = roomStore.getRoom(entry.roomCode);

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
      log.info({ roomCode: room.code }, "host reconnected");

      restoreSocketToRoom(io, socket, room, p.token, "host", room.hostId);
    });

    // ── Host: start the game ─────────────────────────────────────────────────

    socket.on("host:start-game", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = roomStore.getRoom(roomCode.toUpperCase());

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

      log.info({ roomCode: room.code, players: room.players.size }, "game started");
      startQuestion(io, log, room, 0);
    });

    // ── Host: reveal the leaderboard ─────────────────────────────────────────

    socket.on("host:show-leaderboard", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = roomStore.getRoom(roomCode.toUpperCase());

      if (!room || room.hostSocketId !== socket.id) {
        emitError(socket, "Only the host can reveal the leaderboard.");
        return;
      }

      if (room.status !== "question") {
        emitError(socket, "There is no active question to score.");
        return;
      }

      emitLeaderboard(io, log, room);
    });

    // ── Host: advance to the next question ───────────────────────────────────

    socket.on("host:next-question", (roomCode: unknown) => {
      if (!isString(roomCode)) {
        emitError(socket, "Invalid request.");
        return;
      }

      const room = roomStore.getRoom(roomCode.toUpperCase());

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

      const nextIndex = room.currentQuestionIndex === null ? 0 : room.currentQuestionIndex + 1;

      if (nextIndex >= room.quiz.questions.length) {
        finishGame(io, log, room);
        return;
      }

      startQuestion(io, log, room, nextIndex);
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

      const room = roomStore.getRoom(ans.roomCode.toUpperCase());

      if (!room || room.status !== "question" || room.currentQuestionIndex === null) {
        emitError(socket, "There is no active question right now.");
        return;
      }

      // Identify the answering player from server-held socket state, never from the
      // payload — a client cannot nominate whose score it is submitting against.
      const player = room.players.get(socket.data.playerId as string);

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
          // Scored immediately below, but still retained: the round record built when
          // the question closes reads every player's answer back out of `currentAnswer`.
          player.currentAnswer = {
            roomCode: room.code,
            type: "multiple-choice",
            optionId: ans.optionId,
          };

          let isCorrect = false;
          let pointsEarned = 0;

          if (ans.optionId === question.correctOptionId) {
            isCorrect = true;
            player.streak += 1;
            player.bestStreak = Math.max(player.bestStreak, player.streak);

            const elapsedMs = Math.max(0, Date.now() - (room.questionStartedAt ?? Date.now()));
            const timeFraction = Math.min(elapsedMs / (room.quiz.timeLimit * 1000), 1);
            const basePoints = Math.max(300, Math.round(1000 - 700 * timeFraction));
            const streakBonus =
              player.streak >= 5 ? 300 : player.streak >= 3 ? 150 : player.streak >= 2 ? 75 : 0;

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
          if (
            !isString(ans.optionId) ||
            !question.options.some((option) => option.id === ans.optionId)
          ) {
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
      emitAnswerCount(io, room);

      const connectedPlayers = Array.from(room.players.values()).filter((pl) => pl.connected);
      const everyoneAnswered =
        connectedPlayers.length > 0 &&
        connectedPlayers.every((entry) => entry.lastAnsweredQuestionId === question.id);

      if (everyoneAnswered) {
        emitLeaderboard(io, log, room);
      }
    });

    // ── Socket disconnect ─────────────────────────────────────────────────────

    socket.on("disconnect", () => {
      // Clean up per-socket rate-limit data to avoid memory growth.
      rateLimits.delete(socket.id);

      const { roomCode, role, playerId } = socket.data as {
        roomCode?: string;
        role?: "host" | "player";
        playerId?: string;
      };

      if (!roomCode) return;

      const room = roomStore.getRoom(roomCode);
      if (!room) return;

      if (role === "host") {
        // Give the host a grace period to reconnect before closing the room.
        room.hostSocketId = null;
        log.info({ roomCode }, "host disconnected — grace period started");

        room.hostCloseTimer = setTimeout(() => {
          const activeRoom = roomStore.getRoom(roomCode);
          if (activeRoom && activeRoom.hostSocketId === null) {
            log.info({ roomCode }, "host grace period expired — closing room");
            emitRoomClosed(io, activeRoom, "The host disconnected. This room is now closed.");
            deleteRoom(log, activeRoom);
          }
        }, HOST_RECONNECT_GRACE_MS);
      } else {
        // Look up the player by their stable public id (O(1), no room scan needed).
        if (!playerId) return;
        const player = room.players.get(playerId);
        if (player) {
          player.connected = false;
          log.info({ roomCode, playerName: player.name }, "player disconnected");
          emitRoomUpdate(io, room);
        }
      }
    });
  });
};
