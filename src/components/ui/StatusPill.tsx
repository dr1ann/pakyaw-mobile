import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export type StatusPillTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'amber'
  | 'violet';

export type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
  dot?: boolean;
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<StatusPillTone, { bg: string; fg: string }> = {
  info: { bg: colors.blue.tint, fg: colors.blue.primary },
  success: { bg: colors.green.tint, fg: colors.success },
  warning: { bg: colors.amber.tint, fg: colors.warning },
  danger: { bg: '#FDECEC', fg: colors.danger },
  neutral: { bg: colors.surface.muted, fg: colors.ink[500] },
  amber: { bg: colors.amber.tint, fg: colors.amber.deep },
  violet: { bg: colors.violet.tint, fg: colors.violet.primary },
};

export function StatusPill({
  label,
  tone = 'neutral',
  dot = false,
  uppercase = true,
  style,
}: StatusPillProps) {
  const palette = TONES[tone];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text
        style={[
          styles.label,
          uppercase && styles.uppercase,
          { color: palette.fg },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[1],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
});
