import { useState } from "react";
import { createEmptyQuestion, createStarterQuiz, type QuizDraft } from "@quizgame/contracts";

export interface QuizEditor {
  quiz: QuizDraft;
  setQuiz: React.Dispatch<React.SetStateAction<QuizDraft>>;
  hostName: string;
  setHostName: React.Dispatch<React.SetStateAction<string>>;
  updateQuestionPrompt: (questionIndex: number, prompt: string) => void;
  updateQuestionOption: (questionIndex: number, optionIndex: number, text: string) => void;
  setCorrectOption: (questionIndex: number, optionId: string) => void;
  addQuestion: () => void;
  removeQuestion: (questionId: string) => void;
}

export function useQuizEditor(): QuizEditor {
  const [hostName, setHostName] = useState("Quiz Host");
  const [quiz, setQuiz] = useState<QuizDraft>(createStarterQuiz());

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

  return {
    quiz,
    setQuiz,
    hostName,
    setHostName,
    updateQuestionPrompt,
    updateQuestionOption,
    setCorrectOption,
    addQuestion,
    removeQuestion,
  };
}
