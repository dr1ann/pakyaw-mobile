# Phase 12 — Navigation Experience

**Status:** Specification — **final / implementation-ready** (not yet implemented)
**Predecessors:** Phase 12 (Map-Driven Booking — [phase12_spec.md](./phase12_spec.md)), Phase 11 (interactive maps)
**Type:** Standalone extension of Phase 12. Builds on the existing map/route/telemetry stack — does **not** replace it, and is **not** merged into `phase12_spec.md` (that doc carries only a short cross-reference here — see §0.4).

**Goal:** Transform the current "fit-all-markers" live map into a **navigation-oriented experience** comparable to Grab and Google Maps: a heading-up, driver-following, tilted, zoomed-in camera with a turn-by-turn maneuver banner and live trip stats (ETA, remaining distance, arrival time) for the **driver**, and a calm follow-the-driver experience (exact published route, ETA, distance, arrival time, **no** turn-by-turn) for the **passenger** — kept in sync **entirely through Firestore**.

> **Design-only document.** This spec defines structure, contracts, and behavior. No code is written here. It reuses and extends the Phase 12 primitives already in the repo: `LiveMap` ([src/features/trip/components/LiveMap.tsx](../src/features/trip/components/LiveMap.tsx)), `useDriverRouteQuery` ([src/features/maps/hooks/useDriverRouteQuery.ts](../src/features/maps/hooks/useDriverRouteQuery.ts)), `routingService.getRoute`, `activeTripStore`, and `availabilityStore`.

---

## 0. Scope Summary

### 0.1 In scope
1. **Navigation Mode** for the driver: heading-up, driver-centered, **~45° tilted**, zoomed-in camera that follows live position and rotates to heading (final decision — §3).
2. **Turn-by-turn maneuver banner** (driver only) — next maneuver, maneuver icon, road name, remaining distance to that maneuver.
3. **Live trip-stats bar** (driver) — ETA, remaining distance, estimated arrival time, continuously updated.
4. **Two-phase navigation that does not visually reset**:
   - `accepted` / `driver_arriving` → navigate **Driver → Pickup**.
   - `in_progress` → navigate **Pickup → Destination** (origin tracks the live driver position).
   - The pickup→destination handoff preserves Navigation Mode (camera, banner, stats) — no flash back to the overview map.
5. **Driver-published canonical Driver→Pickup route** (`trip.driverRoute`): the driver is the **only** client that requests Google Directions for the Driver→Pickup leg, and publishes the resulting route into the trip document on each throttled refresh (§4, §6, §10.3).
6. **Passenger renders the exact published road route** (not a dashed approximation) from `trip.driverRoute`, synchronized purely via the Firestore trip listener — **zero** passenger routing requests (§8).
7. **Heading source** (GPS course fused with the device magnetometer) feeding camera rotation.
8. **Local, ephemeral maneuver progression** (advance the active step, compute remaining-to-maneuver distance) without per-tick API calls and without any Firestore writes.
9. **Off-route detection** that forces an immediate route refresh.
10. The full architecture: state machine, camera behavior, routing lifecycle, polling strategy, Directions usage, billing rationale, performance, battery, API-cost optimization, and documentation updates.

### 0.2 Out of scope (deferred / unchanged)
- **Pricing / fare** — unchanged from Phase 12 (§11 of [phase12_spec.md](./phase12_spec.md)). Navigation introduces **no monetary fields**; `scripts/check-no-money.js` must continue to pass.
- **Voice guidance / spoken instructions** — text banner only (OQ-NAV-4).
- **Lane guidance, speed limits, junction view** — not in this phase.
- **Background navigation** — foreground-only, consistent with the MVP location policy (architecture.md §7.4). Nav Mode is active only while the driver app is foregrounded.
- **Offline / cached routing tiles** — online Directions only.
- **Passenger turn-by-turn** — explicitly excluded by requirement.
- **Alternative-route selection** — a single best route is used.
- **Persisting navigation phases / camera / maneuver state** — these are ephemeral client state and are **never** written to Firestore (§10.2).

### 0.3 Relationship to existing invariants
- Preserves the decoupling rule: **telemetry (Firestore location) and routing (Google Directions) stay separate** (architecture.md §7.4). Navigation does not change how driver location is published.
- Reuses the existing driver→pickup violet polyline lifecycle (`showDriverRoute` gating). Navigation **adds** maneuver data, camera control, and the **published `driverRoute`** on top of it.
- The booking route (`trip.route.polyline`, blue, Pickup→Destination) is unchanged and is a **separate field** from `driverRoute` (§ "Booking Route vs Driver Route").
- **No new trip statuses.** Navigation phases are **client-derived** from the existing lifecycle (§2).

### 0.4 Document organization (final decision)
- This file (`phase12_navigation_spec.md`) is the **authoritative, standalone** specification for the navigation experience.
- It is **not** merged into `phase12_spec.md`. `phase12_spec.md` carries only a **short cross-reference** pointing here for all navigation behavior (added to its §7 Map Behavior).
- This keeps booking concerns (in `phase12_spec.md`) and navigation concerns (here) cleanly separated within one documentation hierarchy.

---

## 1. Goals & Non-Goals

| | |
|---|---|
| **Primary goal** | A driver completes pickup and drop-off by following a Google-Maps-style navigation view without leaving `drive.tsx`. |
| **Secondary goal** | A passenger gets continuous, legible situational awareness (where is my driver, the exact route, how long, how far) — synchronized via Firestore only — without a turn-by-turn UI meant for the person driving. |
| **Billing goal** | Exactly one client (the driver) pays for the Driver→Pickup route; the passenger pays nothing for routing. Synchronization rides on cheap Firestore snapshots, not duplicate Directions calls (§ Billing rationale). |
| **Non-goal** | Replacing Google/Grab as a routing engine. We render Google's route and maneuvers; we do not compute our own routing graph. |
| **Non-goal** | Perfect lane-level guidance. Banner-level guidance (next turn + road name + distance) is the bar. |
| **Hard constraint** | No new monetary fields, no Share/fleet symbols, strict TypeScript, design tokens only (CLAUDE.md / architecture.md §4). |

---

## 2. Navigation State Machine

Navigation is a **client-side view machine** derived from `trip.status` (the single source of truth, architecture.md §3.3). It introduces **no new trip statuses**, **no parallel server state machine**, and **no persisted navigation phase**. It is a projection of the existing lifecycle plus ephemeral, client-only camera/maneuver state.

### 2.1 Navigation phases (client-derived, never persisted)

```
NavPhase = 'idle' | 'to_pickup' | 'at_pickup' | 'to_destination' | 'ended'
```

`NavPhase` is computed from `trip.status` on each client — it is **not** stored on the trip and **not** synchronized through Firestore:

| `trip.status` | `NavPhase` | Driver map | Route shown (driver) | Banner | Camera default |
|---|---|---|---|---|---|
| (no trip) / `request` | `idle` | normal overview | none | none | overview (fit) |
| `accepted` | `to_pickup` | **Navigation Mode** | Driver → Pickup (violet, published as `driverRoute`) | yes | follow |
| `driver_arriving` | `to_pickup` | **Navigation Mode** | Driver → Pickup (violet, published as `driverRoute`) | yes | follow |
| `driver_arrived` | `at_pickup` | **Navigation Mode (held)** | none (cleared) | "Arrived at pickup" hold | follow (driver centered, zoomed, tilted) |
| `in_progress` | `to_destination` | **Navigation Mode** | Driver → Destination (blue, local nav route) | yes | follow |
| `completed` / `cancelled` | `ended` | overview | none | none | overview (fit) |

**Key invariants**
- Navigation Mode (heading-up, ~45° tilted follow camera) is **continuously held** from `accepted` through `in_progress`. `driver_arrived` is a *hold* state: the route and banner clear (driver is parked, waiting), but the camera stays in the zoomed, driver-centered, tilted follow pose. This produces the "no visible transition back to the normal map" requirement at the pickup→trip handoff.
- The machine **never** routes the driver from a stale origin: the nav-route origin is always the **live driver position**, not the trip's stored pickup/destination coordinates (those define endpoints, not the moving origin).
- Both clients independently derive `NavPhase` from the same `trip.status`, so they cannot desync — there is no second source of truth to disagree with.

### 2.2 Camera mode (orthogonal, ephemeral)

```
CameraMode = 'follow' | 'overview'
```

- `follow` — driver-centered, heading-up, ~45° tilt, fixed zoom. The Navigation Mode camera.
- `overview` — the existing `fitToCoordinates` behavior (north-up, top-down, fit all markers). Used at `idle`/`ended`, and **temporarily** whenever the driver manually pans the map during navigation (§3.4).

`CameraMode` is **ephemeral client state** held in `activeTripStore` (§10.1), not on the trip. It is reset to the phase default on every `NavPhase` change.

### 2.3 Transition diagram

```
            accept                start nav             arrive               start trip            end
 idle ───────────────▶ to_pickup ──────────▶ to_pickup ─────────▶ at_pickup ───────────▶ to_destination ──────▶ ended
(overview)            (FOLLOW, route+banner)  (driver_arriving)    (FOLLOW held,           (FOLLOW, route+banner)  (overview)
                       publishes driverRoute  publishes driverRoute no route/banner)        local route only

 any nav phase ── driver pans map ──▶ CameraMode='overview' (transient) ── tap "Re-center" / 8s idle ──▶ CameraMode='follow'
 to_pickup / to_destination ── driver deviates > OFF_ROUTE_M from route ──▶ immediate route refresh (§4.3)
```

### 2.4 Why no new trip statuses and no persisted nav phase
Modeling navigation as new server statuses (or persisting a nav phase) would create the exact second state machine architecture.md §3.3 forbids, and would invite passenger/driver desync. Navigation is a **rendering concern**: the trip document already encodes "where in the lifecycle" we are; Navigation Mode is purely how each client draws that. The driver draws a follow/heading/banner view; the passenger draws a calm overview. One document, two projections, each derived live.

---

## 3. Camera Behavior (final decisions)

### 3.1 Follow vs overview

| Aspect | `follow` (Navigation Mode) | `overview` (existing Phase 11/12) |
|---|---|---|
| Center | live driver position | centroid of `fitToCoordinates` |
| Bearing/heading | driver heading (§3.3) | 0 (north-up) |
| Zoom | fixed `NAV_ZOOM` | derived from marker bounds |
| Pitch/tilt | **`NAV_PITCH = 45°` (final)** | 0 (top-down) |
| Driven by | local `watchPositionAsync` stream + heading | `markersSignature` change |
| API | `mapRef.animateCamera(...)` | `mapRef.fitToCoordinates(...)` (unchanged) |

**Final decision (was OQ-NAV-1 / OQ-NAV-8, now resolved):** Navigation Mode uses **~45° camera tilt, heading-up orientation, driver-centered follow**. Overview mode continues to use the existing **top-down (north-up)** map. These are no longer open questions.

### 3.2 Parameters (constants — `src/features/maps/navigation/constants.ts`)

```ts
export const NAV_ZOOM = 17.5;            // street-level; ~Grab default
export const NAV_PITCH = 45;             // FINAL: 45° tilt in Navigation Mode
export const NAV_CAMERA_ANIM_MS = 600;   // animateCamera duration per update
export const NAV_RECENTER_IDLE_MS = 8_000; // auto-resume follow after manual pan
export const OFF_ROUTE_M = 50;           // deviation that forces a route refresh (§4.3)
export const REROUTE_MIN_MOVE_M = 60;    // distance gate for routine refresh (50–100 m band)
export const REROUTE_MIN_INTERVAL_MS = 25_000; // time gate for routine refresh (20–30 s band)
export const HEADING_SPEED_THRESHOLD_MS = 1.5; // above this, trust GPS course over magnetometer
```

> The distance/time refresh gates (`REROUTE_MIN_MOVE_M`, `REROUTE_MIN_INTERVAL_MS`) keep the existing `useDriverRouteQuery` 50 m / 25 s policy and stay inside the requirement's "50–100 m OR 20–30 s" band. `OFF_ROUTE_M` is a separate, tighter trigger (§4.3).

### 3.3 Heading source & fusion

Camera rotation needs a stable bearing. Two sources, fused:

1. **GPS course** — `expo-location` `watchPositionAsync` exposes `coords.heading` (degrees, `-1`/`NaN` when unknown) and `coords.speed` (m/s). Reliable while moving.
2. **Magnetometer** — `Location.watchHeadingAsync` exposes `trueHeading`/`magHeading`. Reliable while stationary or crawling, but noisy.

**Fusion rule (`useDriverHeading` hook, §11):**
- If `speed >= HEADING_SPEED_THRESHOLD_MS` and `coords.heading` is valid → use GPS course.
- Else → use magnetometer `trueHeading` (fallback when parked/slow).
- Apply **angular smoothing** (shortest-arc low-pass on the unit vector) so the map does not snap between noisy readings.
- Hold the last good heading if both sources are momentarily invalid.

Heading is **ephemeral client state** written to `activeTripStore.navHeading` (§10.1) **only** while a nav phase is active; the magnetometer subscription is **torn down** outside `to_pickup`/`at_pickup`/`to_destination` to save battery (§13). Heading is never persisted to Firestore.

### 3.4 Re-center / manual pan
Standard Grab/Google pattern:
- `LiveMap.onRegionChangeComplete` already fires with `details.isGesture`. When `isGesture === true` during a nav phase → set `CameraMode = 'overview'` (stop fighting the user's pan) and show a floating **"Re-center"** button.
- Tapping **Re-center**, or `NAV_RECENTER_IDLE_MS` of no gesture, restores `CameraMode = 'follow'` and resumes camera animation.
- While user-panned (`overview`), the follow loop suspends `animateCamera` but the route/banner/stats keep updating from data.

### 3.5 Platform map providers (final decision)
**Final decision (was OQ-NAV-8 / OQ-NAV-1, now resolved):**
- **Android → Google Maps** (`PROVIDER_GOOGLE`).
- **iOS → Apple Maps** (platform default; do **not** force `PROVIDER_GOOGLE` on iOS).

This matches the current `LiveMap` provider selection (LiveMap.tsx:226: `provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}`). Both Apple Maps (iOS) and Google Maps (Android) support `animateCamera({ center, heading, pitch, zoom })`, so the ~45° tilt / heading-up follow camera works on both providers without forcing Google on iOS.

---

## 4. Routing Lifecycle

### 4.1 Two distinct routes — and how the Driver→Pickup route reaches the passenger

| Route | Source | Color | Firestore field | Who requests Directions | Consumers |
|---|---|---|---|---|---|
| **Driver → Pickup** (nav route, waiting phase) | live driver position → `trip.pickup.coords` | violet | **`trip.driverRoute`** (new, published) | **driver only** | driver banner/polyline **+ passenger polyline/ETA/distance** (read from Firestore) |
| **Pickup → Destination** (booking route) | booking-time route (Phase 12) | blue | `trip.route` (existing) | (computed at booking) | driver polyline + passenger polyline; passenger in-trip stats |
| **Driver → Destination** (driver's local in-trip nav route) | live driver position → `trip.destination.coords` | blue | **none — local only** | driver only | driver banner/ETA only (not published; passenger uses `trip.route`) |

The new, central artifact is **`trip.driverRoute`**: the driver computes the Driver→Pickup route locally for its own turn-by-turn navigation **and publishes the canonical result** into the trip document so the passenger can render the **exact road route** without ever calling Directions.

### 4.2 The driver-published `driverRoute` model

**The driver is the only client allowed to request Google Directions for Driver Current Location → Passenger Pickup.** On each throttled refresh (§4.3), after a successful Directions response, the driver writes:

```ts
// trips/{tripId}.driverRoute — canonical Driver → Pickup route, driver-published
driverRoute: {
  polyline: string;          // encoded Google overview polyline (<= 8 KB)
  distanceMeters: number;    // Directions leg distance (driver → pickup)
  durationSeconds: number;   // Directions leg duration (drives both clients' ETA)
  updatedAt: Timestamp;      // serverTimestamp() at publish
}
```

- Written **only** by the assigned driver, **only** while `status ∈ {accepted, driver_arriving}` (the `to_pickup` phase) — see §10.3 / §15.2 for the rule.
- The **maneuver steps are NOT published** — they are large, change constantly, and are only needed by the driver. Steps stay **local and ephemeral** (§4.4). Only the compact `driverRoute` summary (polyline + distance + duration) crosses the network.
- `driverRoute` and the booking `route` are **separate fields and must never overwrite one another** (see § "Booking Route vs Driver Route").

### 4.3 Refresh triggers (driver only — never every GPS update)

The driver dispatches a new Directions request **and republishes `driverRoute`** when **any** of:
1. **Distance gate** — driver has moved `>= REROUTE_MIN_MOVE_M` (60 m, in the **50–100 m** band) from the last routed origin (haversine via `lib/geo.haversineMeters`).
2. **Time gate** — `>= REROUTE_MIN_INTERVAL_MS` (25 s, in the **20–30 s** band) since the last successful route.
3. **Off-route** — the live position is `> OFF_ROUTE_M` (50 m) from the nearest point of the current route polyline (perpendicular distance). Fires **immediately**, bypassing the time gate.
4. **Phase change** — entering `to_pickup` (fetch + publish) or `to_destination` (fetch local route to destination).

Gates 1–2 are the existing `useDriverRouteQuery` logic. Gate 3 (off-route) and gate 4 (phase change) are new. **The route is never refreshed on every GPS tick** — GPS ticks drive only the local camera/heading/maneuver loop (§4.4), which makes no network calls.

> Off-route distance is computed **locally** (point-to-polyline) — no API call to *detect* it; only the resulting refresh hits Directions and republishes `driverRoute`.

### 4.4 Maneuver model & local step progression (ephemeral, no network)

The driver's local nav route carries an ordered list of steps parsed from Directions `legs[0].steps[]`:

```ts
export type Maneuver =
  | 'turn-left' | 'turn-right' | 'turn-slight-left' | 'turn-slight-right'
  | 'turn-sharp-left' | 'turn-sharp-right' | 'uturn-left' | 'uturn-right'
  | 'straight' | 'ramp-left' | 'ramp-right' | 'merge'
  | 'fork-left' | 'fork-right' | 'keep-left' | 'keep-right'
  | 'roundabout-left' | 'roundabout-right' | 'ferry' | 'depart' | 'arrive';

export interface NavStep {
  readonly maneuver: Maneuver | null;     // Google may omit on straight segments
  readonly instruction: string;           // HTML-stripped ("Turn right onto Real St")
  readonly roadName: string | null;       // best-effort extraction (§5.2)
  readonly distanceMeters: number;
  readonly startLocation: LatLng;
  readonly endLocation: LatLng;
  readonly polyline: LatLng[];             // decoded per-step geometry
}

export interface NavRoute {
  readonly steps: readonly NavStep[];      // LOCAL only — never published
  readonly overviewPolyline: string;       // published into driverRoute.polyline (to_pickup)
  readonly distanceMeters: number;         // published into driverRoute.distanceMeters
  readonly durationSeconds: number;        // published into driverRoute.durationSeconds
  readonly fetchedAt: number;              // epoch ms (client clock)
}
```

**Local progression (`useManeuverProgress` hook, §11) — no API call, no Firestore write:**
- Track `currentStepIndex` in `activeTripStore` (ephemeral). Advance it when the live position passes the current step's `endLocation` (within `STEP_ADVANCE_M`, e.g. 25 m) **or** is closer to step *n+1*'s polyline than step *n*'s.
- **Distance to next maneuver** = remaining distance along the current step from the live position to `currentStep.endLocation` (project onto the step polyline, sum residual segments). Recomputed each GPS tick (cheap haversine).
- The banner reads `steps[currentStepIndex]` for icon/road-name/instruction + the computed remaining-to-maneuver distance.
- **Remaining trip distance** = (remaining on current step) + Σ `steps[i].distanceMeters` for `i > currentStepIndex`.
- **ETA / arrival**: ETA from the leg `durationSeconds`, optionally scaled by `remainingDistance / totalDistance` between refreshes; arrival clock-time = `now + etaSeconds` via `date-fns`.

This keeps turn-by-turn responsiveness at GPS frequency while only hitting Directions on the throttled refresh cadence — and only the compact summary is published.

### 4.5 Route cleanup
- On `driver_arrived` (`at_pickup`): the violet polyline + banner clear instantly (driver client gates on `NavPhase`); the camera stays in tilted follow (§2.1). The driver **stops republishing** `driverRoute` (write rule only permits `accepted`/`driver_arriving`). The passenger stops rendering it (gates on `status`).
- On `in_progress` (`to_destination`): the driver fetches a **local** route to the destination for its own banner/ETA; the passenger renders the existing booking `route` (blue). Nothing new is published.
- On `completed` / `cancelled` (`ended`): nav route, banner, stats, heading subscription, and follow camera all tear down; the map returns to `overview`. The ephemeral nav fields in `activeTripStore` reset (§10.1).
- Any in-flight Directions request is cancelled on phase change (TanStack Query `enabled=false` + key change, mirroring the current `data: enabled ? query.data : undefined` instant-cleanup trick).

---

## 5. Google Directions Usage

### 5.1 Request shape (extend `routingService`)
The current `getRoute` ([routingService.ts](../src/features/maps/services/routingService.ts)) requests only `overview_polyline` + leg distance/duration. Navigation needs **steps**. Add a sibling that parses step detail:

```
GET https://maps.googleapis.com/maps/api/directions/json
  ?origin={driverLat},{driverLng}
  &destination={targetLat},{targetLng}
  &mode=driving
  &alternatives=false
  &units=metric
  &key={GOOGLE_MAPS_API_KEY}
```

- Directions returns `legs[0].steps[]` by default; **no extra parameter** is needed — the only change vs `getRoute` is **parsing** steps, so cost per call is identical.
- Reuse the existing restricted key (`Constants.expoConfig.extra.googleMapsApiKey` / `env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`). The Phase 13 server-proxy item (phase12_spec.md §3.2) still applies and is unchanged.
- **[OQ-NAV-1]** `departure_time=now` would add traffic-aware `duration_in_traffic`, possibly affecting billing tier. Default: omit (simple `duration`); revisit if ETA accuracy is a problem.

### 5.2 Response parsing
- Validate with `navRouteResponseSchema` (§15) before extracting — same pattern as the existing `routeResponseSchema`.
- For each `step`: map `maneuver` → the `Maneuver` union (default `null`/`straight`); strip `html_instructions` → `instruction`; extract `roadName` heuristically ("onto/on {road}", else `null`); decode `polyline.points` via existing `lib/maps/decodePolyline`.
- The compact summary (`overview_polyline.points`, leg `distance.value`, leg `duration.value`) is what the driver publishes into `driverRoute` (§4.2).

### 5.3 Maneuver → icon mapping (Lucide React Native)
Single mapping table (`src/features/maps/navigation/maneuverIcon.ts`). Lucide is the project icon set (CLAUDE.md). Representative mapping:

| Google `maneuver` | Lucide icon |
|---|---|
| `turn-left` / `turn-sharp-left` | `CornerUpLeft` |
| `turn-right` / `turn-sharp-right` | `CornerUpRight` |
| `turn-slight-left` / `keep-left` / `fork-left` | `ArrowUpLeft` |
| `turn-slight-right` / `keep-right` / `fork-right` | `ArrowUpRight` |
| `straight` / `merge` / (null) | `ArrowUp` |
| `uturn-left` / `uturn-right` | `RotateCcw` / `RotateCw` |
| `ramp-left` / `ramp-right` | `ArrowUpLeft` / `ArrowUpRight` |
| `roundabout-left` / `roundabout-right` | `RefreshCcw` / `RefreshCw` |
| `ferry` | `Ship` |
| `depart` | `Navigation` |
| `arrive` | `MapPin` |

> Icons use design tokens for color/size. The banner tints the icon `colors.white` on a `colors.ink[900]` background (§7).

### 5.4 Caching / dedupe
- TanStack Query key includes the **routed origin** (snapped to the refresh gate, not raw GPS) + target + phase, so identical refreshes dedupe and `staleTime` (≈20 s, matching `useDriverRouteQuery`) prevents churn.
- Decoded polylines and parsed steps are **memoized** off the raw response so re-renders never re-decode (LiveMap already memoizes `decodedDriverRouteCoords`).

---

## 6. Distance Matrix Usage — retired

The Phase 12 **Distance Matrix** call (`distanceMatrixService.getDriverToPickup`, published as `trip.driverToPickup` via `useDriverToPickupETA`) is **retired and completely removed** along with the `driverToPickup` field.

**Why:** the driver already pays for a Directions request on each Driver→Pickup refresh, and that response carries the leg **distance** and **duration**. Issuing a *separate* Distance Matrix call for the same driver→pickup pair would double the routing bill for information `driverRoute` already provides. So:

| Need | Old source (Phase 12) | New source (this phase) |
|---|---|---|
| Driver's own ETA to pickup | Directions leg duration (local) | `driverRoute.durationSeconds` (same Directions response) |
| Passenger "ETA to pickup" | Distance Matrix → `trip.driverToPickup.etaSeconds` | `trip.driverRoute.durationSeconds` (read from Firestore) |
| Passenger "remaining distance to pickup" | Distance Matrix → `trip.driverToPickup.distanceMeters` | `trip.driverRoute.distanceMeters` (read from Firestore) |
| Passenger in-trip ETA / remaining distance | — | client-side projection of the live driver marker onto `trip.route` (booking route) — no field, no API (§8.2) |

**Net effect:** the Distance Matrix API is no longer called anywhere in the navigation experience. `distanceMatrixService` and `useDriverToPickupETA` have been deleted, and the `trip.driverToPickup` field is completely removed in favor of `trip.driverRoute`. This is what makes the billing claim in the next section literally true: **one Directions request per refresh, and no other routing API of any kind.**

---

## Billing Rationale (why this architecture)

The Driver→Pickup route is needed on **two** screens at once (driver navigating, passenger watching), but it only needs to be **computed once**. This architecture computes it on the driver, persists the canonical result to the trip document, and lets the passenger receive it over a cheap Firestore snapshot.

- **Only one Directions request is made** per refresh cycle — by the driver, for its own navigation. There is no second computation.
- **The passenger performs zero routing requests.** It never calls Directions or Distance Matrix; it only reads `trip.driverRoute` from the trip listener it already maintains.
- **Both clients stay synchronized** because they read the same canonical `driverRoute` (passenger) / produce-and-render it (driver) — there is one source of truth, not two independently-computed routes that could disagree.
- **Firestore snapshot updates are dramatically cheaper than duplicate Directions requests.** A `driverRoute` republish is a single small document write (≤ ~8 KB) and a fan-out of cheap real-time reads, versus a billed Directions API call per client.
- **The Distance Matrix call is eliminated** (§6): distance and duration come "for free" inside the Directions response the driver already pays for.
- **It scales better.** With N passengers-per-trip (future Share) or many concurrent trips, routing cost grows with the number of **drivers**, not the number of **viewers** — viewers cost only Firestore reads. This minimizes Google Maps API billing while keeping every viewer in sync.

### Sequence diagram

```
            Driver (only Directions caller)
                     │
                     │  refresh trigger: 50–100 m moved │ 20–30 s │ off-route │ phase change
                     ▼
        ┌─────────────────────────────┐
        │   Google Directions API     │   ← billed once per refresh
        └─────────────────────────────┘
                     │  polyline + distanceMeters + durationSeconds (+ local steps)
                     ▼
        ┌─────────────────────────────┐
        │  Trip Document  .driverRoute │   ← single canonical write (cheap Firestore write)
        │  { polyline, distanceMeters, │
        │    durationSeconds, updatedAt}│
        └─────────────────────────────┘
                     │  onSnapshot (real-time, cheap read — zero routing cost)
                     ▼
        ┌─────────────────────────────┐
        │  Passenger Firestore Listener│
        └─────────────────────────────┘
                     │  driverRoute.polyline / distanceMeters / durationSeconds
                     ▼
        ┌─────────────────────────────┐
        │   Passenger Map  (exact route + live driver marker)
        └─────────────────────────────┘
```

The driver also feeds the same Directions response into its **local** maneuver/banner/camera loop (steps stay on-device). The passenger never sees or needs the steps.

---

## Booking Route vs Driver Route

These are **two separate routes** with different purposes. They live in **two separate Firestore fields** and **must never overwrite one another.**

| | **Booking Route** | **Driver Route** |
|---|---|---|
| Purpose | the trip path the passenger booked | the driver's live navigation to the pickup |
| Direction | **Pickup → Destination** | **Driver current location → Pickup** |
| Firestore field | **`route`** | **`driverRoute`** |
| Written | once, at booking time (Phase 12) | repeatedly by the assigned driver during `accepted`/`driver_arriving` (throttled) |
| Color on map | blue (`colors.blue.primary`) | violet (`colors.violet.primary`) |
| Lifetime | the whole trip (static) | the waiting phase only; stale/ignored afterward |

```ts
// SEPARATE FIELDS — independent, never aliased or overwritten:
route:       { polyline; distanceMeters; durationSeconds; fetchedAt };   // Pickup → Destination (booking)
driverRoute: { polyline; distanceMeters; durationSeconds; updatedAt };   // Driver → Pickup (live nav)
```

- During **waiting** (`accepted`/`driver_arriving`): passenger renders `driverRoute` (violet) + live driver marker.
- During the **trip** (`in_progress`): passenger renders `route` (blue) + live driver marker; `driverRoute` is no longer rendered.
- A writer must never copy one into the other; they answer different questions and have different update cadences.

---

## 7. Driver Navigation UI

### 7.1 Maneuver banner — `NavigationBanner.tsx` (new)
Top of `drive.tsx`, during `to_pickup` and `to_destination` (hidden at `at_pickup`/`idle`/`ended`):

```
┌─────────────────────────────────────────────┐
│  ◤  ⟵   Turn left onto Bonifacio St          │   ← maneuver icon + instruction
│         120 m                                 │   ← remaining distance to maneuver
└─────────────────────────────────────────────┘
```

- Maneuver icon (§5.3); primary line = road name if extracted else full instruction; distance to maneuver formatted (`<1000 m`→"120 m"; else "1.2 km").
- Background `colors.ink[900]`, text/icon `colors.white`, radius `radius.lg`, `shadow.float`. Tokens only.
- Occupies the top SafeArea band where `IncomingRequestCard` renders (drive.tsx:154) — mutually exclusive (request card only shows while `online` + idle; banner only on an active trip).

### 7.2 Trip-stats bar — extend `DriverTripSheets`
Three-up stat row on `DriverEnRouteSheet` / `DriverInTripSheet`, continuously updated from §4.4:

```
   ETA            DISTANCE         ARRIVAL
   8 min          3.4 km           3:45 PM
```

- ETA from `durationSeconds`; remaining distance running; arrival = `now + eta` via `date-fns`.
- Existing lifecycle action buttons ("Arrived at pickup" / "Start trip" / "End trip") remain below.

### 7.3 Re-center button — `RecenterButton.tsx` (new)
Floating pill above the sheet, visible only when `CameraMode === 'overview'` during a nav phase (§3.4). Tap → `activeTripStore.setNavCameraMode('follow')`. Icon `Navigation` (Lucide), tokenized.

### 7.4 `LiveMap` extensions
`LiveMap` gains an additive optional `navigation` prop bundle (passenger usage unchanged):

```ts
readonly navigation?: {
  readonly mode: 'follow' | 'overview';
  readonly center: { latitude: number; longitude: number } | null; // live driver pos
  readonly heading: number | null;
  readonly zoom?: number;   // default NAV_ZOOM
  readonly pitch?: number;  // default NAV_PITCH (45)
};
```

- When `navigation.mode === 'follow'`, `LiveMap` drives the camera via `animateCamera` (center/heading/`NAV_PITCH`/`NAV_ZOOM`) instead of `fitToCoordinates`. The existing `markersSignature` fit-effect is **disabled while following** so the two controllers don't fight.
- When `navigation` is absent or `mode === 'overview'`, current behavior is unchanged (fit-to-markers, top-down). The passenger keeps using `LiveMap` exactly as today.
- The marker key re-mount fix (LiveMap.tsx:309/329) is retained.

---

## 8. Passenger Experience

The passenger view is **navigation-lite** and **Firestore-only**. It reuses the existing passenger `LiveMap` with **no** `navigation` prop — so **no** follow camera, **no** heading rotation, **no** maneuver banner. The passenger **never** calls Google Directions or Distance Matrix.

### 8.1 While waiting (`accepted` / `driver_arriving`)
The passenger subscribes to the trip document and renders, from `trip.driverRoute`:
- **Exact Driver → Pickup road route** — decode and render `driverRoute.polyline` (violet). **Not** a dashed approximation.
- **ETA to pickup** — `driverRoute.durationSeconds`.
- **Remaining distance** — `driverRoute.distanceMeters`.
- **Live driver location** — existing `drivers/{driverId}.location` `onSnapshot` → animated marker, rendered together with the published route.
- **Booking status** — existing status-sheet copy ("Driver matched" / "On the way" / "Arriving").

Synchronization is **entirely via the Firestore trip listener**. If `driverRoute` has not yet been published in the first moment after acceptance, the passenger may briefly show the live driver marker + booking context until the first `driverRoute` snapshot arrives (no dashed routing approximation is required as the driver publishes within the first refresh cycle).

### 8.2 Once the trip starts (`in_progress`)
The passenger renders:
- **Driver location** — live marker (vehicle moving toward destination).
- **Pickup → Destination route** — the existing blue `trip.route.polyline` (booking route, already persisted).
- **ETA remaining / remaining trip distance** — derived **client-side, ephemerally**: project the live driver marker onto `trip.route`'s polyline, compute remaining distance along the route, and estimate remaining time as `route.durationSeconds × (remainingDistance / route.distanceMeters)`. No Firestore field, no API call.
- **Estimated arrival time** — `now + remainingSeconds`, formatted with `date-fns`.
- **No** maneuver banner, **no** camera following, **no** heading rotation.

> This honors the "navigation phases are client-derived, no persisted progress field" decision: the in-trip remaining figures are computed locally from the already-persisted booking route + the live driver marker, not from any `tripProgress`-style field (which is explicitly **not** introduced — §10.2).

### 8.3 Passenger camera
Unchanged: `fitToCoordinates` keeping driver + pickup (waiting) or driver + destination (in-trip) in frame, with the existing 320 px bottom inset (state_management.md §7.3). Deliberately calm and stable — not a driving view.

---

## 9. Polling, Telemetry & Streaming Strategy

The defining principle (architecture.md §7.4) is preserved and extended: **cheap high-frequency telemetry is separate from expensive throttled routing**, and a third tier — **local-only, on-device camera/maneuver state** — never touches the network.

| Stream | Mechanism | Cadence | Crosses network? | Cost |
|---|---|---|---|---|
| **Camera follow + heading** (driver, new) | local `watchPositionAsync` (BestForNavigation) + `watchHeadingAsync` → `animateCamera` | ~1 s / continuous | **No** (device-local) | battery only |
| **Maneuver progression** (driver, new) | local math on the GPS stream | each GPS tick | **No** | none |
| Driver location publish (telemetry) | `watchPositionAsync` → throttled Firestore write | ~4–5 s / ~25 m (existing) | Firestore write | cheap |
| **Driver→Pickup route + publish** (driver, new/extended) | Directions (`useDriverRouteQuery`) → write `trip.driverRoute` | 60 m **or** 25 s **or** off-route (immediate) **or** phase change | Google Directions + 1 small Firestore write | metered (1 Directions) |
| **Passenger Driver→Pickup route** (new) | `onSnapshot(trips/{tripId})` → read `driverRoute` | event-driven | Firestore read | cheap |
| Passenger driver-location sub | `onSnapshot(drivers/{driverId})` | event-driven (existing) | Firestore read | cheap |
| Passenger trip sub | `onSnapshot(trips/{tripId})` | event-driven (existing) | Firestore read | cheap |
| ~~Driver→pickup Distance Matrix~~ | **retired (§6)** | — | — | **0** |
| ~~In-trip `tripProgress` publish~~ | **not introduced (§10.2)** — passenger derives in-trip stats locally (§8.2) | — | — | **0** |

**Two GPS consumers, one stream:** the driver's `watchPositionAsync` subscription feeds (a) the local camera/heading/maneuver loop at full frequency and (b) the throttled Firestore telemetry publisher and (c) the throttled `driverRoute` refresh+publish. Only the publishers are throttled; the camera loop is local and free. **[OQ-NAV-2]** Confirm running the watch at `BestForNavigation` only during nav phases (dropping to `Balanced` otherwise) is acceptable for telemetry (§13).

---

## 10. State Management

Classified per state_management.md §1. **No new Zustand store is introduced.** Navigation client state extends the existing `activeTripStore`; no navigation state is persisted to Firestore.

### 10.1 `activeTripStore` — additive ephemeral navigation state (no new store)
The existing `activeTripStore` (state_management.md §2.3) already owns the live trip + driver location. Navigation's **ephemeral client state** is added here rather than in a separate store, keeping stores flat and few (state_management.md §2) and avoiding any duplication of trip state:

```ts
interface ActiveTripState {
  // ── existing ──
  tripId: string | null;
  trip: TripDoc | null;            // includes trip.driverRoute (read by passenger)
  driverLocation: { latitude: number; longitude: number } | null;
  // ... existing actions ...

  // ── Phase 12 Navigation: EPHEMERAL CLIENT STATE (never persisted to Firestore) ──
  navCameraMode: 'follow' | 'overview';   // §2.2 / §3.4
  navHeading: number | null;              // fused, smoothed heading (§3.3)
  navSpeed: number | null;                // m/s, for heading fusion
  navStepIndex: number;                   // local maneuver progression (§4.4)
  setNavCameraMode(m: 'follow' | 'overview'): void;
  setNavHeading(h: number | null, speed: number | null): void;
  setNavStepIndex(i: number): void;
  resetNav(): void;                       // on 'ended' / clearTrip
}
```

- `NavPhase` itself is **derived** (a selector over `trip.status`), not stored — it cannot disagree with the trip.
- Selectors subscribe narrowly (`navHeading` alone for the camera, `navStepIndex` for the banner) to keep re-renders tight (state_management.md §9).
- `clearTrip()` also calls `resetNav()`.

### 10.2 Ephemeral navigation state — explicitly client-only
The following are **ephemeral client state** and **must never be synchronized through Firestore**:

- current navigation mode (follow / overview)
- follow-camera enabled / recenter state
- camera tilt / heading-follow mode
- current maneuver / next maneuver / `navStepIndex`
- maneuver banner contents and remaining-to-maneuver distance
- expanded/collapsed navigation panels
- derived `NavPhase`

Navigation **phases are client-derived** from the existing trip lifecycle (`request → accepted → driver_arriving → driver_arrived → in_progress → completed → cancelled`); each client infers whether it is *idle / navigating-to-pickup / arrived-at-pickup / navigating-to-destination / finished* without persisting those phases. These values become persisted **only** if a future, explicit business requirement demands it — e.g. **trip replay, analytics, or dispatcher monitoring** — at which point a dedicated, separately-specified field would be added. They are out of scope here.

> The **only** navigation data that is persisted is the canonical **`trip.driverRoute`** (the Driver→Pickup route the passenger must render). It is trip data (the route), not navigation UI state. No `tripProgress`, no nav-phase, no camera/maneuver field is introduced.

### 10.3 Firestore — one additive field: `trip.driverRoute`
`trips/{tripId}` gains a single additive, display-only field (no monetary data):

```ts
// Driver-published canonical Driver → Pickup route. Read by passenger + driver.
driverRoute: {
  polyline: string;          // encoded overview polyline (<= 8 KB)
  distanceMeters: number;
  durationSeconds: number;
  updatedAt: Timestamp;
} | null;
```

- **Who writes:** the **assigned driver only** (`trip.driverId == auth.uid`), and only while `status ∈ {accepted, driver_arriving}` (§15.2).
- **Who reads:** the trip participants — the assigned **driver** and the owning **passenger** — via the existing trip read rules (no rule change for reads).
- **Separate from `route`:** the booking route (`trip.route`, Pickup→Destination) is untouched; `driverRoute` (Driver→Pickup) never overwrites it (see § "Booking Route vs Driver Route").
- The maneuver steps are **not** stored — only the compact summary above.
- `trip.driverToPickup` (Phase 12 Distance Matrix field) and the Distance Matrix service are **completely removed** (§6).

### 10.4 TanStack Query — extended
- `useDriverRouteQuery` (existing) is extended to return `NavRoute` (steps included), to add the **off-route** and **phase-change** triggers, and to **publish `trip.driverRoute`** on each successful refresh (via a write effect, analogous to how the retired `useDriverToPickupETA` wrote `driverToPickup`). It stays a TanStack query ("driver-to-pickup local navigation route" is already a Query in state_management.md §1/§3) and serves both `to_pickup` (target = pickup, published) and `to_destination` (target = destination, local-only).
- No new persisted queries; nav data is never in the allow-listed persisted cache (state_management.md §5).

### 10.5 Navigation active helper
- The shared `isNavActiveStatus(status)` helper in `src/features/maps/navigation/navigationHelper.ts` is the canonical predicate to determine if navigation is active, ensuring status list consistency.

---

## 11. Component / Hook / Service Inventory

| File | New/Changed | Responsibility |
|---|---|---|
| `src/features/maps/navigation/constants.ts` | **New** | `NAV_ZOOM`, `NAV_PITCH = 45`, refresh/off-route/heading constants (§3.2) |
| `src/features/maps/navigation/maneuverIcon.ts` | **New** | `Maneuver` → Lucide icon map (§5.3) |
| `src/features/maps/navigation/types.ts` | **New** | `NavPhase`, `CameraMode`, `Maneuver`, `NavStep`, `NavRoute` |
| `src/features/maps/services/routingService.ts` | **Changed** | add `getNavigationRoute()` parsing `legs[0].steps[]` into `NavRoute` (request shape unchanged vs `getRoute`) |
| `src/features/maps/hooks/useDriverRouteQuery.ts` | **Changed** | return `NavRoute`; add off-route + phase-change triggers; parameterize target (pickup vs destination); **publish `trip.driverRoute`** on each successful `to_pickup` refresh |
| `src/features/maps/hooks/useDriverHeading.ts` | **New** | GPS-course/magnetometer fusion + smoothing → `activeTripStore.navHeading` |
| `src/features/maps/hooks/useNavigationPhase.ts` | **New** | derive `NavPhase` from `trip.status` (selector/hook; not persisted) |
| `src/features/maps/hooks/useManeuverProgress.ts` | **New** | local step advance + remaining-to-maneuver + remaining-trip distance/ETA (§4.4) |
| `src/features/maps/hooks/useNavigationCamera.ts` | **New** | follow/overview orchestration, re-center, manual-pan handling (§3.4) |
| `src/features/maps/services/distanceMatrixService.ts` | **Removed** | Distance Matrix retired (§6) |
| `src/features/maps/hooks/useDriverToPickupETA.ts` | **Removed** | superseded by `driverRoute` (§6) |
| `src/features/trip/components/LiveMap.tsx` | **Changed** | optional `navigation` prop → `animateCamera` (tilt/heading/follow); disable fit while following; passenger renders `driverRoute` polyline (§7.4, §8.1) |
| `src/features/trip/components/NavigationBanner.tsx` | **New** | maneuver icon + road name + distance (§7.1) |
| `src/features/trip/components/RecenterButton.tsx` | **New** | floating re-center pill (§7.3) |
| `src/features/trip/components/DriverTripSheets.tsx` | **Changed** | trip-stats row (ETA/distance/arrival) on en-route + in-trip sheets (§7.2) |
| `src/app/(driver)/drive.tsx` | **Changed** | wire nav hooks; pass `navigation` prop to `LiveMap`; render banner + recenter |
| `src/app/(passenger)/ride.tsx` | **Changed** | render `trip.driverRoute` (waiting) and booking `route` + client-derived in-trip stats (§8); **no** nav props |
| `src/stores/activeTripStore.ts` | **Changed** | additive ephemeral nav fields (§10.1) — **no new store** |
| `src/features/booking/validation/bookingSchema.ts` | **Changed** | add `navRouteResponseSchema`; add `driverRoute` to the trip doc type/schema (§15) |
| `firestore.rules` | **Changed** | allow assigned driver to write `driverRoute` only while `accepted`/`driver_arriving`; remove the retired `driverToPickup` write rule (§15.2) |

> No `navigationStore`, no `tripProgress`, no `computeFare`, no Share/fleet/wallet symbols — unchanged hard rule (architecture.md §4).

---

## 12. Performance Considerations

1. **Imperative camera, not React state.** Heading/center updates drive `mapRef.animateCamera` directly; they do not set React state per GPS tick. The `LiveMap.tsx` camera follow effect uses primitive dependency parameters (`mode`, `latitude`, `longitude`, `heading`, `zoom`, `pitch`) to prevent redundant updates on component renders.
2. **Memoized geometry.** Decoded route polylines and parsed steps are memoized off the raw response. The decoded points array used for off-route checks is cached on the driver route query hook (`useDriverRouteQuery`) to avoid flat-mapping steps on every single GPS location update.
3. **Narrow selectors.** Banner subscribes to `navStepIndex`; camera to `navHeading`; stats to derived ETA — separate slices (state_management.md §9).
4. **Throttled refresh + publish.** Local maneuver math runs every tick (cheap haversine); Directions + the `driverRoute` write run only on the 60 m / 25 s / off-route / phase gates (§4.3) — a handful per minute.
5. **Camera animation rate-limit.** Cap to one in-flight `animateCamera` (`NAV_CAMERA_ANIM_MS ≈ 600 ms`); coalesce GPS ticks faster than the animation so the map glides.
6. **No fit/follow contention.** The `fitToCoordinates` effect is disabled while `navCameraMode === 'follow'` (§7.4).
7. **Tear-down on phase exit.** Heading subscription, follow loop, and in-flight Directions stop on `at_pickup`/`ended` (state_management.md §6 rule); `resetNav()` clears ephemeral state.
8. **Passenger is read-only.** The passenger renders a published polyline + a marker + local arithmetic — no routing, no heavy compute.

---

## 13. Battery Considerations

Navigation is the most power-hungry mode (high-accuracy GPS + magnetometer + screen-on + map redraw). Mitigations:

1. **Accuracy is phase-scoped.** `Location.Accuracy.BestForNavigation` only during `to_pickup`/`to_destination`; balanced accuracy otherwise. Telemetry write throttle unchanged.
2. **Heading sensor is phase-scoped.** `watchHeadingAsync` subscribes only during a nav phase, torn down at `at_pickup`/`ended` (§3.3).
3. **Magnetometer only when needed.** When `speed >= HEADING_SPEED_THRESHOLD_MS`, heading comes from GPS course; the magnetometer is ignored/downsampled.
4. **Telemetry stays throttled.** The local high-frequency stream feeds the camera, but Firestore writes (location + `driverRoute`) remain on their gates — navigation does not increase write frequency.
5. **Keep-awake scoped.** If the screen must stay on (`expo-keep-awake`), enable only during nav phases, release at `ended`. **[OQ-NAV-3]** Confirm desired (default ON during nav).
6. **Foreground-only.** Background navigation out of scope (architecture.md §7.4); on background, drop to balanced/last-known and pause the camera loop.
7. **Animation budget.** Rate-limited `animateCamera` (§12.5).

---

## 14. API Usage Optimization

| Technique | Effect |
|---|---|
| **Single computation, published once** | the driver computes Driver→Pickup once and writes `driverRoute`; the passenger reads it — no second routing call (§ Billing rationale) |
| **Passenger never routes** | passenger reads `driverRoute` (waiting) + booking `route` (in-trip) from Firestore — zero Directions/Distance Matrix calls |
| **Distance Matrix retired** | distance + duration come inside the Directions response the driver already pays for (§6) — one less metered API |
| **Directions throttle (60 m / 25 s)** | bounds refreshes to a few/minute regardless of GPS frequency |
| **Off-route only on real deviation (50 m)** | avoids refresh on GPS jitter; detection is local (free) |
| **ETA from the route already paid for** | driver + passenger ETA both come from `durationSeconds` of the same Directions response — no extra call |
| **Local maneuver progression** | turn-by-turn updates at GPS frequency with zero API calls between refreshes |
| **One Directions response serves polyline + maneuvers + ETA + the published route** | steps + summary in one call |
| **Query dedupe + staleTime** | identical refresh keys dedupe; ~20 s `staleTime` prevents churn |
| **Cancel on phase change** | in-flight request for the old target is dropped, not wasted |
| **Firestore fan-out, not API fan-out** | viewers cost cheap reads; routing cost scales with drivers, not viewers |

**Rough per-trip Directions budget (illustrative):** a 10-minute pickup leg at one refresh / 25 s ≈ `600 / 25 ≈ 24` Directions calls worst-case (fewer in practice — the 60 m distance gate suppresses refreshes at lights), each also producing one small `driverRoute` write. The in-trip leg adds the driver's local refreshes for its own banner. **Distance Matrix: zero.** Passenger routing: **zero.**

> The Phase 13 **server-side Directions proxy** (phase12_spec.md §3.2) becomes more attractive with navigation's higher Directions volume — flagged but still deferred to Phase 13.

---

## 15. Zod / Schema Additions

### 15.1 `navRouteResponseSchema` (boundary validation)
Extends `routeResponseSchema` to also validate `legs[0].steps[]` (`maneuver?`, `html_instructions`, `distance.value`, `start_location`, `end_location`, `polyline.points`). Parse failure → `RoutingError` (existing), surfaced as "Could not calculate route — please try again." On failure the driver retains the last good route; the passenger renders the last published `driverRoute` snapshot.

### 15.2 `driverRoute` field + security rule
- **Type/Zod:** `driverRoute: { polyline: string(1..8192); distanceMeters: number≥0; durationSeconds: number≥0; updatedAt: Timestamp } | null`. Display-only; **no** monetary field.
- **`firestore.rules` (write):** only the assigned driver may write `driverRoute`, only while the trip is in the waiting phase:

```
// Driver → Pickup route: assigned driver only, only during the to_pickup phase.
allow update: if request.auth.uid == resource.data.driverId
  && resource.data.status in ['accepted', 'driver_arriving']
  && request.resource.data.driverRoute.distanceMeters is number
  && request.resource.data.driverRoute.durationSeconds is number
  && request.resource.data.driverRoute.polyline is string
  && request.resource.data.driverRoute.polyline.size() <= 8192
  // booking route must NOT be modified by this write — driverRoute and route are independent
  && request.resource.data.route == resource.data.route
  && ...;
```

- **Reads:** trip participants (assigned driver + owning passenger) via existing trip read rules — no read-rule change.
- The deprecated `driverToPickup` write rule (Phase 12) is **replaced** by the `driverRoute` rule above.
- Booking `create` invariants (service area + min-distance, phase12_spec.md §1.2/§1.5) are **unchanged**.

> Schema impact: one additive display field (`driverRoute`) + one validation schema. **No** monetary fields; `scripts/check-no-money.js` continues to pass unchanged.

---

## 16. Implementation Phases

Each sub-phase ends with green `expo lint` and the relevant Vitest suite.

### Phase 12N-A — Foundations (no UI change)
1. `navigation/types.ts`, `navigation/constants.ts` (`NAV_PITCH = 45`, etc.), `navigation/maneuverIcon.ts`.
2. Extend `routingService` with `getNavigationRoute()` + `navRouteResponseSchema` + step parsing/HTML-strip + road-name heuristic. Unit tests with Directions fixtures (incl. a real Ormoc route).
3. `useNavigationPhase` (status → `NavPhase`, derived/not persisted) + tests.

### Phase 12N-B — Driver route publish + maneuver logic
1. Extend `useDriverRouteQuery` to return `NavRoute`, add off-route + phase-change triggers, parameterize target, and **publish `trip.driverRoute`** on each successful `to_pickup` refresh.
2. `driverRoute` schema + `firestore.rules` (assigned-driver write, `accepted`/`driver_arriving` only; replace deprecated `driverToPickup` rule).
3. **Retire** Distance Matrix: remove/disable `distanceMatrixService` + `useDriverToPickupETA`; deprecate `trip.driverToPickup`.
4. `useManeuverProgress` (local step advance, remaining-to-maneuver, remaining-trip, ETA) + unit tests (pure geometry, no Firebase).

### Phase 12N-C — Camera & heading
1. `useDriverHeading` (fusion + smoothing → `activeTripStore.navHeading`) + tests on the fusion rule.
2. Extend `activeTripStore` with ephemeral nav fields (§10.1); no new store.
3. `LiveMap` `navigation` prop → `animateCamera` (45° tilt, heading-up, follow); disable fit while following.
4. `useNavigationCamera` (follow/overview, manual-pan/re-center).

### Phase 12N-D — Driver UI
1. `NavigationBanner` + `RecenterButton`.
2. `DriverTripSheets` trip-stats row (ETA/distance/arrival).
3. Wire in `drive.tsx`; verify `to_pickup → at_pickup → to_destination` holds Navigation Mode with no overview flash; verify `driverRoute` publishes only on the throttled triggers.

### Phase 12N-E — Passenger UI
1. `ride.tsx`: render `trip.driverRoute` polyline (violet) + ETA/distance while waiting — exact route, Firestore-only, **no** Directions call.
2. In-trip: render booking `route` (blue) + client-derived remaining ETA/distance/arrival (§8.2); confirm **no** nav props (no follow/heading/banner).

### Phase 12N-F — Verification
1. **Driver run (Ormoc):** accept → Navigation Mode engages (follow, heading-up, 45° tilt, zoomed) → banner shows correct maneuver/road/distance → ETA/arrival update → `driverRoute` republishes only on 60 m/25 s/off-route/phase → wrong turn re-routes immediately → arrive (route+banner clear, camera holds) → start trip (route+banner resume to destination, no overview flash) → complete (overview restored).
2. **Passenger run:** exact published Driver→Pickup route + ETA/distance/status while waiting (verify **zero** Directions/Distance Matrix calls via spies); driver + blue booking route + client-derived trip ETA/distance/arrival in-trip; confirm **no** banner/follow/heading.
3. **Sync check:** driver `driverRoute` write → passenger map updates via `onSnapshot` within real-time latency, with no passenger routing.
4. `expo lint`, `vitest run`, `scripts/check-no-money.js`.

---

## 17. Acceptance Criteria

**Driver navigation**
- **AC-NAV-1:** On `accepted`/`driver_arriving`, the camera follows the driver, is heading-up, ~45° tilted, and street-zoomed (not the top-down fit overview).
- **AC-NAV-2:** The maneuver banner shows next maneuver icon, road name (or instruction), and remaining distance to the maneuver, updating as the driver moves — without an API call per update.
- **AC-NAV-3:** The trip-stats row shows ETA, remaining distance, and arrival clock-time from the active route + local progression.
- **AC-NAV-4:** Directions is re-requested **and `driverRoute` republished** only on ≥60 m moved, ≥25 s elapsed, off-route (>50 m), or phase change — verified by spying on `getNavigationRoute` and the `driverRoute` write.
- **AC-NAV-5:** A deliberate wrong turn (>50 m off-route) triggers an immediate refresh (bypassing the time gate).
- **AC-NAV-6:** On `driver_arrived`, the violet route + banner clear instantly while the camera stays in the tilted follow pose (no jump to overview).
- **AC-NAV-7:** On `in_progress`, navigation resumes toward the destination with **no** visible transition back to the normal map.
- **AC-NAV-8:** Manually panning switches to overview and shows a Re-center button; tapping it (or 8 s idle) resumes follow.
- **AC-NAV-9:** On `completed`/`cancelled`, Navigation Mode fully tears down (heading sensor released, follow loop stopped, overview restored, `resetNav()` run).

**Passenger experience (Firestore-only)**
- **AC-PAX-1:** While waiting, the passenger renders the **exact published Driver→Pickup road route** from `trip.driverRoute.polyline` (not a dashed line), plus ETA (`driverRoute.durationSeconds`), remaining distance (`driverRoute.distanceMeters`), the live driver marker, and booking status.
- **AC-PAX-2:** Once `in_progress`, the passenger renders the live driver marker, the blue booking `route`, and client-derived remaining ETA / remaining distance / estimated arrival.
- **AC-PAX-3:** The passenger map **never** shows a maneuver banner, **never** follows with a heading-up camera, and **never** rotates with heading.
- **AC-PAX-4:** Passenger ↔ driver stay synchronized purely via the Firestore trip listener; a `driverRoute` write on the driver updates the passenger map without any passenger routing call.

**Cost / battery**
- **AC-COST-1:** The passenger makes **zero** Directions and **zero** Distance Matrix calls for the entire trip (verified by spies).
- **AC-COST-2:** No Distance Matrix call is made anywhere in the navigation flow (the API is retired); the driver's ETA and the passenger's pickup ETA both come from the Directions `driverRoute` response.
- **AC-COST-3:** Exactly one client (the driver) requests Directions for the Driver→Pickup leg, at most once per refresh trigger.
- **AC-BAT-1:** `BestForNavigation` accuracy and the magnetometer subscription are active only during nav phases and released at `at_pickup`/`ended`.

**Schema / separation**
- **AC-SCHEMA-1:** `trip.driverRoute` and `trip.route` are independent fields; a `driverRoute` write never modifies `route` (rule-enforced), and the two never overwrite one another.
- **AC-SCHEMA-2:** No `tripProgress`, no nav-phase, and no camera/maneuver state is written to Firestore; `scripts/check-no-money.js` passes.

---

## 18. Documentation Updates

| Doc | Update |
|---|---|
| [phase12_spec.md](./phase12_spec.md) | **Add a short cross-reference only** (in §7 Map Behavior) pointing here for all navigation behavior; do **not** merge content (§0.4). |
| [architecture.md](./architecture.md) | New subsection under §7.4 / §8: Navigation Mode camera (45° tilt, heading-up), heading fusion, off-route refresh, the driver-published `driverRoute` model + the local-only camera tier; note Distance Matrix retirement, Directions volume increase, Phase 13 proxy. |
| [navigation.md](./navigation.md) | Extend §5.2 (driver in-screen flow) and §10 with Navigation Mode: follow camera, banner, the `to_pickup → at_pickup → to_destination` hold, passenger navigation-lite reading `driverRoute`. |
| [state_management.md](./state_management.md) | Extend §2.3 with the additive ephemeral nav fields on `activeTripStore` (no new store); update §7.5 for the `driverRoute` publish/subscribe model and the retired Distance Matrix; document the local high-frequency camera stream as ephemeral, non-persisted. |
| [ui_behavior.md](./ui_behavior.md) | Extend §3.6 (passenger) and §4.2 (driver) with the maneuver banner, trip-stats row, re-center, the exact published route on the passenger side, and the no-banner/no-follow guarantee. |
| [design_system.md](./design_system.md) | Add tokens/spec for the maneuver banner (ink-900 surface, white icon/text) and the trip-stats row; record `NAV_PITCH = 45`, `NAV_ZOOM`. |
| [database_schema.md](./database_schema.md) | Document the additive `trips/{tripId}.driverRoute` (display-only, driver-written during `accepted`/`driver_arriving`, read by participants); mark `driverToPickup` deprecated; confirm `route` (booking) is unchanged and separate. |

---

## 19. Open Questions / [GAP]

> Resolved and removed: the former OQ-NAV-1 (iOS provider) and OQ-NAV-8 (camera tilt) are now final decisions in §3.1/§3.2/§3.5; the former OQ-NAV-4 (passenger driver→pickup path) is resolved by the driver-published `driverRoute` model (§4, §8, § Billing rationale); the former OQ-NAV-3 (retire Distance Matrix) is resolved by §6.

1. **OQ-NAV-1 — traffic-aware ETA.** Add `departure_time=now` for `duration_in_traffic` (better ETA, possible billing-tier impact)? Default off (§5.1).
2. **OQ-NAV-2 — accuracy profile.** Confirm `BestForNavigation` only during nav phases is acceptable for telemetry quality and battery (§9, §13).
3. **OQ-NAV-3 — keep-awake.** Should the screen stay on during navigation (`expo-keep-awake`)? Default ON during nav, OFF otherwise (§13).
4. **OQ-NAV-4 — voice guidance.** Spoken turn instructions are out of scope this phase; confirm text-banner-only is acceptable for launch.
5. **OQ-NAV-5 — road-name extraction.** Directions has no clean road-name field; the heuristic parses "onto/on {road}" from the instruction. Confirm the banner gracefully shows the full instruction when extraction fails (§5.2).

---

*Authoritative, standalone extension of [phase12_spec.md](./phase12_spec.md). Companion specs: [architecture.md](./architecture.md) · [navigation.md](./navigation.md) · [state_management.md](./state_management.md) · [ui_behavior.md](./ui_behavior.md) · [design_system.md](./design_system.md). No monetary fields are introduced — the zero-money invariant (architecture.md §15) holds.*
