import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography, motion } from '@/constants/theme';
import { MAX_SEATS, MIN_SEATS } from '@/lib/seatModel';

export type SeatStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function SeatStepper({ value, onChange, min = MIN_SEATS, max = MAX_SEATS }: SeatStepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;
  const [scaleAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.12,
        duration: motion.duration.instant,
        easing: motion.easing.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: motion.duration.fast,
        easing: motion.easing.standard,
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, scaleAnim]);

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

      <Animated.View
        style={[styles.valueWrap, { transform: [{ scale: scaleAnim }] }]}
        accessibilityRole="text"
        accessibilityLabel={`${value} passengers`}
      >
        <Text style={styles.value}>{value}</Text>
      </Animated.View>

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
