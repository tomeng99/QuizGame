import type { QuizDraft, QuizQuestion } from "@quizgame/contracts";

export function isQuestionReady(question: QuizQuestion): boolean {
  if (!question.prompt.trim()) {
    return false;
  }

  switch (question.type) {
    case "multiple-choice":
    case "poll":
      return question.options.filter((option) => option.text.trim().length > 0).length >= 2;
    case "number":
      return question.minValue < question.maxValue;
    case "ranking":
      return (
        question.items.length >= 3 &&
        question.items.every((item) => item.text.trim().length > 0)
      );
  }
}

/** Validate a quiz draft and return a list of human-readable issues. */
export function validateQuiz(quiz: QuizDraft): string[] {
  const issues: string[] = [];

  if (!quiz.title.trim()) {
    issues.push("Add a quiz title.");
  }

  quiz.questions.forEach((question, index) => {
    if (!question.prompt.trim()) {
      issues.push(`Question ${index + 1} needs a prompt.`);
    }

    switch (question.type) {
      case "multiple-choice":
      case "poll": {
        const filledOptions = question.options.filter(
          (option) => option.text.trim().length > 0,
        );

        if (filledOptions.length < 2) {
          issues.push(`Question ${index + 1} needs at least two answer options.`);
        }
        break;
      }
      case "number": {
        if (question.minValue >= question.maxValue) {
          issues.push(`Question ${index + 1} needs a min value lower than the max value.`);
        }
        break;
      }
      case "ranking": {
        if (question.items.length < 3) {
          issues.push(`Question ${index + 1} needs at least three ranking items.`);
        }
        if (question.items.some((item) => !item.text.trim())) {
          issues.push(`Question ${index + 1} needs text for every ranking item.`);
        }
        break;
      }
    }
  });

  return issues;
}
