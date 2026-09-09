import { StyleSheet } from "react-native";
import { radii, spacing, stageContentWidth, stageFontSizes } from "../theme";

/**
 * Presentation ("stage") overrides for the host's game screen.
 *
 * Every other surface in this app is a phone held at arm's length, and the base stylesheet is
 * sized for that. The host's screen is the exception: it is usually a projector or a TV that
 * the whole room reads from several metres away, and at phone sizes the question, the
 * countdown and the scores are unreadable from the third row.
 *
 * Each key here layers on top of the matching key in `styles`, applied as
 * `[styles.x, isStage && stageStyles.x]`, and only when `useStageLayout` reports that the
 * client is a host with the screen width to use it. Nothing here reaches a player's phone,
 * and a host running the game from a phone stays on the base layout.
 */
export const stageStyles = StyleSheet.create({
  /* ── Layout ── */
  scrollContent: {
    gap: spacing.sectionPadding,
    maxWidth: stageContentWidth,
    padding: spacing.heroCardPadding,
  },

  /* ── Game header ── */
  gameTitle: {
    fontSize: stageFontSizes.heading,
  },
  gameSubtitle: {
    fontSize: stageFontSizes.meta,
  },

  /* ── Host controls ── */
  hostControlsCard: {
    padding: spacing.heroCardPadding,
  },
  controlsHint: {
    fontSize: stageFontSizes.heading,
  },
  controlsMeta: {
    fontSize: stageFontSizes.meta,
  },
  bigRoomCode: {
    fontSize: stageFontSizes.roomCode,
    letterSpacing: 12,
  },
  lobbyPanels: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.heroCardPadding,
  },
  lobbyPanel: {
    /* Beats the base `alignSelf: stretch`, so the shorter column sits beside the middle of
       the QR code rather than being stretched to its height with the text stranded at top. */
    alignSelf: "center",
    flex: 1,
  },
  qrCaption: {
    fontSize: stageFontSizes.meta,
  },
  joinUrlText: {
    fontSize: stageFontSizes.meta,
  },
  bigButtonText: {
    fontSize: stageFontSizes.label,
  },
  secondaryBigButtonText: {
    fontSize: stageFontSizes.label,
  },

  /* ── Question ── */
  questionCard: {
    gap: spacing.sectionPadding,
    padding: spacing.heroCardPadding,
  },
  questionBadgeText: {
    fontSize: stageFontSizes.meta,
  },
  questionPrompt: {
    fontSize: stageFontSizes.prompt,
    lineHeight: 56,
  },
  /* Two columns: four options stacked at stage size run off the bottom of the screen, and
     the host cannot scroll while the room is answering. Options grow to share the row, so an
     odd last option fills the width rather than leaving a gap. */
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xxxl,
  },
  optionButton: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    padding: spacing.sectionPadding,
  },
  optionIcon: {
    fontSize: stageFontSizes.heading,
    width: 48,
  },
  optionText: {
    fontSize: stageFontSizes.body,
  },
  optionRevealIcon: {
    fontSize: stageFontSizes.heading,
  },
  pollResultTrack: {
    height: 14,
  },
  pollResultCount: {
    fontSize: stageFontSizes.meta,
    minWidth: 40,
  },

  /* ── Countdown timer ── */
  timerBar: {
    height: 20,
  },
  timerLabel: {
    fontSize: stageFontSizes.timer,
    minWidth: 110,
  },

  /* ── Answer reveal ── */
  revealCard: {
    padding: spacing.heroCardPadding,
  },
  revealLabel: {
    fontSize: stageFontSizes.meta,
  },
  revealValue: {
    fontSize: stageFontSizes.display,
  },
  revealSubtext: {
    fontSize: stageFontSizes.label,
  },
  revealListItem: {
    fontSize: stageFontSizes.body,
  },

  /* ── Number question ── */
  sliderQuestionValue: {
    fontSize: stageFontSizes.display,
  },
  sliderQuestionLabel: {
    fontSize: stageFontSizes.meta,
  },
  sliderStepperButton: {
    height: 64,
    width: 64,
  },
  sliderStepperButtonText: {
    fontSize: stageFontSizes.heading,
  },
  sliderTrack: {
    height: 40,
  },
  sliderThumb: {
    height: 40,
    marginLeft: -20,
    width: 40,
  },
  sliderQuestionHint: {
    fontSize: stageFontSizes.meta,
  },

  /* ── Ranking question ── */
  rankingQuestionTitle: {
    fontSize: stageFontSizes.meta,
  },
  rankingChoiceCard: {
    padding: spacing.sectionPadding,
  },
  rankingChoiceBadge: {
    height: 48,
    width: 48,
  },
  rankingChoiceBadgeText: {
    fontSize: stageFontSizes.label,
  },
  rankingChoiceText: {
    fontSize: stageFontSizes.body,
  },
  rankingSelectedTitle: {
    fontSize: stageFontSizes.label,
  },
  rankingSelectedHint: {
    fontSize: stageFontSizes.meta,
  },
  rankingSelectedItem: {
    fontSize: stageFontSizes.body,
  },

  /* ── Winner ── */
  winnerCard: {
    padding: spacing.heroCardPadding,
  },
  winnerEmoji: {
    fontSize: 80,
  },
  winnerName: {
    fontSize: stageFontSizes.display,
  },
  winnerScore: {
    fontSize: stageFontSizes.label,
  },

  /* ── Post-game recap ── */
  summaryHardest: {
    fontSize: stageFontSizes.label,
    lineHeight: 34,
  },
  summaryRoundIndex: {
    fontSize: stageFontSizes.meta,
    minWidth: 44,
  },
  summaryRoundPrompt: {
    fontSize: stageFontSizes.label,
  },
  summaryRoundCount: {
    fontSize: stageFontSizes.meta,
    minWidth: 72,
  },
  summaryRoundTrack: {
    height: 10,
  },

  /* ── Leaderboard ── */
  card: {
    padding: spacing.heroCardPadding,
  },
  sectionTitle: {
    fontSize: stageFontSizes.heading,
  },
  emptyText: {
    fontSize: stageFontSizes.meta,
  },
  leaderboardRow: {
    paddingVertical: spacing.xl,
  },
  leaderboardRowFirst: {
    borderRadius: radii.xl,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxl,
  },
  leaderboardRank: {
    fontSize: stageFontSizes.heading,
    width: 56,
  },
  leaderboardName: {
    fontSize: stageFontSizes.body,
  },
  leaderboardNameFirst: {
    fontSize: stageFontSizes.heading,
  },
  leaderboardScore: {
    fontSize: stageFontSizes.heading,
  },
  leaderboardScoreFirst: {
    fontSize: stageFontSizes.prompt,
  },
  playerMeta: {
    fontSize: stageFontSizes.meta,
  },
  streakBadgeText: {
    fontSize: stageFontSizes.meta,
  },
  scoreDelta: {
    fontSize: stageFontSizes.label,
  },
});
