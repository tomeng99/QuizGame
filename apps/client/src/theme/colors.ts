/** Central color palette — the single source of truth for every color in the app. */

export const colors = {
  /* ── Backgrounds ── */
  bgBase: "#0f172a",
  bgCard: "#111827",
  bgSurface: "#1e293b",
  bgInput: "#1f2937",
  bgPurpleDark: "#1e1b4b",
  bgErrorDark: "#1c1017",

  /* ── Borders ── */
  borderCard: "#1f2937",
  borderInput: "#334155",

  /* ── Text ── */
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textLight: "#cbd5e1",
  textPurple: "#c4b5fd",
  textPurpleLight: "#ddd6fe",
  textPurpleBright: "#a78bfa",
  textErrorLight: "#fca5a5",
  textWhite: "#ffffff",

  /* ── Accent / brand ── */
  accent: "#8b5cf6",

  /* ── Semantic ── */
  success: "#065f46",
  successDark: "#14532d",
  error: "#7f1d1d",
  errorBright: "#ef4444",
  successBright: "#10b981",

  /* ── Answer-option themes ── */
  optionRed: "#e74c3c",
  optionBlue: "#3498db",
  optionOrange: "#f39c12",
  optionGreen: "#27ae60",
} as const;
