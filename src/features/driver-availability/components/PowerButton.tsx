/**
 * PowerButton — driver online/offline toggle.
 *
 * Uses a single onPress callback — the label and colour communicate the
 * resulting state (green = "go online", red = "go offline").
 *
 * The caller decides what happens on press; this component is presentation-only.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';

type PowerButtonProps = {
  /** Current availability state — determines colour, label, and loading text. */
  isOnline: boolean;
  onPress: () => void;
  loading?: boolean;
};

export function PowerButton({
  isOnline,
  onPress,
  loading = false,
}: PowerButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
      accessibilityState={{ disabled: loading, busy: loading }}
      accessibilityHint={
        isOnline
          ? 'Double-tap to stop accepting rides'
          : 'Double-tap to open the pre-flight checklist'
      }
      onPress={loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        isOnline ? styles.online : styles.offline,
        pressed && !loading && styles.pressed,
        loading && styles.loading,
      ]}
      testID="power-button"
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <SymbolIcon name="power" size={18} tintColor={colors.white} />
        )}
        <Text style={styles.label}>
          {loading
            ? isOnline
              ? 'Going offline…'
              : 'Going online…'
            : isOnline
              ? 'Go Offline'
              : 'Go Online'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignSelf: 'stretch',
  },
  offline: {
    backgroundColor: colors.green.primary,
  },
  online: {
    backgroundColor: colors.danger,
  },
  loading: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  label: {
    color: colors.white,
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    letterSpacing: 0.2,
  },
});
