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
          <Text style={styles.title}>You&apos;re off the road</Text>
          <Text style={styles.subtitle}>
            Tap Go Online to start accepting rides.
          </Text>
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
      // settings handler is available. Nothing meaningful to surface to the
      // user in that case.
    });
  }

  return (
    <View style={styles.permissionContainer} testID="location-permission-error">
      {/* aria-hidden: the emoji is decorative; screen readers announce the title */}
      <Text style={styles.permissionIcon} accessibilityElementsHidden importantForAccessibility="no">
        📍
      </Text>
      <Text style={styles.permissionTitle}>Location Access Required</Text>
      <Text style={styles.permissionBody}>
        Pakyaw needs your location to connect you with nearby passengers. Please
        enable location access in your device settings.
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOffline: {
    backgroundColor: colors.ink[400],
  },
  statusLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[400],
    letterSpacing: typography.letterSpacing.label,
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.body,
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
