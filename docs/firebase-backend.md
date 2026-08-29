# Firebase client boundary

This is the Pakyaw Passenger Firebase client. It is not a Firebase backend
deployment repository.

Backend deployment must be run only from
[`pakyaw-admin`](../../pakyaw-admin/docs/firebase-deployment.md). That
repository owns the canonical Firestore rules and indexes, Storage rules, and
Cloud Functions. This repository intentionally has no `firebase.json`,
`.firebaserc`, `firestore.rules`, or `firestore.indexes.json` deployment
configuration; the obsolete mobile copies were removed in Phase 0.

For local development, start the Emulator Suite from `pakyaw-admin`, then set
`EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` and a reachable
`EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST` before starting the app. The
mobile app remains a client and does not own the emulator rules.

Run `npm run check:firebase-boundary` to verify that no backend deployment
files or deploy scripts have been added to this repository.

The Phase 1 transport contract is documented in
[`pakyaw-admin/docs/transport-contract.md`](../../pakyaw-admin/docs/transport-contract.md).
Passenger requests use canonical `solo`, `shared`, or `hop` modes and send
only informational `displayedFare`; the backend owns billed seats, fare,
assignment, and lifecycle state.

## Legacy SharedRide naming

`sharedRides` is canonical. The untouched legacy shared-ride reader/writer
paths use an explicitly named `LEGACY_SHARED_RIDES_COLLECTION` constant for
`shared_rides`; no speculative production-data migration is performed in
Phase 1. See the Admin transport contract for the complete usage inventory.
