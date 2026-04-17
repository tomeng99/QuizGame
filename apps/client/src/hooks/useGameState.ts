import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  CheckRoomResult,
  ErrorMessagePayload,
  PublicQuestion,
  RoomJoinedPayload,
  RoomSnapshot,
} from "@quizgame/contracts";
import { API_BASE } from "../config";
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

  /* ── Room / game ── */
  room: RoomSnapshot | null;
  setRoom: React.Dispatch<React.SetStateAction<RoomSnapshot | null>>;
  currentQuestion: PublicQuestion | null;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<PublicQuestion | null>>;
  selectedOptionId: string | null;
  setSelectedOptionId: React.Dispatch<React.SetStateAction<string | null>>;
  sessionPlayerId: string | null;
  isHost: boolean;
  setIsHost: React.Dispatch<React.SetStateAction<boolean>>;

  /* ── Helpers ── */
  resetToStart: () => void;
}

export function useGameState(): GameState {
  const socketRef = useRef<Socket | null>(null);
  const screenRef = useRef<Screen>("join-code");
  const roomRef = useRef<RoomSnapshot | null>(null);

  const [screen, setScreen] = useState<Screen>("join-code");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [checkedRoom, setCheckedRoom] = useState<CheckRoomResult | null>(null);

  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PublicQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

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

  const resetToStart = () => {
    setRoom(null);
    setCurrentQuestion(null);
    setSelectedOptionId(null);
    setSessionPlayerId(null);
    setCheckedRoom(null);
    setIsHost(false);
    setScreen("join-code");
  };

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnectionState("connected");
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
      setSessionPlayerId(payload.playerId);
      setRoom(payload.room);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setScreen("game");
      setPendingAction(null);

      if (screenRef.current === "host-setup") {
        setIsHost(true);
        setFeedback({
          tone: "success",
          message: `Room ${payload.room.roomCode} is live! Share the code with players.`,
        });
      } else {
        setIsHost(false);
        setFeedback({
          tone: "success",
          message: `You're in! Waiting for ${payload.room.hostName} to start.`,
        });
      }
    });

    socket.on("room:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setPendingAction(null);
    });

    socket.on("question:started", (question: PublicQuestion) => {
      setCurrentQuestion(question);
      setSelectedOptionId(null);
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message: `Question ${question.index + 1} of ${question.total} — go!`,
      });
    });

    socket.on("leaderboard:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
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
    room,
    setRoom,
    currentQuestion,
    setCurrentQuestion,
    selectedOptionId,
    setSelectedOptionId,
    sessionPlayerId,
    isHost,
    setIsHost,
    resetToStart,
  };
}
