import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { Sheet } from '@pakyaw/shared/components/ui/Sheet';
import { colors, spacing, typography } from '@/constants/theme';

import { useCancelTrip } from '@pakyaw/shared/features/trip/hooks/useTripActions';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';

export function SearchingSheet() {
  const trip = useActiveTripStore((s) => s.trip);
  const { mutate: cancel, isPending } = useCancelTrip();

  function handleCancel() {
    if (trip) {
      cancel({
        tripId: trip.id,
        by: 'passenger',
        reason: 'Passenger cancelled the booking request',
      });
    }
  }

  return (
    <Sheet visible dismissOnBackdropPress={false} padded showHandle={false} modal={false}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.blue.primary} />
        <Text style={styles.title}>Finding your ride…</Text>
        <Text style={styles.subtitle}>Reserving the whole vehicle</Text>
        <Button
          label="Cancel request"
          onPress={handleCancel}
          loading={isPending}
          disabled={isPending}
          tone="destructive"
          style={styles.cancelBtn}
          testID="passenger-cancel-request"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: spacing[4],
    width: '100%',
  },
});
