import React from 'react';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { MapActionButton } from '@pakyaw/shared/components/ui/MapActionButton';

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
    <MapActionButton
      icon={<SymbolIcon name="safari" size={16} tintColor={iconColor} />}
      label={`Compass ${compassEnabled ? 'On' : 'Off'}`}
      active={compassEnabled}
      activeColor={colors.violet.primary}
      onPress={() => setCompassEnabled(!compassEnabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: compassEnabled }}
      accessibilityLabel={
        compassEnabled ? 'Disable compass mode' : 'Enable compass mode'
      }
      testID="compass-mode-toggle"
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    marginBottom: spacing[2],
  },
});
