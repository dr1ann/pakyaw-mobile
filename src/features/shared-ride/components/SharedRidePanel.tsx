import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { SharedRideDoc } from '@pakyaw/shared/features/trip/types';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { dropOffPassenger } from '@pakyaw/shared/features/trip/services/sharedRide.service';

type SharedRidePanelProps = {
  readonly sharedRide: SharedRideDoc;
};

export function SharedRidePanel({ sharedRide }: SharedRidePanelProps) {
  const activePassengers = sharedRide.passengers.filter(p => p.status === 'active');

  const handleDropOff = async (tripId: string) => {
    try {
      await dropOffPassenger(sharedRide.id, tripId);
    } catch (e) {
      console.error('Failed to drop off passenger', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SymbolIcon name="person.3.fill" size={20} tintColor={colors.blue.primary} />
        <Text style={styles.headerText}>Active Shared Ride</Text>
        <View style={styles.seatsBadge}>
          <Text style={styles.seatsText}>{sharedRide.seatsBooked}/{sharedRide.maxSeats} seats</Text>
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {activePassengers.map((p, idx) => (
          <View key={p.tripId} style={[styles.card, shadow.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.passengerIndex}>Passenger {idx + 1}</Text>
              <Text style={styles.seatCount}>{p.seatsCovered} seat{p.seatsCovered > 1 ? 's' : ''}</Text>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, styles.dotPickup]} />
                <Text style={styles.placeText} numberOfLines={1}>{p.pickup.label}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, styles.dotDestination]} />
                <Text style={styles.placeText} numberOfLines={1}>{p.destination.label}</Text>
              </View>
            </View>

            <Button
              label="Drop Off"
              onPress={() => handleDropOff(p.tripId)}
              style={styles.dropOffButton}
            />
          </View>
        ))}
        {activePassengers.length === 0 && (
          <Text style={styles.emptyText}>All passengers dropped off.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.muted,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[4],
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing[3],
  },
  headerText: {
    flex: 1,
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  seatsBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  seatsText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  list: {
    padding: spacing[5],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  passengerIndex: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  seatCount: {
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
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: colors.border.subtle,
    marginLeft: 3,
    marginVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  dotDestination: {
    backgroundColor: colors.amber.primary,
  },
  placeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    flex: 1,
  },
  dropOffButton: {
    width: '100%',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.ink[500],
    padding: spacing[4],
  },
});
