import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';

const STEP_LABELS = ['Account', 'About you', 'Vehicle', 'Requirements', 'Review'] as const;

type OnboardingProgressHeaderProps = {
  readonly currentStep: number;
  readonly totalSteps?: number;
  readonly stepTitle: string;
  readonly onBack?: () => void;
  readonly canGoBack?: boolean;
  readonly saveStatus?: 'idle' | 'saving' | 'saved';
};

export function OnboardingProgressHeader({
  currentStep,
  totalSteps = 5,
  stepTitle,
  onBack,
  canGoBack = true,
  saveStatus = 'idle',
}: OnboardingProgressHeaderProps) {
  const { width } = useWindowDimensions();
  const showBreadcrumbs = width >= 380;
  const progressRatio = Math.min(Math.max(currentStep / totalSteps, 0), 1);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {onBack && canGoBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
          >
            <SymbolIcon name="arrow.left" size={20} tintColor={colors.ink[700]} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.appTitle}>Become a Pakyaw Driver</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <View style={styles.stepInfoRow}>
        <View style={styles.stepIndicatorCol}>
          <Text style={styles.stepIndicator}>
            Step {currentStep} of {totalSteps}
          </Text>
          {saveStatus === 'saving' ? (
            <Text style={styles.saveStatusSaving}>Saving</Text>
          ) : saveStatus === 'saved' ? (
            <Text style={styles.saveStatusSaved}>✓ Saved</Text>
          ) : null}
        </View>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
      </View>

      {/* Optional compact breadcrumbs for wide screens */}
      {showBreadcrumbs ? (
        <View style={styles.breadcrumbsRow}>
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <View key={label} style={styles.breadcrumbItem}>
                <Text
                  style={[
                    styles.breadcrumbText,
                    isCurrent && styles.breadcrumbTextCurrent,
                    isCompleted && styles.breadcrumbTextCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {idx < STEP_LABELS.length - 1 ? (
                  <Text style={styles.breadcrumbSeparator}>·</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 36,
    height: 36,
  },
  appTitle: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.ink[500],
    textAlign: 'center',
  },
  stepInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing[2],
  },
  stepIndicatorCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIndicator: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  saveStatusSaving: {
    fontSize: 11,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
  },
  saveStatusSaved: {
    fontSize: 11,
    fontFamily: typography.family.semibold,
    color: colors.green.primary,
  },
  stepTitle: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
  },
  breadcrumbsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[2],
    flexWrap: 'nowrap',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 11,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
  },
  breadcrumbTextCurrent: {
    color: colors.blue.primary,
    fontFamily: typography.family.bold,
  },
  breadcrumbTextCompleted: {
    color: colors.success,
  },
  breadcrumbSeparator: {
    marginHorizontal: 4,
    fontSize: 11,
    color: colors.ink[400],
  },
});
