import { StyleSheet } from "react-native";
import { colors, spacing, fontSizes, fontWeights, radii, maxContentWidth } from "../theme";

/**
 * Shared styles for the entire app.
 *
 * Every value references a theme token so colours, spacing, and typography
 * can be updated in one place.
 */
export const styles = StyleSheet.create({
  /* ── Layout ── */
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scrollContent: {
    padding: spacing.page,
    gap: spacing.xxxl,
    maxWidth: maxContentWidth,
    width: "100%",
    alignSelf: "center",
  },

  /* ── Header ── */
  headerContainer: {
    alignItems: "center",
    gap: spacing.xxs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
    textAlign: "center",
  },

  /* ── Status chip ── */
  statusChip: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  statusChipConnected: {
    backgroundColor: colors.success,
  },
  statusChipDisconnected: {
    backgroundColor: colors.error,
  },
  statusChipText: {
    color: colors.textWhite,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },

  /* ── Feedback banner ── */
  feedbackBanner: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xl,
  },
  feedbackSuccess: {
    backgroundColor: colors.successDark,
  },
  feedbackError: {
    backgroundColor: colors.error,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
  },

  /* ── Hero card (join-code / join-name screens) ── */
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.heroCard,
    borderWidth: 1,
    gap: spacing.xl,
    padding: spacing.heroCardPadding,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    textAlign: "center",
    lineHeight: 22,
  },
  codeInput: {
    backgroundColor: colors.bgBase,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 2,
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 8,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxxl,
    textAlign: "center",
    width: "100%",
  },
  nameInput: {
    backgroundColor: colors.bgBase,
    borderColor: colors.borderInput,
    borderRadius: radii.lg,
    borderWidth: 2,
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.semibold,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxl,
    textAlign: "center",
    width: "100%",
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* ── Room info badge (join-name screen) ── */
  roomInfoBadge: {
    alignItems: "center",
    backgroundColor: colors.bgPurpleDark,
    borderRadius: radii.xl,
    gap: spacing.xs,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.xxl,
    width: "100%",
  },
  roomInfoTitle: {
    color: colors.textPurple,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  roomInfoDetail: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },

  /* ── Buttons ── */
  bigButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.sectionPadding,
    paddingVertical: spacing.xxxl,
    width: "100%",
  },
  bigButtonText: {
    color: colors.textWhite,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
  },
  secondaryBigButton: {
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.sectionPadding,
    paddingVertical: spacing.xxxl,
    width: "100%",
  },
  secondaryBigButtonText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
  },
  answeredButton: {
    alignItems: "center",
    backgroundColor: colors.success,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.sectionPadding,
    paddingVertical: spacing.xxxl,
    width: "100%",
  },
  disabledButton: {
    opacity: 0.45,
  },
  hostLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  hostLinkText: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  backLinkText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },

  /* ── Card ── */
  card: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xl,
    padding: spacing.xxxl,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
  },

  /* ── Input ── */
  input: {
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  /* ── Host setup / editor ── */
  editorHeader: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  editorTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading + 2,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  editorSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    textAlign: "center",
  },
  editorQuestionCard: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xxxl,
  },
  editorQuestionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editorQuestionBadge: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  editorQuestionBadgeText: {
    color: colors.textWhite,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.extrabold,
  },
  removeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  removeButtonText: {
    color: colors.errorBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  editorOptionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
  },
  editorOptionInput: {
    flex: 1,
  },
  editorOptionHint: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    textAlign: "center",
  },
  correctPicker: {
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  correctPickerText: {
    color: colors.textWhite,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.extrabold,
  },
  addQuestionButton: {
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderStyle: "dashed",
    borderWidth: 2,
    paddingVertical: spacing.xxxl,
  },
  addQuestionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  issueCard: {
    backgroundColor: colors.bgErrorDark,
    borderColor: colors.error,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  issueText: {
    color: colors.textErrorLight,
    fontSize: fontSizes.body,
  },

  /* ── Game header ── */
  gameHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  gameHeaderInfo: {
    flex: 1,
  },
  gameTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.extrabold,
  },
  gameSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    marginTop: spacing.xxs,
  },

  /* ── Host controls ── */
  hostControlsCard: {
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xl,
    padding: spacing.page,
  },
  controlsHint: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  controlsMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  bigRoomCode: {
    color: colors.accent,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 6,
    textAlign: "center",
  },

  /* ── Player waiting ── */
  waitingCard: {
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.sectionPadding,
  },
  waitingText: {
    color: colors.textLight,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
  },

  /* ── Question ── */
  questionCard: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xxl,
    padding: spacing.page,
  },
  questionBadge: {
    alignSelf: "center",
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xs,
  },
  questionBadgeText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  questionPrompt: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: 30,
    textAlign: "center",
  },
  optionsGrid: {
    gap: spacing.lg,
  },
  optionButton: {
    alignItems: "center",
    borderRadius: radii.xl,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing.xl,
    padding: spacing.xxxl,
  },
  optionIcon: {
    color: colors.textWhite,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    width: 28,
    textAlign: "center",
  },
  optionText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  optionTextSelected: {
    fontWeight: fontWeights.extrabold,
  },

  /* ── Winner ── */
  winnerCard: {
    alignItems: "center",
    backgroundColor: colors.bgPurpleDark,
    borderRadius: radii.xxl,
    gap: spacing.xs,
    padding: spacing.page,
  },
  winnerEmoji: {
    fontSize: 44,
  },
  winnerName: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: fontWeights.extrabold,
  },
  winnerScore: {
    color: colors.textPurpleLight,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
    textAlign: "center",
    paddingVertical: spacing.md,
  },

  /* ── Leaderboard ── */
  leaderboardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  leaderboardRowFirst: {
    backgroundColor: colors.bgPurpleDark,
    borderRadius: radii.md,
    marginHorizontal: -4,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  leaderboardLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
  },
  leaderboardRank: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    width: 32,
    textAlign: "center",
  },
  leaderboardName: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  leaderboardNameFirst: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
  },
  leaderboardScore: {
    color: colors.textPurple,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
  },
  leaderboardScoreFirst: {
    fontSize: fontSizes.heading,
    color: colors.textPurpleBright,
  },
  playerMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xxs,
  },
});
