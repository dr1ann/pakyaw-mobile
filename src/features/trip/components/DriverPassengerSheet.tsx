import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import type { SharedRideDoc, SharedRidePassenger } from '@pakyaw/shared/features/trip/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DriverPassengerSheetProps = {
  readonly sharedRide: SharedRideDoc;
  readonly onBoardPassenger?: (passengerId: string) => void;
  readonly onDropOffPassenger?: (passengerId: string) => void;
};

export function DriverPassengerSheet({
  sharedRide,
  onBoardPassenger,
  onDropOffPassenger,
}: DriverPassengerSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const passengers = sharedRide.passengers || [];
  const activePassengers = passengers.filter((p) => p.status === 'active');
  
  // Calculate total earnings summary across all passengers
  const totalCollectedFare = passengers.reduce((sum, p) => sum + (p.fare || 15), 0);
  const platformFee = passengers.length * 5; // ₱5 platform fee per seat
  const driverTakeHome = Math.max(0, totalCollectedFare - platformFee);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isExpanded && styles.containerExpanded,
        shadow.float,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Handle Bar */}
      <Pressable onPress={toggleExpand} style={styles.handleContainer} testID="driver-sheet-handle">
        <View style={styles.handleBar} />
        <View style={styles.headerTitleRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.sheetTitle}>Trip Management & Fares</Text>
            <Text style={styles.sheetSubtitle}>
              {activePassengers.length} Active • {passengers.length} Total Booked
            </Text>
          </View>

          <View style={styles.netEarningsPill}>
            <Text style={styles.netLabel}>NET TAKE-HOME</Text>
            <Text style={styles.netValue}>₱{driverTakeHome.toFixed(2)}</Text>
          </View>

          <SymbolIcon
            name={isExpanded ? 'chevron.down' : 'chevron.up'}
            size={20}
            tintColor={colors.ink[700]}
          />
        </View>
      </Pressable>

      {/* Expanded Content: Passenger Cards & Fare Breakdown */}
      {isExpanded && (
        <ScrollView style={styles.expandedContent} showsVerticalScrollIndicator={false}>
          {/* Earnings Breakdown Card */}
          <View style={[styles.summaryCard, shadow.card]}>
            <Text style={styles.summaryTitle}>FARES & TAKE-HOME SUMMARY</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Collected Fares:</Text>
              <Text style={styles.summaryValue}>₱{totalCollectedFare.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform/Tech Service Fee:</Text>
              <Text style={styles.summaryValueDeduct}>-₱{platformFee.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Driver Net Earnings:</Text>
              <Text style={styles.summaryValueHighlight}>₱{driverTakeHome.toFixed(2)}</Text>
            </View>
          </View>

          {/* Swipeable Passenger Cards */}
          <View style={styles.passengerHeaderRow}>
            <Text style={styles.sectionTitle}>INDIVIDUAL PASSENGER CARDS ({passengers.length})</Text>
            {passengers.length > 1 && (
              <Text style={styles.swipeHint}>Swipe left/right to inspect ➔</Text>
            )}
          </View>

          {passengers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No passengers joined yet.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / (SCREEN_WIDTH - 40));
                setActivePassengerIndex(index);
              }}
              scrollEventThrottle={16}
              contentContainerStyle={styles.cardsScrollContent}
            >
              {passengers.map((p, index) => {
                const passengerFare = p.fare || 15.0;
                const passengerTechFee = 5.0;
                const passengerNet = Math.max(0, passengerFare - passengerTechFee);

                return (
                  <View key={p.tripId || index} style={[styles.passengerCard, shadow.card]}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.passengerMeta}>
                        {p.passengerPhotoUrl ? (
                          <Image source={{ uri: p.passengerPhotoUrl }} style={styles.passengerAvatar} />
                        ) : (
                          <View style={styles.passengerAvatarFallback}>
                            <SymbolIcon name="person.fill" size={20} tintColor={colors.white} />
                          </View>
                        )}
                        <View>
                          <Text style={styles.passengerName}>
                            {p.passengerName || `Passenger ${index + 1}`}
                          </Text>
                          <Text style={styles.passengerSeatsText}>
                            {p.seatsCovered || 1} Seat reserved {p.isHop ? '• Hop Rider' : '• Shared'}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          p.status === 'active' ? styles.statusActive : styles.statusDone,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {p.status === 'active' ? 'Onboard' : 'Dropped Off'}
                        </Text>
                      </View>
                    </View>

                    {/* Pickup & Destination */}
                    <View style={styles.routeBox}>
                      <View style={styles.routeRow}>
                        <View style={[styles.dot, styles.dotPickup]} />
                        <Text style={styles.routeText} numberOfLines={1}>
                          From: {p.pickup?.label || 'Pickup Location'}
                        </Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routeRow}>
                        <View style={[styles.dot, styles.dotDest]} />
                        <Text style={styles.routeText} numberOfLines={1}>
                          To: {p.destination?.label || 'Destination'}
                        </Text>
                      </View>
                    </View>

                    {/* Independent Fare Breakdown */}
                    <View style={styles.fareBreakdownBox}>
                      <Text style={styles.breakdownHeader}>INDIVIDUAL FARE BREAKDOWN</Text>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Passenger Fare:</Text>
                        <Text style={styles.breakdownVal}>₱{passengerFare.toFixed(2)}</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Platform Service Fee:</Text>
                        <Text style={styles.breakdownVal}>-₱{passengerTechFee.toFixed(2)}</Text>
                      </View>
                      <View style={styles.breakdownRowBold}>
                        <Text style={styles.breakdownLabelBold}>Driver Earnings from this Passenger:</Text>
                        <Text style={styles.breakdownValBold}>₱{passengerNet.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    {p.status === 'active' && (
                      <View style={styles.actionRow}>
                        {onDropOffPassenger && (
                          <Button
                            label="Confirm Drop Off"
                            onPress={() => onDropOffPassenger(p.passengerId)}
                            style={styles.actionBtn}
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Dots Indicator */}
          {passengers.length > 1 && (
            <View style={styles.dotsRow}>
              {passengers.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dotIndicator,
                    i === activePassengerIndex && styles.dotIndicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
    maxHeight: 180,
  },
  containerExpanded: {
    maxHeight: 520,
  },
  handleContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing[2],
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  titleGroup: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  sheetSubtitle: {
    fontSize: typography.size.bodySmall - 1,
    color: colors.ink[500],
  },
  netEarningsPill: {
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    marginRight: spacing[3],
    alignItems: 'flex-end',
  },
  netLabel: {
    fontSize: 8,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
    letterSpacing: 0.5,
  },
  netValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  expandedContent: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  summaryCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.6,
    marginBottom: spacing[2],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  summaryLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
  },
  summaryValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  summaryValueDeduct: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[2],
  },
  summaryLabelBold: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  summaryValueHighlight: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  passengerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.6,
  },
  swipeHint: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  emptyCard: {
    padding: spacing[4],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[400],
  },
  cardsScrollContent: {
    gap: spacing[3],
    paddingBottom: spacing[2],
  },
  passengerCard: {
    width: SCREEN_WIDTH - 50,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  passengerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  passengerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerName: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  passengerSeatsText: {
    fontSize: 11,
    color: colors.ink[500],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  statusActive: {
    backgroundColor: colors.green.tint,
  },
  statusDone: {
    backgroundColor: colors.surface.muted,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  routeBox: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: colors.border.subtle,
    marginLeft: 3.5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotPickup: {
    backgroundColor: colors.blue.primary,
  },
  dotDest: {
    backgroundColor: colors.amber.primary,
  },
  routeText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    flex: 1,
  },
  fareBreakdownBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing[3],
    marginBottom: spacing[3],
  },
  breakdownHeader: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.ink[500],
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  breakdownRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  breakdownLabelBold: {
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  breakdownValBold: {
    fontSize: 14,
    fontWeight: typography.weight.bold,
    color: colors.green.primary,
  },
  actionRow: {
    marginTop: spacing[2],
  },
  actionBtn: {
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginVertical: spacing[3],
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.subtle,
  },
  dotIndicatorActive: {
    width: 18,
    backgroundColor: colors.blue.primary,
  },
});
