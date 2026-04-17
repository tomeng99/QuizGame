import { Pressable, Text, View } from "react-native";
import type { PublicQuestion, RoomSnapshot } from "@quizgame/contracts";
import { styles } from "../styles";
import { StatusChip, LeaderboardRow } from "../components";
import { OPTION_THEMES } from "../constants";
import type { ConnectionState, PendingAction } from "../types";

interface GameScreenProps {
  room: RoomSnapshot;
  isHost: boolean;
  connectionState: ConnectionState;
  pendingAction: PendingAction;
  currentQuestion: PublicQuestion | null;
  selectedOptionId: string | null;
  hasAnsweredCurrentQuestion: boolean;
  answeredCount: number;
  onSelectOption: (optionId: string) => void;
  onStartGame: () => void;
  onRevealLeaderboard: () => void;
  onNextQuestion: () => void;
  onSubmitAnswer: () => void;
}

export function GameScreen({
  room,
  isHost,
  connectionState,
  pendingAction,
  currentQuestion,
  selectedOptionId,
  hasAnsweredCurrentQuestion,
  answeredCount,
  onSelectOption,
  onStartGame,
  onRevealLeaderboard,
  onNextQuestion,
  onSubmitAnswer,
}: GameScreenProps) {
  const winner = room.leaderboard[0] ?? null;

  return (
    <>
      {/* Compact game header */}
      <View style={styles.gameHeader}>
        <View style={styles.gameHeaderInfo}>
          <Text style={styles.gameTitle}>
            {"\uD83E\uDDE0"} {room.quizTitle}
          </Text>
          <Text style={styles.gameSubtitle}>
            Room {room.roomCode} {"\u2022"} {room.players.length} player
            {room.players.length !== 1 ? "s" : ""}
            {room.status === "question"
              ? ` \u2022 ${answeredCount} answered`
              : ""}
          </Text>
        </View>
        <StatusChip state={connectionState} />
      </View>

      {/* Host controls */}
      {isHost && (
        <View style={styles.hostControlsCard}>
          {room.status === "lobby" && (
            <>
              <Text style={styles.controlsHint}>
                Share this code with your players
              </Text>
              <Text style={styles.bigRoomCode}>{room.roomCode}</Text>
              <Text style={styles.controlsMeta}>
                {room.players.length === 0
                  ? "Waiting for players to join..."
                  : `${room.players.length} player${room.players.length !== 1 ? "s" : ""} joined. Start when ready!`}
              </Text>
              <Pressable
                disabled={
                  pendingAction !== null || room.players.length === 0
                }
                onPress={onStartGame}
                style={[
                  styles.bigButton,
                  (pendingAction !== null ||
                    room.players.length === 0) &&
                    styles.disabledButton,
                ]}
              >
                <Text style={styles.bigButtonText}>
                  {pendingAction === "start-game"
                    ? "Starting..."
                    : "Start Quiz \u26A1"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "question" && (
            <>
              <Text style={styles.controlsHint}>
                {"\u23F3"} Question is live
              </Text>
              <Text style={styles.controlsMeta}>
                {answeredCount} of {room.players.length} answered
              </Text>
              <Pressable
                disabled={pendingAction !== null}
                onPress={onRevealLeaderboard}
                style={[
                  styles.secondaryBigButton,
                  pendingAction !== null && styles.disabledButton,
                ]}
              >
                <Text style={styles.secondaryBigButtonText}>
                  {pendingAction === "show-leaderboard"
                    ? "Revealing..."
                    : "Show Scores \uD83D\uDCCA"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "leaderboard" && (
            <>
              <Text style={styles.controlsHint}>
                {"\uD83D\uDCCA"} Scores revealed
              </Text>
              <Pressable
                disabled={pendingAction !== null}
                onPress={onNextQuestion}
                style={[
                  styles.bigButton,
                  pendingAction !== null && styles.disabledButton,
                ]}
              >
                <Text style={styles.bigButtonText}>
                  {pendingAction === "next-question"
                    ? "Loading..."
                    : room.currentQuestionIndex ===
                        room.totalQuestions - 1
                      ? "Finish Quiz \uD83C\uDFC1"
                      : "Next Question \u26A1"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "finished" && (
            <Text style={styles.controlsHint}>
              {"\uD83C\uDFC6"} Quiz Complete!
            </Text>
          )}
        </View>
      )}

      {/* Player waiting states */}
      {!isHost && room.status === "lobby" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>{"\u23F3"}</Text>
          <Text style={styles.waitingText}>
            You're in! Waiting for {room.hostName} to start...
          </Text>
        </View>
      )}
      {!isHost && room.status === "leaderboard" && !currentQuestion && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>{"\uD83D\uDCCA"}</Text>
          <Text style={styles.waitingText}>
            Check the scores below!
          </Text>
        </View>
      )}
      {!isHost && room.status === "finished" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>{"\uD83C\uDF89"}</Text>
          <Text style={styles.waitingText}>Thanks for playing!</Text>
        </View>
      )}

      {/* Active question */}
      {currentQuestion && (
        <View style={styles.questionCard}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>
              {currentQuestion.index + 1} / {currentQuestion.total}
            </Text>
          </View>
          <Text style={styles.questionPrompt}>
            {currentQuestion.prompt}
          </Text>

          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option, optionIndex) => {
              const theme =
                OPTION_THEMES[optionIndex % OPTION_THEMES.length];
              const selected = selectedOptionId === option.id;
              const answered = hasAnsweredCurrentQuestion;

              return (
                <Pressable
                  key={option.id}
                  disabled={answered}
                  onPress={() => onSelectOption(option.id)}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: selected
                        ? theme.bg
                        : `${theme.bg}25`,
                      borderColor: selected ? theme.bg : `${theme.bg}50`,
                    },
                    answered && !selected && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.optionIcon}>{theme.icon}</Text>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {option.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!isHost && (
            <Pressable
              disabled={
                !selectedOptionId ||
                hasAnsweredCurrentQuestion ||
                pendingAction !== null
              }
              onPress={onSubmitAnswer}
              style={[
                hasAnsweredCurrentQuestion
                  ? styles.answeredButton
                  : styles.bigButton,
                !selectedOptionId &&
                  !hasAnsweredCurrentQuestion &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.bigButtonText}>
                {hasAnsweredCurrentQuestion
                  ? "Answer Locked In \u2705"
                  : pendingAction === "submit-answer"
                    ? "Sending..."
                    : "Lock In Answer \uD83D\uDD12"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Leaderboard */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {room.status === "finished"
            ? "\uD83C\uDFC6 Final Results"
            : "\uD83D\uDCCA Leaderboard"}
        </Text>

        {winner && room.status === "finished" && (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerEmoji}>{"\uD83C\uDFC6"}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerScore}>
              {winner.score} points
            </Text>
          </View>
        )}

        {room.leaderboard.length === 0 ? (
          <Text style={styles.emptyText}>
            Players will appear here once they join.
          </Text>
        ) : (
          room.leaderboard.map((entry, index) => (
            <LeaderboardRow
              key={entry.playerId}
              entry={entry}
              index={index}
              roomStatus={room.status}
            />
          ))
        )}
      </View>
    </>
  );
}
