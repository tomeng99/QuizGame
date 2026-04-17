import type { QuizDraft } from "@quizgame/contracts";

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
