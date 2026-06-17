import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Platform, SafeAreaView, ScrollView, Text, View } from "react-native";

import { getJoinUrl } from "./src/config";
import { useGameActions, useGameState, useQuizEditor } from "./src/hooks";
import { FeedbackBanner, StatusChip } from "./src/components";
import { JoinCodeScreen, JoinNameScreen, HostSetupScreen, GameScreen } from "./src/screens";
import { styles } from "./src/styles";

export default function App() {
  const game = useGameState();
  const editor = useQuizEditor();
  const actions = useGameActions(game, editor);

  const joinUrl = useMemo(
    () => (game.room ? getJoinUrl(game.room.roomCode) : null),
    [game.room],
  );

  const openPlayerTab = () => {
    if (!joinUrl || Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    window.open(joinUrl, "_blank");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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

        {game.screen === "join-code" && (
          <JoinCodeScreen
            roomCodeInput={game.roomCodeInput}
            onRoomCodeChange={game.setRoomCodeInput}
            canCheckRoom={actions.canCheckRoom}
            pendingAction={game.pendingAction}
            onCheckRoom={actions.checkRoom}
            onHostPress={() => {
              game.setScreen("host-setup");
              game.setFeedback({ tone: "info", message: "Set up your quiz below." });
            }}
          />
        )}

        {game.screen === "join-name" && game.checkedRoom && (
          <JoinNameScreen
            checkedRoom={game.checkedRoom}
            playerName={game.playerName}
            onPlayerNameChange={game.setPlayerName}
            canJoinRoom={actions.canJoinRoom}
            pendingAction={game.pendingAction}
            onJoinRoom={actions.joinRoom}
            onBack={() => {
              game.setScreen("join-code");
              game.setCheckedRoom(null);
            }}
          />
        )}

        {game.screen === "host-setup" && !game.room && (
          <HostSetupScreen
            hostName={editor.hostName}
            onHostNameChange={editor.setHostName}
            quiz={editor.quiz}
            selectedQuestionIndex={editor.selectedQuestionIndex}
            onSelectQuestion={editor.setSelectedQuestionIndex}
            onQuizTitleChange={editor.updateQuizTitle}
            onTimeLimitChange={editor.updateTimeLimit}
            onPromptChange={editor.updateQuestionPrompt}
            onTypeChange={editor.updateQuestionType}
            onOptionChange={editor.updateQuestionOption}
            onPollOptionChange={editor.updatePollOption}
            onNumberFieldChange={editor.updateNumberField}
            onRankingItemChange={editor.updateRankingItem}
            onAddRankingItem={editor.addRankingItem}
            onRemoveRankingItem={editor.removeRankingItem}
            onCorrectOptionChange={editor.setCorrectOption}
            onRemoveQuestion={editor.removeQuestion}
            onAddQuestion={editor.addQuestion}
            quizIssues={actions.quizIssues}
            canCreateRoom={actions.canCreateRoom}
            pendingAction={game.pendingAction}
            onCreateRoom={actions.createRoom}
            onBack={() => {
              game.setScreen("join-code");
              game.setFeedback({ tone: "info", message: "Ready to play!" });
            }}
            onLoadSampleQuiz={editor.loadSampleQuiz}
          />
        )}

        {game.screen === "game" && game.room && (
          <GameScreen
            room={game.room}
            isHost={game.isHost}
            connectionState={game.connectionState}
            pendingAction={game.pendingAction}
            currentQuestion={game.currentQuestion}
            joinUrl={joinUrl}
            selectedOptionId={game.selectedOptionId}
            numberGuess={game.numberGuess}
            rankingOrder={game.rankingOrder}
            hasAnsweredCurrentQuestion={game.hasAnsweredCurrentQuestion}
            answeredCount={game.answeredCount}
            lastAnswerResult={game.lastAnswerResult}
            questionReveal={game.questionReveal}
            onSelectOption={game.setSelectedOptionId}
            onNumberGuessChange={game.setNumberGuess}
            onRankingOrderChange={game.setRankingOrder}
            onStartGame={actions.startGame}
            onRevealLeaderboard={actions.revealLeaderboard}
            onNextQuestion={actions.nextQuestion}
            onSubmitAnswer={actions.submitAnswer}
            onBackToStart={() => {
              game.resetToStart();
              game.setFeedback({ tone: "info", message: "Ready to play!" });
            }}
            onOpenPlayerTab={joinUrl ? openPlayerTab : null}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
