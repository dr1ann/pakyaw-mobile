import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { SAVED_DESTINATION_PLACES } from '@/features/booking/constants';
import type { Place } from '@pakyaw/shared/types/place';

export type DestinationSearchProps = {
  value: Place | null;
  onChange: (place: Place) => void;
  error?: string;
};

export function DestinationSearch({ value, onChange, error }: DestinationSearchProps) {
  function handleTextChange(text: string) {
    onChange({ label: text, coords: null });
  }

  function handleSavedPlace(place: Place) {
    onChange(place);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, !!error && styles.inputError]}
        placeholder="Where to?"
        placeholderTextColor={colors.ink[400]}
        value={value?.label ?? ''}
        onChangeText={handleTextChange}
        returnKeyType="done"
        accessibilityLabel="Destination"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.savedList}>
        <Text style={styles.savedHeading}>Saved places</Text>
        {SAVED_DESTINATION_PLACES.map((place) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  input: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.surface.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    fontSize: typography.size.body,
    color: colors.ink[900],
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    fontWeight: typography.weight.medium,
  },
  savedList: {
    gap: spacing[2],
  },
  savedHeading: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
