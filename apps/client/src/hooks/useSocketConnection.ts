import { useEffect } from "react";
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
import { API_BASE } from "../config";
import type {
  ConnectionState,
  FeedbackState,
  PendingAction,
  Screen,
} from "../types";
import type { UseSessionStorage } from "./useSessionStorage";

/**
 * Setters and refs owned by `useGameState` that the socket lifecycle needs to
 * drive. Passed in as a single config object so `useGameState` stays the sole
 * owner of the public state shape.
 */
export interface UseSocketConnectionConfig extends UseSessionStorage {
  socketRef: React.RefObject<Socket | null>;
  /** Tracks `screen` synchronously so event handlers read it without stale closures. */
  screenRef: React.RefObject<Screen>;
  /** Tracks `room` synchronously for the reconnect feedback message. */
  roomRef: React.RefObject<RoomSnapshot | null>;
  /** Tracks `isHost` synchronously so the connect handler can read it. */
  isHostRef: React.RefObject<boolean>;
  /** True while a reconnect emit is in-flight, used to clear stale sessions on failure. */
  pendingReconnectRef: React.RefObject<boolean>;
  /** Full reset back to the join screen, including clearing the session. */
  resetToStart: () => void;

  // ── Setters ──
  setConnectionState: React.Dispatch<React.SetStateAction<ConnectionState>>;
  setPendingAction: React.Dispatch<React.SetStateAction<PendingAction>>;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState>>;
  setCheckedRoom: React.Dispatch<React.SetStateAction<CheckRoomResult | null>>;
  setRoomCodeInput: React.Dispatch<React.SetStateAction<string>>;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  setSessionPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
  setRoom: React.Dispatch<React.SetStateAction<RoomSnapshot | null>>;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<PublicQuestion | null>>;
  setSelectedOptionId: React.Dispatch<React.SetStateAction<string | null>>;
  setNumberGuess: React.Dispatch<React.SetStateAction<number | null>>;
  setRankingOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setAnsweredCount: React.Dispatch<React.SetStateAction<number>>;
  setHasAnsweredCurrentQuestion: React.Dispatch<React.SetStateAction<boolean>>;
  setLastAnswerResult: React.Dispatch<React.SetStateAction<AnswerAcceptedPayload | null>>;
  setQuestionReveal: React.Dispatch<React.SetStateAction<QuestionRevealPayload | null>>;
  setIsHost: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Owns the socket.io connection lifecycle: creating the socket, the
 * connect/disconnect/connect_error handlers (including page-refresh / drop
 * reconnect logic), and registration of all server→client event handlers.
 *
 * Mounts once; all state mutations are funnelled through the setters/refs
 * provided in the config so this hook never owns any React state itself.
 */
export function useSocketConnection(config: UseSocketConnectionConfig): void {
  const {
    socketRef,
    tokenRef,
    isHostRef,
    pendingReconnectRef,
    screenRef,
    roomRef,
    saveSession,
    clearSession,
    loadSession,
    resetToStart,
    setConnectionState,
    setPendingAction,
    setFeedback,
    setCheckedRoom,
    setRoomCodeInput,
    setScreen,
    setSessionPlayerId,
    setRoom,
    setCurrentQuestion,
    setSelectedOptionId,
    setNumberGuess,
    setRankingOrder,
    setAnsweredCount,
    setHasAnsweredCurrentQuestion,
    setLastAnswerResult,
    setQuestionReveal,
    setIsHost,
  } = config;

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
    // Intentionally empty — this effect mounts once and drives everything via
    // the stable refs/setters captured in `config`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
