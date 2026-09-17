# Passenger app identity

Phase 5 separates the Passenger binary from Driver at the platform and build
identity boundary. The Firebase project remains shared so Auth, custom claims,
Firestore rules, callable Functions, and transport records continue to use the
same backend authority.

| Setting | Passenger value |
| --- | --- |
| Display name | `Pakyaw Passenger` |
| Expo slug | `pakyaw-passenger` |
| Deep-link scheme | `pakyaw-passenger` |
| Android application ID | `com.pakyaw.passenger` |
| iOS bundle identifier | `com.pakyaw.passenger` |
| Firebase project | `pakyaw-39434` |

## External provisioning required

The repository no longer links this app to the old shared EAS project ID.
Create or link a dedicated EAS project from this repository, then configure
its ID as `EAS_PROJECT_ID`. Do not copy the Driver project ID.

Create a separate Android app registration in Firebase with package
`com.pakyaw.passenger` and a separate iOS app registration with bundle ID
`com.pakyaw.passenger`. Download their native configuration files privately and
set:

```text
GOOGLE_SERVICES_JSON=<Passenger google-services.json path>
GOOGLE_SERVICES_PLIST=<Passenger GoogleService-Info.plist path>
```

The old shared-package `google-services.json` was removed from this branch and
is not a valid Passenger configuration. Do not add it back; use the
role-specific file supplied through `GOOGLE_SERVICES_JSON` instead.
The Firebase web values in `.env` remain public client configuration and must
still point at `pakyaw-39434`.

After provisioning, run `npm run check:app-identity`, `npx expo config`, and
`npx expo prebuild --clean`. Inspect the generated native diff and verify the
package, bundle, scheme, Firebase app IDs, and Passenger-only foreground
location permissions before building.
