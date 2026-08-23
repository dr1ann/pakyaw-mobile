import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/services/firebase/firebase';
import { HopMatchingConfig, DEFAULT_HOP_MATCHING_CONFIG } from '@pakyaw/shared/features/matching/hop-matching-config';

type HopDriverSearchProps = {
  readonly rides: SharedRideDoc[];
  readonly loading: boolean;
  readonly onJoinRide: (ride: SharedRideDoc) => void;
};

export function HopDriverSearch({ rides, loading, onJoinRide }: HopDriverSearchProps) {
  const [config, setConfig] = useState<HopMatchingConfig>(DEFAULT_HOP_MATCHING_CONFIG);

  useEffect(() => {
    const configRef = doc(firestore, 'config', 'hop_matching');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig({
          searchRadiusKm: data.searchRadiusKm ?? DEFAULT_HOP_MATCHING_CONFIG.searchRadiusKm,
          corridorWidthMeters: data.corridorWidthMeters ?? DEFAULT_HOP_MATCHING_CONFIG.corridorWidthMeters,
          forwardAngleDeg: data.forwardAngleDeg ?? DEFAULT_HOP_MATCHING_CONFIG.forwardAngleDeg,
          matchingToleranceMeters: data.matchingToleranceMeters ?? DEFAULT_HOP_MATCHING_CONFIG.matchingToleranceMeters,
          maxPickupDeviationMeters: data.maxPickupDeviationMeters ?? DEFAULT_HOP_MATCHING_CONFIG.maxPickupDeviationMeters,
          maxSharedPassengers: data.maxSharedPassengers ?? DEFAULT_HOP_MATCHING_CONFIG.maxSharedPassengers,
          maxHopSeatsPerPassenger: data.maxHopSeatsPerPassenger ?? DEFAULT_HOP_MATCHING_CONFIG.maxHopSeatsPerPassenger,
        });
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer} testID="hop-search-loading">
        <ActivityIndicator size="large" color={colors.blue.primary} />
        <Text style={styles.loadingTitle}>Scanning active corridors</Text>
        <Text style={styles.loadingSubtitle}>
          Evaluating drivers within {config.searchRadiusKm} km radius & {config.corridorWidthMeters}m corridor threshold...
        </Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={styles.centerContainer} testID="hop-search-empty">
        <View style={styles.iconCircle}>
          <SymbolIcon name="car.2.fill" size={32} tintColor={colors.blue.primary} />
        </View>
        <Text style={styles.emptyTitle}>Searching for Nearby Hop Drivers</Text>
        <Text style={styles.emptySubtitle}>
          No drivers currently operating an active Shared Ride within your {config.searchRadiusKm} km corridor. You can tap &quot;Book Hop&quot; below to broadcast your Hop request!
        </Text>

        <View style={styles.infoBox}>
          <SymbolIcon name="info.circle.fill" size={14} tintColor={colors.blue.primary} />
          <Text style={styles.infoText}>
            Dynamic Admin Thresholds: {config.searchRadiusKm}km Radius • {config.corridorWidthMeters}m Corridor • {config.forwardAngleDeg}° Forward Angle
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="hop-search-list">
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Eligible Shared Drivers ({rides.length})</Text>
        <View style={styles.thresholdBadge}>
          <Text style={styles.thresholdText}>{config.searchRadiusKm}km / {config.corridorWidthMeters}m</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rides.map((ride) => {
          const availableSeats = Math.max(0, config.maxSharedPassengers - (ride.totalPassengersCount || ride.seatsBooked || 1));
          return (
            <View key={ride.id} style={[styles.card, shadow.card]}>
              <View style={styles.cardHeader}>
                <View style={styles.driverInfo}>
                  <View style={styles.avatarMini}>
                    <SymbolIcon name="person.fill" size={16} tintColor={colors.white} />
                  </View>
                  <View>
                    <Text style={styles.driverNameText}>{ride.driverName || 'Pakyaw Driver'}</Text>
                    <Text style={styles.vehicleText}>{ride.vehicleModel || 'Fleet Tricycle'}</Text>
                  </View>
                </View>

                <View style={styles.seatBadge}>
                  <Text style={styles.seatBadgeText}>{availableSeats} seats left</Text>
                </View>
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.routeRow}>
                  <View style={[styles.dot, styles.dotPickup]} />
                  <Text style={styles.placeText} numberOfLines={1}>
                    Heading towards {ride.passengers?.[0]?.destination?.label || 'Route Drop-off'}
                  </Text>
                </View>
              </View>

              <Button
                label="Book Hop with this Driver"
                onPress={() => onJoinRide(ride)}
                style={styles.joinButton}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing[2],
  },
  centerContainer: {
    padding: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  loadingTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[3],
  },
  loadingSubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[1],
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blue.tint,
    padding: spacing[3],
    borderRadius: radius.md,
    marginTop: spacing[4],
    gap: spacing[2],
  },
  infoText: {
    flex: 1,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  headerTitle: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thresholdBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  thresholdText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverNameText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  vehicleText: {
    fontSize: 11,
    color: colors.ink[500],
  },
  seatBadge: {
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  seatBadgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  routeContainer: {
    marginBottom: spacing[3],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  placeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    flex: 1,
  },
  joinButton: {
    width: '100%',
  },
});
