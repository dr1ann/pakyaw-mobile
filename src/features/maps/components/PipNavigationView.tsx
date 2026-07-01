import { StyleSheet, Text, View } from 'react-native';

import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { colors, shadow } from '@/constants/theme';
import { getManeuverIconName } from '@/features/maps/navigation/maneuverIcon';
import type { NavStep } from '@/features/maps/navigation/types';

export type PipNavigationViewProps = {
  readonly currentStep: NavStep | null;
  readonly distanceToManeuver: number;
  readonly etaSeconds: number | null;
};

export function PipNavigationView({
  currentStep,
  distanceToManeuver,
  etaSeconds,
}: PipNavigationViewProps) {
  const iconName = getManeuverIconName(currentStep?.maneuver ?? null);
  const primaryText = currentStep?.roadName || currentStep?.instruction || 'Continue';

  return (
    <View pointerEvents="none" style={[styles.container, shadow.float]}>
      <View style={styles.iconBox}>
        <SymbolIcon name={iconName} size={28} tintColor={colors.white} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.distance} numberOfLines={1}>
          {formatMeters(distanceToManeuver)}
        </Text>
        <Text style={styles.instruction} numberOfLines={1}>
          {primaryText}
        </Text>
      </View>
      <View style={styles.etaBox}>
        <Text style={styles.eta} numberOfLines={1}>
          {formatEta(etaSeconds)}
        </Text>
      </View>
    </View>
  );
}

function formatMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '0 m';
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return '--';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.ink[900],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.ink[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  distance: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  instruction: {
    color: colors.ink[400],
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  etaBox: {
    minWidth: 48,
    alignItems: 'flex-end',
  },
  eta: {
    color: colors.green.primary,
    fontSize: 14,
    fontWeight: '800',
  },
});
