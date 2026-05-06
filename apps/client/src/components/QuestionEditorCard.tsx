import { Pressable, Text, TextInput, View } from "react-native";
import type { QuestionType, QuizQuestion } from "@quizgame/contracts";
import { styles } from "../styles";
import { colors } from "../theme";
import { OPTION_THEMES } from "../constants";

const QUESTION_TYPE_OPTIONS: Array<{ label: string; value: QuestionType }> = [
  { label: "Multiple Choice", value: "multiple-choice" },
  { label: "Poll", value: "poll" },
  { label: "Number", value: "number" },
  { label: "Ranking", value: "ranking" },
];

const parseNumberInput = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface QuestionEditorCardProps {
  canRemove: boolean;
  question: QuizQuestion;
  questionIndex: number;
  onTypeChange: (type: QuestionType) => void;
  onCorrectOptionChange: (optionId: string) => void;
  onOptionChange: (optionIndex: number, text: string) => void;
  onPollOptionChange: (optionIndex: number, text: string) => void;
  onCorrectNumberChange: (value: number) => void;
  onMinValueChange: (value: number) => void;
  onMaxValueChange: (value: number) => void;
  onRankingItemChange: (itemIndex: number, text: string) => void;
  onAddRankingItem: () => void;
  onRemoveRankingItem: (itemIndex: number) => void;
  onPromptChange: (prompt: string) => void;
  onRemove: () => void;
}

export function QuestionEditorCard({
  canRemove,
  question,
  questionIndex,
  onTypeChange,
  onCorrectOptionChange,
  onOptionChange,
  onPollOptionChange,
  onCorrectNumberChange,
  onMinValueChange,
  onMaxValueChange,
  onRankingItemChange,
  onAddRankingItem,
  onRemoveRankingItem,
  onPromptChange,
  onRemove,
}: QuestionEditorCardProps) {
  const renderOptionEditor = (
    optionQuestion: Extract<QuizQuestion, { type: "multiple-choice" | "poll" }>,
    showCorrectToggle: boolean,
  ) => {
    const hint = showCorrectToggle
      ? 'Tap "Correct" on the right answer'
      : "Players who pick the most popular answer score points";

    return (
      <>
        <View style={styles.editorOptionsHeader}>
          <Text style={styles.inputLabel}>Answers</Text>
          <Text style={styles.editorOptionHint}>{hint}</Text>
        </View>

        {optionQuestion.options.map((option, optionIndex) => {
          const theme = OPTION_THEMES[optionIndex % OPTION_THEMES.length];
          const isCorrect =
            optionQuestion.type === "multiple-choice" &&
            optionQuestion.correctOptionId === option.id;

          return (
            <View
              key={option.id}
              style={[
                styles.editorOptionCard,
                {
                  borderColor:
                    isCorrect ? colors.successBright : `${theme.bg}55`,
                  backgroundColor:
                    isCorrect ? `${colors.successBright}12` : colors.bgInput,
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
                  onChangeText={(value) =>
                    showCorrectToggle
                      ? onOptionChange(optionIndex, value)
                      : onPollOptionChange(optionIndex, value)
                  }
                  placeholder={
                    optionIndex === 0
                      ? "Option 1"
                      : `Option ${optionIndex + 1}`
                  }
                  placeholderTextColor={colors.textMuted}
                  style={styles.editorOptionInputText}
                  value={option.text}
                />
                {showCorrectToggle ? (
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
                ) : null}
              </View>
            </View>
          );
        })}
      </>
    );
  };

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

      <View style={styles.questionTypeSelector}>
        {QUESTION_TYPE_OPTIONS.map((option) => {
          const isActive = option.value === question.type;

          return (
            <Pressable
              key={option.value}
              onPress={() => onTypeChange(option.value)}
              style={[
                styles.questionTypePill,
                isActive && styles.questionTypePillActive,
              ]}
            >
              <Text
                style={[
                  styles.questionTypePillText,
                  isActive && styles.questionTypePillTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
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

      {question.type === "multiple-choice" && renderOptionEditor(question, true)}
      {question.type === "poll" && renderOptionEditor(question, false)}

      {question.type === "number" && (
        <View style={styles.editorNumberGrid}>
          <View style={styles.editorNumberField}>
            <Text style={styles.inputLabel}>Correct number</Text>
            <TextInput
              keyboardType="numeric"
              onChangeText={(value) => onCorrectNumberChange(parseNumberInput(value))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={String(question.correctNumber)}
            />
          </View>
          <View style={styles.editorNumberField}>
            <Text style={styles.inputLabel}>Min value</Text>
            <TextInput
              keyboardType="numeric"
              onChangeText={(value) => onMinValueChange(parseNumberInput(value))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={String(question.minValue)}
            />
          </View>
          <View style={styles.editorNumberField}>
            <Text style={styles.inputLabel}>Max value</Text>
            <TextInput
              keyboardType="numeric"
              onChangeText={(value) => onMaxValueChange(parseNumberInput(value))}
              placeholder="100"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={String(question.maxValue)}
            />
          </View>
        </View>
      )}

      {question.type === "ranking" && (
        <>
          <View style={styles.editorOptionsHeader}>
            <Text style={styles.inputLabel}>Ranking items</Text>
            <Text style={styles.editorOptionHint}>
              Players will see these in scrambled order
            </Text>
          </View>
          {question.items.map((item, itemIndex) => (
            <View key={item.id} style={styles.rankingEditorItemCard}>
              <View style={styles.rankingEditorItemHeader}>
                <Text style={styles.rankingEditorItemNumber}>#{itemIndex + 1}</Text>
                {question.items.length > 3 ? (
                  <Pressable
                    onPress={() => onRemoveRankingItem(itemIndex)}
                    style={styles.rankingEditorRemoveButton}
                  >
                    <Text style={styles.rankingEditorRemoveButtonText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                onChangeText={(value) => onRankingItemChange(itemIndex, value)}
                placeholder={`Item ${itemIndex + 1}`}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={item.text}
              />
            </View>
          ))}
          <Pressable
            disabled={question.items.length >= 5}
            onPress={onAddRankingItem}
            style={[
              styles.addQuestionInlineButton,
              question.items.length >= 5 && styles.disabledButton,
            ]}
          >
            <Text style={styles.addQuestionInlineText}>+ Add item</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
