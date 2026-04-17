/** Typography tokens — font sizes and weights used throughout the UI. */

export const fontSizes = {
  xs: 12,
  sm: 13,
  body: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  heading: 22,
  hero: 26,
  title: 34,
  display: 42,
  logo: 48,
  heroEmoji: 52,
} as const;

export const fontWeights = {
  normal: "400" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};
