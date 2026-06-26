import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolIcon } from '../../../components/ui/SymbolIcon';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';

type HomeSheetProps = {
  readonly onSearchPress: () => void;
  readonly passengerName?: string;
};

export function HomeSheet({ onSearchPress, passengerName }: HomeSheetProps) {
  // Helper to get formatted day of the week and greeting
  const getDayOfWeek = () => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  };

  const getTimeGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'GOOD MORNING';
    if (hrs < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  const formattedHeader = `${getDayOfWeek()} · ${getTimeGreeting()}`;
  const displayName = passengerName || 'Passenger';

  return (
    <View style={[styles.card, shadow.float]} testID="home-sheet">
      {/* Time & Day Header */}
      <Text style={styles.headerText}>{formattedHeader}</Text>

      {/* Greeting Title */}
      <Text style={styles.greetingText}>
        Where to, <Text style={styles.nameHighlight}>{displayName}</Text>?
      </Text>

      {/* Simulated Search Bar */}
      <Pressable
        onPress={onSearchPress}
        style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
        accessibilityLabel="Search destination"
        accessibilityRole="button"
        testID="home-search-button"
      >
        <View style={styles.searchIconContainer}>
          <SymbolIcon name="magnifyingglass" size={18} tintColor={colors.blue.primary} />
        </View>

        <View style={styles.searchTextContainer}>
          <Text style={styles.searchTitle}>Search destination</Text>
          <Text style={styles.searchSubtitle} numberOfLines={1}>
            Schools · malls · barangays · landmarks
          </Text>
        </View>

        <View style={styles.voiceBadge}>
          <Text style={styles.voiceText}>VOICE</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  headerText: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[400],
    letterSpacing: 1.2,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
  },
  greetingText: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
    marginBottom: spacing[5],
  },
  nameHighlight: {
    color: colors.blue.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#EAF1FB',
    borderRadius: 24,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[5],
  },
  searchBarPressed: {
    backgroundColor: colors.surface.muted,
    borderColor: colors.blue.tint,
  },
  searchIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blue.tint,
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
    fontSize: typography.size.bodySmall - 1,
    color: colors.ink[400],
  },
  voiceBadge: {
    backgroundColor: '#FDF2E9', // Soft peach
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  voiceText: {
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: '#D35400', // Deep orange
    letterSpacing: 0.5,
  },
});
