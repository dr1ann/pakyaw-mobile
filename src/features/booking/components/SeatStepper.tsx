import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { MAX_SEATS, MIN_SEATS } from '@/lib/seatModel';

export type SeatStepperProps = {
  value: number;
  onChange: (value: number) => void;
};

export function SeatStepper({ value, onChange }: SeatStepperProps) {
  const canDecrement = value > MIN_SEATS;
  const canIncrement = value < MAX_SEATS;

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          !canDecrement && styles.btnDisabled,
          pressed && canDecrement && styles.btnPressed,
        ]}
        onPress={() => canDecrement && onChange(value - 1)}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel="Decrease passengers"
        accessibilityState={{ disabled: !canDecrement }}
      >
        <Text style={[styles.btnLabel, !canDecrement && styles.btnLabelDisabled]}>−</Text>
      </Pressable>

      <View style={styles.valueWrap} accessibilityRole="text" accessibilityLabel={`${value} passengers`}>
        <Text style={styles.value}>{value}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          !canIncrement && styles.btnDisabled,
          pressed && canIncrement && styles.btnPressed,
        ]}
        onPress={() => canIncrement && onChange(value + 1)}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel="Increase passengers"
        accessibilityState={{ disabled: !canIncrement }}
      >
        <Text style={[styles.btnLabel, !canIncrement && styles.btnLabelDisabled]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: colors.surface.muted,
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnLabel: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    lineHeight: 22,
  },
  btnLabelDisabled: {
    color: colors.ink[400],
  },
  valueWrap: {
    minWidth: 32,
    alignItems: 'center',
  },
  value: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
});
