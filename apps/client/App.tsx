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
  type CheckRoomResult,
  type ErrorMessagePayload,
  type LeaderboardEntry,
  type PublicQuestion,
  type QuizDraft,
  type QuizQuestion,
  type RoomJoinedPayload,
  type RoomSnapshot,
} from "@quizgame/contracts";
import { API_BASE } from "./src/config";

type Screen = "join-code" | "join-name" | "host-setup" | "game";
type ConnectionState = "connecting" | "connected" | "disconnected";
type PendingAction =
  | "check-room"
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

const OPTION_THEMES = [
  { bg: "#e74c3c", icon: "\u25B2", label: "A" },
  { bg: "#3498db", icon: "\u25C6", label: "B" },
  { bg: "#f39c12", icon: "\u25CF", label: "C" },
  { bg: "#27ae60", icon: "\u25A0", label: "D" },
];

const MEDALS = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const screenRef = useRef<Screen>("join-code");
  const roomRef = useRef<RoomSnapshot | null>(null);

  const [screen, setScreen] = useState<Screen>("join-code");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [checkedRoom, setCheckedRoom] = useState<CheckRoomResult | null>(null);

  const [hostName, setHostName] = useState("Quiz Host");
  const [quiz, setQuiz] = useState<QuizDraft>(createStarterQuiz());

  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PublicQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    tone: "info",
    message: "Connecting...",
  });

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      setConnectionState("connected");
      setFeedback({
        tone: "success",
        message: roomRef.current
          ? "Reconnected!"
          : "Ready to play!",
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "info",
        message: "Connection lost. Reconnecting...",
      });
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
      setPendingAction(null);
      setFeedback({
        tone: "error",
        message: "Can't reach the game server.",
      });
    });

    socket.on("room:checked", (result: CheckRoomResult) => {
      setCheckedRoom(result);
      setRoomCodeInput(result.roomCode);
      setScreen("join-name");
      setPendingAction(null);
      setFeedback({
        tone: "success",
        message: `Found "${result.quizTitle}" hosted by ${result.hostName}!`,
      });
    });

    socket.on("room:joined", (payload: RoomJoinedPayload) => {
      setSessionPlayerId(payload.playerId);
      setRoom(payload.room);
      setCurrentQuestion(null);
      setSelectedOptionId(null);
      setScreen("game");
      setPendingAction(null);

      if (screenRef.current === "host-setup") {
        setIsHost(true);
        setFeedback({
          tone: "success",
          message: `Room ${payload.room.roomCode} is live! Share the code with players.`,
        });
      } else {
        setIsHost(false);
        setFeedback({
          tone: "success",
          message: `You're in! Waiting for ${payload.room.hostName} to start.`,
        });
      }
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
        message: `Question ${question.index + 1} of ${question.total} — go!`,
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
            ? "Final scores are in!"
            : "Scores updated!",
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
          ? `${winner.name} wins with ${winner.score} points!`
          : "Quiz complete!",
      });
    });

    socket.on("room:closed", (payload: ErrorMessagePayload) => {
      resetToStart();
      setPendingAction(null);
      setFeedback({ tone: "error", message: payload.message });
    });

    socket.on("error:message", (payload: ErrorMessagePayload) => {
      setPendingAction(null);
      setFeedback({ tone: "error", message: payload.message });
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, []);

  const resetToStart = () => {
    setRoom(null);
    setCurrentQuestion(null);
    setSelectedOptionId(null);
    setSessionPlayerId(null);
    setCheckedRoom(null);
    setIsHost(false);
    setScreen("join-code");
  };

  const checkRoom = () => {
    if (connectionState !== "connected" || !roomCodeInput.trim()) {
      return;
    }

    setPendingAction("check-room");
    setFeedback({ tone: "info", message: "Looking for room..." });
    socketRef.current?.emit("player:check-room", {
      roomCode: roomCodeInput.trim().toUpperCase(),
    });
  };

  const joinRoom = () => {
    if (connectionState !== "connected" || !playerName.trim() || !roomCodeInput.trim()) {
      return;
    }

    setPendingAction("join-room");
    setFeedback({ tone: "info", message: "Joining..." });
    socketRef.current?.emit("player:join-room", {
      roomCode: roomCodeInput.trim().toUpperCase(),
      name: playerName.trim(),
    });
  };

  const quizIssues = useMemo(() => validateQuiz(quiz), [quiz]);

  const createRoom = () => {
    if (
      connectionState !== "connected" ||
      !hostName.trim() ||
      quizIssues.length > 0
    ) {
      return;
    }

    setPendingAction("create-room");
    setFeedback({ tone: "info", message: "Creating your room..." });
    socketRef.current?.emit("host:create-room", { hostName, quiz });
  };

  const startGame = () => {
    if (!room) {
      return;
    }

    setPendingAction("start-game");
    setFeedback({ tone: "info", message: "Starting the quiz..." });
    socketRef.current?.emit("host:start-game", room.roomCode);
  };

  const revealLeaderboard = () => {
    if (!room) {
      return;
    }

    setPendingAction("show-leaderboard");
    setFeedback({ tone: "info", message: "Revealing scores..." });
    socketRef.current?.emit("host:show-leaderboard", room.roomCode);
  };

  const nextQuestion = () => {
    if (!room) {
      return;
    }

    const isLast = room.currentQuestionIndex === room.totalQuestions - 1;
    setPendingAction("next-question");
    setFeedback({
      tone: "info",
      message: isLast ? "Wrapping up..." : "Next question...",
    });
    socketRef.current?.emit("host:next-question", room.roomCode);
  };

  const submitAnswer = () => {
    if (!room || !selectedOptionId || hasAnsweredCurrentQuestion) {
      return;
    }

    setPendingAction("submit-answer");
    setFeedback({ tone: "info", message: "Locked in!" });
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
        index === questionIndex
          ? { ...question, correctOptionId: optionId }
          : question,
      ),
    }));
  };

  const addQuestion = () => {
    setQuiz((current) => ({
      ...current,
      questions: [
        ...current.questions,
        createEmptyQuestion(current.questions.length),
      ],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setQuiz((current) => {
      if (current.questions.length === 1) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.filter(
          (question) => question.id !== questionId,
        ),
      };
    });
  };

  const answeredCount = useMemo(
    () =>
      room?.leaderboard.filter((entry) => entry.answeredCurrentQuestion)
        .length ?? 0,
    [room],
  );
  const hasAnsweredCurrentQuestion = useMemo(() => {
    if (!room || !sessionPlayerId) {
      return false;
    }

    return room.leaderboard.some(
      (entry) =>
        entry.playerId === sessionPlayerId && entry.answeredCurrentQuestion,
    );
  }, [room, sessionPlayerId]);
  const winner = room?.leaderboard[0] ?? null;

  const canCheckRoom =
    connectionState === "connected" &&
    pendingAction === null &&
    roomCodeInput.trim().length > 0;
  const canJoinRoom =
    connectionState === "connected" &&
    pendingAction === null &&
    playerName.trim().length > 0;
  const canCreateRoom =
    connectionState === "connected" &&
    pendingAction === null &&
    hostName.trim().length > 0 &&
    quizIssues.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header (hidden during game) ── */}
        {screen !== "game" && (
          <View style={styles.headerContainer}>
            <Text style={styles.logo}>{"\uD83E\uDDE0"}</Text>
            <Text style={styles.title}>QuizGame</Text>
            {screen === "join-code" && (
              <Text style={styles.subtitle}>Join a live quiz in seconds</Text>
            )}
            <StatusChip state={connectionState} />
          </View>
        )}

        <FeedbackBanner feedback={feedback} />

        {/* ── SCREEN: Enter room code (player-first) ── */}
        {screen === "join-code" && (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEmoji}>{"\uD83C\uDFAE"}</Text>
              <Text style={styles.heroTitle}>Enter Game Code</Text>
              <Text style={styles.heroSubtitle}>
                Ask your host for the 6-character room code
              </Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                onChangeText={setRoomCodeInput}
                placeholder="ABC123"
                placeholderTextColor="#64748b"
                style={styles.codeInput}
                value={roomCodeInput}
              />
              <Pressable
                disabled={!canCheckRoom}
                onPress={checkRoom}
                style={[
                  styles.bigButton,
                  !canCheckRoom && styles.disabledButton,
                ]}
              >
                <Text style={styles.bigButtonText}>
                  {pendingAction === "check-room"
                    ? "Looking..."
                    : "Join Game \uD83D\uDE80"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setScreen("host-setup");
                setFeedback({
                  tone: "info",
                  message: "Set up your quiz below.",
                });
              }}
              style={styles.hostLink}
            >
              <Text style={styles.hostLinkText}>
                Want to host a quiz instead?
              </Text>
            </Pressable>
          </>
        )}

        {/* ── SCREEN: Choose display name ── */}
        {screen === "join-name" && checkedRoom && (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEmoji}>{"\uD83D\uDC4B"}</Text>
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
                onChangeText={setPlayerName}
                placeholder="Your name"
                placeholderTextColor="#64748b"
                style={styles.nameInput}
                value={playerName}
              />
              <Pressable
                disabled={!canJoinRoom}
                onPress={joinRoom}
                style={[
                  styles.bigButton,
                  !canJoinRoom && styles.disabledButton,
                ]}
              >
                <Text style={styles.bigButtonText}>
                  {pendingAction === "join-room"
                    ? "Joining..."
                    : "Let's Go! \uD83C\uDF89"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setScreen("join-code");
                setCheckedRoom(null);
              }}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>{"\u2190"} Back</Text>
            </Pressable>
          </>
        )}

        {/* ── SCREEN: Host setup (quiz editor) ── */}
        {screen === "host-setup" && !room && (
          <>
            <View style={styles.editorHeader}>
              <Text style={styles.editorTitle}>
                {"\uD83D\uDCDD"} Create Your Quiz
              </Text>
              <Text style={styles.editorSubtitle}>
                Build something fun for your players
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.inputLabel}>Host name</Text>
              <TextInput
                onChangeText={setHostName}
                placeholder="Your name"
                placeholderTextColor="#64748b"
                style={styles.input}
                value={hostName}
              />
              <Text style={styles.inputLabel}>Quiz title</Text>
              <TextInput
                onChangeText={(title) =>
                  setQuiz((current) => ({ ...current, title }))
                }
                placeholder="Friday Quiz Night"
                placeholderTextColor="#64748b"
                style={styles.input}
                value={quiz.title}
              />
            </View>

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
                onPromptChange={(prompt) =>
                  updateQuestionPrompt(questionIndex, prompt)
                }
                onRemove={() => removeQuestion(question.id)}
                question={question}
                questionIndex={questionIndex}
              />
            ))}

            <Pressable onPress={addQuestion} style={styles.addQuestionButton}>
              <Text style={styles.addQuestionText}>+ Add Question</Text>
            </Pressable>

            {quizIssues.length > 0 && (
              <View style={styles.issueCard}>
                {quizIssues.map((issue) => (
                  <Text key={issue} style={styles.issueText}>
                    {"\u26A0\uFE0F"} {issue}
                  </Text>
                ))}
              </View>
            )}

            <Pressable
              disabled={!canCreateRoom}
              onPress={createRoom}
              style={[
                styles.bigButton,
                !canCreateRoom && styles.disabledButton,
              ]}
            >
              <Text style={styles.bigButtonText}>
                {pendingAction === "create-room"
                  ? "Creating..."
                  : "Go Live! \uD83C\uDFAC"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setScreen("join-code");
                setFeedback({ tone: "info", message: "Ready to play!" });
              }}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>
                {"\u2190"} Join a game instead
              </Text>
            </Pressable>
          </>
        )}

        {/* ── SCREEN: Active game ── */}
        {screen === "game" && room && (
          <>
            {/* Compact game header */}
            <View style={styles.gameHeader}>
              <View style={styles.gameHeaderInfo}>
                <Text style={styles.gameTitle}>
                  {"\uD83E\uDDE0"} {room.quizTitle}
                </Text>
                <Text style={styles.gameSubtitle}>
                  Room {room.roomCode} {"\u2022"} {room.players.length} player
                  {room.players.length !== 1 ? "s" : ""}
                  {room.status === "question"
                    ? ` \u2022 ${answeredCount} answered`
                    : ""}
                </Text>
              </View>
              <StatusChip state={connectionState} />
            </View>

            {/* Host controls */}
            {isHost && (
              <View style={styles.hostControlsCard}>
                {room.status === "lobby" && (
                  <>
                    <Text style={styles.controlsHint}>
                      Share this code with your players
                    </Text>
                    <Text style={styles.bigRoomCode}>{room.roomCode}</Text>
                    <Text style={styles.controlsMeta}>
                      {room.players.length === 0
                        ? "Waiting for players to join..."
                        : `${room.players.length} player${room.players.length !== 1 ? "s" : ""} joined. Start when ready!`}
                    </Text>
                    <Pressable
                      disabled={
                        pendingAction !== null || room.players.length === 0
                      }
                      onPress={startGame}
                      style={[
                        styles.bigButton,
                        (pendingAction !== null ||
                          room.players.length === 0) &&
                          styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.bigButtonText}>
                        {pendingAction === "start-game"
                          ? "Starting..."
                          : "Start Quiz \u26A1"}
                      </Text>
                    </Pressable>
                  </>
                )}
                {room.status === "question" && (
                  <>
                    <Text style={styles.controlsHint}>
                      {"\u23F3"} Question is live
                    </Text>
                    <Text style={styles.controlsMeta}>
                      {answeredCount} of {room.players.length} answered
                    </Text>
                    <Pressable
                      disabled={pendingAction !== null}
                      onPress={revealLeaderboard}
                      style={[
                        styles.secondaryBigButton,
                        pendingAction !== null && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.secondaryBigButtonText}>
                        {pendingAction === "show-leaderboard"
                          ? "Revealing..."
                          : "Show Scores \uD83D\uDCCA"}
                      </Text>
                    </Pressable>
                  </>
                )}
                {room.status === "leaderboard" && (
                  <>
                    <Text style={styles.controlsHint}>
                      {"\uD83D\uDCCA"} Scores revealed
                    </Text>
                    <Pressable
                      disabled={pendingAction !== null}
                      onPress={nextQuestion}
                      style={[
                        styles.bigButton,
                        pendingAction !== null && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.bigButtonText}>
                        {pendingAction === "next-question"
                          ? "Loading..."
                          : room.currentQuestionIndex ===
                              room.totalQuestions - 1
                            ? "Finish Quiz \uD83C\uDFC1"
                            : "Next Question \u26A1"}
                      </Text>
                    </Pressable>
                  </>
                )}
                {room.status === "finished" && (
                  <Text style={styles.controlsHint}>
                    {"\uD83C\uDFC6"} Quiz Complete!
                  </Text>
                )}
              </View>
            )}

            {/* Player waiting states */}
            {!isHost && room.status === "lobby" && (
              <View style={styles.waitingCard}>
                <Text style={styles.waitingEmoji}>{"\u23F3"}</Text>
                <Text style={styles.waitingText}>
                  You're in! Waiting for {room.hostName} to start...
                </Text>
              </View>
            )}
            {!isHost && room.status === "leaderboard" && !currentQuestion && (
              <View style={styles.waitingCard}>
                <Text style={styles.waitingEmoji}>{"\uD83D\uDCCA"}</Text>
                <Text style={styles.waitingText}>
                  Check the scores below!
                </Text>
              </View>
            )}
            {!isHost && room.status === "finished" && (
              <View style={styles.waitingCard}>
                <Text style={styles.waitingEmoji}>{"\uD83C\uDF89"}</Text>
                <Text style={styles.waitingText}>Thanks for playing!</Text>
              </View>
            )}

            {/* Active question */}
            {currentQuestion && (
              <View style={styles.questionCard}>
                <View style={styles.questionBadge}>
                  <Text style={styles.questionBadgeText}>
                    {currentQuestion.index + 1} / {currentQuestion.total}
                  </Text>
                </View>
                <Text style={styles.questionPrompt}>
                  {currentQuestion.prompt}
                </Text>

                <View style={styles.optionsGrid}>
                  {currentQuestion.options.map((option, optionIndex) => {
                    const theme =
                      OPTION_THEMES[optionIndex % OPTION_THEMES.length];
                    const selected = selectedOptionId === option.id;
                    const answered = hasAnsweredCurrentQuestion;

                    return (
                      <Pressable
                        key={option.id}
                        disabled={answered}
                        onPress={() => setSelectedOptionId(option.id)}
                        style={[
                          styles.optionButton,
                          {
                            backgroundColor: selected
                              ? theme.bg
                              : `${theme.bg}25`,
                            borderColor: selected ? theme.bg : `${theme.bg}50`,
                          },
                          answered && !selected && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={styles.optionIcon}>{theme.icon}</Text>
                        <Text
                          style={[
                            styles.optionText,
                            selected && { fontWeight: "800" },
                          ]}
                        >
                          {option.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!isHost && (
                  <Pressable
                    disabled={
                      !selectedOptionId ||
                      hasAnsweredCurrentQuestion ||
                      pendingAction !== null
                    }
                    onPress={submitAnswer}
                    style={[
                      hasAnsweredCurrentQuestion
                        ? styles.answeredButton
                        : styles.bigButton,
                      !selectedOptionId &&
                        !hasAnsweredCurrentQuestion &&
                        styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.bigButtonText}>
                      {hasAnsweredCurrentQuestion
                        ? "Answer Locked In \u2705"
                        : pendingAction === "submit-answer"
                          ? "Sending..."
                          : "Lock In Answer \uD83D\uDD12"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Leaderboard */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {room.status === "finished"
                  ? "\uD83C\uDFC6 Final Results"
                  : "\uD83D\uDCCA Leaderboard"}
              </Text>

              {winner && room.status === "finished" && (
                <View style={styles.winnerCard}>
                  <Text style={styles.winnerEmoji}>{"\uD83C\uDFC6"}</Text>
                  <Text style={styles.winnerName}>{winner.name}</Text>
                  <Text style={styles.winnerScore}>
                    {winner.score} points
                  </Text>
                </View>
              )}

              {room.leaderboard.length === 0 ? (
                <Text style={styles.emptyText}>
                  Players will appear here once they join.
                </Text>
              ) : (
                room.leaderboard.map((entry, index) => (
                  <LeaderboardRow
                    key={entry.playerId}
                    entry={entry}
                    index={index}
                    roomStatus={room.status}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Helpers ── */

function validateQuiz(quiz: QuizDraft): string[] {
  const issues: string[] = [];

  if (!quiz.title.trim()) {
    issues.push("Add a quiz title.");
  }

  quiz.questions.forEach((question, index) => {
    if (!question.prompt.trim()) {
      issues.push(`Question ${index + 1} needs a prompt.`);
    }

    const filledOptions = question.options.filter(
      (option) => option.text.trim().length > 0,
    );

    if (filledOptions.length < 2) {
      issues.push(
        `Question ${index + 1} needs at least two answer options.`,
      );
    }
  });

  return issues;
}

/* ── Sub-components ── */

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
        {state === "connected"
          ? "Online"
          : state === "connecting"
            ? "Connecting"
            : "Offline"}
      </Text>
    </View>
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
        placeholderTextColor="#64748b"
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
                  backgroundColor: isCorrect ? "#10b981" : `${theme.bg}30`,
                  borderColor: isCorrect ? "#10b981" : `${theme.bg}60`,
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
              placeholderTextColor="#64748b"
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

function LeaderboardRow({
  entry,
  index,
  roomStatus,
}: {
  entry: LeaderboardEntry;
  index: number;
  roomStatus: RoomSnapshot["status"];
}) {
  const medal = MEDALS[index] ?? null;

  return (
    <View
      style={[
        styles.leaderboardRow,
        index === 0 && styles.leaderboardRowFirst,
      ]}
    >
      <View style={styles.leaderboardLeft}>
        <Text style={styles.leaderboardRank}>
          {medal ?? `${index + 1}.`}
        </Text>
        <View>
          <Text
            style={[
              styles.leaderboardName,
              index === 0 && styles.leaderboardNameFirst,
            ]}
          >
            {entry.name}
          </Text>
          {roomStatus === "question" ? (
            <Text style={styles.playerMeta}>
              {entry.answeredCurrentQuestion
                ? "\u2705 Answered"
                : "\u23F3 Thinking..."}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        style={[
          styles.leaderboardScore,
          index === 0 && styles.leaderboardScoreFirst,
        ]}
      >
        {entry.score}
      </Text>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },

  /* Header */
  headerContainer: {
    alignItems: "center",
    gap: 2,
    paddingTop: 12,
    paddingBottom: 4,
  },
  logo: {
    fontSize: 48,
  },
  title: {
    color: "#f8fafc",
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
  },

  /* Status chip */
  statusChip: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
  },
  statusChipConnected: {
    backgroundColor: "#065f46",
  },
  statusChipDisconnected: {
    backgroundColor: "#7f1d1d",
  },
  statusChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  /* Feedback */
  feedbackBanner: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    textAlign: "center",
  },

  /* Hero card (join code / join name) */
  heroCard: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 28,
  },
  heroEmoji: {
    fontSize: 52,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#94a3b8",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  codeInput: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderRadius: 16,
    borderWidth: 2,
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    textAlign: "center",
    width: "100%",
  },
  nameInput: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderRadius: 14,
    borderWidth: 2,
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: "center",
    width: "100%",
  },
  inputLabel: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* Room info badge (join-name screen) */
  roomInfoBadge: {
    alignItems: "center",
    backgroundColor: "#1e1b4b",
    borderRadius: 16,
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: "100%",
  },
  roomInfoTitle: {
    color: "#c4b5fd",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  roomInfoDetail: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },

  /* Buttons */
  bigButton: {
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: "100%",
  },
  bigButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryBigButton: {
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: "100%",
  },
  secondaryBigButtonText: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
  },
  answeredButton: {
    alignItems: "center",
    backgroundColor: "#065f46",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: "100%",
  },
  disabledButton: {
    opacity: 0.45,
  },
  hostLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  hostLinkText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "600",
  },

  /* Card */
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

  /* Input */
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
    minHeight: 80,
    textAlignVertical: "top",
  },

  /* Host setup / editor */
  editorHeader: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  editorTitle: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  editorSubtitle: {
    color: "#94a3b8",
    fontSize: 15,
    textAlign: "center",
  },
  editorQuestionCard: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  editorQuestionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editorQuestionBadge: {
    backgroundColor: "#8b5cf6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editorQuestionBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  removeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "700",
  },
  editorOptionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  editorOptionInput: {
    flex: 1,
  },
  editorOptionHint: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },
  correctPicker: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  correctPickerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  addQuestionButton: {
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderColor: "#334155",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 2,
    paddingVertical: 16,
  },
  addQuestionText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "700",
  },
  issueCard: {
    backgroundColor: "#1c1017",
    borderColor: "#7f1d1d",
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  issueText: {
    color: "#fca5a5",
    fontSize: 14,
  },

  /* Game header */
  gameHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  gameHeaderInfo: {
    flex: 1,
  },
  gameTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
  },
  gameSubtitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 2,
  },

  /* Host controls */
  hostControlsCard: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  controlsHint: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  controlsMeta: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
  },
  bigRoomCode: {
    color: "#8b5cf6",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
  },

  /* Player waiting */
  waitingCard: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  waitingEmoji: {
    fontSize: 40,
  },
  waitingText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  /* Question */
  questionCard: {
    backgroundColor: "#111827",
    borderColor: "#1f2937",
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  questionBadge: {
    alignSelf: "center",
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  questionBadgeText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "700",
  },
  questionPrompt: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
  },
  optionsGrid: {
    gap: 10,
  },
  optionButton: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  optionIcon: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    width: 28,
    textAlign: "center",
  },
  optionText: {
    color: "#f8fafc",
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },

  /* Winner */
  winnerCard: {
    alignItems: "center",
    backgroundColor: "#1e1b4b",
    borderRadius: 18,
    gap: 4,
    padding: 20,
  },
  winnerEmoji: {
    fontSize: 44,
  },
  winnerName: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
  },
  winnerScore: {
    color: "#ddd6fe",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 8,
  },

  /* Leaderboard */
  leaderboardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  leaderboardRowFirst: {
    backgroundColor: "#1e1b4b",
    borderRadius: 12,
    marginHorizontal: -4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leaderboardLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  leaderboardRank: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    width: 32,
    textAlign: "center",
  },
  leaderboardName: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
  },
  leaderboardNameFirst: {
    fontSize: 18,
    fontWeight: "800",
  },
  leaderboardScore: {
    color: "#c4b5fd",
    fontSize: 18,
    fontWeight: "800",
  },
  leaderboardScoreFirst: {
    fontSize: 22,
    color: "#a78bfa",
  },
  playerMeta: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 2,
  },
});
