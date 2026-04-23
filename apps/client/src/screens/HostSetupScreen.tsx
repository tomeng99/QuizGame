import { Pressable, Text, TextInput, View } from "react-native";
import type { QuizDraft } from "@quizgame/contracts";
import { styles } from "../styles";
import { colors } from "../theme";
import { QuestionEditorCard } from "../components";
import type { PendingAction } from "../types";

interface HostSetupScreenProps {
  hostName: string;
  onHostNameChange: (text: string) => void;
  quiz: QuizDraft;
  onQuizTitleChange: (title: string) => void;
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
  onQuizTitleChange,
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
  return (
    <>
      <View style={styles.editorHeader}>
        <Text style={styles.editorTitle}>Create Your Quiz</Text>
        <Text style={styles.editorSubtitle}>
          Build something fun for your players
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Host name</Text>
        <TextInput
          onChangeText={onHostNameChange}
          placeholder="Your name"
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
      </View>

      {quiz.questions.map((question, questionIndex) => (
        <QuestionEditorCard
          key={question.id}
          canRemove={quiz.questions.length > 1}
          onCorrectOptionChange={(optionId) =>
            onCorrectOptionChange(questionIndex, optionId)
          }
          onOptionChange={(optionIndex, text) =>
            onOptionChange(questionIndex, optionIndex, text)
          }
          onPromptChange={(prompt) =>
            onPromptChange(questionIndex, prompt)
          }
          onRemove={() => onRemoveQuestion(question.id)}
          question={question}
          questionIndex={questionIndex}
        />
      ))}

      <Pressable onPress={onAddQuestion} style={styles.addQuestionButton}>
        <Text style={styles.addQuestionText}>+ Add Question</Text>
      </Pressable>

      {quizIssues.length > 0 && (
        <View style={styles.issueCard}>
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
