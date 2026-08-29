# Pakyaw Mobile — Driver Branch Architecture

Status: **authoritative for the maintained `driver-app` branch**.

This document exists because the repository was intentionally split by role. If an older document describes one combined passenger + driver Expo binary, this branch-specific document takes precedence.

## 1. Active branch model

The maintained mobile implementation is split into two role-specific branches:

- `driver-app` — maintained Driver application.
- `passenger-app` — maintained Passenger application.

`main`, `map-fix`, and other historical branches are not implementation sources for current mobile work. Do not copy architecture, Firebase behavior, status strings, or service patterns from them without verifying the same behavior on the maintained branch.

The historical split is documented in `BRANCH_SPLIT_MANIFEST.md`, which classifies Driver-only, Passenger-only, and shared files.

## 2. Driver branch responsibility

`driver-app` owns the Driver-side product experience and Driver-specific runtime behavior, including:

- Driver authentication and registration.
- Driver application/onboarding and document submission.
- Driver approval-aware access to work.
- Online/offline availability.
- Foreground/background location publishing.
- Incoming server-created trip offers.
- Offer acceptance.
- Driver trip lifecycle actions.
- Driver navigation, map camera behavior, guidance, and Picture-in-Picture integrations.
- Driver safety/SOS and support flows.
- Driver account UI.

Passenger booking UI and Passenger-only route flows belong in `passenger-app`, not this branch.

## 3. Code boundaries

Driver-specific application code lives primarily under:

```text
src/app/(driver)/
src/features/driver-availability/
src/features/matching/
src/features/onboarding/
src/features/trip/
src/features/maps/
src/features/safety/
src/features/support/
```

Cross-role domain/UI code is kept under `packages/shared/` where applicable.

Because `driver-app` and `passenger-app` are Git branches rather than two runtime packages checked out together, `packages/shared/` is a branch-local copy of shared code. A change to a shared contract that affects both products must be intentionally reconciled on both maintained branches. Never assume editing one branch automatically updates the other.

## 4. Backend integration

The maintained Driver branch already uses the server-authoritative Pakyaw backend model.

### Driver matching

The Driver does **not** query all open trips and race to claim one directly.

Current flow:

```text
Backend matching
  -> creates tripOffers addressed to eligible drivers
Driver app
  -> subscribes to pending tripOffers where driverId == authenticated driver
  -> displays valid non-expired offers
Driver accepts
  -> calls acceptTripOffer Cloud Function
Backend
  -> validates and atomically accepts/rejects the claim
```

Do not reintroduce broad client-side open-trip matching or direct Firestore trip claiming.

### Trip commands

Sensitive trip lifecycle changes are server-authoritative. Driver UI/hooks may request allowed actions, but the backend owns transition validation and authoritative trip state.

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

Do not use the obsolete `request` status from old branches. The maintained shared matching contract uses `requested`.

## 5. Driver availability and location

Availability/location are Driver-owned operational signals only where allowed by the deployed security contract.

They must never become a bypass for backend eligibility. Matching remains fail-closed and considers authoritative application/account/document state plus operational state such as online status, active trip, location freshness, service area, and GPS quality.

The Driver client must not grant itself approval, alter review outcomes, create staff authority, or force assignment/lifecycle state.

## 6. Shared backend contract

The Driver branch must remain compatible with the same Firebase/backend contract consumed by `passenger-app` and the Pakyaw admin/backend repository.

Cross-repository or cross-branch contract changes include:

- trip lifecycle/status vocabulary;
- callable names or request/response shapes;
- `tripOffers` semantics;
- driver eligibility fields;
- onboarding/application/document states;
- user/driver identity fields used by authorization;
- security-rule expectations;
- server-owned fare/assignment fields.

These changes require checking both maintained mobile branches and backend tests before completion.

## 7. Source-of-truth order for agents

For work on `driver-app`, use this order:

1. Actual code and tests on `driver-app`.
2. `docs/branch_architecture.md`.
3. Driver-specific current docs such as `docs/driver_navigation_architecture_v2.md` where compatible with current code.
4. `BRANCH_SPLIT_MANIFEST.md` for branch ownership history.
5. Other legacy docs only when they do not conflict with the maintained branch.

If a legacy document says this is one combined Expo binary, that statement is obsolete.

## 8. Engineering rules

- Keep Expo Router route files thin.
- Keep business logic in feature services/hooks/domain modules.
- Use strict TypeScript and Zod at external boundaries.
- Preserve server-authoritative matching, assignment, fare, approval, and lifecycle behavior.
- Use Firestore realtime subscriptions for permitted live state rather than duplicating truth in local state.
- Do not introduce Passenger routes/features into `driver-app`.
- Do not copy implementation from `main` or `map-fix` as a shortcut.
- Coordinate shared-contract changes with `passenger-app`.

## 9. Validation

Before declaring Driver-branch work complete, run the validations supported by the repository, at minimum:

```bash
npm run typecheck
npm run lint
npm test
```

Use the smallest relevant test subset during iteration, then run the broader required validation before completion.
