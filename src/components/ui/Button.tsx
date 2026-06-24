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

type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    fullWidth && styles.fullWidth,
    variant === 'primary' ? styles.primary : styles.secondary,
    isInactive && styles.disabled,
    style,
  ];

  const labelColor = isInactive
    ? colors.ink[400]
    : variant === 'primary'
      ? colors.white
      : colors.blue.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      onPress={onPress}
      disabled={isInactive}
      style={({ pressed }) => [containerStyle, pressed && !isInactive && styles.pressed]}
      testID={testID}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={labelColor} />
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
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.blue.primary,
  },
  secondary: {
    backgroundColor: colors.blue.tint,
  },
  disabled: {
    backgroundColor: colors.surface.muted,
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
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.2,
  },
});
