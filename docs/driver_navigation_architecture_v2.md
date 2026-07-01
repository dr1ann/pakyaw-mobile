# Driver Navigation Architecture Audit — **Version 2**

> **Scope:** investigation, audit, and documentation only. No code was changed to produce this document.
>
> **What this is:** a re-audit of the driver navigation system *as it stands today*, after the architectural work done since Version 1. Where V1 made a claim or a recommendation, this document marks it:
>
> - ✅ **Still correct** — the V1 statement holds unchanged.
> - 🔄 **Needs revision** — the V1 statement was partly right but the implementation has moved on.
> - ❌ **No longer true** — the V1 statement is now obsolete (usually because the gap it described has been closed).
>
> **Date:** 2026-07-01

---

## Table of Contents

0. [V1 → V2 Reconciliation (at a glance)](#part-0--v1--v2-reconciliation-at-a-glance)
1. [Driver GPS Lifecycle](#part-1--driver-gps-lifecycle)
2. [Navigation Route Lifecycle](#part-2--navigation-route-lifecycle)
3. [Camera Lifecycle (incl. PiP + Frustum crash prevention)](#part-3--camera-lifecycle)
4. [Navigation State Machine](#part-4--navigation-state-machine)
5. [Heading System](#part-5--heading-system)
6. [ETA & Remaining Distance](#part-6--eta--remaining-distance)
7. [Polyline Lifecycle](#part-7--polyline-lifecycle)
8. [Foreground / Background / PiP Behavior Matrix](#part-8--foreground--background--pip-behavior-matrix)
9. [Comparison with Google Maps / Grab / Uber](#part-9--comparison-with-google-maps--grab--uber)
10. [Code Reference](#part-10--code-reference)
11. [Completed Improvements (since V1)](#part-11--completed-improvements-since-v1)
12. [Remaining Improvements (tiered)](#part-12--remaining-improvements-tiered)

---

## Part 0 — V1 → V2 Reconciliation (at a glance)

V1's Executive Summary listed six systemic gaps. Here is the status of each:

| V1 claim | V2 status | Notes |
|---|---|---|
| **No background tracking** — subscription dies on minimize | ❌ **No longer true** | `TaskManager` background task now runs during online/on-trip. See [Part 1](#part-1--driver-gps-lifecycle), [Part 8](#part-8--foreground--background--pip-behavior-matrix). |
| **No projection-based / measured ETA** — ETA only refreshes on Directions call | 🔄 **Needs revision** | ETA now uses a moving-average measured-speed model with a linear fallback, recomputed every GPS fix. In-trip ETA is now also published to the passenger. See [Part 6](#part-6--eta--remaining-distance). |
| **Two overlapping driver-location stores** | ✅ **Still correct** | `availabilityStore.lastLat/Lng` and `activeTripStore.driverLocation` still coexist with the same split of responsibilities. |
| **Driving Mode is opt-in per leg** | ❌ **No longer true** | Driving Mode now auto-arms from trip status via `getAutomaticNavigationStatus`; no driver tap required. See [Part 4](#part-4--navigation-state-machine). |
| **No heading hysteresis / smoothing during transitions** | 🔄 **Needs revision** | GPS↔compass switch now has a hysteresis band (1.5 m/s enter, 1.0 m/s exit); unit-vector low-pass smoothing was already present. See [Part 5](#part-5--heading-system). |
| **No off-route hysteresis / no back-on-route detection** | ❌ **No longer true** | Off-route now requires 2 consecutive confirmations OR a heading-mismatch signal; a "Rerouting…" pill is shown. See [Part 2](#part-2--navigation-route-lifecycle). |
| **No marker snapping** (marker jitters off road) | ❌ **No longer true** | Driver position is snapped onto the route polyline before it feeds the marker + camera; frame interpolation smooths between fixes. See [Part 1](#part-1--driver-gps-lifecycle), [Part 3](#part-3--camera-lifecycle). |

V1's Tier 1–4 recommendations are individually reconciled in [Part 11](#part-11--completed-improvements-since-v1) (done) and [Part 12](#part-12--remaining-improvements-tiered) (outstanding).

**Net:** of V1's 20 numbered recommendations, **11 are now implemented**, 2 are partially implemented, and 7 remain open. The system has moved substantially closer to the Grab/Google-Maps feel V1 was measuring against.

---

## Part 1 — Driver GPS Lifecycle

### Pipeline

```
        ┌──────────────────────────────────────────────────────────────┐
        │ FOREGROUND: Location.watchPositionAsync (location.service.ts) │
        │ BestForNavigation when nav-active, else Balanced             │
        │ timeInterval 2s / distanceInterval 10m                       │
        └───────────────┬──────────────────────────────────────────────┘
                        │ every fix (un-throttled to store,
                        │ throttled to Firestore via shouldEmit)
                        ▼
   ┌────────────────────────────┐      ┌───────────────────────────────────┐
   │ onLocation callback        │      │ Firestore updateDoc               │
   │ (useLocationPublisher)     │      │ drivers/{uid}: location, geohash, │
   │ → availabilityStore        │      │ heading, locationUpdatedAt        │
   │   .setLastLocation         │      │ (≥ 4s OR ≥ 25m)                  │
   │ → activeTripStore          │      └───────────────┬───────────────────┘
   │   .setGpsLocation          │                      │
   │   (lat,lng,heading,speed)  │                      ▼
   └───────────┬────────────────┘        Passenger useDriverLocation
               │                          onSnapshot(drivers/{driverId})
               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ DRIVE SCREEN PIPELINE (drive.tsx)                            │
   │  rawNavigationCoordinate = driverLocation ?? ownLocation    │
   │  → snapPointToPolyline(...)  ── snap onto route geometry    │
   │  → useInterpolatedCoordinate ── lerp between fixes (rAF)    │
   │  → navigationCoordinate → marker + camera + route trim      │
   └──────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────────────────────────┐
        │ BACKGROUND: TaskManager task 'pakyaw-driver-background-       │
        │ location' (backgroundLocationTask.ts)                        │
        │ Balanced / 25m / 10s, foreground-service notification        │
        │ → persists last bg location to AsyncStorage                  │
        │ → throttled publishDriverLocation(uid) to Firestore         │
        └──────────────────────────────────────────────────────────────┘
```

### Foreground subscription

| Aspect | Value | File:Line |
|---|---|---|
| Owner hook | `useLocationPublisher` | `useLocationPublisher.ts:45` |
| Underlying API | `Location.watchPositionAsync` | `location.service.ts:199` |
| timeInterval | `2_000 ms` | `location.service.ts:205` |
| distanceInterval | `10 m` | `location.service.ts:204` |
| Accuracy (idle/online) | `Balanced` | `useLocationPublisher.ts:63` |
| Accuracy (nav active) | `BestForNavigation` | `useLocationPublisher.ts:62–63` |
| Nav-active set | `{accepted, driver_arriving, driver_arrived, in_progress}` | `useLocationPublisher.ts:62` |
| Accuracy change handling | restart with new accuracy; same-accuracy = no-op | `location.service.ts:182–194` |
| Store fan-out (un-throttled) | `setLastLocation` + `setGpsLocation` | `useLocationPublisher.ts:202–214` |
| Firestore write throttle | `≥ 4_000 ms OR ≥ 25 m` (`shouldEmit`) | `location.service.ts:216–225` |
| Foreground gating | stops on `background`, restarts on `active`, ignores `inactive` | `useLocationPublisher.ts:69–115` |

> 🔄 **Revises V1.** V1 said the OS hints were "conservative" (Tier 3 #14). They are unchanged (2 s / 10 m) — the snapping + interpolation layer now compensates for perceived smoothness, so tightening the raw cadence is lower priority than V1 implied.

### Background subscription (NEW since V1)

> ❌ **V1 said "Foreground only. No TaskManager, no background."** This is now false.

| Aspect | Value | File:Line |
|---|---|---|
| Task name | `pakyaw-driver-background-location` | `location.service.ts:27` |
| Registration | `TaskManager.defineTask(...)` | `backgroundLocationTask.ts:26` |
| Start / stop | `startBackgroundPublishing(uid)` / `stopBackgroundPublishing()` | `location.service.ts:110`, `129` |
| Started when | going online / on-trip (fired inside `startIfNeeded`) | `useLocationPublisher.ts:196–200` |
| Stopped when | offline / unmount | `useLocationPublisher.ts:139–164` |
| Accuracy | `Balanced`, 25 m / 10 s, deferred 25 m / 10 s | `location.service.ts:57–72` |
| Foreground service | title/body/color `#208AEF` notification | `location.service.ts:66–70` |
| UID resolution | `auth.currentUser` → `sessionStore` → AsyncStorage key | `backgroundLocationTask.ts:34–37` |
| Throttle | `shouldEmit` (same gate as foreground) | `backgroundLocationTask.ts:73–85` |
| Last-known persistence | writes `pakyaw:last-bg-location` to AsyncStorage every fix | `backgroundLocationTask.ts:62–66` |
| Background permission | `ensureBackgroundPermission()` (foreground + background grants) | `location.service.ts:94–108` |

The persisted last-background-location is what lets navigation **re-seed instantly on resume** (see [Part 3](#part-3--camera-lifecycle) / `useNavigationLifecycle`).

### Driver-location stores (unchanged split)

> ✅ **V1 still correct.** Two stores still hold driver position, by design:

- **`availabilityStore.lastLatitude / lastLongitude`** — every fix, foreground; the driver's own presence marker and the source `useDriverRouteQuery` reads for gate checks.
- **`activeTripStore.driverLocation / gpsHeading / gpsSpeed`** — set via `setGpsLocation` on every fix; carries the speed + heading the nav hooks need. `driverLocation` is updated *inside* `setGpsLocation` (`activeTripStore.ts:147–152`) so it tracks the high-frequency stream.

### Firestore writes

| Field | Writer | Cadence |
|---|---|---|
| `drivers/{uid}.location` / `.geohash` (p7) / `.heading` / `.locationUpdatedAt` | `location.service.ts:157–163` (fg) + `backgroundLocationTask.ts:88` (bg) | ≥ 4 s or ≥ 25 m |
| `trips/{tripId}.driverRoute` | `useDriverRouteQuery.ts:319–329` | to-pickup leg only, gated (polyline-change / 50 m / 15 s) |
| `trips/{tripId}.tripProgress` | `useTripProgressPublisher` → `publishTripProgress` | every 10 s during `driver_arriving` / `in_progress` |

> ❌ **Revises V1.** V1's Firestore table had no `tripProgress` row — this document/writer did not exist. See [Part 6](#part-6--eta--remaining-distance).

---

## Part 2 — Navigation Route Lifecycle

### `useDriverRouteQuery` (`src/features/maps/hooks/useDriverRouteQuery.ts`)

| Aspect | Value / Location |
|---|---|
| Routing service | `getNavigationRoute()` → Google Directions (`routingService.ts`) |
| Target | `pickupCoords` for `accepted`/`driver_arriving`; `destinationCoords` for `in_progress`; else `null` (`useDriverRouteQuery.ts:122–125`) |
| Enabled | `tripId` + driver coords + target coords + `isNavActiveStatus` + `status !== 'driver_arrived'` (`:130–136`) |
| Query key | `['driverRoute', tripId, queryCoords.lat/lng, targetCoords.lat/lng]` (`:247–254`) |
| staleTime / retry | `20_000 ms` / `2` (`:262–263`) |
| Decoded cache | `decodedRoutePointsRef` = `steps.flatMap(s => s.polyline)` (`:270`) |

### Refresh / re-route triggers

Evaluated in `checkAndUpdate` on dependency change **and** on a 5 s interval (`:239–242`):

1. **Off-route (confirmed)** — `getRouteDeviation` ≥ `OFF_ROUTE_M (50 m)` **OR** heading-mismatch, requiring `OFF_ROUTE_CONFIRMATION_COUNT (2)` consecutive confirmations → forces refetch + sets `isRerouting` (`:186–221`).
2. **Distance gate** — moved ≥ `REROUTE_MIN_MOVE_M (60 m)` since last fetch coord (`:227`).
3. **Time gate** — ≥ `REROUTE_MIN_INTERVAL_MS (25_000 ms)` elapsed (`:227`).
4. **Phase change** — `targetCoords` changes (pickup↔destination) → query key changes (`:247–254`).
5. **Trip change** — `tripId` changes → all refs + `queryCoords` reset (`:148–160`).

### Off-route detection (rewritten since V1)

> ❌ **V1 said: "single 50 m deviation triggers a full re-route. No hysteresis, no heading signal."** Both gaps are now closed.

`getRouteDeviation(point, polyline, gpsHeading, gpsSpeed)` (`:44–101`) returns:

- `distanceMeters` — min perpendicular distance to any segment (via `projectPointOnSegment`).
- `headingMismatch` — `true` when the driver has a reliable GPS course (speed ≥ `HEADING_SPEED_THRESHOLD_MS`) and it deviates from the closest segment's bearing by ≥ `HEADING_MISMATCH_DEG (100°)`.

A confirmation counter (`offRouteConfirmationCountRef`) increments while off-route and resets to 0 the moment the driver is back on route — this **is** the "back-on-route detection" V1 asked for (Tier 2 #7). Only after 2 consecutive confirmations does it reroute.

### Rerouting indicator (NEW)

> ❌ **V1 recommended a "Rerouting…" pill (Tier 2 #7). Now present.**

`isRerouting` state (`:139`) is surfaced to `drive.tsx:299–300` and rendered by `LiveMap`'s route-status pill (`showRouteStatus` / `routeStatusLabel`). It is set on confirmed off-route and cleared when the query resolves/errors (`:271–285`).

### `trip.driverRoute` publish (to-pickup only)

Unchanged from V1 semantics: published **only during the to-pickup leg** (`isToPickup`), additionally throttled by polyline-change / 50 m distance / 15 s duration (`:293–305`). The in-progress leg keeps the route client-local; the passenger's in-trip view now relies on `tripProgress` instead (see [Part 6](#part-6--eta--remaining-distance)).

### Constants

```ts
// src/features/maps/navigation/constants.ts
NAV_ZOOM = 19.1;  NAV_PITCH = 50;  NAV_ALTITUDE_M = 180;
NAV_DRIVER_SCREEN_ANCHOR = 0.85;  NAV_CAMERA_ANIM_MS = 600;
OFF_ROUTE_M = 50;                       // deviation → reroute
OFF_ROUTE_CONFIRMATION_COUNT = 2;       // consecutive confirmations   ← NEW
HEADING_MISMATCH_DEG = 100;             // course-vs-route mismatch     ← NEW
REROUTE_MIN_MOVE_M = 60;
REROUTE_MIN_INTERVAL_MS = 25_000;
HEADING_SPEED_THRESHOLD_MS = 1.5;       // GPS-enter threshold
HEADING_GPS_COURSE_DISABLE_SPEED_MS = 1.0; // GPS-exit threshold       ← NEW
```

> 🔄 **Revises V1 Tier 4 #19** ("move magic numbers into constants.ts"): the off-route + heading constants are centralized, but the `driverRoute` publish thresholds (50 m / 15 s) are **still hard-coded inline** at `:301`. Partially done.

---

## Part 3 — Camera Lifecycle

### Command model

`useRideCameraController` (`src/features/maps/hooks/useRideCameraController.ts`) reduces inputs to a single `CameraCommand`:

```
fit | centerOn | follow | navigationFollow | overview
```

| Aspect | Value | File:Line |
|---|---|---|
| Nav command | `navigationFollow` with zoom/pitch/altitude/`animationDurationMs` | `:106–116` |
| Nav anim duration | `0 ms` in drive.tsx (relies on `useInterpolatedCoordinate`) | `drive.tsx:239` |
| Off-center framing | via `mapPadding` (anchor 0.85), **not** target projection | `LiveMap.tsx:121–146`, `useRideCameraController.ts:254–259` |
| Duplicate guard | `lastExecutedCommandRef` (command key + padding) | `:190–194` |
| Pan detection | `onRegionChange` `isGesture` (continuous, first-event) | `LiveMap.tsx:340–348` |
| Pan latch | `userPanned` → `{type:'overview'}` no-op until recenter | `:102–104` |
| Recenter | `recenter()` / `forceFollow()` clears latch + `lastExecutedCommandRef` | `:400–405` |
| Persisted follow | `cameraFollowing` mirrored to store (survives restart) | `:326`, `397`, `403` |

### Frame interpolation + snapping (NEW since V1)

> ❌ **Closes V1 Tier 1 #1 (marker snapping) and #2 (interpolation).**

In `drive.tsx`:

1. `rawNavigationCoordinate = driverLocation ?? ownLocation` (`:183`).
2. `snappedNavigationCoordinate` = `snapPointToPolyline(raw, currentRoutePolyline)` (`:188–204`) — drops the driver onto the decoded route geometry so the marker/camera hug the road.
3. `navigationTargetCoordinate = snapped ?? raw` (`:205`).
4. `navigationCoordinate = useInterpolatedCoordinate(target)` (`:206`) — a `requestAnimationFrame` lerp between fixes, duration adaptive between `MIN_INTERPOLATION_MS (250)` and `MAX_INTERPOLATION_MS (2000)` (`useInterpolatedCoordinate.ts:25–32`).

This coordinate is the single source fed to the marker, the camera, and the polyline trim — so all three move together, smoothly, on the road.

### AppState gating + Frustum crash prevention

> **Camera state / lifecycle diagram:**

```
                       ┌─────────────┐
      map not ready →  │  QUEUED     │ ← app not 'active'
                       │ (command    │
                       │  buffered)  │
                       └──────┬──────┘
      onMapReady / resume     │ drain (rAF → rAF → runAfterInteractions)
                       ┌──────▼──────┐
                       │  EXECUTING  │ animateCamera / fitToCoordinates
                       └──────┬──────┘
             userPanned=true  │  recenter()/forceFollow()
                       ┌──────▼──────┐
                       │  OVERVIEW   │ (follow suppressed; no-op command)
                       │  (latched)  │
                       └─────────────┘
```

Two independent defenses against the Android `Frustum is null` NPE (`MapView.java:677`) when the GL surface is torn down:

1. **Camera gate** — `executeCommand` refuses to touch the native map unless `appStateRef.current === 'active'`; otherwise it queues the command (`useRideCameraController.ts:184–188`). On resume it drains the queue only after **two rAFs + `InteractionManager.runAfterInteractions`** so the GL surface is re-bound first (`:299–309`).
2. **PiP skip** — `navigationFollow` is skipped entirely while `useUiStore.pip.isInPip` is true on Android (`:247–250`).

### PiP integration

> ❌ **New subsystem — absent from V1.**

`usePictureInPicture({ isDriving })` (`usePictureInPicture.ts`):

- Android-only; on other platforms sets `{isInPip:false, isSupported:false}` and bails (`:23–29`).
- On `active → background` **while driving**, calls `Pip.enter({aspectRatio:16/16})` and — critically — **does not optimistically flip `isInPip`**. It commits `isInPip` only after `Pip.enter()` resolves, because a premature `true` would keep the foreground GPS stream alive against a dead surface and re-trigger the Frustum NPE (`:55–83`).
- The OS `onPipModeChanged` event is the authoritative source (`:39–45`).
- On resume, resets `isInPip:false` and re-emits current state (`:86–92`).

While in PiP, `drive.tsx` renders a compact `PipNavigationView` (maneuver icon + distance + ETA) instead of the full sheet stack (`drive.tsx:308–314`), and freezes `mapPadding` (`freezeNavigationMapPadding={isInPip}`) so the anchor math doesn't thrash on the tiny surface (`LiveMap.tsx:121–124`).

---

## Part 4 — Navigation State Machine

### Trip status (Firestore-driven, forward-only)

```
   accepted ─▶ driver_arriving ─▶ driver_arrived ─▶ in_progress ─▶ completed
       │                                                              │
       └──────────────────────────── cancelled ◀─────────────────────┘
```

### Navigation arm state (`navActiveStatus`) — auto-armed since V1

> ❌ **V1 said Driving Mode was opt-in ("driver presses Start navigation / Start trip"). Now automatic.**

```
 trip.status ──▶ getAutomaticNavigationStatus(status) ──▶ navActiveStatus
                 (driver_arriving | driver_arrived | in_progress → itself;
                  else null)                              navigationHelper.ts:11
                                                                │
 drive.tsx effect reconciles navActiveStatus to the derived value each render
 (drive.tsx:101–106)
```

`isDriving` (the tilt-camera gate) is derived in `drive.tsx:210–213`:

```ts
isDriving =
  isNavActiveStatus(trip.status) &&
  (navActiveStatus === trip.status ||
   (trip.status === 'accepted' && navActiveStatus === 'driver_arriving'));
```

The `accepted + driver_arriving` special-case bridges the brief window where the trip is `accepted` but navigation has already armed toward pickup.

### Persistence across restart (NEW since V1)

> ❌ **Closes V1 Tier 3 #17 ("Persist navActiveStatus across app restarts").**

`activeTripStore` now persists a slice to AsyncStorage (`ACTIVE_TRIP_NAV_STORAGE_KEY`), **version 3**:

```ts
PersistedActiveTripState = { tripId, navStepIndex, navActiveStatus, navSession, cameraFollowing }
```

- `partialize: getPersistedActiveTripState` (`activeTripStore.ts:72–82`, `169`).
- `migrate` (`:84–111`): v1→v2 defaults `navActiveStatus:null`; v2→v3 defaults `navSession:null` + `cameraFollowing:true`.
- **Terminal wipe:** `setTrip` eagerly clears every nav-only slice the instant `status` becomes `completed`/`cancelled` (`:122–141`) — the map, banner, voice, and camera all see a clean state without waiting for the driver to tap Done. `driverLocation` is deliberately *kept* so the terminal camera has a target.

### Navigation session (`navSession`) — NEW

Tracks the lifecycle of a driving session for background/resume handling:

```ts
NavigationSession = { startedAt, lastForegroundAt, lastBackgroundedAt }
```

Managed by `useNavigationLifecycle` (`useNavigationLifecycle.ts:108–124`): created when `isDriving` flips true, cleared when it flips false, and stamped on background/foreground transitions.

---

## Part 5 — Heading System

### Sources

| Source | API | Consumed as |
|---|---|---|
| GPS course-over-ground | `watchPositionAsync` → `coords.heading` + `speed` | `activeTripStore.gpsHeading` / `gpsSpeed` |
| Magnetometer / compass | `watchHeadingAsync` → `trueHeading` (fallback `magHeading`) | `useDriverHeading` internal ref |
| Fused / smoothed | output of `useDriverHeading` | `activeTripStore.navHeading` (camera heading) |

### Fusion with hysteresis (revised since V1)

> 🔄 **Revises V1.** V1 described a hard 1.5 m/s threshold ("source can flap") and recommended a hysteresis band (Tier 3 #12). The band now exists.

`selectHeadingSource` (`useDriverHeading.ts:34–58`) uses an asymmetric threshold:

- To **enter** GPS mode: speed ≥ `HEADING_SPEED_THRESHOLD_MS (1.5 m/s)`.
- To **stay** in GPS mode: speed ≥ `HEADING_GPS_COURSE_DISABLE_SPEED_MS (1.0 m/s)`.
- Otherwise, if a compass heading exists → `compass`; else `null`.

The `previousSource` ref feeds the band so it doesn't oscillate at ~1–1.5 m/s.

### Smoothing (unchanged)

> ✅ **V1 still correct.** Unit-vector low-pass with `SMOOTHING_FACTOR = 0.25` (`:95–119`) converts angles to cos/sin, filters, and re-derives — preventing the 359°→1° interpolation jump. Runs on every magnetometer event and every GPS telemetry change (`:139–167`).

### Lifecycle

Magnetometer subscription is bound to `isNavActiveStatus` only (battery) and torn down (with all refs reset + `navHeading:null`) when nav is inactive (`:125–159`).

### Still open

> ✅ **V1 still correct (Tier 3 #11).** The **raw GPS heading** is what is published to Firestore (`location.service.ts:147–153`, `getLocationPublishPayload`), not the fused `navHeading`. The passenger therefore still sees raw course, which is `null`/`-1` at standstill. Not yet addressed.

---

## Part 6 — ETA & Remaining Distance

### Two ETA models

| ETA | Formula / Source | Refresh |
|---|---|---|
| **Static** (Directions) | `route.durationSeconds` on `trip.driverRoute` / `trip.route` | on Directions success (gated) |
| **Adaptive** (measured) | `getAdaptiveEtaSeconds` (`useManeuverProgress.ts:38–61`) | every GPS fix |

> 🔄 **Revises V1.** V1 said the projected ETA was a pure linear `totalDuration × remaining/total`. That formula is now only the **fallback**.

`getAdaptiveEtaSeconds`:

1. If a reliable moving-average speed exists → `remainingDistanceMeters / averageSpeedMetersPerSecond`.
2. Else → linear `getRouteDurationEtaSeconds` fallback.

`getAverageReliableSpeed` (`:22–36`) averages the last `MAX_SPEED_SAMPLES (8)` GPS speeds, keeping only samples in `[MIN_RELIABLE_SPEED_MPS (1), MAX_REASONABLE_SPEED_MPS (45)]` m/s, and requires ≥ `MIN_SPEED_SAMPLES (3)` before trusting the average. Samples are collected in a rAF-batched effect and reset when speed is unreliable (`:83–103`).

> ❌ **Closes V1 Tier 1 #5 ("measured-speed ETA model").**

### Remaining distance (unchanged, projection-based)

> ✅ **V1 still correct — this was already the gold standard.**

```
distanceToManeuver   = getDistanceToStepEnd(driver, currentStep)   // projected onto step polyline
remainingDistance    = distanceToManeuver + Σ subsequent step.distanceMeters
```
`useManeuverProgress.ts:151–159`, using `projectPointOnSegment` under the hood.

### Step advance

`navStepIndex` advances when the driver is within 25 m of the next step's start **or** geometrically closer to the next step's polyline than the current one (`:119–133`).

### Live progress to the passenger (NEW since V1)

> ❌ **Closes V1 Tier 1 #4 ("live in-progress ETA + distance to the passenger").**

`useTripProgressPublisher` (`src/features/trip/hooks/useTripProgressPublisher.ts`) writes `trip.tripProgress = { remainingMeters, etaSeconds, updatedAt }`:

- Only during `driver_arriving` / `in_progress` (`PROGRESS_ACTIVE_STATUSES`).
- Throttled to `PROGRESS_PUBLISH_INTERVAL_MS (10_000 ms)`.
- Skips invalid/negative values; resets its clock on `tripId` change (`:61–88`).
- Wired in `drive.tsx:118–123`, gated on `driverRouteData != null && driverLocation != null`.

The passenger's `EnRouteSheet` / `InTripSheet` now prefer `trip.tripProgress` over the static `trip.route`/`trip.driverRoute` values.

### ETA display map (current)

| Consumer | Source | File |
|---|---|---|
| Driver EnRoute / InTrip sheet | adaptive `etaSeconds` prop, fallback to static | `DriverTripSheets.tsx` |
| Passenger EnRoute | `trip.tripProgress` → fallback `trip.driverRoute` | `EnRouteSheet.tsx` |
| Passenger InTrip | `trip.tripProgress` → fallback `trip.route` | `InTripSheet.tsx` |

---

## Part 7 — Polyline Lifecycle

### Decode → snap → trim → render

| Stage | Where |
|---|---|
| Encode (source) | Google Directions `overviewPolyline` + per-step `polyline` (`routingService.ts`) |
| Decode | `decodePolyline` (`LiveMap.tsx:187–224`) |
| Snap driver onto polyline | `snapPointToPolyline` (`drive.tsx:188–204`) |
| Trim consumed vs remaining | `splitPolylineAtClosestPoint` (`LiveMap.tsx:239–259`) |
| Render | consumed (faded) + remaining (bright) polylines (`LiveMap.tsx:373–393`) |

> ❌ **Closes V1 Tier 2 #8 ("trim consumed polyline").** The route behind the driver is drawn faded; the road ahead is bright, split at the projected driver position.

### Leg-dependent styling + duplicate suppression (Bug #1 fix)

> 🔄 **New behavior since V1.**

`LiveMap` takes `driverRouteVariant: 'pickup' | 'trip'` (`LiveMap.tsx:42`):

- `pickup` (pre-pickup leg) → violet.
- `trip` (in-progress leg) → blue, reusing the rider-facing trip styling for the live-snapped route.

`drive.tsx` sets `driverRouteVariant={isTripInProgress ? 'trip' : 'pickup'}` (`:286`) and **suppresses the static booking polyline during in-progress** (`routePolyline={isTripTerminal || isTripInProgress ? null : ...}`, `:292–294`) so the same road isn't drawn twice. On terminal status every polyline is dropped (`:295–297`).

### Colors

- Remaining: `colors.blue.primary` (trip) / `colors.violet.primary` (pickup) (`LiveMap.tsx:273–274`).
- Consumed: 28%-alpha of the same hue (`:275–278`).

---

## Part 8 — Foreground / Background / PiP Behavior Matrix

| Concern | Foreground (active) | Background — PiP (Android, driving) | Background — no PiP |
|---|---|---|---|
| GPS foreground watch | ✅ running | ✅ **kept alive** (PiP guard in `useLocationPublisher.ts:82–88`) | ⛔ stopped (`:91`) |
| GPS background task | ✅ running (online/on-trip) | ✅ running | ✅ running |
| Firestore driver writes | ✅ throttled | ✅ (fg + bg) | ✅ (bg task only) |
| Camera mutations | ✅ executed | ⛔ `navigationFollow` skipped (`useRideCameraController.ts:247–250`) | ⛔ gated off; commands queued (`:184–188`) |
| Nav UI | full sheets + banner | compact `PipNavigationView` (`drive.tsx:308–314`) | n/a (no surface) |
| `mapPadding` | live anchor math | **frozen** (`freezeNavigationMapPadding`) | frozen |
| `navSession` | `lastForegroundAt` stamped | `lastBackgroundedAt` stamped (`useNavigationLifecycle.ts:135–156`) | same |
| On resume | — | re-seed from last-bg-location → `forceFollow()` → refetch route → seed current position (`:159–202`) | same drain + reseed |

### Resume sequence (`useNavigationLifecycle`, driving only)

```
app → active
  ├─ updateNavSession({lastForegroundAt: now, lastBackgroundedAt: null})
  ├─ forceFollow()                       // re-attach follow camera
  └─ async:
       ├─ seedFromLastBackgroundLocation()   // instant marker from AsyncStorage
       ├─ refetchDriverRoute()               // fresh polyline/ETA
       └─ seedFromCurrentPosition()          // authoritative BestForNavigation fix
```

The camera queue is drained separately by `useRideCameraController`'s own AppState listener (two rAFs + `runAfterInteractions`) so it never races the GL surface rebind.

> ❌ **Entirely new since V1** — V1's Part 8 was a Google/Grab/Uber comparison; there was no background/PiP matrix because neither existed.

---

## Part 9 — Comparison with Google Maps / Grab / Uber

| Behavior | This app (V2) | Google Maps Nav | Grab / Uber Driver | Gap |
|---|---|---|---|---|
| GPS interval | 2 s / 10 m fg + 25 m / 10 s bg | ~1 Hz continuous | ~1 Hz | Minor — masked by interpolation |
| Background tracking | ✅ TaskManager + FG service | ✅ | ✅ | **Closed** (was V1's #1 gap) |
| Marker on road | ✅ snapped to polyline | ✅ | ✅ | **Closed** |
| Inter-fix motion | ✅ rAF lerp | ✅ GL interpolation | ✅ | Closed (JS-lerp, not GL) |
| Heading | GPS↔compass w/ hysteresis + smoothing | Kalman + compass | same | Near-parity |
| Route refresh | 60 m / 25 s / off-route | adaptive | similar | Minor: no pre-maneuver refresh |
| Off-route | 2-confirm + heading mismatch + "Rerouting…" | 2–3 confirm + indicator | same | **Closed** |
| ETA | measured-speed avg, linear fallback, every fix | speed + traffic | speed + traffic | No traffic model |
| Consumed polyline | ✅ faded trim | ✅ | ✅ | **Closed** |
| Camera mode | ✅ auto-arm from status | auto on start | auto on accept | **Closed** |
| Voice guidance | ✅ initial/soon/now (`expo-speech`) | ✅ full | ✅ | Closed (no mute toggle yet) |
| PiP / background nav | ✅ Android PiP overlay | ✅ | ✅ | Near-parity (Android only) |
| Live ETA to passenger | ✅ `tripProgress` every 10 s | ✅ | ✅ | **Closed** |
| Lane / speed-limit | ❌ | ✅ | limited | Out of MVP scope |
| Night-mode map | ❌ single style | ✅ auto | varies | Open |

> **Voice guidance** ❌ closes V1 Tier 2 #9. `useVoiceGuidance` (`useVoiceGuidance.ts`) fires three cue tiers per step — `initial` on step change, `soon` at ≤ `SOON_DISTANCE_M (250 m)`, `now` at ≤ `NOW_DISTANCE_M (60 m)` — de-duplicated by a composite step key (`:29–45`) and spoken via `expo-speech` (`:179–187`). Wired in `drive.tsx:255–261`, disabled during `driver_arrived`.

---

## Part 10 — Code Reference

| Behavior | File | Symbol | Lines |
|---|---|---|---|
| Start/stop foreground GPS | `driver-availability/hooks/useLocationPublisher.ts` | `useLocationPublisher` | 45–168 |
| AppState / PiP GPS gate | same | AppState listener | 69–115 |
| Foreground watch config | `driver-availability/services/location.service.ts` | `startPublishing` | 177–247 |
| Firestore driver write | same | `publishDriverLocation` | 157–163 |
| Background task | `driver-availability/services/backgroundLocationTask.ts` | `defineTask` | 26–94 |
| Background start/stop | `location.service.ts` | `start/stopBackgroundPublishing` | 110–142 |
| Background permission | same | `ensureBackgroundPermission` | 94–108 |
| Heading fusion + hysteresis | `maps/hooks/useDriverHeading.ts` | `selectHeadingSource` / `fuseAndSmooth` | 34–122 |
| Driver route query | `maps/hooks/useDriverRouteQuery.ts` | `useDriverRouteQuery` | 109–338 |
| Off-route deviation | same | `getRouteDeviation` | 44–101 |
| Step advance + ETA + distance | `maps/hooks/useManeuverProgress.ts` | `useManeuverProgress` | 67–178 |
| Adaptive ETA | same | `getAdaptiveEtaSeconds` | 38–61 |
| Camera controller | `maps/hooks/useRideCameraController.ts` | `useRideCameraController` | 70–414 |
| Frustum gate + queue drain | same | `executeCommand` / AppState effect | 172–316 |
| Interpolation | `maps/hooks/useInterpolatedCoordinate.ts` | `useInterpolatedCoordinate` | 34–116 |
| Voice guidance | `maps/hooks/useVoiceGuidance.ts` | `useVoiceGuidance` | 145–189 |
| PiP orchestration | `maps/navigation/usePictureInPicture.ts` | `usePictureInPicture` | 12–100 |
| Nav lifecycle / resume | `maps/navigation/useNavigationLifecycle.ts` | `useNavigationLifecycle` | 85–208 |
| Auto-arm helper | `maps/navigation/navigationHelper.ts` | `getAutomaticNavigationStatus` | 11–17 |
| Geo projection / snap / split | `lib/geoProjection.ts` | `snapPointToPolyline` / `splitPolylineAtClosestPoint` | 67–157 |
| Trip progress publish | `trip/hooks/useTripProgressPublisher.ts` | `useTripProgressPublisher` | 47–89 |
| Store (persist + terminal wipe) | `stores/activeTripStore.ts` | `useActiveTripStore` | 113–176 |
| PiP state | `stores/uiStore.ts` | `useUiStore` | 19–29 |
| Map render (snap/trim/variant) | `trip/components/LiveMap.tsx` | `LiveMap` | 66–479 |
| PiP overlay UI | `maps/components/PipNavigationView.tsx` | `PipNavigationView` | 14–63 |
| Loading UX | `components/ui/LocationLoader.tsx` | `LocationLoader` | 10–23 |
| Screen composition | `app/(driver)/drive.tsx` | `DriveScreen` | 74–406 |

---

## Part 11 — Completed Improvements (since V1)

Reconciled against V1's tiered recommendation list:

| V1 item | Status | Where |
|---|---|---|
| **T1 #1** Snap marker to polyline | ✅ Done | `snapPointToPolyline` in `drive.tsx:188–204` |
| **T1 #2** Interpolate between fixes | ✅ Done | `useInterpolatedCoordinate` |
| **T1 #3** Auto-engage Driving Mode | ✅ Done | `getAutomaticNavigationStatus` + reconcile effect |
| **T1 #4** Live in-progress ETA/distance to passenger | ✅ Done | `useTripProgressPublisher` → `trip.tripProgress` |
| **T1 #5** Measured-speed ETA model | ✅ Done | `getAdaptiveEtaSeconds` / `getAverageReliableSpeed` |
| **T2 #6** Background location during trip | ✅ Done | `backgroundLocationTask.ts` + FG service |
| **T2 #7** Off-route hysteresis + "Rerouting…" | ✅ Done | 2-confirm + heading mismatch + `isRerouting` pill |
| **T2 #8** Trim consumed polyline | ✅ Done | `splitPolylineAtClosestPoint` |
| **T2 #9** Voice turn-by-turn | ✅ Done (no mute toggle) | `useVoiceGuidance` |
| **T3 #12** Heading switch hysteresis | ✅ Done | asymmetric 1.5/1.0 m/s band |
| **T3 #17** Persist `navActiveStatus` | ✅ Done | `activeTripStore` persist v3 |

**Additional work not in V1's list:**

- **Frustum-null NPE prevention** — AppState camera gate + PiP skip + two-rAF queue drain (`useRideCameraController.ts`).
- **Android Picture-in-Picture** — full `usePictureInPicture` + `PipNavigationView` + `uiStore.pip`.
- **Session tracking + instant resume** — `navSession` + `seedFromLastBackgroundLocation` / `seedFromCurrentPosition`.
- **Terminal-state eager wipe** — nav slices cleared the instant status becomes terminal (`activeTripStore.setTrip`).
- **`cameraFollowing` persistence** — follow/pan state survives restart.
- **Bug #1 fix** — in-progress route drawn in trip-blue with the duplicate booking polyline suppressed.
- **`LocationLoader`** — themed location-acquisition UX (`drive.tsx:403`).

---

## Part 12 — Remaining Improvements (tiered)

### Tier 1 — High impact

1. **Publish fused heading, not raw GPS heading, to Firestore.** *(V1 T3 #11 — still open.)* `getLocationPublishPayload` writes raw `coords.heading` (`location.service.ts:147–153`), which is `null`/`-1` at standstill, so the passenger's driver arrow doesn't rotate when stopped. Publish `activeTripStore.navHeading` instead (or fall back to it).
2. **Traffic-aware ETA.** The adaptive model uses measured speed but no live traffic. Consider Directions `departure_time`/`duration_in_traffic`, or blend the measured average with the Directions estimate.

### Tier 2 — Medium impact

3. **Voice mute toggle + preferences.** `useVoiceGuidance` always speaks when enabled. Add a persisted mute switch and possibly a distance-unit/voice-rate preference.
4. **Pre-maneuver route refresh.** *(V1 T3 #13 — open.)* Trigger an extra Directions call ~100 m before the next maneuver to catch turn-lane/closure changes in dense areas.
5. **Unify driver-location stores.** *(V1 T3 #10 — still open.)* `availabilityStore.lastLat/Lng` and `activeTripStore.driverLocation` both update every fix with subtly different semantics; collapse to one canonical source with a presence fallback.

### Tier 3 — Polish

6. **Dark-mode map style.** *(V1 T3 #15 — open.)* Pass a dark `customMapStyle` to `MapView` when the system is in dark mode.
7. **Recenter button in overview-after-pan.** *(V1 T3 #16 — open.)* Currently gated on `isDriving && userPanned` (`drive.tsx:343–348`); also show it when panned during overview phases.
8. **Tighten foreground cadence during nav.** *(V1 T3 #14 — reprioritized.)* 2 s / 10 m could drop to 1 s / 5 m under `BestForNavigation`; lower priority now that interpolation masks the gap.
9. **iOS PiP / background parity.** PiP is Android-only; iOS backgrounds with no in-app overlay. Evaluate iOS PiP or a Live Activity.

### Tier 4 — Architectural cleanup

10. **Decouple `useDriverRouteQuery`'s 5 s interval from gate logic.** *(V1 T4 #18 — open.)* The interval (`:242`) re-evaluates cached values; GPS fixes at 2 s already drive the dependency array. Consider removing the interval or keying it purely on the time gate.
11. **Centralize the remaining magic numbers.** *(V1 T4 #19 — partially done.)* The `driverRoute` publish thresholds (`50 m` / `15 s`, `:301`) and the step-advance `25 m` (`useManeuverProgress.ts:131`) are still inline; move to `constants.ts`.
12. **Type `trip.driverRoute` / `trip.tripProgress` writes through a converter.** *(V1 T4 #20 — open.)* `updateDoc` payloads are structurally typed only; a Firestore converter in `collections.ts` would catch schema drift at compile time.
13. **Background-permission UX.** `ensureBackgroundPermission` throws `LocationPermissionError` if denied (`location.service.ts:102–107`), but the background start is fire-and-forget (`useLocationPublisher.ts:196–200`) — a denial is only logged. Surface a first-class "background location needed" CTA like the foreground denial path.

---

### Appendix — "feels off" symptom → root cause (V2)

| Symptom | Root cause | Status |
|---|---|---|
| Driver arrow doesn't rotate when stopped (passenger view) | raw GPS heading published, not fused | **Open** (T1 #1) |
| ETA doesn't reflect traffic | no traffic model | **Open** (T1 #2) |
| Marker jitters off road | ~~no snapping~~ | ✅ Fixed |
| Camera jumps between fixes | ~~no interpolation~~ | ✅ Fixed |
| Passenger in-trip ETA frozen | ~~static `trip.route`~~ | ✅ Fixed (`tripProgress`) |
| Reroute on a single bad fix | ~~no hysteresis~~ | ✅ Fixed (2-confirm) |
| GPS lost when screen sleeps | ~~foreground only~~ | ✅ Fixed (bg task) |
| App crash on background (Frustum NPE) | ~~camera touched dead GL surface~~ | ✅ Fixed (gate + PiP skip + drain) |
| Driver must tap to tilt camera | ~~manual arm~~ | ✅ Fixed (auto-arm) |
