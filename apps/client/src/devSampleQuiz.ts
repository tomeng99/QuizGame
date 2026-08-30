import type { QuizDraft } from "@quizgame/contracts";

export const SAMPLE_HOST_NAME = "Dev Host";

export const SAMPLE_QUIZ: QuizDraft = {
  title: "Dev Sample Quiz",
  timeLimit: 20,
  questions: [
    {
      id: "sample-q1",
      type: "multiple-choice",
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
      type: "poll",
      prompt: "What's the best season?",
      options: [
        { id: "sample-q2-a", text: "Spring" },
        { id: "sample-q2-b", text: "Summer" },
        { id: "sample-q2-c", text: "Autumn" },
        { id: "sample-q2-d", text: "Winter" },
      ],
    },
    {
      id: "sample-q3",
      type: "number",
      prompt: "How many countries are in the United Nations?",
      correctNumber: 193,
      minValue: 100,
      maxValue: 250,
    },
    {
      id: "sample-q4",
      type: "ranking",
      prompt: "Order these planets from closest to furthest from the Sun",
      items: [
        { id: "sample-q4-r1", text: "Mercury" },
        { id: "sample-q4-r2", text: "Venus" },
        { id: "sample-q4-r3", text: "Earth" },
        { id: "sample-q4-r4", text: "Mars" },
      ],
      correctOrder: ["sample-q4-r1", "sample-q4-r2", "sample-q4-r3", "sample-q4-r4"],
    },
  ],
};
