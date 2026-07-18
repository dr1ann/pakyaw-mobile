import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import { Button } from '@pakyaw/shared/components/ui/Button';

type HopOnRadarProps = {
  readonly rides: SharedRideDoc[];
  readonly loading: boolean;
  readonly onJoinRide: (ride: SharedRideDoc) => void;
};

export function HopOnRadar({ rides, loading, onJoinRide }: HopOnRadarProps) {
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.blue.primary} />
        <Text style={styles.loadingText}>Scanning for nearby shared rides...</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <SymbolIcon name="radar" size={48} tintColor={colors.ink[400]} />
        <Text style={styles.emptyTitle}>No shared rides nearby</Text>
        <Text style={styles.emptySubtitle}>
          There are no active shared rides heading your way right now. Try booking a Shared Ride instead!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Nearby Shared Rides ({rides.length})</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rides.map(ride => (
          <View key={ride.id} style={[styles.card, shadow.card]}>
            <View style={styles.cardHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{ride.maxSeats - ride.seatsBooked} seats left</Text>
              </View>
              <Text style={styles.etaText}>~5 min away</Text>
            </View>
            
            <View style={styles.routeContainer}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, styles.dotPickup]} />
                <Text style={styles.placeText} numberOfLines={1}>Going towards {ride.passengers[0]?.destination.label}</Text>
              </View>
            </View>

            <Button 
              label="Join Ride" 
              onPress={() => onJoinRide(ride)} 
              style={styles.joinButton} 
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing[4],
  },
  centerContainer: {
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  emptyTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    marginTop: spacing[4],
  },
  emptySubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: 20,
  },
  header: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    gap: spacing[4],
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
  badge: {
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  etaText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
  },
  routeContainer: {
    marginBottom: spacing[4],
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
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
    flex: 1,
  },
  joinButton: {
    width: '100%',
  },
});
