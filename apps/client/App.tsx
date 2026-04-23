import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { useGameState, useQuizEditor } from "./src/hooks";
import { FeedbackBanner, StatusChip } from "./src/components";
import { JoinCodeScreen, JoinNameScreen, HostSetupScreen, GameScreen } from "./src/screens";
import { validateQuiz } from "./src/helpers";
import { styles } from "./src/styles";

export default function App() {
  const game = useGameState();
  const editor = useQuizEditor();

  const quizIssues = useMemo(() => validateQuiz(editor.quiz), [editor.quiz]);

  /* ── Socket-driven actions ── */

  const checkRoom = () => {
    if (game.connectionState !== "connected" || !game.roomCodeInput.trim()) {
      return;
    }
    game.setPendingAction("check-room");
    game.setFeedback({ tone: "info", message: "Looking for room..." });
    game.socketRef.current?.emit("player:check-room", {
      roomCode: game.roomCodeInput.trim().toUpperCase(),
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
    if (
      game.connectionState !== "connected" ||
      !editor.hostName.trim() ||
      quizIssues.length > 0
    ) {
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
    const isLast =
      game.room.currentQuestionIndex === game.room.totalQuestions - 1;
    game.setPendingAction("next-question");
    game.setFeedback({
      tone: "info",
      message: isLast ? "Wrapping up..." : "Next question...",
    });
    game.socketRef.current?.emit("host:next-question", game.room.roomCode);
  };

  const submitAnswer = () => {
    if (!game.room || !game.selectedOptionId || hasAnsweredCurrentQuestion) {
      return;
    }
    game.setPendingAction("submit-answer");
    game.setFeedback({ tone: "info", message: "Locked in!" });
    game.socketRef.current?.emit("player:submit-answer", {
      roomCode: game.room.roomCode,
      optionId: game.selectedOptionId,
    });
  };

  /* ── Derived state ── */

  const answeredCount = useMemo(
    () =>
      game.room?.leaderboard.filter((e) => e.answeredCurrentQuestion).length ??
      0,
    [game.room],
  );

  const hasAnsweredCurrentQuestion = useMemo(() => {
    if (!game.room || !game.sessionPlayerId) return false;
    return game.room.leaderboard.some(
      (e) =>
        e.playerId === game.sessionPlayerId && e.answeredCurrentQuestion,
    );
  }, [game.room, game.sessionPlayerId]);

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

  /* ── Render ── */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header (hidden during game) */}
        {game.screen !== "game" && (
          <View style={styles.headerContainer}>
            <Text style={styles.title}>QuizGame</Text>
            {game.screen === "join-code" && (
              <Text style={styles.subtitle}>Join a live quiz in seconds</Text>
            )}
            <StatusChip state={game.connectionState} />
          </View>
        )}

        <FeedbackBanner feedback={game.feedback} />

        {/* Screen: Enter room code */}
        {game.screen === "join-code" && (
          <JoinCodeScreen
            roomCodeInput={game.roomCodeInput}
            onRoomCodeChange={game.setRoomCodeInput}
            canCheckRoom={canCheckRoom}
            pendingAction={game.pendingAction}
            onCheckRoom={checkRoom}
            onHostPress={() => {
              game.setScreen("host-setup");
              game.setFeedback({ tone: "info", message: "Set up your quiz below." });
            }}
          />
        )}

        {/* Screen: Choose display name */}
        {game.screen === "join-name" && game.checkedRoom && (
          <JoinNameScreen
            checkedRoom={game.checkedRoom}
            playerName={game.playerName}
            onPlayerNameChange={game.setPlayerName}
            canJoinRoom={canJoinRoom}
            pendingAction={game.pendingAction}
            onJoinRoom={joinRoom}
            onBack={() => {
              game.setScreen("join-code");
              game.setCheckedRoom(null);
            }}
          />
        )}

        {/* Screen: Host setup */}
        {game.screen === "host-setup" && !game.room && (
          <HostSetupScreen
            hostName={editor.hostName}
            onHostNameChange={editor.setHostName}
            quiz={editor.quiz}
            onQuizTitleChange={(title) =>
              editor.setQuiz((prev) => ({ ...prev, title }))
            }
            onPromptChange={editor.updateQuestionPrompt}
            onOptionChange={editor.updateQuestionOption}
            onCorrectOptionChange={editor.setCorrectOption}
            onRemoveQuestion={editor.removeQuestion}
            onAddQuestion={editor.addQuestion}
            quizIssues={quizIssues}
            canCreateRoom={canCreateRoom}
            pendingAction={game.pendingAction}
            onCreateRoom={createRoom}
            onBack={() => {
              game.setScreen("join-code");
              game.setFeedback({ tone: "info", message: "Ready to play!" });
            }}
          />
        )}

        {/* Screen: Active game */}
        {game.screen === "game" && game.room && (
          <GameScreen
            room={game.room}
            isHost={game.isHost}
            connectionState={game.connectionState}
            pendingAction={game.pendingAction}
            currentQuestion={game.currentQuestion}
            selectedOptionId={game.selectedOptionId}
            hasAnsweredCurrentQuestion={hasAnsweredCurrentQuestion}
            answeredCount={answeredCount}
            onSelectOption={game.setSelectedOptionId}
            onStartGame={startGame}
            onRevealLeaderboard={revealLeaderboard}
            onNextQuestion={nextQuestion}
            onSubmitAnswer={submitAnswer}
            onBackToStart={() => {
              game.resetToStart();
              game.setFeedback({ tone: "info", message: "Ready to play!" });
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
