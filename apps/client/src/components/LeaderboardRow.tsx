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
          {roomStatus === "question" ? (
            <Text style={styles.playerMeta}>
              {entry.answeredCurrentQuestion
                ? "Answered"
                : "Thinking..."}
            </Text>
          ) : null}
          {entry.streak >= 2 ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>
                {"\uD83D\uDD25"} {entry.streak}x streak
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={[
            styles.leaderboardScore,
            index === 0 && styles.leaderboardScoreFirst,
          ]}
        >
          {entry.score}
        </Text>
        {showDelta ? (
          <Text style={styles.scoreDelta}>+{entry.pointsEarnedThisRound}</Text>
        ) : null}
      </View>
    </View>
  );
}
