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

**Why this shape:** A passenger and a driver app share most primitives (auth, map, trip) but diverge in flows. A feature-first tree lets both route groups (`(passenger)`, `(driver)`) compose the same feature modules without duplicating logic. The two apps ship from one codebase, one Firebase project, one trip model.

> **Single app, two role spaces.** This is **one** Expo binary. Role is resolved at sign-in and the router sends the user into the matching route group. There is no separate driver build for the MVP. (Driver *application/approval* is out of MVP scope — see §4.)

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
| `booking` | Destination select, Solo seat stepper (4-seat floor), pickup point, confirm | Share mode, fare math, surcharges, discounts, payment method, promos |
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
   └───────────┴──────────────┴──────────────────┴───────────────────────▶ cancelled
```

| Status | Meaning | Set by | Passenger sees | Driver sees |
|---|---|---|---|---|
| `request` | Created, awaiting a driver | passenger (create) | "Finding your ride… reserving the whole vehicle" + free-cancel countdown | incoming-request card (if targeted) |
| `accepted` | A driver accepted | driver (accept) | "Driver matched" card | "Navigate to pickup" |
| `driver_arriving` | Driver en route to pickup | driver | ETA + stepper (En route) | navigation |
| `driver_arrived` | Driver at pickup | driver | "Your driver is here" | "Start trip" + (deferred) no-show timer |
| `in_progress` | Passenger on board, moving | driver (start) | live trip + End trip | live trip |
| `completed` | Trip finished | driver (or passenger End) | summary (no fare) → history | back to online |
| `cancelled` | Aborted | passenger or driver | cancel result | request removed |

**Transition rules (enforced in `trip.service.ts` + mirrored in Firestore security rules):**
- Only forward transitions along the chain are allowed; no skipping (except → `cancelled`, allowed from any pre-`in_progress`/`in_progress` state per the cancel matrix).
- `request → accepted` is a **guarded write**: the accept must win a race (see §7.3). Once `driverId` is set, other accepts are rejected.
- Each transition stamps a timestamp (`requestedAt`, `acceptedAt`, …) for history and ordering.
- `cancelled` records `cancelledBy` (`passenger`|`driver`) and a `cancelReason`. **Fee/penalty governance is deferred** — the MVP records the fact of cancellation only, no money.
- The free-cancel **countdown** (FR-1.4.4) is a UI affordance over the `request`/`accepted` window; the *fee* it gates is out of scope.

The enum is a closed TypeScript union (`trip/types.ts`) so every consumer (`switch`) is exhaustively checked. Adding a state later is a deliberate, type-checked change — not an open string.

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

> **Write-cost guardrail.** Location is the highest-frequency write in the system. It is **throttled on the client** (time + distance gate) and only published while `online`. See §8 and [state_management.md](./state_management.md) §6.

---

## 8. Real-time, throttling & performance

| Stream | Mechanism | Cadence | Notes |
|---|---|---|---|
| Active trip status | `onSnapshot(trips/{tripId})` | event-driven | drives both apps' sheet content |
| Driver location (to passenger) | `onSnapshot(drivers/{driverId})` | event-driven | only while trip active |
| Driver location (publish) | `watchPositionAsync` → throttled write | ~4–5 s / ~25 m | client-throttled; foreground only; pause when offline |
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

1. **Typed errors at the service edge.** Services translate Firebase errors into a small domain error set (`AuthError`, `TripAlreadyTakenError`, `PermissionError`, `NetworkError`, `LocationPermissionError`). Raw `FirebaseError` codes never reach UI.
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
- **Keys (MVP):** Firebase web config (`EXPO_PUBLIC_FIREBASE_*`), Google Maps API key (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`). The Google Maps key is restricted (Android package + iOS bundle + HTTP referrer in Google Cloud Console) so a leaked bundle cannot be reused elsewhere; any server-side Google Maps key and any SMS-provider secret are build/CI-only, never in the bundle.
- **One typed accessor.** `services/env.ts` reads `process.env`, validates presence with **Zod** at startup, and exports a typed `env` object. Missing/invalid config fails fast with a clear message instead of an undefined-at-runtime crash.
- **Environments:** `development` / `production` selected via `APP_ENV`; separate Firebase projects per environment **[ASSUMPTION]** (recommended) so test traffic never touches prod data.
- **`app.json`** holds non-secret native config (scheme, plugins, foreground location permission strings). No background-location native config is needed for the MVP (background tracking is deferred — §7.4). Secrets are not committed; `.env.example` documents required keys.

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
- **Secure Transaction & Rules updates**: Extended Firestore security rules (`firestore.rules`) to allow the passenger of the driver's active trip to write the driver teardown transaction during completion or cancellation. This permits the client-side transaction in `trip.service.ts` to successfully update the driver doc (clear `activeTripId`, set `availability = 'online'`, and conditionally increment `tripCount`) while maintaining strict access control.
- **Zero-Money Invariant**: Re-asserted the hard rule that no fare, payment, rating, or shared-ride elements are present in the map, sheets, or transaction logic.

---

*Companion specifications: [database_schema.md](./database_schema.md) · [state_management.md](./state_management.md) · [navigation.md](./navigation.md).*
