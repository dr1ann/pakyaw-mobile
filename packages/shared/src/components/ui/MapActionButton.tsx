import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

export type MapActionButtonProps = {
  icon: ReactNode;
  label?: string;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function MapActionButton({
  icon,
  label,
  active = false,
  activeColor = colors.violet.primary,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  style,
}: MapActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        active && { backgroundColor: activeColor },
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? (accessibilityRole === 'switch' ? { checked: active } : undefined)}
      testID={testID}
    >
      <View style={styles.iconWrap}>{icon}</View>
      {label ? (
        <Text style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    ...shadow.float,
    zIndex: 1000,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
    marginLeft: spacing[2],
  },
  labelActive: {
    color: colors.white,
  },
});
