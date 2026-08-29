# Branch Split Manifest — Pakyaw Ride-Hailing App

> Generated: 2026-07-05 | Branch: `map-fix` | Total files classified: ~363

This manifest classifies every file in the repository as **DRIVER_ONLY**, **PASSENGER_ONLY**, or **SHARED** to guide splitting the monorepo into two separate branches (one per role).

---

## Classification Legend

| Tag | Meaning |
|-----|---------|
| `DRIVER_ONLY` | Only the driver-side branch needs this file |
| `PASSENGER_ONLY` | Only the passenger-side branch needs this file |
| `SHARED` | Both branches need this file |

For `SHARED` files, a recommendation is included:

| Recommendation | When to use |
|----------------|-------------|
| **EXTRACT** | Move to a shared package/module both branches import (significant shared logic with clear API) |
| **DUPLICATE** | Small enough to copy into both branches; may diverge over time |
| **KEEP_SHARED** | Leave as-is; both branches depend on the same package/configuration |

---

## 1. DRIVER_ONLY Files

These files should exist **only** in the driver-side branch.

### Source: `src/`

```
src/app/(auth)/driver-sign-in.tsx
src/app/(driver)/_layout.tsx
src/app/(driver)/index.tsx
src/app/(driver)/account.tsx

src/features/auth/components/DriverSignInForm.tsx
src/features/auth/hooks/useDriverSignIn.ts

src/features/driver-availability/components/OfflineSheet.tsx
src/features/driver-availability/components/OnlineSheet.tsx
src/features/driver-availability/components/PowerButton.tsx
src/features/driver-availability/components/PreflightChecklist.tsx
src/features/driver-availability/errors.ts
src/features/driver-availability/hooks/useAvailability.ts
src/features/driver-availability/hooks/useLocationPublisher.ts
src/features/driver-availability/services/backgroundLocationTask.ts
src/features/driver-availability/services/backgroundLocationTask.test.ts
src/features/driver-availability/services/location.service.ts
src/features/driver-availability/services/location.service.test.ts
src/features/driver-availability/services/presence.service.ts
src/features/driver-availability/types.ts

src/features/maps/components/CompassModeToggle.tsx
src/features/maps/components/NavigationBanner.tsx
src/features/maps/components/PipNavigationView.tsx
src/features/maps/components/RecenterButton.tsx
src/features/maps/hooks/useDriverHeading.ts
src/features/maps/hooks/useDriverHeading.test.ts
src/features/maps/hooks/useDriverRouteQuery.ts
src/features/maps/hooks/useDriverRouteQuery.test.ts
src/features/maps/hooks/useManeuverProgress.ts
src/features/maps/hooks/useManeuverProgress.test.ts
src/features/maps/hooks/useVoiceGuidance.ts
src/features/maps/hooks/useVoiceGuidance.test.ts
src/features/maps/navigation/useNavigationLifecycle.ts
src/features/maps/navigation/useNavigationLifecycle.test.ts
src/features/maps/navigation/usePictureInPicture.ts
src/features/maps/navigation/usePictureInPicture.test.ts

src/features/matching/components/IncomingRequestCard.tsx
src/features/matching/errors.ts
src/features/matching/hooks/useAcceptTrip.ts
src/features/matching/hooks/useIncomingRequests.ts
src/features/matching/services/matching.service.ts
src/features/matching/services/matching.service.test.ts
src/features/matching/types.ts

src/features/trip/components/DriverTripSheets.tsx
src/features/trip/hooks/useTripProgressPublisher.ts
src/features/trip/hooks/useTripProgressPublisher.test.ts

src/lib/throttle.ts
src/lib/throttle.test.ts

src/stores/availabilityStore.ts
src/stores/uiStore.ts
```

### Documentation

```
docs/driver_navigation_architecture_v2.md
docs/figma/driver/account_page.png
docs/figma/driver/clicked_already_a_driver.png
docs/figma/driver/clicked_apply_to_drive.png
docs/figma/driver/clicked_apply_to_drive(1).png
docs/figma/driver/clicked_apply_to_drive(2).png
docs/figma/driver/clicked_lets_get_started.png
docs/figma/driver/clicked_online_buttton.png
docs/figma/driver/drive_page(offline).png
docs/figma/driver/drive_page(online).png
docs/figma/driver/driver_agreement.png
docs/figma/driver/earnings_page.png
docs/figma/driver/earnings_page(1).png
docs/figma/driver/gcash_clicked.png
docs/figma/driver/homepage.png
docs/figma/driver/status_page_after_applying_page.png
docs/figma/driver/submit_for_review_clicked.png
docs/figma/driver/vehicle_info.png
docs/figma/driver/vehicle_info(1).png
docs/figma/driver/vehicle_info(2).png
docs/figma/driver/vehicle_selected.png
docs/figma/driver/verify_phone.png
docs/figma/driver/verify_phone_beside_mobile_number_clicked.png
docs/figma/driver/wallet_page.png
```

### Native Modules & Plugins

```
modules/expo-pip/android/build.gradle
modules/expo-pip/android/src/main/AndroidManifest.xml
modules/expo-pip/android/src/main/java/expo/modules/pip/ExpoPipModule.kt
modules/expo-pip/expo-module.config.json
modules/expo-pip/LICENSE
modules/expo-pip/src/ExpoPip.types.ts
modules/expo-pip/src/ExpoPipModule.ts
modules/expo-pip/src/ExpoPipModule.web.ts

plugins/withAndroidPictureInPicture.js
```

---

## 2. PASSENGER_ONLY Files

These files should exist **only** in the passenger-side branch.

### Source: `src/`

```
src/app/(auth)/sign-in.tsx
src/app/(auth)/sign-up.tsx
src/app/(passenger)/_layout.tsx
src/app/(passenger)/index.tsx
src/app/(passenger)/account.tsx
src/app/(passenger)/activity.tsx
src/app/(passenger)/activity/[tripId].tsx

src/features/auth/components/SignInForm.tsx
src/features/auth/components/SignUpForm.tsx
src/features/auth/hooks/useSignIn.ts
src/features/auth/hooks/useSignUp.ts

src/features/booking/components/BookingSheet.tsx
src/features/booking/components/DestinationSearch.tsx
src/features/booking/components/HomeSheet.tsx
src/features/booking/components/PickupPicker.tsx
src/features/booking/components/SearchingSheet.tsx
src/features/booking/components/SeatStepper.tsx
src/features/booking/components/SetDestinationSheet.tsx
src/features/booking/constants.ts
src/features/booking/errors.ts
src/features/booking/hooks/useCreateBooking.ts
src/features/booking/hooks/usePassengerLocationPublisher.ts
src/features/booking/services/booking.service.ts
src/features/booking/services/booking.service.test.ts
src/features/booking/types.ts
src/features/booking/validation/bookingSchema.ts
src/features/booking/validation/bookingSchema.test.ts

src/features/maps/hooks/useOrmocPlacesAutocomplete.ts
src/features/maps/hooks/useRouteQuery.ts

src/features/trip/components/ArrivedSheet.tsx
src/features/trip/components/DriverMatchedSheet.tsx
src/features/trip/components/EnRouteSheet.tsx
src/features/trip/components/InTripSheet.tsx
src/features/trip/hooks/useDriverLocation.ts

src/features/trip-history/components/TripHistoryCard.tsx
src/features/trip-history/components/TripHistoryList.tsx
src/features/trip-history/hooks/useTripHistory.ts

src/lib/seatModel.ts
src/lib/seatModel.test.ts
src/lib/serviceArea/index.ts
src/lib/serviceArea/index.test.ts
src/lib/serviceArea/ormoc.ts

src/stores/bookingDraftStore.ts
src/stores/bookingDraftStore.test.ts
src/stores/locationStore.ts
src/stores/locationStore.test.ts
```

### Documentation

```
docs/passenger_ride_architecture.md
docs/figma/passenger/account_page.png
docs/figma/passenger/account_page(1).png
docs/figma/passenger/activity_page.png
docs/figma/passenger/homepage.png
docs/figma/passenger/homepage(1).png
docs/figma/passenger/homepage(2).png
docs/figma/passenger/homepage(3).png
docs/figma/passenger/homepage(4).png
docs/figma/passenger/homepage(5).png
docs/figma/passenger/notifications.png
docs/figma/passenger/ride_page(arriving_at_destination).png
docs/figma/passenger/ride_page(rider_accepted_passenger).png
docs/figma/passenger/ride_page(confirmed_searching_for_available_riders).png
docs/figma/passenger/ride_page(searched a place to go)(share route selected).png
docs/figma/passenger/ride_page(searched a place to go)(1).png
docs/figma/passenger/ride_page(searched a place to go-all-checked).png
docs/figma/passenger/ride_page(searched a place to go).png
docs/figma/passenger/ride_page.png
docs/figma/passenger/sign_in.png
docs/figma/passenger/sign_up.png
docs/figma/passenger/sign_up(1).png
docs/figma/passenger/sign_up(1)-verify_phone_clicked.png
docs/figma/passenger/sign_up(2).png
docs/figma/passenger/sign_up(3).png
docs/figma/passenger/wallet_page.png
```

---

## 3. SHARED Files (with recommendations)

### 3a. Core Infrastructure — **KEEP_SHARED**

Same Firebase project, same environment, same build tooling. Both branches share these identically.

```
src/services/env.ts                              — Zod-validated env vars (Firebase keys, Maps key, APP_ENV)
src/services/env.test.ts
src/services/firebase/firebase.ts                 — Firebase client initialization with AsyncStorage persistence
src/services/firebase/collections.ts              — Typed Firestore collection references (users, drivers, trips)
src/services/query/queryClient.ts                 — React Query client setup with AsyncStorage persistence

src/constants/theme.ts                            — Design tokens (colors, spacing, typography); 48+ consumers across all roles

vitest.config.ts                                  — Shared test runner config
vitest.setup.ts                                   — Shared test setup
tsconfig.json                                     — Shared TypeScript config with path aliases
eslint.config.js                                  — Shared ESLint config
eas.json                                          — EAS Build config (dev/preview/production profiles)
firebase.json                                     — intentionally absent; backend deployment is Admin-owned
.firebaserc                                       — intentionally absent; backend deployment is Admin-owned
firestore.rules                                   — intentionally absent; see ../pakyaw-admin/firestore.rules
firestore.rules.bak                               — removed obsolete client-side rules backup
firestore.indexes.json                            — intentionally absent; see ../pakyaw-admin/firestore.indexes.json
google-services.json                              — Firebase Android config (same project)
package.json                                      — Dependencies (shared, both branches need same packages)
package-lock.json
expo-env.d.ts                                     — Expo type declarations
.env                                              — Environment variables (same for both)
.env.example
AGENTS.md                                         — AI agent guidance
CLAUDE.md                                         — Claude guidance
README.md
implementation_plan.md
run-android.ps1                                   — Build helper script
```

### 3b. Shared Domain Types & Utilities — **EXTRACT** (shared package)

These are shared domain logic used by both roles with clear API boundaries. They should move to a `@pakyaw/shared` package.

```
src/lib/geo.ts                                    — haversineMeters, geohashOf, geohashNeighbors; used by driver (location/matching) + passenger (booking)
src/lib/geo.test.ts
src/lib/geoProjection.ts                          — getBearingAlongPolyline, snapPointToPolyline, getDistanceToStepEnd; used by both
src/lib/geoProjection.test.ts
src/lib/logger.ts                                 — Logging utility; 28 import sites across all features
src/lib/maps/decodePolyline.ts                    — Google Maps polyline decoder; used by both routing + LiveMap
src/lib/maps/decodePolyline.test.ts

src/features/auth/types.ts                        — UserRole, UserDoc, DriverDoc, RiderType; consumed by session store + both sign-in flows
src/features/auth/errors.ts                       — AuthError, NetworkError, etc.; used by both auth flows

src/features/trip/types.ts                        — TripDoc, TripStatus, CancelledBy, ALLOWED_TRANSITIONS; imported by both role screens + activeTripStore
packages/shared/src/transport/contract.ts         — canonical cross-role ride modes, trip/offer status, request, route, and collection-name contract
src/features/trip/errors.ts                       — Trip errors; used by shared trip.service

src/features/maps/navigation/types.ts             — NavRoute, NavStep, Maneuver, NavPhase, CameraMode; used by shared hooks
src/features/maps/navigation/constants.ts         — NAVIGATION_ZOOM, pitch, reroute thresholds
src/features/maps/navigation/navigationHelper.ts  — isNavActiveStatus() predicate
src/features/maps/navigation/maneuverIcon.ts      — Maneuver → SF Symbol name mapping
```

### 3c. Shared Services — **EXTRACT** (shared package)

Core services both roles depend on. Some contain role-specific functions alongside shared ones; these should stay together in a shared package with clear API documentation about which functions are role-gated.

```
src/features/auth/services/auth.service.ts        — Shared: getUserDoc, signOutUser, createUserDoc, translateFirebaseError
src/features/auth/services/auth.service.test.ts     Driver: signInDriver | Passenger: createPassenger, signInPassenger
                                                   Recommendation: EXTRACT. Both roles need the shared functions but call different sign-in
                                                   entry points. Keep as one service file; each branch calls only its relevant functions.

src/features/trip/services/trip.service.ts         — subscribe() [both], transition() [driver primarily], cancel() [both],
src/features/trip/services/trip.service.test.ts      publishTripProgress() [driver]. Trip state machine is the core of both apps.

src/features/trip-history/services/history.service.ts      — listForPassenger() [passenger], getTrip() [shared]
src/features/trip-history/services/history.service.test.ts

src/features/maps/services/routingService.ts       — getRoute() [passenger], getNavigationRoute() [driver]; shared Google Directions wrapper
src/features/maps/services/placesService.ts        — getPredictions, getPlaceDetails, reverseGeocode; shared Google Places wrapper
```

### 3d. Shared Stores — **EXTRACT** (shared package)

```
src/stores/sessionStore.ts                         — Auth session gate (status, uid, role); root layout's role guard depends on it
src/stores/sessionStore.test.ts                     Recommendation: EXTRACT. Both branches need identical session gating.

src/stores/activeTripStore.ts                      — Active trip state (tripId, trip, driverLocation, nav fields, camera state);
src/stores/activeTripStore.test.ts                   Navigation slice is driver-only but passenger reads trip/driverLocation.
                                                     Recommendation: EXTRACT. Single store with both roles' slices is cleaner than splitting.
```

### 3e. Shared Hooks — **EXTRACT** (shared package)

```
src/features/auth/hooks/useSession.ts              — useSessionBootstrap (auth listener + role fetch); used by root layout for both roles
src/features/auth/hooks/useSignOut.ts              — Clears session + query cache; role-agnostic

src/features/trip/hooks/useActiveTrip.ts           — Subscribes to trip/{id} onSnapshot; both role screens subscribe
src/features/trip/hooks/useTripActions.ts           — useTripTransition + useCancelTrip mutations; both roles
src/features/trip/hooks/useTripActions.test.ts

src/features/maps/hooks/useNavigationPhase.ts      — TripStatus → NavPhase mapping; used by both role screens for camera phase
src/features/maps/hooks/useNavigationPhase.test.ts
src/features/maps/hooks/useInterpolatedCoordinate.ts — Generic lerp for smooth markers; role-agnostic
src/features/maps/hooks/useInterpolatedCoordinate.test.ts
src/features/maps/hooks/useRideCameraController.ts  — Camera command engine; booking/connecting/active/terminal phases, navigation sub-mode
src/features/maps/hooks/useRideCameraController.test.ts

src/features/trip-history/hooks/useTripDetail.ts   — getTrip() wrapper; shared
src/features/trip-history/hooks/hooks.test.ts      — Tests for both useTripHistory (passenger) + useTripDetail (shared)
src/features/trip-history/types.ts                 — TripHistoryItem DTO; used by shared service + passenger components
src/features/trip-history/errors.ts
```

### 3f. Shared UI Components — **EXTRACT** (shared package)

All 14 UI components are designed for both roles (most have `tone` props for role-adaptive theming: blue=passenger, green=driver).

```
src/components/ui/SymbolIcon.tsx                   — Cross-platform icon mapping; 8+ import sites across both roles
src/components/ui/LocationLoader.tsx               — Loading indicator with role-adaptive theme prop
src/components/ui/Sheet.tsx                        — Bottom sheet; used by both booking + driver availability
src/components/ui/Button.tsx                       — Most-used component; 11+ import sites across all flows
src/components/ui/Avatar.tsx                       — Both account screens
src/components/ui/StatusPill.tsx                   — Status badge; 11+ import sites across both roles
src/components/ui/Card.tsx                         — Container; both account + trip-history screens
src/components/ui/Field.tsx                        — Form field wrapper; both auth forms
src/components/ui/EmptyState.tsx                   — TripHistoryList placeholder; both roles
src/components/ui/RouteConnector.tsx               — Origin→destination visual; passenger context but in shared TripHistoryCard
src/components/ui/Screen.tsx                       — Layout wrapper; currently passenger-only usage but API is role-agnostic
src/components/ui/Stepper.tsx                      — DEV-ONLY (zero production usage); designed with multi-role tone prop
src/components/ui/StepProgress.tsx                 — DEV-ONLY; designed with multi-role tone prop
src/components/ui/IconChip.tsx                     — DEV-ONLY; designed with multi-role tone prop
```

### 3g. Shared Trip Components — **EXTRACT** (shared package)

```
src/features/trip/components/LiveMap.tsx           — Presentational <MapView> with role-adaptive props (showNavigationArrow,
                                                     driverRoutePolyline, routePolyline, draggable markers). Both screens render it.
src/features/trip/components/CancelledSheet.tsx    — "Trip cancelled by {cancelledBy}" — generic for both roles
src/features/trip/components/CompletedSheet.tsx    — "You've arrived" + "Done" — generic for both roles
```

### 3h. Shared Auth Components & Validation — **EXTRACT** (shared package)

```
src/features/auth/validation/schemas.ts            — signInSchema + driverSignInSchema (currently identical); both auth flows
src/features/auth/validation/schemas.test.ts
```

### 3i. Shared Route Screens — **DUPLICATE**

Small enough to copy; likely to diverge between branches (e.g., branding, links).

```
src/app/_layout.tsx                                — Root layout with Stack.Protected guards;
                                                     Driver branch: guards (auth) + (driver)
                                                     Passenger branch: guards (auth) + (passenger)
                                                     Recommendation: DUPLICATE. Small file (~50 lines), role-specific route guards.
src/app/(auth)/_layout.tsx                         — Stack navigator, headerless; identical for both
src/app/(auth)/index.tsx                           — Welcome screen; links to sign-up/sign-in BUT the link targets differ per branch
src/app/(auth)/onboarding.tsx                      — Onboarding carousel; shared
src/app/(dev)/components.tsx                       — Dev component showcase; both teams may want it
```

### 3j. Documentation — **DUPLICATE**

Each branch should have its own copy; role-specific notes may accumulate.

```
docs/architecture.md
docs/design_system.md
docs/requirements.md
docs/api_contracts.md
docs/database_schema.md
docs/navigation.md
docs/state_management.md
docs/ui_behavior.md
docs/screen_map.md
docs/component_inventory.md
docs/user_flows.md
docs/phase12_spec.md
docs/phase12_navigation_spec.md
docs/Corporate-Fare-Strategy-*.pdf
```

### 3k. Shared Figma Designs — **DUPLICATE**

```
docs/figma/fleet_owner/dashboard_page.png
docs/figma/fleet_owner/drivers_page.png
docs/figma/fleet_owner/fleet_page.png
docs/figma/fleet_owner/homepage.png
docs/figma/fleet_owner/register_new_fleet_page.png
docs/figma/fleet_owner/register_new_fleet_page(1).png
docs/figma/fleet_owner/register_new_fleet_page(2).png
docs/figma/fleet_owner/register_new_fleet_page(3).png
docs/figma/fleet_owner/register_new_fleet_page(4).png
docs/figma/fleet_owner/register_new_fleet_page(5).png
docs/figma/fleet_owner/register_new_fleet_page(6).png
docs/figma/fleet_owner/clicked_register_a_new_fleet.png
docs/figma/fleet_owner/clicked_register_a_new_fleet(1).png
docs/figma/fleet_owner/clicked_register_a_new_fleet(2).png
docs/figma/fleet_owner/reports_page.png
docs/figma/fleet_owner/sign_in_page.png
```

### 3l. Assets — **KEEP_SHARED** (same app branding)

Both apps share the same brand identity. Each branch gets identical copies.

```
assets/expo.icon/Assets/expo-symbol 2.svg
assets/expo.icon/Assets/grid.png
assets/expo.icon/icon.json
assets/images/android-icon-background.png
assets/images/android-icon-foreground.png
assets/images/android-icon-monochrome.png
assets/images/expo-badge-white.png
assets/images/expo-badge.png
assets/images/expo-logo.png
assets/images/favicon.png
assets/images/icon.png
assets/images/logo-glow.png
assets/images/navigation_arrow.svg
assets/images/pakyaw_logo.png
assets/images/react-logo.png
assets/images/react-logo@2x.png
assets/images/react-logo@3x.png
assets/images/splash-icon.png
assets/images/tabIcons/explore.png
assets/images/tabIcons/explore@2x.png
assets/images/tabIcons/explore@3x.png
assets/images/tabIcons/home.png
assets/images/tabIcons/home@2x.png
assets/images/tabIcons/home@3x.png
assets/images/tutorial-web.png
```

### 3m. Android Native Project — **KEEP_SHARED** (mostly identical; see AMBIGUOUS for AndroidManifest)

Both branches need a complete Android project for their APK. The vast majority is identical build config.

```
android/build.gradle
android/settings.gradle
android/gradle.properties
android/gradle/wrapper/gradle-wrapper.jar
android/gradle/wrapper/gradle-wrapper.properties
android/gradlew
android/gradlew.bat
android/app/build.gradle
android/app/proguard-rules.pro
android/app/debug.keystore
android/app/google-services.json
android/app/src/debug/AndroidManifest.xml
android/app/src/debugOptimized/AndroidManifest.xml
android/app/src/main/java/com/example/pakyaw/MainActivity.kt
android/app/src/main/java/com/example/pakyaw/MainApplication.kt
android/app/src/main/res/drawable/rn_edit_text_material.xml
android/app/src/main/res/drawable/ic_launcher_background.xml
android/app/src/main/res/drawable-hdpi/splashscreen_logo.png
android/app/src/main/res/drawable-mdpi/splashscreen_logo.png
android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png
android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png
android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png
android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
android/app/src/main/res/mipmap-hdpi/ic_launcher.webp
android/app/src/main/res/mipmap-hdpi/ic_launcher_background.webp
android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.webp
android/app/src/main/res/mipmap-hdpi/ic_launcher_monochrome.webp
android/app/src/main/res/mipmap-hdpi/ic_launcher_round.webp
android/app/src/main/res/mipmap-mdpi/ic_launcher.webp
android/app/src/main/res/mipmap-mdpi/ic_launcher_background.webp
android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp
android/app/src/main/res/mipmap-mdpi/ic_launcher_monochrome.webp
android/app/src/main/res/mipmap-mdpi/ic_launcher_round.webp
android/app/src/main/res/mipmap-xhdpi/ic_launcher.webp
android/app/src/main/res/mipmap-xhdpi/ic_launcher_background.webp
android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.webp
android/app/src/main/res/mipmap-xhdpi/ic_launcher_monochrome.webp
android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.webp
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp
android/app/src/main/res/mipmap-xxhdpi/ic_launcher_background.webp
android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.webp
android/app/src/main/res/mipmap-xxhdpi/ic_launcher_monochrome.webp
android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.webp
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.webp
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_monochrome.webp
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.webp
android/app/src/main/res/values/colors.xml
android/app/src/main/res/values/strings.xml        — app_name: "Pakyaw"; each branch may want different names
android/app/src/main/res/values/styles.xml
android/app/src/main/res/values-night/colors.xml
```

### 3n. Scripts — **DUPLICATE**

```
scripts/reset-project.js                          — Expo default reset script
scripts/check-no-money.js                         — Custom validation script
```

### 3o. Placeholder / No-Op Code — **DUPLICATE**

```
src/lib/fare/index.ts                              — computeFare() returns null; deferred feature
src/lib/fare/index.test.ts
src/lib/fare/types.ts                              — FareInput/FareOutput types; zero usage
src/lib/fare/README.md
```

---

## 4. AMBIGUOUS Files

These files could not be confidently classified. Each entry includes the reasoning.

### `app.json` — Expo Configuration

**Issue:** Contains both:
- `plugins: ["expo-router", "expo-location", "withAndroidPictureInPicture", "react-native-maps"]` — the PiP plugin is **driver-only**
- `android.config.googleMaps.apiKey` — shared
- `scheme: "pakyaw"` — both branches may want the same deep-link scheme
- `expo-pip` config in `plugins` — driver-only

**Recommendation:** DUPLICATE. Each branch gets its own `app.json`. Driver branch includes `withAndroidPictureInPicture` plugin; passenger branch removes it. The slug should probably differ too (e.g., `pakyaw-driver` vs `pakyaw-passenger`).

### `android/app/src/main/AndroidManifest.xml`

**Issue:** The `withAndroidPictureInPicture` Expo plugin modifies this file to add:
- `android:supportsPictureInPicture="true"`
- `android:resizeableActivity="true"`
- Additional `configChanges` entries

The driver branch needs these modifications; the passenger branch does not.

**Recommendation:** DUPLICATE. Generate separately per branch.

### `screen.png`

**Issue:** A single screenshot of the app. Unknown which role's screen is shown.

**Recommendation:** DUPLICATE. Replace with role-appropriate screenshot in each branch.

### `window_dump.xml`

**Issue:** Android layout inspector debug artifact. Unknown which screen was dumped.

**Recommendation:** DUPLICATE (or delete — it's a debug artifact, not production code). Not a meaningful file for branch split decisions.

### `tsc_errors.txt`

**Issue:** TypeScript error log. Could contain errors from either/both roles.

**Recommendation:** DUPLICATE (or delete — it's a transient artifact). Not a meaningful file for branch split decisions.

### `src/app/(dev)/components.tsx`

**Issue:** Dev-only component showcase. Useful for both teams during development but could be excluded from production builds.

**Recommendation:** DUPLICATE. Both teams may want a dev showcase. Could also be deleted from production branches.

### `src/lib/seatModel.ts` and `src/lib/throttle.ts`

**Issue:** Both are pure utility functions with zero React dependencies. One is passenger-only (seat clamping), one is driver-only (location throttle). They currently live in the shared `lib/` directory.

**Current classification:** PASSENGER_ONLY (seatModel) and DRIVER_ONLY (throttle).
**Risk:** Both are small (~15-20 lines) pure functions. They could be DUPLICATE'd into both branches trivially or moved to their respective feature folders. The current classification is conservative — they don't *harm* the other branch if present, they're just unused dead code in the wrong branch.

### `src/lib/serviceArea/index.ts` and `src/lib/serviceArea/ormoc.ts`

**Issue:** Classified PASSENGER_ONLY because only passenger-side code calls service area validation (booking.service.ts, SetDestinationSheet). However, the driver matching system operates on geohashes derived from the same Ormoc bounds. In a future where driver onboarding validates against the service area, these would become shared.

**Recommendation:** Keep as PASSENGER_ONLY for now; flag as potential SHARED if driver onboarding/geofencing work happens.

---

## Appendix: Summary Statistics

| Classification | Count | % |
|----------------|-------|---|
| DRIVER_ONLY | ~90 | ~25% |
| PASSENGER_ONLY | ~95 | ~26% |
| SHARED | ~170 | ~47% |
| AMBIGUOUS | ~8 | ~2% |
| **Total** | **~363** | **100%** |

### SHARED Recommendations Breakdown

| Recommendation | Count | Examples |
|----------------|-------|----------|
| EXTRACT | ~45 | geo.ts, trip.service.ts, activeTripStore, LiveMap, UI components, shared hooks |
| KEEP_SHARED | ~90 | Firebase config, env vars, assets, Android build files, theme, test config |
| DUPLICATE | ~35 | Route layouts, docs, scripts, figma designs, placeholder code |

### Key Architectural Notes for Implementation

1. **The trip domain is the coupling nexus.** `trip/types.ts` imports `Place` from `booking/types.ts`. If these are split into separate packages, the shared package must include `Place` (or extract it to a `@pakyaw/shared` types module).

2. **`activeTripStore` is a single store with driver+passenger slices.** Splitting it into two stores would create synchronization complexity (e.g., passenger's `driverLocation` mirror must stay in sync with the trip document). Keep it as one shared store.

3. **Firebase is one project.** Both apps use the same Firebase project (`pakyaw-39434`), same Firestore collections (`users`, `drivers`, `trips`), same Auth domain. The security rules already enforce per-role access patterns. No split needed at the backend level.

4. **The PiP module is the only native-code divergence.** `modules/expo-pip/` and `plugins/withAndroidPictureInPicture.js` are driver-only. The passenger branch does not need them.

5. **Auth service is mixed but manageable.** `auth.service.ts` has shared functions (`getUserDoc`, `signOutUser`) alongside role-specific functions (`signInDriver`, `signInPassenger`, `createPassenger`). Both branches should import the same service file and call only their relevant functions.

6. **Test files follow their source file's classification.** A test for a SHARED source file is SHARED. A test for a DRIVER_ONLY source file is DRIVER_ONLY.

---

*End of manifest. No files have been modified — this is classification only.*
