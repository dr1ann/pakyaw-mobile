import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '@/constants/theme';
import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { getManeuverIconName } from '../navigation/maneuverIcon';
import type { NavStep } from '../navigation/types';

export type NavigationBannerProps = {
  readonly currentStep: NavStep | null;
  readonly distanceToManeuver: number;
};

export function NavigationBanner({
  currentStep,
  distanceToManeuver,
}: NavigationBannerProps) {
  const insets = useSafeAreaInsets();

  if (!currentStep) {
    return null;
  }

  const iconName = getManeuverIconName(currentStep.maneuver);
  const formattedDistance = formatMeters(distanceToManeuver);
  const primaryText = currentStep.roadName || currentStep.instruction;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} testID="navigation-banner">
      <View style={styles.iconWrapper}>
        <SymbolIcon name={iconName} size={32} tintColor={colors.white} />
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.distanceText}>{formattedDistance}</Text>
        <Text style={styles.instructionText} numberOfLines={2}>
          {primaryText}
        </Text>
      </View>
    </View>
  );
}

function formatMeters(meters: number): string {
  if (meters < 0) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.ink[900],
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.float,
    zIndex: 1000,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink[700],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  distanceText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink[400],
  },
});

