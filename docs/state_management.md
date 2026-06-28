# Pakyaw — State Management (MVP)

How client state, server state, and real-time data are managed in the **MVP Pakyaw SOLO ride system**. Companion to [architecture.md](./architecture.md), [database_schema.md](./database_schema.md), [navigation.md](./navigation.md).

**Libraries:** TanStack Query (server/request state) · Zustand (global client + real-time state) · React Hook Form + Zod (form state). No Redux, no Context-as-store.

---

## 1. The one rule: classify every piece of state

Before adding state, classify it. The category determines where it lives.

| Category | Owner | Examples |
|---|---|---|
| **Request/response server state** (fetch, cache, revalidate) | **TanStack Query** | trip history list, trip detail (terminal), user profile, saved places, nearby-driver count, driver-to-pickup local navigation route |
| **Real-time server state** (live, push via `onSnapshot`) | **Zustand** (fed by listeners) | active trip + status, assigned driver location, driver's own availability, incoming requests |
| **Ephemeral client state** (UI, in-flight input) | **Zustand** (or local `useState`) | booking draft (destination, passenger count), session/role, sheet expansion, map camera |
| **Form state** | **React Hook Form + Zod** | sign-up steps, sign-in, booking form |

> **Why split server state by liveness.** TanStack Query is built for pull-based request/response with staleness. Firestore `onSnapshot` is push-based and event-driven — it doesn't fit Query's fetch model cleanly. So **live data flows listener → Zustand**, and **pull data flows service → TanStack Query**. This is principle 4 in architecture.md, made concrete.

---

## 2. Zustand stores

Four small stores, each in `src/stores/`. Stores hold state + actions; they do **not** call Firebase directly — a hook wires a service listener to a store setter (§6).

### 2.1 `sessionStore`
```ts
interface SessionState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  uid: string | null;
  role: 'passenger' | 'driver' | null;
  setSession(uid: string, role: UserRole): void;
  clear(): void;
}
```
- Fed by `onAuthStateChanged` + the `users/{uid}` role read.
- Read by the root layout guards (navigation.md §2). `status: 'loading'` keeps the splash up.

### 2.2 `bookingDraftStore` (passenger, ephemeral)
```ts
interface BookingDraftState {
  destination: Place | null;
  pickup: Place | null;
  passengerCount: number;          // 1..6
  billedSeats: number;             // derived via lib/seatModel on count change
  setDestination(p: Place): void;
  setPassengerCount(n: number): void;  // clamps + recomputes billedSeats
  reset(): void;
}
```
- Pure client state: what the passenger is composing before Confirm.
- `billedSeats` is recomputed by `lib/seatModel.ts` whenever `passengerCount` changes — the store never stores stale derived data.
- Cleared on successful booking (the trip doc takes over) or on leaving the flow. **No pricing fields.**

### 2.3 `activeTripStore` (both apps, real-time)
```ts
interface ActiveTripState {
  tripId: string | null;
  trip: TripDoc | null;            // mirror of trips/{activeTripId} via onSnapshot
  driverLocation: { latitude: number; longitude: number } | null; // assigned driver's live position (passenger side)
  setTripId(tripId: string): void;
  setTrip(t: TripDoc): void;
  clearTrip(): void;
  setDriverLocation(location: { latitude: number; longitude: number }): void;
  clearDriverLocation(): void;
}
```
- The heart of the live experience. `trip.status` drives the sheet content and any navigation (navigation.md §5).
- One active trip at a time per user (Solo). Set to `null` on `completed`/`cancelled` (after surfacing the result).

### 2.4 `availabilityStore` (driver, real-time + control)
```ts
interface AvailabilityState {
  availability: 'offline' | 'online' | 'on_trip';
  preflightPassed: boolean;
  publishing: boolean;             // is watchPositionAsync active
  incomingRequests: TripDoc[];     // nearby 'request' trips (driver-pull matching)
  setAvailability(a): void;
  setIncomingRequests(t: TripDoc[]): void;
}
```
- Drives the driver power button, online sheet, and incoming-request cards.

> Stores are deliberately **flat and few**. Anything derivable is selected, not stored. Selectors keep re-renders narrow (e.g. subscribe to `trip.status` alone, not the whole trip).

---

## 3. TanStack Query usage

Query owns everything pull-based. Query keys are centralized in each feature (`features/*/queries.ts`) and namespaced.

```ts
const queryKeys = {
  profile:    (uid: string) => ['profile', uid] as const,
  savedPlaces:(uid: string) => ['savedPlaces', uid] as const,
  history:    (uid: string) => ['history', uid] as const,
  tripDetail: (id: string)  => ['trip', id] as const,        // terminal trips only
  nearbyCount:(geohash: string) => ['nearby', geohash] as const,
};
```

| Query | Key | Stale time | Notes |
|---|---|---|---|
| User profile | `profile(uid)` | 5 min | role read at bootstrap |
| Trip history list | `history(uid)` | 1 min | **persisted** (offline last-trips, §5) |
| Trip detail (completed/cancelled) | `tripDetail(id)` | ∞ (immutable) | a terminal trip never changes |
| Saved places | `savedPlaces(uid)` | 5 min | onboarding/account |
| Nearby driver count | `nearbyCount(geohash)` | 15–30 s, `refetchInterval` | coarse supply stat (FR-1.3.2) **[ASSUMPTION]** |
| Driver-to-pickup route | `driverRoute(...)` | 20 s | local, client-throttled Directions API query; active during `accepted`/`driver_arriving` |

**Mutations** (Query `useMutation`) for one-shot writes:
- `useCreateBooking` → `booking.service.createTrip` → on success: clear `bookingDraftStore`, start active-trip listener. The mutation re-asserts the booking invariants at submit (service-area + **`route.distanceMeters >= 50`**, phase12_spec.md §1.5) — a sub-50 m route or out-of-area endpoint rejects with `MinTripDistanceError` / `ServiceAreaError` and **no Firestore write is attempted**.
- `useAcceptTrip` → `matching.service.acceptTrip` (transaction) → success or `TripAlreadyTakenError`.
- `useTripTransition` → `trip.service.transition(tripId, next)` → advances status.
- `useCancelTrip` → `trip.service.cancel(tripId, by, reason)`. Lifecycle-dependent: a `request` cancel **deletes** the trip document (abandoned request); an `accepted`/`driver_arriving`/`driver_arrived` cancel writes `status = 'cancelled'`.

Mutations **invalidate** the relevant query (`history(uid)`) on settle so history reflects the finished trip. Live state (active trip) is **not** invalidated — the listener already pushed the change.

> **Active/live trips are NOT a TanStack query.** Only **terminal** trips are cached via `tripDetail`. The active trip lives in `activeTripStore` via a listener. This avoids two sources of truth for the same document.

---

## 4. React Hook Form + Zod (form state)

- Each form owns its state locally via RHF; nothing form-internal touches Zustand until submit.
- Zod schemas in `features/*/validation/` are the **single** validation source, shared by the form resolver and (where applicable) re-asserted in security rules (e.g. `passengerCount` 1–6).
- Multi-step sign-up: RHF holds accumulated values across steps (single form instance or a step machine); only the final step commits to Firebase + writes `users/{uid}`.
- Booking "form" is light: destination + passenger count. The count feeds `bookingDraftStore`; Zod guards the range before Confirm.

Examples: `signUpSchema`, `signInSchema`, `driverSignInSchema`, `bookingSchema`.

---

## 5. Offline & cache persistence (minimal — "last trips only")

Per scope, persistence is intentionally narrow.

- **In-session Firestore resilience.** Active listeners serve their last in-memory snapshot during brief drops and queue writes (location, transitions) until reconnect — covers mid-trip connectivity gaps with no extra code. Cross-restart Firestore disk persistence is not relied upon (not a guaranteed default in the RN JS SDK); cold-start history is backed by the persisted Query cache below.
- **TanStack Query persisted cache:** `persistQueryClient` with an AsyncStorage/MMKV persister, **allow-listed to `history(uid)` and `profile(uid)` only**. Cold start with no network shows the last-loaded trip list immediately, then revalidates.
- **Everything else is memory-only.** Booking drafts, active trip, availability, nearby counts are not persisted — they must be fresh or re-derived.
- **No offline mutations beyond Firestore's built-in queue.** Creating a booking requires connectivity; the UI states this rather than optimistically queueing a ride.

```ts
// query/queryClient.ts (intent)
persistQueryClient({
  persister,
  dehydrateOptions: {
    shouldDehydrateQuery: q =>
      q.queryKey[0] === 'history' || q.queryKey[0] === 'profile',
  },
});
```

---

## 6. The listener → store bridge (real-time lifecycle)

The critical pattern: Firestore listeners are **owned by hooks**, push into **stores**, and are **always torn down**.

```ts
// features/trip/hooks/useActiveTrip.ts (intent)
export function useActiveTrip(): void {
  const tripId = useActiveTripStore((s) => s.tripId);
  const uid = useSessionStore((s) => s.uid);
  useEffect(() => {
    if (tripId == null || uid == null) return;
    const unsub = subscribe(
      tripId,
      doc => setTrip(doc),
      err => logger.error('[trip] active trip subscription error', { err })
    );
    return unsub;                 // tear down / reference-counting cleanup
  }, [tripId, uid]);
}
```

Rules:
1. **One listener per live document/query**, started in a hook `useEffect`, unsubscribed in its cleanup.
2. Listeners run only while relevant: active-trip listener while a trip exists; driver-location publish only while `online`/`on_trip`; incoming-requests query only while a driver is `online` and idle.
3. On sign-out, all stores `clear()` and all listeners are torn down (root effect) to stop billed reads.
4. Listener `onError` logs errors and clears the active trip/location to ensure UI consistency.

**Driver location publishing** (write side) lives in `useLocationPublisher`: subscribes to `expo-location` `watchPositionAsync`, applies the time+distance throttle (`lib/throttle`, `lib/geo`), and writes `drivers/{uid}.location` while the driver is `online`/`on_trip` and the app is foregrounded. Background publishing is deferred (architecture.md §7.4).

---

## 7. Map State & Coordinate Mapping

Real-time interactive maps require coordination between the Firestore data model, local state, and native maps components.

### 7.1 Coordinate Type Translation
Firestore trip coordinates are modeled with field names `{ lat: number, lng: number }`. However, `react-native-maps` requires coordinates to match `{ latitude: number, longitude: number }`.
- **UI Mapping:** The `ride.tsx` (passenger) and `drive.tsx` (driver) screens perform inline mappings of the trip coordinates before passing them down to the `LiveMap` component:
  ```ts
  pickupLocation={
    trip?.pickup?.coords
      ? { latitude: trip.pickup.coords.lat, longitude: trip.pickup.coords.lng }
      : null
  }
  ```
- **Type Safety:** This explicit transformation prevents crashes caused by mismatched property names while keeping the network model and native view layer strictly typed.

### 7.2 Live Location Tracking
The active trip state hooks manage the listener subscriptions for live driver tracking:
- When a trip enters the `'accepted'` status, the passenger's `activeTripStore` immediately activates subscription tracking for the matched driver’s document (`drivers/{driverId}`).
- As the driver publishes location updates, the passenger's map marker updates in real-time, smoothing out vehicle movement.

### 7.3 Camera Autofit & Insets
To maintain visibility of all critical markers (pickup, destination, driver, and own location):
- The `LiveMap` component calls `fitToCoordinates` whenever the coordinates array updates.
- **Visual Margins:** The camera auto-fitting behavior uses a bottom edge padding inset of `320px` to clear floating bottom sheets and action cards, ensuring markers are never hidden behind UI cards.

### 7.4 Dynamic Query Invalidations
Mutations that end a trip — completion, post-acceptance cancellation (`cancelled`), or pre-acceptance deletion of a `request` — trigger a cache invalidation on the TanStack Query client. Specifically, invalidating `history(uid)` forces a background refetch of the trip history list, keeping the history tab synchronized. (A deleted `request` simply never appears in that list.)

### 7.5 Driver Navigation Polyline, Telemetry & Throttling
- **Driver → Pickup Polyline (Violet):** During the `accepted` and `driver_arriving` trip statuses, the driver's app fetches the route locally using the custom `useDriverRouteQuery` TanStack Query hook. The route is rendered on the map in solid **Violet** (`colors.violet.primary`, `#7B61FF`) with a stroke width of 4px. If the query is loading or fails, the map falls back to a dashed violet straight line.
- **Pickup → Destination Polyline (Blue):** The passenger's booking route from the pickup location to the final destination is rendered in solid **Blue** (`colors.blue.primary`, `#2F80ED`) with a stroke width of 4px. It falls back to a dashed blue straight line when unresolved, and is visible during passenger booking and active passenger/driver rides.
- **Driver → Pickup Route persistence (Phase 12 → Navigation Experience):** Phase 12 kept the Driver→Pickup route as local UI state, never persisted. The **Navigation Experience phase supersedes this**: the driver publishes the canonical route (polyline + distance + duration) to `trips/{tripId}.driverRoute` on each throttled refresh, and the passenger reads it from the trip listener to render the exact road route — **no passenger routing call, and the Distance Matrix call is retired**. `driverRoute` is a field separate from the booking `route` and never overwrites it. Navigation camera/heading/maneuver state remains ephemeral client state on `activeTripStore` (never persisted). See **[phase12_navigation_spec.md](./phase12_navigation_spec.md)** §6 / §10 / "Booking Route vs Driver Route".
- **Decoupled Telemetry (Firestore) & Routing (Google Directions):** Real-time driver tracking (telemetry) and route polyline calculation are completely decoupled:
  - **Realtime Firestore Location Updates:** The driver publishes coordinates at high frequency via `watchPositionAsync` in `useLocationPublisher` to the `drivers/{uid}.location` document. The passenger's client subscribes to this document via `onSnapshot` to animate the driver's marker smoothly in real-time.
  - **Throttled Directions API Requests:** In contrast to the high-frequency location stream, the driver's route polyline is fetched sparingly using a client-side time-and-distance throttle ($\ge 50$ meters moved or 25 seconds elapsed since the last query) to minimize Google Directions API requests.
- **Polling and Throttling Strategy:** The `useDriverRouteQuery` hook enforces a dual-gating strategy to avoid spamming the Google Directions API:
  1. **Distance-based:** A new Directions API request is only triggered if the driver has moved $\ge 50$ meters from the coordinates of the last successful routing query (calculated using the haversine formula).
  2. **Time-based:** A new Directions API request is only triggered if at least 25 seconds have elapsed since the last successful routing query.
- **Route Lifecycle & Cleanup:** The Driver → Pickup route is active only during `accepted` and `driver_arriving` trip statuses. Upon transitioning to `driver_arrived` or subsequent statuses (e.g., `in_progress`, `completed`, or `cancelled`), the `showDriverRoute` prop evaluates to `false`, causing **both the routed violet polyline and the straight dashed fallback line to disappear instantly** from the map, ensuring a clean and decluttered interface for the driver during the active ride.

---

## 8. Data flow by scenario

**Passenger books a Solo ride:**
1. Pickup → `bookingDraftStore.setPickup(place, source)` where `source` is `'current-location'` (GPS via the pickup sheet's "Use Current Location" row), `'search'`, or `'manual-pin'`. Destination → `setDestination`; stepper → `setPassengerCount` (recomputes `billedSeats`). Whenever pickup or destination changes, the route is invalidated and `useRouteQuery` refetches.
2. Once the route resolves, the booking sheet inspects `route.distanceMeters`. If `< 50` (minimum-trip-distance rule, phase12_spec.md §1.5), Confirm stays disabled and the inline message **"Pickup and destination are too close."** appears.
3. Confirm → `useCreateBooking` mutation → `createTrip` re-asserts service-area + min-distance; if either fails the mutation rejects (`ServiceAreaError` / `MinTripDistanceError`) **before** writing. On success, `trips/{id}` is created with `status: 'request'`.
4. `bookingDraftStore.reset()`; `activeTripStore` starts listening to the new trip.
5. Sheet content now driven by `trip.status` (`request` → "Finding your ride…").

**Driver accepts:**
1. `availabilityStore.incomingRequests` (listener) renders cards.
2. Accept → `useAcceptTrip` transaction → wins: `trips/{id}.status='accepted'`, `driverId=uid`; `drivers/{uid}.activeTripId` set, `availability='on_trip'`. Loses: `TripAlreadyTakenError` → card dismissed.
3. Both apps' `activeTripStore.trip` updates via listener → screens swap to matched/navigation content.

**Lifecycle to completion:**
- Each driver action → `useTripTransition` advances status; passenger sees it via the listener. On `completed`: `activeTripStore` cleared after showing result, `drivers/{uid}` reset to `online`, `tripCount++`, `history(uid)` invalidated.

**Cancellation:**
- **Before acceptance (`request`):** `useCancelTrip` deletes the trip document. The active-trip listener fires with a non-existent document → `activeTripStore` clears → the passenger returns to the booking flow. No `cancelled` state, no history entry, no fee.
- **After acceptance (`accepted`/`driver_arriving`/`driver_arrived`):** `useCancelTrip` sets `cancelled` + `cancelledBy`; same driver teardown as completion (minus `tripCount`). No fee (deferred).
- `history(uid)` is invalidated on settle in both cases; only the retained (post-acceptance) cancellation actually surfaces in history.

---

## 9. Selector & re-render discipline

- Subscribe to the **narrowest** slice: `useActiveTripStore(s => s.trip?.status)` for the stepper, not the whole trip.
- Derive in selectors / `lib`, never store derived values (except the deliberately-cached `billedSeats`, recomputed on input change).
- Map camera and sheet-expansion are local component state unless two components need them.

---

## 10. What is intentionally NOT managed here

No store/query/cache exists for: wallet/balance, fares/totals, payments, earnings, promos, Share corridor/seat-fill, fleet data, ratings, notifications, trust scores. These are deferred; adding state for them is out of MVP scope.

---

*Companion specifications: [architecture.md](./architecture.md) · [database_schema.md](./database_schema.md) · [navigation.md](./navigation.md).*
