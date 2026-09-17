# Pakyaw Driver

React Native / Expo Driver application for Pakyaw.

## Branch status

This repository is maintained as two role-specific mobile branches:

- **`driver-app`** — active Driver application. This branch.
- **`passenger-app`** — active Passenger application.

`main`, `map-fix`, and other historical branches are not current implementation sources.

The repository was intentionally split by role; see [`BRANCH_SPLIT_MANIFEST.md`](./BRANCH_SPLIT_MANIFEST.md). For current Driver architecture and backend boundaries, read [`docs/branch_architecture.md`](./docs/branch_architecture.md) before the older general architecture docs. Native identity and Firebase/EAS provisioning are documented in [`docs/app-identity.md`](./docs/app-identity.md).

## What this branch owns

The Driver branch contains Driver-specific flows such as:

- registration, sign-in, and Driver onboarding;
- application/document submission;
- online/offline availability and location publishing;
- addressed trip-offer subscription and acceptance;
- Driver trip lifecycle controls;
- navigation, guidance, maps, and Picture-in-Picture support;
- safety/SOS, support, and Driver account flows.

Passenger booking and Passenger-only screens belong in `passenger-app`.

## Backend model

The maintained app uses Pakyaw's server-authoritative backend integration.

- Driver offers are read from `tripOffers` scoped to the authenticated Driver.
- Offer acceptance goes through the `acceptTripOffer` Cloud Function.
- Sensitive trip lifecycle changes are backend-authoritative.
- The canonical initial trip status is `requested`.
- Do not restore old direct-open-trip claiming or obsolete `request` status behavior from historical branches.

Permitted Firestore subscriptions remain useful for realtime state; backend commands remain authoritative for sensitive transitions and assignment.

## Shared code

Cross-role code is kept under `packages/shared/` where applicable. Because Driver and Passenger are separate Git branches, a shared-contract change must be intentionally reconciled on both `driver-app` and `passenger-app`.

## Setup

```bash
npm install
npx expo start
```

## Firebase boundary

This repository is a Firebase client only. Firebase backend deployment must
be run from [`pakyaw-admin`](../pakyaw-admin/docs/firebase-deployment.md),
which is the sole source of truth for Firestore rules and indexes, Storage
rules, and Cloud Functions. This repository intentionally does not contain a
Firebase CLI project configuration or deployable backend rules.

For local backend emulation, start the Firebase Emulator Suite from
`pakyaw-admin` and point the app at it with the documented emulator
environment variables. See [`docs/firebase-backend.md`](docs/firebase-backend.md).

For the local Android helper when applicable:

```powershell
./run-android.ps1
```

## Validation

Before completing changes:

```bash
npm run typecheck
npm run lint
npm test
```

Use a focused test subset while iterating when appropriate.

## Documentation priority

For Driver work:

1. Current `driver-app` code and tests.
2. [`docs/branch_architecture.md`](./docs/branch_architecture.md).
3. Current Driver-specific docs such as `docs/driver_navigation_architecture_v2.md` where compatible.
4. [`BRANCH_SPLIT_MANIFEST.md`](./BRANCH_SPLIT_MANIFEST.md).
5. Older general docs only where they do not conflict with the maintained branch.
