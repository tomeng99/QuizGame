import { Pressable, Text, TextInput, View } from "react-native";
import type { QuizQuestion } from "@quizgame/contracts";
import { styles } from "../styles";
import { colors } from "../theme";
import { OPTION_THEMES } from "../constants";

interface QuestionEditorCardProps {
  canRemove: boolean;
  onCorrectOptionChange: (optionId: string) => void;
  onOptionChange: (optionIndex: number, text: string) => void;
  onPromptChange: (prompt: string) => void;
  onRemove: () => void;
  question: QuizQuestion;
  questionIndex: number;
}

export function QuestionEditorCard({
  canRemove,
  onCorrectOptionChange,
  onOptionChange,
  onPromptChange,
  onRemove,
  question,
  questionIndex,
}: QuestionEditorCardProps) {
  return (
    <View style={styles.editorQuestionCard}>
      <View style={styles.editorQuestionHeader}>
        <View style={styles.editorQuestionHeading}>
          <View style={styles.editorQuestionBadge}>
            <Text style={styles.editorQuestionBadgeText}>
              Q{questionIndex + 1}
            </Text>
          </View>
          <View style={styles.editorQuestionHeaderText}>
            <Text style={styles.editorQuestionTitle}>
              Question {questionIndex + 1}
            </Text>
            <Text style={styles.editorQuestionDescription}>
              Keep it short, clear, and easy to answer on a phone.
            </Text>
          </View>
        </View>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.inputLabel}>Question prompt</Text>
      <TextInput
        multiline
        onChangeText={onPromptChange}
        placeholder="What should your players answer?"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.multilineInput]}
        value={question.prompt}
      />

      <View style={styles.editorOptionsHeader}>
        <Text style={styles.inputLabel}>Answers</Text>
        <Text style={styles.editorOptionHint}>
          Tap "Correct" on the right answer
        </Text>
      </View>

      {question.options.map((option, optionIndex) => {
        const theme = OPTION_THEMES[optionIndex % OPTION_THEMES.length];
        const isCorrect = question.correctOptionId === option.id;

        return (
          <View
            key={option.id}
            style={[
              styles.editorOptionCard,
              {
                borderColor: isCorrect ? colors.successBright : `${theme.bg}55`,
                backgroundColor: isCorrect ? `${colors.successBright}12` : colors.bgInput,
              },
            ]}
          >
            <View
              style={[
                styles.editorOptionBadge,
                {
                  backgroundColor: `${theme.bg}22`,
                  borderColor: `${theme.bg}66`,
                },
              ]}
            >
              <Text style={[styles.editorOptionBadgeText, { color: theme.bg }]}>
                {theme.label}
              </Text>
            </View>
            <View style={styles.editorOptionContent}>
              <TextInput
                onChangeText={(value) => onOptionChange(optionIndex, value)}
                placeholder={
                  optionIndex === 0
                    ? "Correct answer"
                    : `Alternative option ${optionIndex + 1}`
                }
                placeholderTextColor={colors.textMuted}
                style={styles.editorOptionInputText}
                value={option.text}
              />
              <Pressable
                onPress={() => onCorrectOptionChange(option.id)}
                style={[
                  styles.correctToggle,
                  isCorrect && styles.correctToggleActive,
                ]}
              >
                <Text
                  style={[
                    styles.correctToggleText,
                    isCorrect && styles.correctToggleTextActive,
                  ]}
                >
                  {isCorrect ? "Correct" : "Mark correct"}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
