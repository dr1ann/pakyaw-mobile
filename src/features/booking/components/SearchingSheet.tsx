import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { Sheet } from '@pakyaw/shared/components/ui/Sheet';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';

import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function SearchingSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: cancel, isPending } = useCancelTrip();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    rotateLoop.start();

    return () => {
      pulseLoop.stop();
      rotateLoop.stop();
    };
  }, [pulseAnim, rotateAnim]);

  function handleCancel() {
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled the booking request',
      });
    }
  }

  const mode = trip?.mode || 'hop';
  const isHop = mode === 'hop';
  const isShared = mode === 'shared';

  const titleText = isHop
    ? 'Scanning for Hop Drivers…'
    : isShared
    ? 'Finding Shared Ride Match…'
    : 'Connecting to Nearest Driver…';

  const subtitleText = isHop
    ? 'Broadcast request sent. Nearby drivers along your corridor are receiving your trip.'
    : isShared
    ? 'Matching you with drivers heading in your direction.'
    : 'Reserving the entire Pakyaw vehicle for your route.';

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Sheet visible dismissOnBackdropPress={false} padded showHandle={false} modal={false}>
      <View style={styles.content} testID="passenger-searching-sheet">
        {/* Animated Scanning Circle */}
        <View style={styles.scannerWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.iconCircle,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          >
            <SymbolIcon
              name={isHop ? 'car.2.fill' : isShared ? 'person.3.fill' : 'car.fill'}
              size={32}
              tintColor={colors.blue.primary}
            />
          </Animated.View>
        </View>

        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.statusBadgeText}>BROADCAST REQUEST ACTIVE</Text>
        </View>

        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        {/* Fare Summary Box */}
        {trip?.fare != null && (
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>ESTIMATED FARE</Text>
            <Text style={styles.fareAmount}>₱{trip.fare.toFixed(2)}</Text>
          </View>
        )}

        <Button
          label="Cancel Request"
          onPress={handleCancel}
          loading={isPending}
          disabled={isPending}
          tone="destructive"
          style={styles.cancelBtn}
          testID="passenger-cancel-request"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  scannerWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.blue.tint,
    borderWidth: 2,
    borderColor: 'rgba(47, 128, 237, 0.25)',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue.primary,
  },
  statusBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[1],
    lineHeight: 18,
    paddingHorizontal: spacing[4],
  },
  fareBox: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing[4],
  },
  fareLabel: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
  },
  fareAmount: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing[4],
    width: '100%',
  },
});
