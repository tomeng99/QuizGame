import { Pressable, Text, TextInput, View } from "react-native";
import type { QuizDraft } from "@quizgame/contracts";
import { styles } from "../styles";
import { colors } from "../theme";
import { QuestionEditorCard } from "../components";
import type { PendingAction } from "../types";

const TIME_LIMIT_OPTIONS = [15, 20, 30, 45, 60] as const;

interface HostSetupScreenProps {
  hostName: string;
  onHostNameChange: (text: string) => void;
  quiz: QuizDraft;
  selectedQuestionIndex: number;
  onSelectQuestion: (questionIndex: number) => void;
  onQuizTitleChange: (title: string) => void;
  onTimeLimitChange: (timeLimit: number) => void;
  onPromptChange: (questionIndex: number, prompt: string) => void;
  onOptionChange: (questionIndex: number, optionIndex: number, text: string) => void;
  onCorrectOptionChange: (questionIndex: number, optionId: string) => void;
  onRemoveQuestion: (questionId: string) => void;
  onAddQuestion: () => void;
  quizIssues: string[];
  canCreateRoom: boolean;
  pendingAction: PendingAction;
  onCreateRoom: () => void;
  onBack: () => void;
}

export function HostSetupScreen({
  hostName,
  onHostNameChange,
  quiz,
  selectedQuestionIndex,
  onSelectQuestion,
  onQuizTitleChange,
  onTimeLimitChange,
  onPromptChange,
  onOptionChange,
  onCorrectOptionChange,
  onRemoveQuestion,
  onAddQuestion,
  quizIssues,
  canCreateRoom,
  pendingAction,
  onCreateRoom,
  onBack,
}: HostSetupScreenProps) {
  const activeQuestionIndex = Math.min(
    selectedQuestionIndex,
    quiz.questions.length - 1,
  );
  const activeQuestion = quiz.questions[activeQuestionIndex];
  const readyQuestionCount = quiz.questions.filter((question) => {
    const filledOptions = question.options.filter((option) => option.text.trim());

    return question.prompt.trim().length > 0 && filledOptions.length >= 2;
  }).length;

  return (
    <>
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>Create Your Quiz</Text>
        <Text style={styles.editorSubtitle}>
          Start with a blank canvas and build one question at a time.
        </Text>
      </View>

      <View style={[styles.card, styles.editorBasicsCard]}>
        <View style={styles.editorSectionHeader}>
          <Text style={styles.sectionTitle}>Quiz details</Text>
          <Text style={styles.editorSectionText}>
            Add the basics first, then move through your questions without the
            usual clutter.
          </Text>
        </View>
        <Text style={styles.inputLabel}>Host name</Text>
        <TextInput
          onChangeText={onHostNameChange}
          placeholder="Alex"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={hostName}
        />
        <Text style={styles.inputLabel}>Quiz title</Text>
        <TextInput
          onChangeText={onQuizTitleChange}
          placeholder="Friday Quiz Night"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={quiz.title}
        />
        <Text style={styles.inputLabel}>Time per question</Text>
        <View style={styles.timeLimitRow}>
          {TIME_LIMIT_OPTIONS.map((seconds) => (
            <Pressable
              key={seconds}
              onPress={() => onTimeLimitChange(seconds)}
              style={[
                styles.timeLimitOption,
                quiz.timeLimit === seconds && styles.timeLimitOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.timeLimitOptionText,
                  quiz.timeLimit === seconds && styles.timeLimitOptionTextActive,
                ]}
              >
                {seconds}s
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, styles.editorOverviewCard]}>
        <View style={styles.editorOverviewHeader}>
          <View style={styles.editorSectionHeader}>
            <Text style={styles.sectionTitle}>Questions</Text>
            <Text style={styles.editorSectionText}>
              Jump between questions, keep only one in focus, and mark the
              correct answer with a single tap.
            </Text>
          </View>
          <Pressable onPress={onAddQuestion} style={styles.addQuestionInlineButton}>
            <Text style={styles.addQuestionInlineText}>+ New question</Text>
          </Pressable>
        </View>

        <View style={styles.editorStatsRow}>
          <View style={styles.editorStatPill}>
            <Text style={styles.editorStatValue}>{quiz.questions.length}</Text>
            <Text style={styles.editorStatLabel}>total</Text>
          </View>
          <View style={styles.editorStatPill}>
            <Text style={styles.editorStatValue}>{readyQuestionCount}</Text>
            <Text style={styles.editorStatLabel}>ready</Text>
          </View>
          <View style={styles.editorStatPill}>
            <Text style={styles.editorStatValue}>
              {quiz.questions.length - readyQuestionCount}
            </Text>
            <Text style={styles.editorStatLabel}>drafting</Text>
          </View>
        </View>

        <View style={styles.editorQuestionTabs}>
          {quiz.questions.map((question, questionIndex) => {
            const isSelected = questionIndex === activeQuestionIndex;
            const filledOptions = question.options.filter((option) =>
              option.text.trim(),
            );
            const isReady =
              question.prompt.trim().length > 0 && filledOptions.length >= 2;

            return (
              <Pressable
                key={question.id}
                onPress={() => onSelectQuestion(questionIndex)}
                style={[
                  styles.editorQuestionTab,
                  isSelected && styles.editorQuestionTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.editorQuestionTabTitle,
                    isSelected && styles.editorQuestionTabTitleActive,
                  ]}
                >
                  Q{questionIndex + 1}
                </Text>
                <Text
                  style={[
                    styles.editorQuestionTabMeta,
                    isSelected && styles.editorQuestionTabMetaActive,
                  ]}
                >
                  {isReady ? "Ready" : "Draft"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <QuestionEditorCard
        key={activeQuestion.id}
        canRemove={quiz.questions.length > 1}
        onCorrectOptionChange={(optionId) =>
          onCorrectOptionChange(activeQuestionIndex, optionId)
        }
        onOptionChange={(optionIndex, text) =>
          onOptionChange(activeQuestionIndex, optionIndex, text)
        }
        onPromptChange={(prompt) => onPromptChange(activeQuestionIndex, prompt)}
        onRemove={() => onRemoveQuestion(activeQuestion.id)}
        question={activeQuestion}
        questionIndex={activeQuestionIndex}
      />

      <Pressable onPress={onAddQuestion} style={styles.addQuestionButton}>
        <Text style={styles.addQuestionText}>+ Add another question</Text>
      </Pressable>

      {quizIssues.length > 0 && (
        <View style={styles.issueCard}>
          <Text style={styles.issueTitle}>Still needed before you go live</Text>
          {quizIssues.map((issue) => (
            <Text key={issue} style={styles.issueText}>
              {issue}
            </Text>
          ))}
        </View>
      )}

      <Pressable
        disabled={!canCreateRoom}
        onPress={onCreateRoom}
        style={[
          styles.bigButton,
          !canCreateRoom && styles.disabledButton,
        ]}
      >
        <Text style={styles.bigButtonText}>
          {pendingAction === "create-room"
            ? "creating..."
            : "Go live"}
        </Text>
      </Pressable>

      <Pressable onPress={onBack} style={styles.backLink}>
        <Text style={styles.backLinkText}>
          {"\u2190"} Join a game instead
        </Text>
      </Pressable>
    </>
  );
}
