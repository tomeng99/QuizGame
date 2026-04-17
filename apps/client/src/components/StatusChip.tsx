import { Text, View } from "react-native";
import { styles } from "../styles";
import type { ConnectionState } from "../types";

export function StatusChip({ state }: { state: ConnectionState }) {
  return (
    <View
      style={[
        styles.statusChip,
        state === "connected" && styles.statusChipConnected,
        state === "disconnected" && styles.statusChipDisconnected,
      ]}
    >
      <Text style={styles.statusChipText}>
        {state === "connected"
          ? "Online"
          : state === "connecting"
            ? "Connecting"
            : "Offline"}
      </Text>
    </View>
  );
}
