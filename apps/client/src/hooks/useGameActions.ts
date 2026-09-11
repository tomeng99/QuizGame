import type { SubmitAnswerPayload } from "@quizgame/contracts";
import { useEffect, useMemo } from "react";

import { validateQuiz } from "../helpers";
import type { GameState } from "./useGameState";
import type { QuizEditor } from "./useQuizEditor";

/**
 * Socket-driven action handlers and derived UI flags for the quiz game.
 *
 * These handlers all follow the same shape: verify preconditions, mark a
 * pending action, set feedback, and emit a socket event. Extracting them
 * keeps `App` focused on rendering.
 */
export function useGameActions(game: GameState, editor: QuizEditor) {
  const quizIssues = useMemo(() => validateQuiz(editor.quiz), [editor.quiz]);

  const checkRoom = (roomCode = game.roomCodeInput) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase();

    if (game.connectionState !== "connected" || !normalizedRoomCode) {
      return;
    }
    game.setPendingAction("check-room");
    game.setFeedback({ tone: "info", message: "Looking for room..." });
    game.socketRef.current?.emit("player:check-room", {
      roomCode: normalizedRoomCode,
    });
  };

  const joinRoom = () => {
    if (
      game.connectionState !== "connected" ||
      !game.playerName.trim() ||
      !game.roomCodeInput.trim()
    ) {
      return;
    }
    game.setPendingAction("join-room");
    game.setFeedback({ tone: "info", message: "Joining..." });
    game.socketRef.current?.emit("player:join-room", {
      roomCode: game.roomCodeInput.trim().toUpperCase(),
      name: game.playerName.trim(),
    });
  };

  const createRoom = () => {
    if (game.connectionState !== "connected" || !editor.hostName.trim() || quizIssues.length > 0) {
      return;
    }
    game.setPendingAction("create-room");
    game.setFeedback({ tone: "info", message: "Creating your room..." });
    game.socketRef.current?.emit("host:create-room", {
      hostName: editor.hostName,
      quiz: editor.quiz,
    });
  };

  const startGame = () => {
    if (!game.room) return;
    game.setPendingAction("start-game");
    game.setFeedback({ tone: "info", message: "Starting the quiz..." });
    game.socketRef.current?.emit("host:start-game", game.room.roomCode);
  };

  const revealLeaderboard = () => {
    if (!game.room) return;
    game.setPendingAction("show-leaderboard");
    game.setFeedback({ tone: "info", message: "Revealing scores..." });
    game.socketRef.current?.emit("host:show-leaderboard", game.room.roomCode);
  };

  const nextQuestion = () => {
    if (!game.room) return;
    const isLast = game.room.currentQuestionIndex === game.room.totalQuestions - 1;
    game.setPendingAction("next-question");
    game.setFeedback({
      tone: "info",
      message: isLast ? "Wrapping up..." : "Next question...",
    });
    game.socketRef.current?.emit("host:next-question", game.room.roomCode);
  };

  const submitAnswer = () => {
    if (!game.room || !game.currentQuestion || game.hasAnsweredCurrentQuestion) {
      return;
    }

    let payload: SubmitAnswerPayload | null = null;

    switch (game.currentQuestion.type) {
      case "multiple-choice":
      case "poll":
        if (!game.selectedOptionId) {
          return;
        }
        payload = {
          roomCode: game.room.roomCode,
          type: game.currentQuestion.type,
          optionId: game.selectedOptionId,
        };
        break;
      case "number":
        if (game.numberGuess === null) {
          return;
        }
        payload = {
          roomCode: game.room.roomCode,
          type: "number",
          guess: game.numberGuess,
        };
        break;
      case "ranking":
        if (game.rankingOrder.length !== game.currentQuestion.items.length) {
          return;
        }
        payload = {
          roomCode: game.room.roomCode,
          type: "ranking",
          order: game.rankingOrder,
        };
        break;
    }

    if (!payload) {
      return;
    }

    game.setPendingAction("submit-answer");
    game.setFeedback({ tone: "info", message: "Locked in!" });
    game.socketRef.current?.emit("player:submit-answer", payload);
  };

  // Auto-check a room code that arrived via a shared URL (?room=XXXX).
  useEffect(() => {
    if (
      !game.sharedRoomCode ||
      game.connectionState !== "connected" ||
      game.pendingAction !== null ||
      game.room ||
      game.checkedRoom ||
      game.screen !== "join-code"
    ) {
      return;
    }

    const roomCode = game.sharedRoomCode;
    game.consumeSharedRoomCode();
    game.setPendingAction("check-room");
    game.setFeedback({ tone: "info", message: "Opening shared room..." });
    game.socketRef.current?.emit("player:check-room", { roomCode });
  }, [
    game.checkedRoom,
    game.connectionState,
    game.consumeSharedRoomCode,
    game.pendingAction,
    game.room,
    game.screen,
    game.sharedRoomCode,
    game.socketRef,
    game.setFeedback,
    game.setPendingAction,
  ]);

  const canCheckRoom =
    game.connectionState === "connected" &&
    game.pendingAction === null &&
    game.roomCodeInput.trim().length > 0;

  const canJoinRoom =
    game.connectionState === "connected" &&
    game.pendingAction === null &&
    game.playerName.trim().length > 0;

  const canCreateRoom =
    game.connectionState === "connected" &&
    game.pendingAction === null &&
    editor.hostName.trim().length > 0 &&
    quizIssues.length === 0;

  return {
    quizIssues,
    checkRoom,
    joinRoom,
    createRoom,
    startGame,
    revealLeaderboard,
    nextQuestion,
    submitAnswer,
    canCheckRoom,
    canJoinRoom,
    canCreateRoom,
  };
}
