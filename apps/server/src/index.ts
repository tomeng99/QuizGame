import { randomInt } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server, type Socket } from "socket.io";
import {
  CheckRoomPayload,
  CheckRoomResult,
  HostCreateRoomPayload,
  LeaderboardEntry,
  PlayerJoinPayload,
  PlayerSummary,
  PublicQuestion,
  QuizDraft,
  QuizQuestion,
  RoomSnapshot,
  SubmitAnswerPayload,
} from "@quizgame/contracts";

const MAX_ROOMS = 500;
const MAX_NAME_LENGTH = 50;
const MAX_TITLE_LENGTH = 100;
const MAX_PROMPT_LENGTH = 500;
const MAX_OPTION_TEXT_LENGTH = 200;
const MAX_ID_LENGTH = 100;
const MAX_ROOM_CODE_LENGTH = 20;
const MAX_OPTION_ID_LENGTH = 100;
const MAX_QUESTIONS = 50;
const MAX_OPTIONS_PER_QUESTION = 8;

const isString = (v: unknown): v is string => typeof v === "string";
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

interface StoredPlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  lastAnsweredQuestionId: string | null;
}

interface StoredRoom {
  code: string;
  hostSocketId: string;
  hostName: string;
  quiz: QuizDraft;
  status: RoomSnapshot["status"];
  currentQuestionIndex: number | null;
  questionStartedAt: number | null;
  players: Map<string, StoredPlayer>;
}

const app = Fastify({ logger: true });
const rooms = new Map<string, StoredRoom>();
let io: Server;

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return configuredOrigins && configuredOrigins.length > 0 ? configuredOrigins : true;
};

const allowedOrigins = parseAllowedOrigins();

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[randomInt(alphabet.length)];
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

const normalizeQuestion = (
  question: QuizQuestion,
  index: number,
): QuizQuestion | null => {
  const prompt = question.prompt.trim();
  const options = question.options
    .map((option, optionIndex) => ({
      id: option.id || `q${index + 1}-o${optionIndex + 1}`,
      text: option.text.trim(),
    }))
    .filter((option) => option.text.length > 0);

  if (!prompt || options.length < 2) {
    return null;
  }

  const correctOptionId = options.some((option) => option.id === question.correctOptionId)
    ? question.correctOptionId
    : options[0].id;

  return {
    id: question.id || `question-${index + 1}`,
    prompt,
    options,
    correctOptionId,
  };
};

const normalizeQuiz = (quiz: QuizDraft): QuizDraft => ({
  title: quiz.title.trim() || "Untitled Quiz",
  questions: quiz.questions
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question): question is QuizQuestion => question !== null),
});

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

const toPublicQuestion = (
  question: QuizQuestion,
  index: number,
  total: number,
): PublicQuestion => ({
  id: question.id,
  prompt: question.prompt,
  options: question.options,
  index,
  total,
});

const emitRoomUpdate = (room: StoredRoom) => {
  io.to(room.code).emit("room:update", toSnapshot(room));
};

const emitRoomClosed = (room: StoredRoom, message: string) => {
  io.to(room.code).emit("room:closed", { message });
};

const emitLeaderboard = (room: StoredRoom) => {
  room.status = "leaderboard";
  io.to(room.code).emit("leaderboard:update", toSnapshot(room));
};

const startQuestion = (room: StoredRoom, questionIndex: number) => {
  room.currentQuestionIndex = questionIndex;
  room.questionStartedAt = Date.now();
  room.status = "question";

  for (const player of room.players.values()) {
    player.lastAnsweredQuestionId = null;
  }

  const question = room.quiz.questions[questionIndex];

  io.to(room.code).emit(
    "question:started",
    toPublicQuestion(question, questionIndex, room.quiz.questions.length),
  );
  emitRoomUpdate(room);
};

const finishGame = (room: StoredRoom) => {
  room.status = "finished";
  room.currentQuestionIndex = null;
  room.questionStartedAt = null;
  io.to(room.code).emit("game:finished", toSnapshot(room));
};

const emitError = (socket: Socket, message: string) => {
  socket.emit("error:message", { message });
};

const validateHostCreateRoomPayload = (
  payload: unknown,
): payload is HostCreateRoomPayload => {
  if (!isObject(payload)) return false;
  if (!isString(payload.hostName) || payload.hostName.length > MAX_NAME_LENGTH) return false;
  if (!isObject(payload.quiz)) return false;
  const quiz = payload.quiz;
  if (!isString(quiz.title) || quiz.title.length > MAX_TITLE_LENGTH) return false;
  if (!isArray(quiz.questions) || quiz.questions.length > MAX_QUESTIONS) return false;
  for (const q of quiz.questions) {
    if (!isObject(q)) return false;
    if (!isString(q.id) || q.id.length > MAX_ID_LENGTH) return false;
    if (!isString(q.prompt) || q.prompt.length > MAX_PROMPT_LENGTH) return false;
    if (!isString(q.correctOptionId) || q.correctOptionId.length > MAX_ID_LENGTH) return false;
    if (!isArray(q.options) || q.options.length > MAX_OPTIONS_PER_QUESTION) return false;
    for (const opt of q.options) {
      if (!isObject(opt)) return false;
      if (!isString(opt.id) || opt.id.length > MAX_ID_LENGTH) return false;
      if (!isString(opt.text) || opt.text.length > MAX_OPTION_TEXT_LENGTH) return false;
    }
  }
  return true;
};

const validateRoomCodePayload = (payload: unknown): payload is { roomCode: string } => {
  if (!isObject(payload)) return false;
  return isString(payload.roomCode) && payload.roomCode.length <= MAX_ROOM_CODE_LENGTH;
};

const validatePlayerJoinPayload = (payload: unknown): payload is PlayerJoinPayload => {
  if (!isObject(payload)) return false;
  if (!isString(payload.roomCode) || payload.roomCode.length > MAX_ROOM_CODE_LENGTH) return false;
  return isString(payload.name) && payload.name.length <= MAX_NAME_LENGTH;
};

const validateRoomCodeString = (value: unknown): value is string =>
  isString(value) && value.length <= MAX_ROOM_CODE_LENGTH;

const validateSubmitAnswerPayload = (payload: unknown): payload is SubmitAnswerPayload => {
  if (!isObject(payload)) return false;
  if (!isString(payload.roomCode) || payload.roomCode.length > MAX_ROOM_CODE_LENGTH) return false;
  return isString(payload.optionId) && payload.optionId.length <= MAX_OPTION_ID_LENGTH;
};

const registerRealtimeHandlers = () => {
  io.on("connection", (socket) => {
    socket.on("host:create-room", (payload: unknown) => {
      if (!validateHostCreateRoomPayload(payload)) {
        emitError(socket, "Invalid payload.");
        return;
      }

      if (rooms.size >= MAX_ROOMS) {
        emitError(socket, "Server is at capacity. Try again later.");
        return;
      }

      const quiz = normalizeQuiz(payload.quiz);
      const hostName = payload.hostName.trim();

      if (!hostName) {
        emitError(socket, "Host name is required.");
        return;
      }

      if (quiz.questions.length === 0) {
        emitError(socket, "Add at least one valid question before hosting.");
        return;
      }

      const code = createRoomCode();
      const room: StoredRoom = {
        code,
        hostSocketId: socket.id,
        hostName,
        quiz,
        status: "lobby",
        currentQuestionIndex: null,
        questionStartedAt: null,
        players: new Map(),
      };

      rooms.set(code, room);
      socket.data.roomCode = code;
      socket.data.role = "host";
      socket.join(code);
      socket.emit("room:joined", {
        playerId: socket.id,
        room: toSnapshot(room),
      });
    });

    socket.on("player:check-room", (payload: unknown) => {
      if (!validateRoomCodePayload(payload)) {
        emitError(socket, "Invalid payload.");
        return;
      }

      const roomCode = payload.roomCode.trim().toUpperCase();
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

    socket.on("player:join-room", (payload: unknown) => {
      if (!validatePlayerJoinPayload(payload)) {
        emitError(socket, "Invalid payload.");
        return;
      }

      const roomCode = payload.roomCode.trim().toUpperCase();
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

      const name = payload.name.trim();

      if (!name) {
        emitError(socket, "Player name is required.");
        return;
      }

      const duplicateName = Array.from(room.players.values()).some(
        (player) => player.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicateName) {
        emitError(socket, "That player name is already taken in this room.");
        return;
      }

      const player: StoredPlayer = {
        id: socket.id,
        name,
        score: 0,
        connected: true,
        lastAnsweredQuestionId: null,
      };

      room.players.set(player.id, player);
      socket.data.roomCode = room.code;
      socket.data.role = "player";
      socket.join(room.code);
      socket.emit("room:joined", {
        playerId: player.id,
        room: toSnapshot(room),
      });
      emitRoomUpdate(room);
    });

    socket.on("host:start-game", (roomCode: unknown) => {
      if (!validateRoomCodeString(roomCode)) {
        emitError(socket, "Invalid payload.");
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

      startQuestion(room, 0);
    });

    socket.on("host:show-leaderboard", (roomCode: unknown) => {
      if (!validateRoomCodeString(roomCode)) {
        emitError(socket, "Invalid payload.");
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

    socket.on("host:next-question", (roomCode: unknown) => {
      if (!validateRoomCodeString(roomCode)) {
        emitError(socket, "Invalid payload.");
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

      const nextIndex = room.currentQuestionIndex === null ? 0 : room.currentQuestionIndex + 1;

      if (nextIndex >= room.quiz.questions.length) {
        finishGame(room);
        return;
      }

      startQuestion(room, nextIndex);
    });

    socket.on("player:submit-answer", (payload: unknown) => {
      if (!validateSubmitAnswerPayload(payload)) {
        emitError(socket, "Invalid payload.");
        return;
      }

      const room = rooms.get(payload.roomCode.toUpperCase());

      if (!room || room.status !== "question" || room.currentQuestionIndex === null) {
        emitError(socket, "There is no active question right now.");
        return;
      }

      const player = room.players.get(socket.id);

      if (!player) {
        emitError(socket, "Join the room before answering.");
        return;
      }

      const question = room.quiz.questions[room.currentQuestionIndex];
      const selectedOption = question.options.find((option) => option.id === payload.optionId);

      if (!selectedOption) {
        emitError(socket, "That answer option is not valid.");
        return;
      }

      if (player.lastAnsweredQuestionId === question.id) {
        emitError(socket, "You already answered this question.");
        return;
      }

      player.lastAnsweredQuestionId = question.id;

      if (payload.optionId === question.correctOptionId) {
        const elapsedMs = Math.max(0, Date.now() - (room.questionStartedAt ?? Date.now()));
        const awarded = Math.max(300, 1000 - Math.floor(elapsedMs / 20));
        player.score += awarded;
      }

      emitRoomUpdate(room);

      const everyoneAnswered =
        room.players.size > 0 &&
        Array.from(room.players.values()).every(
          (entry) => entry.lastAnsweredQuestionId === question.id,
        );

      if (everyoneAnswered) {
        emitLeaderboard(room);
      }
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.hostSocketId === socket.id) {
          emitRoomClosed(room, "The host disconnected. This room is now closed.");
          rooms.delete(room.code);
          continue;
        }

        const player = room.players.get(socket.id);

        if (player) {
          player.connected = false;
          emitRoomUpdate(room);
        }
      }
    });
  });
};

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
