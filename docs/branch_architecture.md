# Pakyaw Mobile — Passenger Branch Architecture

Status: **authoritative for the maintained `passenger-app` branch**.

This document exists because the repository was intentionally split by role. If an older document describes one combined passenger + driver Expo binary, this branch-specific document takes precedence.

## 1. Active branch model

The maintained mobile implementation is split into two role-specific branches:

- `passenger-app` — maintained Passenger application.
- `driver-app` — maintained Driver application.

`main`, `map-fix`, and other historical branches are not implementation sources for current mobile work. Do not copy architecture, Firebase behavior, status strings, or service patterns from them without verifying the same behavior on the maintained branch.

The historical split is documented in `BRANCH_SPLIT_MANIFEST.md`, which classifies Driver-only, Passenger-only, and shared files.

## 2. Passenger branch responsibility

`passenger-app` owns the Passenger-side product experience and Passenger-specific runtime behavior, including:

- Passenger onboarding, authentication, and verified registration.
- Passenger profile creation.
- Map-based pickup/destination selection.
- Ride booking and trip request UX.
- Searching/matching presentation while the backend finds a Driver.
- Active-trip realtime presentation.
- Passenger-authorized cancellation/actions through the backend contract.
- Passenger trip history/account surfaces.
- Passenger safety/SOS and support flows.

Driver availability, Driver onboarding, incoming Driver offer UX, Driver navigation, and Driver-only trip controls belong in `driver-app`, not this branch.

The route tree confirms the branch boundary: Passenger routes live under `src/app/(passenger)/` alongside authentication routes; this maintained branch does not use a combined Driver route space as its product architecture.

## 3. Code boundaries

Passenger-specific application code lives primarily under the Passenger route/features, including:

```text
src/app/(passenger)/
src/features/booking/
src/features/trip/
src/features/maps/
src/features/safety/
src/features/support/
```

Cross-role domain/UI code is kept under `packages/shared/` where applicable.

Because `passenger-app` and `driver-app` are Git branches rather than two runtime packages checked out together, `packages/shared/` is a branch-local copy of shared code. A change to a shared contract that affects both products must be intentionally reconciled on both maintained branches. Never assume editing one branch automatically updates the other.

## 4. Backend integration

The maintained Passenger branch already uses the server-authoritative Pakyaw backend model.

### Booking

The Passenger client validates user-entered route data but does **not** create authoritative trip documents directly.

Current flow:

```text
Passenger chooses pickup/destination
  -> client validates route/input
  -> calls requestTrip Cloud Function
Backend
  -> validates identity/request
  -> owns authoritative fare/assignment/lifecycle fields
  -> creates trip with status requested
  -> starts matching and returns tripId
Passenger app
  -> subscribes to permitted realtime trip state
```

Do not replace this with direct `addDoc(trips)` writes from the Passenger client.

### Trip commands

Sensitive trip lifecycle changes are server-authoritative. Passenger UI/hooks may request allowed actions, but the backend owns transition/cancellation validation and authoritative state.

Canonical lifecycle vocabulary:

```text
requested
  -> accepted
  -> driver_arriving
  -> driver_arrived
  -> in_progress
  -> completed
```

`cancelled` is terminal and must follow the canonical cancellation contract.

Do not use the obsolete `request` status from old branches. The maintained backend integration expects `requested`.

### Firebase deployment authority

`pakyaw-admin` is the sole Firebase backend deployment root. It owns the
canonical Firestore rules and indexes, Storage rules, and Cloud Functions.
This Passenger repository is a Firebase client only and intentionally has no
Firebase CLI project configuration or deployable backend rules. Start local
Firebase emulators from `pakyaw-admin`; do not recreate or restore mobile
`firebase.json`, `.firebaserc`, `firestore.rules`, or `firestore.indexes.json`
files.

## 5. Fare and assignment authority

Displayed client values are presentation/input context only unless the backend contract explicitly marks them authoritative.

The Passenger app must not:

- decide the assigned Driver;
- write lifecycle status directly as authoritative state;
- bypass matching eligibility;
- trust a client-computed fare as the backend fare;
- grant itself account/staff capabilities.

Server responses and permitted Firestore subscriptions remain the source of truth for sensitive trip state.

## 6. Shared backend contract

The Passenger branch must remain compatible with the same Firebase/backend contract consumed by `driver-app` and the Pakyaw admin/backend repository.

Cross-repository or cross-branch contract changes include:

- trip lifecycle/status vocabulary;
- callable names or request/response shapes;
- booking/trip document shapes;
- `tripOffers` semantics visible through resulting trip state;
- user identity/profile fields used by authorization;
- security-rule expectations;
- server-owned fare/assignment fields.

These changes require checking both maintained mobile branches and backend tests before completion.

Phase 1 canonical transport contracts live in
`packages/shared/src/transport/contract.ts` and the deployable mirror at
`pakyaw-admin/functions/src/lib/transport-contract.ts`. Internal ride modes
are only `solo`, `shared`, and `hop`; `sharedRides` is the canonical SharedRide
collection and `shared_rides` is legacy. The Admin contract document is the
cross-repository reference for ownership and the deferred migration path.

## 7. Source-of-truth order for agents

For work on `passenger-app`, use this order:

1. Actual code and tests on `passenger-app`.
2. `docs/branch_architecture.md`.
3. Passenger-specific current docs where compatible with current code.
4. `BRANCH_SPLIT_MANIFEST.md` for branch ownership history.
5. Other legacy docs only when they do not conflict with the maintained branch.

If a legacy document says this is one combined Expo binary, that statement is obsolete.

## 8. Engineering rules

- Keep Expo Router route files thin.
- Keep business logic in feature services/hooks/domain modules.
- Use strict TypeScript and Zod at external boundaries.
- Preserve server-authoritative booking, matching, fare, assignment, and lifecycle behavior.
- Use Firestore realtime subscriptions for permitted live state rather than duplicating truth in local state.
- Do not introduce Driver routes/features into `passenger-app`.
- Do not copy implementation from `main` or `map-fix` as a shortcut.
- Coordinate shared-contract changes with `driver-app`.

## 9. Validation

Before declaring Passenger-branch work complete, run the validations supported by the repository, at minimum:

```bash
npm run typecheck
npm run lint
npm test
```

Use the smallest relevant test subset during iteration, then run the broader required validation before completion.
