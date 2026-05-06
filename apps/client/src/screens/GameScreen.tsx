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
import { StatusChip, LeaderboardRow } from "../components";
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
  hasAnsweredCurrentQuestion: boolean;
  answeredCount: number;
  lastAnswerResult: AnswerAcceptedPayload | null;
  questionReveal: QuestionRevealPayload | null;
  onSelectOption: (optionId: string) => void;
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
  hasAnsweredCurrentQuestion,
  answeredCount,
  lastAnswerResult,
  questionReveal,
  onSelectOption,
  onStartGame,
  onRevealLeaderboard,
  onNextQuestion,
  onSubmitAnswer,
  onBackToStart,
  onOpenPlayerTab,
}: GameScreenProps) {
  const winner = room.leaderboard[0] ?? null;
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // ── Countdown timer ────────────────────────────────────────────────────────
  // Client-side display only. The server is the authority: it schedules its own
  // setTimeout and will fire emitLeaderboard regardless of what this interval does.
  // The two clocks may drift by a frame or two but that is acceptable — the server
  // result is always canonical.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    // Reset and stop the timer whenever there is no active question.
    if (!currentQuestion || room.status !== "question") {
      setSecondsLeft(null);
      return;
    }

    // Seed from the server-supplied timeLimit so the client and server start together.
    setSecondsLeft(currentQuestion.timeLimit);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        // Stop the interval from within the state updater to avoid stale-closure issues.
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Clean up on unmount or when the question/status changes.
    return () => clearInterval(interval);
  }, [currentQuestion, room.status]);

  // Fraction of time remaining (1.0 = full, 0.0 = expired), used to drive the
  // progress-bar width and color transitions.
  const timerFraction =
    currentQuestion && secondsLeft !== null
      ? secondsLeft / currentQuestion.timeLimit
      : 1;

  // Shift the bar from green → orange → red as urgency increases.
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

  return (
    <>
      {/* Compact game header */}
      <View style={styles.gameHeader}>
        <View style={styles.gameHeaderInfo}>
          <Text style={styles.gameTitle}>
            {room.quizTitle}
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
                Scan to join instantly
              </Text>
              {qrCodeDataUrl && (
                <View style={styles.qrPanel}>
                  <View style={styles.qrFrame}>
                    <Image
                      source={{ uri: qrCodeDataUrl }}
                      style={styles.qrImage}
                    />
                  </View>
                  <Text style={styles.qrCaption}>
                    Players can scan this with their phone and land straight on
                    the join screen.
                  </Text>
                </View>
              )}
              {joinUrl ? (
                <>
                  <Text style={styles.controlsMeta}>
                    Or open this join link directly
                  </Text>
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
                    ? "starting..."
                    : "Start quiz"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "question" && (
            <>
              <Text style={styles.controlsHint}>
                Question is live
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
                    ? "revealing..."
                    : "Show scores"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "leaderboard" && (
            <>
              <Text style={styles.controlsHint}>
                Scores revealed
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
                    ? "loading..."
                    : room.currentQuestionIndex ===
                        room.totalQuestions - 1
                      ? "Finish quiz"
                      : "Next question"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "finished" && (
            <>
              <Text style={styles.controlsHint}>
                Quiz complete!
              </Text>
              <Pressable
                onPress={onBackToStart}
                style={styles.secondaryBigButton}
              >
                <Text style={styles.secondaryBigButtonText}>
                  Back to start
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Player waiting states */}
      {!isHost && room.status === "lobby" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingText}>
            You're in! Waiting for {room.hostName} to start...
          </Text>
        </View>
      )}
      {!isHost && room.status === "leaderboard" && !currentQuestion && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingText}>
            Check the scores below!
          </Text>
        </View>
      )}
      {!isHost && room.status === "finished" && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingText}>Thanks for playing!</Text>
          <Pressable
            onPress={onBackToStart}
            style={styles.secondaryBigButton}
          >
            <Text style={styles.secondaryBigButtonText}>
              Back to start
            </Text>
          </Pressable>
        </View>
      )}

      {/* Active question */}
      {currentQuestion && (
        <View style={styles.questionCard}>
          {/* Progress badge + timer */}
          <View style={styles.questionBadge}>
            <Text style={styles.questionBadgeText}>
              {currentQuestion.index + 1} / {currentQuestion.total}
            </Text>
          </View>

          {/* Countdown bar (visible while question is live) */}
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
              <Text style={[styles.timerLabel, { color: timerColor }]}>
                {secondsLeft}s
              </Text>
            </View>
          )}

          <Text style={styles.questionPrompt}>
            {currentQuestion.prompt}
          </Text>

          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option, optionIndex) => {
              const theme =
                OPTION_THEMES[optionIndex % OPTION_THEMES.length];
              const selected = selectedOptionId === option.id;
              const answered = hasAnsweredCurrentQuestion;

              // questionReveal is set when the server emits "question:revealed" (on leaderboard).
              // Once revealed, we override the normal selection colours to show green/red feedback.
              const isRevealed = questionReveal !== null;
              const isCorrectOption = isRevealed && option.id === questionReveal?.correctOptionId;
              // Only highlight the player's own wrong pick — other wrong options stay muted.
              const isMyWrongAnswer = isRevealed && selected && !isCorrectOption;

              // Build dynamic background/border colours for the four option states:
              //   1. Correct answer (post-reveal)    → green tint
              //   2. My wrong answer (post-reveal)   → red tint
              //   3. Selected by me (pre-reveal)     → full theme colour
              //   4. Unselected / other              → 15% theme colour
              const bgColor = isCorrectOption
                ? `${colors.successBright}33`
                : isMyWrongAnswer
                  ? `${colors.errorBright}22`
                  : selected
                    ? theme.bg
                    : `${theme.bg}25`;

              const borderColor = isCorrectOption
                ? colors.successBright
                : isMyWrongAnswer
                  ? colors.errorBright
                  : selected
                    ? theme.bg
                    : `${theme.bg}50`;

              return (
                <Pressable
                  key={option.id}
                  disabled={answered}
                  onPress={() => onSelectOption(option.id)}
                  style={[
                    styles.optionButton,
                    { backgroundColor: bgColor, borderColor },
                    // After the player answers, dim all non-selected and non-correct options
                    // so focus shifts to the selected/correct ones.
                    answered && !selected && !isCorrectOption && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.optionIcon}>{theme.icon}</Text>
                  <Text
                    style={[
                      styles.optionText,
                      (selected || isCorrectOption) && styles.optionTextSelected,
                    ]}
                  >
                    {option.text}
                  </Text>
                  {/* Checkmark on the correct option after reveal */}
                  {isCorrectOption && (
                    <Text style={styles.optionRevealIcon}>{"\u2705"}</Text>
                  )}
                  {/* Cross on the player's own wrong pick after reveal */}
                  {isMyWrongAnswer && (
                    <Text style={styles.optionRevealIcon}>{"\u274C"}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Answer result — shown immediately after the player locks in their answer.
              The card is player-only (hosts see aggregate progress instead).
              lastAnswerResult is populated by the "answer:accepted" socket event and
              cleared when a new question starts. */}
          {!isHost && hasAnsweredCurrentQuestion && lastAnswerResult && (
            <View
              style={[
                styles.answerResultCard,
                lastAnswerResult.isCorrect
                  ? styles.answerResultCorrect
                  : styles.answerResultWrong,
              ]}
            >
              <Text style={styles.answerResultEmoji}>
                {lastAnswerResult.isCorrect ? "\uD83C\uDF89" : "\uD83D\uDE14"}
              </Text>
              <Text style={styles.answerResultText}>
                {lastAnswerResult.isCorrect ? "Correct!" : "Wrong answer"}
              </Text>
              {/* Only show the point value when correct; wrong answers earn nothing. */}
              {lastAnswerResult.isCorrect && (
                <Text style={styles.answerResultPoints}>
                  +{lastAnswerResult.pointsEarned} points
                </Text>
              )}
              {/* Streak bonus message — only shown when the player is on a multi-answer streak. */}
              {lastAnswerResult.isCorrect && lastAnswerResult.streak >= 2 && (
                <Text style={styles.answerResultStreak}>
                  {"\uD83D\uDD25"} {lastAnswerResult.streak}x streak bonus!
                </Text>
              )}
            </View>
          )}

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
                  ? "Answer locked in"
                  : pendingAction === "submit-answer"
                    ? "sending..."
                    : "Lock in answer"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Leaderboard */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {room.status === "finished"
            ? "Final Results"
            : "Leaderboard"}
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
