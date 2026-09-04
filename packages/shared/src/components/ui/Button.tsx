import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonTone = 'default' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;
  const isDestructive = tone === 'destructive';

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
    fullWidth && styles.fullWidth,
    variant === 'primary' && (isDestructive ? styles.primaryDestructive : styles.primary),
    variant === 'secondary' && (isDestructive ? styles.secondaryDestructive : styles.secondary),
    variant === 'outline' && (isDestructive ? styles.outlineDestructive : styles.outline),
    variant === 'ghost' && (isDestructive ? styles.ghostDestructive : styles.ghost),
    isInactive && styles.disabled,
    style,
  ];

  let labelColor: string;
  if (isInactive) {
    labelColor = colors.ink[400];
  } else if (variant === 'primary') {
    labelColor = colors.white;
  } else if (isDestructive) {
    labelColor = colors.danger;
  } else if (variant === 'secondary') {
    labelColor = colors.blue.primary;
  } else if (variant === 'outline' || variant === 'ghost') {
    labelColor = colors.blue.primary;
  } else {
    labelColor = colors.ink[900];
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      onPress={onPress}
      disabled={isInactive}
      style={({ pressed }) => [containerStyle, pressed && !isInactive && styles.pressed]}
      testID={testID}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={labelColor} size="small" />
        ) : (
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeSm: {
    minHeight: 36,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  sizeMd: {
    minHeight: 48,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
  },
  sizeLg: {
    minHeight: 56,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.blue.primary,
  },
  primaryDestructive: {
    backgroundColor: colors.danger,
  },
  secondary: {
    backgroundColor: colors.blue.tint,
  },
  secondaryDestructive: {
    backgroundColor: colors.dangerSubtle,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.blue.primary,
  },
  outlineDestructive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostDestructive: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.surface.muted,
    borderColor: colors.border.subtle,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.button,
    fontFamily: typography.family.bold,
    letterSpacing: typography.letterSpacing.wide,
  },
});
