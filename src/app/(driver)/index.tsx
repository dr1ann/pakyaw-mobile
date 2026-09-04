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

import { LocationLoader } from '@pakyaw/shared/components/ui/LocationLoader';
import { colors, shadow, spacing } from '@/constants/theme';
import { OfflineSheet } from '@/features/driver-availability/components/OfflineSheet';
import { OnlineSheet } from '@/features/driver-availability/components/OnlineSheet';
import { PreflightChecklist } from '@/features/driver-availability/components/PreflightChecklist';
import { DriverAccountNotReadyError } from '@/features/driver-availability/errors';
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
import { PersistentDriverTripDashboard } from '@/features/trip/components/PersistentDriverTripDashboard';
import { BoardingConfirmationToast } from '@/features/trip/components/BoardingConfirmationToast';
import { LiveMap, type MapPassengerStop } from '@pakyaw/shared/features/trip/components/LiveMap';
import { useSharedRideSession } from '@/features/shared-ride/hooks/useSharedRideSession';
import { useActiveTrip } from '@pakyaw/shared/features/trip/hooks/useActiveTrip';
import { useTripProgressPublisher } from '@/features/trip/hooks/useTripProgressPublisher';
import { usePassengerLiveLocation } from '@/features/trip/hooks/usePassengerLiveLocation';
import type { TripStatus } from '@pakyaw/shared/features/trip/types';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useDriverRouteQuery } from '@/features/maps/hooks/useDriverRouteQuery';
import { useDriverHeading } from '@/features/maps/hooks/useDriverHeading';
import { useInterpolatedCoordinate } from '@pakyaw/shared/features/maps/hooks/useInterpolatedCoordinate';
import { useRideCameraController } from '@pakyaw/shared/features/maps/hooks/useRideCameraController';
import { useManeuverProgress } from '@/features/maps/hooks/useManeuverProgress';
import { useVoiceGuidance } from '@/features/maps/hooks/useVoiceGuidance';
import { NavigationBanner } from '@/features/maps/components/NavigationBanner';
import { PipNavigationView } from '@/features/maps/components/PipNavigationView';
import { RecenterButton } from '@/features/maps/components/RecenterButton';
import { CompassModeToggle } from '@/features/maps/components/CompassModeToggle';
import {
  getAutomaticNavigationStatus,
} from '@pakyaw/shared/features/maps/navigation/navigationHelper';
import { useNavigationLifecycle } from '@/features/maps/navigation/useNavigationLifecycle';
import { usePictureInPicture } from '@/features/maps/navigation/usePictureInPicture';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { getBearingAlongPolyline, snapPointToPolyline } from '@pakyaw/shared/lib/geoProjection';
import { useUiStore } from '@/stores/uiStore';

export default function DriveScreen() {
  const mapRef = useRef<MapView>(null);
  const availability = useAvailabilityStore((s) => s.availability);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const incomingRequests = useAvailabilityStore((s) => s.incomingRequests);
  const trip = useActiveTripStore((s) => s.trip);
  const tripId = useActiveTripStore((s) => s.tripId);

  const [showPreflight, setShowPreflight] = useState(false);
  const [expandedTripStatus, setExpandedTripStatus] = useState<TripStatus | null>(null);

  // Location subscription — starts/stops with availability & AppState.
  // Phase 7: subscribe to nearby trip requests while online.
  useIncomingRequests();

  // Phase 8E: subscribe to active trip document.
  useActiveTrip();

  const { sharedRide, sharedRideId } = useSharedRideSession();

  const [boardingToastVisible, setBoardingToastVisible] = useState(false);
  const [lastPassengerCount, setLastPassengerCount] = useState(0);
  const sharedRidePassengers = sharedRide?.passengers;
  const passengerCount = sharedRidePassengers?.length ?? 0;

  if (passengerCount !== lastPassengerCount) {
    if (passengerCount > lastPassengerCount && lastPassengerCount > 0) {
      setBoardingToastVisible(true);
    }
    setLastPassengerCount(passengerCount);
  }

  const passengerStops = useMemo<MapPassengerStop[]>(() => {
    if (!sharedRidePassengers) return [];
    const stops: MapPassengerStop[] = [];
    sharedRidePassengers.forEach((p, idx) => {
      if (p.pickup?.coords) {
        stops.push({
          id: `${p.passengerId}-pickup-${idx}`,
          type: 'pickup',
          passengerName: p.passengerName || `Passenger ${idx + 1}`,
          location: { latitude: p.pickup.coords.lat, longitude: p.pickup.coords.lng },
        });
      }
      if (p.destination?.coords) {
        stops.push({
          id: `${p.passengerId}-dest-${idx}`,
          type: 'destination',
          passengerName: p.passengerName || `Passenger ${idx + 1}`,
          location: { latitude: p.destination.coords.lat, longitude: p.destination.coords.lng },
        });
      }
    });
    return stops;
  }, [sharedRidePassengers]);

  const navHeading = useActiveTripStore((s) => s.navHeading);
  const arrowRotation = useActiveTripStore((s) => s.arrowRotation);
  const navStepIndex = useActiveTripStore((s) => s.navStepIndex);

  // Marker rotation compensates for the lag between the camera heading
  // (animated, 500ms) and the actual road direction (instant arrowRotation).
  // React-native-maps marker rotation is in screen space for billboard markers:
  // rotation={0} = "up" on screen, which equals camera heading on the map.
  // To point the arrow to the actual road direction, we rotate it by the
  // difference between the road heading and the animated camera heading.
  const navigationArrowRotation = useMemo(() => {
    if (arrowRotation == null || navHeading == null) return 0;
    let delta = arrowRotation - navHeading;
    // Normalize to shortest arc [-180, 180)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
  }, [arrowRotation, navHeading]);
  const driverLocation = useActiveTripStore((s) => s.driverLocation);
  const optimisticNavEngaged = useActiveTripStore((s) => s.optimisticNavEngaged);
  const gpsSpeed = useActiveTripStore((s) => s.gpsSpeed);

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

  // Temporary Passenger live location subscription for pre-pickup coordination
  const { passengerLocation } = usePassengerLiveLocation(
    trip?.id ?? null,
    trip?.status ?? null,
    trip?.pickup?.coords ?? null
  );

  // Availability mutations.
  const goOnlineMutation = useGoOnlineMutation();
  const goOfflineMutation = useGoOfflineMutation();

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handlePressGoOnline() {
    goOnlineMutation.reset();
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
        setShowPreflight(false);
        logger.warn('[drive] goOnline was rejected', {
          errorKind: err instanceof Error ? err.name : 'unknown',
        });
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
  // Under the pessimistic model, the "on trip" UI state is driven by the
  // Firestore trip document (via tripId + useActiveTrip) rather than by a
  // client-predicted availability flag. This means the sheet only transitions
  // to the trip lifecycle sheets once the authoritative trip snapshot lands —
  // if the accept transaction succeeded but the snapshot is still in-flight,
  // the Accept button stays in its loading state instead of showing an empty
  // "on trip" sheet with no data (Grab / Uber parity).
  const isOnTrip = trip != null || tripId != null;
  const isTripTerminal =
    trip?.status === 'completed' || trip?.status === 'cancelled';
  const isTripInProgress = trip?.status === 'in_progress';
  const isTripSheetExpanded = expandedTripStatus === trip?.status;
  const ownLocation =
    lastLatitude !== null && lastLongitude !== null
      ? { latitude: lastLatitude, longitude: lastLongitude }
      : null;
  const pickupLocation = !isTripTerminal && trip?.pickup?.coords
    ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
    : null;
  const destinationLocation = !isTripTerminal && trip?.destination?.coords
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
  const navigationCoordinate = useInterpolatedCoordinate(navigationTargetCoordinate, gpsSpeed, navHeading);

  // Route bearing at the driver's current position on the polyline. Used as
  // a stationary heading fallback so the arrow keeps pointing down the road
  // when GPS course is unavailable — matches Google Maps behavior when the
  // vehicle idles at a light. See useDriverHeading's route-bearing branch.
  const routeBearing = useMemo(() => {
    if (!navigationTargetCoordinate || currentRoutePolyline.length < 2) return null;
    return getBearingAlongPolyline(
      {
        lat: navigationTargetCoordinate.latitude,
        lng: navigationTargetCoordinate.longitude,
      },
      currentRoutePolyline
    );
  }, [navigationTargetCoordinate, currentRoutePolyline]);

  // Fused heading — GPS-course first, route-bearing fallback when stationary,
  // magnetometer only when the user has explicitly enabled Compass Mode.
  useDriverHeading(trip?.status ?? null, { routeBearing });

  // Navigation Mode (tilted driving camera) starts automatically for active
  // driving legs. Other trip phases stay in overview mode.
  // Navigation Mode (tilted driving camera) engages for active driving legs.
  // Derived directly from trip.status (Firestore source of truth) to avoid the
  // one-render lag that occurred when comparing against a Zustand mirror.
  const isDriving = getAutomaticNavigationStatus(trip?.status) !== null;

  // Once Firestore confirms a nav-active status, the optimistic camera flag
  // has served its purpose — clear it so the authoritative isDriving drives
  // everything going forward and the flag can't linger across trips.
  useEffect(() => {
    if (isDriving && useActiveTripStore.getState().optimisticNavEngaged) {
      useActiveTripStore.getState().setOptimisticNavEngaged(false);
    }
  }, [isDriving]);

  // The leg the driver is currently working: head to pickup until they reach
  // the passenger, then head to destination. Used to frame the overview camera.
  const headingToDestination =
    trip?.status === 'driver_arrived' || trip?.status === 'in_progress';
  const legTarget = headingToDestination ? destinationLocation : pickupLocation;
  const overviewCoordinates =
    !isDriving &&
    trip?.status === 'accepted' &&
    navigationCoordinate &&
    legTarget
      ? [navigationCoordinate, legTarget]
      : null;

  // Engagement-ready coordinate: whatever the freshest, non-null position is.
  // Prefer the interpolated coord (smooth) but fall back to the raw one so the
  // Navigation Mode camera can engage on the very first frame instead of
  // waiting for the interpolator's first published sample.
  const navEngagementCoordinate = navigationCoordinate ?? rawNavigationCoordinate;

  // The Navigation Mode camera engages the instant the driver presses Start
  // Navigation (optimisticNavEngaged), without waiting for the Firestore
  // transition round-trip to confirm trip.status. This matches the immediate
  // response of the recenter/compass paths, which fire the camera off local
  // GPS synchronously. `isDriving` (authoritative, Firestore-derived) is kept
  // separate for everything that should wait for confirmation — sheets, voice,
  // PiP — so only the camera is decoupled from the round-trip.
  const cameraNavEnabled = isDriving || optimisticNavEngaged;

  const cameraController = useRideCameraController(mapRef, {
    pickupLocation,
    destinationLocation,
    driverLocation: navigationCoordinate,
    ownLocation: navigationCoordinate,
    phase: isOnTrip && !cameraNavEnabled ? 'terminal' : 'booking',
    overviewCoordinates,
    navigation: {
      enabled: cameraNavEnabled,
      coordinate: navEngagementCoordinate,
      // Prefer the fused heading; fall back to the route bearing so the
      // engagement sweep uses a real forward direction instead of 0° while
      // the first GPS course sample arrives.
      heading: navHeading ?? routeBearing,
      speed: gpsSpeed,
      // Non-zero duration for streaming follow updates so the camera transitions
      // smoothly when the route polyline resolves and the heading/coordinate
      // shift from raw-GPS (0°/un-snapped) to fused (route bearing/snapped).
      // The engagement frame still overrides to NAV_CAMERA_ANIM_MS (600ms).
      animationDurationMs: 500,
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
    (availability === 'online' || (availability === 'on_trip' && sharedRideId != null))
      && incomingRequests.length > 0;
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
        ownLocation={navigationTargetCoordinate}
        pickupLocation={pickupLocation}
        destinationLocation={destinationLocation}
        showDestination={destinationLocation != null}
        showDriverRoute={
          !isTripTerminal &&
          trip?.status !== 'driver_arrived' &&
          (trip?.status === 'accepted' ||
            trip?.status === 'driver_arriving' ||
            trip?.status === 'in_progress')
        }
        driverRouteVariant={isTripInProgress ? 'trip' : 'pickup'}
        routePolyline={
          isTripTerminal || isTripInProgress ? null : trip?.route?.polyline ?? null
        }
        driverRoutePolyline={
          isTripTerminal || trip?.status === 'driver_arrived'
            ? null
            : driverRouteData?.overviewPolyline ?? null
        }
        driverRouteProgressCoordinate={navigationTargetCoordinate}
        showRouteStatus={isRerouting}
        routeStatusLabel={isRerouting ? 'Rerouting...' : 'Finding route...'}
        showNavigationArrow={cameraNavEnabled}
        navigationArrowRotation={navigationArrowRotation}
        navigationActive={cameraNavEnabled}
        passengerStops={passengerStops}
        passengerLiveLocation={passengerLocation}
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
          <IncomingRequestCard key={topRequest.offerId} request={topRequest} />
        </SafeAreaView>
      ) : null}

      {/* Bottom sheet area */}
      {!isInPip && (
      <SafeAreaView edges={['bottom']} style={styles.sheetArea} pointerEvents="box-none">
        {/* Compass Mode toggle — Google Maps parity. Visible whenever the
            driving camera is engaged so it can be toggled mid-drive without
            leaving the map. useDriverHeading subscribes/unsubscribes on the
            same flag, so heading behavior switches immediately. */}
        <CompassModeToggle visible={isDriving} />

        {/* Recenter Camera Button */}
        <RecenterButton
          visible={
            isDriving &&
            cameraController.userPanned
          }
          onPress={cameraController.recenter}
        />

        <View style={[styles.sheetCard, shadow.float]}>
          {isOnTrip || sharedRide != null ? (
            <PersistentDriverTripDashboard
              trip={trip}
              sharedRide={sharedRide}
              remainingDistanceMeters={progressStats.remainingDistanceMeters}
              etaSeconds={progressStats.etaSeconds}
              onDismissTerminal={handleDismissTerminal}
            />
          ) : isOffline ? (
            <OfflineSheet
              onPressGoOnline={handlePressGoOnline}
              locationPermissionDenied={locationPermissionDenied}
              goingOnline={goOnlineMutation.isPending}
              availabilityErrorMessage={
                goOnlineMutation.error instanceof DriverAccountNotReadyError
                  ? goOnlineMutation.error.message
                  : goOnlineMutation.isError
                    ? 'We could not update your availability. Check your connection and try again.'
                    : null
              }
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

      {/* Passenger Boarding Confirmation Toast */}
      <BoardingConfirmationToast
        visible={boardingToastVisible}
        onDismiss={() => setBoardingToastVisible(false)}
      />

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
