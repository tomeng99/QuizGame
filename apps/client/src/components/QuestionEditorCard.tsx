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
        <View style={styles.editorQuestionBadge}>
          <Text style={styles.editorQuestionBadgeText}>
            Q{questionIndex + 1}
          </Text>
        </View>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        multiline
        onChangeText={onPromptChange}
        placeholder="Write your question..."
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.multilineInput]}
        value={question.prompt}
      />
      {question.options.map((option, optionIndex) => {
        const theme = OPTION_THEMES[optionIndex % OPTION_THEMES.length];
        const isCorrect = question.correctOptionId === option.id;

        return (
          <View key={option.id} style={styles.editorOptionRow}>
            <Pressable
              onPress={() => onCorrectOptionChange(option.id)}
              style={[
                styles.correctPicker,
                {
                  backgroundColor: isCorrect
                    ? colors.successBright
                    : `${theme.bg}30`,
                  borderColor: isCorrect
                    ? colors.successBright
                    : `${theme.bg}60`,
                },
              ]}
            >
              <Text style={styles.correctPickerText}>
                {isCorrect ? "\u2713" : theme.icon}
              </Text>
            </Pressable>
            <TextInput
              onChangeText={(value) => onOptionChange(optionIndex, value)}
              placeholder={`Option ${optionIndex + 1}`}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.editorOptionInput]}
              value={option.text}
            />
          </View>
        );
      })}
      <Text style={styles.editorOptionHint}>
        Tap a circle to mark the correct answer
      </Text>
    </View>
  );
}
