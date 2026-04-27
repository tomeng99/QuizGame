import { Text, View } from "react-native";
import type { LeaderboardEntry, RoomSnapshot } from "@quizgame/contracts";
import { styles } from "../styles";
import { MEDALS } from "../constants";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  roomStatus: RoomSnapshot["status"];
}

export function LeaderboardRow({ entry, index, roomStatus }: LeaderboardRowProps) {
  const medal = MEDALS[index] ?? null;

  // Show the "+N pts" delta only after the question has closed (leaderboard or finished),
  // and only when the player actually scored something this round (0-point rounds are noise).
  const showDelta = (roomStatus === "leaderboard" || roomStatus === "finished") && entry.pointsEarnedThisRound > 0;

  return (
    <View
      style={[
        styles.leaderboardRow,
        index === 0 && styles.leaderboardRowFirst,
      ]}
    >
      <View style={styles.leaderboardLeft}>
        <Text style={styles.leaderboardRank}>
          {medal ?? `${index + 1}.`}
        </Text>
        <View>
          <Text
            style={[
              styles.leaderboardName,
              index === 0 && styles.leaderboardNameFirst,
            ]}
          >
            {entry.name}
          </Text>
          {/* Show live "Answered / Thinking..." status while the question is active. */}
          {roomStatus === "question" ? (
            <Text style={styles.playerMeta}>
              {entry.answeredCurrentQuestion
                ? "Answered"
                : "Thinking..."}
            </Text>
          ) : null}
          {/* Only render the streak badge when the player has 2+ consecutive correct answers.
              A streak of 1 doesn't feel like a streak worth highlighting. */}
          {entry.streak >= 2 ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>
                {"\uD83D\uDD25"} {entry.streak}x streak
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.scoreColumn}>
        <Text
          style={[
            styles.leaderboardScore,
            index === 0 && styles.leaderboardScoreFirst,
          ]}
        >
          {entry.score}
        </Text>
        {/* Score delta — lets lower-ranked players see they can still catch up. */}
        {showDelta ? (
          <Text style={styles.scoreDelta}>+{entry.pointsEarnedThisRound}</Text>
        ) : null}
      </View>
    </View>
  );
}
