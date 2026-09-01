import type {
  AnswerAcceptedPayload,
  CheckRoomResult,
  GameSummary,
  PublicQuestion,
  QuestionRevealPayload,
  RoomSnapshot,
} from "@quizgame/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { clearRoomCodeFromUrl, getRoomCodeFromUrl } from "../config";
import type { ConnectionState, FeedbackState, PendingAction, Screen } from "../types";
import { useSessionStorage } from "./useSessionStorage";
import { useSocketConnection } from "./useSocketConnection";

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
  /** End-of-game recap, populated by "game:finished". Null until the quiz ends. */
  gameSummary: GameSummary | null;

  /* ── Helpers ── */
  resetToStart: () => void;
}

export function useGameState(): GameState {
  // ── Refs ──
  const socketRef = useRef<Socket | null>(null);
  const screenRef = useRef<Screen>("join-code");
  const roomRef = useRef<RoomSnapshot | null>(null);
  /** Tracks isHost synchronously so the connect handler can read it without stale closure. */
  const isHostRef = useRef<boolean>(false);
  /** True while a reconnect emit is in-flight, used to clear stale sessions on failure. */
  const pendingReconnectRef = useRef<boolean>(false);

  // ── State ──
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
  // Populated by "game:finished" and held until the player leaves the finished room, so
  // the recap survives the snapshot updates that keep arriving while it is on screen.
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    tone: "info",
    message: "Connecting...",
  });

  // ── Mirror reactive state into refs for synchronous reads in socket handlers ──
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // ── Session storage (web-only, best-effort) ──
  const { tokenRef, saveSession, clearSession, loadSession } = useSessionStorage();

  const consumeSharedRoomCode = useCallback(() => {
    clearRoomCodeFromUrl();
    setSharedRoomCode(null);
  }, []);

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
    setGameSummary(null);
    setScreen("join-code");
  };

  // ── Socket connection lifecycle + event handlers ──
  useSocketConnection({
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
    setGameSummary,
    setIsHost,
  });

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
    gameSummary,
    resetToStart,
  };
}
