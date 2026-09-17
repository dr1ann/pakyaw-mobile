# Pakyaw — MVP Architecture

Architecture for the **MVP Pakyaw SOLO ride system** only. Scope is fixed to: passenger auth, driver auth, driver availability, driver location updates, passenger booking, driver matching/acceptance, the trip lifecycle, and trip history.

**Out of scope (do not build, do not design for):** Share/Carpool, Fleet Owner console, Perks/Pasabuy/logistics, wallets, payments, fare/commission math, earnings, SaaS tiers, advanced fraud/trust systems. Pricing formulas are deferred and must not shape the design.

**Companion docs:** [database_schema.md](./database_schema.md), [state_management.md](./state_management.md), [navigation.md](./navigation.md). Source of truth: [requirements.md](./requirements.md).

> **SDK note:** This targets Expo SDK 56 / Expo Router ~56.2 / React Native 0.85 / React 19 (see `package.json`). Routing uses `Stack.Protected` guards (SDK 53+ API), not the legacy redirect pattern.

---

## 1. Architectural principles

1. **Feature-first, not layer-first.** Code is grouped by domain feature (`auth`, `booking`, `trip`, …), not by technical layer (`screens/`, `services/`, `hooks/` at the top). Each feature owns its screens-glue, components, hooks, services, types, and validation.
2. **The route tree is thin.** `src/app/` (Expo Router) contains only route files that wire layout + a screen component imported from a feature. No business logic lives in `app/`.
3. **The trip document is the single source of truth.** Both passenger and driver apps render from one `trips/{tripId}` document and its `status` field. The status drives every screen transition. No parallel state machines.
4. **Server state vs client state are separated.** TanStack Query owns request/response reads (history, profiles). Firestore real-time listeners feed Zustand for live data (active trip, driver presence). See [state_management.md](./state_management.md).
5. **Simple service modules, no repository pattern.** Each feature has a `*.service.ts` that wraps the Firebase SDK directly. Abstractions are added only when a second consumer or a real swap appears.
6. **Prefer extensibility through data, not abstraction.** New states/fields are added to documents; we avoid speculative interfaces for deferred features.

---

## 2. Folder structure (feature-based)

```
src/
  app/                         # Expo Router route tree — thin wiring only
    _layout.tsx                # Root: providers + Stack.Protected guards
    sign-in.tsx                # (see navigation.md for full tree)
    (passenger)/ ...
    (driver)/ ...

  features/
    auth/
      components/              # SignInForm, OtpField, RoleGate...
      hooks/                   # useSession, useSignUp, useDriverLogin
      services/                # auth.service.ts (Firebase Auth wrappers)
      validation/              # zod schemas (signUpSchema, signInSchema)
      types.ts
    driver-availability/
      components/              # PowerButton, PreflightChecklist
      hooks/                   # useAvailability, useLocationPublisher
      services/                # presence.service.ts, location.service.ts
      types.ts
    booking/
      components/              # DestinationSearch, SeatStepper, BookingSheet
      hooks/                   # useCreateBooking (seat math is lib/seatModel.ts)
      services/                # booking.service.ts
      validation/              # bookingSchema (destination, passengerCount)
      types.ts
    matching/
      components/              # IncomingRequestCard, SearchingState
      hooks/                   # useIncomingRequests, useAcceptTrip
      services/                # matching.service.ts
      types.ts
    trip/
      components/              # TripStatusStepper, DriverCard, LiveMap
      hooks/                   # useActiveTrip, useTripActions
      services/                # trip.service.ts (lifecycle transitions)
      types.ts                 # TripStatus union + Trip model
    trip-history/
      components/              # TripHistoryList, TripHistoryCard
      hooks/                   # useTripHistory
      services/                # history.service.ts
      types.ts

  components/                  # cross-feature UI primitives (Button, Card, Sheet, Field)
  stores/                      # zustand stores (session, activeTrip, availability, bookingDraft)
  services/
    firebase/                  # firebase.ts (init), collections.ts (typed refs)
    query/                     # queryClient.ts + persistence
  lib/                         # pure helpers (seatModel.ts, geo.ts, googleMaps.ts, dates.ts)
  constants/                   # theme.ts, ormoc-zones.ts (barangay list only, no fares)
  hooks/                       # generic cross-feature hooks (useThrottle, useColorScheme)
```

**Why this shape:** A passenger and a driver app share most primitives (auth, map, trip) but diverge in flows. A feature-first tree lets both route groups (`(passenger)`, `(driver)`) compose the same feature modules without duplicating logic. The two apps use one Firebase project and trip model, but ship as separate native binaries with role-specific identities.

> **Separate role binary.** This branch ships the Driver Expo binary. It uses
> the shared Firebase project and trip model, but not the Passenger native
> package, bundle identifier, deep-link scheme, or EAS project. Driver
> application/approval scope remains governed by the current onboarding flow.

---

## 3. Screen architecture (Passenger + Driver only)

Screens are thin. A route file renders a feature screen-component; the screen-component composes feature hooks + shared UI. No data fetching in route files.

### 3.1 Passenger screens (MVP subset of `screen_map.md`)

| Screen | Route | Feature(s) | Source |
|---|---|---|---|
| Onboarding carousel | `onboarding` | `auth` | flow 1.1 |
| Welcome / account choice | `welcome` | `auth` | flow 1.1 |
| Sign up (5 steps) | `(auth)/sign-up` | `auth` | flow 1.2 |
| Sign in | `(auth)/sign-in` | `auth` | flow 1.3 |
| Ride home (map + search) | `(passenger)/ride` | `booking` | flow 1.4 |
| Fare/booking sheet (Solo only) | sheet on `ride` | `booking` | flow 1.4 |
| Searching for driver | sheet/state on `ride` | `matching` | flow 1.4 |
| Driver matched + en route + arriving | sheet/state on `ride` | `trip` | FR-1.4.1–1.4.4 |
| Activity / trip history | `(passenger)/activity` | `trip-history` | FR-1.5.4 |
| Account | `(passenger)/account` | `auth` | flow 1.7 |

> **Booking sheet is Solo-only.** The `ride` screen renders a single mode (Pakyaw/Solo). The mode toggle, Share corridor UI, fare breakdown, surcharge toggles, privilege discount, and payment selector from the Figma fare sheet are **out of scope** (Share + pricing deferred). The sheet keeps only: destination summary, **passengers-boarding stepper (4-seat floor)**, pickup point, and **Confirm**. No peso amounts are shown.

### 3.2 Driver screens (MVP subset)

| Screen | Route | Feature(s) | Source |
|---|---|---|---|
| Driver sign in | `(auth)/driver-sign-in` | `auth` | flow 2.2 |
| Drive home — offline/online (map) | `(driver)/drive` | `driver-availability` | flow 2.6 |
| Pre-flight checklist | sheet on `drive` | `driver-availability` | FR-1.3.9 |
| Incoming request card | sheet/state on `drive` | `matching` | FR-1.3.11 |
| Active trip (navigate → arrived → in-progress → complete) | sheet/state on `drive` | `trip` | FR-1.4.x |
| Driver account | `(driver)/account` | `auth` | flow 2.8 |

> Driver **application** (6-step apply, document upload, payout, agreements, "under review") is **deferred** — see §4. MVP drivers are pre-provisioned/approved manually in Firestore. Returning-driver sign-in (email + password) is in scope. Biometric unlock remains deferred to Phase 3.5b.

### 3.3 Map-first + bottom-sheet pattern

Both `ride` and `drive` are full-bleed Google Maps screens with a bottom sheet whose **content is selected by trip/availability status**, not by navigation. Status changes swap sheet content in place; the user does not navigate between "searching" and "matched" — the same screen re-renders. This is the concrete expression of principle 3.3 (trip doc drives transitions) and is detailed in [navigation.md](./navigation.md) §5.

---

## 4. MVP scope guardrails (what each feature deliberately omits)

| Feature | In MVP | Explicitly excluded |
|---|---|---|
| `auth` | Passenger email+password sign-up, profile capture (incl. unverified phone number), rider-type field (stored, not priced); driver sign-in (phone + PIN) | Phone verification / SMS OTP (deferred to Phase 3.5b), driver *application/approval*, fleet auth, password reset (open item), 2FA, biometric unlock |
| `driver-availability` | Online/offline, pre-flight checklist, foreground+background location publishing | QR vehicle pairing, heat/demand map, shift analytics |
| `booking` | Destination select, Solo seat stepper (4-seat floor), pickup point, confirm; **service-area + minimum-trip-distance gating (layered UI / service / Firestore rules — see phase12_spec.md §1.2, §1.5)** | Share mode, fare math, surcharges, discounts, payment method, promos |
| `matching` | Solo dispatch, driver incoming-request accept/decline | Share corridor heuristic, occupancy lock, QR street-hail |
| `trip` | Full lifecycle + live tracking + cancel + end | SOS backend, fee governance, ratings/receipt (open item), anti-leakage |
| `trip-history` | Passenger list + read-only detail | Receipts, monthly Spent/Saved/Distance, insights, wallet |

**Hard rule:** no module imports a pricing, wallet, fleet, or Share symbol. There are none. Deferred concerns are absent from the type system so they cannot leak into MVP code.

---

## 5. Trip lifecycle (the core state machine)

The trip document's `status` is the backbone of the whole product. One enum, one document, both apps subscribe.

```
request ─▶ accepted ─▶ driver_arriving ─▶ driver_arrived ─▶ in_progress ─▶ completed
   │           │              │                  │
   │           └──────────────┴──────────────────┴───────────────────────▶ cancelled
   │
   └─▶ (cancelled before any driver accepts ⇒ the trip document is DELETED —
        an abandoned request: no `cancelled` status, nothing enters history)
```

| Status | Meaning | Set by | Passenger sees | Driver sees |
|---|---|---|---|---|
| `request` | Created, awaiting a driver | passenger (create) | "Finding your ride… reserving the whole vehicle" + free-cancel countdown | incoming-request card (if targeted) |
| `accepted` | A driver accepted | driver (accept) | "Driver matched" card | "Navigate to pickup" |
| `driver_arriving` | Driver en route to pickup | driver | ETA + stepper (En route) | navigation |
| `driver_arrived` | Driver at pickup | driver | "Your driver is here" | "Start trip" + (deferred) no-show timer |
| `in_progress` | Passenger on board, moving | driver (start) | live trip + End trip | live trip |
| `completed` | Trip finished | driver (or passenger End) | summary (no fare) → history | back to online |
| `cancelled` | Aborted **after** a driver accepted | passenger or driver | cancel result | trip removed from active |

> A `request` cancelled **before** acceptance never reaches the `cancelled` row — its document is deleted outright (see the transition rules below).

**Transition rules (enforced in `trip.service.ts` + mirrored in Firestore security rules):**
- Only forward transitions along the chain are allowed; no skipping.
- `request → accepted` is a **guarded write**: the accept must win a race (see §7.3). Once `driverId` is set, other accepts are rejected.
- Each transition stamps a timestamp (`requestedAt`, `acceptedAt`, …) for history and ordering.
- **Cancellation is lifecycle-dependent:**
  - **Before acceptance (`request`):** the passenger cancelling deletes the trip document entirely (`tx.delete`). No `cancelled` status is written, nothing enters history, and driver listeners receive a Firestore **document-removal** event. This is an *abandoned booking request*.
  - **After acceptance (`accepted` / `driver_arriving` / `driver_arrived`):** the document is **retained**, `status` becomes `cancelled` (recording `cancelledBy` and `cancelReason`), the trip stays in history, and the assigned driver's availability is restored (`activeTripId → null`, `availability → 'online'`) in the same transaction. **Fee/penalty governance is deferred** — the MVP records the fact of cancellation only, no money.
  - **During the ride (`in_progress`):** cancellation is **not allowed** — only completion. Either the passenger (End trip) or the driver may complete the trip.
- The free-cancel **countdown** (FR-1.4.4) is a UI affordance over the `request`/`accepted` window; the *fee* it gates is out of scope.

The enum is a closed TypeScript union (`trip/types.ts`) so every consumer (`switch`) is exhaustively checked. Adding a state later is a deliberate, type-checked change — not an open string.

### 5.1 Booking validation — layered business rules

Two booking invariants are enforced **identically and consistently across three layers** (UI · booking service · Firestore rules), defined in detail in [phase12_spec.md](./phase12_spec.md) §1.2 (Ormoc service-area restriction) and §1.5 (minimum trip distance). Both follow the same pattern:

| Layer | Mechanism | Purpose |
|---|---|---|
| **L1 — UI** | Inline message, invalid-state visuals, **disabled Confirm** | Stop the user before they submit. UX only. |
| **L2 — Booking service** | `bookingService.createTrip` re-asserts the invariant against the current draft and throws a typed domain error (`ServiceAreaError`, `MinTripDistanceError`) **before** any Firestore write | Race protection — guards against in-flight route refetches or stale UI state at submit. |
| **L3 — Firestore rules** | Numeric bounds in `firestore.rules` (`pickup`/`destination` coords inside Ormoc; `50 <= route.distanceMeters <= 60_000`) | Backstop a malicious or out-of-date client cannot bypass. |

L3 is the only layer an attacker cannot bypass; L1/L2 exist for fast user feedback and to keep bad payloads off the wire. This **same** pattern is the template for any future business invariant added to the booking flow (e.g., per-driver-radius caps, vehicle-type gating) — UI surfaces it, the service re-asserts it, and the rule is the final word.

For the minimum-trip-distance rule specifically: validation is **always** on `route.distanceMeters` returned by the Directions API, never on latitude/longitude equality between pickup and destination. The rationale (GPS jitter, POI snapping, road-graph mismatch) and the choice of 50 m are documented in [phase12_spec.md §1.5](./phase12_spec.md#15-minimum-trip-distance--50-m).

---

## 6. Authentication flow

Firebase Authentication is the identity source. A user's **role** (`passenger` | `driver`) lives in their Firestore `users/{uid}` doc, not in the auth token, for the MVP (no custom claims needed yet — see §10 for the production hardening note).

### 6.1 Session bootstrap
1. **Auth must be initialized with React Native persistence.** Firebase Auth in the Expo/JS SDK does **not** persist sessions across app restarts by default — `firebase.ts` initializes Auth with `getReactNativePersistence(AsyncStorage)` (via `initializeAuth`), otherwise users are signed out on every cold start. This is a correctness requirement, not an optimization.
2. Root layout subscribes to `onAuthStateChanged` (via `useSession`, backed by a Zustand `sessionStore`).
3. While auth state is resolving, the splash overlay stays up (auth is async — keep splash until `isLoading` is false).
4. On resolve:
   - **No user** → router guards route to `(auth)`.
   - **User present** → fetch `users/{uid}` (TanStack Query) → read `role` → guards route into `(passenger)` or `(driver)`.

### 6.2 Passenger sign-up (5 steps + redirect, FR-1.1.2 / FR-1.1.4 / FR-1.1.5)
- Step 1 (email + password): `createUserWithEmailAndPassword`.
- Step 2 (profile information): first name, last name, phone number. The phone number is **captured but not verified** in the MVP — phone verification (SMS OTP) is deferred to **Phase 3.5b** so the MVP avoids `linkWithCredential` and SMS-provider integration.
- Step 3 (rider type: Regular/Student/PWD/Senior): **stored as a field only**; the 20% discount it implies is deferred pricing and has no effect in the MVP.
- Step 4 (review): user reviews the entered values before commit.
- Step 5 (create account): writes `users/{uid}` with `role: 'passenger'`, `firstName`, `lastName`, `phoneNumber` (string), `phoneVerified: false` (hard-coded until Phase 3.5b), and `riderType`.
- Redirect: on success the router lands the new account inside the `(passenger)` group.

> **FR-1.1.3 (phone verification) is intentionally deferred** to Phase 3.5b. The `phoneVerified` field exists on `users/{uid}` so the schema is forward-compatible with the future flow; it is simply pinned to `false` for MVP accounts.

### 6.3 Driver sign-in (FR-1.1.15)
- Returning driver: phone number + PIN. MVP drivers are **pre-provisioned** in Firestore (manual console entry) with `role: 'driver'`, `approved: true`, and a PIN field. The sign-in service performs a simple Firestore-field compare against the stored PIN — no biometric, no Phone Auth.
- **Driver application, document upload, and approval are handled manually outside the app** for the MVP. Biometric unlock is deferred to Phase 3.5b.

### 6.4 Guarding
Routing uses **`Stack.Protected` guards** (SDK 53+; confirmed available in SDK 56). The root stack declares three mutually exclusive guarded groups keyed off `session` + `role`. No imperative redirects in screens. Full tree in [navigation.md](./navigation.md).

```
<Stack>
  <Stack.Protected guard={!session}>            … (auth) group
  <Stack.Protected guard={session && role==='passenger'}>  … (passenger) group
  <Stack.Protected guard={session && role==='driver'}>     … (driver) group
</Stack>
```

---

## 7. Firebase integration

### 7.1 Products used (MVP)
| Product | Use |
|---|---|
| **Firebase Auth** | Identity (email/password only in MVP). Initialized with **AsyncStorage persistence** so sessions survive restarts (§6.1). Phone Auth is deferred to Phase 3.5b. |
| **Cloud Firestore** | All app data + **real-time** trip/presence sync via `onSnapshot` |
| **Firebase Storage** | Reserved; **not used in MVP** (document upload is part of deferred driver application). Listed for completeness only. |
| Cloud Messaging | **Future** — not wired in MVP (notifications deferred) |

The real-time backbone is **Firestore listeners** (`onSnapshot`), not Realtime Database. The active trip and driver presence are small, low-frequency-write documents — well within Firestore's real-time capabilities at MVP scale (§9).

### 7.2 Service layer (simple modules, no repository pattern)
Each feature owns a `*.service.ts` that wraps the Firebase SDK directly and returns plain typed values/promises or subscription handles. No generic `Repository<T>`; abstraction is added only when a real second backend or consumer appears (principle 5).

```
services/firebase/firebase.ts      # initializeApp, getAuth, getFirestore (singletons)
services/firebase/collections.ts   # typed collection refs + converters
features/auth/services/auth.service.ts
features/booking/services/booking.service.ts
features/matching/services/matching.service.ts
features/trip/services/trip.service.ts
features/driver-availability/services/{presence,location}.service.ts
features/trip-history/services/history.service.ts
```

A service function does exactly one Firebase operation (a read, a write, a transaction, or returns an `onSnapshot` unsubscribe). Hooks compose services with TanStack Query / Zustand; React never touches the SDK directly. Typed converters in `collections.ts` are the single place where Firestore `DocumentData` becomes a domain type.

### 7.3 Concurrency: the accept race
`request → accepted` is the one place two clients contend. `matching.service.acceptTrip` runs a **Firestore transaction**: read the trip, assert `status === 'request'` and `driverId == null`, then set `driverId` + `status: 'accepted'`. Losers get a typed `TripAlreadyTakenError` and their request card dismisses. Security rules also assert the same invariant server-side so a malicious client cannot steal an assigned trip.

### 7.4 Driver availability + location (FR-1.3.9, driver location updates)
- **Presence:** `presence.service.ts` writes `drivers/{uid}.availability` = `online`/`offline` and `lastSeenAt`. Going online is gated behind the pre-flight checklist (client-side for MVP).
- **Location publishing (foreground only for MVP):** `location.service.ts` uses **`expo-location`** `watchPositionAsync` → throttled writes (~every 4–5 s or ~25 m, see §8) to `drivers/{uid}.location`, running while the driver is `online`/`on_trip` **and the app is foregrounded**. The driving surface is the in-app Google Maps `drive` screen, so foreground tracking satisfies the requirement.
  - **Background location is deliberately NOT in the MVP.** `TaskManager` + `startLocationUpdatesAsync`, iOS `UIBackgroundModes`, a background-permission prompt, and the mandatory dev/standalone build it forces are post-MVP. The location code is structured so background publishing slots into `location.service.ts` later without touching consumers. (Open item §14.)
- **Consumption:** the passenger's active-trip screen subscribes to the assigned driver's `drivers/{driverId}` doc via `onSnapshot` and reads `location`. There is **no separate per-coordinate collection** and **no copy of the location on the trip doc** — last-known location is a single field on the driver doc, kept as one source of truth.
- **Separation between Real-Time Location Tracking and Routing Queries:** There is a strict architectural separation between high-frequency real-time location tracking (telemetry) and the Google Directions API routing requests. Real-time marker movement is driven entirely by the Firestore location publisher/subscriber streams (which are fast and cheap, writing only coordinates). In contrast, the Google Directions API is only used to calculate and render route polylines, which is done locally on the clients. This decouples the database from expensive Directions API routing queries.
- **Driver → Pickup Navigation Polyline (Violet) & Polling/Throttling Strategy:** During the `accepted` and `driver_arriving` statuses of the trip lifecycle, the driver's app fetches the route locally using the custom `useDriverRouteQuery` React Query hook. 
  - **Styling:** The map renders the route in solid **Violet** (`colors.violet.primary`, `#7B61FF`) with a stroke width of 4px, or falls back to a dashed violet straight line if the route is not yet resolved.
  - **No Firestore Persistence (Phase 12 only — superseded):** In Phase 12 this route was strictly UI-only with no database writes. **The Navigation Experience phase supersedes this:** the driver now publishes the canonical Driver→Pickup route to `trips/{tripId}.driverRoute` so the passenger renders the exact road route from Firestore without its own Directions call. See **[phase12_navigation_spec.md](./phase12_navigation_spec.md)** (§4, §6, §10.3) — `driverRoute` is a separate field from the booking `route` and the Distance Matrix call is retired.
  - **Throttling/Polling Strategy:** To prevent query spam during GPS updates and conserve API costs, Directions API requests are throttled on the client: a new API request is triggered only when the driver has moved significantly ($\ge 50$ meters) from the coordinates of the last successful query (calculated via the haversine formula), or when 25 seconds have elapsed. (The navigation phase adds off-route and phase-change triggers and publishes each refresh to `driverRoute` — see the navigation spec §4.3.)
  - **Route Lifecycle & Cleanup:** The polyline and its straight-line fallback are active only during `accepted` and `driver_arriving` statuses. Upon transitioning to `driver_arrived` or subsequent statuses (e.g., `in_progress`, `completed`, `cancelled`), the `showDriverRoute` prop evaluates to `false`, instantly removing both the routed violet polyline and the dashed fallback line from the map to keep the driver's view decluttered.
- **Pickup → Destination Polyline (Blue):** The passenger booking route (pickup -> destination) remains completely independent of the driver navigation route. It is rendered on the map in solid **Blue** (`colors.blue.primary`, `#2F80ED`) with a stroke width of 4px (or falls back to a dashed blue straight line when unresolved), visible during passenger booking and active passenger/driver rides.

> **Write-cost guardrail.** Location is the highest-frequency write in the system. It is **throttled on the client** (time + distance gate) and only published while `online`. See §8 and [state_management.md](./state_management.md) §6.

---

## 8. Real-time, throttling & performance

| Stream | Mechanism | Cadence | Notes |
|---|---|---|---|
| Active trip status | `onSnapshot(trips/{tripId})` | event-driven | drives both apps' sheet content |
| Driver location (to passenger) | `onSnapshot(drivers/{driverId})` | event-driven | only while trip active |
| Driver location (publish) | `watchPositionAsync` → throttled write | ~4–5 s / ~25 m | client-throttled; foreground only; pause when offline |
| Driver → Pickup route | local Google Directions API fetch | $\ge 50$ m movement or 25 s elapsed | client-throttled; published to `trip.driverRoute` for the passenger (navigation spec §4); active during `accepted`/`driver_arriving` only |
| Nearby supply ("N drivers within 1km") | periodic query | ~15–30 s **[ASSUMPTION]** | coarse; geohash bucket query (§db schema) |
| Incoming requests (driver) | `onSnapshot` on a query | event-driven | filtered to driver's area/availability |

Throttling lives in `lib/` helpers (`useThrottle`, distance gate) so it is testable in isolation (Vitest). Listeners are always torn down on screen blur / trip end / sign-out to avoid leaked reads (lifecycle owned by hooks; see state_management.md §6).

---

## 9. Scalability assumptions (small-city rollout)

Target (NFR-5): ~100 drivers × ~10 rides/day ≈ **30k bookings/month**, single city (Ormoc). Design implications:

- **Firestore is sufficient.** At this scale, document reads/writes and `onSnapshot` fan-out are comfortably within Firestore limits and a sane cost envelope. No sharding, no dedicated real-time server.
- **Hot-spot avoidance:** the only sustained-write document class is `drivers/{uid}` (location). Per-driver doc + client throttle keeps each driver well under Firestore's 1 write/sec/document soft limit. No monotonically increasing index keys.
- **Geo queries:** nearby-driver lookups use a **geohash prefix** field on `drivers` (single-field range query) rather than a true geo-index — adequate for one city. (See database_schema.md §5.)
- **Matching is centralized-light:** MVP Solo matching can be client/driver-pull (drivers see nearby `request` trips and accept) — no Cloud Function required to launch. A Cloud Function dispatcher is a **later** optimization, not an MVP dependency, and slots in behind `matching.service.ts` without UI change.
- **Stateless clients:** all shared truth is in Firestore; clients hold only cache + ephemeral UI state, so horizontal "scale" is just more app installs.
- **Headroom:** the schema and service boundaries allow moving matching/geo to Cloud Functions + a geo library, or to GeoFirestore, without touching screens or stores.

---

## 10. Error handling

A single, layered strategy:

1. **Typed errors at the service edge.** Services translate Firebase errors into a small domain error set (`AuthError`, `TripAlreadyTakenError`, `PermissionError`, `NetworkError`, `LocationPermissionError`, **`ServiceAreaError`**, **`MinTripDistanceError`**). Raw `FirebaseError` codes never reach UI.
2. **TanStack Query** owns ret/retry + error/loading for request-style reads (history, profile): bounded retries with backoff, `isError` surfaced to screens.
3. **Real-time listeners** carry an `onError` that sets a connection flag in the relevant store; screens show a non-blocking "reconnecting" affordance and Firestore's offline cache continues serving last value.
4. **Mutations** (create booking, accept, transition, cancel) are awaited with explicit success/failure UI; the accept race surfaces `TripAlreadyTakenError` as a benign "ride was taken" dismissal, not an error toast.
5. **Validation errors** never reach the service layer — **Zod + React Hook Form** validate at the form boundary (auth, booking). Schemas live in each feature's `validation/`.
6. **Global fallback:** an Expo Router error boundary per route group catches render-time failures; `lib/logger.ts` is the single logging seam (console in dev; pluggable later).
7. **Permission/location denials** (location refused or restricted to foreground) are first-class states with explicit screens/prompts, not silent failures — critical for the driver location requirement.

> The Figma/UX docs flag missing error UI (`ui_behavior.md` §7) as a **[GAP]**. The architecture defines *where* errors are handled; concrete copy/dialogs are a design follow-up.

---

## 11. Minimal offline caching

Scope: **read-only resilience for recently seen data**, not offline mutations.

- **The persisted "last trips" cache is the TanStack Query cache.** Query is configured with `persistQueryClient` (AsyncStorage/MMKV), allow-listed to the **trip-history list** and **user profile** only. On cold start with no network the passenger sees their last-loaded trips immediately, then revalidates. This is the single deliberately persisted cache (per scope: "last trips only").
- **In-session Firestore resilience.** Active-trip and profile listeners keep serving their last in-memory snapshot during brief drops, and queued writes (location, transitions) flush on reconnect. (Cross-restart Firestore disk persistence is not relied upon here — the JS SDK's persistent cache is not a guaranteed default in React Native, so the TanStack persisted cache above is what backs cold-start history.)
- **Not in scope:** offline booking, optimistic trip creation, conflict resolution, full sync. A booking requires connectivity; the UI states this rather than queueing.

Details and cache keys in [state_management.md](./state_management.md) §5.

---

## 12. Environment configuration

- **`dotenv` + Expo public env.** Config is read from `.env*` files. Client-exposed values use the `EXPO_PUBLIC_` prefix (inlined at build); anything secret stays out of the client.
- **Keys (MVP):** Firebase web config (`EXPO_PUBLIC_FIREBASE_*`), Google Maps API key (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`). The Google Maps key is restricted to the role-specific Android package (`com.pakyaw.driver`) and iOS bundle (`com.pakyaw.driver`) plus any required HTTP referrer in Google Cloud Console; any server-side Google Maps key and any SMS-provider secret are build/CI-only, never in the bundle.
- **One typed accessor.** `services/env.ts` reads `process.env`, validates presence with **Zod** at startup, and exports a typed `env` object. Missing/invalid config fails fast with a clear message instead of an undefined-at-runtime crash.
- **Environments:** `development` / `production` selected via `APP_ENV`; separate Firebase projects per environment **[ASSUMPTION]** (recommended) so test traffic never touches prod data.
- **`app.json` / `app.config.js`** hold non-secret native config (the Driver-specific scheme, package/bundle IDs, plugins, and location permission strings). Driver background location is enabled only for its operational flow. Secrets and role-specific native Firebase files are not committed; `.env.example` documents the required build inputs.

---

## 13. Testing & quality (how the architecture supports it)

- **Vitest + React Native Testing Library.** Pure logic (`lib/seatModel.ts`, throttle, geohash, the trip transition guard) is unit-tested with no Firebase. Services are tested against the **Firebase emulator** (or thin mocks). Hooks tested with RTL + a mocked service layer — the service boundary is the seam that makes this cheap.
- **ESLint + Prettier** enforce style; the feature-first boundaries are lint-guardable (no cross-feature deep imports).
- The closed `TripStatus` union + Zod schemas mean most contract errors are caught at compile time.

---

## 14. Open items / assumptions (confirm before build)

1. **SMS OTP provider** for passenger phone verification — **deferred to Phase 3.5b** (Firebase Phone Auth + `linkWithCredential` vs third-party SMS). (FR-1.1.3)
2. **Driver PIN** storage mechanism for the MVP (plain Firestore-field compare is the working assumption); how MVP drivers are provisioned/approved manually given the application flow is deferred. **Biometric unlock is deferred to Phase 3.5b.** (FR-1.1.15)
3. **Custom claims** for role — MVP reads role from Firestore; production should mint a role custom claim so security rules don't read a second doc on every check. (§6, §10 hardening)
4. **Matching ownership** — confirm MVP launches with driver-pull matching vs a Cloud Function dispatcher. (§9)
5. **Nearby-supply cadence** and geohash precision for "N drivers within 1km". (FR-1.3.2)
6. **Post-trip rating/receipt** is referenced by UX but deferred — confirm `completed` simply returns to history with no rating in MVP. (screen_map [GAP])
7. **Real-time SLA / location cadence** numbers (NFR-4) are assumptions; confirm acceptable update interval vs cost.
8. **Background driver location** is deferred (foreground only in MVP, §7.4) — confirm this is acceptable for launch, since it adds a background-permission prompt and a standalone build when introduced.
9. **Push notifications** (Expo Notifications) are deferred; trip transitions are in-app only for MVP — confirm acceptable.

---

## 15. Phase 11 Updates — Real Operational Flow & Maps Integration

The following architectural updates were made in Phase 11:
- **Interactive Map Architecture**: Replaced the static `MapPlaceholder` views with `react-native-maps` on both the passenger (`ride.tsx`) and driver (`drive.tsx`) screens. Standard platform maps are used (Apple Maps on iOS, Google Maps on Android) for robust simulator and Expo Go execution.
- **Dynamic Camera & Auto-fitting**: Implemented a responsive auto-fitting mechanism utilizing `fitToCoordinates` on the map reference. The map zooms and pans to contain all active markers (passenger own location, live driver location, pickup location, and destination location) with a custom bottom edge padding of `320px` to keep markers visible above the floating bottom sheets.
- **Operational State Machine Integration**: Integrated `useTripTransition` and `useCancelTrip` hooks directly into the passenger and driver bottom sheets. Users can interactively progress through the trip lifecycle (accepted -> en route -> arrived -> in-progress -> completed) and perform cancellations without manually editing Firestore documents.
- **Secure Transaction & Rules updates**: Trip completion/cancellation and SharedRide membership are committed by backend callables. The Driver client may publish only its safe location/progress fields; availability, `activeTripId`, `activeSharedRideId`, and trip counters remain server-owned.
- **Zero-Money Invariant**: Re-asserted the hard rule that no fare, payment, rating, or shared-ride elements are present in the map, sheets, or transaction logic.

---

*Companion specifications: [database_schema.md](./database_schema.md) · [state_management.md](./state_management.md) · [navigation.md](./navigation.md).*
