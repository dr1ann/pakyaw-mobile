# Pakyaw — Navigation (MVP)

Expo Router navigation for the **MVP Pakyaw SOLO ride system**. Companion to [architecture.md](./architecture.md), [database_schema.md](./database_schema.md), [state_management.md](./state_management.md).

**Router:** Expo Router ~56.2 (file-based). **Guarding:** `Stack.Protected` with `guard` props (SDK 53+; available in SDK 56). **Typed routes** are on (`app.json` `experiments.typedRoutes`).

> **One binary, role-routed.** A single app contains both passenger and driver spaces. Role (from `users/{uid}.role`) selects which route group the user lands in. There is no separate driver app in the MVP.

---

## 1. Route tree

```
src/app/
  _layout.tsx                  # Root: providers + Stack.Protected guards (auth/role)
  index.tsx                    # entry → onboarding or role home (redirect logic)

  (auth)/                      # guard: status === 'unauthenticated'
    _layout.tsx                # plain <Stack>
    onboarding.tsx             # passenger intro carousel (flow 1.1)
    welcome.tsx                # "Welcome to Pakyaw" account choice
    sign-in.tsx                # passenger email + password (flow 1.3)
    sign-up.tsx                # passenger 4-step (incl. OTP) (flow 1.2)
    driver-sign-in.tsx         # driver mobile + PIN (flow 2.2)

  (passenger)/                 # guard: authenticated && role === 'passenger'
    _layout.tsx                # <Tabs>: Ride · Activity · Account
    ride.tsx                   # map + booking sheet + live trip (status-driven)
    activity.tsx               # trip history list (FR-1.5.4)
    activity/[tripId].tsx      # read-only trip detail
    account.tsx                # profile / sign out

  (driver)/                    # guard: authenticated && role === 'driver'
    _layout.tsx                # <Tabs>: Drive · Account   (Earnings/Wallet deferred)
    drive.tsx                  # map + offline/online + preflight + trip (status-driven)
    account.tsx                # profile / vehicle / sign out
```

What's **deferred and therefore absent**: passenger Wallet tab, driver Earnings/Wallet tabs, driver application flow (`apply/*`), fleet group entirely, Share screens, fare/payment screens, notifications, ratings/receipt. Tabs are reduced to MVP surfaces.

---

## 2. Root guards (`app/_layout.tsx`)

Three mutually exclusive guarded groups, keyed off `sessionStore`. No imperative redirects inside screens; the guards do the routing (state_management.md §2.1).

```tsx
function RootLayout() {
  const { status, role } = useSession();          // sessionStore
  const authed = status === 'authenticated';

  // keep splash up while resolving (architecture.md §6.1)
  if (status === 'loading') return null;           // splash overlay still mounted

  return (
    <Providers>                                    {/* QueryClient, SafeArea, Theme */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!authed}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={authed && role === 'passenger'}>
          <Stack.Screen name="(passenger)" />
        </Stack.Protected>

        <Stack.Protected guard={authed && role === 'driver'}>
          <Stack.Screen name="(driver)" />
        </Stack.Protected>
      </Stack>
    </Providers>
  );
}
```

- Signing in flips `status`/`role`; the matching group becomes reachable and the router moves there automatically. Signing out flips guards back to `(auth)`.
- Because the three guards are exclusive, a passenger can never reach `(driver)` routes and vice-versa — enforced at the navigator, in addition to security rules.

---

## 3. Auth group (`(auth)`)

A plain stack (no tabs). Flow order:

```
onboarding ──(Skip / finish)──▶ welcome
welcome ──"Create account"──▶ sign-up (4 steps, in-screen step state)
welcome ──"I already have an account"──▶ sign-in
welcome / sign-in ──(driver entry)──▶ driver-sign-in
```

- **`sign-up.tsx`** holds the 4 steps internally (RHF step state + an in-screen progress pill), not as 4 routes — so Back preserves entered data and the URL stays stable. The OTP sub-step is a state within step 2, not a route.
- **`onboarding`** is shown once (first launch); a persisted flag skips straight to `welcome`/home thereafter. **[ASSUMPTION]** flag stored locally.
- Driver vs passenger entry: `welcome` routes passengers to `sign-up`/`sign-in`; the driver entry point goes to `driver-sign-in`. (Driver *application* is deferred — drivers are pre-provisioned.)

---

## 4. Role tab groups

### 4.1 Passenger tabs (`(passenger)/_layout.tsx`)
`<Tabs>` with three screens — **Ride · Activity · Account** (matches `component_inventory.md` 1.2 minus the deferred Wallet tab).

- **Ride** is the default/anchor tab and the map-first home.
- **Activity** is a stack: list (`activity.tsx`) → detail (`activity/[tripId].tsx`).
- Tab switches preserve each tab's state (booking state on Ride is not lost by visiting Activity — ui_behavior.md §1.1).

### 4.2 Driver tabs (`(driver)/_layout.tsx`)
`<Tabs>` with two screens — **Drive · Account** (Earnings + Wallet deferred).

- **Drive** is the default/anchor tab and the map-first home.

---

## 5. Status-driven in-screen navigation (the key pattern)

The live ride is **not** a sequence of routes. On both `ride.tsx` and `drive.tsx`, a single map screen renders a **bottom sheet whose content is selected by trip/availability status** from `activeTripStore` (state_management.md §2.3/§6). The user does not `router.push` between "searching" and "matched" — the same route re-renders.

### 5.1 Passenger `ride.tsx`
```
no active trip            → BookingSheet (destination, seat stepper, pickup, Confirm)
trip.status:
  'request'               → SearchingSheet ("Finding your ride…" + free-cancel countdown).
                            "Cancel request" DELETES the trip doc → listener sees the doc
                            removed → activeTripStore clears → returns to booking flow.
                            (No CancelledSheet — an abandoned request shows no terminal screen.)
  'accepted'              → DriverMatchedSheet (driver card)
  'driver_arriving'       → EnRouteSheet (ETA + stepper: En route) + live driver marker
  'driver_arrived'        → ArrivedSheet ("Your driver is here")
  'in_progress'           → InTripSheet (live map, Share/SOS/End trip controls)
  'completed'             → CompletedSheet (summary, no fare) → then clears → Ride home
  'cancelled'             → CancelledSheet → clears → Ride home
                            (Only reached for cancellations AFTER acceptance.)
```

### 5.2 Driver `drive.tsx`
```
availability 'offline'    → OfflineSheet (power button)
power tapped              → PreflightChecklist (modal sheet over dimmed map)
availability 'online'     → OnlineSheet (+ IncomingRequestCard when a nearby request arrives)
active trip (on_trip):
  'accepted'              → NavigateToPickupSheet ("Start navigation")
  'driver_arriving'       → en-route nav
  'driver_arrived'        → "Start trip"
  'in_progress'           → InTripSheet ("End trip")
  'completed'/'cancelled' → result → back to OnlineSheet
```

**Why in-screen, not route-based:** the trip document is the single source of truth (architecture.md §3.3, §5). Modeling each status as a route would create a second state machine in the router that could disagree with `trip.status`. One screen + status-selected content keeps them impossible to desync. Sheet transitions are animated content swaps, not navigations.

---

## 6. Modals & overlays

Presented with `presentation: 'modal'` (or as sheet content), not as new tabs:
- **Pre-flight checklist** (driver) — modal sheet over dimmed map (ui_behavior.md §4.1).
- **Pickup-point change** (passenger) — modal picker over the map. **[GAP]** picker screen not in Figma.
- **Cancel confirmation** — confirm dialog before `useCancelTrip`. **[GAP]** dialog copy not in Figma (ui_behavior.md §6).

SOS, Share-fallback, report-abuse, and rating dialogs are **deferred/out of scope** and have no routes in the MVP.

---

## 7. Deep links & entry

- `scheme: 'pakyaw'` (app.json). MVP deep-linking is minimal: cold launch resolves auth → guards land the user on their role anchor (`ride` / `drive`) or `(auth)`.
- `index.tsx` performs the initial redirect: onboarding-not-seen → `(auth)/onboarding`; else defer to guards.
- Push-notification deep links (e.g. "driver arrived") are **deferred** with notifications.

---

## 8. Navigation ↔ state contract

| Decision | Driven by | Where |
|---|---|---|
| Which route group | `sessionStore.status` + `role` | root guards (§2) |
| Which sheet on Ride/Drive | `activeTripStore.trip.status` / `availabilityStore` | in-screen (§5) |
| Tab persistence | Expo Router `<Tabs>` | role layouts (§4) |
| Step within sign-up | RHF local state | `sign-up.tsx` (§3) |
| Trip detail params | typed route `activity/[tripId]` | history (§1) |

Guards never read live trip state; in-screen sheets never call `router` for status changes. The two layers don't overlap — that separation is the navigation design's core invariant.

---

## 9. Phase 11 Navigation & Lifecycle Actions

The navigation flows were completed in Phase 11 to support interactive, state-driven transitions using action buttons:
- **Interactive State Transitions**:
  - **Passenger Ride Screen (`ride.tsx`)**: Renders `LiveMap` full-screen. Under the hood, the bottom sheet automatically swaps components as the Firestore `trip.status` changes. `SearchingSheet` (status `request`) shows a **"Cancel request"** button that **deletes** the trip document (abandoned request) — the listener observes the removal and the screen reverts to the booking flow with no terminal sheet. `DriverMatchedSheet`, `EnRouteSheet`, and `ArrivedSheet` show **"Cancel ride"** buttons that set the state to `cancelled` (document retained). `InTripSheet` shows an **"End trip"** button that transitions the state to `completed`; `in_progress` cannot be cancelled.
  - **Driver Drive Screen (`drive.tsx`)**: Renders `LiveMap` with their own live position. The driver sheet displays primary operational buttons:
    - `"Start navigation"` (on `DriverAcceptedSheet` / status `accepted`) -> transitions to `driver_arriving`.
    - `"Arrived at pickup"` (on `DriverEnRouteSheet` / status `driver_arriving`) -> transitions to `driver_arrived`.
    - `"Start trip"` (on `DriverArrivedSheet` / status `driver_arrived`) -> transitions to `in_progress`.
    - `"End trip"` (on `DriverInTripSheet` / status `in_progress`) -> transitions to `completed`.
- **Terminal Dismissals**:
  - Passenger `CompletedSheet` and `CancelledSheet` render a `"Done"` button that clears `activeTripStore` (calling `clearTrip()`), causing `ride.tsx` to automatically revert back to `BookingSheet`.
  - Driver `DriverCompletedSheet` and `DriverCancelledSheet` render a `"Done"` button that clears `activeTripStore` and resets availability to `'online'`, causing `drive.tsx` to automatically revert back to `OnlineSheet`.

---

## 10. Phase 12 Map, Route & Location Tracking Updates

The map, route rendering, and location tracking are fully integrated with the status-driven operational flows:
- **Driver → Pickup Polyline (Violet) & Lifecycle:**
  - **Activation & Styling:** When the driver transitions to `accepted` or `driver_arriving` status (en route to the pickup point), the driver's map screen (`drive.tsx`) activates the local `useDriverRouteQuery` React Query hook. The map renders this driver-to-pickup route in solid **Violet** (`colors.violet.primary`, `#7B61FF`) with a stroke width of 4px. If the query is loading or fails, the map falls back to a dashed violet straight line.
  - **Firestore Persistence (Phase 12 → Navigation Experience):** Phase 12 kept this route strictly client-side. The **Navigation Experience phase supersedes that**: the driver publishes the canonical Driver→Pickup route to `trips/{tripId}.driverRoute` (separate from the booking `route`) so the passenger renders the exact road route from the Firestore listener with zero passenger routing. See **[phase12_navigation_spec.md](./phase12_navigation_spec.md)** §4 / §8 / §10.3.
  - **Throttling/Polling Strategy:** To prevent spamming the Google Directions API with requests during rapid GPS updates, the driver's client throttles routing requests: a new API request is triggered only when the driver has moved significantly ($\ge 50$ meters) from the coordinates of the last successful routing query, or when 25 seconds have elapsed.
  - **Route Lifecycle & Cleanup:** The polyline is active only during `accepted` and `driver_arriving` statuses. Upon transitioning to `driver_arrived` (or subsequent statuses like `in_progress`, `completed`, or `cancelled`), the `showDriverRoute` prop evaluates to `false`, causing **both the routed violet polyline and the straight dashed fallback line to disappear instantly** from the map, ensuring a clean and decluttered interface for the driver during the active ride.
- **Passenger Booking Route (Blue):**
  - The passenger booking route (pickup -> destination) remains completely independent of the driver navigation route.
  - It is rendered on the map in solid **Blue** (`colors.blue.primary`, `#2F80ED`) with a stroke width of 4px (or falls back to a dashed blue straight line when unresolved), and is visible when `showDestination` is `true` (on both the passenger screen during booking/ride and during the active ride on the driver screen).
- **Decoupled Telemetry (Firestore) & Routing (Google Directions):**
  - **Realtime Firestore Location Updates:** The driver's device publishes its live coordinates at high frequency (every 4–5 seconds or 25 meters moved) to `drivers/{uid}.location` via `watchPositionAsync` in the `useLocationPublisher` hook. The passenger's client subscribes to this document via `onSnapshot` to animate the driver's vehicle marker smoothly in real-time.
  - **Decoupling:** High-frequency real-time location updates (telemetry) and Google Directions API requests are completely decoupled. Real-time marker movements are cheap Firestore writes/reads, whereas routing polylines use the Google Directions API client-side and are strictly throttled.
- **Marker Key Re-mounting:** Both the pickup and destination markers are dynamically keyed based on their draggable status (e.g., `key={pickupKey != null ? \`pickup-\${pickupKey}-\${!!onPickupDragEnd}\` : 'pickup-default'}`). When transitioning from booking (draggable) to active trip (non-draggable), the key changes, forcing a complete re-mount to prevent a native `react-native-maps` rendering bug that could cause the markers to disappear on the passenger side.

---

*Companion specifications: [architecture.md](./architecture.md) · [database_schema.md](./database_schema.md) · [state_management.md](./state_management.md).*

