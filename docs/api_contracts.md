# Pakyaw — API Contracts (MVP)

Framework-agnostic contracts for the **MVP Pakyaw SOLO ride system**, derived **only** from [architecture.md](./architecture.md). Scope is fixed to: passenger auth, driver auth, driver availability, driver location updates, passenger booking, driver matching/acceptance, the trip lifecycle, and trip history.

**Out of scope (no contracts defined):** Share/Carpool, Fleet Owner console, Perks/Pasabuy/logistics, wallets, payments, fare/commission math, earnings, SaaS tiers, advanced fraud/trust. No contract returns or accepts a peso amount, fare, wallet, fleet, or Share field (architecture §4, hard rule).

---

## 0. How to read these contracts

The MVP has **no traditional REST/HTTP server**. The architecture (§7) wraps the Firebase SDK directly in per-feature `*.service.ts` modules over **Firebase Auth** + **Cloud Firestore** (with `onSnapshot` real-time listeners). These contracts therefore describe **logical operations**, not wire HTTP routes:

- **Route** — a logical identifier for the operation and the document/collection it targets (e.g. `trips/{tripId}`). It is not a literal URL.
- **Method** — a transport-agnostic verb mapped to the underlying Firebase action:
  - `CREATE` → document create write
  - `GET` → one-time document/collection read
  - `UPDATE` → field write / merge
  - `TRANSACTION` → atomic read-modify-write (Firestore transaction)
  - `SUBSCRIBE` → real-time listener (`onSnapshot`); the "Response body" is the shape of each emitted snapshot, and the operation returns an unsubscribe handle (architecture §7.2).
- **Authentication** — every operation except OTP bootstrap requires a valid Firebase Auth session. **Role** (`passenger` | `driver`) is read from `users/{uid}` (architecture §6).

Conventions used below:
- Timestamps are ISO-8601 server timestamps; each lifecycle transition stamps its own (`requestedAt`, `acceptedAt`, …) per architecture §5.
- Coordinates are `{ "lat": number, "lng": number }` — the JSON form of a Firestore `GeoPoint`. Route points (`pickup`/`destination`) wrap this as `{ "geo": {...}, "address": ..., "label"|"barangay": ... }` (schema §4); a driver's `location` is a bare `GeoPoint`.
- Validation at the form boundary is **Zod + React Hook Form** (architecture §10.5); validation rules below reflect the fields the architecture names. Where the architecture marks a detail as an open item (§14), it is flagged **[OPEN]** and the contract states the assumption.
- Standard error envelope (domain errors from architecture §10.1):

```
{
  "error": {
    "code": "AuthError | TripAlreadyTakenError | PermissionError | NetworkError | LocationPermissionError | ValidationError | NotFoundError",
    "message": "human-readable"
  }
}
```

---

## 1. Authentication (`auth` feature)

Identity source: **Firebase Auth**. Session is bootstrapped via `onAuthStateChanged` (architecture §6.1). Role lives in `users/{uid}`.

### 1.1 Passenger sign-up — Step 1: create credentials
- **Route:** `auth/sign-up/credentials`
- **Method:** `CREATE`
- **Request body:**
```
{ "email": "string", "password": "string" }
```
- **Response body:**
```
{ "uid": "string", "email": "string", "emailVerified": false }
```
- **Validation rules:**
  - `email` — required, valid email format.
  - `password` — required; meets Firebase Auth minimum (≥ 6 chars). Exact policy not specified by architecture beyond Firebase default.
- **Error responses:**
  - `ValidationError` — malformed email / weak password.
  - `AuthError` — email already in use, or Firebase create failure (raw `FirebaseError` translated at service edge, §10.1).
  - `NetworkError` — offline; sign-up requires connectivity (§11).
- **Authentication:** none (this establishes the account). Maps to `createUserWithEmailAndPassword` (§6.2).

### 1.2 Passenger sign-up — Step 2a: send phone OTP
- **Route:** `auth/otp/send`
- **Method:** `CREATE`
- **Request body:**
```
{ "firstName": "string", "lastName": "string", "phone": "string" }
```
- **Response body:**
```
{ "verificationId": "string", "resendAvailableInSeconds": 60 }
```
- **Validation rules:**
  - `firstName` / `lastName` — required, non-empty.
  - `phone` — required, valid PH phone number (+63 E.164).
- **Error responses:**
  - `ValidationError` — missing name fields / invalid phone.
  - `AuthError` — OTP dispatch failed / quota exceeded.
  - `NetworkError` — offline.
- **Authentication:** authenticated session from Step 1.
- **[OPEN] (§14.1):** OTP provider (Firebase Phone Auth vs third-party SMS) is unconfirmed; `verificationId` shape is provider-dependent.

### 1.3 Passenger sign-up — Step 2b: verify phone OTP
- **Route:** `auth/otp/verify`
- **Method:** `UPDATE`
- **Request body:**
```
{ "verificationId": "string", "code": "string" }
```
- **Response body:**
```
{ "phoneVerified": true, "phone": "string" }
```
- **Validation rules:**
  - `code` — required, exactly 6 digits (architecture §6.2: "6-digit code").
  - `verificationId` — required, from §1.2.
- **Error responses:**
  - `ValidationError` — code not 6 digits.
  - `AuthError` — wrong/expired code.
  - `NetworkError` — offline.
- **Authentication:** authenticated session.

### 1.4 Passenger sign-up — Step 4: create profile
- **Route:** `users/{uid}`
- **Method:** `CREATE`
- **Request body:**
```
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "riderType": "regular | student | pwd | senior"
}
```
- **Response body:**
```
{
  "uid": "string",
  "role": "passenger",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "phoneVerified": true,
  "email": "string | null",
  "riderType": "regular | student | pwd | senior",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```
- **Validation rules:**
  - `firstName` / `lastName` — required, non-empty.
  - `phone` — required; must be the verified phone from §1.3.
  - `riderType` — required, one of the four enum values (`regular | student | pwd | senior`). **Stored as a field only** — its implied discount is deferred pricing and has no MVP effect (architecture §6.2 step 3, §4).
  - `role` is server-set to `passenger`; not client-supplied.
- **Error responses:**
  - `ValidationError` — missing/invalid field, phone not verified.
  - `PermissionError` — writing a `users` doc for a uid other than the caller's.
  - `NetworkError` — offline.
- **Authentication:** authenticated session; the write must target the caller's own `uid`.

### 1.5 Passenger sign-in
- **Route:** `auth/sign-in`
- **Method:** `CREATE` (session)
- **Request body:**
```
{ "email": "string", "password": "string" }
```
- **Response body:**
```
{ "uid": "string", "role": "passenger" }
```
- **Validation rules:**
  - `email` — required, valid email.
  - `password` — required, non-empty.
- **Error responses:**
  - `ValidationError` — malformed input.
  - `AuthError` — invalid credentials / user not found / disabled.
  - `NetworkError` — offline.
- **Authentication:** none to invoke; on success establishes session. Role resolved by §1.7.

### 1.6 Driver sign-in
- **Route:** `auth/driver-sign-in`
- **Method:** `CREATE` (session)
- **Request body:**
```
{ "phone": "string", "pin": "string" }
```
- **Response body:**
```
{ "uid": "string", "role": "driver" }
```
- **Validation rules:**
  - `phone` — required, valid PH phone number (+63 E.164).
  - `pin` — required. **[OPEN] (§14.2):** PIN length/storage mechanism (and optional biometric) is unconfirmed.
  - Driver must be **pre-provisioned** with `role: 'driver'` and an approved status (architecture §6.3); driver *application/approval* is out of MVP scope.
- **Error responses:**
  - `ValidationError` — missing phone/pin.
  - `AuthError` — unknown driver, wrong PIN, or not approved/provisioned.
  - `NetworkError` — offline.
- **Authentication:** none to invoke; establishes a driver session.

### 1.7 Get current user profile (role resolution)
- **Route:** `users/{uid}`
- **Method:** `GET`
- **Request body:** none (uid taken from session).
- **Response body:**
```
{
  "uid": "string",
  "role": "passenger | driver",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "phoneVerified": boolean,
  "email": "string | null",
  "riderType": "regular | student | pwd | senior",  // passengers only
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```
- **Validation rules:** none (read).
- **Error responses:**
  - `NotFoundError` — no `users/{uid}` doc.
  - `PermissionError` — reading another user's profile.
  - `NetworkError` — offline (served from persisted cache when available, §11).
- **Authentication:** authenticated session; reads the caller's own doc. Drives router guards into `(passenger)`/`(driver)` (§6.1).

### 1.8 Sign out
- **Route:** `auth/sign-out`
- **Method:** `UPDATE` (session teardown)
- **Request body:** none.
- **Response body:** `{ "ok": true }`
- **Validation rules:** none.
- **Error responses:** `NetworkError` — token revocation deferred; local session always clears.
- **Authentication:** authenticated session. On sign-out all listeners are torn down (architecture §8).

---

## 2. Driver availability & location (`driver-availability` feature)

Targets `drivers/{uid}`. Source: architecture §7.4.

### 2.1 Set availability (go online / offline)
- **Route:** `drivers/{uid}/availability`
- **Method:** `UPDATE`
- **Request body:**
```
{ "availability": "online | offline" }
```
- **Response body:**
```
{ "uid": "string", "availability": "online | offline", "lastSeenAt": "ISO-8601" }
```
- **Validation rules:**
  - `availability` — required, `online` or `offline`. `on_trip` is the third valid `Availability` state (database schema §3) but is system-set on trip accept (§4.2); the driver cannot set it directly through this operation.
  - Going **online** is gated behind the **pre-flight checklist** (client-side for MVP, §7.4); a contract caller is expected to have passed it.
- **Error responses:**
  - `ValidationError` — bad enum value.
  - `PermissionError` — writing another driver's presence.
  - `NetworkError` — offline.
- **Authentication:** driver session; write targets caller's own `drivers/{uid}`. Server also stamps `lastSeenAt`.

### 2.2 Publish location update
- **Route:** `drivers/{uid}/location`
- **Method:** `UPDATE`
- **Request body:**
```
{ "location": { "lat": number, "lng": number }, "heading": "number | null", "geohash": "string" }
```
- **Response body:**
```
{ "uid": "string", "location": { "lat": number, "lng": number }, "heading": "number | null", "locationUpdatedAt": "ISO-8601" }
```
- **Validation rules:**
  - `lat` — required, −90…90. `lng` — required, −180…180.
  - `heading` — optional; degrees 0–359 for marker rotation on the map; `null` if the device cannot determine bearing (database schema §3).
  - `geohash` — required; prefix field used for nearby queries (§9, §2.3).
  - Writes are **client-throttled** (~every 4–5 s or ~25 m) and only published while the driver is `online`/`on_trip` and the app is **foregrounded** (§7.4, §8). Background publishing is out of MVP scope.
  - Last-known location is a **single field** on the driver doc — no per-coordinate collection, no copy on the trip doc (§7.4).
- **Error responses:**
  - `ValidationError` — out-of-range coordinates.
  - `LocationPermissionError` — device location denied or restricted to foreground (first-class state, §10.7).
  - `PermissionError` — writing another driver's location.
  - `NetworkError` — offline; queued writes flush on reconnect (§11).
- **Authentication:** driver session; own doc only.

### 2.3 Query nearby drivers ("N drivers within 1 km")
- **Route:** `drivers?geohash={prefix}&availability=online`
- **Method:** `GET`
- **Request body (query params):**
```
{ "geohashPrefix": "string", "availability": "online" }
```
- **Response body:**
```
{ "count": number, "drivers": [ { "uid": "string", "location": { "lat": number, "lng": number } } ] }
```
- **Validation rules:**
  - `geohashPrefix` — required; single-field range query, precision per **[OPEN] (§14.5)**.
  - Coarse, polled periodically (~15–30 s, **[ASSUMPTION]** §8).
- **Error responses:**
  - `NetworkError` — offline.
- **Authentication:** passenger or driver session.

---

## 3. Booking (`booking` feature)

Creates the trip document with initial status `request`. Source: architecture §3.1, §5.

### 3.1 Create booking
- **Route:** `trips`
- **Method:** `CREATE`
- **Request body:**
```
{
  "destination": { "geo": { "lat": number, "lng": number }, "address": "string", "barangay": "string | null" },
  "pickup": { "geo": { "lat": number, "lng": number }, "address": "string", "label": "string | null" },
  "passengerCount": number
}
```
- **Response body:**
```
{
  "tripId": "string",
  "mode": "solo",
  "status": "request",
  "passengerId": "string",
  "driverId": null,
  "passenger": { "displayName": "string", "phone": "string" },
  "driver": null,
  "destination": { "geo": { "lat": number, "lng": number }, "address": "string", "barangay": "string | null" },
  "pickup": { "geo": { "lat": number, "lng": number }, "address": "string", "label": "string | null" },
  "passengerCount": number,
  "billedSeats": number,
  "requestedAt": "ISO-8601"
}
```
- **Validation rules:**
  - `destination` — required (label + coordinates).
  - `pickup` — required pickup point.
  - `passengerCount` — required integer with a **4-seat floor** (Solo reserves the whole vehicle; architecture §3.1, booking `bookingSchema`). Seat math lives in `lib/seatModel.ts`.
  - Solo mode only — **no** mode toggle, fare, surcharge, discount, or payment fields are accepted (§3.1, §4). No peso amount is part of the contract.
  - Booking **requires connectivity**; no offline/optimistic create (§11).
- **Error responses:**
  - `ValidationError` — missing destination/pickup or `passengerCount` below floor.
  - `PermissionError` — non-passenger attempting to create.
  - `NetworkError` — offline; UI states this rather than queueing (§11).
- **Authentication:** passenger session; server sets `passengerId` to caller, `status` to `request`, `driverId` to `null`, stamps `requestedAt`.

---

## 4. Matching (`matching` feature)

Solo dispatch + driver accept/decline. Source: architecture §3.2, §5, §7.3, §9.

### 4.1 Subscribe to incoming requests (driver)
- **Route:** `trips?status=request` (filtered to driver's area/availability)
- **Method:** `SUBSCRIBE`
- **Request body (query):**
```
{ "status": "request", "geohashPrefix": "string" }
```
- **Response body (each emitted snapshot):**
```
{
  "requests": [
    {
      "tripId": "string",
      "pickup": { "geo": { "lat": number, "lng": number }, "address": "string", "label": "string | null" },
      "destination": { "geo": { "lat": number, "lng": number }, "address": "string", "barangay": "string | null" },
      "passengerCount": number,
      "billedSeats": number,
      "requestedAt": "ISO-8601"
    }
  ]
}
```
- **Validation rules:** filter must scope to open `request` trips in the driver's area (§8). Driver-pull matching is the MVP default (**[OPEN] §14.4**).
- **Error responses:**
  - `PermissionError` — non-driver subscribing.
  - `NetworkError` — listener `onError` sets a reconnecting flag; last snapshot continues serving (§10.3).
- **Authentication:** driver session, `availability: online`. Returns an unsubscribe handle; torn down on blur/sign-out (§8).

### 4.2 Accept trip (guarded race)
- **Route:** `trips/{tripId}/accept`
- **Method:** `TRANSACTION`
- **Request body:** none (driver uid from session; `tripId` in route).
- **Response body:**
```
{ "tripId": "string", "status": "accepted", "driverId": "string", "acceptedAt": "ISO-8601" }
```
- **Validation rules (enforced in transaction + mirrored in security rules, §5, §7.3):**
  - Trip must currently have `status === 'request'` **and** `driverId == null`.
  - On success, atomically sets `driverId` = caller and `status` = `accepted`, stamps `acceptedAt`. As part of the same transaction, sets `drivers/{uid}.availability = 'on_trip'` and `drivers/{uid}.activeTripId = tripId` so the driver is excluded from nearby-supply queries (database schema §3).
- **Error responses:**
  - `TripAlreadyTakenError` — another driver won the race; surfaced as a benign "ride was taken" dismissal, **not** an error toast (§7.3, §10.4).
  - `NotFoundError` — trip no longer exists.
  - `PermissionError` — non-driver / offline driver.
  - `NetworkError` — offline.
- **Authentication:** driver session.

### 4.3 Decline incoming request (driver)
- **Route:** `trips/{tripId}/decline`
- **Method:** `UPDATE` (client-local dismissal)
- **Request body:** none.
- **Response body:** `{ "tripId": "string", "dismissed": true }`
- **Validation rules:** decline does not transition the trip (it stays `request` for other drivers); it only removes the card for this driver (architecture §3.2 "accept/decline").
- **Error responses:** none material (local dismissal).
- **Authentication:** driver session.

---

## 5. Trip lifecycle (`trip` feature)

The `trips/{tripId}.status` enum is the single source of truth; both apps subscribe (architecture §3 principle 3, §5). Closed union: `request | accepted | driver_arriving | driver_arrived | in_progress | completed | cancelled`.

### 5.1 Subscribe to active trip
- **Route:** `trips/{tripId}`
- **Method:** `SUBSCRIBE`
- **Request body:** none.
- **Response body (each emitted snapshot):**
```
{
  "tripId": "string",
  "mode": "solo",
  "status": "request | accepted | driver_arriving | driver_arrived | in_progress | completed | cancelled",
  "passengerId": "string",
  "driverId": "string | null",
  "passenger": { "displayName": "string", "phone": "string" },
  "driver": { "displayName": "string", "phone": "string", "rating": number, "tripCount": number, "plate": "string" } | null,
  "pickup": { "geo": { "lat": number, "lng": number }, "address": "string", "label": "string | null" },
  "destination": { "geo": { "lat": number, "lng": number }, "address": "string", "barangay": "string | null" },
  "passengerCount": number,
  "billedSeats": number,
  "requestedAt": "ISO-8601",
  "acceptedAt": "ISO-8601 | null",
  "driverArrivingAt": "ISO-8601 | null",
  "driverArrivedAt": "ISO-8601 | null",
  "startedAt": "ISO-8601 | null",
  "completedAt": "ISO-8601 | null",
  "cancelledAt": "ISO-8601 | null",
  "cancelledBy": "passenger | driver | null",
  "cancelReason": "string | null"
}
```
- **Validation rules:** none (read). Status drives the sheet content on `ride`/`drive` in place (§3.3).
- **Error responses:**
  - `NotFoundError` — trip missing.
  - `PermissionError` — caller is neither the trip's passenger nor its driver.
  - `NetworkError` — `onError` sets reconnecting flag; last snapshot served from cache (§10.3).
- **Authentication:** session; caller must be the trip's `passengerId` or `driverId`. Returns unsubscribe handle.

### 5.2 Driver location for active trip (passenger view)
- **Route:** `drivers/{driverId}`
- **Method:** `SUBSCRIBE`
- **Request body:** none.
- **Response body (each emitted snapshot):**
```
{ "uid": "string", "location": { "lat": number, "lng": number }, "lastSeenAt": "ISO-8601" }
```
- **Validation rules:** only while the trip is active (§8); reads the assigned driver's single `location` field (§7.4).
- **Error responses:**
  - `PermissionError` — driver not assigned to caller's trip.
  - `NetworkError` — reconnecting flag; last value served.
- **Authentication:** passenger session bound to a trip whose `driverId` matches.

### 5.3 Transition trip status (forward)
- **Route:** `trips/{tripId}/status`
- **Method:** `UPDATE`
- **Request body:**
```
{ "status": "driver_arriving | driver_arrived | in_progress | completed" }
```
- **Response body:**
```
{ "tripId": "string", "status": "<new status>", "<transitionStamp>": "ISO-8601" }
```
- **Validation rules (enforced in `trip.service.ts` + mirrored in security rules, §5):**
  - **Forward-only** along `accepted → driver_arriving → driver_arrived → in_progress → completed`; **no skipping**.
  - Each allowed setter: `driver_arriving`, `driver_arrived`, `in_progress` (start), `completed` set by **driver**; `completed` may also be reached via passenger **End** (§5 table).
  - Each transition stamps its own timestamp (`driverArrivingAt`, `driverArrivedAt`, `startedAt`, `completedAt`).
  - When `completed` is set: `drivers/{driverId}.activeTripId` is cleared to `null`, `drivers/{driverId}.availability` is reset to `online`, and `drivers/{driverId}.tripCount` is incremented by 1 (database schema §3).
- **Error responses:**
  - `ValidationError` — illegal/backward/skipping transition.
  - `PermissionError` — caller not authorized to set that transition.
  - `NotFoundError` — trip missing.
  - `NetworkError` — offline; queued and flushed on reconnect (§11).
- **Authentication:** session; caller must be the trip's driver (or passenger for End → `completed`).

### 5.4 Cancel trip
- **Route:** `trips/{tripId}/cancel`
- **Method:** `UPDATE` (after acceptance) **or** `DELETE` (before acceptance)
- **Request body:**
```
{ "cancelReason": "string" }
```

Cancellation behaviour is **lifecycle-dependent** (single `trip.service.cancel(tripId, by, reason)` entry point; the transaction branches on current status):

**Case A — before acceptance (status `request`): document DELETED.**
- The passenger's own `request` (with `driverId == null`) is **permanently deleted** (`tx.delete`). This is an *abandoned booking request*.
- **No `cancelled` status is written, no `cancelReason`/`cancelledAt` is persisted, and nothing enters trip history.**
- Driver listeners subscribed to open requests receive a Firestore **document-removal** event.
- No driver doc is touched (none is assigned).
- **Response:** the document no longer exists; the passenger's local active-trip state clears and the UI returns to the booking flow.

**Case B — after acceptance (status `accepted` / `driver_arriving` / `driver_arrived`): status set to `cancelled`.**
- **Response body:**
```
{
  "tripId": "string",
  "status": "cancelled",
  "cancelledBy": "passenger | driver",
  "cancelReason": "string",
  "cancelledAt": "ISO-8601"
}
```
- The document is **retained** and appears in history.
- When a driver is assigned: `drivers/{driverId}.activeTripId` is cleared to `null` and `drivers/{driverId}.availability` is reset to `online` (database schema §3), in the same transaction.

- **Validation rules (§5 cancel matrix):**
  - Cancellable from `request`, `accepted`, `driver_arriving`, `driver_arrived` only. **Not allowed** from `in_progress` (only completion) or from terminal `completed`/`cancelled`.
  - `request` → delete (Case A); `accepted`/`driver_arriving`/`driver_arrived` → `cancelled` write (Case B).
  - Records `cancelledBy` (resolved from caller's role) and `cancelReason` in Case B only.
  - **No money:** fee/penalty governance is deferred — the MVP records only the *fact* of cancellation (§5). The free-cancel countdown is a UI affordance; the fee it gates is out of scope.
- **Error responses:**
  - `CancelNotAllowedError` (`ValidationError`) — cancel attempted from a non-cancellable state (`in_progress`/terminal).
  - `PermissionError` — caller not party to the trip (and, for delete, not the owning passenger of an open `request`).
  - `NotFoundError` — trip missing.
  - `NetworkError` — offline.
- **Authentication:** session; for Case B the caller must be the trip's `passengerId` or `driverId`; for Case A (delete) only the owning `passengerId` of an unassigned `request`.

---

## 6. Trip history (`trip-history` feature)

Passenger list + read-only detail. Source: architecture §3.1, §4, §11.

### 6.1 List trip history (passenger)
- **Route:** `trips?passengerId={uid}&status=completed,cancelled`
- **Method:** `GET`
- **Request body (query):**
```
{ "passengerId": "string", "limit": number, "cursor": "string | null" }
```
- **Response body:**
```
{
  "trips": [
    {
      "tripId": "string",
      "status": "completed | cancelled",
      "destination": { "label": "string" },
      "pickup": { "label": "string" },
      "passengerCount": number,
      "requestedAt": "ISO-8601",
      "completedAt": "ISO-8601 | null",
      "cancelledAt": "ISO-8601 | null"
    }
  ],
  "nextCursor": "string | null"
}
```
- **Validation rules:**
  - `passengerId` — must equal the caller's uid.
  - Only `completed` and `cancelled` trips appear. Trips abandoned at the `request` stage are deleted (§5.4 Case A) and so never appear in history.
  - Ordered by recency (timestamps, §5). **No receipts, no monthly Spent/Saved/Distance, no fare/insights** (§4) — none are present.
- **Error responses:**
  - `PermissionError` — requesting another passenger's history.
  - `NetworkError` — offline; served from the **persisted TanStack Query cache** (the single allow-listed cold-start cache, §11) then revalidated.
- **Authentication:** passenger session; own history only. Owned by TanStack Query (§ state separation, §10.2).

### 6.2 Get trip detail (read-only)
- **Route:** `trips/{tripId}`
- **Method:** `GET`
- **Request body:** none.
- **Response body:** the full trip document (same shape as §5.1 snapshot), **read-only**, **with no fare/receipt fields** (§4, §6 table).
- **Validation rules:** none (read).
- **Error responses:**
  - `NotFoundError` — trip missing.
  - `PermissionError` — caller not the trip's passenger.
  - `NetworkError` — offline; profile/history reads served from persisted cache (§11).
- **Authentication:** passenger session; must be the trip's `passengerId`.

---

## 7. Cross-cutting requirements

- **Authentication (all operations):** a valid Firebase Auth session is required except §1.1, §1.5, §1.6 (which establish sessions). Role is read from `users/{uid}` (§6); production hardening toward a role **custom claim** is **[OPEN] (§14.3)** and does not change these contract shapes.
- **Authorization invariants** are enforced **both** in the service layer **and** mirrored in Firestore security rules (architecture §5, §7.3) — notably the accept race (§4.2) and forward-only transitions (§5.3).
- **Validation boundary:** all request-body validation is **Zod** at the form/service edge; validation errors never reach the data layer (§10.5) and surface as `ValidationError`.
- **Error translation:** raw `FirebaseError` codes never cross the service edge; they are mapped to the domain error set in §0 (architecture §10.1).
- **Real-time vs request reads:** `SUBSCRIBE` operations feed Zustand live stores; `GET` operations are owned by TanStack Query with bounded retry/backoff (§10.2, state separation §1.4). Listeners are always torn down on blur/trip-end/sign-out (§8).
- **No deferred symbols:** no contract references pricing, wallet, fleet, Share, ratings, receipts, or push — they are absent from the type system by design (architecture §4 hard rule).

---

## 8. Phase 11 Real Operational Flow & Maps Realignment

Implemented in Phase 11 to transition the MVP from manual database edits to a real interactive operational flow:
- **Real Maps Integration**: Coordinates from the booking draft (`bookingDraftStore`) and active trip (`activeTripStore`) are mapped from `{ lat, lng }` Firestore geopoints to `{ latitude, longitude }` native coordinates to render interactive `react-native-maps` views with pickup, destination, and live driver markers.
- **Route Polyline**: Calculated and rendered dynamically (driver-to-pickup before pickup, and pickup-to-destination after the trip starts).
- **Driver Location active statuses**: Updated `DRIVER_LOCATION_ACTIVE_STATUSES` to include `'accepted'` so the passenger starts receiving live driver location updates immediately upon matching.
- **Lifecycle Action Buttons**: Fully wired to the `useTripTransition` and `useCancelTrip` hooks to drive the state machine interactively from the UI sheets.
- **Atomic Teardown Transaction**: The completion transition is executed in a single atomic transaction:
  - Updates `trips/{tripId}` status to `completed` and sets `completedAt`.
  - Resets `drivers/{uid}`: sets `activeTripId` to `null`, `availability` to `online`, and increments `tripCount` by 1.
- **No Fare/Payment/Rating/Shared Ride**: Re-asserted that no pricing, wallet, or rating fields exist in the contracts or database updates.

*Derived solely from [architecture.md](./architecture.md). Companion specs referenced therein — [database_schema.md](./database_schema.md), [state_management.md](./state_management.md), [navigation.md](./navigation.md) — were **not** used as inputs per the generation constraint.*
