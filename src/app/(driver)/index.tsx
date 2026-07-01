/**
 * Drive screen — (driver)/index.tsx
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationLoader } from '@/components/ui/LocationLoader';
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
import { useTripProgressPublisher } from '@/features/trip/hooks/useTripProgressPublisher';
import type { TripStatus } from '@/features/trip/types';
import { logger } from '@/lib/logger';
import { useActiveTripStore } from '@/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useDriverRouteQuery } from '@/features/maps/hooks/useDriverRouteQuery';
import { useDriverHeading } from '@/features/maps/hooks/useDriverHeading';
import { useInterpolatedCoordinate } from '@/features/maps/hooks/useInterpolatedCoordinate';
import { useRideCameraController } from '@/features/maps/hooks/useRideCameraController';
import { useManeuverProgress } from '@/features/maps/hooks/useManeuverProgress';
import { useVoiceGuidance } from '@/features/maps/hooks/useVoiceGuidance';
import { NavigationBanner } from '@/features/maps/components/NavigationBanner';
import { PipNavigationView } from '@/features/maps/components/PipNavigationView';
import { RecenterButton } from '@/features/maps/components/RecenterButton';
import {
  getAutomaticNavigationStatus,
  isNavActiveStatus,
} from '@/features/maps/navigation/navigationHelper';
import { useNavigationLifecycle } from '@/features/maps/navigation/useNavigationLifecycle';
import { usePictureInPicture } from '@/features/maps/navigation/usePictureInPicture';
import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { snapPointToPolyline } from '@/lib/geoProjection';
import { useUiStore } from '@/stores/uiStore';

export default function DriveScreen() {
  const mapRef = useRef<MapView>(null);
  const availability = useAvailabilityStore((s) => s.availability);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const incomingRequests = useAvailabilityStore((s) => s.incomingRequests);
  const trip = useActiveTripStore((s) => s.trip);

  const [showPreflight, setShowPreflight] = useState(false);
  const [expandedTripStatus, setExpandedTripStatus] = useState<TripStatus | null>(null);

  // Location subscription — starts/stops with availability & AppState.
  // Phase 7: subscribe to nearby trip requests while online.
  useIncomingRequests();

  // Phase 8E: subscribe to active trip document.
  useActiveTrip();

  // Fused heading (magnetometer + GPS)
  useDriverHeading(trip?.status ?? null);

  const navHeading = useActiveTripStore((s) => s.navHeading);
  const navStepIndex = useActiveTripStore((s) => s.navStepIndex);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const navActiveStatus = useActiveTripStore((s) => s.navActiveStatus);
  const setNavActiveStatus = useActiveTripStore((s) => s.setNavActiveStatus);

  useEffect(() => {
    const automaticNavStatus = getAutomaticNavigationStatus(trip?.status);
    if (navActiveStatus !== automaticNavStatus) {
      setNavActiveStatus(automaticNavStatus);
    }
  }, [navActiveStatus, setNavActiveStatus, trip?.status]);

  // Fetch driver navigation route leg/polyline locally
  const {
    data: driverRouteData,
    isRerouting,
    refetch: refetchDriverRoute,
  } = useDriverRouteQuery(trip?.id ?? null);

  // Calculate local maneuver progression
  const progressStats = useManeuverProgress(driverRouteData ?? null, driverLocation);
  const canPublishProgress = driverRouteData != null && driverLocation != null;
  useTripProgressPublisher({
    tripId: trip?.id ?? null,
    status: trip?.status ?? null,
    remainingMeters: canPublishProgress ? progressStats.remainingDistanceMeters : null,
    etaSeconds: canPublishProgress ? progressStats.etaSeconds : null,
  });

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
        logger.error('[drive] goOnline mutation onError', { err });
      },
    });
  }

  function handleGoOffline() {
    goOfflineMutation.mutate();
  }

  function handleToggleTripSheet() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedTripStatus((expandedStatus) =>
      expandedStatus === trip?.status ? null : (trip?.status ?? null)
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isOffline = availability === 'offline';
  const isOnTrip = availability === 'on_trip';
  const isTripTerminal =
    trip?.status === 'completed' || trip?.status === 'cancelled';
  const isTripInProgress = trip?.status === 'in_progress';
  const isTripSheetExpanded = expandedTripStatus === trip?.status;
  const ownLocation =
    lastLatitude !== null && lastLongitude !== null
      ? { latitude: lastLatitude, longitude: lastLongitude }
      : null;
  const pickupLocation = trip?.pickup?.coords
    ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
    : null;
  const destinationLocation = trip?.destination?.coords
    ? { latitude: trip.destination.coords.lat, longitude: trip.destination.coords.lng }
    : null;
  const rawNavigationCoordinate = driverLocation ?? ownLocation;
  const currentRoutePolyline = useMemo(
    () => driverRouteData?.steps.flatMap((step) => step.polyline) ?? [],
    [driverRouteData?.steps]
  );
  const snappedNavigationCoordinate = useMemo(() => {
    if (!rawNavigationCoordinate || currentRoutePolyline.length === 0) {
      return null;
    }

    const snappedPoint = snapPointToPolyline(
      {
        lat: rawNavigationCoordinate.latitude,
        lng: rawNavigationCoordinate.longitude,
      },
      currentRoutePolyline
    );

    return snappedPoint
      ? { latitude: snappedPoint.lat, longitude: snappedPoint.lng }
      : null;
  }, [rawNavigationCoordinate, currentRoutePolyline]);
  const navigationTargetCoordinate = snappedNavigationCoordinate ?? rawNavigationCoordinate;
  const navigationCoordinate = useInterpolatedCoordinate(navigationTargetCoordinate);

  // Navigation Mode (tilted driving camera) starts automatically for active
  // driving legs. Other trip phases stay in overview mode.
  const isDriving =
    isNavActiveStatus(trip?.status) &&
    (navActiveStatus === trip?.status ||
      (trip?.status === 'accepted' && navActiveStatus === 'driver_arriving'));

  // The leg the driver is currently working: head to pickup until they reach
  // the passenger, then head to destination. Used to frame the overview camera.
  const headingToDestination =
    trip?.status === 'driver_arrived' || trip?.status === 'in_progress';
  const legTarget = headingToDestination ? destinationLocation : pickupLocation;
  const overviewCoordinates =
    !isDriving &&
    isNavActiveStatus(trip?.status) &&
    navigationCoordinate &&
    legTarget
      ? [navigationCoordinate, legTarget]
      : null;

  const cameraController = useRideCameraController(mapRef, {
    pickupLocation,
    destinationLocation,
    driverLocation: navigationCoordinate,
    ownLocation: navigationCoordinate,
    phase: isOnTrip && !isDriving ? 'terminal' : 'booking',
    overviewCoordinates,
    navigation: {
      enabled: isDriving,
      coordinate: navigationCoordinate,
      heading: navHeading,
      animationDurationMs: 0,
    },
  });
  useNavigationLifecycle({
    isDriving,
    forceFollow: cameraController.forceFollow,
    refetchDriverRoute,
  });
  usePictureInPicture({ isDriving });
  const { locationPermissionDenied } = useLocationPublisher();
  const isLocationLoading =
    (availability === 'online' || availability === 'on_trip') &&
    rawNavigationCoordinate === null &&
    !locationPermissionDenied;
  const isInPip = useUiStore((s) => s.pip.isInPip);
  const currentNavStep = driverRouteData?.steps[navStepIndex] ?? null;
  useVoiceGuidance({
    enabled: isDriving && trip?.status !== 'driver_arrived' && driverRouteData != null,
    currentStep: currentNavStep,
    stepIndex: navStepIndex,
    routeFetchedAt: driverRouteData?.fetchedAt ?? null,
    distanceToManeuver: progressStats.distanceToManeuver,
  });
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
        mapRef={mapRef}
        ownLocation={navigationCoordinate}
        pickupLocation={pickupLocation}
        destinationLocation={destinationLocation}
        showDestination={destinationLocation != null}
        showDriverRoute={
          !isTripTerminal &&
          (trip?.status === 'accepted' ||
            trip?.status === 'driver_arriving' ||
            trip?.status === 'in_progress')
        }
        driverRouteVariant={isTripInProgress ? 'trip' : 'pickup'}
        routePolyline={
          isTripTerminal || isTripInProgress ? null : trip?.route?.polyline ?? null
        }
        driverRoutePolyline={
          isTripTerminal ? null : driverRouteData?.overviewPolyline ?? null
        }
        driverRouteProgressCoordinate={navigationCoordinate}
        showRouteStatus={isRerouting}
        routeStatusLabel={isRerouting ? 'Rerouting...' : 'Finding route...'}
        showNavigationArrow={isDriving}
        navigationActive={isDriving}
        freezeNavigationMapPadding={isInPip}
        onMapReady={cameraController.onMapReady}
        onUserPan={cameraController.onUserPan}
      />

      {isInPip && (
        <PipNavigationView
          currentStep={currentNavStep}
          distanceToManeuver={progressStats.distanceToManeuver}
          etaSeconds={progressStats.etaSeconds}
        />
      )}

      {/* Turn-by-turn Navigation Banner */}
      {!isInPip && isDriving && trip?.status !== 'driver_arrived' && driverRouteData && (
        <NavigationBanner
          currentStep={currentNavStep}
          distanceToManeuver={progressStats.distanceToManeuver}
        />
      )}

      {/* Incoming request overlay (Phase 7) */}
      {!isInPip && topRequest != null ? (
        <SafeAreaView
          edges={['top']}
          style={styles.incomingArea}
          pointerEvents="box-none"
        >
          <IncomingRequestCard request={topRequest} />
        </SafeAreaView>
      ) : null}

      {/* Bottom sheet area */}
      {!isInPip && (
      <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
        {/* Recenter Camera Button */}
        <RecenterButton
          visible={
            isDriving &&
            cameraController.userPanned
          }
          onPress={cameraController.recenter}
        />

        <View style={[styles.sheetCard, shadow.float]}>
          {isOnTrip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isTripSheetExpanded ? 'Collapse trip details' : 'Expand trip details'}
              onPress={handleToggleTripSheet}
              style={styles.sheetToggle}
              testID="driver-trip-sheet-toggle"
            >
              <View style={styles.sheetGrabber} />
              <View style={styles.sheetToggleLabel}>
                <SymbolIcon
                  name={isTripSheetExpanded ? 'chevron.down' : 'chevron.up'}
                  size={26}
                  tintColor={colors.ink[500]}
                />
              </View>
            </Pressable>
          ) : null}
          {isOnTrip ? (
            <DriverTripSheet
              status={trip?.status ?? null}
              onDismiss={handleDismissTerminal}
              remainingDistanceMeters={progressStats.remainingDistanceMeters}
              etaSeconds={progressStats.etaSeconds}
              compact={!isTripSheetExpanded}
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
      )}

      {/* Pre-flight checklist modal */}
      <PreflightChecklist
        visible={showPreflight}
        onClose={handlePreflightClose}
        onConfirm={handlePreflightConfirm}
        loading={goOnlineMutation.isPending}
      />
      {isLocationLoading && <LocationLoader theme="driver" />}
    </View>
  );
}

type DriverTripSheetProps = {
  status: TripStatus | null;
  onDismiss: () => void;
  remainingDistanceMeters: number | null;
  etaSeconds: number | null;
  compact: boolean;
};

function DriverTripSheet({
  status,
  onDismiss,
  remainingDistanceMeters,
  etaSeconds,
  compact,
}: DriverTripSheetProps) {
  switch (status) {
    case 'accepted':
      return <DriverAcceptedSheet compact={compact} />;
    case 'driver_arriving':
      return (
        <DriverEnRouteSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
          compact={compact}
        />
      );
    case 'driver_arrived':
      return <DriverArrivedSheet compact={compact} />;
    case 'in_progress':
      return (
        <DriverInTripSheet
          remainingDistanceMeters={remainingDistanceMeters}
          etaSeconds={etaSeconds}
          compact={compact}
        />
      );
    case 'completed':
      return <DriverCompletedSheet onDismiss={onDismiss} />;
    case 'cancelled':
      return <DriverCancelledSheet onDismiss={onDismiss} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
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
  sheetToggle: {
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  sheetGrabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing[1],
  },
  sheetToggleLabel: {
    width: 48,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
