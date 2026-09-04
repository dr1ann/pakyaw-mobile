import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@pakyaw/shared/components/ui/EmptyState';
import { colors, spacing, typography } from '@/constants/theme';
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
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue.primary} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load trip history.'}
        </Text>
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
            title="No trips yet"
            description="Your completed and cancelled trips will show up here."
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
  footerLoader: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.size.body,
    color: colors.danger,
    textAlign: 'center',
  },
});
