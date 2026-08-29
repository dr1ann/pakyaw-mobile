import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { BookingRideSelection } from '../types';

type RideModeSelectorProps = {
  readonly selectedMode: BookingRideSelection;
  readonly onSelectMode: (mode: BookingRideSelection) => void;
};

export function RideModeSelector({ selectedMode, onSelectMode }: RideModeSelectorProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onSelectMode('private')}
        style={[styles.tab, selectedMode === 'private' && styles.tabActive]}
      >
        <SymbolIcon
          name="car.fill"
          size={20}
          tintColor={selectedMode === 'private' ? colors.white : colors.ink[400]}
        />
        <Text style={[styles.label, selectedMode === 'private' && styles.labelActive]}>
          Private
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onSelectMode('shared')}
        style={[styles.tab, selectedMode === 'shared' && styles.tabActive]}
      >
        <SymbolIcon
          name="person.2.fill"
          size={20}
          tintColor={selectedMode === 'shared' ? colors.white : colors.ink[400]}
        />
        <Text style={[styles.label, selectedMode === 'shared' && styles.labelActive]}>
          Share Ride
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onSelectMode('hopon')}
        style={[styles.tab, selectedMode === 'hopon' && styles.tabActive]}
      >
        <SymbolIcon
          name="antenna.radiowaves.left.and.right"
          size={20}
          tintColor={selectedMode === 'hopon' ? colors.white : colors.ink[400]}
        />
        <Text style={[styles.label, selectedMode === 'hopon' && styles.labelActive]}>
          Hop-On
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[1],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    gap: spacing[2],
  },
  tabActive: {
    backgroundColor: colors.blue.primary,
    ...shadow.float,
  },
  label: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
  },
  labelActive: {
    color: colors.white,
  },
});
