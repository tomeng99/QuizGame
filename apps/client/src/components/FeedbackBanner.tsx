import { Text, View } from "react-native";
import { styles } from "../styles";
import type { FeedbackState } from "../types";

export function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
  return (
    <View
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
