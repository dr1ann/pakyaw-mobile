# Pakyaw Passenger

React Native / Expo Passenger application for Pakyaw.

## Branch status

This repository is maintained as two role-specific mobile branches:

- **`passenger-app`** — active Passenger application. This branch.
- **`driver-app`** — active Driver application.

`main`, `map-fix`, and other historical branches are not current implementation sources.

The repository was intentionally split by role; see [`BRANCH_SPLIT_MANIFEST.md`](./BRANCH_SPLIT_MANIFEST.md). For current Passenger architecture and backend boundaries, read [`docs/branch_architecture.md`](./docs/branch_architecture.md) before the older general architecture docs.

## What this branch owns

The Passenger branch contains Passenger-specific flows such as:

- onboarding, sign-in, and verified Passenger registration;
- profile/account experience;
- map-based pickup and destination selection;
- ride booking and server-authoritative trip requests;
- searching/matching presentation;
- active-trip realtime UI;
- Passenger-authorized cancellation/actions through the backend contract;
- trip history, safety/SOS, and support.

Driver availability, Driver onboarding, Driver offers, Driver navigation, and Driver-only controls belong in `driver-app`.

## Backend model

The maintained app uses Pakyaw's server-authoritative backend integration.

- Booking calls the `requestTrip` Cloud Function rather than directly creating authoritative trip documents.
- The backend owns Driver assignment, sensitive lifecycle state, and authoritative fare behavior.
- The canonical initial trip status is `requested`.
- Do not restore old direct `addDoc(trips)` behavior or the obsolete `request` status from historical branches.

Permitted Firestore subscriptions remain useful for realtime state; backend commands remain authoritative for sensitive mutations.

## Shared code

Cross-role code is kept under `packages/shared/` where applicable. Because Passenger and Driver are separate Git branches, a shared-contract change must be intentionally reconciled on both `passenger-app` and `driver-app`.

## Setup

```bash
npm install
npx expo start
```

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

For Passenger work:

1. Current `passenger-app` code and tests.
2. [`docs/branch_architecture.md`](./docs/branch_architecture.md).
3. Current Passenger-specific docs where compatible.
4. [`BRANCH_SPLIT_MANIFEST.md`](./BRANCH_SPLIT_MANIFEST.md).
5. Older general docs only where they do not conflict with the maintained branch.
