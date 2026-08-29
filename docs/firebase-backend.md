# Firebase client boundary

This is the Pakyaw Driver Firebase client. It is not a Firebase backend
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
Driver offers must contain server-provided canonical mode, passenger count,
billed seats, fare, and offer status; malformed or legacy offers are dropped
instead of being inferred as Solo.

## Phase 4 SharedRide boundary

`sharedRides` is canonical. The old client-authoritative SharedRide
reader/writer service was removed; the Driver only reads its assigned
`sharedRides/{id}` session. No new runtime document is written under
`shared_rides`, and no speculative production-data migration is performed.
Driver availability intent now goes through the backend
`setDriverAvailability` callable; location/progress publishing remains the
only owner-safe operational write from the Driver client.
