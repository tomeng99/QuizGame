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
} as const;

/**
 * Type scale for the host's presentation ("stage") layout.
 *
 * The scale above is sized for a phone held at arm's length. A host screen is a projector or
 * a TV read from the back of the room, so it needs its own scale rather than a multiplier —
 * the jumps are not uniform, and the countdown and the room code have to win over everything
 * else on the screen.
 */
export const stageFontSizes = {
  meta: 20,
  label: 24,
  body: 26,
  heading: 34,
  prompt: 44,
  timer: 48,
  display: 64,
  roomCode: 96,
} as const;

export const fontWeights = {
  normal: "400" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};
