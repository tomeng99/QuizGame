import { Pressable, Text, TextInput, View } from "react-native";
import { styles } from "../styles";
import { colors } from "../theme";
import type { PendingAction } from "../types";

interface JoinCodeScreenProps {
  roomCodeInput: string;
  onRoomCodeChange: (text: string) => void;
  canCheckRoom: boolean;
  pendingAction: PendingAction;
  onCheckRoom: () => void;
  onHostPress: () => void;
}

export function JoinCodeScreen({
  roomCodeInput,
  onRoomCodeChange,
  canCheckRoom,
  pendingAction,
  onCheckRoom,
  onHostPress,
}: JoinCodeScreenProps) {
  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Enter Game Code</Text>
        <Text style={styles.heroSubtitle}>
          Ask your host for the 6-character room code
        </Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          onChangeText={onRoomCodeChange}
          placeholder="ABC123"
          placeholderTextColor={colors.textMuted}
          style={styles.codeInput}
          value={roomCodeInput}
        />
        <Pressable
          disabled={!canCheckRoom}
          onPress={onCheckRoom}
          style={[
            styles.bigButton,
            !canCheckRoom && styles.disabledButton,
          ]}
        >
          <Text style={styles.bigButtonText}>
            {pendingAction === "check-room"
              ? "looking..."
              : "Join game"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={onHostPress} style={styles.hostLink}>
        <Text style={styles.hostLinkText}>
          Want to host a quiz instead?
        </Text>
      </Pressable>
    </>
  );
}
