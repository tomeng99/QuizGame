import type {
  GameSummary,
  LeaderboardEntry,
  PlayerSummary,
  PublicQuestion,
  QuizQuestion,
  RoomSnapshot,
} from "@quizgame/contracts";
import type { StoredRoom } from "./types";

// ── Snapshot builders ─────────────────────────────────────────────────────────

export const toLeaderboard = (room: StoredRoom): LeaderboardEntry[] =>
  Array.from(room.players.values())
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score,
      answeredCurrentQuestion:
        room.currentQuestionIndex !== null &&
        player.lastAnsweredQuestionId === room.quiz.questions[room.currentQuestionIndex]?.id,
      streak: player.streak,
      // Compute the net points earned this round by diffing against the pre-question snapshot.
      // This gives the client a "score delta" without needing a separate event.
      pointsEarnedThisRound: player.score - player.scoreBeforeCurrentQuestion,
    }));

export const toPlayers = (room: StoredRoom): PlayerSummary[] =>
  Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    connected: player.connected,
  }));

export const toSnapshot = (room: StoredRoom): RoomSnapshot => ({
  roomCode: room.code,
  hostName: room.hostName,
  quizTitle: room.quiz.title,
  status: room.status,
  currentQuestionIndex: room.currentQuestionIndex,
  totalQuestions: room.quiz.questions.length,
  players: toPlayers(room),
  leaderboard: toLeaderboard(room),
});

/**
 * Builds the end-of-game recap from the counters accumulated during play.
 *
 * Players come back in the same order as `toLeaderboard`, so the recap and the final
 * leaderboard agree on who placed where. Rounds that were never reached (a game can
 * end early) are simply absent from `questions`, which is why `scorableQuestions`
 * counts the recorded rounds rather than the quiz length.
 */
export const toGameSummary = (room: StoredRoom): GameSummary => ({
  questions: room.roundResults,
  scorableQuestions: room.roundResults.filter((round) => round.correctCount !== null).length,
  players: Array.from(room.players.values())
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score,
      correctAnswers: player.correctAnswerCount,
      missedQuestions: player.missedQuestionCount,
      bestStreak: player.bestStreak,
    })),
});

const shuffleItems = <T>(items: T[]): T[] => {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

/**
 * Re-stamps a cached public question with the current server clock.
 *
 * `activePublicQuestion` is built once when a question starts, but it is emitted again
 * later on reconnect. Without a fresh `serverNow` the receiving client would measure its
 * clock skew against a stale timestamp and read the deadline as further away than it is.
 */
export const withServerClock = (question: PublicQuestion): PublicQuestion => ({
  ...question,
  serverNow: Date.now(),
});

export const toPublicQuestion = (
  question: QuizQuestion,
  index: number,
  total: number,
  timeLimit: number,
  endsAt: number,
): PublicQuestion => {
  const base = {
    id: question.id,
    prompt: question.prompt,
    index,
    total,
    timeLimit,
    endsAt,
    serverNow: Date.now(),
  };

  switch (question.type) {
    case "multiple-choice":
      return {
        ...base,
        type: "multiple-choice",
        options: question.options,
      };
    case "poll":
      return {
        ...base,
        type: "poll",
        options: question.options,
      };
    case "number":
      return {
        ...base,
        type: "number",
        minValue: question.minValue,
        maxValue: question.maxValue,
      };
    case "ranking":
      return {
        ...base,
        type: "ranking",
        items: shuffleItems(question.items),
      };
  }
};
