import { Text, View } from "react-native";
import { styles } from "../styles";
import type { ConnectionState } from "../types";

export function StatusChip({ state }: { state: ConnectionState }) {
  const label =
    state === "connected" ? "Online" : state === "connecting" ? "Connecting" : "Offline";

  return (
    // A live region: dropping the connection mid-question is the one thing a player must hear
    // about without going looking for it. "Online" on its own is meaningless out of context,
    // so the label says what is online.
    <View
      aria-label={`Connection status: ${label}`}
      aria-live="polite"
      role="status"
      style={[
        styles.statusChip,
        state === "connected" && styles.statusChipConnected,
        state === "disconnected" && styles.statusChipDisconnected,
      ]}
    >
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}
