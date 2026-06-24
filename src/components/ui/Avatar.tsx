import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, typography } from '@/constants/theme';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarTone = 'blue' | 'green' | 'amber' | 'violet' | 'neutral';

export type AvatarProps = {
  name?: string;
  initials?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: typography.size.bodySmall },
  md: { box: 44, font: typography.size.bodyMd },
  lg: { box: 56, font: typography.size.h3 },
  xl: { box: 72, font: typography.size.h2 },
};

const TONES: Record<AvatarTone, { bg: string; fg: string }> = {
  blue: { bg: colors.blue.primary, fg: colors.white },
  green: { bg: colors.green.primary, fg: colors.white },
  amber: { bg: colors.amber.primary, fg: colors.white },
  violet: { bg: colors.violet.primary, fg: colors.white },
  neutral: { bg: colors.ink[500], fg: colors.white },
};

function computeInitials(name?: string, initials?: string): string {
  if (initials && initials.length > 0) return initials.slice(0, 2).toUpperCase();
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  initials,
  size = 'md',
  tone = 'blue',
  style,
}: AvatarProps) {
  const dims = SIZES[size];
  const palette = TONES[tone];
  const label = computeInitials(name, initials);

  return (
    <View
      style={[
        styles.base,
        {
          width: dims.box,
          height: dims.box,
          borderRadius: dims.box / 2,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={name ? `Avatar for ${name}` : 'Avatar'}
    >
      <Text
        style={[
          styles.label,
          {
            color: palette.fg,
            fontSize: dims.font,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: typography.weight.bold,
    letterSpacing: 0.5,
  },
});
