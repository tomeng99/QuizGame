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
        </View>
      </View>
      <Text
        style={[
          styles.leaderboardScore,
          index === 0 && styles.leaderboardScoreFirst,
        ]}
      >
        {entry.score}
      </Text>
    </View>
  );
}
