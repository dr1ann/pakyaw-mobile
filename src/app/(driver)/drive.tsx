/**
 * Drive screen — (driver)/drive.tsx
 *
 * Phase 5 implementation:
 * - Full-bleed placeholder map View (real Google Maps deferred — Phase 8).
 * - Status-driven bottom sheet (offline → online).
 * - PreflightChecklist modal sheet (opens before going online).
 * - useLocationPublisher manages the foreground watch subscription.
 * - Contracts are shaped so a Google Maps implementation can replace the
 *   placeholder View without changing any service or store contract.
 *
 * Phase 8E addition:
 * - When driver has an active trip (on_trip), the bottom sheet switches to
 *   trip lifecycle sheets driven by trip.status.
 *
 * Navigation pattern (navigation.md §5.2):
 *   availability 'offline'  → OfflineSheet (power button)
 *   power tapped            → PreflightChecklist (modal sheet over dimmed map)
 *   availability 'online'   → OnlineSheet (+ IncomingRequestCard in Phase 7)
 *   active trip (on_trip)   → Trip status sheets (Phase 8E)
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow, spacing } from '@/constants/theme';
import { OfflineSheet } from '@/features/driver-availability/components/OfflineSheet';
import { OnlineSheet } from '@/features/driver-availability/components/OnlineSheet';
import { PreflightChecklist } from '@/features/driver-availability/components/PreflightChecklist';
import {
  useGoOfflineMutation,
  useGoOnlineMutation,
} from '@/features/driver-availability/hooks/useAvailability';
import { useLocationPublisher } from '@/features/driver-availability/hooks/useLocationPublisher';
import { IncomingRequestCard } from '@/features/matching/components/IncomingRequestCard';
import { useIncomingRequests } from '@/features/matching/hooks/useIncomingRequests';
import {
  DriverAcceptedSheet,
  DriverArrivedSheet,
  DriverCancelledSheet,
  DriverCompletedSheet,
  DriverEnRouteSheet,
  DriverInTripSheet,
} from '@/features/trip/components/DriverTripSheets';
import { LiveMap } from '@/features/trip/components/LiveMap';
import { useActiveTrip } from '@/features/trip/hooks/useActiveTrip';
import type { TripStatus } from '@/features/trip/types';
import { logger } from '@/lib/logger';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useDriverRouteQuery } from '@/features/maps/hooks/useDriverRouteQuery';
import { useDriverHeading } from '@/features/maps/hooks/useDriverHeading';
import { useNavigationCamera } from '@/features/maps/hooks/useNavigationCamera';
import { useManeuverProgress } from '@/features/maps/hooks/useManeuverProgress';
import { NavigationBanner } from '@/features/maps/components/NavigationBanner';
import { RecenterButton } from '@/features/maps/components/RecenterButton';
import { isNavActiveStatus } from '@/features/maps/navigation/navigationHelper';

export default function DriveScreen() {
  const availability = useAvailabilityStore((s) => s.availability);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const incomingRequests = useAvailabilityStore((s) => s.incomingRequests);
  const trip = useActiveTripStore((s) => s.trip);

  const [showPreflight, setShowPreflight] = useState(false);

  // Location subscription — starts/stops with availability & AppState.
  const { locationPermissionDenied } = useLocationPublisher();

  // Phase 7: subscribe to nearby trip requests while online.
  useIncomingRequests();

  // Phase 8E: subscribe to active trip document.
  useActiveTrip();

  // Fused heading (magnetometer + GPS)
  useDriverHeading(trip?.status ?? null);

  // Camera mode controller (follow/overview auto-recenter)
  const { handleUserPan } = useNavigationCamera(trip?.status ?? null);

  const navCameraMode = useActiveTripStore((s) => s.navCameraMode);
  const navHeading = useActiveTripStore((s) => s.navHeading);
  const navStepIndex = useActiveTripStore((s) => s.navStepIndex);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);

  // Fetch driver navigation route leg/polyline locally
  const { data: driverRouteData } = useDriverRouteQuery(trip?.id ?? null);

  // Calculate local maneuver progression
  const progressStats = useManeuverProgress(driverRouteData ?? null, driverLocation);

  // Availability mutations.
  const goOnlineMutation = useGoOnlineMutation();
  const goOfflineMutation = useGoOfflineMutation();

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handlePressGoOnline() {
    setShowPreflight(true);
  }

  function handlePreflightClose() {
    setShowPreflight(false);
  }

  function handlePreflightConfirm() {
    logger.info('[drive] handlePreflightConfirm tapped — firing goOnline mutation');
    // PreflightChecklist disables its confirm button until all items are checked,
    // so reaching this handler is itself the preflight-passed signal.
    goOnlineMutation.mutate(true, {
      onSuccess: () => {
        logger.info('[drive] goOnline succeeded — closing preflight sheet');
        setShowPreflight(false);
      },
      onError: (err) => {
        logger.error('[drive] goOnline mutation onError', err);
      },
    });
  }

  function handleGoOffline() {
    goOfflineMutation.mutate();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isOffline = availability === 'offline';
  const isOnTrip = availability === 'on_trip';
  const showIncomingCard =
    availability === 'online' && incomingRequests.length > 0;
  const topRequest = showIncomingCard ? incomingRequests[0] : null;

  function handleDismissTerminal() {
    useAvailabilityStore.getState().setAvailability('online');
    useActiveTripStore.getState().clearTrip();
  }

  return (
    <View style={styles.root}>
      {/* ── Real Map View (full-bleed) ─────────────────────────────────────── */}
      <LiveMap
        ownLocation={
          lastLatitude !== null && lastLongitude !== null
            ? { latitude: lastLatitude, longitude: lastLongitude }
            : null
        }
        pickupLocation={
          trip?.pickup?.coords
            ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
            : null
        }
        destinationLocation={
          trip?.destination?.coords
            ? { latitude: trip.destination.coords.lat, longitude: trip.destination.coords.lng }
            : null
        }
        showDestination={trip?.status === 'in_progress' || trip?.status === 'completed'}
        showDriverRoute={trip?.status === 'accepted' || trip?.status === 'driver_arriving' || trip?.status === 'in_progress'}
        routePolyline={trip?.route?.polyline ?? null}
        driverRoutePolyline={driverRouteData?.polyline ?? null}
        navigation={
          isNavActiveStatus(trip?.status)
            ? {
                mode: navCameraMode,
                center: driverLocation,
                heading: navHeading,
              }
            : undefined
        }
        onUserPan={handleUserPan}
      />

      {/* Turn-by-turn Navigation Banner */}
      {isNavActiveStatus(trip?.status) && trip?.status !== 'driver_arrived' && driverRouteData && (
        <NavigationBanner
          currentStep={driverRouteData.steps[navStepIndex] ?? null}
          distanceToManeuver={progressStats.distanceToManeuver}
        />
      )}

      {/* Recenter Camera Button */}
      <RecenterButton
        visible={
          isNavActiveStatus(trip?.status) &&
          navCameraMode === 'overview'
        }
        onPress={() => useActiveTripStore.getState().setNavCameraMode('follow')}
      />

      {/* ── Incoming request overlay (Phase 7) ────────────────────────────
          Floats above the OnlineSheet as a separate layer so the map stays
          visible behind it and the sheet's rounded card is untouched.
      ─────────────────────────────────────────────────────────────────── */}
      {topRequest != null ? (
        <SafeAreaView
          edges={['top']}
          style={styles.incomingArea}
          pointerEvents="box-none"
        >
          <IncomingRequestCard request={topRequest} />
        </SafeAreaView>
      ) : null}

      {/* ── Bottom sheet area ─────────────────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
        <View style={[styles.sheetCard, shadow.float]}>
          {isOnTrip ? (
            <DriverTripSheet
              status={trip?.status ?? null}
              onDismiss={handleDismissTerminal}
              remainingDistanceMeters={progressStats.remainingDistanceMeters}
              etaSeconds={progressStats.etaSeconds}
            />
          ) : isOffline ? (
            <OfflineSheet
              onPressGoOnline={handlePressGoOnline}
              locationPermissionDenied={locationPermissionDenied}
              goingOnline={goOnlineMutation.isPending}
            />
          ) : (
            <OnlineSheet
              availability={availability}
              onPressGoOffline={handleGoOffline}
              goingOffline={goOfflineMutation.isPending}
              lastLatitude={lastLatitude}
              lastLongitude={lastLongitude}
            />
          )}
        </View>
      </SafeAreaView>

      {/* ── Pre-flight checklist modal ────────────────────────────────────── */}
      <PreflightChecklist
        visible={showPreflight}
        onClose={handlePreflightClose}
        onConfirm={handlePreflightConfirm}
        loading={goOnlineMutation.isPending}
      />
    </View>
  );
}

// ── Driver trip sheet switcher ──────────────────────────────────────────────

type DriverTripSheetProps = {
  status: TripStatus | null;
  onDismiss: () => void;
  remainingDistanceMeters: number | null;
  etaSeconds: number | null;
};

function DriverTripSheet({
  status,
  onDismiss,
  remainingDistanceMeters,
  etaSeconds,
}: DriverTripSheetProps) {
  switch (status) {
    case 'accepted':
      return <DriverAcceptedSheet />;
    case 'driver_arriving':
      return (
        <DriverEnRouteSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
        />
      );
    case 'driver_arrived':
      return <DriverArrivedSheet />;
    case 'in_progress':
      return (
        <DriverInTripSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
        />
      );
    case 'completed':
      return <DriverCompletedSheet onDismiss={onDismiss} />;
    case 'cancelled':
      return <DriverCancelledSheet onDismiss={onDismiss} />;
    default:
      // Fallback — shouldn't happen when on_trip, but safe.
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  sheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetCard: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  incomingArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
});

