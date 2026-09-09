import type {
  AnswerAcceptedPayload,
  GameSummary,
  PublicQuestion,
  QuestionRevealPayload,
  RoomSnapshot,
} from "@quizgame/contracts";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import QRCodeSVG from "react-native-qrcode-svg";
import {
  GameSummaryCard,
  LeaderboardRow,
  RankingQuestion,
  SliderQuestion,
  StatusChip,
} from "../components";
import { IS_DEV_ENVIRONMENT } from "../config";
import { OPTION_THEMES } from "../constants";
import { spellOut } from "../helpers";
import { stageStyles, styles } from "../styles";
import { colors } from "../theme";
import type { ConnectionState, PendingAction } from "../types";

/** QR side length in points — bigger on the stage layout so it still scans from the back row. */
const QR_SIZE = 256;
const QR_SIZE_STAGE = 380;

interface GameScreenProps {
  room: RoomSnapshot;
  isHost: boolean;
  /** True when this is a host presenting on a big screen — see `useStageLayout`. */
  isStage: boolean;
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
  gameSummary: GameSummary | null;
  /** This client's public player id, used to find its own row in the recap. */
  sessionPlayerId: string | null;
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
  isStage,
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
  gameSummary,
  sessionPlayerId,
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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!currentQuestion || room.status !== "question") {
      setSecondsLeft(null);
      return;
    }

    // The server owns the deadline, so re-derive the remaining time from it on every tick
    // instead of decrementing a local counter. A counter drifts whenever the ticks stop
    // matching real time — a phone that locks mid-question throttles setInterval, and a
    // reconnect restarts the count from the full time limit — leaving the player looking at
    // seconds that the server has already spent.
    //
    // `endsAt` is on the server's clock, which a player's phone may not agree with, so
    // shift it by the skew measured against the `serverNow` stamped on this payload. Network
    // latency lands in that same offset and errs towards giving the player slightly longer,
    // which is the safe direction to be wrong in.
    // A client can briefly outrun the server during a rolling deploy and receive a question
    // with no timing fields on it. Fall back to a deadline anchored locally now, so the
    // countdown degrades to the old behaviour instead of rendering NaN.
    const hasServerDeadline =
      Number.isFinite(currentQuestion.endsAt) && Number.isFinite(currentQuestion.serverNow);
    const localEndsAt = hasServerDeadline
      ? currentQuestion.endsAt + (Date.now() - currentQuestion.serverNow)
      : Date.now() + currentQuestion.timeLimit * 1000;
    const readSecondsLeft = () => Math.max(0, Math.ceil((localEndsAt - Date.now()) / 1000));

    setSecondsLeft(readSecondsLeft());

    // Ticks faster than once a second so the displayed number turns over close to the real
    // second boundary. Repeat values are no-op state updates, so this does not add renders.
    const interval = setInterval(() => {
      const remaining = readSecondsLeft();
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [currentQuestion, room.status]);

  const timerFraction =
    currentQuestion && secondsLeft !== null ? secondsLeft / currentQuestion.timeLimit : 1;

  const timerColor =
    timerFraction > 0.5
      ? colors.successBright
      : timerFraction > 0.25
        ? colors.optionOrange
        : colors.errorBright;

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
    if (
      !currentQuestion ||
      (currentQuestion.type !== "multiple-choice" && currentQuestion.type !== "poll")
    ) {
      return null;
    }

    const pollReveal = mode === "poll" && questionReveal?.type === "poll" ? questionReveal : null;
    const multipleChoiceReveal =
      mode === "multiple-choice" && questionReveal?.type === "multiple-choice"
        ? questionReveal
        : null;

    return (
      <View
        aria-label="Answer options"
        role="group"
        style={[styles.optionsGrid, isStage && stageStyles.optionsGrid]}
      >
        {currentQuestion.options.map((option, optionIndex) => {
          const theme = OPTION_THEMES[optionIndex % OPTION_THEMES.length];
          const selected = selectedOptionId === option.id;
          const answered = hasAnsweredCurrentQuestion;
          const isCorrectOption =
            multipleChoiceReveal !== null && option.id === multipleChoiceReveal.correctOptionId;
          const isMyWrongAnswer = multipleChoiceReveal !== null && selected && !isCorrectOption;
          const isMajorityOption = pollReveal !== null && option.id === pollReveal.majorityOptionId;
          const bgColor =
            isCorrectOption || isMajorityOption
              ? `${colors.successBright}26`
              : isMyWrongAnswer
                ? `${colors.errorBright}20`
                : selected
                  ? theme.bg
                  : `${theme.bg}25`;
          const borderColor =
            isCorrectOption || isMajorityOption
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
          const voteWidth =
            totalVotes > 0 ? (`${(voteCount / totalVotes) * 100}%` as `${number}%`) : "0%";

          // Correctness, selection and poll results are all carried by colour and by an emoji
          // that reads as its Unicode name. Spell every one of them out instead.
          const stateLabel = [
            selected ? (answered ? "your answer" : "selected") : null,
            isCorrectOption ? "correct answer" : null,
            isMyWrongAnswer ? "incorrect" : null,
            isMajorityOption ? "most popular" : null,
            pollReveal ? `${voteCount} ${voteCount === 1 ? "vote" : "votes"}` : null,
          ].filter((part) => part !== null);
          const disabled = answered || room.status !== "question";

          return (
            <Pressable
              key={option.id}
              aria-disabled={disabled}
              aria-label={[`Option ${theme.label}`, option.text, ...stateLabel].join(", ")}
              disabled={disabled}
              onPress={() => onSelectOption(option.id)}
              role="button"
              style={[
                styles.optionButton,
                isStage && stageStyles.optionButton,
                { backgroundColor: bgColor, borderColor },
                answered && !selected && !isCorrectOption && !isMajorityOption && { opacity: 0.4 },
              ]}
            >
              <Text aria-hidden style={[styles.optionIcon, isStage && stageStyles.optionIcon]}>
                {theme.icon}
              </Text>
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    isStage && stageStyles.optionText,
                    (selected || isCorrectOption || isMajorityOption) && styles.optionTextSelected,
                  ]}
                >
                  {option.text}
                </Text>
                {pollReveal ? (
                  <View aria-hidden style={styles.pollResultRow}>
                    <View style={[styles.pollResultTrack, isStage && stageStyles.pollResultTrack]}>
                      <View style={[styles.pollResultFill, { width: voteWidth }]} />
                    </View>
                    <Text style={[styles.pollResultCount, isStage && stageStyles.pollResultCount]}>
                      {voteCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              {/* Decorative: the button's own label already names each of these states. */}
              {isCorrectOption && (
                <Text
                  aria-hidden
                  style={[styles.optionRevealIcon, isStage && stageStyles.optionRevealIcon]}
                >
                  {"\u2705"}
                </Text>
              )}
              {isMyWrongAnswer && (
                <Text
                  aria-hidden
                  style={[styles.optionRevealIcon, isStage && stageStyles.optionRevealIcon]}
                >
                  {"\u274C"}
                </Text>
              )}
              {isMajorityOption && (
                <Text
                  aria-hidden
                  style={[styles.optionRevealIcon, isStage && stageStyles.optionRevealIcon]}
                >
                  {"\uD83D\uDC51"}
                </Text>
              )}
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
        <View
          aria-live="polite"
          role="status"
          style={[styles.revealCard, isStage && stageStyles.revealCard]}
        >
          <Text style={[styles.revealLabel, isStage && stageStyles.revealLabel]}>
            Correct number
          </Text>
          <Text style={[styles.revealValue, isStage && stageStyles.revealValue]}>
            {questionReveal.correctNumber}
          </Text>
          {numberGuess !== null ? (
            <Text style={[styles.revealSubtext, isStage && stageStyles.revealSubtext]}>
              Your guess: {numberGuess}
            </Text>
          ) : null}
        </View>
      );
    }

    if (currentQuestion.type === "ranking" && questionReveal.type === "ranking") {
      const itemMap = new Map(currentQuestion.items.map((item) => [item.id, item.text]));

      return (
        <View
          aria-live="polite"
          role="status"
          style={[styles.revealCard, isStage && stageStyles.revealCard]}
        >
          <Text style={[styles.revealLabel, isStage && stageStyles.revealLabel]}>
            Correct order
          </Text>
          {questionReveal.correctOrder.map((itemId, index) => (
            <Text
              key={itemId}
              style={[styles.revealListItem, isStage && stageStyles.revealListItem]}
            >
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
          <Text
            aria-level={1}
            role="heading"
            style={[styles.gameTitle, isStage && stageStyles.gameTitle]}
          >
            {room.quizTitle}
          </Text>
          <Text
            aria-label={`Room ${spellOut(room.roomCode)}, ${room.players.length} player${
              room.players.length !== 1 ? "s" : ""
            }${room.status === "question" ? `, ${answeredCount} answered` : ""}`}
            style={[styles.gameSubtitle, isStage && stageStyles.gameSubtitle]}
          >
            Room {room.roomCode} {"\u2022"} {room.players.length} player
            {room.players.length !== 1 ? "s" : ""}
            {room.status === "question" ? ` \u2022 ${answeredCount} answered` : ""}
          </Text>
        </View>
        <StatusChip state={connectionState} />
      </View>

      {isHost && (
        <View style={[styles.hostControlsCard, isStage && stageStyles.hostControlsCard]}>
          {room.status === "lobby" && (
            <>
              <Text style={[styles.controlsHint, isStage && stageStyles.controlsHint]}>
                Scan to join instantly
              </Text>
              {/* Side by side on the stage layout, so the whole lobby — QR code, link and room
                  code — fits on the projector without the host scrolling. Stacked otherwise. */}
              <View
                style={[styles.lobbyPanels, isStage && joinUrl !== null && stageStyles.lobbyPanels]}
              >
                {joinUrl && (
                  <View style={[styles.lobbyPanel, isStage && stageStyles.lobbyPanel]}>
                    <View style={styles.qrPanel}>
                      <View
                        accessible
                        aria-label={`QR code to join room ${spellOut(room.roomCode)}`}
                        role="img"
                        style={styles.qrFrame}
                      >
                        <QRCodeSVG value={joinUrl} size={isStage ? QR_SIZE_STAGE : QR_SIZE} />
                      </View>
                      <Text style={[styles.qrCaption, isStage && stageStyles.qrCaption]}>
                        Players can scan this with their phone and land straight on the join screen.
                      </Text>
                    </View>
                  </View>
                )}
                <View style={[styles.lobbyPanel, isStage && stageStyles.lobbyPanel]}>
                  {joinUrl ? (
                    <>
                      <Text style={[styles.controlsMeta, isStage && stageStyles.controlsMeta]}>
                        Or open this join link directly
                      </Text>
                      <Text
                        selectable
                        style={[styles.joinUrlText, isStage && stageStyles.joinUrlText]}
                      >
                        {joinUrl}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.controlsMeta, isStage && stageStyles.controlsMeta]}>
                      Share the room code below with your players.
                    </Text>
                  )}
                  <Text style={[styles.controlsMeta, isStage && stageStyles.controlsMeta]}>
                    Manual fallback
                  </Text>
                  <Text
                    aria-label={`Room code ${spellOut(room.roomCode)}`}
                    style={[styles.bigRoomCode, isStage && stageStyles.bigRoomCode]}
                  >
                    {room.roomCode}
                  </Text>
                </View>
              </View>
              <Text
                aria-live="polite"
                role="status"
                style={[styles.controlsMeta, isStage && stageStyles.controlsMeta]}
              >
                {room.players.length === 0
                  ? "Waiting for players to join..."
                  : `${room.players.length} player${room.players.length !== 1 ? "s" : ""} joined. Start when ready!`}
              </Text>
              {onOpenPlayerTab && IS_DEV_ENVIRONMENT && (
                <Pressable
                  aria-label="Open a player tab"
                  onPress={onOpenPlayerTab}
                  role="button"
                  style={styles.devButton}
                >
                  <Text style={styles.devButtonText}>⚡ Open player tab</Text>
                </Pressable>
              )}
              <Pressable
                aria-disabled={pendingAction !== null || room.players.length === 0}
                aria-label="Start quiz"
                disabled={pendingAction !== null || room.players.length === 0}
                onPress={onStartGame}
                role="button"
                style={[
                  styles.bigButton,
                  (pendingAction !== null || room.players.length === 0) && styles.disabledButton,
                ]}
              >
                <Text style={[styles.bigButtonText, isStage && stageStyles.bigButtonText]}>
                  {pendingAction === "start-game" ? "starting..." : "Start quiz"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "question" && (
            <>
              <Text style={[styles.controlsHint, isStage && stageStyles.controlsHint]}>
                Question is live
              </Text>
              <Text style={[styles.controlsMeta, isStage && stageStyles.controlsMeta]}>
                {answeredCount} of {room.players.length} answered
              </Text>
              <Pressable
                aria-disabled={pendingAction !== null}
                aria-label="Close the question and show scores"
                disabled={pendingAction !== null}
                onPress={onRevealLeaderboard}
                role="button"
                style={[styles.secondaryBigButton, pendingAction !== null && styles.disabledButton]}
              >
                <Text
                  style={[
                    styles.secondaryBigButtonText,
                    isStage && stageStyles.secondaryBigButtonText,
                  ]}
                >
                  {pendingAction === "show-leaderboard" ? "revealing..." : "Show scores"}
                </Text>
              </Pressable>
            </>
          )}
          {room.status === "leaderboard" && (
            <>
              <Text style={[styles.controlsHint, isStage && stageStyles.controlsHint]}>
                Scores revealed
              </Text>
              <Pressable
                aria-disabled={pendingAction !== null}
                aria-label={
                  room.currentQuestionIndex === room.totalQuestions - 1
                    ? "Finish quiz"
                    : "Go to the next question"
                }
                disabled={pendingAction !== null}
                onPress={onNextQuestion}
                role="button"
                style={[styles.bigButton, pendingAction !== null && styles.disabledButton]}
              >
                <Text style={[styles.bigButtonText, isStage && stageStyles.bigButtonText]}>
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
              <Text style={[styles.controlsHint, isStage && stageStyles.controlsHint]}>
                Quiz complete!
              </Text>
              <Pressable
                aria-label="Back to start"
                onPress={onBackToStart}
                role="button"
                style={styles.secondaryBigButton}
              >
                <Text
                  style={[
                    styles.secondaryBigButtonText,
                    isStage && stageStyles.secondaryBigButtonText,
                  ]}
                >
                  Back to start
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {!isHost && room.status === "lobby" && (
        <View aria-live="polite" role="status" style={styles.waitingCard}>
          <Text style={styles.waitingText}>You're in! Waiting for {room.hostName} to start...</Text>
        </View>
      )}
      {!isHost && room.status === "finished" && (
        <View aria-live="polite" role="status" style={styles.waitingCard}>
          <Text style={styles.waitingText}>Thanks for playing!</Text>
          <Pressable
            aria-label="Back to start"
            onPress={onBackToStart}
            role="button"
            style={styles.secondaryBigButton}
          >
            <Text style={styles.secondaryBigButtonText}>Back to start</Text>
          </Pressable>
        </View>
      )}

      {currentQuestion && (
        <View style={[styles.questionCard, isStage && stageStyles.questionCard]}>
          <View style={styles.questionBadge}>
            <Text
              aria-label={`Question ${currentQuestion.index + 1} of ${currentQuestion.total}`}
              style={[styles.questionBadgeText, isStage && stageStyles.questionBadgeText]}
            >
              {currentQuestion.index + 1} / {currentQuestion.total}
            </Text>
          </View>

          {room.status === "question" && secondsLeft !== null && (
            // Deliberately not a live region: this changes every second, and announcing each
            // tick would talk over the question itself. A screen-reader user can read the
            // remaining time on demand instead.
            <View
              accessible
              aria-label={`${secondsLeft} seconds remaining`}
              role="timer"
              style={styles.timerRow}
            >
              <View
                aria-hidden
                style={[styles.timerBar, isStage && stageStyles.timerBar, { flex: 1 }]}
              >
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
              <Text
                style={[
                  styles.timerLabel,
                  isStage && stageStyles.timerLabel,
                  { color: timerColor },
                ]}
              >
                {secondsLeft}s
              </Text>
            </View>
          )}

          {/* Live, so a new question reaches a player who is not touching the screen. The
              prompt text only changes once per question, so this stays quiet in between. */}
          <Text
            aria-level={2}
            aria-live="polite"
            role="heading"
            style={[styles.questionPrompt, isStage && stageStyles.questionPrompt]}
          >
            {currentQuestion.prompt}
          </Text>

          {currentQuestion.type === "multiple-choice" && renderOptionGrid("multiple-choice")}
          {currentQuestion.type === "poll" && renderOptionGrid("poll")}
          {currentQuestion.type === "number" && numberGuess !== null && (
            <SliderQuestion
              minValue={currentQuestion.minValue}
              maxValue={currentQuestion.maxValue}
              value={numberGuess}
              disabled={hasAnsweredCurrentQuestion || room.status !== "question"}
              isStage={isStage}
              onChange={(value) => onNumberGuessChange(value)}
            />
          )}
          {currentQuestion.type === "ranking" && (
            <RankingQuestion
              items={currentQuestion.items}
              selectedOrder={rankingOrder}
              disabled={hasAnsweredCurrentQuestion || room.status !== "question"}
              isStage={isStage}
              onOrderChange={onRankingOrderChange}
            />
          )}

          {renderReveal()}

          {!isHost && hasAnsweredCurrentQuestion && lastAnswerResult && (
            <View
              aria-live="polite"
              role="status"
              style={[
                styles.answerResultCard,
                lastAnswerResult.pending
                  ? styles.answerResultPending
                  : lastAnswerResult.isCorrect
                    ? styles.answerResultCorrect
                    : styles.answerResultWrong,
              ]}
            >
              <Text aria-hidden style={styles.answerResultEmoji}>
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
                <Text style={styles.answerResultPoints}>Points revealed when time's up.</Text>
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
              aria-disabled={!canSubmitAnswer}
              // Kept short: a disabled button drops out of the tab order, so any "pick an
              // answer first" hint here would never actually be read out.
              aria-label={hasAnsweredCurrentQuestion ? "Answer locked in" : "Lock in answer"}
              disabled={!canSubmitAnswer}
              onPress={onSubmitAnswer}
              role="button"
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

      <View style={[styles.card, isStage && stageStyles.card]}>
        <Text
          aria-level={2}
          role="heading"
          style={[styles.sectionTitle, isStage && stageStyles.sectionTitle]}
        >
          {room.status === "finished" ? "Final Results" : "Leaderboard"}
        </Text>

        {winner && room.status === "finished" && (
          <View
            accessible
            aria-label={`Winner: ${winner.name}, ${winner.score} points`}
            style={[styles.winnerCard, isStage && stageStyles.winnerCard]}
          >
            <Text aria-hidden style={[styles.winnerEmoji, isStage && stageStyles.winnerEmoji]}>
              {"\uD83C\uDFC6"}
            </Text>
            <Text style={[styles.winnerName, isStage && stageStyles.winnerName]}>
              {winner.name}
            </Text>
            <Text style={[styles.winnerScore, isStage && stageStyles.winnerScore]}>
              {winner.score} points
            </Text>
          </View>
        )}

        {room.leaderboard.length === 0 ? (
          <Text style={[styles.emptyText, isStage && stageStyles.emptyText]}>
            Players will appear here once they join.
          </Text>
        ) : (
          room.leaderboard.map((entry, index) => (
            <LeaderboardRow
              key={entry.playerId}
              entry={entry}
              index={index}
              isStage={isStage}
              roomStatus={room.status}
            />
          ))
        )}
      </View>

      {room.status === "finished" && gameSummary && (
        <GameSummaryCard
          summary={gameSummary}
          isHost={isHost}
          isStage={isStage}
          sessionPlayerId={sessionPlayerId}
        />
      )}
    </>
  );
}
