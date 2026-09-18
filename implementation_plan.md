# Pakyaw MVP — Implementation Plan (Solo Ride)

> **Historical / superseded planning note:** this phased MVP archive contains
> older four-seat Solo assumptions. The maintained implementation follows the
> current backend transport contract: Pakyaw accepts 1–6 actual passengers and
> always bills six seats. See `docs/branch_architecture.md`.

Phased build plan for the **MVP Solo Ride** scope only. Source of truth: [requirements.md](./docs/requirements.md), [architecture.md](./docs/architecture.md), [database_schema.md](./docs/database_schema.md), [navigation.md](./docs/navigation.md), [state_management.md](./docs/state_management.md), [api_contracts.md](./docs/api_contracts.md), [design_system.md](./docs/design_system.md), [component_inventory.md](./docs/component_inventory.md).

**Stack (frozen — no new patterns):** Expo SDK 56 · Expo Router ~56.2 · React Native 0.85 · React 19 · Firebase Auth + Firestore · Zustand · TanStack Query · React Hook Form + Zod · `expo-location`.

**Out of scope across every phase (hard rule):** Share/Carpool · Wallets · Payments · fare/commission math (real values) · Fleet/Operator console · ratings/receipts · notifications · trust/fraud · SOS backend. No module imports a pricing, wallet, fleet, or Share symbol — they do not exist in the type system.

**Phase principles**

- Each phase is **independently verifiable** — it merges and ships behind a feature gate or a stub screen, never a half-wired flow.
- No feature mixing: a phase touches its own files; cross-cutting changes (e.g. theme tokens) belong to Phase 4.
- Test cases listed are the **minimum**: Vitest unit tests for pure logic, RNTL for hooks/components, Firebase emulator for services. Manual acceptance is explicit per phase.

---

## Phase 1 — Project setup

**Goal**
Establish the feature-first folder layout, Firebase + env config, providers, and the empty service/store/lib scaffolding that every later phase imports. Ship a working app shell that compiles, lints, and renders a placeholder root screen.

**Files involved**

- `package.json` — add deps: `firebase`, `@react-native-async-storage/async-storage`, `zustand`, `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `react-hook-form`, `zod`, `@hookform/resolvers`, `expo-location`. Dev: `vitest`, `@testing-library/react-native`, `@testing-library/jest-native`.
- `.env.example` — `EXPO_PUBLIC_FIREBASE_API_KEY`, `…AUTH_DOMAIN`, `…PROJECT_ID`, `…APP_ID`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `APP_ENV`.
- `src/services/env.ts` — Zod-validated typed env accessor; fails fast on missing keys.
- `src/services/firebase/firebase.ts` — `initializeApp`, `initializeAuth(getReactNativePersistence(AsyncStorage))`, `getFirestore`. Singletons.
- `src/services/firebase/collections.ts` — typed collection refs + Firestore data converters for `users`, `drivers`, `trips`. Empty `Doc` type imports come from feature `types.ts` files added in later phases (placeholder `unknown` types acceptable initially, replaced as phases land).
- `src/services/query/queryClient.ts` — `QueryClient` + `persistQueryClient` allow-listed to `history` / `profile` keys.
- `src/lib/seatModel.ts` — `clamp(passengerCount, 4, 6)` pure function (used in Phase 6, but landed here so its tests anchor the lib).
- `src/lib/throttle.ts` — time + distance gate helper (used in Phase 5).
- `src/lib/geo.ts` — haversine + geohash encode (used in Phases 5/7).
- `src/lib/logger.ts` — single logging seam.
- `src/stores/sessionStore.ts`, `src/stores/activeTripStore.ts`, `src/stores/availabilityStore.ts`, `src/stores/bookingDraftStore.ts` — Zustand stores with empty/initial state and typed actions. Stores used in Phases 3, 5, 6, 7.
- `src/app/_layout.tsx` — replace existing demo layout with `<Providers>` (QueryClient, SafeArea, Theme) wrapping a placeholder `<Stack>`.
- `src/app/index.tsx` — placeholder "Pakyaw MVP" splash; later phases replace with redirect logic.
- `tsconfig.json` — confirm `paths` alias `@/*` → `src/*`.
- `vitest.config.ts` — minimal config with React Native test environment.
- Delete demo files: `src/app/explore.tsx`, `src/components/animated-icon.*`, `src/components/app-tabs.*`, `src/components/external-link.tsx`, `src/components/hint-row.tsx`, `src/components/themed-*`, `src/components/web-badge.tsx`, `src/components/ui/collapsible.tsx`. These are Expo template leftovers; they conflict with the MVP design system in Phase 4.

**Dependencies**
None — this is the foundation phase.

**Acceptance criteria**

- `npm run start` boots the app on iOS/Android/web and renders the placeholder index screen with no console errors.
- `npm run lint` passes.
- `import { env } from '@/services/env'` returns a typed object; missing env throws at startup with a readable Zod error.
- `firebase.ts` initializes Auth with AsyncStorage persistence (no warning about default in-memory persistence).
- All four Zustand stores are importable and return their initial state.
- `src/lib/seatModel.ts`, `throttle.ts`, `geo.ts` exist and have ≥1 export each.
- Demo Expo template files are deleted.

**Test cases**

- *unit* `seatModel.clamp(0)` → 4 · `clamp(1)` → 4 · `clamp(4)` → 4 · `clamp(5)` → 5 · `clamp(6)` → 6 · `clamp(7)` → 6.
- *unit* `throttle.shouldEmit({ lastAt, lastGeo, now, geo })` returns true when ≥4 s elapsed OR ≥25 m moved; false otherwise.
- *unit* `geo.haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })` ≈ 0; known fixture pair returns expected metres ±1 %.
- *unit* `geo.geohashOf({ lat, lng }, precision)` returns a string of the requested length and is stable across calls.
- *unit* `env` parser throws when `EXPO_PUBLIC_FIREBASE_PROJECT_ID` is missing.

---

## Phase 2 — Navigation structure (Expo Router)

**Goal**
Stand up the full route tree from [navigation.md](./docs/navigation.md) §1 with `Stack.Protected` guards keyed off `sessionStore`, using **stub screens** that render only their own name. No auth or business logic yet — the goal is to prove the guards route correctly when the session store is mutated by hand.

**Files involved**

- `src/app/_layout.tsx` — three mutually exclusive `<Stack.Protected guard={…}>` groups: `!authed` → `(auth)`, `authed && role === 'passenger'` → `(passenger)`, `authed && role === 'driver'` → `(driver)`. Splash kept up while `status === 'loading'`.
- `src/app/index.tsx` — initial redirect: onboarding-not-seen → `(auth)/onboarding`, else defer to guards.
- `src/app/(auth)/_layout.tsx` — plain `<Stack>`.
- `src/app/(auth)/onboarding.tsx`, `welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `driver-sign-in.tsx` — stub screens (title + "next" button to next route).
- `src/app/(passenger)/_layout.tsx` — `<Tabs>` with Ride · Activity · Account.
- `src/app/(passenger)/ride.tsx`, `activity.tsx`, `account.tsx`, `activity/[tripId].tsx` — stubs.
- `src/app/(driver)/_layout.tsx` — `<Tabs>` with Drive · Account.
- `src/app/(driver)/drive.tsx`, `account.tsx` — stubs.
- `src/components/dev/SessionDebugPanel.tsx` — dev-only floating panel exposing buttons "Sign in as passenger / driver / out" that mutate `sessionStore` directly. Removed in Phase 3.

**Dependencies**
Phase 1 (providers, `sessionStore`).

**Acceptance criteria**

- Cold launch with no session lands on `(auth)/onboarding`; tapping through reaches `welcome` → `sign-in` / `sign-up` / `driver-sign-in` stubs.
- Toggling `sessionStore.setSession(uid, 'passenger')` from the dev panel re-routes the user into `(passenger)` and the tab bar shows three tabs (Ride · Activity · Account).
- Toggling to `'driver'` re-routes into `(driver)` with two tabs (Drive · Account).
- Calling `sessionStore.clear()` returns to `(auth)`.
- A passenger cannot reach a `(driver)` URL by typing it (guard blocks); the URL `expo://activity/abc` from the passenger group resolves to the typed `[tripId]` stub.
- `experiments.typedRoutes` produces type errors for unknown routes.
- No imperative `router.replace` lives in any screen — guards do the routing.

**Test cases**

- *integration (RNTL)* root layout snapshots: with `status: 'loading'` renders nothing (splash); with `unauthenticated` renders `(auth)`; with `authenticated, role: 'passenger'` renders `(passenger)`; with `authenticated, role: 'driver'` renders `(driver)`.
- *integration* signing out (calling `clear()`) from a passenger tab unmounts `(passenger)` and mounts `(auth)`.
- *manual* deep link `pakyaw://(driver)/drive` while unauthenticated does not bypass the guard.
- *manual* tab switches in `(passenger)` preserve each tab's local state (e.g. typing in Ride stub, switching to Activity, returning to Ride keeps the input).

---

## Phase 3 — Authentication

**Goal**
Replace the dev session panel with real Firebase Auth: passenger sign-up (email/password + profile write), passenger sign-in, driver sign-in (email + password), session bootstrap, role resolution, sign-out. Guards in Phase 2 begin routing based on real auth state.

**Scope simplification (MVP):** SMS OTP, Firebase Phone Authentication, reCAPTCHA, `linkWithCredential`, and biometrics are **deferred** to a future *Phase 3.5b — Phone Verification* (see below). Phone numbers are captured as a profile field only; `phoneVerified` is written as `false` and the verification UX does not exist in the MVP. This avoids the account-linking complexity (`linkWithCredential(currentUser, phoneCredential)`) that Firebase Phone Auth would require when layered onto an email/password account. Driver documents and approval are handled manually outside the app.

**Passenger sign-up flow (5 steps + redirect)**

1. Email + password
2. Profile information — first name, last name, phone number
3. Rider type
4. Review
5. Create account
6. Redirect into the passenger flow

**Passenger sign-in:** email + password.

**Driver sign-in:** existing driver account — email + password.

Driver accounts are pre-provisioned manually in Firebase Authentication and Firestore with:

- role: 'driver'
- approved: true

No driver application flow exists in MVP.

**Fields written to `users/{uid}` on create:**

```ts
phoneNumber: string         // captured at sign-up, NOT verified in MVP
phoneVerified: false        // hard-coded false until Phase 3.5b
riderType: RiderType
role: 'passenger' | 'driver'
```

Plus the usual identity fields (`uid`, `firstName`, `lastName`, `email`, `createdAt`, `updatedAt`).

**Files involved**

- `src/features/auth/types.ts` — `UserRole`, `RiderType`, `UserDoc` (matching schema §2).
- `src/features/auth/validation/schemas.ts` — `signUpCredentialsSchema`, `signUpProfileSchema` (name + phone), `signUpRiderTypeSchema`, `signInSchema`, `driverSignInSchema` (email + password). **No `otpVerifySchema`.**
- `src/features/auth/services/auth.service.ts` — wraps `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `signOut`, `users/{uid}` create + read. Translates `FirebaseError` → domain errors (`AuthError`, `ValidationError`, `NetworkError`, `PermissionError`, `NotFoundError`). **No phone OTP send/verify, no `linkWithCredential`, no driver PIN logic.**
- `src/features/auth/hooks/useSession.ts` — subscribes to `onAuthStateChanged`, fetches `users/{uid}` via TanStack Query, writes into `sessionStore`. Owns the `loading → authenticated|unauthenticated` transition.
- `src/features/auth/hooks/useSignUp.ts` — `useMutation` per step (credentials, profile, rider type, create); manages step progression with RHF. **No OTP send/verify mutations.**
- `src/features/auth/hooks/useSignIn.ts`, `useDriverSignIn.ts`, `useSignOut.ts`.
- `src/features/auth/components/SignUpForm.tsx` (5-step in-screen state: credentials → profile → rider type → review → create), `SignInForm.tsx`, `DriverSignInForm.tsx`. **No `OtpField.tsx`, no resend countdown, no phone-verification screen.**
- `src/app/(auth)/sign-up.tsx`, `sign-in.tsx`, `driver-sign-in.tsx`, `onboarding.tsx`, `welcome.tsx` — replace stubs with real screens composing the feature components.
- `src/app/(passenger)/account.tsx`, `src/app/(driver)/account.tsx` — minimal: name, phone, role, **Sign out** button.
- `src/components/dev/SessionDebugPanel.tsx` — **deleted**.

**Explicitly NOT in this phase (deferred to Phase 3.5b):**

- SMS OTP send/verify
- Firebase Phone Authentication
- reCAPTCHA setup
- `OtpField` component
- Resend countdown UI
- OTP-related hooks
- OTP validation schema
- Phone verification screens
- `linkWithCredential(currentUser, phoneCredential)` flow
- Biometric sign-in

**Dependencies**
Phases 1, 2.

**Acceptance criteria**

- New passenger can complete the 5-step sign-up: credentials → profile (first name + last name + phone) → rider type → review → create → land in `(passenger)/ride` with a `users/{uid}` doc written.
- The created user doc has `phoneNumber` set from the profile step and `phoneVerified: false`.
- Existing passenger can sign in with email/password and lands in `(passenger)`.
- Pre-provisioned driver signs in with email + password and lands in `(driver)`.
- Cold start with a persisted session restores the user into the correct role group; the splash stays up until `status` resolves.
- Sign-out from either account screen clears the session, tears down listeners, and returns to `(auth)`.
- `riderType` is stored on the user doc but **no code path reads it for money** — grep for `riderType` returns hits only in `auth/` and the profile screen.
- Domain errors surface in form-level inline messages; raw `FirebaseError` codes do not appear in the UI.
- The driver application/approval flow is **not** present in the UI (no apply screens, no document upload). Driver authentication uses Firebase Authentication with email + password. Biometrics are deferred.
- No OTP, phone-verification, or `linkWithCredential` code exists anywhere — grep across `src/` for `OTP|otp|verifyPhoneNumber|linkWithCredential|RecaptchaVerifier` returns zero hits.

**Test cases**

- *unit (Zod)* `signUpCredentialsSchema` rejects malformed emails, passwords <6 chars; `signUpProfileSchema` rejects empty names and non-+63 phones.
- *unit (service mock)* `auth.service.createPassenger` translates Firebase `auth/email-already-in-use` → `AuthError`; `auth/network-request-failed` → `NetworkError`.
- *integration (emulator)* full sign-up writes a `users/{uid}` doc with `role: 'passenger'`, `phoneNumber` from form input, `phoneVerified: false`, `riderType` from form input.
- *integration (emulator)* signing in twice on cold restart resumes the same `uid` (AsyncStorage persistence works).
- *integration (RNTL)* `SignUpForm` blocks "Continue" on step 1 until the credentials Zod schema passes.
- *integration (RNTL)* `useSession` sets `status: 'loading'` initially, then `'authenticated'` with role from the user doc; the root guard then renders the matching group.
- *manual* sign-out from passenger account returns to `(auth)`; signing back in restores history listener absence (no leaked subscriptions in dev console).

---

## Phase 3.5b — Phone Verification (deferred, future scope only)

**Status:** Deferred. Not part of MVP. Listed here so the future work has a known landing pad and so MVP code does not casually grow OTP/phone-auth surface area in the meantime.

**Goal (future)**
Layer SMS-based phone verification onto an already-authenticated email/password passenger account, flipping `phoneVerified` from `false` to `true` once the OTP is confirmed.

**Future scope (not implemented in MVP)**

- Firebase Phone Auth
- SMS OTP send + verify
- reCAPTCHA (required by Firebase Phone Auth on web; native equivalents on iOS/Android)
- `linkWithCredential(currentUser, phoneCredential)` — links the phone credential to the existing email/password user without creating a separate account
- Set `phoneVerified: true` on the `users/{uid}` doc on successful link
- `OtpField` component, resend countdown, OTP validation schema, OTP hooks
- Phone verification screen(s) — entry point likely from the passenger Account screen ("Verify your phone")

**Dependencies (when picked up)**
Phase 3 (the account whose phone is being verified must already exist). Choice of SMS provider and reCAPTCHA setup are open items at that time.

**Not in this phase, ever:** biometric sign-in is tracked separately and is not coupled to phone verification.

---

## Phase 4 — Core UI system (shared components + design tokens)

**Goal**
Land the design tokens and the cross-feature primitives that Phases 5–9 compose: tokens, `Button`, `Card`, `Field`, `Sheet`, `IconChip`, `StatusPill`, `StepProgress`, `Stepper`, `Avatar`, `RouteConnector`, `EmptyState`. This phase is **purely visual** — no new business logic, no Firebase calls. Existing screens (auth, account) are restyled to use the primitives.

**Files involved**

- `src/constants/theme.ts` — replace existing with token export: `colors` (blue/amber/green/violet/semantic/ink/surface/border per [design_system.md](./docs/design_system.md) §1), `spacing` (4/8/12/16/20/24/32), `radius` (sm/md/lg/pill), `shadow` (card/sheet), `typography` (Display/H1–H3/Body/Body small/Label/Numeric).
- `src/components/Button.tsx` — variants `primary` (gradient pill) · `secondary` (outline) · `tertiary` (text) · `destructive`. States: enabled/disabled/loading. Role accent picked up from a `tone` prop (`passenger` | `driver`).
- `src/components/Field.tsx` — uppercase tracked label + leading icon slot + RHF-aware input + helper text + error state.
- `src/components/Card.tsx`, `Sheet.tsx` (rounded-top bottom sheet over map; drag handle), `IconChip.tsx`, `StatusPill.tsx` (semantic variants), `StepProgress.tsx` (pill "STEP X OF Y" + segmented bar), `Stepper.tsx` (− value + control), `Avatar.tsx`, `RouteConnector.tsx` (origin dot ─ line ─ destination dot), `EmptyState.tsx`.
- `src/components/Screen.tsx` — safe-area wrapper that applies `surface/bg-passenger` or `surface/bg-light` based on a prop or active route group.
- Refactor `auth/components/SignUpForm.tsx`, `SignInForm.tsx`, `DriverSignInForm.tsx`, `OtpField.tsx`, and the account screens to compose `Button`, `Field`, `StepProgress`.

**Dependencies**
Phase 3 (auth screens are the first consumers).

**Acceptance criteria**

- A single `theme.ts` is the only source of color/spacing/radius/typography values; grep `#` (hex) finds no inline hex outside `theme.ts`.
- Every primitive has a matching story/example in a dev-only `src/app/(dev)/components.tsx` route (gated to `__DEV__` only) for visual review.
- Auth screens render with the new tokens; visual diff against [design_system.md](./docs/design_system.md) §1–3 passes (manual review).
- No primitive imports from a feature module — primitives live in `src/components/` and depend only on `theme.ts` and React Native.
- `Sheet.tsx` exposes a controlled API (`isOpen`, `snapPoint`) that Phases 6–7 will drive from store status, not local state.

**Test cases**

- *unit (RNTL)* `Button` renders the disabled grey style when `disabled` is true; pressing while disabled does not call `onPress`.
- *unit (RNTL)* `Field` with an `error` prop shows the error text and applies the danger border.
- *unit (RNTL)* `StatusPill` with `tone="success"` uses `success` token color; with `tone="warning"` uses `warning`.
- *unit (RNTL)* `Stepper` clamps to its `min`/`max` props; tapping − at `min` is a no-op.
- *unit (RNTL)* `RouteConnector` renders two dots and a connecting line (snapshot).
- *manual* dev components route shows every primitive in every variant; designer reviews before phase signs off.

---

## Phase 5 — Driver availability and location tracking

**Goal**
Driver can pass a pre-flight checklist, toggle online/offline, and publish throttled foreground location to `drivers/{uid}` while online. Passenger app does not yet consume driver locations — that join arrives in Phase 8.

**Files involved**

- `src/features/driver-availability/types.ts` — `Availability`, `DriverDoc` (matching schema §3).
- `src/features/driver-availability/services/presence.service.ts` — `setAvailability(online|offline)` writes `drivers/{uid}.availability`, `lastSeenAt`, `preflightPassedAt`.
- `src/features/driver-availability/services/location.service.ts` — `startPublishing(uid)` / `stopPublishing()` wrapping `expo-location` `watchPositionAsync`. Applies `lib/throttle` (time gate ~4–5 s OR distance gate ~25 m). Foreground only; computes `geohash` per write. Background tracking deliberately not implemented (architecture §7.4).
- `src/features/driver-availability/hooks/useAvailability.ts` — reads from `availabilityStore`, exposes `goOnline()` / `goOffline()` mutations; gates `goOnline` behind `preflightPassed`.
- `src/features/driver-availability/hooks/useLocationPublisher.ts` — owns the `watchPositionAsync` subscription; runs only while `availability ∈ {online, on_trip}` and the app is foregrounded; permission-denied surfaces as `LocationPermissionError` (first-class state per architecture §10.7).
- `src/features/driver-availability/components/PowerButton.tsx` — green gradient pill with power icon (offline) → red/grey pill (online).
- `src/features/driver-availability/components/PreflightChecklist.tsx` — modal sheet with the 6 checklist items from FR-1.3.9 (license verified, OR/CR active, TPL insurance current, identity selfie matched, active vehicle selected, operator affiliation). All items required to enable "Go online".
- `src/features/driver-availability/components/OfflineSheet.tsx`, `OnlineSheet.tsx` — composed in `drive.tsx`.
- `src/app/(driver)/drive.tsx` — full-bleed Google Maps-stub map (real map deferred — a placeholder `<View>` with the driver's last-known coord shown as text is acceptable for MVP smoke; a real Google Maps map can be slotted in without changing this phase's contracts).
- `app.json` — add `expo-location` plugin with foreground permission strings; **no** `UIBackgroundModes` and **no** background permission strings.

**Dependencies**
Phases 1–4 (driver session, primitives, store).

**Acceptance criteria**

- Tapping the power button on `drive` while offline opens the pre-flight modal; all 6 items must be checked before "Go online" enables.
- Going online sets `drivers/{uid}.availability = 'online'`, `preflightPassedAt = now`, `lastSeenAt = now`.
- While online, the driver doc's `location`, `geohash`, `heading`, `locationUpdatedAt` update at the throttled cadence (verified in Firestore console). Writes pause when the driver goes offline or backgrounds the app.
- Denying location permission shows a permission-denied sheet with a "Open settings" CTA; the driver remains offline.
- Background location is deliberately absent — no background permission prompt is shown, no `TaskManager` task is registered.
- Going offline writes `availability = 'offline'` and the location publisher tears down (no further writes).

**Test cases**

- *unit* `lib/throttle.shouldEmit` returns true after 5 s OR 30 m of movement; false at 2 s + 10 m. (Already covered by Phase 1 — re-asserted as the gate consumed here.)
- *unit (mock)* `presence.service.setAvailability('online')` writes the expected fields; passes `serverTimestamp()` for time fields.
- *integration (RNTL + mocked service)* `useAvailability.goOnline()` is rejected when `preflightPassed` is false.
- *integration (emulator)* a sequence of 100 `expo-location` updates over 30 s produces at most ~6–8 Firestore writes (throttle holds).
- *integration (emulator)* going offline cancels the watch subscription (assert via spy).
- *manual* on a real device, driving a short loop produces visible `location` updates in the Firestore console; backgrounding the app pauses writes.

---

## Phase 6 — Passenger booking creation

**Goal**
Passenger can search a destination, set a pickup, choose a passenger count (4-seat floor), and create a `trips/{tripId}` document with `status: 'request'`, `mode: 'solo'`, `billedSeats: clamp(passengerCount, 4, 6)`. **No fare display, no payment selector, no Share toggle, no surcharge toggles.** After Confirm the passenger sees a "Finding your ride…" sheet but the trip stays in `request` until Phase 7 lands.

**Files involved**

- `src/features/booking/types.ts` — `Place`, the `CreateBookingInput`/`TripDraft` shapes (matching schema §4 fields actually written at create-time: `mode`, `passengerId`, `driverId: null`, `pickup`, `destination`, `passengerCount`, `billedSeats`, `status: 'request'`, `requestedAt`).
- `src/features/booking/validation/bookingSchema.ts` — Zod: `pickup` required, `destination` required, `passengerCount ∈ [1, 6]` (UI floor of 4 enforced separately by stepper).
- `src/features/booking/services/booking.service.ts` — `createTrip(input, passengerId)` writes `trips/{auto}` with derived `billedSeats` (re-derived in security rules per schema §8). Returns `tripId`.
- `src/features/booking/hooks/useCreateBooking.ts` — `useMutation`; on success: `bookingDraftStore.reset()`, set `activeTripStore.tripId` so Phase 8's listener picks up.
- `src/features/booking/components/DestinationSearch.tsx` — search field + results list; no map autocomplete provider in MVP, results are saved-places + free-text (real geocoder is an open item — for MVP, manual coord entry plus saved-places is acceptable; flag for follow-up).
- `src/features/booking/components/SeatStepper.tsx` — uses `Stepper` primitive with `min: 4, max: 6` (UI floor; `passengerCount` of 1–3 is allowed in the schema but the UI only ever submits ≥4 because the stepper starts at 4).
- `src/features/booking/components/PickupPicker.tsx` — placeholder picker (current location default; "Change pickup" = open a modal — design [GAP] per navigation.md §6, MVP uses a simple list of saved places).
- `src/features/booking/components/BookingSheet.tsx` — bottom-sheet content: destination summary, seat stepper, pickup point, **Confirm** button. **No peso amount anywhere.**
- `src/features/booking/components/SearchingSheet.tsx` — "Finding your ride… reserving the whole vehicle" + free-cancel countdown affordance (the *fee* it gates is deferred — countdown is UI only).
- `src/app/(passenger)/ride.tsx` — full-bleed map placeholder + sheet selected by status: no active trip → `BookingSheet`; `request` → `SearchingSheet`. Other statuses (Phase 8) are placeholders for now.

**Dependencies**
Phases 1–4.

**Acceptance criteria**

- Filling destination, leaving pickup at default ("current location"), and choosing 4 passengers (UI default), tapping Confirm writes a `trips` doc with: `passengerId == auth.uid`, `mode == 'solo'`, `status == 'request'`, `driverId == null`, `passengerCount == 4`, `billedSeats == 4`, plus `requestedAt`.
- Increasing the stepper to 5 and 6 produces `billedSeats` 5 and 6.
- The `bookingDraftStore.billedSeats` field is recomputed on every `passengerCount` change (no stale state).
- After Confirm, the booking draft is cleared, the sheet swaps to `SearchingSheet`, and the trip doc is in Firestore. The listener wiring is already present (it just has no states beyond `request` to render until Phase 8).
- **No fare**, no surcharge, no discount, no payment-method UI is rendered. Grep across `features/booking/` for `fare|price|peso|₱|surcharge|discount` returns no hits.
- Booking offline shows an "offline — try again when connected" message rather than queueing optimistically.

**Test cases**

- *unit (Zod)* `bookingSchema` rejects missing destination, missing pickup, `passengerCount` of 0 or 7.
- *unit (lib/seatModel)* re-asserted contract: 1→4, 4→4, 5→5, 6→6.
- *unit (RNTL)* `SeatStepper` cannot decrement below 4 or increment above 6.
- *unit (mock)* `booking.service.createTrip({ passengerCount: 5 })` writes `billedSeats: 5` and `status: 'request'`.
- *integration (emulator)* a non-passenger account is rejected by security rules from creating a trip (`PermissionError`).
- *integration (RNTL)* on Confirm success, `BookingSheet` unmounts and `SearchingSheet` mounts.
- *manual* destination + Confirm produces a visible doc in the Firestore console with no monetary fields.

---

## Phase 7 — Driver matching and acceptance

**Goal**
Online drivers see nearby `request` trips as incoming-request cards; tapping Accept runs the Firestore transaction (`trip.status === 'request' && driverId == null` → set `driverId`, `status: 'accepted'`, mirror to `drivers/{uid}.activeTripId`, set `availability: 'on_trip'`). Loser of the race gets a benign dismissal. Decline removes the card locally without mutating the trip.

**Files involved**

- `src/features/matching/types.ts` — `IncomingRequest` (the slim card shape from api §4.1).
- `src/features/matching/services/matching.service.ts` — `subscribeIncoming(driverGeohashPrefix, onSnap, onErr)` returns unsubscribe; `acceptTrip(tripId, driverUid)` runs a Firestore transaction asserting the invariant; throws typed `TripAlreadyTakenError` on contention.
- `src/features/matching/hooks/useIncomingRequests.ts` — owns the `subscribeIncoming` listener; pushes results into `availabilityStore.incomingRequests`. Tears down on offline / on-trip / sign-out.
- `src/features/matching/hooks/useAcceptTrip.ts` — `useMutation` wrapping `acceptTrip`; on success seeds `activeTripStore`; on `TripAlreadyTakenError` dismisses the card silently.
- `src/features/matching/components/IncomingRequestCard.tsx` — pickup label + destination label + passenger count + Accept / Decline buttons.
- `src/features/matching/components/SearchingState.tsx` — passenger-side variant ("Finding your ride…" already shipped in Phase 6 as `SearchingSheet`; reused).
- `src/app/(driver)/drive.tsx` — when `availability === 'online'` and an incoming request exists, render `IncomingRequestCard` over the `OnlineSheet`.
- `firestore.indexes.json` (root) — composite `status ASC, geohash ASC` on `trips` for the open-requests query (schema §7).
- Firestore security rules (sketch in repo `firestore.rules`) — enforce the accept invariant server-side per architecture §7.3.

**Dependencies**
Phases 5 (driver online + geohash on driver doc), 6 (trips with `status: 'request'`).

**Acceptance criteria**

- An online driver within the geohash prefix of an open `request` trip sees the card within ~2 s of trip creation.
- Tapping Accept atomically: sets `trip.driverId`, `trip.status = 'accepted'`, `trip.acceptedAt`; sets `drivers/{uid}.activeTripId = tripId`, `drivers/{uid}.availability = 'on_trip'`. The passenger's `activeTripStore` reflects the new status via the live trip listener (Phase 8 wiring; the listener is already in place by Phase 6).
- Two drivers tapping Accept on the same trip: one wins, the other gets `TripAlreadyTakenError` and the card disappears with a toast-less dismissal — **not** an error toast.
- Decline removes the card for that driver only; the trip remains `request` and other drivers still see it.
- A driver with `availability !== 'online'` does not subscribe to incoming requests.
- On sign-out or going offline, the incoming-requests listener is unsubscribed (verified by lack of further reads in Firestore console).

**Test cases**

- *unit (mock transaction)* `matching.service.acceptTrip` rejects when the read shows `status !== 'request'`; rejects when `driverId != null`; commits only when both invariants hold.
- *integration (emulator)* concurrent `acceptTrip` calls from two driver UIDs: exactly one commit succeeds; the other throws `TripAlreadyTakenError`.
- *integration (emulator)* security rule denies a driver whose `auth.uid !== driverId` from accepting (server-side enforcement).
- *integration (emulator)* security rule denies a non-driver role from accepting at all.
- *integration (RNTL)* `IncomingRequestCard` Accept calls `useAcceptTrip`; on `TripAlreadyTakenError` the component is removed without an error UI.
- *manual* with two driver devices online, the first tap wins; the loser's card disappears silently.

---

## Phase 8 — Trip lifecycle

**Goal**
The full status-driven live trip on both apps. Once `accepted`, the driver advances `accepted → driver_arriving → driver_arrived → in_progress → completed`; the passenger sees each transition in the bottom sheet with a live driver location marker. Either party can cancel from any pre-`in_progress` (or `in_progress`) state. No fees, no ratings, no receipt — the MVP records the fact of completion/cancellation only.

**Files involved**

- `src/features/trip/types.ts` — `TripStatus` closed union (`request | accepted | driver_arriving | driver_arrived | in_progress | completed | cancelled`), `TripDoc` (matching schema §4), `CancelledBy`.
- `src/features/trip/services/trip.service.ts` — `subscribe(tripId, onSnap, onErr)`; `transition(tripId, next)` enforces forward-only chain in code; `cancel(tripId, by, reason)`. On `completed`: clears `drivers/{driverId}.activeTripId`, sets `availability: 'online'`, increments `tripCount`. On `cancel` (with driver assigned): same teardown minus the increment.
- `src/features/trip/hooks/useActiveTrip.ts` — owns the `trip.service.subscribe` listener; pushes into `activeTripStore`.
- `src/features/trip/hooks/useDriverLocation.ts` — passenger-side `onSnapshot` on `drivers/{driverId}` for the assigned driver; pushes coords into `activeTripStore.driverLocation`. Active **only while the trip is active**.
- `src/features/trip/hooks/useTripActions.ts` — `useTripTransition`, `useCancelTrip`. Both invalidate the relevant TanStack Query keys on settle.
- `src/features/trip/components/TripStatusStepper.tsx` — horizontal stepper for the passenger sheet (Driver assigned · En route · Arriving) per FR-1.4.2.
- `src/features/trip/components/DriverCard.tsx` — match-card variant: avatar, name, rating, trip count, plate, call/chat icons (icons render but call/chat buttons can be no-ops in MVP).
- `src/features/trip/components/LiveMap.tsx` — wraps the map placeholder; renders the driver marker from `activeTripStore.driverLocation`.
- Sheets: `DriverMatchedSheet`, `EnRouteSheet`, `ArrivedSheet`, `InTripSheet` (passenger), `NavigateToPickupSheet`, `DriverInTripSheet` (driver), `CompletedSheet`, `CancelledSheet`. All composed in `ride.tsx` and `drive.tsx`.
- `src/app/(passenger)/ride.tsx`, `src/app/(driver)/drive.tsx` — the full status switch from navigation.md §5.1/§5.2.
- Firestore rules — enforce the forward-only chain and the cancel matrix.

**Dependencies**
Phases 5–7.

**Acceptance criteria**

- After accept (Phase 7), the passenger sheet swaps to `DriverMatchedSheet` (driver name, plate, rating).
- Driver "Start navigation" → `driver_arriving`; passenger sees "En route" with a moving driver marker on the map.
- Driver "Arrived at pickup" → `driver_arrived`; passenger sees "Your driver is here".
- Driver "Start trip" → `in_progress`; both sides show the in-trip sheet.
- Driver "End trip" or passenger "End trip" → `completed`; both sides show `CompletedSheet` with no fare; after dismiss, the passenger returns to `BookingSheet`, the driver returns to `OnlineSheet`. `drivers/{uid}.activeTripId` is null and `tripCount` incremented.
- Skipping a transition (e.g. trying to set `in_progress` from `accepted`) is rejected by both `trip.service` and security rules.
- Cancel from passenger or driver during `request`/`accepted`/`driver_arriving`/`driver_arrived`/`in_progress` writes `cancelled`, `cancelledBy`, `cancelReason`. **No fee field is set.** Driver state is reset.
- Free-cancel countdown (FR-1.4.4) appears as a UI affordance during `request`/`accepted`; the *fee* it gates is deferred and not implemented.
- The driver's live location is read from `drivers/{driverId}.location` only — no copy on the trip doc.

**Test cases**

- *unit (closed union)* a `switch (trip.status)` over `TripStatus` is exhaustively checked by the TS compiler; adding an unhandled status is a build error.
- *unit (mock)* `trip.service.transition('accepted')` from `request` rejects (only the matching transaction may set `accepted`); `transition('in_progress')` from `accepted` rejects (must pass through `driver_arriving` then `driver_arrived`).
- *unit (mock)* `trip.service.transition('completed')` clears `drivers/{driverId}.activeTripId`, resets `availability: 'online'`, and increments `tripCount` in a single batch.
- *integration (emulator)* security rule rejects a driver setting `completed` directly from `accepted`.
- *integration (emulator)* security rule rejects a passenger setting any forward transition (only End → `completed` from `in_progress` is allowed for passengers).
- *integration (emulator)* cancel from `completed` is rejected by both code and rules.
- *integration (RNTL)* the passenger sheet swaps content as the trip status changes (driver-side mock writes); no `router.push` is called between statuses.
- *integration (emulator)* the active-trip listener tears down on sign-out.
- *manual* full happy-path on two devices: passenger creates → driver accepts → navigates → arrives → starts → ends → both apps show completion → trip appears in passenger history (Phase 9).

---

## Phase 9 — Trip history

**Goal**
Passenger Activity tab lists their `completed`/`cancelled` trips, ordered by recency, paginated. Tapping a row opens a read-only detail screen. The list is the single TanStack Query allow-listed for AsyncStorage persistence so cold start with no network shows the last loaded list.

**Files involved**

- `src/features/trip-history/types.ts` — `TripHistoryItem` (slim list shape from api §6.1: `tripId`, `status`, `pickup.label`, `destination.label`, `passengerCount`, `requestedAt`, `completedAt|cancelledAt`).
- `src/features/trip-history/services/history.service.ts` — `listForPassenger(uid, { limit, cursor })` queries `trips where passengerId == uid && status in ['completed','cancelled'] order by requestedAt desc`; `getTrip(tripId)` for the detail view.
- `src/features/trip-history/hooks/useTripHistory.ts` — `useInfiniteQuery` with key `['history', uid]`, stale time 1 min. Persisted (allow-list per state_management.md §5).
- `src/features/trip-history/hooks/useTripDetail.ts` — `useQuery` with key `['trip', tripId]`, stale time `Infinity` (terminal trips never change).
- `src/features/trip-history/components/TripHistoryList.tsx` — virtualized list of `TripHistoryCard`s.
- `src/features/trip-history/components/TripHistoryCard.tsx` — header (date/time · driver name · plate) + mode badge (always "PAKYAW" in MVP) + origin → destination via `RouteConnector` + footer meta (distance/duration if present, no fare). **No "View receipt" link, no rating.**
- `src/app/(passenger)/activity.tsx` — composes the list.
- `src/app/(passenger)/activity/[tripId].tsx` — read-only detail.
- `firestore.indexes.json` — composite `passengerId ASC, requestedAt DESC`.

**Dependencies**
Phase 8 (terminal trips exist).

**Acceptance criteria**

- A passenger with 0 trips sees an `EmptyState` ("No trips yet").
- After completing or cancelling a trip in Phase 8, returning to Activity shows the trip at the top of the list within one revalidation cycle (the completion mutation invalidates `['history', uid]`).
- Pagination (cursor-based) loads older trips on scroll.
- Cold start with no network shows the last cached list immediately, then revalidates.
- Tapping a row opens the detail screen and renders the trip data with **no monetary fields** (grep `peso|₱|fare|amount` across `trip-history/` returns no hits).
- A passenger cannot read another passenger's trips (security rule denies; UI never queries by another uid).

**Test cases**

- *unit (mock)* `history.service.listForPassenger` issues the right Firestore query (filter, order, limit).
- *integration (emulator)* security rule denies `getTrip(tripId)` for a passenger who is not the trip's `passengerId`.
- *integration (RNTL)* the list invalidates on trip completion: with a mocked `useCompleteTrip`, after success the list re-fetches.
- *integration* persisted query: dehydrated cache only contains `history(*)` and `profile(*)` keys; everything else is dropped.
- *integration* `useTripDetail` for a `completed` trip uses `staleTime: Infinity` (no automatic refetch).
- *manual* airplane-mode cold start shows last loaded trips; reconnect triggers revalidation.

---

## Phase 10 — Placeholder fare engine structure (no actual pricing logic)

**Goal**
Carve out a single, isolated namespace where the deferred fare engine will eventually live, **without** introducing any pricing logic, monetary fields, or imports from MVP code. The point is to land the *boundary* now so Phase-11+ pricing work cannot leak into the MVP screens via casual imports — and so the architecture's "no monetary symbol exists" rule remains greppable.

**Files involved**

- `src/lib/fare/index.ts` — exports a single function:
  ```ts
  // Placeholder. Pricing is deferred (architecture §4 hard rule).
  // Returns null so MVP code that calls this never receives a number.
  export function computeFare(_input: FareInput): null { return null; }
  ```
- `src/lib/fare/types.ts` — `FareInput` (the shape the future engine will take: `barangay`, `billedSeats`, `riderType`, `surcharges` enum, etc.) defined as a **type-only** export. Importantly, `FareOutput` is `null` for the MVP — there is no `total`, no `breakdown`, no peso fields.
- `src/lib/fare/README.md` — one-paragraph note: "Pricing is deferred. Do not add fields here without re-opening §0 of requirements.md and the architecture.md hard rule. The MVP must continue to grep clean for `fare|peso|₱|amount|total|commission|wallet` across `src/app/`, `src/features/`, and `src/components/`."
- **No call sites are added** in this phase. No screen, hook, or service imports `computeFare`. The directory exists as a placeholder boundary only.
- `eslint.config.*` — add a `no-restricted-imports` rule that bans `@/lib/fare` from `src/app/` and `src/features/` (with a message: "Pricing is deferred — see lib/fare/README.md"). The lint rule is what makes this phase load-bearing.

**Dependencies**
None functionally. Land last so the lint rule cannot accidentally block earlier phases.

**Acceptance criteria**

- `src/lib/fare/` exists with the placeholder function, types, and README.
- `npm run lint` fails if any file under `src/app/` or `src/features/` imports from `@/lib/fare`.
- Grep across the entire `src/` (excluding `lib/fare/` and `tests/`) for `fare|peso|₱|surcharge|commission|wallet|payment` returns **zero hits**. (This is the architectural invariant; this phase is what guarantees it remains so.)
- The future fare engine has a known landing pad — when pricing returns to scope, work happens here without touching MVP modules.

**Test cases**

- *unit* `computeFare({ … })` returns `null` (type-level: `FareOutput` is `null`).
- *lint* a synthetic file `src/features/booking/_canary.ts` that imports `@/lib/fare` causes `npm run lint` to fail with the deferred-pricing message; removing the import passes.
- *grep gate (CI)* `! grep -rE 'fare|peso|₱|surcharge|commission|wallet|payment' src/app src/features src/components` returns zero hits — wire this as a CI step (or a `package.json` script `check:no-money`) so the invariant cannot regress silently.

---

## Cross-phase notes

- **Firebase emulator** is the integration test target throughout (Phases 3, 5, 6, 7, 8, 9). Set up once during Phase 1 if convenient, otherwise lazily in Phase 3.
- **Map provider:** the architecture names Google Maps but does not depend on it for any Firestore contract. Phases 5/6/8 may ship with a placeholder `<View>` map and pin markers; a real Google Maps integration (via `react-native-maps` with the Google provider on both iOS and Android) is a non-blocking polish task that can land between phases without changing any service or store contract.
- **Open items from architecture §14** are tracked here phase-by-phase: SMS provider (deferred to Phase 3.5b — Phone Verification), driver biometric (deferred to Phase 3.5b; driver authentication in Phase 3 uses Firebase Authentication with email + password), custom claims (post-MVP hardening), matching ownership (Phase 7 stays driver-pull), nearby cadence + geohash precision (Phase 5), post-trip rating/receipt (deferred — Phase 9 ships without), real-time SLA (deferred — current cadence assumed), background location (deferred — Phase 5 foreground only), push notifications (deferred).
- **Verification per phase:** every phase ends with a manual smoke run on a real device or a clean simulator boot, plus the listed unit/integration tests passing in CI. Don't sign off a phase on test green alone — open the app and try the path the user will take.

---

## Phase 11 — Real Operational Flow & Google Maps Integration

**Goal**
Convert the static MVP into a real operational flow by integrating real interactive maps using `react-native-maps`, adding live markers, displaying route polylines, and adding operational action buttons to drive the trip lifecycle on both passenger and driver apps. Securely allow passengers to release drivers on trip completion/cancellation by updating Firestore rules.

### Open Questions & Design Decisions
1. **Mock Coordinates for Saved Places**: To support map visualization when choosing "Home", "Work", or "School", we will assign realistic, close-by mock coordinates (in the Manila area) to these places in `src/features/booking/constants.ts`.
2. **Platform Map Defaults**: On iOS we will use standard Apple Maps, and on Android we will use Google Maps (configured via `react-native-maps` and Expo's config plugin). This ensures flawless execution in Expo Go and simulator environments without requiring custom native dev client builds.
3. **Firestore Security Rules**: Since the passenger can end the trip and cancel it, and both actions call `trip.service` which updates the driver's document, we will update the Firestore security rules for `drivers/{uid}` to permit updates by the passenger of the driver's active trip. This ensures the transaction completes atomically without a "Permission Denied" error.

### Proposed Changes

#### Dependency & Configuration
1. **[MODIFY] [package.json](file:///c:/Users/james/projects/pakyaw/package.json)**
   - Install `react-native-maps` using `npx expo install react-native-maps` to ensure SDK 56 compatibility.
2. **[MODIFY] [app.json](file:///c:/Users/james/projects/pakyaw/app.json)**
   - Configure the `react-native-maps` plugin under `expo.plugins` and link the Google Maps API key from the environment.

#### Map & Location
3. **[NEW] [LiveMap.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/LiveMap.tsx)**
   - Create a reusable, highly polished, and responsive interactive map component using `react-native-maps`.
   - Embed markers:
     - Pickup marker (green dot/pin)
     - Destination marker (red dot/pin)
     - Live driver marker (violet car icon/marker) using `driverLocation`
   - Render a path polyline (using `Polyline` with `colors.blue.primary` color):
     - Before trip starts (`accepted`, `driver_arriving`, `driver_arrived`): from driver's location to pickup location.
     - After trip starts (`in_progress`): from pickup location to destination location.
   - Implement premium auto-fitting behavior: use `fitToCoordinates` on the `MapView` ref to dynamically zoom/pan the map to fit all active coordinates, with generous bottom edge padding to account for the overlaying bottom sheets.
4. **[MODIFY] [types.ts](file:///c:/Users/james/projects/pakyaw/src/features/trip/types.ts)**
   - Update `DRIVER_LOCATION_ACTIVE_STATUSES` to include `'accepted'` so the passenger starts receiving driver location updates immediately upon matching.
5. **[MODIFY] [useDriverLocation.ts](file:///c:/Users/james/projects/pakyaw/src/features/trip/hooks/useDriverLocation.ts)**
   - Ensure the subscription includes `'accepted'` status in its active checks.
6. **[MODIFY] [constants.ts](file:///c:/Users/james/projects/pakyaw/src/features/booking/constants.ts)**
   - Add realistic coordinates (Manila-based) to `SAVED_PICKUP_PLACES` and `SAVED_DESTINATION_PLACES` to enable map markers.

#### Driver Flow & Controls
7. **[MODIFY] [DriverTripSheets.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/DriverTripSheets.tsx)**
   - Add state-driven operational buttons using `useTripTransition` mutation:
     - `accepted` status -> Show button **"Start navigation"** -> transition to `driver_arriving`.
     - `driver_arriving` status -> Show button **"Arrived at pickup"** -> transition to `driver_arrived`.
     - `driver_arrived` status -> Show button **"Start trip"** -> transition to `in_progress`.
     - `in_progress` status -> Show button **"End trip"** -> transition to `completed`.
     - `completed` status -> Ensure the existing **"Done"** button clears `activeTripStore` and returns the driver to `OnlineSheet`.
8. **[MODIFY] [drive.tsx](file:///c:/Users/james/projects/pakyaw/src/app/(driver)/drive.tsx)**
   - Replace `MapPlaceholder` with the real `LiveMap` component.
   - For drivers, the map will show:
     - Own location (published via location service).
     - Passenger pickup marker (always when trip is active).
     - Destination marker (after trip starts, i.e., in `in_progress` and `completed` states).
     - Polyline from own location to pickup (pre-trip) or from pickup to destination (in-progress).

#### Passenger Flow & Controls
9. **[MODIFY] [SearchingSheet.tsx](file:///c:/Users/james/projects/pakyaw/src/features/booking/components/SearchingSheet.tsx)**
   - Add a **"Cancel"** button to allow passengers to cancel their request before matching.
10. **[MODIFY] [DriverMatchedSheet.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/DriverMatchedSheet.tsx)**
    - Add a **"Cancel"** button using `useCancelTrip`.
11. **[MODIFY] [EnRouteSheet.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/EnRouteSheet.tsx)**
    - Add a **"Cancel"** button using `useCancelTrip`.
12. **[MODIFY] [ArrivedSheet.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/ArrivedSheet.tsx)**
    - Add a **"Cancel"** button using `useCancelTrip`.
13. **[MODIFY] [InTripSheet.tsx](file:///c:/Users/james/projects/pakyaw/src/features/trip/components/InTripSheet.tsx)**
    - Add an **"End trip"** button using `useTripTransition` to transition the trip to `completed`.
14. **[MODIFY] [ride.tsx](file:///c:/Users/james/projects/pakyaw/src/app/(passenger)/ride.tsx)**
    - Integrate the `LiveMap` component as a full-bleed background view behind the bottom sheets.
    - Read coordinates from the booking draft (if no active trip) or from the active trip and driver location.
    - Show pickup and destination markers, live driver marker (when available), and the route polyline.

#### Security & Rules
15. **[MODIFY] [firestore.rules](file:///c:/Users/james/projects/pakyaw/firestore.rules)**
    - Update `trips/{tripId}` rules to allow passengers to transition a trip from `in_progress` to `completed`.
    - Update `drivers/{uid}` rules to allow the passenger of the driver's active trip to release the driver (clear `activeTripId` and set `availability` to `'online'`) and update `tripCount` (increment by 1 if completing, or leave unchanged if cancelling).

#### Documentation Updates
16. **[MODIFY] [api_contracts.md](file:///c:/Users/james/projects/pakyaw/docs/api_contracts.md)**
    - Update trip lifecycle section to reflect that both driver and passenger can trigger terminal transitions (`completed`, `cancelled`) and document the updated transaction contracts.
17. **[MODIFY] [architecture.md](file:///c:/Users/james/projects/pakyaw/docs/architecture.md)**
    - Document the real `react-native-maps` integration, map auto-fitting, driver marker tracking, and passenger-initiated state transitions with their corresponding security rules.
18. **[MODIFY] [component_inventory.md](file:///c:/Users/james/projects/pakyaw/docs/component_inventory.md)**
    - Register the new `LiveMap` component and document the new buttons on the passenger and driver sheets.
19. **[MODIFY] [database_schema.md](file:///c:/Users/james/projects/pakyaw/docs/database_schema.md)**
    - Re-assert that there are no fare/payment/rating fields. Detail the fields used for live locations and state transitions.
20. **[MODIFY] [design_system.md](file:///c:/Users/james/projects/pakyaw/docs/design_system.md)**
    - Document the visualization styles for the map, including marker colors/shapes and route polylines.
21. **[MODIFY] [navigation.md](file:///c:/Users/james/projects/pakyaw/docs/navigation.md)**
    - Update the state-driven bottom sheet switching flow diagrams to include the user actions (buttons) that trigger the transitions.
22. **[MODIFY] [requirements.md](file:///c:/Users/james/projects/pakyaw/docs/requirements.md)**
    - Update requirements to reflect that the app uses real interactive maps and a fully operational, interactive flow instead of placeholder/manual database edits.
23. **[MODIFY] [screen_map.md](file:///c:/Users/james/projects/pakyaw/docs/screen_map.md)**
    - Update the screen map for `ride.tsx` and `drive.tsx` to reflect the embedding of a real `MapView`.
24. **[MODIFY] [state_management.md](file:///c:/Users/james/projects/pakyaw/docs/state_management.md)**
    - Document how `activeTripStore` and `bookingDraftStore` feed coordinates to the map.
25. **[MODIFY] [ui_behavior.md](file:///c:/Users/james/projects/pakyaw/docs/ui_behavior.md)**
    - Document the map auto-fitting behavior (`fitToCoordinates` with bottom padding), loading states on buttons during transitions, and dismiss/Done behavior.
26. **[MODIFY] [user_flows.md](file:///c:/Users/james/projects/pakyaw/docs/user_flows.md)**
    - Document the step-by-step user flow for a completed ride and a cancelled ride using the new action buttons.

### Verification Plan

#### Automated Tests
- Run `npm run test` to verify all existing unit tests pass.
- Create new unit tests in `trip.service.test.ts` or similar files to assert:
  - Transition from `in_progress` to `completed` works correctly when initiated by a passenger mock.
  - Driver location active statuses include `accepted`.
- Run `npm run lint` to ensure no linting errors.

#### Manual Verification
- **Cold Boot & Booking Flow**: Open the passenger app, select a destination (e.g. "Work"), select seats, and verify the pickup and destination markers render correctly on the interactive map. Tap "Confirm booking" and see the passenger sheet transition to "Finding your ride...".
- **Driver Matching & Acceptance**: Open the driver app, go online (pass pre-flight checklist), see the incoming request card, and tap "Accept".
- **Trip Lifecycle Progression**:
  - Driver taps "Start navigation" -> both apps transition to `driver_arriving`. The passenger map shows the driver marker approaching.
  - Driver taps "Arrived at pickup" -> both apps transition to `driver_arrived`. Passenger sheet shows "Your driver has arrived".
  - Driver taps "Start trip" -> both apps transition to `in_progress`.
  - Driver or passenger taps "End trip" -> both apps transition to `completed`.
  - Tap "Done" on both sides -> driver returns to `OnlineSheet`, passenger returns to `BookingSheet`. Verify the driver's doc has `activeTripId = null`, `availability = 'online'`, and `tripCount` incremented by 1.
- **Cancellation Flow**: Start a new trip, matching it, then tap "Cancel" on the passenger side during `driver_arriving`. Verify both apps transition to `cancelled` and the driver is released (doc has `activeTripId = null`, `availability = 'online'`, and `tripCount` unchanged).
