import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

export type FieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Field({ label, children, error, hint, style }: FieldProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View>{children}</View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  label: {
    fontSize: typography.size.label,
    fontFamily: typography.family.semibold,
    letterSpacing: typography.letterSpacing.label,
    color: colors.ink[700],
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  error: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    color: colors.danger,
  },
});
