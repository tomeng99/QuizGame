import type { QuizDraft } from "@quizgame/contracts";

export const SAMPLE_HOST_NAME = "Dev Host";

export const SAMPLE_QUIZ: QuizDraft = {
  title: "Dev Sample Quiz",
  timeLimit: 20,
  questions: [
    {
      id: "sample-q1",
      prompt: "What is 2 + 2?",
      options: [
        { id: "sample-q1-a", text: "3" },
        { id: "sample-q1-b", text: "4" },
        { id: "sample-q1-c", text: "5" },
        { id: "sample-q1-d", text: "22" },
      ],
      correctOptionId: "sample-q1-b",
    },
    {
      id: "sample-q2",
      prompt: "Which planet is closest to the Sun?",
      options: [
        { id: "sample-q2-a", text: "Venus" },
        { id: "sample-q2-b", text: "Earth" },
        { id: "sample-q2-c", text: "Mercury" },
        { id: "sample-q2-d", text: "Mars" },
      ],
      correctOptionId: "sample-q2-c",
    },
    {
      id: "sample-q3",
      prompt: "What language runs in a web browser?",
      options: [
        { id: "sample-q3-a", text: "Python" },
        { id: "sample-q3-b", text: "Java" },
        { id: "sample-q3-c", text: "JavaScript" },
        { id: "sample-q3-d", text: "C++" },
      ],
      correctOptionId: "sample-q3-c",
    },
  ],
};
