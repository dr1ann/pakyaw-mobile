import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { EmptyState } from '@pakyaw/shared/components/ui/EmptyState';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripHistory } from '../hooks/useTripHistory';
import { tripHistoryViewState } from '../presentation';
import { TripHistoryCard } from './TripHistoryCard';
import type { TripHistoryItem } from '@pakyaw/shared/features/trip-history/types';

export type TripHistoryListProps = {
  readonly uid: string;
};

export function TripHistoryList({ uid }: TripHistoryListProps) {
  const router = useRouter();
  const {
    data,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useTripHistory(uid);

  const trips: TripHistoryItem[] = data?.pages.flatMap((page) => page.trips) ?? [];
  const viewState = tripHistoryViewState({
    isLoading,
    isRefetching,
    isError,
    itemCount: trips.length,
  });

  if (viewState === 'loading') {
    return (
      <View style={styles.loadingList} accessibilityLabel="Loading ride history">
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.skeletonCard}>
            <View style={[styles.skeleton, styles.skeletonShort]} />
            <View style={[styles.skeleton, styles.skeletonWide]} />
            <View style={[styles.skeleton, styles.skeletonMedium]} />
          </View>
        ))}
      </View>
    );
  }

  if (viewState === 'error') {
    return (
      <View style={styles.center}>
        <SymbolIcon name="arrow.clockwise" size={28} tintColor={colors.ink[400]} />
        <Text style={styles.errorTitle}>Couldn’t load your rides</Text>
        <Text style={styles.errorText}>Your previous rides have not been deleted. Try again when you’re back online.</Text>
        <Button label="Try again" onPress={() => refetch()} fullWidth={false} style={styles.retryButton} />
      </View>
    );
  }

  return (
    <FlatList
      data={trips}
      keyExtractor={(item) => item.tripId}
      renderItem={({ item }) => (
        <TripHistoryCard
          trip={item}
          onPress={() => router.push(`/activity/${item.tripId}`)}
        />
      )}
      contentContainerStyle={styles.listContainer}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator color={colors.blue.primary} size="small" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
          <EmptyState
            title="No rides yet"
            description="Your completed and cancelled rides will appear here."
            icon={<SymbolIcon name="clock" size={30} tintColor={colors.blue.primary} />}
          />
        ) : null
      }
      refreshing={isRefetching}
      onRefresh={refetch}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: spacing[6],
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  loadingList: {
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  skeletonCard: {
    backgroundColor: colors.surface.card,
    borderRadius: 16,
    padding: spacing[4],
    gap: spacing[3],
  },
  skeleton: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.sm,
    height: 12,
  },
  skeletonShort: {
    width: '36%',
  },
  skeletonWide: {
    width: '85%',
  },
  skeletonMedium: {
    width: '62%',
  },
  errorTitle: {
    color: colors.ink[900],
    fontSize: typography.size.h3,
    fontFamily: typography.family.bold,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
  },
  retryButton: {
    marginTop: spacing[2],
  },
});
