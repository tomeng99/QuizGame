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

  /* ── Dev helper button ── */
  devButton: {
    alignItems: "center",
    borderColor: colors.optionOrange,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.sectionPadding,
    paddingVertical: spacing.xl,
    width: "100%",
  },
  devButtonText: {
    color: colors.optionOrange,
    fontSize: fontSizes.body,
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
  editorBasicsCard: {
    gap: spacing.xxl,
  },
  editorOverviewCard: {
    gap: spacing.xxl,
  },
  editorSectionHeader: {
    gap: spacing.sm,
  },
  editorSectionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 20,
  },
  editorOverviewHeader: {
    gap: spacing.xl,
  },
  editorStatsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  editorStatPill: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.xl,
    flex: 1,
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
  },
  editorStatValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
  },
  editorStatLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  editorQuestionTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  editorQuestionTab: {
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.xxs,
    minWidth: 84,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  editorQuestionTabActive: {
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
  },
  editorQuestionTabTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  editorQuestionTabTitleActive: {
    color: colors.textPurpleLight,
  },
  editorQuestionTabMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  editorQuestionTabMetaActive: {
    color: colors.textPurple,
  },
  editorQuestionCard: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCard,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.xxl,
    padding: spacing.page,
  },
  questionTypeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  questionTypePill: {
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  questionTypePillActive: {
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
  },
  questionTypePillText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  questionTypePillTextActive: {
    color: colors.textPurpleLight,
  },
  editorQuestionHeader: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  editorQuestionHeading: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xl,
  },
  editorQuestionBadge: {
    backgroundColor: colors.accent,
    alignSelf: "flex-start",
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  editorQuestionBadgeText: {
    color: colors.textWhite,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.extrabold,
  },
  editorQuestionHeaderText: {
    flex: 1,
    gap: spacing.xxs,
  },
  editorQuestionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
  },
  editorQuestionDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: 20,
  },
  removeButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgInput,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  removeButtonText: {
    color: colors.errorBright,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  editorOptionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xl,
  },
  editorOptionHint: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    textAlign: "right",
  },
  editorOptionCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  editorOptionBadge: {
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  editorOptionBadgeText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
  },
  editorOptionContent: {
    flex: 1,
    gap: spacing.md,
  },
  editorOptionInputText: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    paddingVertical: spacing.xs,
  },
  correctToggle: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  correctToggleActive: {
    backgroundColor: colors.success,
  },
  correctToggleText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  correctToggleTextActive: {
    color: colors.textWhite,
  },
  editorNumberGrid: {
    gap: spacing.lg,
  },
  editorNumberField: {
    gap: spacing.xs,
  },
  rankingEditorItemCard: {
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  rankingEditorItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rankingEditorItemNumber: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  rankingEditorRemoveButton: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  rankingEditorRemoveButtonText: {
    color: colors.errorBright,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  addQuestionButton: {
    alignItems: "center",
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingVertical: spacing.sectionPadding,
  },
  addQuestionInlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sectionPadding,
    paddingVertical: spacing.xl,
  },
  addQuestionInlineText: {
    color: colors.textPurpleLight,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  addQuestionText: {
    color: colors.textPurpleLight,
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
  issueTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
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
  qrPanel: {
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
  },
  qrFrame: {
    backgroundColor: colors.textWhite,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
  qrImage: {
    height: 220,
    width: 220,
  },
  qrCaption: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  joinUrlText: {
    color: colors.textPurpleLight,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
    width: "100%",
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
  optionContent: {
    flex: 1,
    gap: spacing.md,
  },
  optionText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  pollResultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  pollResultTrack: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    flex: 1,
    height: 8,
    overflow: "hidden",
  },
  pollResultFill: {
    backgroundColor: colors.successBright,
    borderRadius: radii.full,
    height: "100%",
  },
  pollResultCount: {
    color: colors.textLight,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    minWidth: 20,
    textAlign: "right",
  },
  optionTextSelected: {
    fontWeight: fontWeights.extrabold,
  },

  /* ── Countdown timer ── */
  timerBar: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bgSurface,
    overflow: "hidden",
  },
  timerBarFill: {
    height: "100%",
    borderRadius: radii.full,
  },
  timerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    minWidth: 36,
    textAlign: "right",
  },

  /* ── Answer result (shown after submitting) ── */
  answerResultCard: {
    alignItems: "center",
    borderRadius: radii.xl,
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  answerResultCorrect: {
    backgroundColor: `${colors.successBright}22`,
    borderColor: colors.successBright,
    borderWidth: 1,
  },
  answerResultWrong: {
    backgroundColor: `${colors.errorBright}18`,
    borderColor: colors.errorBright,
    borderWidth: 1,
  },
  answerResultPending: {
    backgroundColor: `${colors.accent}18`,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  answerResultEmoji: {
    fontSize: 28,
  },
  answerResultText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  answerResultPoints: {
    color: colors.textPurpleLight,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
  },
  answerResultStreak: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },

  /* ── Time limit picker (host setup) ── */
  timeLimitRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  timeLimitOption: {
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.full,
    borderWidth: 1,
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  timeLimitOptionActive: {
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
  },
  timeLimitOptionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
  },
  timeLimitOptionTextActive: {
    color: colors.textPurpleLight,
  },

  revealCard: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  revealLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  revealValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  revealSubtext: {
    color: colors.textPurpleLight,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: "center",
  },
  revealListItem: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  sliderQuestionCard: {
    gap: spacing.lg,
  },
  sliderQuestionValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.extrabold,
    textAlign: "center",
  },
  sliderQuestionLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderQuestionLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  sliderTrack: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    height: 28,
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
  },
  sliderTrackFill: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    height: "100%",
  },
  sliderThumb: {
    backgroundColor: colors.textWhite,
    borderColor: colors.accent,
    borderRadius: radii.full,
    borderWidth: 3,
    height: 28,
    marginLeft: -14,
    position: "absolute",
    top: 0,
    width: 28,
  },
  sliderQuestionHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  rankingQuestionCard: {
    gap: spacing.lg,
  },
  rankingQuestionTitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  rankingQuestionList: {
    gap: spacing.md,
  },
  rankingChoiceCard: {
    alignItems: "center",
    backgroundColor: colors.bgInput,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  rankingChoiceCardSelected: {
    backgroundColor: colors.bgPurpleDark,
    borderColor: colors.accent,
  },
  rankingChoiceCardDisabled: {
    opacity: 0.8,
  },
  rankingChoiceBadge: {
    alignItems: "center",
    backgroundColor: colors.bgSurface,
    borderRadius: radii.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rankingChoiceBadgeText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.extrabold,
  },
  rankingChoiceText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
  },
  rankingSelectedCard: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xxl,
  },
  rankingSelectedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rankingSelectedTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
  },
  rankingSelectedHint: {
    color: colors.textMuted,
    fontSize: fontSizes.body,
  },
  rankingSelectedItem: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
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

  /* ── Streak indicator ── */
  streakBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${colors.optionOrange}22`,
    borderColor: `${colors.optionOrange}66`,
    borderRadius: radii.full,
    borderWidth: 1,
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  streakBadgeText: {
    color: colors.optionOrange,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },

  /* ── Score delta ── */
  scoreDelta: {
    color: colors.successBright,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    textAlign: "right",
  },
  scoreDeltaZero: {
    color: colors.textMuted,
  },

  /* ── Small icon helpers ── */
  optionRevealIcon: {
    fontSize: 18,
  },
  scoreColumn: {
    alignItems: "flex-end" as const,
  },
});
