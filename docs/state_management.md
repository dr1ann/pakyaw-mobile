# Pakyaw — State Management (MVP)

How client state, server state, and real-time data are managed in the **MVP Pakyaw SOLO ride system**. Companion to [architecture.md](./architecture.md), [database_schema.md](./database_schema.md), [navigation.md](./navigation.md).

**Libraries:** TanStack Query (server/request state) · Zustand (global client + real-time state) · React Hook Form + Zod (form state). No Redux, no Context-as-store.

---

## 1. The one rule: classify every piece of state

Before adding state, classify it. The category determines where it lives.

| Category | Owner | Examples |
|---|---|---|
| **Request/response server state** (fetch, cache, revalidate) | **TanStack Query** | trip history list, trip detail (terminal), user profile, saved places, nearby-driver count |
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

**Mutations** (Query `useMutation`) for one-shot writes:
- `useCreateBooking` → `booking.service.createTrip` → on success: clear `bookingDraftStore`, start active-trip listener.
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

---

## 8. Data flow by scenario

**Passenger books a Solo ride:**
1. Destination → `bookingDraftStore.setDestination`; stepper → `setPassengerCount` (recomputes `billedSeats`).
2. Confirm → `useCreateBooking` mutation → `createTrip` writes `trips/{id}` (`status:'request'`).
3. `bookingDraftStore.reset()`; `activeTripStore` starts listening to the new trip.
4. Sheet content now driven by `trip.status` (`request` → "Finding your ride…").

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
