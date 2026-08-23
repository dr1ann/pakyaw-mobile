import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';

type BoardingConfirmationToastProps = {
  readonly passengerName?: string;
  readonly visible: boolean;
  readonly onDismiss?: () => void;
};

export function BoardingConfirmationToast({
  passengerName,
  visible,
  onDismiss,
}: BoardingConfirmationToastProps) {
  const [slideAnim] = useState(() => new Animated.Value(-100));

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          onDismiss?.();
        });
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-100);
    }
  }, [visible, slideAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }, shadow.float]}
      testID="boarding-toast"
    >
      <View style={styles.iconCircle}>
        <SymbolIcon name="checkmark" size={16} tintColor={colors.white} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Passenger Boarding Confirmed</Text>
        <Text style={styles.subtitle}>
          {passengerName || 'Passenger'} has successfully joined the ride.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing[4],
    right: spacing[4],
    backgroundColor: colors.ink[900],
    borderRadius: radius.lg,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    zIndex: 9999,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  subtitle: {
    fontSize: 11,
    color: colors.ink[400],
    marginTop: 2,
  },
});
