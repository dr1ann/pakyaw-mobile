# Driver app identity

Phase 5 separates the Driver binary from Passenger at the platform and build
identity boundary. The Firebase project remains shared so Auth, custom claims,
Firestore rules, callable Functions, and transport records continue to use the
same backend authority.

| Setting | Driver value |
| --- | --- |
| Display name | `Pakyaw Driver` |
| Expo slug | `pakyaw-driver` |
| Deep-link scheme | `pakyaw-driver` |
| Android application ID | `com.pakyaw.driver` |
| iOS bundle identifier | `com.pakyaw.driver` |
| Firebase project | `pakyaw-39434` |

## External provisioning required

The repository no longer links this app to the old shared EAS project ID.
Create or link a dedicated EAS project from this repository, then configure
its ID as `EAS_PROJECT_ID`. Do not copy the Passenger project ID.

Create a separate Android app registration in Firebase with package
`com.pakyaw.driver` and a separate iOS app registration with bundle ID
`com.pakyaw.driver`. Download their native configuration files privately and
set:

```text
GOOGLE_SERVICES_JSON=<Driver google-services.json path>
GOOGLE_SERVICES_PLIST=<Driver GoogleService-Info.plist path>
```

The old shared-package `google-services.json` was removed from this branch and
is not a valid Driver configuration. Do not add it back; use the role-specific
file supplied through `GOOGLE_SERVICES_JSON` instead.
The Firebase web values in `.env` remain public client configuration and must
still point at `pakyaw-39434`.

After provisioning, run `npm run check:app-identity`, `npx expo config`, and
`npx expo prebuild --clean`. Inspect the generated native diff and verify the
package, bundle, scheme, Firebase app IDs, Google Maps restrictions, and
Driver-only location/Picture-in-Picture permissions before building.
