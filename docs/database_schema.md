# Pakyaw — Database Schema (MVP)

> **Historical / superseded source note:** this MVP schema archive contains
> older four-seat Solo examples. The maintained backend contract now accepts
> 1–6 actual Solo passengers and stores `billedSeats = 6` for new valid Solo
> Trips. Existing Trip snapshots are immutable.

Cloud Firestore schema for the **MVP Pakyaw SOLO ride system** only. Scope, principles, and the trip state machine are defined in [architecture.md](./architecture.md). Source of truth: [requirements.md](./requirements.md).

**Excluded from this schema (deferred):** any fare/price/commission/discount amount, wallet/balance, payments, Share/carpool, fleet/operator, earnings, ratings/receipts, trust/fraud, notifications. **No monetary field exists anywhere in the MVP schema** — pricing is deferred and must not appear (FR-1.2 deferred; §0 scope).

> **Conventions**
> - All timestamps are Firestore `Timestamp` (server-set via `serverTimestamp()` on writes). Field names end in `At`.
> - All money is **absent by design**. The only "amount-like" field is `billedSeats` (a seat count, not pesos).
> - IDs: `users` and `drivers` are keyed by Firebase Auth `uid`. `trips` use Firestore auto-IDs.
> - `[ASSUMPTION]` marks fields inferred from flows/requirements, not pinned by a source screen.

---

## 1. Collections overview

| Collection | Key | Purpose | Real-time? |
|---|---|---|---|
| `users/{uid}` | auth uid | Passenger (and driver) account/profile + role | on demand |
| `drivers/{uid}` | auth uid | Driver presence, location, vehicle, availability | yes (location + availability) |
| `trips/{tripId}` | auto-id | One ride; the lifecycle state machine | yes (status + driver location join) |
| `users/{uid}/savedPlaces/{placeId}` | auto-id | Optional saved destinations (subcollection) | on demand |

That is the **entire** MVP data model — four document classes. Everything else is deferred.

---

## 2. `users/{uid}`

Profile + role for any account. A driver also has a `drivers/{uid}` doc (same uid); `users/{uid}` is still their identity/profile record.

```ts
type AccountStatus = 'active' | 'suspended' | 'blocked';
type UserRole      = 'passenger' | 'driver';

interface UserDoc {
  uid: string;                 // == auth uid
  role: UserRole;              // routes the app into (passenger) or (driver)
  firstName?: string;          // First name (non-empty string)
  lastName?: string;           // Last name (non-empty string)
  name: string;                // Composed compatibility/display name: `${firstName} ${lastName}`.trim()
  mobile: string;              // +63 E.164 format verified via Firebase Phone Auth
  accountStatus: AccountStatus;// 'active' | 'suspended' | 'blocked'
  termsAcceptedAt?: Timestamp; // Server timestamp when Terms of Service were accepted
  privacyAcceptedAt?: Timestamp;// Server timestamp when Privacy Policy was accepted
  createdAt: Timestamp;        // Server timestamp
  updatedAt: Timestamp;        // Server timestamp
}
```

Notes:
- `riderType` is captured at sign-up and persisted, but the 20% privilege discount it implies is **deferred pricing** — no code reads it for money in the MVP.
- Role is stored here for the MVP. Production should additionally mint a **custom claim** so security rules don't read this doc on every trip check (architecture.md §10, open item 3).

### 2.1 `users/{uid}/savedPlaces/{placeId}` (optional, FR-1.1.6)
```ts
interface SavedPlaceDoc {
  label: string;               // "Home", "School", "Work"
  address: string;
  geo: GeoPoint;               // lat/lng
  createdAt: Timestamp;
}
```
Optional during onboarding ("Where do you usually go?") and editable later. A subcollection (not an array) so places scale and are individually editable.

---

## 3. `drivers/{uid}`

The driver's live operational record. Highest-write document in the system (location) — see throttling in architecture.md §8.

```ts
type Availability = 'offline' | 'online' | 'on_trip';

interface DriverDoc {
  uid: string;                 // == auth uid == users/{uid}
  // identity mirror (denormalized for the passenger match card — FR-1.3.3)
  displayName: string;         // "Ricky Mendoza"
  rating: number;              // ★ shown on match card; static seed in MVP [ASSUMPTION]
  tripCount: number;           // "1,284 trips" on match card; incremented on completion

  // vehicle (Tricycle only matters for MVP capacity)
  vehicle: {
    type: 'tricycle';          // MVP supports tricycle; other types deferred
    plate: string;             // "ABC-1234"
    capacity: 6;               // FIXED — business rule (FR-1.2.5 / FR-1.1.8)
  };

  // availability & presence (FR-1.3.9)
  availability: Availability;
  preflightPassedAt: Timestamp | null;  // last time checklist was passed
  lastSeenAt: Timestamp;

  // live location (driver location updates) — last-known only, no history collection
  location: GeoPoint | null;   // updated by watchPositionAsync, throttled
  heading: number | null;      // degrees, for marker rotation [ASSUMPTION]
  geohash: string | null;      // for nearby-driver queries (§5)
  locationUpdatedAt: Timestamp | null;

  // current assignment
  activeTripId: string | null; // set on accept, cleared on complete/cancel

  approved: boolean;           // MVP drivers are pre-provisioned approved == true
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Notes:
- **Location is a field, not a subcollection.** Last-known position lives on the driver doc so the passenger join is a single-doc `onSnapshot` and writes stay at one document. No `locations` history in MVP (no anomaly detection — deferred).
- `availability: 'on_trip'` lets nearby-supply queries exclude busy drivers without a second lookup.
- `capacity: 6` and `vehicle.type: 'tricycle'` encode the seat business rule's vehicle side. Capacity is **not** configurable per-doc in MVP — it is the constant 6.
- `rating`/`tripCount` are **denormalized** onto the driver doc purely to render the match card cheaply (FR-1.3.3). `tripCount` increments on `completed`.

---

## 4. `trips/{tripId}` — the state machine document

The single source of truth for a ride. Both apps subscribe to it. Status enum and transition rules: architecture.md §5.

```ts
type TripStatus =
  | 'request'
  | 'accepted'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

type RideMode = 'solo';        // MVP: Solo only. Field exists so Share can be added later
                               // without a migration, but 'share' is NOT implemented.

type CancelledBy = 'passenger' | 'driver';

interface TripDoc {
  id: string;
  mode: RideMode;              // always 'solo' in MVP

  // parties
  passengerId: string;         // users/{uid}
  driverId: string | null;     // set atomically on accept (transaction); null while 'request'

  // denormalized cards (avoid extra reads on the live screen)
  passenger: { displayName: string; phone: string };
  driver: {                    // null until accepted
    displayName: string;
    phone: string;
    rating: number;
    tripCount: number;
    plate: string;
  } | null;

  // route
  pickup:  { geo: GeoPoint; address: string; label: string | null };
  destination: { geo: GeoPoint; address: string; barangay: string | null };
  // barangay is stored for future zonal pricing; NOT priced in MVP.

  // Phase 12 — routed trip context (display-only; NOT priced).
  // route.distanceMeters is the canonical trip-length value enforced by the
  // minimum-trip-distance rule (>= 50, phase12_spec.md §1.5) and the maximum
  // sanity bound (<= 60_000). It is never derived from lat/lng equality.
  // route?: { distanceMeters: number; durationSeconds: number; polyline: string; fetchedAt: Timestamp };

  // Navigation Experience phase — driver-published canonical Driver→Pickup route
  // (display-only; NOT priced). SEPARATE field from `route` above and must never
  // overwrite it: `route` is Pickup→Destination (booking), `driverRoute` is
  // Driver→Pickup (live nav). Written by the assigned driver only, while
  // status ∈ {accepted, driver_arriving}; read by trip participants. The passenger
  // renders this exact road route from Firestore (no passenger Directions call).
  // See phase12_navigation_spec.md §4 / §10.3 / "Booking Route vs Driver Route".
  // driverRoute?: { polyline: string; distanceMeters: number; durationSeconds: number; updatedAt: Timestamp } | null;

  // SEAT MODEL (FR-1.2.5 — IN SCOPE; the fare built on it is DEFERRED)
  passengerCount: number;      // 1..6, what the passenger entered
  billedSeats: number;         // clamp(passengerCount, 4, 6) — see §6. Seat count, NOT money.

  // lifecycle
  status: TripStatus;
  cancelledBy: CancelledBy | null;
  cancelReason: string | null; // free text / enum later; no fee attached in MVP

  // NOTE: the driver's live position is NOT copied here. The active-trip screen reads
  // it from drivers/{driverId}.location (one source of truth — architecture.md §7.4).

  // timestamps — one per transition, for ordering, ETA, and history
  requestedAt: Timestamp;
  acceptedAt: Timestamp | null;
  driverArrivingAt: Timestamp | null;
  driverArrivedAt: Timestamp | null;
  startedAt: Timestamp | null;       // in_progress
  completedAt: Timestamp | null;
  cancelledAt: Timestamp | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.1 Why denormalize `driver`/`passenger` onto the trip
The live screen and the history card render party info constantly. Embedding a small snapshot (name, plate, rating) on accept means the active-trip listener needs **one** document, not a join across `users`/`drivers`. Trade-off: the snapshot is point-in-time (fine for a trip record; a completed trip *should* freeze the driver's name/plate as they were).

### 4.2 Trip history
There is **no separate history collection**. History is a **query** over `trips` where `passengerId == uid` and `status in ('completed','cancelled')`, ordered by `requestedAt desc`. This keeps one write-path and one source of truth (FR-1.5.4 list + read-only detail). Receipts/monthly aggregates are deferred.

> Only trips cancelled **after** a driver accepted carry `status = 'cancelled'` and therefore appear in history. A `request` cancelled **before** acceptance is deleted outright (abandoned request) — it never carries a `cancelled` status and never appears in history.

---

## 5. Geo / nearby-driver query (FR-1.3.2)

MVP avoids a true geo-index. Each `drivers/{uid}` carries a **geohash** string (e.g. 6–7 chars ≈ city-block precision). "Drivers within ~1km" is approximated by a **prefix range query** on `geohash` plus an `availability == 'online'` filter, then a client-side haversine refine.

```
drivers
  where availability == 'online'
  where geohash >= <prefix>  and  geohash < <prefix + ''>
  (client refines exact distance + count)
```

- Adequate for a single city at MVP scale (architecture.md §9).
- Swappable later for GeoFirestore / Cloud Function geo without schema-breaking change (geohash already present).
- **[ASSUMPTION]** geohash precision (6 vs 7 chars) and the supply-refresh cadence are open items (architecture.md §14 item 5).

---

## 6. The seat-reservation business rule (FR-1.2.5)

The one piece of domain math that **is** in MVP scope. It produces a **seat count**, never a price.

```
capacity      = 6                       // every tricycle, fixed
billedSeats   = clamp(passengerCount, 4, 6)
              = min(6, max(4, passengerCount))
```

| `passengerCount` | `billedSeats` | Rationale |
|---|---|---|
| 1 | 4 | 4-seat floor |
| 2 | 4 | 4-seat floor |
| 3 | 4 | 4-seat floor |
| 4 | 4 | exact |
| 5 | 5 | actual |
| 6 | 6 | actual (full vehicle) |

Rules encoded:
- A **Solo** booking reserves the **entire vehicle** — no other passenger is ever matched to a trip with `mode: 'solo'`. There is no concept of filling empty seats in MVP (Share is deferred).
- **Empty (unbilled) seats cannot be occupied by anyone else** — guaranteed structurally: a `trips` doc has exactly one `passengerId`, and a driver's `activeTripId` points to exactly one trip.
- `billedSeats` is computed **once at booking** in `lib/seatModel.ts` (pure, unit-tested) and written to the trip. It is retained for the deferred fare engine to consume later (`base = zonal × billedSeats`) — but the MVP writes only the count.

`passengerCount` is validated `1 ≤ n ≤ 6` by the booking Zod schema; the stepper enforces the 4-seat **display floor** (UI shows min 4) while still allowing the underlying count semantics above.

---

## 7. Indexes

| Query | Index |
|---|---|
| Passenger history: `passengerId == uid && status in [...] order by requestedAt desc` | composite: `passengerId ASC, requestedAt DESC` (+ status filter) |
| Driver's active/recent: `driverId == uid order by requestedAt desc` | composite: `driverId ASC, requestedAt DESC` |
| Open requests near driver: `status == 'request' && geohash range` | composite: `status ASC, geohash ASC` **[ASSUMPTION]** for driver-pull matching |
| Nearby online drivers: `availability == 'online' && geohash range` | composite: `availability ASC, geohash ASC` |
| Single trip live: `trips/{tripId}` | none (doc read) |

Composite indexes are declared in `firestore.indexes.json`. Single-field auto-indexes cover the rest.

---

## 8. Security rules (intent, not final code)

Rules mirror the architecture's invariants server-side. Sketch of intent:

- **`users/{uid}`**: readable by the owner; writable by the owner for profile fields; `role` not client-mutable after creation (or set only at creation). Drivers' public card fields readable by a matched passenger.
- **`drivers/{uid}`**: a driver writes only their **own** doc (availability, location, preflight). A passenger may **read** the `location`/card fields of the driver on their **active trip** only.
- **`trips/{tripId}`**:
  - Create: only an authenticated passenger, with `passengerId == auth.uid`, `status == 'request'`, `driverId == null`, `mode == 'solo'`, and `billedSeats == clamp(passengerCount,4,6)` (rule re-derives it). Phase 12 additionally asserts that `pickup`/`destination` coords fall inside the Ormoc service area and that **`50 <= route.distanceMeters <= 60_000`** — the lower bound is the minimum-trip-distance backstop (phase12_spec.md §1.5); the upper bound is a sanity cap. See [phase12_spec.md §2.2](./phase12_spec.md#22-security-rules--firestorerules) for the exact rule text.
  - Accept (`request → accepted`): only a driver, only when `driverId == null && status == 'request'`, setting `driverId == auth.uid`. Enforces the **accept race** invariant (architecture.md §7.3) so a trip can't be stolen.
  - Forward transitions: driver may advance `accepted → … → completed`; only along the legal chain; no skipping. Passenger may also transition from `in_progress` to `completed` via the End Trip action.
  - Cancel (after acceptance): the passenger or the assigned driver may set `status = 'cancelled'` from `accepted`, `driver_arriving`, or `driver_arrived`; sets `cancelledBy` to their role. The document is retained for history. No fee fields (deferred).
  - Delete (before acceptance): the owning passenger may **delete** their own trip while it is still an open `request` with `driverId == null` — an abandoned booking request. This is the **only** permitted delete; no `cancelled` status is written and nothing enters history. After acceptance a trip is never deleted, only cancelled.
  - `in_progress` cannot be cancelled — only completed.
  - `driverRoute` write (Navigation Experience phase): only the **assigned driver** (`driverId == auth.uid`) may write `driverRoute`, and only while `status ∈ {accepted, driver_arriving}`. The write must not modify the booking `route` (the two are independent fields — see §4 and [phase12_navigation_spec.md §15.2](./phase12_navigation_spec.md)). Reads follow the same participant rule below. Replaces the deprecated Phase 12 `driverToPickup` write rule.
  - Read: only the trip's `passengerId` or its `driverId`.
- **No collection** exposes a money field, so no rule needs to protect one.

> Final rule code is implementation; this section fixes the **invariants** the rules must enforce.

---

## 9. Entity relationships

```
users/{uid} ──1:1 (when role=driver)──▶ drivers/{uid}
users/{uid} ──1:many──▶ savedPlaces

trips/{tripId}
  ├─ passengerId ─▶ users/{uid}        (passenger)
  └─ driverId    ─▶ drivers/{uid}      (set on accept; null while 'request')

A driver has at most ONE active trip:  drivers/{uid}.activeTripId ─▶ trips/{tripId}
A trip references at most ONE driver and exactly ONE passenger.
```

---

## 10. Deferred fields explicitly NOT in this schema

For reviewers verifying scope — these were considered and **deliberately omitted**: `fare`, `baseBuyout`, `convenienceFee`, `total`, `driverNet`, `platformAmount`, `commission`, `surcharge`, `discount`, `paymentMethod`, `walletBalance`, `tips`, `promoCode`, `rating` (post-trip), `shareSeatCount`, `corridorId`, `fleetId`, `operatorId`, `qrPairing`, `trustScore`, `strikes`, `cancellationFee`. Adding any of these is a post-MVP, scoped change.

## 11. Phase 11 Database Schema Realignment

The database schema, indices, and security rules were verified and realigned in Phase 11:
- **Live Location Schema**: Confirmed `drivers/{uid}.location` remains the single source of truth for the live driver location. The passenger-side map subscribes to `drivers/{driverId}` directly and maps it visually.
- **Security Rules Realignment**: Updated the Firestore rules (`firestore.rules`) to permit passengers to:
  1. Transition the trip `status` from `'in_progress'` to `'completed'`.
  2. Write to the assigned driver's doc `drivers/{driverId}` during trip completion or cancellation (to atomically reset `availability` to `'online'`, set `activeTripId` to `null`, and optionally increment `tripCount` on completion).
- **No Fare/Receipt/Payment/Rating Fields**: Confirmed that the collections and rules remain completely free of monetary and post-trip rating fields, satisfying the zero-money MVP invariant.

---

*Companion specifications: [architecture.md](./architecture.md) · [state_management.md](./state_management.md) · [navigation.md](./navigation.md).*
