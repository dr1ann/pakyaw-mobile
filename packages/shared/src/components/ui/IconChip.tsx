import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';

export type IconChipTone = 'blue' | 'green' | 'amber' | 'violet' | 'neutral' | 'danger';
export type IconChipSize = 'sm' | 'md' | 'lg';

export type IconChipProps = {
  children: ReactNode;
  tone?: IconChipTone;
  size?: IconChipSize;
  rounded?: 'sm' | 'md' | 'pill';
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<IconChipTone, string> = {
  blue: colors.blue.tint,
  green: colors.green.tint,
  amber: colors.amber.tint,
  violet: colors.violet.tint,
  neutral: colors.surface.muted,
  danger: colors.dangerSubtle,
};

const SIZES: Record<IconChipSize, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

export const iconChipForegroundColor: Record<IconChipTone, string> = {
  blue: colors.blue.primary,
  green: colors.success,
  amber: colors.amber.deep,
  violet: colors.violet.primary,
  neutral: colors.ink[500],
  danger: colors.danger,
};

export function IconChip({
  children,
  tone = 'blue',
  size = 'md',
  rounded = 'sm',
  style,
}: IconChipProps) {
  const dimension = SIZES[size];
  const borderRadius =
    rounded === 'pill' ? radius.pill : rounded === 'md' ? radius.md : radius.sm;

  return (
    <View
      style={[
        styles.base,
        {
          width: dimension,
          height: dimension,
          backgroundColor: TONES[tone],
          borderRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
