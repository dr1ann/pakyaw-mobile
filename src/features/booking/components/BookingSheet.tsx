import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { colors, spacing, typography } from '@/constants/theme';
import { DestinationSearch } from '@/features/booking/components/DestinationSearch';
import { PickupPicker } from '@/features/booking/components/PickupPicker';
import { SeatStepper } from '@/features/booking/components/SeatStepper';
import { useCreateBooking } from '@/features/booking/hooks/useCreateBooking';
import type { Place } from '@/features/booking/types';
import { createBookingSchema } from '@/features/booking/validation/bookingSchema';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';

type FieldErrors = {
  pickup?: string;
  destination?: string;
  submit?: string;
};

export function BookingSheet() {
  const draft = useBookingDraftStore((s) => s.draft);
  const setPickup = useBookingDraftStore((s) => s.setPickup);
  const setDestination = useBookingDraftStore((s) => s.setDestination);
  const setPassengerCount = useBookingDraftStore((s) => s.setPassengerCount);

  const [errors, setErrors] = useState<FieldErrors>({});
  const { mutate, isPending } = useCreateBooking();

  function handlePickupChange(place: Place) {
    setPickup(place);
    if (errors.pickup) setErrors((prev) => ({ ...prev, pickup: undefined }));
  }

  function handleDestinationChange(place: Place) {
    setDestination(place);
    if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
  }

  function handleConfirm() {
    setErrors({});

    const parsed = createBookingSchema.safeParse({
      pickup: draft.pickup,
      destination: draft.destination,
      passengerCount: draft.passengerCount,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const top = issue.path[0];
        if (top === 'pickup' && !next.pickup) next.pickup = issue.message;
        if (top === 'destination' && !next.destination) next.destination = issue.message;
      }
      setErrors(next);
      return;
    }

    mutate(parsed.data, {
      onError: (err) => {
        const message =
          err instanceof Error ? err.message : 'Could not create your trip. Please try again.';
        setErrors({ submit: message });
      },
    });
  }

  return (
    <Sheet visible onClose={undefined} dismissOnBackdropPress={false} padded showHandle modal={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Book a ride</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pickup</Text>
          <PickupPicker value={draft.pickup} onChange={handlePickupChange} error={errors.pickup} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Destination</Text>
          <DestinationSearch
            value={draft.destination}
            onChange={handleDestinationChange}
            error={errors.destination}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Passengers</Text>
          <SeatStepper value={draft.passengerCount} onChange={setPassengerCount} />
        </View>

        {errors.submit ? <Text style={styles.submitError}>{errors.submit}</Text> : null}

        <Button
          label="Confirm booking"
          onPress={handleConfirm}
          loading={isPending}
          disabled={isPending}
          testID="booking-confirm"
        />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing[4],
    gap: spacing[5],
  },
  title: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  section: {
    gap: spacing[2],
  },
  sectionLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  submitError: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.danger,
    textAlign: 'center',
  },
});
