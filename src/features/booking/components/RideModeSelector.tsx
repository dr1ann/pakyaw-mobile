import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { BookingRideSelection } from '../types';

type RideModeSelectorProps = {
  readonly selectedMode: BookingRideSelection;
  readonly onSelectMode: (mode: BookingRideSelection) => void;
};

type ModeConfig = {
  id: BookingRideSelection;
  name: string;
  subtitle: string;
  icon: string;
  accessibilityLabel: string;
};

const MODES: readonly ModeConfig[] = [
  {
    id: 'private',
    name: 'Pakyaw',
    subtitle: 'Private',
    icon: 'car.fill',
    accessibilityLabel: 'Pakyaw, Private ride',
  },
  {
    id: 'shared',
    name: 'Shared',
    subtitle: 'Pay per seat',
    icon: 'person.2.fill',
    accessibilityLabel: 'Shared, Pay per seat ride',
  },
];

export function RideModeSelector({ selectedMode, onSelectMode }: RideModeSelectorProps) {
  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel="Ride mode selection"
    >
      {MODES.map((mode) => {
        const isSelected = selectedMode === mode.id;

        return (
          <Pressable
            key={mode.id}
            onPress={() => onSelectMode(mode.id)}
            style={({ pressed }) => [
              styles.tab,
              isSelected && styles.tabActive,
              pressed && !isSelected && styles.tabPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${mode.name}, ${mode.subtitle}${isSelected ? ', selected' : ''}`}
            testID={`ride-mode-tab-${mode.id}`}
          >
            <View style={[styles.iconWrapper, isSelected && styles.iconWrapperActive]}>
              <SymbolIcon
                name={mode.icon}
                size={18}
                tintColor={isSelected ? colors.white : colors.ink[500]}
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.name, isSelected && styles.nameActive]}>
                {mode.name}
              </Text>
              <Text
                style={[styles.subtitle, isSelected && styles.subtitleActive]}
                numberOfLines={1}
              >
                {mode.subtitle}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    padding: spacing[1],
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    gap: spacing[1],
  },
  tab: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: colors.blue.primary,
    borderColor: colors.blue.primary,
    ...shadow.card,
  },
  tabPressed: {
    backgroundColor: colors.surface.card,
    opacity: 0.85,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  textContainer: {
    alignItems: 'center',
  },
  name: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    lineHeight: 16,
  },
  nameActive: {
    color: colors.white,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: typography.weight.medium,
    color: colors.ink[500],
    lineHeight: 12,
    marginTop: 1,
  },
  subtitleActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
