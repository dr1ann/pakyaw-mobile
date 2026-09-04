import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@pakyaw/shared/components/ui/EmptyState';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useTripHistory } from '../hooks/useTripHistory';
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
    error,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useTripHistory(uid);

  const trips: TripHistoryItem[] = data?.pages.flatMap((page) => page.trips) ?? [];

  if (isLoading && !isRefetching) {
    return (
      <View style={styles.center} testID="history-loading">
        <ActivityIndicator color={colors.blue.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center} testID="history-error">
        <Text style={styles.errorTitle}>{"Couldn't load your rides."}</Text>
        <Text style={styles.errorSubtitle}>
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading rides"
          testID="history-retry-btn"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
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
          <View style={styles.footerLoader} testID="history-footer-loader">
            <ActivityIndicator color={colors.blue.primary} size="small" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
          <EmptyState
            title="No rides yet"
            description="Your completed and cancelled rides will appear here."
          />
        ) : null
      }
      refreshing={isRefetching}
      onRefresh={refetch}
      showsVerticalScrollIndicator={false}
      testID="trip-history-list"
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
    gap: spacing[2],
  },
  footerLoader: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  retryBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.bodySmall,
  },
});
