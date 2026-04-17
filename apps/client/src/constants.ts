import { colors } from "./theme";

/** Visual themes for the four answer option slots. */
export const OPTION_THEMES = [
  { bg: colors.optionRed, icon: "\u25B2", label: "A" },
  { bg: colors.optionBlue, icon: "\u25C6", label: "B" },
  { bg: colors.optionOrange, icon: "\u25CF", label: "C" },
  { bg: colors.optionGreen, icon: "\u25A0", label: "D" },
] as const;

/** Medal emojis for the top-3 leaderboard positions. */
export const MEDALS = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"] as const;
