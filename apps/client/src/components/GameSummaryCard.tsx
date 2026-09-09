import type { GameSummary } from "@quizgame/contracts";
import { Text, View } from "react-native";
import { stageStyles, styles } from "../styles";

interface GameSummaryCardProps {
  summary: GameSummary;
  isHost: boolean;
  /** True when this is a host's presentation screen — see `useStageLayout`. */
  isStage: boolean;
  /** This client's public player id, used to find its own row in the recap. */
  sessionPlayerId: string | null;
}

const ORDINAL_SUFFIXES = ["th", "st", "nd", "rd"];

/** 1 → "1st", 2 → "2nd", 13 → "13th". */
const toOrdinal = (value: number): string => {
  const lastTwo = value % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : (ORDINAL_SUFFIXES[value % 10] ?? "th");
  return `${value}${suffix}`;
};

/**
 * The post-game recap, shown once the quiz finishes.
 *
 * Players get their own game back (where they placed, how many they got right, their best
 * streak); everyone gets the round-by-round breakdown, which is the "that one was brutal"
 * moment a quiz is actually played for. All of it comes from the server — the client
 * discards each round's result as the next question starts.
 */
export function GameSummaryCard({
  summary,
  isHost,
  isStage,
  sessionPlayerId,
}: GameSummaryCardProps) {
  const selfIndex = summary.players.findIndex((player) => player.playerId === sessionPlayerId);
  const self = selfIndex === -1 ? null : summary.players[selfIndex];

  // Polls have no right answer, so they carry no accuracy bar and are excluded from the
  // "hardest question" hunt rather than counted as a room-wide wipeout.
  const scorableRounds = summary.questions.filter(
    (round) => round.correctCount !== null && round.playerCount > 0,
  );
  const hardestRound =
    scorableRounds.length >= 2
      ? scorableRounds.reduce((hardest, round) =>
          (round.correctCount ?? 0) / round.playerCount <
          (hardest.correctCount ?? 0) / hardest.playerCount
            ? round
            : hardest,
        )
      : null;

  return (
    <View style={[styles.card, isStage && stageStyles.card]}>
      <Text style={[styles.sectionTitle, isStage && stageStyles.sectionTitle]}>Game recap</Text>

      {!isHost && self && (
        <View style={styles.summarySelfCard}>
          <Text style={styles.summarySelfPlace}>
            {toOrdinal(selfIndex + 1)} of {summary.players.length}
          </Text>
          {summary.scorableQuestions > 0 && (
            <Text style={styles.summarySelfScore}>
              {self.correctAnswers} of {summary.scorableQuestions} correct
            </Text>
          )}
          <View style={styles.summaryStatRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{self.score}</Text>
              <Text style={styles.summaryStatLabel}>points</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{self.bestStreak}</Text>
              <Text style={styles.summaryStatLabel}>best streak</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{self.missedQuestions}</Text>
              <Text style={styles.summaryStatLabel}>unanswered</Text>
            </View>
          </View>
        </View>
      )}

      {summary.questions.length === 0 ? (
        <Text style={[styles.emptyText, isStage && stageStyles.emptyText]}>
          This quiz ended before any question was played.
        </Text>
      ) : (
        <>
          {hardestRound && (
            <Text style={[styles.summaryHardest, isStage && stageStyles.summaryHardest]}>
              Hardest question: {"“"}
              {hardestRound.prompt}
              {"”"} {"—"} {hardestRound.correctCount} of {hardestRound.playerCount} got it.
            </Text>
          )}

          {summary.questions.map((round) => {
            const accuracy =
              round.correctCount === null || round.playerCount === 0
                ? null
                : round.correctCount / round.playerCount;

            return (
              <View key={round.questionId} style={styles.summaryRound}>
                <View style={styles.summaryRoundHeader}>
                  <Text
                    style={[styles.summaryRoundIndex, isStage && stageStyles.summaryRoundIndex]}
                  >
                    Q{round.index + 1}
                  </Text>
                  <Text
                    style={[styles.summaryRoundPrompt, isStage && stageStyles.summaryRoundPrompt]}
                    numberOfLines={2}
                  >
                    {round.prompt}
                  </Text>
                  <Text
                    style={[styles.summaryRoundCount, isStage && stageStyles.summaryRoundCount]}
                  >
                    {accuracy === null
                      ? `${round.answeredCount} voted`
                      : `${round.correctCount}/${round.playerCount}`}
                  </Text>
                </View>
                {accuracy !== null && (
                  <View
                    style={[styles.summaryRoundTrack, isStage && stageStyles.summaryRoundTrack]}
                  >
                    <View
                      style={[
                        styles.summaryRoundFill,
                        { width: `${accuracy * 100}%` as `${number}%` },
                      ]}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}
