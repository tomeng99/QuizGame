import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AnswerAcceptedPayload,
  AnswerCountPayload,
  CheckRoomResult,
  ErrorMessagePayload,
  PublicQuestion,
  QuestionRevealPayload,
  RoomJoinedPayload,
  RoomRejoinedPayload,
  RoomSnapshot,
} from "@quizgame/contracts";
import { API_BASE, clearRoomCodeFromUrl, getRoomCodeFromUrl } from "../config";
import type {
  ConnectionState,
  FeedbackState,
  PendingAction,
  Screen,
} from "../types";

export interface GameState {
  /* ── Refs ── */
  socketRef: React.RefObject<Socket | null>;

  /* ── Navigation ── */
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;

  /* ── Connection ── */
  connectionState: ConnectionState;

  /* ── Feedback ── */
  feedback: FeedbackState;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState>>;
  pendingAction: PendingAction;
  setPendingAction: React.Dispatch<React.SetStateAction<PendingAction>>;

  /* ── Join flow ── */
  roomCodeInput: string;
  setRoomCodeInput: React.Dispatch<React.SetStateAction<string>>;
  playerName: string;
  setPlayerName: React.Dispatch<React.SetStateAction<string>>;
  checkedRoom: CheckRoomResult | null;
  setCheckedRoom: React.Dispatch<React.SetStateAction<CheckRoomResult | null>>;
  sharedRoomCode: string | null;
  consumeSharedRoomCode: () => void;

  /* ── Room / game ── */
  room: RoomSnapshot | null;
  setRoom: React.Dispatch<React.SetStateAction<RoomSnapshot | null>>;
  currentQuestion: PublicQuestion | null;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<PublicQuestion | null>>;
  selectedOptionId: string | null;
  setSelectedOptionId: React.Dispatch<React.SetStateAction<string | null>>;
  /** The player's current slider value or ranking order (for UI before submit). */
  numberGuess: number | null;
  setNumberGuess: React.Dispatch<React.SetStateAction<number | null>>;
  rankingOrder: string[];
  setRankingOrder: React.Dispatch<React.SetStateAction<string[]>>;
  sessionPlayerId: string | null;
  isHost: boolean;
  setIsHost: React.Dispatch<React.SetStateAction<boolean>>;

  /* ── Per-question state (driven by narrow server events, not the full snapshot) ── */
  answeredCount: number;
  hasAnsweredCurrentQuestion: boolean;
  /** Result of the player's most recent answer (isCorrect, points, streak). */
  lastAnswerResult: AnswerAcceptedPayload | null;
  /** Revealed round result after the question closes. */
  questionReveal: QuestionRevealPayload | null;

  /* ── Helpers ── */
  resetToStart: () => void;
}

export function useGameState(): GameState {
  const socketRef = useRef<Socket | null>(null);
  const screenRef = useRef<Screen>("join-code");
  const roomRef = useRef<RoomSnapshot | null>(null);
  /** Stable reconnect token (player/host UUID). Survives socket drops but not page refreshes. */
  const tokenRef = useRef<string | null>(null);
  /** Tracks isHost synchronously so the connect handler can read it without stale closure. */
  const isHostRef = useRef<boolean>(false);
  /** True while a reconnect emit is in-flight, used to clear stale sessions on failure. */
  const pendingReconnectRef = useRef<boolean>(false);

  const [screen, setScreen] = useState<Screen>("join-code");
  const [roomCodeInput, setRoomCodeInput] = useState(() => getRoomCodeFromUrl() ?? "");
  const [playerName, setPlayerName] = useState("");
  const [checkedRoom, setCheckedRoom] = useState<CheckRoomResult | null>(null);
  const [sharedRoomCode, setSharedRoomCode] = useState<string | null>(() => getRoomCodeFromUrl());

  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PublicQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [numberGuess, setNumberGuess] = useState<number | null>(null);
  const [rankingOrder, setRankingOrder] = useState<string[]>([]);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const [answeredCount, setAnsweredCount] = useState(0);
  const [hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion] = useState(false);
  // Populated by the "answer:accepted" socket event. Carries isCorrect, pointsEarned, and
  // current streak so the GameScreen can render immediate feedback to the player.
  // Reset to null at the start of every new question.
  const [lastAnswerResult, setLastAnswerResult] = useState<AnswerAcceptedPayload | null>(null);
  // Populated by the "question:revealed" socket event emitted by the server just before
  // "leaderboard:update". Carries the correctOptionId so the client can highlight options.
  // Reset to null at the start of every new question.
  const [questionReveal, setQuestionReveal] = useState<QuestionRevealPayload | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    tone: "info",
    message: "Connecting...",
  });

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // ── Session storage helpers (web-only, best-effort) ─────────────────────────
  // These allow the client to survive a page refresh while a game is active.

  const saveSession = (token: string, roomCode: string, role: "host" | "player") => {
    tokenRef.current = token;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("quizgame:token", token);
        sessionStorage.setItem("quizgame:roomCode", roomCode);
        sessionStorage.setItem("quizgame:role", role);
      }
    } catch {}
  };

  const clearSession = () => {
    tokenRef.current = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("quizgame:token");
        sessionStorage.removeItem("quizgame:roomCode");
        sessionStorage.removeItem("quizgame:role");
      }
    } catch {}
  };

  const consumeSharedRoomCode = useCallback(() => {
    clearRoomCodeFromUrl();
    setSharedRoomCode(null);
  }, []);

  const loadSession = (): { token: string; role: "host" | "player" } | null => {
    try {
      if (typeof sessionStorage !== "undefined") {
        const token = sessionStorage.getItem("quizgame:token");
        const role = sessionStorage.getItem("quizgame:role");
        if (token && (role === "host" || role === "player")) {
          return { token, role };
        }
      }
    } catch {}
    return null;
  };

  const resetToStart = () => {
    clearSession();
    setRoom(null);
    setCurrentQuestion(null);
    setSelectedOptionId(null);
    setNumberGuess(null);
    setRankingOrder([]);
    setSessionPlayerId(null);
    setCheckedRoom(null);
    setSharedRoomCode(null);
    setIsHost(false);
    setAnsweredCount(0);
    setHasAnsweredCurrentQuestion(false);
    setLastAnswerResult(null);
    setQuestionReveal(null);
    setScreen("join-code");
  };

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnectionState("connected");

      // Attempt to rejoin an active room after a socket drop or page refresh.
      const inMemoryToken = tokenRef.current;
      const storedSession = !inMemoryToken ? loadSession() : null;
      const token = inMemoryToken ?? storedSession?.token ?? null;

      // Determine role: use in-memory ref first, fall back to stored session role.
      const role: "host" | "player" | null = isHostRef.current
        ? "host"
        : storedSession?.role ?? (inMemoryToken ? null : null);

      if (token && role) {
        // Restore tokenRef immediately (needed for page-refresh case where ref is null).
        tokenRef.current = token;
        pendingReconnectRef.current = true;
        const event = role === "host" ? "host:reconnect" : "player:reconnect";
        socket.emit(event, { token });
        // Feedback will be set by room:rejoined or error:message.
        return;
      }

      setFeedback({
        tone: "success",
        message: roomRef.current ? "Reconnected!" : "Ready to play!",
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message: "Connection lost. Reconnecting...",
      });
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "error",
        message: "Can't reach the game server.",
      });
    });

    socket.on("room:checked", (result: CheckRoomResult) => {
      setCheckedRoom(result);
      setRoomCodeInput(result.roomCode);
      setScreen("join-name");
      setPendingAction(null);
      setFeedback({
        tone: "success",
        message: `Found "${result.quizTitle}" hosted by ${result.hostName}!`,
      });
    });

    socket.on("room:joined", (payload: RoomJoinedPayload) => {
      const isHostJoin = screenRef.current === "host-setup";
      const role: "host" | "player" = isHostJoin ? "host" : "player";

      // Persist token so the socket can reclaim this session after a drop or refresh.
      saveSession(payload.playerId, payload.room.roomCode, role);
      setSessionPlayerId(payload.playerId);

      setRoom(payload.room);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setNumberGuess(null);
      setRankingOrder([]);
      setAnsweredCount(0);
      setHasAnsweredCurrentQuestion(false);
      setScreen("game");
      setPendingAction(null);

      if (isHostJoin) {
        setIsHost(true);
        setFeedback({
          tone: "success",
          message: `Room ${payload.room.roomCode} is live! Players can scan the QR code or use the room code.`,
        });
      } else {
        setIsHost(false);
        setFeedback({
          tone: "success",
          message: `You're in! Waiting for ${payload.room.hostName} to start.`,
        });
      }
    });

    socket.on("room:rejoined", (payload: RoomRejoinedPayload) => {
      pendingReconnectRef.current = false;

      // Restore session player ID from the stable token ref (set before emitting reconnect).
      const restoredToken = tokenRef.current;
      if (restoredToken) {
        setSessionPlayerId(restoredToken);
      }

      setRoom(payload.room);
      setIsHost(payload.isHost);
      setSelectedOptionId(null);
      setLastAnswerResult(null);
      setQuestionReveal(null);

      if (payload.currentQuestion) {
        setCurrentQuestion(payload.currentQuestion);
        if (payload.currentQuestion.type === "number") {
          setNumberGuess(
            Math.round((payload.currentQuestion.minValue + payload.currentQuestion.maxValue) / 2),
          );
        } else {
          setNumberGuess(null);
        }
        if (payload.currentQuestion.type === "ranking") {
          setRankingOrder(payload.currentQuestion.items.map((item) => item.id));
        } else {
          setRankingOrder([]);
        }
        // Derive answered state from the fresh snapshot the server computed on reconnect.
        const selfEntry = restoredToken
          ? payload.room.leaderboard.find((e) => e.playerId === restoredToken)
          : null;
        setHasAnsweredCurrentQuestion(selfEntry?.answeredCurrentQuestion ?? false);
        setAnsweredCount(
          payload.room.leaderboard.filter((e) => e.answeredCurrentQuestion).length,
        );
      } else {
        setCurrentQuestion(null);
        setNumberGuess(null);
        setRankingOrder([]);
        setAnsweredCount(0);
        setHasAnsweredCurrentQuestion(false);
      }

      setScreen("game");
      setPendingAction(null);
      setConnectionState("connected");
      setFeedback({ tone: "success", message: "Reconnected!" });
    });

    socket.on("room:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setPendingAction(null);
    });

    socket.on("question:started", (question: PublicQuestion) => {
      setCurrentQuestion(question);
      setSelectedOptionId(null);
      if (question.type === "number") {
        setNumberGuess(Math.round((question.minValue + question.maxValue) / 2));
      } else {
        setNumberGuess(null);
      }
      if (question.type === "ranking") {
        setRankingOrder(question.items.map((item) => item.id));
      } else {
        setRankingOrder([]);
      }
      setAnsweredCount(0);
      setHasAnsweredCurrentQuestion(false);
      setLastAnswerResult(null);
      setQuestionReveal(null);
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message: `Question ${question.index + 1} of ${question.total} — go!`,
      });
    });

    // Narrow event: the server confirms this player's answer was accepted.
    // Payload carries isCorrect, pointsEarned, and the new streak value so the
    // GameScreen can show a contextual result card without a full snapshot round-trip.
    socket.on("answer:accepted", (payload: AnswerAcceptedPayload) => {
      setHasAnsweredCurrentQuestion(true);
      setLastAnswerResult(payload);
    });

    // The server emits "question:revealed" immediately before "leaderboard:update"
    // whenever a question closes (either all players answered or the timer expired).
    // We store the correctOptionId so the option buttons can highlight green/red.
    socket.on("question:revealed", (payload: QuestionRevealPayload) => {
      setQuestionReveal(payload);
    });

    // Narrow event: lightweight count update broadcast to all room members per answer.
    socket.on("room:answer-count", (payload: AnswerCountPayload) => {
      setAnsweredCount(payload.answeredCount);
    });

    socket.on("leaderboard:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setPendingAction(null);
      setFeedback({
        tone: "success",
        message:
          snapshot.currentQuestionIndex === snapshot.totalQuestions - 1
            ? "Final scores are in!"
            : "Scores updated!",
      });
    });

    socket.on("game:finished", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setNumberGuess(null);
      setRankingOrder([]);
      setPendingAction(null);
      const winner = snapshot.leaderboard[0];
      setFeedback({
        tone: "success",
        message: winner
          ? `${winner.name} wins with ${winner.score} points!`
          : "Quiz complete!",
      });
    });

    socket.on("room:closed", (payload: ErrorMessagePayload) => {
      resetToStart();
      setPendingAction(null);
      setFeedback({ tone: "error", message: payload.message });
    });

    socket.on("error:message", (payload: ErrorMessagePayload) => {
      // If a reconnect attempt just failed, clear the stale session so the
      // next page load starts fresh instead of looping on a dead token.
      if (pendingReconnectRef.current) {
        pendingReconnectRef.current = false;
        clearSession();
      }
      setPendingAction(null);
      setFeedback({ tone: "error", message: payload.message });
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socketRef,
    screen,
    setScreen,
    connectionState,
    feedback,
    setFeedback,
    pendingAction,
    setPendingAction,
    roomCodeInput,
    setRoomCodeInput,
    playerName,
    setPlayerName,
    checkedRoom,
    setCheckedRoom,
    sharedRoomCode,
    consumeSharedRoomCode,
    room,
    setRoom,
    currentQuestion,
    setCurrentQuestion,
    selectedOptionId,
    setSelectedOptionId,
    numberGuess,
    setNumberGuess,
    rankingOrder,
    setRankingOrder,
    sessionPlayerId,
    isHost,
    setIsHost,
    answeredCount,
    hasAnsweredCurrentQuestion,
    lastAnswerResult,
    questionReveal,
    resetToStart,
  };
}
