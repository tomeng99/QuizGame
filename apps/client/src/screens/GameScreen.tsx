import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import type {
  AnswerAcceptedPayload,
  PublicQuestion,
  QuestionRevealPayload,
  RoomSnapshot,
} from "@quizgame/contracts";
import { IS_DEV_ENVIRONMENT } from "../config";
import { styles } from "../styles";
import { colors } from "../theme";
import {
  StatusChip,
  LeaderboardRow,
  RankingQuestion,
  SliderQuestion,
} from "../components";
import { OPTION_THEMES } from "../constants";
import type { ConnectionState, PendingAction } from "../types";

interface GameScreenProps {
  room: RoomSnapshot;
  isHost: boolean;
  connectionState: ConnectionState;
  pendingAction: PendingAction;
  currentQuestion: PublicQuestion | null;
  joinUrl: string | null;
  selectedOptionId: string | null;
  numberGuess: number | null;
  rankingOrder: string[];
  hasAnsweredCurrentQuestion: boolean;
  answeredCount: number;
  lastAnswerResult: AnswerAcceptedPayload | null;
  questionReveal: QuestionRevealPayload | null;
  onSelectOption: (optionId: string) => void;
  onNumberGuessChange: (value: number | null) => void;
  onRankingOrderChange: (order: string[]) => void;
  onStartGame: () => void;
  onRevealLeaderboard: () => void;
  onNextQuestion: () => void;
  onSubmitAnswer: () => void;
  onBackToStart: () => void;
  onOpenPlayerTab: (() => void) | null;
}

export function GameScreen({
  room,
  isHost,
  connectionState,
  pendingAction,
  currentQuestion,
  joinUrl,
  selectedOptionId,
  numberGuess,
  rankingOrder,
  hasAnsweredCurrentQuestion,
  answeredCount,
  lastAnswerResult,
  questionReveal,
  onSelectOption,
  onNumberGuessChange,
  onRankingOrderChange,
  onStartGame,
  onRevealLeaderboard,
  onNextQuestion,
  onSubmitAnswer,
  onBackToStart,
  onOpenPlayerTab,
}: GameScreenProps) {
  const winner = room.leaderboard[0] ?? null;
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!currentQuestion || room.status !== "question") {
      setSecondsLeft(null);
      return;
    }

    setSecondsLeft(currentQuestion.timeLimit);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion, room.status]);

  const timerFraction =
    currentQuestion && secondsLeft !== null
      ? secondsLeft / currentQuestion.timeLimit
      : 1;

  const timerColor =
    timerFraction > 0.5
      ? colors.successBright
      : timerFraction > 0.25
        ? colors.optionOrange
        : colors.errorBright;

  useEffect(() => {
    let cancelled = false;

    if (!joinUrl) {
      setQrCodeDataUrl(null);
      return () => {
        cancelled = true;
      };
    }

    const generateQrCode = async () => {
      const { default: QRCode } = await import("qrcode");
      const nextQrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 256,
      });

      if (!cancelled) {
        setQrCodeDataUrl(nextQrCodeDataUrl);
      }
    };

    void generateQrCode().catch((error: unknown) => {
      console.error("Failed to generate room QR code.", error);

      if (!cancelled) {
        setQrCodeDataUrl(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const canSubmitAnswer = (() => {
    if (!currentQuestion || hasAnsweredCurrentQuestion || pendingAction !== null) {
      return false;
    }

    switch (currentQuestion.type) {
      case "multiple-choice":
      case "poll":
        return selectedOptionId !== null;
      case "number":
        return numberGuess !== null;
      case "ranking":
        return rankingOrder.length === currentQuestion.items.length;
    }
  })();

  const renderOptionGrid = (mode: "multiple-choice" | "poll") => {
    if (!currentQuestion || (currentQuestion.type !== "multiple-choice" && currentQuestion.type !== "poll")) {
      return null;
    }

    const pollReveal =
      mode === "poll" && questionReveal?.type === "poll" ? questionReveal : null;
    const multipleChoiceReveal =
      mode === "multiple-choice" && questionReveal?.type === "multiple-choice"
        ? questionReveal
        : null;

    return (
      <View style={styles.optionsGrid}>
        {currentQuestion.options.map((option, optionIndex) => {
          const theme = OPTION_THEMES[optionIndex % OPTION_THEMES.length];
          const selected = selectedOptionId === option.id;
          const answered = hasAnsweredCurrentQuestion;
          const isCorrectOption =
            multipleChoiceReveal !== null && option.id === multipleChoiceReveal.correctOptionId;
          const isMyWrongAnswer = multipleChoiceReveal !== null && selected && !isCorrectOption;
          const isMajorityOption = pollReveal !== null && option.id === pollReveal.majorityOptionId;
          const bgColor = isCorrectOption || isMajorityOption
            ? `${colors.successBright}26`
            : isMyWrongAnswer
              ? `${colors.errorBright}20`
              : selected
                ? theme.bg
                : `${theme.bg}25`;
          const borderColor = isCorrectOption || isMajorityOption
            ? colors.successBright
            : isMyWrongAnswer
              ? colors.errorBright
              : selected
                ? theme.bg
                : `${theme.bg}50`;
          const voteCount = pollReveal?.voteCounts[option.id] ?? 0;
          const totalVotes = pollReveal
            ? Object.values(pollReveal.voteCounts).reduce((sum, count) => sum + count, 0)
            : 0;
          const voteWidth = totalVotes > 0 ? `${(voteCount / totalVotes) * 100}%` as `${number}%` : "0%";

          return (
            <Pressable
              key={option.id}
              disabled={answered || room.status !== "question"}
              onPress={() => onSelectOption(option.id)}
              style={[
                styles.optionButton,
                { backgroundColor: bgColor, borderColor },
                answered && !selected && !isCorrectOption && !isMajorityOption && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.optionIcon}>{theme.icon}</Text>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    (selected || isCorrectOption || isMajorityOption) && styles.optionTextSelected,
                  ]}
                >
                  {option.text}
                </Text>
                {pollReveal ? (
                  <View style={styles.pollResultRow}>
                    <View style={styles.pollResultTrack}>
                      <View style={[styles.pollResultFill, { width: voteWidth }]} />
                    </View>
                    <Text style={styles.pollResultCount}>{voteCount}</Text>
                  </View>
                ) : null}
              </View>
              {isCorrectOption && <Text style={styles.optionRevealIcon}>{"\u2705"}</Text>}
              {isMyWrongAnswer && <Text style={styles.optionRevealIcon}>{"\u274C"}</Text>}
              {isMajorityOption && <Text style={styles.optionRevealIcon}>{"\uD83D\uDC51"}</Text>}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderReveal = () => {
    if (!currentQuestion || room.status !== "leaderboard" || !questionReveal) {
      return null;
    }

    if (currentQuestion.type === "number" && questionReveal.type === "number") {
      return (
        <View style={styles.revealCard}>
          <Text style={styles.revealLabel}>Correct number</Text>
          <Text style={styles.revealValue}>{questionReveal.correctNumber}</Text>
          {numberGuess !== null ? (
            <Text style={styles.revealSubtext}>Your guess: {numberGuess}</Text>
          ) : null}
        </View>
      );
    }

    if (currentQuestion.type === "ranking" && questionReveal.type === "ranking") {
      const itemMap = new Map(currentQuestion.items.map((item) => [item.id, item.text]));

      return (
        <View style={styles.revealCard}>
          <Text style={styles.revealLabel}>Correct order</Text>
          {questionReveal.correctOrder.map((itemId, index) => (
            <Text key={itemId} style={styles.revealListItem}>
              {index + 1}. {itemMap.get(itemId) ?? itemId}
            </Text>
          ))}
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <View style={styles.gameHeader}>
        <View style={styles.gameHeaderInfo}>
          <Text style={styles.gameTitle}>{room.quizTitle}</Text>
          <Text style={styles.gameSubtitle}>
            Room {room.roomCode} {"\u2022"} {room.players.length} player
            {room.players.length !== 1 ? "s" : ""}
            {room.status === "question" ? ` \u2022 ${answeredCount} answered` : ""}
          </Text>
        </View>
        <StatusChip state={connectionState} />
      </View>

      {isHost && (
        <View style={styles.hostControlsCard}>
          {room.status === "lobby" && (
            <>
              <Text style={styles.controlsHint}>Scan to join instantly</Text>
              {qrCodeDataUrl && (
                <View style={styles.qrPanel}>
                  <View style={styles.qrFrame}>
                    <Image source={{ uri: qrCodeDataUrl }} style={styles.qrImage} />
                  </View>
                  <Text style={styles.qrCaption}>
                    Players can scan this with their phone and land straight on
                    the join screen.
                  </Text>
                </View>
              )}
              {joinUrl ? (
                <>
                  <Text style={styles.controlsMeta}>Or open this join link directly</Text>
                  <Text selectable style={styles.joinUrlText}>
                    {joinUrl}
                  </Text>
                </>
              ) : (
                <Text style={styles.controlsMeta}>
                  Share the room code below with your players.
                </Text>
              )}
              <Text style={styles.controlsMeta}>Manual fallback</Text>
              <Text style={styles.bigRoomCode}>{room.roomCode}</Text>
              <Text style={styles.controlsMeta}>
                {room.players.length === 0
                  ? "Waiting for players to join..."
                  : `${room.players.length} player${room.players.length !== 1 ? "s" : ""} joined. Start when ready!`}
              </Text>
              {onOpenPlayerTab && IS_DEV_ENVIRONMENT && (
                <Pressable onPress={onOpenPlayerTab} style={styles.devButton}>
                  <Text style={styles.devButtonText}>⚡ Open player tab</Text>
                </Pressable>
              )}
              <Pressable
                disabled={pendingAction !== null || room.players.length === 0}
                onPress={onStartGame}
                style={[
                  styles.bigButton,
                  (pendingAction !== null || room.players.length === 0) && styles.disabledButton,
                ]}
              >
                <Text style={styles.bigButtonText}>
                  {pendingAction === "start-game" ? "starting..." : "Start quiz"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "question" && (
            <>
              <Text style={styles.controlsHint}>Question is live</Text>
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
                  {pendingAction === "show-leaderboard" ? "revealing..." : "Show scores"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "leaderboard" && (
            <>
              <Text style={styles.controlsHint}>Scores revealed</Text>
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
                    ? "loading..."
                    : room.currentQuestionIndex === room.totalQuestions - 1
                      ? "Finish quiz"
                      : "Next question"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "finished" && (
            <>
              <Text style={styles.controlsHint}>Quiz complete!</Text>
              <Pressable onPress={onBackToStart} style={styles.secondaryBigButton}>
                <Text style={styles.secondaryBigButtonText}>Back to start</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {!isHost && room.status === "lobby" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingText}>
            You're in! Waiting for {room.hostName} to start...
          </Text>
        </View>
      )}
      {!isHost && room.status === "finished" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingText}>Thanks for playing!</Text>
          <Pressable onPress={onBackToStart} style={styles.secondaryBigButton}>
            <Text style={styles.secondaryBigButtonText}>Back to start</Text>
          </Pressable>
        </View>
      )}

      {currentQuestion && (
        <View style={styles.questionCard}>
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>
              {currentQuestion.index + 1} / {currentQuestion.total}
            </Text>
          </View>

          {room.status === "question" && secondsLeft !== null && (
            <View style={styles.timerRow}>
              <View style={[styles.timerBar, { flex: 1 }]}>
                <View
                  style={[
                    styles.timerBarFill,
                    {
                      width: `${timerFraction * 100}%` as `${number}%`,
                      backgroundColor: timerColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.timerLabel, { color: timerColor }]}>{secondsLeft}s</Text>
            </View>
          )}

          <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>

          {currentQuestion.type === "multiple-choice" && renderOptionGrid("multiple-choice")}
          {currentQuestion.type === "poll" && renderOptionGrid("poll")}
          {currentQuestion.type === "number" && numberGuess !== null && (
            <SliderQuestion
              minValue={currentQuestion.minValue}
              maxValue={currentQuestion.maxValue}
              value={numberGuess}
              disabled={hasAnsweredCurrentQuestion || room.status !== "question"}
              onChange={(value) => onNumberGuessChange(value)}
            />
          )}
          {currentQuestion.type === "ranking" && (
            <RankingQuestion
              items={currentQuestion.items}
              selectedOrder={rankingOrder}
              disabled={hasAnsweredCurrentQuestion || room.status !== "question"}
              onOrderChange={onRankingOrderChange}
            />
          )}

          {renderReveal()}

          {!isHost && hasAnsweredCurrentQuestion && lastAnswerResult && (
            <View
              style={[
                styles.answerResultCard,
                lastAnswerResult.pending
                  ? styles.answerResultPending
                  : lastAnswerResult.isCorrect
                    ? styles.answerResultCorrect
                    : styles.answerResultWrong,
              ]}
            >
              <Text style={styles.answerResultEmoji}>
                {lastAnswerResult.pending
                  ? "\uD83C\uDFAF"
                  : lastAnswerResult.isCorrect
                    ? "\uD83C\uDF89"
                    : "\uD83D\uDE14"}
              </Text>
              <Text style={styles.answerResultText}>
                {lastAnswerResult.pending
                  ? "Answer locked in!"
                  : lastAnswerResult.isCorrect
                    ? "Correct!"
                    : "Wrong answer"}
              </Text>
              {lastAnswerResult.pending ? (
                <Text style={styles.answerResultPoints}>
                  Points revealed when time's up.
                </Text>
              ) : lastAnswerResult.isCorrect ? (
                <Text style={styles.answerResultPoints}>
                  +{lastAnswerResult.pointsEarned} points
                </Text>
              ) : null}
              {!lastAnswerResult.pending &&
                lastAnswerResult.isCorrect &&
                lastAnswerResult.streak >= 2 && (
                  <Text style={styles.answerResultStreak}>
                    {"\uD83D\uDD25"} {lastAnswerResult.streak}x streak bonus!
                  </Text>
                )}
            </View>
          )}

          {!isHost && room.status === "question" && (
            <Pressable
              disabled={!canSubmitAnswer}
              onPress={onSubmitAnswer}
              style={[
                hasAnsweredCurrentQuestion ? styles.answeredButton : styles.bigButton,
                !canSubmitAnswer && !hasAnsweredCurrentQuestion && styles.disabledButton,
              ]}
            >
              <Text style={styles.bigButtonText}>
                {hasAnsweredCurrentQuestion
                  ? "Answer locked in"
                  : pendingAction === "submit-answer"
                    ? "sending..."
                    : "Lock in answer"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {room.status === "finished" ? "Final Results" : "Leaderboard"}
        </Text>

        {winner && room.status === "finished" && (
          <View style={styles.winnerCard}>
            <Text style={styles.winnerEmoji}>{"\uD83C\uDFC6"}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerScore}>{winner.score} points</Text>
          </View>
        )}

        {room.leaderboard.length === 0 ? (
          <Text style={styles.emptyText}>Players will appear here once they join.</Text>
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
