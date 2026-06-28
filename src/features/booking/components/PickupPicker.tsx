import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/ui/Sheet';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { SAVED_PICKUP_PLACES } from '@/features/booking/constants';
import type { Place } from '@/features/booking/types';
import { logger } from '@/lib/logger';
import { useLocationStore } from '@/stores/locationStore';

export type PickupPickerProps = {
  value: Place | null;
  onChange: (place: Place) => void;
  error?: string;
};

export function PickupPicker({ value, onChange, error }: PickupPickerProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (value) return;
    void resolveCurrentLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveCurrentLocation() {
    setLocating(true);
    const state = useLocationStore.getState();
    const loc = state.location;
    if (loc) {
      onChange({
        label: 'Current location',
        coords: { lat: loc.latitude, lng: loc.longitude },
      });
      setLocating(false);
    } else {
      if (state.permissionStatus === 'denied') {
        onChange({ label: 'Current location (unavailable)', coords: null });
        setLocating(false);
        return;
      }
      
      const unsubscribe = useLocationStore.subscribe((currState) => {
        if (currState.location) {
          onChange({
            label: 'Current location',
            coords: { lat: currState.location.latitude, lng: currState.location.longitude },
          });
          setLocating(false);
          unsubscribe();
        } else if (currState.permissionStatus === 'denied') {
          onChange({ label: 'Current location (unavailable)', coords: null });
          setLocating(false);
          unsubscribe();
        }
      });
      
      setTimeout(() => {
        unsubscribe();
        setLocating(false);
        const latestLoc = useLocationStore.getState().location;
        if (!latestLoc) {
          onChange({ label: 'Current location (unavailable)', coords: null });
        }
      }, 3000);
    }
  }

  function handleSavedPlace(place: Place) {
    onChange(place);
    setSheetOpen(false);
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change pickup location"
      >
        <View style={styles.dot} />
        <View style={styles.labelWrap}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.blue.primary} />
          ) : (
            <Text style={styles.label} numberOfLines={1}>
              {value?.label ?? 'Detecting location…'}
            </Text>
          )}
          {value?.address ? (
            <Text style={styles.address} numberOfLines={1}>
              {value.address}
            </Text>
          ) : null}
        </View>
        <Text style={styles.changeBtn}>Change</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} showHandle padded>
        <Text style={styles.sheetTitle}>Choose pickup</Text>
        <View style={styles.savedList}>
          <Pressable
            style={({ pressed }) => [styles.savedItem, pressed && styles.savedItemPressed]}
            onPress={() => {
              setSheetOpen(false);
              void resolveCurrentLocation();
            }}
            accessibilityRole="button"
            accessibilityLabel="Use current location"
          >
            <Text style={styles.savedLabel}>Current location</Text>
            <Text style={styles.savedAddress}>Detect via GPS</Text>
          </Pressable>
          {SAVED_PICKUP_PLACES.map((place) => (
            <Pressable
              key={place.label}
              style={({ pressed }) => [styles.savedItem, pressed && styles.savedItemPressed]}
              onPress={() => handleSavedPlace(place)}
              accessibilityRole="button"
              accessibilityLabel={place.label}
            >
              <Text style={styles.savedLabel}>{place.label}</Text>
              {place.address ? (
                <Text style={styles.savedAddress} numberOfLines={1}>
                  {place.address}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  rowPressed: {
    backgroundColor: colors.blue.tint,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
  },
  address: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  changeBtn: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
  error: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  sheetTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[4],
  },
  savedList: {
    gap: spacing[2],
  },
  savedItem: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface.muted,
  },
  savedItemPressed: {
    backgroundColor: colors.blue.tint,
  },
  savedLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
  },
  savedAddress: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
});
