/**
 * OfflineSheet — bottom sheet content rendered when driver is offline.
 *
 * Shows the PowerButton (go online → opens preflight) and a permission
 * error state when location was denied.
 *
 * This is a content component, not a Modal wrapper — it is rendered inline
 * inside drive.tsx's fixed bottom sheet area so the map remains visible.
 */

import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { PowerButton } from '@/features/driver-availability/components/PowerButton';

type OfflineSheetProps = {
  onPressGoOnline: () => void;
  locationPermissionDenied: boolean;
  goingOnline?: boolean;
  availabilityErrorMessage?: string | null;
};

export function OfflineSheet({
  onPressGoOnline,
  locationPermissionDenied,
  goingOnline = false,
  availabilityErrorMessage = null,
}: OfflineSheetProps) {
  return (
    <View style={styles.container}>
      {locationPermissionDenied ? (
        <LocationPermissionError />
      ) : (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.dot, styles.dotOffline]} />
            <Text style={styles.statusLabel}>OFFLINE</Text>
          </View>

          <Text style={styles.title}>Ready to drive?</Text>
          <Text style={styles.subtitle}>
            Go online to start receiving Pakyaw and Shared requests.
          </Text>

          <View style={styles.areaRow}>
            <Text style={styles.areaLabel}>Current area</Text>
            <Text style={styles.areaValue}>Ormoc City</Text>
          </View>

          <PowerButton
            isOnline={false}
            onPress={onPressGoOnline}
            loading={goingOnline}
          />

          {availabilityErrorMessage ? (
            <View
              style={styles.availabilityError}
              accessibilityRole="alert"
              testID="availability-error"
            >
              <Text style={styles.availabilityErrorTitle}>Cannot go online</Text>
              <Text style={styles.availabilityErrorBody}>{availabilityErrorMessage}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function LocationPermissionError() {
  function openSettings() {
    Linking.openSettings().catch(() => {
      // openSettings() can reject on some Android versions if no
      // settings handler is available.
    });
  }

  return (
    <View style={styles.permissionContainer} testID="location-permission-error">
      <Text style={styles.permissionIcon} accessibilityElementsHidden importantForAccessibility="no">
        📍
      </Text>
      <Text style={styles.permissionTitle}>Location Access Required</Text>
      <Text style={styles.permissionBody}>
        Location access is required while you’re online. Please enable location access in your device settings.
      </Text>
      <Button
        label="Open Settings"
        onPress={openSettings}
        fullWidth
        testID="open-settings-btn"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOffline: {
    backgroundColor: colors.ink[400],
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: 22,
  },
  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  areaLabel: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  areaValue: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  permissionContainer: {
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[4],
  },
  permissionIcon: {
    fontSize: 40,
  },
  permissionTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
  },
  availabilityError: {
    backgroundColor: colors.surface.muted,
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    gap: spacing[1],
    padding: spacing[3],
  },
  availabilityErrorTitle: {
    color: colors.ink[900],
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  availabilityErrorBody: {
    color: colors.ink[500],
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
});
