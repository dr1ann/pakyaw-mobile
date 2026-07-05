import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, shadow, spacing } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export type CompassModeToggleProps = {
  readonly visible: boolean;
};

// Google Maps-style Compass Mode toggle. Default OFF → GPS Course drives the
// arrow and camera heading. When ON, the magnetometer takes over as the
// stationary-fallback source (useDriverHeading subscribes/unsubscribes on the
// same flag so mid-drive toggling switches heading behavior immediately).
export function CompassModeToggle({ visible }: CompassModeToggleProps) {
  const compassEnabled = useActiveTripStore((s) => s.compassEnabled);
  const setCompassEnabled = useActiveTripStore((s) => s.setCompassEnabled);

  if (!visible) return null;

  const iconColor = compassEnabled ? colors.white : colors.ink[900];

  return (
    <TouchableOpacity
      style={[styles.button, compassEnabled && styles.buttonActive]}
      onPress={() => setCompassEnabled(!compassEnabled)}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: compassEnabled }}
      accessibilityLabel={
        compassEnabled ? 'Disable compass mode' : 'Enable compass mode'
      }
      testID="compass-mode-toggle"
    >
      <SymbolIcon name="safari" size={16} tintColor={iconColor} />
      <Text style={[styles.text, compassEnabled && styles.textActive]}>
        Compass {compassEnabled ? 'On' : 'Off'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...shadow.float,
    zIndex: 1000,
    marginBottom: spacing[2],
  },
  buttonActive: {
    backgroundColor: colors.violet.primary,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
    marginLeft: 8,
  },
  textActive: {
    color: colors.white,
  },
});
