import { useState } from "react";
import { createEmptyQuestion, createStarterQuiz, type QuizDraft } from "@quizgame/contracts";
import { SAMPLE_HOST_NAME, SAMPLE_QUIZ } from "../devSampleQuiz";

const QUESTION_ID_PATTERN = /^question-(\d+)$/;

const getNextQuestionSeed = (quiz: QuizDraft) =>
  quiz.questions.reduce((highestSeed, question) => {
    const match = QUESTION_ID_PATTERN.exec(question.id);
    const numericId = match ? Number(match[1]) : 0;

    return Math.max(highestSeed, numericId);
  }, 0);

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
  updateQuestionOption: (questionIndex: number, optionIndex: number, text: string) => void;
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
    updateQuestionOption,
    setCorrectOption,
    addQuestion,
    removeQuestion,
    loadSampleQuiz,
  };
}
