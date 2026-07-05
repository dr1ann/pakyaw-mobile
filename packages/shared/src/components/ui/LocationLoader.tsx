import { colors, radius, spacing, typography } from '@/constants/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LocationLoaderProps = {
  readonly theme?: 'passenger' | 'driver';
  readonly message?: string;
};

export function LocationLoader({ theme = 'passenger', message = 'Fetching location...' }: LocationLoaderProps) {
  const spinnerColor = theme === 'driver' ? colors.green.primary : colors.blue.primary;
  const pillBgColor = theme === 'driver' ? colors.green.tint : colors.blue.tint;
  const textColor = theme === 'driver' ? colors.ink[900] : colors.blue.deep;

  return (
    <View style={styles.container} testID="location-loader">
      <View style={[styles.pill, { backgroundColor: pillBgColor }]}>
        <ActivityIndicator size="small" color={spinnerColor} />
        <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)', // Very light overlay to keep the map and content visible
    zIndex: 9999,
    paddingBottom: 10, // Shift the loading pill to float slightly above the bottom sheet
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2] + 2, // 10px
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    gap: spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
});
