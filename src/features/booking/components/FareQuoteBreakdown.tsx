import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { PassengerFareQuote } from '@/features/booking/services/quote.service';
import type { BookingRideSelection } from '@/features/booking/types';

type FareQuoteBreakdownProps = {
  readonly quote: PassengerFareQuote | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly onRetry: () => void;
  readonly mode: BookingRideSelection;
  readonly hasValidRoute: boolean;
  readonly riderCount?: number;
};

const peso = (val: number) => `₱${Number.isFinite(val) ? val.toFixed(2) : '0.00'}`;

export function FareQuoteBreakdown({
  quote,
  isLoading,
  isError,
  error,
  onRetry,
  mode,
  hasValidRoute,
  riderCount = 1,
}: FareQuoteBreakdownProps) {
  if (!hasValidRoute) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <SymbolIcon name="location.slash" size={16} tintColor={colors.ink[500]} />
          <Text style={styles.subtleText}>Select pickup & destination to view fare</Text>
        </View>
      </View>
    );
  }

  // Only show the loading card on the first cold start when no quote exists at all
  if (isLoading && !quote) {
    return (
      <View style={styles.card} testID="fare-quote-loading">
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.blue.primary} />
          <Text style={styles.loadingText}>Calculating fare...</Text>
        </View>
      </View>
    );
  }

  if (isError && !quote) {
    return (
      <View style={[styles.card, styles.errorCard]} testID="fare-quote-error">
        <View style={styles.headerRow}>
          <SymbolIcon name="exclamationmark.triangle.fill" size={16} tintColor={colors.danger} />
          <Text style={styles.errorTitle}>Unable to calculate fare</Text>
        </View>
        <Text style={styles.errorMessage}>
          {error?.message || 'Pricing is currently unavailable for this route.'}
        </Text>
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
          <SymbolIcon name="arrow.clockwise" size={14} tintColor={colors.blue.primary} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!quote) return null;

  const { fare, billedSeats } = quote;
  const baseFare = fare.perSeat?.baseFare ?? fare.baseFare;
  const succeedingKm = fare.perSeat?.succeedingKmCharge ?? fare.succeedingKmCharge ?? fare.distanceFare ?? 0;
  const perSeatRate = baseFare + succeedingKm;

  const techFee = fare.techFee ?? 0;
  const surchargeTotal = typeof fare.surcharges === 'number'
    ? fare.surcharges
    : typeof (fare.surcharges as any)?.total === 'number'
      ? (fare.surcharges as any).total
      : 0;

  // Format multiplier label in plain English
  const multiplierLabel = mode === 'private'
    ? `${riderCount} riders · ${billedSeats} billed seats`
    : `${billedSeats} ${billedSeats === 1 ? 'rider' : 'riders'}`;

  return (
    <View style={styles.card} testID="fare-quote-breakdown">
      <Text style={styles.cardTitle}>Fare Breakdown</Text>

      <View style={styles.rowsContainer}>
        {/* Base fare */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Base fare</Text>
          <Text style={styles.rowValue}>{peso(baseFare)}</Text>
        </View>

        {/* Succeeding km fare if > 0 */}
        {succeedingKm > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Succeeding-km charge</Text>
            <Text style={styles.rowValue}>+{peso(succeedingKm)}</Text>
          </View>
        )}

        {/* Per-seat fare summary */}
        <View style={styles.subRow}>
          <Text style={styles.subRowLabel}>Per-seat fare</Text>
          <Text style={styles.subRowValue}>{peso(perSeatRate)}</Text>
        </View>

        {/* Riders multiplier */}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{multiplierLabel}</Text>
          <Text style={styles.rowValue}>× {billedSeats}</Text>
        </View>

        {/* Service fee */}
        {techFee > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Service fee</Text>
            <Text style={styles.rowValue}>{peso(techFee)}</Text>
          </View>
        )}

        {/* Night charge if applicable */}
        {surchargeTotal > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Night charge</Text>
            <Text style={styles.rowValue}>+{peso(surchargeTotal)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{peso(fare.total)}</Text>
        </View>
      </View>

      {/* Hop Corridor Disclaimer */}
      {mode === 'hopon' && (
        <View style={styles.hopNotice}>
          <SymbolIcon name="info.circle" size={14} tintColor={colors.blue.primary} />
          <Text style={styles.hopNoticeText}>
            Hop availability depends on an active driver on your route corridor.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginTop: spacing[3],
  },
  cardTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  errorCard: {
    borderColor: colors.danger,
    backgroundColor: '#FFF5F5',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  loadingText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  subtleText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  errorTitle: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.danger,
  },
  errorMessage: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
    marginTop: spacing[1],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[2],
    alignSelf: 'flex-start',
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  rowsContainer: {
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  rowLabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[700],
  },
  rowValue: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
    paddingLeft: spacing[2],
  },
  subRowLabel: {
    fontSize: 12,
    color: colors.ink[500],
    fontStyle: 'italic',
  },
  subRowValue: {
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[2],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  totalValue: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  hopNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.blue.tint,
    padding: spacing[2],
    borderRadius: radius.sm,
    marginTop: spacing[3],
  },
  hopNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.blue.deep,
    lineHeight: 16,
  },
});
