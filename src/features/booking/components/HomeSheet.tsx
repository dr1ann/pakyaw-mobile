import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';

type HomeSheetProps = {
  readonly onSearchPress: () => void;
  readonly onPickupPress?: () => void;
  readonly firstName?: string;
  readonly fullName?: string;
  readonly pickupLabel?: string;
  readonly isLocatingPickup?: boolean;
  readonly locationPermissionDenied?: boolean;
};

export function HomeSheet({
  onSearchPress,
  onPickupPress,
  firstName,
  fullName,
  pickupLabel,
  isLocatingPickup = false,
  locationPermissionDenied = false,
}: HomeSheetProps) {
  // Helper to get time-of-day greeting
  const getTimeGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Resolve display name: firstName -> first word of fullName -> undefined
  const resolvedFirstName =
    firstName?.trim() ||
    (fullName?.trim() && fullName.trim().toLowerCase() !== 'passenger'
      ? fullName.trim().split(/\s+/)[0]
      : '');

  const hasName = Boolean(resolvedFirstName && resolvedFirstName.toLowerCase() !== 'passenger');

  // Pickup display text
  const resolvedPickupText = locationPermissionDenied
    ? 'Location is off · Tap to choose on map'
    : isLocatingPickup
      ? 'Finding your pickup location…'
      : pickupLabel?.trim() || 'Current location';

  return (
    <View style={[styles.card, shadow.float]} testID="home-sheet">
      {/* Time & City Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerGreeting}>{getTimeGreeting()}</Text>
        <View style={styles.cityBadge}>
          <Text style={styles.cityText}>Ormoc City</Text>
        </View>
      </View>

      {/* Greeting Title */}
      <Text style={styles.greetingText}>
        {hasName ? (
          <>
            Where to, <Text style={styles.nameHighlight}>{resolvedFirstName}</Text>?
          </>
        ) : (
          'Where to?'
        )}
      </Text>

      {/* Primary Search Bar */}
      <Pressable
        onPress={onSearchPress}
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
        accessibilityLabel="Search destination"
        accessibilityRole="button"
        testID="home-search-button"
      >
        <View style={styles.searchIconContainer}>
          <SymbolIcon name="magnifyingglass" size={20} tintColor={colors.blue.primary} />
        </View>

        <View style={styles.searchTextContainer}>
          <Text style={styles.searchTitle}>Search destination</Text>
          <Text style={styles.searchSubtitle} numberOfLines={1}>
            Schools · malls · barangays · landmarks
          </Text>
        </View>
      </Pressable>

      {/* Current Pickup Quick Status */}
      <Pressable
        onPress={onPickupPress || onSearchPress}
        style={({ pressed }) => [styles.pickupRow, pressed && styles.pickupRowPressed]}
        accessibilityLabel={`Pickup point: ${resolvedPickupText}`}
        accessibilityRole="button"
        testID="home-pickup-button"
      >
        <View style={styles.pickupIconWrap}>
          <SymbolIcon
            name={locationPermissionDenied ? 'location.slash' : 'mappin.circle.fill'}
            size={18}
            tintColor={locationPermissionDenied ? colors.amber.primary : colors.blue.primary}
          />
        </View>
        <View style={styles.pickupTextWrap}>
          <Text style={styles.pickupPrefix}>Pickup point</Text>
          <Text
            style={[
              styles.pickupAddress,
              locationPermissionDenied && styles.pickupAddressWarning,
            ]}
            numberOfLines={1}
          >
            {resolvedPickupText}
          </Text>
        </View>
        <Text style={styles.changePickupAction}>Edit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  headerGreeting: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[500],
  },
  cityBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  cityText: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    letterSpacing: 0.5,
  },
  greetingText: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
    marginBottom: spacing[4],
  },
  nameHighlight: {
    color: colors.blue.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
    minHeight: 56,
  },
  searchBarPressed: {
    backgroundColor: colors.blue.tint,
    borderColor: colors.blue.primary,
  },
  searchIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  searchTextContainer: {
    flex: 1,
    gap: 2,
  },
  searchTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  searchSubtitle: {
    fontSize: typography.size.caption,
    color: colors.ink[500],
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    gap: spacing[2],
    minHeight: 48,
  },
  pickupRowPressed: {
    opacity: 0.7,
  },
  pickupIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupTextWrap: {
    flex: 1,
  },
  pickupPrefix: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickupAddress: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
    marginTop: 1,
  },
  pickupAddressWarning: {
    color: colors.amber.primary,
    fontWeight: typography.weight.semibold,
  },
  changePickupAction: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
});
