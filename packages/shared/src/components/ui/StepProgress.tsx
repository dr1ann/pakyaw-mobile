import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export type StepProgressTone = 'blue' | 'green' | 'violet' | 'amber';

export type StepProgressProps = {
  current: number;
  total: number;
  tone?: StepProgressTone;
  showLabel?: boolean;
  labelPosition?: 'above' | 'right';
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<StepProgressTone, string> = {
  blue: colors.blue.primary,
  green: colors.green.primary,
  violet: colors.violet.primary,
  amber: colors.amber.primary,
};

export function StepProgress({
  current,
  total,
  tone = 'blue',
  showLabel = true,
  labelPosition = 'above',
  style,
}: StepProgressProps) {
  const clampedTotal = Math.max(1, total);
  const clampedCurrent = Math.max(0, Math.min(current, clampedTotal));
  const pct = (clampedCurrent / clampedTotal) * 100;
  const labelText = `STEP ${clampedCurrent} OF ${clampedTotal}`;
  const fill = TONES[tone];

  if (labelPosition === 'right') {
    return (
      <View style={[styles.row, style]}>
        <View style={styles.trackWrapperFlex}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
          </View>
        </View>
        {showLabel ? (
          <Text style={styles.label}>
            {clampedCurrent}/{clampedTotal}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={style}>
      {showLabel ? <Text style={styles.labelAbove}>{labelText}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  trackWrapperFlex: {
    flex: 1,
  },
  track: {
    height: 6,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  labelAbove: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
    color: colors.ink[500],
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  label: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
  },
});
