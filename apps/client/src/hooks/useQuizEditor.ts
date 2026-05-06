import { useState } from "react";
import {
  createEmptyNumberQuestion,
  createEmptyPollQuestion,
  createEmptyQuestion,
  createEmptyRankingQuestion,
  createStarterQuiz,
  type QuestionType,
  type QuizDraft,
} from "@quizgame/contracts";
import { SAMPLE_HOST_NAME, SAMPLE_QUIZ } from "../devSampleQuiz";

const QUESTION_ID_PATTERN = /^question-(\d+)$/;

const getNextQuestionSeed = (quiz: QuizDraft) =>
  quiz.questions.reduce((highestSeed, question) => {
    const match = QUESTION_ID_PATTERN.exec(question.id);
    const numericId = match ? Number(match[1]) : 0;

    return Math.max(highestSeed, numericId);
  }, 0);

const getQuestionSeed = (questionId: string) => {
  const match = QUESTION_ID_PATTERN.exec(questionId);
  return match ? Math.max(Number(match[1]) - 1, 0) : 0;
};

const createEmptyQuestionByType = (type: QuestionType, seed: number) => {
  switch (type) {
    case "multiple-choice":
      return createEmptyQuestion(seed);
    case "poll":
      return createEmptyPollQuestion(seed);
    case "number":
      return createEmptyNumberQuestion(seed);
    case "ranking":
      return createEmptyRankingQuestion(seed);
  }
};

const updateOptionText = (
  quiz: QuizDraft,
  questionIndex: number,
  optionIndex: number,
  text: string,
): QuizDraft => ({
  ...quiz,
  questions: quiz.questions.map((question, index) =>
    index === questionIndex && (question.type === "multiple-choice" || question.type === "poll")
      ? {
          ...question,
          options: question.options.map((option, innerIndex) =>
            innerIndex === optionIndex ? { ...option, text } : option,
          ),
        }
      : question,
  ),
});

export interface QuizEditor {
  quiz: QuizDraft;
  setQuiz: React.Dispatch<React.SetStateAction<QuizDraft>>;
  hostName: string;
  setHostName: React.Dispatch<React.SetStateAction<string>>;
  selectedQuestionIndex: number;
  setSelectedQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  updateQuizTitle: (title: string) => void;
  updateTimeLimit: (timeLimit: number) => void;
  updateQuestionPrompt: (questionIndex: number, prompt: string) => void;
  updateQuestionType: (questionIndex: number, type: QuestionType) => void;
  updateQuestionOption: (questionIndex: number, optionIndex: number, text: string) => void;
  updatePollOption: (questionIndex: number, optionIndex: number, text: string) => void;
  updateNumberField: (
    questionIndex: number,
    field: "correctNumber" | "minValue" | "maxValue",
    value: number,
  ) => void;
  updateRankingItem: (questionIndex: number, itemIndex: number, text: string) => void;
  addRankingItem: (questionIndex: number) => void;
  removeRankingItem: (questionIndex: number, itemIndex: number) => void;
  setCorrectOption: (questionIndex: number, optionId: string) => void;
  addQuestion: () => void;
  removeQuestion: (questionId: string) => void;
  loadSampleQuiz: () => void;
}

export function useQuizEditor(): QuizEditor {
  const [hostName, setHostName] = useState("");
  const [quiz, setQuiz] = useState<QuizDraft>(createStarterQuiz());
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  const updateQuizTitle = (title: string) => {
    setQuiz((current) => ({ ...current, title }));
  };

  const updateTimeLimit = (timeLimit: number) => {
    setQuiz((current) => ({ ...current, timeLimit }));
  };

  const updateQuestionPrompt = (questionIndex: number, prompt: string) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? { ...question, prompt } : question,
      ),
    }));
  };

  const updateQuestionType = (questionIndex: number, type: QuestionType) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) => {
        if (index !== questionIndex) {
          return question;
        }

        const seed = getQuestionSeed(question.id);
        const freshQuestion = createEmptyQuestionByType(type, seed);
        return { ...freshQuestion, id: question.id, prompt: question.prompt };
      }),
    }));
  };

  const updateQuestionOption = (
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) => {
    setQuiz((current) => updateOptionText(current, questionIndex, optionIndex, text));
  };

  const updatePollOption = (
    questionIndex: number,
    optionIndex: number,
    text: string,
  ) => {
    setQuiz((current) => updateOptionText(current, questionIndex, optionIndex, text));
  };

  const updateNumberField = (
    questionIndex: number,
    field: "correctNumber" | "minValue" | "maxValue",
    value: number,
  ) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex && question.type === "number"
          ? { ...question, [field]: value }
          : question,
      ),
    }));
  };

  const updateRankingItem = (
    questionIndex: number,
    itemIndex: number,
    text: string,
  ) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex && question.type === "ranking"
          ? {
              ...question,
              items: question.items.map((item, innerIndex) =>
                innerIndex === itemIndex ? { ...item, text } : item,
              ),
            }
          : question,
      ),
    }));
  };

  const addRankingItem = (questionIndex: number) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) => {
        if (index !== questionIndex || question.type !== "ranking" || question.items.length >= 5) {
          return question;
        }

        const seed = getQuestionSeed(question.id) + 1;
        const nextItemNumber = question.items.length + 1;
        const nextId = `q${seed}-r${nextItemNumber}`;

        return {
          ...question,
          items: [...question.items, { id: nextId, text: "" }],
          correctOrder: [...question.correctOrder, nextId],
        };
      }),
    }));
  };

  const removeRankingItem = (questionIndex: number, itemIndex: number) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) => {
        if (index !== questionIndex || question.type !== "ranking" || question.items.length <= 3) {
          return question;
        }

        const removedItem = question.items[itemIndex];
        if (!removedItem) {
          return question;
        }

        return {
          ...question,
          items: question.items.filter((_, innerIndex) => innerIndex !== itemIndex),
          correctOrder: question.correctOrder.filter((itemId) => itemId !== removedItem.id),
        };
      }),
    }));
  };

  const setCorrectOption = (questionIndex: number, optionId: string) => {
    setQuiz((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex && question.type === "multiple-choice"
          ? { ...question, correctOptionId: optionId }
          : question,
      ),
    }));
  };

  const addQuestion = () => {
    setSelectedQuestionIndex(quiz.questions.length);
    setQuiz((current) => ({
      ...current,
      questions: [
        ...current.questions,
        createEmptyQuestion(getNextQuestionSeed(current)),
      ],
    }));
  };

  const removeQuestion = (questionId: string) => {
    const removedIndex = quiz.questions.findIndex(
      (question) => question.id === questionId,
    );

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

    if (removedIndex >= 0) {
      setSelectedQuestionIndex((current) => {
        if (current > removedIndex) {
          return current - 1;
        }

        return Math.min(current, quiz.questions.length - 2);
      });
    }
  };

  const loadSampleQuiz = () => {
    setHostName(SAMPLE_HOST_NAME);
    setQuiz(SAMPLE_QUIZ);
    setSelectedQuestionIndex(0);
  };

  return {
    quiz,
    setQuiz,
    hostName,
    setHostName,
    selectedQuestionIndex,
    setSelectedQuestionIndex,
    updateQuizTitle,
    updateTimeLimit,
    updateQuestionPrompt,
    updateQuestionType,
    updateQuestionOption,
    updatePollOption,
    updateNumberField,
    updateRankingItem,
    addRankingItem,
    removeRankingItem,
    setCorrectOption,
    addQuestion,
    removeQuestion,
    loadSampleQuiz,
  };
}
