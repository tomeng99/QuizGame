import { Text, View } from "react-native";
import { styles } from "../styles";
import type { FeedbackState } from "../types";

export function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  return (
    // Errors here are the app's only way of saying "that room code doesn't exist" — colour
    // alone carries the tone, so it has to be announced rather than only shown.
    <View
      aria-live="polite"
      role="status"
      style={[
        styles.feedbackBanner,
        feedback.tone === "success" && styles.feedbackSuccess,
        feedback.tone === "error" && styles.feedbackError,
      ]}
    >
      <Text style={styles.feedbackText}>{feedback.message}</Text>
    </View>
  );
}
