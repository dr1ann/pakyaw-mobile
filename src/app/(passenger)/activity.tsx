import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@pakyaw/shared/components/ui/Screen';
import { colors, spacing, typography } from '@/constants/theme';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import { TripHistoryList } from '@/features/trip-history/components/TripHistoryList';

export default function ActivityScreen() {
  const { uid } = useSession();

  return (
    <Screen background="passenger" style={styles.container} padded={false}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Activity</Text>
      </View>
      <View style={styles.listWrap}>
        {uid ? (
          <TripHistoryList uid={uid} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
  },
  pageTitle: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
});
