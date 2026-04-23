import { Pressable, Text, TextInput, View } from "react-native";
import type { CheckRoomResult } from "@quizgame/contracts";
import { styles } from "../styles";
import { colors } from "../theme";
import type { PendingAction } from "../types";

interface JoinNameScreenProps {
  checkedRoom: CheckRoomResult;
  playerName: string;
  onPlayerNameChange: (text: string) => void;
  canJoinRoom: boolean;
  pendingAction: PendingAction;
  onJoinRoom: () => void;
  onBack: () => void;
}

export function JoinNameScreen({
  checkedRoom,
  playerName,
  onPlayerNameChange,
  canJoinRoom,
  pendingAction,
  onJoinRoom,
  onBack,
}: JoinNameScreenProps) {
  return (
    <>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>You're joining</Text>
        <View style={styles.roomInfoBadge}>
          <Text style={styles.roomInfoTitle}>
            {checkedRoom.quizTitle}
          </Text>
          <Text style={styles.roomInfoDetail}>
            Hosted by {checkedRoom.hostName}
            {" \u2022 "}
            {checkedRoom.playerCount} player
            {checkedRoom.playerCount !== 1 ? "s" : ""} waiting
          </Text>
        </View>
        <Text style={styles.inputLabel}>Pick your display name</Text>
        <TextInput
          autoCorrect={false}
          maxLength={20}
          onChangeText={onPlayerNameChange}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          style={styles.nameInput}
          value={playerName}
        />
        <Pressable
          disabled={!canJoinRoom}
          onPress={onJoinRoom}
          style={[
            styles.bigButton,
            !canJoinRoom && styles.disabledButton,
          ]}
        >
          <Text style={styles.bigButtonText}>
            {pendingAction === "join-room"
              ? "joining..."
              : "Let's go"}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>{"\u2190"} Back</Text>
      </Pressable>
    </>
  );
}
