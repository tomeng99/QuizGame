/** Spacing & sizing scale used across the entire app. */

export const spacing = {
  /** 2px */
  xxs: 2,
  /** 4px */
  xs: 4,
  /** 6px */
  sm: 6,
  /** 8px */
  md: 8,
  /** 10px */
  lg: 10,
  /** 12px */
  xl: 12,
  /** 14px */
  xxl: 14,
  /** 16px */
  xxxl: 16,
  /** 20px */
  page: 20,
  /** 24px */
  sectionPadding: 24,
  /** 28px */
  heroCardPadding: 28,
} as const;

export const maxContentWidth = 480;

/**
 * Viewport width at which the host's game screen switches to the presentation ("stage")
 * layout. Below this the phone layout is the right one — including for a host running the
 * game from their own phone.
 */
export const stageMinWidth = 900;

/** Content width for the stage layout, so text still wraps at a readable line length. */
export const stageContentWidth = 1120;
