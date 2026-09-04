/**
 * Drive screen — (driver)/index.tsx
 *
 * Phase 10: Driver Home & Availability
 * - Full-bleed real map view centered on driver.
 * - Server-authoritative status-driven bottom sheet (Offline → Online / On Trip).
 * - PreflightChecklist modal sheet before going online.
 * - Real-time drivers/{uid} listener to auto-restore active trips and server availability.
 * - Recenter button accessible anytime driver pans away from their location.
 * - Meaningful, actionable error presentation for blocked availability reasons.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
import { PersistentDriverTripDashboard } from '@/features/trip/components/PersistentDriverTripDashboard';
import { BoardingConfirmationToast } from '@/features/trip/components/BoardingConfirmationToast';
import { LiveMap, type MapPassengerStop } from '@pakyaw/shared/features/trip/components/LiveMap';
import { useSharedRideSession } from '@/features/shared-ride/hooks/useSharedRideSession';
import { useActiveTrip } from '@pakyaw/shared/features/trip/hooks/useActiveTrip';
import { useTripProgressPublisher } from '@/features/trip/hooks/useTripProgressPublisher';
import { usePassengerLiveLocation } from '@/features/trip/hooks/usePassengerLiveLocation';
import { logger } from '@pakyaw/shared/lib/logger';
import { useActiveTripStore } from '@pakyaw/shared/stores/activeTripStore';
import { useAvailabilityStore } from '@/stores/availabilityStore';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { doc, firestore, onSnapshot } from '@/services/firebase/firebase';
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
import { getBearingAlongPolyline, snapPointToPolyline } from '@pakyaw/shared/lib/geoProjection';
import { useUiStore } from '@/stores/uiStore';

export default function DriveScreen() {
  const mapRef = useRef<MapView>(null);
  const uid = useSessionStore((s) => s.uid);
  const availability = useAvailabilityStore((s) => s.availability);
  const lastLatitude = useAvailabilityStore((s) => s.lastLatitude);
  const lastLongitude = useAvailabilityStore((s) => s.lastLongitude);
  const incomingRequests = useAvailabilityStore((s) => s.incomingRequests);
  const trip = useActiveTripStore((s) => s.trip);
  const tripId = useActiveTripStore((s) => s.tripId);

  const [showPreflight, setShowPreflight] = useState(false);

  // Sync active trip and availability directly from drivers/{uid} document
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(firestore, 'drivers', uid), (snap) => {
      if (snap && snap.exists) {
        const data = snap.data();
        const serverActiveTripId = data?.activeTripId;
        const serverAvailability = data?.availability;

        if (typeof serverActiveTripId === 'string' && serverActiveTripId.trim().length > 0) {
          useActiveTripStore.getState().setTripId(serverActiveTripId.trim());
          useAvailabilityStore.getState().setAvailability('on_trip');
        } else if (serverActiveTripId === null) {
          if (useActiveTripStore.getState().tripId) {
            useActiveTripStore.getState().clearTrip();
          }
        }

        if (
          serverAvailability === 'online' ||
          serverAvailability === 'offline' ||
          serverAvailability === 'on_trip'
        ) {
          useAvailabilityStore.getState().setAvailability(serverAvailability);
        }
      }
    });

    return () => unsub();
  }, [uid]);

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
    trip?.pickup?.coords ?? null,
    trip?.bookingFor ?? null
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
        Alert.alert(
          'Cannot Go Online',
          err instanceof Error
            ? err.message
            : 'Unable to update availability. Please check your verification status and try again.',
        );
      },
    });
  }

  function handleGoOffline() {
    goOfflineMutation.mutate();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isOffline = availability === 'offline';
  // Under the pessimistic model, the "on trip" UI state is driven by the
  // Firestore trip document (via tripId + useActiveTrip) rather than by a
  // client-predicted availability flag. This means the sheet only transitions
  // to the trip lifecycle sheets once the authoritative trip snapshot lands.
  const isOnTrip = trip != null || tripId != null;
  const isTripTerminal =
    trip?.status === 'completed' || trip?.status === 'cancelled';
  const isTripInProgress = trip?.status === 'in_progress';
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
  // vehicle idles at a light.
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

  // Navigation Mode (tilted driving camera) starts automatically for active driving legs.
  const isDriving = getAutomaticNavigationStatus(trip?.status) !== null;

  // Once Firestore confirms a nav-active status, clear the optimistic flag.
  useEffect(() => {
    if (isDriving && useActiveTripStore.getState().optimisticNavEngaged) {
      useActiveTripStore.getState().setOptimisticNavEngaged(false);
    }
  }, [isDriving]);

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

  const navEngagementCoordinate = navigationCoordinate ?? rawNavigationCoordinate;
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
      heading: navHeading ?? routeBearing,
      speed: gpsSpeed,
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

      {/* Incoming request overlay */}
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
        {/* Compass Mode toggle — visible when driving camera is engaged */}
        <CompassModeToggle visible={isDriving} />

        {/* Recenter Camera Button — visible whenever driver has panned away */}
        <RecenterButton
          visible={cameraController.userPanned}
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
  incomingArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
});
