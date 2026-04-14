import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { io, type Socket } from "socket.io-client";
import {
  createEmptyQuestion,
  createStarterQuiz,
  type ErrorMessagePayload,
  type LeaderboardEntry,
  type PublicQuestion,
  type QuizDraft,
  type QuizQuestion,
  type RoomJoinedPayload,
  type RoomSnapshot,
} from "@quizgame/contracts";
import { API_BASE } from "./src/config";

type Mode = "host" | "player";
type ConnectionState = "connecting" | "connected" | "disconnected";
type PendingAction =
  | "create-room"
  | "join-room"
  | "start-game"
  | "show-leaderboard"
  | "next-question"
  | "submit-answer"
  | null;
type FeedbackTone = "info" | "success" | "error";

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const modeRef = useRef<Mode>("host");
  const roomRef = useRef<RoomSnapshot | null>(null);
  const [mode, setMode] = useState<Mode>("host");
  const [hostName, setHostName] = useState("Quiz Host");
  const [playerName, setPlayerName] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [quiz, setQuiz] = useState<QuizDraft>(createStarterQuiz());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PublicQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    tone: "info",
    message: "Connecting to the game service...",
  });

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConnectionState("connected");
      setFeedback({
        tone: "success",
        message: roomRef.current
          ? "Reconnected to the game service."
          : "Connected. Ready to host or join with a room code.",
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message: roomRef.current
          ? "Connection lost. Trying to reconnect..."
          : "Disconnected. Trying to reconnect...",
      });
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "error",
        message: "Could not reach the game service.",
      });
    });

    socket.on("room:joined", (payload: RoomJoinedPayload) => {
      setSessionPlayerId(payload.playerId);
      setRoom(payload.room);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setPendingAction(null);
      setFeedback({
        tone: "success",
        message:
          modeRef.current === "host"
            ? `Room ${payload.room.roomCode} is live. Share the code with players.`
            : `Joined ${payload.room.quizTitle}. Waiting for ${payload.room.hostName} to start.`,
      });
    });

    socket.on("room:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setPendingAction(null);
    });

    socket.on("question:started", (question: PublicQuestion) => {
      setCurrentQuestion(question);
      setSelectedOptionId(null);
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message:
          modeRef.current === "host"
            ? `Question ${question.index + 1} is live. Watch the answers come in.`
            : `Question ${question.index + 1} is live. Choose your answer now.`,
      });
    });

    socket.on("leaderboard:update", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setPendingAction(null);
      setFeedback({
        tone: "success",
        message:
          snapshot.currentQuestionIndex === snapshot.totalQuestions - 1
            ? "Scores updated. The final question is complete."
            : "Scores updated. Review the leaderboard and continue when ready.",
      });
    });

    socket.on("game:finished", (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setPendingAction(null);
      const winner = snapshot.leaderboard[0];

      setFeedback({
        tone: "success",
        message: winner
          ? `${winner.name} wins with ${winner.score} points.`
          : "Quiz finished.",
      });
    });

    socket.on("room:closed", (payload: ErrorMessagePayload) => {
      resetRoomState();
      setPendingAction(null);
      setFeedback({
        tone: "error",
        message: payload.message,
      });
    });

    socket.on("error:message", (payload: ErrorMessagePayload) => {
      setPendingAction(null);
      setFeedback({
        tone: "error",
        message: payload.message,
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const resetRoomState = () => {
    setRoom(null);
    setCurrentQuestion(null);
    setSelectedOptionId(null);
    setSessionPlayerId(null);
  };

  const quizIssues = useMemo(() => validateQuiz(quiz), [quiz]);

  const canCreateRoom =
    connectionState === "connected" &&
    pendingAction === null &&
    hostName.trim().length > 0 &&
    quizIssues.length === 0;
  const canJoinRoom =
    connectionState === "connected" &&
    pendingAction === null &&
    playerName.trim().length > 0 &&
    roomCodeInput.trim().length > 0;
  const isHostRoom = mode === "host" && room !== null;
  const answeredCount = useMemo(
    () => room?.leaderboard.filter((entry) => entry.answeredCurrentQuestion).length ?? 0,
    [room],
  );
  const hasAnsweredCurrentQuestion = useMemo(() => {
    if (!room || !sessionPlayerId) {
      return false;
    }

    return room.leaderboard.some(
      (entry) => entry.playerId === sessionPlayerId && entry.answeredCurrentQuestion,
    );
  }, [room, sessionPlayerId]);
  const winner = room?.leaderboard[0] ?? null;

  const createRoom = () => {
    if (!canCreateRoom) {
      return;
    }

    setPendingAction("create-room");
    setFeedback({
      tone: "info",
      message: "Creating your room...",
    });
    socketRef.current?.emit("host:create-room", { hostName, quiz });
  };

  const joinRoom = () => {
    if (!canJoinRoom) {
      return;
    }

    setPendingAction("join-room");
    setFeedback({
      tone: "info",
      message: "Joining room...",
    });
    socketRef.current?.emit("player:join-room", {
      roomCode: roomCodeInput.trim().toUpperCase(),
      name: playerName.trim(),
    });
  };

  const startGame = () => {
    if (!room) {
      return;
    }

    setPendingAction("start-game");
    setFeedback({
      tone: "info",
      message: "Starting the quiz...",
    });
    socketRef.current?.emit("host:start-game", room.roomCode);
  };

  const revealLeaderboard = () => {
    if (!room) {
      return;
    }

    setPendingAction("show-leaderboard");
    setFeedback({
      tone: "info",
      message: "Revealing the leaderboard...",
    });
    socketRef.current?.emit("host:show-leaderboard", room.roomCode);
  };

  const nextQuestion = () => {
    if (!room) {
      return;
    }

    setPendingAction("next-question");
    setFeedback({
      tone: "info",
      message:
        room.currentQuestionIndex === room.totalQuestions - 1
          ? "Finishing the quiz..."
          : "Moving to the next question...",
    });
    socketRef.current?.emit("host:next-question", room.roomCode);
  };

  const submitAnswer = () => {
    if (!room || !selectedOptionId || hasAnsweredCurrentQuestion) {
      return;
    }

    setPendingAction("submit-answer");
    setFeedback({
      tone: "info",
      message: "Submitting your answer...",
    });
    socketRef.current?.emit("player:submit-answer", {
      roomCode: room.roomCode,
      optionId: selectedOptionId,
    });
  };

  const updateQuestionPrompt = (questionIndex: number, prompt: string) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? { ...question, prompt } : question,
      ),
    }));
  };

  const updateQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex
          ? {
              ...question,
              options: question.options.map((option, innerIndex) =>
                innerIndex === optionIndex ? { ...option, text } : option,
              ),
            }
          : question,
      ),
    }));
  };

  const setCorrectOption = (questionIndex: number, optionId: string) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? { ...question, correctOptionId: optionId } : question,
      ),
    }));
  };

  const addQuestion = () => {
    setQuiz((current) => ({
      ...current,
      questions: [...current.questions, createEmptyQuestion(current.questions.length)],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setQuiz((current) => {
      if (current.questions.length === 1) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.filter((question) => question.id !== questionId),
      };
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>QuizGame</Text>
            <Text style={styles.subtitle}>Host live quiz rooms with a single code.</Text>
          </View>
          <StatusChip state={connectionState} />
        </View>

        <FeedbackBanner feedback={feedback} />

        {!room ? (
          <>
            <View style={styles.toggleRow}>
              <ModeButton active={mode === "host"} label="Host" onPress={() => setMode("host")} />
              <ModeButton
                active={mode === "player"}
                label="Player"
                onPress={() => setMode("player")}
              />
            </View>

            {mode === "host" ? (
              <>
                <SectionCard title="Quiz editor">
                  <Text style={styles.label}>Host name</Text>
                  <TextInput
                    onChangeText={setHostName}
                    placeholder="Host name"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                    value={hostName}
                  />

                  <Text style={styles.label}>Quiz title</Text>
                  <TextInput
                    onChangeText={(title) => setQuiz((current) => ({ ...current, title }))}
                    placeholder="Quiz title"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                    value={quiz.title}
                  />

                  {quiz.questions.map((question, questionIndex) => (
                    <QuestionEditorCard
                      key={question.id}
                      canRemove={quiz.questions.length > 1}
                      onCorrectOptionChange={(optionId) =>
                        setCorrectOption(questionIndex, optionId)
                      }
                      onOptionChange={(optionIndex, text) =>
                        updateQuestionOption(questionIndex, optionIndex, text)
                      }
                      onPromptChange={(prompt) => updateQuestionPrompt(questionIndex, prompt)}
                      onRemove={() => removeQuestion(question.id)}
                      question={question}
                      questionIndex={questionIndex}
                    />
                  ))}

                  <Pressable onPress={addQuestion} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Add question</Text>
                  </Pressable>
                </SectionCard>

                <SectionCard title="Go live">
                  {quizIssues.length > 0 ? (
                    <View style={styles.issueList}>
                      {quizIssues.map((issue) => (
                        <Text key={issue} style={styles.issueText}>
                          • {issue}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.metaText}>
                      Ready to host. Players will join with a room code and their name.
                    </Text>
                  )}

                  <ActionButton
                    disabled={!canCreateRoom}
                    label={pendingAction === "create-room" ? "Creating room..." : "Create room"}
                    onPress={createRoom}
                    variant="primary"
                  />
                </SectionCard>
              </>
            ) : (
              <SectionCard title="Join a room">
                <Text style={styles.metaText}>
                  Enter the room code from the host and the name you want on the leaderboard.
                </Text>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  onChangeText={setPlayerName}
                  placeholder="Player name"
                  placeholderTextColor="#64748b"
                  style={styles.input}
                  value={playerName}
                />
                <Text style={styles.label}>Room code</Text>
                <TextInput
                  autoCapitalize="characters"
                  onChangeText={setRoomCodeInput}
                  placeholder="ABC123"
                  placeholderTextColor="#64748b"
                  style={styles.input}
                  value={roomCodeInput}
                />
                <ActionButton
                  disabled={!canJoinRoom}
                  label={pendingAction === "join-room" ? "Joining room..." : "Join room"}
                  onPress={joinRoom}
                  variant="primary"
                />
              </SectionCard>
            )}
          </>
        ) : (
          <>
            <SectionCard title="Room overview">
              <Text style={styles.roomCode}>Room code: {room.roomCode}</Text>
              <Text style={styles.metaText}>Quiz: {room.quizTitle}</Text>
              <Text style={styles.metaText}>Host: {room.hostName}</Text>
              <Text style={styles.metaText}>Status: {formatRoomStatus(room.status)}</Text>
              <Text style={styles.metaText}>
                Players: {room.players.length} joined
                {room.status === "question" ? ` • ${answeredCount} answered` : ""}
              </Text>
            </SectionCard>

            {isHostRoom ? (
              <SectionCard title="Host controls">
                {room.status === "lobby" ? (
                  <Text style={styles.metaText}>
                    Waiting for players. Start when everyone has joined.
                  </Text>
                ) : null}
                {room.status === "question" ? (
                  <Text style={styles.metaText}>
                    Question live. Reveal the leaderboard when you are ready.
                  </Text>
                ) : null}
                {room.status === "leaderboard" ? (
                  <Text style={styles.metaText}>
                    Review scores, then continue to the next question.
                  </Text>
                ) : null}
                {room.status === "finished" ? (
                  <Text style={styles.metaText}>The quiz is complete.</Text>
                ) : null}

                <View style={styles.actionRow}>
                  {room.status === "lobby" ? (
                    <ActionButton
                      disabled={pendingAction !== null}
                      label={pendingAction === "start-game" ? "Starting..." : "Start quiz"}
                      onPress={startGame}
                      variant="primary"
                    />
                  ) : null}
                  {room.status === "question" ? (
                    <ActionButton
                      disabled={pendingAction !== null}
                      label={
                        pendingAction === "show-leaderboard"
                          ? "Revealing..."
                          : "Show leaderboard"
                      }
                      onPress={revealLeaderboard}
                      variant="secondary"
                    />
                  ) : null}
                  {room.status === "leaderboard" ? (
                    <ActionButton
                      disabled={pendingAction !== null}
                      label={
                        pendingAction === "next-question"
                          ? "Continuing..."
                          : room.currentQuestionIndex === room.totalQuestions - 1
                            ? "Finish quiz"
                            : "Next question"
                      }
                      onPress={nextQuestion}
                      variant="primary"
                    />
                  ) : null}
                </View>
              </SectionCard>
            ) : (
              <SectionCard title="Player status">
                {room.status === "lobby" ? (
                  <Text style={styles.metaText}>
                    You are in. Waiting for {room.hostName} to start the quiz.
                  </Text>
                ) : null}
                {room.status === "leaderboard" ? (
                  <Text style={styles.metaText}>
                    Scores are up. Get ready for the next question.
                  </Text>
                ) : null}
                {room.status === "finished" ? (
                  <Text style={styles.metaText}>The quiz is finished. Thanks for playing.</Text>
                ) : null}
              </SectionCard>
            )}

            {currentQuestion ? (
              <SectionCard title={`Question ${currentQuestion.index + 1} / ${currentQuestion.total}`}>
                <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>
                {currentQuestion.options.map((option) => {
                  const selected = selectedOptionId === option.id;

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setSelectedOptionId(option.id)}
                      style={[styles.answerButton, selected && styles.answerButtonSelected]}
                    >
                      <Text style={styles.answerButtonText}>{option.text}</Text>
                    </Pressable>
                  );
                })}

                {mode === "player" ? (
                  <ActionButton
                    disabled={!selectedOptionId || hasAnsweredCurrentQuestion || pendingAction !== null}
                    label={
                      hasAnsweredCurrentQuestion
                        ? "Answer sent"
                        : pendingAction === "submit-answer"
                          ? "Sending..."
                          : "Submit answer"
                    }
                    onPress={submitAnswer}
                    variant="primary"
                  />
                ) : null}
              </SectionCard>
            ) : null}

            <SectionCard title={room.status === "finished" ? "Final results" : "Leaderboard"}>
              {winner && room.status === "finished" ? (
                <View style={styles.winnerCard}>
                  <Text style={styles.winnerLabel}>Winner</Text>
                  <Text style={styles.winnerName}>{winner.name}</Text>
                  <Text style={styles.winnerScore}>{winner.score} points</Text>
                </View>
              ) : null}

              {room.leaderboard.length === 0 ? (
                <Text style={styles.metaText}>Players will appear here after they join.</Text>
              ) : (
                room.leaderboard.map((entry, index) => (
                  <LeaderboardRow
                    answeredCurrentQuestion={entry.answeredCurrentQuestion}
                    entry={entry}
                    index={index}
                    key={entry.playerId}
                    roomStatus={room.status}
                  />
                ))
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function validateQuiz(quiz: QuizDraft): string[] {
  const issues: string[] = [];

  if (!quiz.title.trim()) {
    issues.push("Add a quiz title.");
  }

  quiz.questions.forEach((question, index) => {
    if (!question.prompt.trim()) {
      issues.push(`Question ${index + 1} needs a prompt.`);
    }

    const filledOptions = question.options.filter((option) => option.text.trim().length > 0);

    if (filledOptions.length < 2) {
      issues.push(`Question ${index + 1} needs at least two answer options.`);
    }
  });

  return issues;
}

function formatRoomStatus(status: RoomSnapshot["status"]) {
  switch (status) {
    case "lobby":
      return "Waiting in lobby";
    case "question":
      return "Question live";
    case "leaderboard":
      return "Showing leaderboard";
    case "finished":
      return "Finished";
  }
}

function SectionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FeedbackBanner({ feedback }: { feedback: FeedbackState }) {
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

function StatusChip({ state }: { state: ConnectionState }) {
  return (
    <View
      style={[
        styles.statusChip,
        state === "connected" && styles.statusChipConnected,
        state === "disconnected" && styles.statusChipDisconnected,
      ]}
    >
      <Text style={styles.statusChipText}>
        {state === "connected" ? "Connected" : state === "connecting" ? "Connecting" : "Offline"}
      </Text>
    </View>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  variant,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary";
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        variant === "primary" ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.disabledButton,
      ]}
    >
      <Text
        style={variant === "primary" ? styles.primaryButtonText : styles.secondaryButtonText}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function QuestionEditorCard({
  canRemove,
  onCorrectOptionChange,
  onOptionChange,
  onPromptChange,
  onRemove,
  question,
  questionIndex,
}: {
  canRemove: boolean;
  onCorrectOptionChange: (optionId: string) => void;
  onOptionChange: (optionIndex: number, text: string) => void;
  onPromptChange: (prompt: string) => void;
  onRemove: () => void;
  question: QuizQuestion;
  questionIndex: number;
}) {
  return (
    <View style={styles.questionCard}>
      <View style={styles.questionHeaderRow}>
        <Text style={styles.questionHeading}>Question {questionIndex + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        multiline
        onChangeText={onPromptChange}
        placeholder="Write your question"
        placeholderTextColor="#64748b"
        style={[styles.input, styles.multilineInput]}
        value={question.prompt}
      />
      {question.options.map((option, optionIndex) => {
        const selected = question.correctOptionId === option.id;

        return (
          <View key={option.id} style={styles.optionRow}>
            <Pressable
              onPress={() => onCorrectOptionChange(option.id)}
              style={[styles.correctPicker, selected && styles.correctPickerActive]}
            >
              <Text style={styles.correctPickerText}>{selected ? "✓" : ""}</Text>
            </Pressable>
            <TextInput
              onChangeText={(value) => onOptionChange(optionIndex, value)}
              placeholder={`Option ${optionIndex + 1}`}
              placeholderTextColor="#64748b"
              style={[styles.input, styles.optionInput]}
              value={option.text}
            />
          </View>
        );
      })}
    </View>
  );
}

function LeaderboardRow({
  answeredCurrentQuestion,
  entry,
  index,
  roomStatus,
}: {
  answeredCurrentQuestion: boolean;
  entry: LeaderboardEntry;
  index: number;
  roomStatus: RoomSnapshot["status"];
}) {
  return (
    <View style={styles.leaderboardRow}>
      <View>
        <Text style={styles.leaderboardName}>
          {index + 1}. {entry.name}
        </Text>
        {roomStatus === "question" ? (
          <Text style={styles.playerMeta}>
            {answeredCurrentQuestion ? "Answered" : "Waiting for answer"}
          </Text>
        ) : null}
      </View>
      <Text style={styles.leaderboardScore}>{entry.score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 16,
    marginTop: -8,
  },
  statusChip: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusChipConnected: {
    backgroundColor: "#065f46",
  },
  statusChipDisconnected: {
    backgroundColor: "#7f1d1d",
  },
  statusChipText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  feedbackBanner: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  feedbackSuccess: {
    backgroundColor: "#14532d",
  },
  feedbackError: {
    backgroundColor: "#7f1d1d",
  },
  feedbackText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  modeButton: {
    backgroundColor: "#111827",
    borderColor: "#334155",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  modeButtonActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  modeButtonText: {
    color: "#cbd5e1",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  modeButtonTextActive: {
    color: "#ffffff",
  },
  card: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
  },
  label: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderRadius: 12,
    borderWidth: 1,
    color: "#f8fafc",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  metaText: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 20,
  },
  issueList: {
    gap: 6,
  },
  issueText: {
    color: "#fca5a5",
    fontSize: 14,
  },
  questionCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    gap: 10,
    padding: 14,
  },
  questionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  questionHeading: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    paddingVertical: 4,
  },
  linkButtonText: {
    color: "#c4b5fd",
    fontSize: 14,
    fontWeight: "700",
  },
  optionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  optionInput: {
    flex: 1,
  },
  correctPicker: {
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  correctPickerActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  correctPickerText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  roomCode: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 3,
  },
  questionPrompt: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  answerButton: {
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  answerButtonSelected: {
    backgroundColor: "#312e81",
    borderColor: "#8b5cf6",
  },
  answerButtonText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
  },
  winnerCard: {
    alignItems: "center",
    backgroundColor: "#1e1b4b",
    borderRadius: 18,
    padding: 18,
  },
  winnerLabel: {
    color: "#c4b5fd",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  winnerName: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 6,
  },
  winnerScore: {
    color: "#ddd6fe",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  leaderboardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  leaderboardName: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
  },
  playerMeta: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 2,
  },
  leaderboardScore: {
    color: "#c4b5fd",
    fontSize: 18,
    fontWeight: "800",
  },
});
