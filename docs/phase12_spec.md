# Phase 12 — Map-Driven Booking, Service Area, Figma Alignment

**Status:** Implemented (production)
**Predecessors:** Phase 11 (interactive maps for driver/passenger live screens)
**Source of truth:** Figma booking flow + [requirements.md](./requirements.md) §1.1 (Booking & Trip Lifecycle). Pricing requirements (§1.2) are **explicitly out of scope** for this phase — see §11 "Pricing Deferred".

**Scope:** Transform the booking flow from placeholder text inputs into a real map-driven booking experience: Google Maps with the device's current location, a draggable pickup pin, Places-backed pickup and destination search, geographic fencing to Ormoc City, a routed polyline, ETA + distance to destination, driver-to-pickup ETA + distance, an enhanced driver `IncomingRequestCard`, and a Figma-aligned passenger booking sheet (with the fare container present but **placeholder-only**). Pricing logic, tariff lookups, and platform-fee math are deferred to a later phase. Phase 12 also tightened the **cancellation lifecycle** — see §13.

> **Revision note.** Earlier drafts of this spec described a full zonal fare model (Ordinance No. 121 lookups, billed-seat math, surcharges, platform convenience fee, frozen `trip.fare` snapshot, fare-related Firestore rule invariants, and `computeFare` unit tests). **All of that is removed.** Pricing returns in a future phase after tariff validation and operator survey work. Phase 12 ships map-driven booking only.

---

## 0. Scope Summary

### In scope
1. Passenger booking driven by a real interactive Google Map (device current location, draggable pickup pin, search for both pickup and destination).
   - **1a.** Pickup selection via **three** entry points: (i) current location (default), (ii) Places search, (iii) **manual map pin placement** (crosshair-based confirm **or** drag on the existing pickup marker).
   - **1b.** Destination selection via **two** entry points: (i) Places search, (ii) **manual map pin placement** (crosshair-based confirm; the destination marker is also draggable once placed).
   - **1c.** **Both** pickup and destination markers are draggable on the live booking map; drag end triggers reverse geocoding and route recalculation.
2. Places autocomplete restricted to the Ormoc City service area.
3. Routed polyline between pickup and destination.
4. **Passenger trip ETA + distance** (display-only trip context).
5. **Driver-to-pickup ETA + distance** during the `accepted` → `driver_arrived` lifecycle.
6. Three-layer geographic restriction to Ormoc City (UI prevention, service-layer assertion, Firestore rules on coordinates) — applies to manual pin placement as well as search-selected places.
7. Passenger `BookingSheet` redesign matching Figma — including the **fare container as placeholder only** (no computation).
8. Driver `IncomingRequestCard` enhancement showing **pickup, destination, ETA, and distance** (no fare).
9. Removal of all **Shared / carpool ride UI** from the booking flow.
10. Removal of the **privilege-discount UI** from the booking flow.

### Out of scope (deferred)
- **All fare/pricing computation** (FR-1.2.x). Tariff loading, zonal lookups, billed-seat math, surcharges, platform/convenience fees, fare breakdown values, "driver receives" math, and any related Firestore rule invariants. See §11.
- **Fare display on the driver request card** — the fare row is deferred along with the rest of pricing.
- Share / carpool matching and pricing (FR-1.2.6, FR-1.3.4).
- Privilege discounts / promo codes (FR-1.2.9, FR-1.5.3).
- Payment processing, wallets, receipts, ratings, tipping (FR-1.5).
- Commission model (FR-1.2.8).
- Multi-city expansion (foundation only — see §10).

### Reversal of prior invariants
None. Because Phase 12 introduces **no** monetary fields, the existing `database_schema.md` §0/§10 invariant ("no monetary field exists anywhere in the MVP schema") **continues to hold** through this phase. The pricing reconciliation referenced in earlier drafts is no longer needed in Phase 12 and moves to the future pricing phase.

---

## 1. Service Area — Ormoc City Restriction

### 1.1 Bounds — `src/lib/serviceArea/ormoc.ts`
```ts
export const ORMOC_SERVICE_AREA = {
  id: 'ormoc',
  displayName: 'Ormoc City',
  center: { latitude: 11.0050, longitude: 124.6075 },
  bounds: { north: 11.1100, south: 10.9000, east: 124.7200, west: 124.4900 },
  searchBiasRadiusMeters: 12_000,
} as const;
```

> **[GAP]** Confirm precise bounds with operations. The box above is conservative and includes urban barangays plus highway approaches.

### 1.2 Three-layer validation

| Layer | Mechanism | Failure UX |
|---|---|---|
| **L1 — UI prevention** | Places autocomplete biased + filtered to bounds; map pan clamped; pickup and destination pins cannot leave bounds (drag-clamp where library supports it, revert-on-drop otherwise); manual map-tap pin drops outside Ormoc are rejected | On out-of-bounds drag: marker reverts to last valid position and toast appears: **"Service is currently available only within Ormoc City."** On autocomplete: inline message: "Pakyaw is only available in Ormoc City." |
| **L2 — Service validation** | `bookingService.createTrip()` calls `assertInServiceArea(pickup)` and `assertInServiceArea(destination)`; throws `ServiceAreaError` | Booking sheet: "This location is outside our service area." Confirm disabled. |
| **L3 — Firestore rules** | `firestore.rules` allow `create` only when both `pickup.geo` and `destination.geo` fall inside the Ormoc bounds (numeric literals). This rule is the backstop for manual pin placement as well as search-selected places. | Write rejected → "Could not request ride. Please try again." |

L3 is the only layer an attacker cannot bypass; L1/L2 are UX.

### 1.2.1 Invalid-location side effects

When either endpoint is — or becomes — invalid (outside Ormoc, null, or unresolved):
- **Reverse geocoding must not execute** for the invalid coordinates.
- **Route generation must not execute.** `useRouteQuery` is disabled and any in-flight request is treated as stale.
- **The booking draft's `route` field must be cleared** (`setRoute(null)`) so stale polyline/ETA/distance never render against a new endpoint.
- **`bookingService.createTrip` rejects** with `ServiceAreaError` at submission time even if the client believed the endpoint was valid (race protection between UI state and submit).

### 1.3 Helper — `src/lib/serviceArea/index.ts`
```ts
export function isInServiceArea(coords: LatLng): boolean;
export function assertInServiceArea(place: Place): void; // throws ServiceAreaError
export class ServiceAreaError extends Error { readonly placeLabel: string; }
```

### 1.4 Future expansion
The `ServiceArea` shape is generic; adding a city later is a new constant + registry, no schema migration (see §10).

---

## 2. Firestore Schema Changes (this spec only — `database_schema.md` not edited)

Phase 12 introduces **no monetary fields**. The only additions are coordinate fields, the routed polyline (display context), and live driver-to-pickup tracking.

### 2.1 `trips/{tripId}` — additions

```ts
interface TripDoc {
  // ... existing fields unchanged ...

  // Routed trip context — display-only, used by the passenger BookingSheet
  // and during the live trip screen. NO fare derivation in Phase 12.
  route: {
    distanceMeters: number;
    durationSeconds: number;
    polyline: string;            // encoded Google polyline, <= 8 KB
    fetchedAt: Timestamp;
  };

  // Live driver→pickup tracking (driver-written, throttled)
  driverToPickup: { distanceMeters: number; etaSeconds: number; updatedAt: Timestamp } | null;

  serviceAreaId: 'ormoc';

  // NOTE: NO `fare` field, NO `options.{hasLuggage,isSpecialTrip}` field,
  // NO billedSeats, NO surcharge fields. Pricing is deferred (see §11).
}
```

### 2.2 Security rules — `firestore.rules`

Phase 12 rules enforce **service area + ownership only**. There are no fare invariants to enforce because no fare is written.

```
allow create: if
  request.auth.uid == request.resource.data.passengerId
  && request.resource.data.mode == 'solo'
  && request.resource.data.status == 'request'
  && request.resource.data.driverId == null
  && request.resource.data.serviceAreaId == 'ormoc'
  // Service area (Ormoc bounds)
  && request.resource.data.pickup.coords.lat  >= 10.9
  && request.resource.data.pickup.coords.lat  <= 11.11
  && request.resource.data.pickup.coords.lng  >= 124.49
  && request.resource.data.pickup.coords.lng  <= 124.72
  && request.resource.data.destination.coords.lat  >= 10.9
  && request.resource.data.destination.coords.lat  <= 11.11
  && request.resource.data.destination.coords.lng  >= 124.49
  && request.resource.data.destination.coords.lng  <= 124.72
  // Distance plausibility (display-only field, sanity bound)
  && request.resource.data.route.distanceMeters > 0
  && request.resource.data.route.distanceMeters <= 60000;
```

**Driver→pickup live updates:** only the assigned driver may write `driverToPickup`, only while `status in ['accepted','driver_arriving','driver_arrived']`.

### 2.3 Migration
No backfill. Phase 12 trips are net-new; older trips remain readable without the new fields.

---

## 3. Google Maps APIs

### 3.1 APIs enabled
| API | Purpose |
|---|---|
| **Places Autocomplete (New)** | Pickup/destination search biased to Ormoc |
| **Place Details / Geocoding** | Resolve `place_id` → coords + address components for display labels |
| **Directions** | Route polyline + distance + duration between pickup and destination |
| **Distance Matrix** | Driver→pickup live ETA during `accepted` |

> Distance and duration are **display-only**. Phase 12 does not consume them for pricing — there is no pricing.

### 3.2 Key management
- Restricted Android key (SHA-1 + package) and iOS key (bundle id) — already configured.
- Keys read via `expo-constants` `Constants.expoConfig.extra.googleMapsApiKey` — never inlined.
- A server-side proxy key for Directions/Distance Matrix is a **Phase 13 hardening item**; Phase 12 calls them client-side with platform-restricted keys.

### 3.3 Throttling
| Caller | Rate |
|---|---|
| Places Autocomplete | Debounced 250 ms; min 3 chars |
| Place Details / Geocoding | Once per selected result; reverse-geocode debounced 500 ms after pin drag |
| Directions (booking) | Once per (pickup, destination) pair; memoized for the session |
| Directions (in-trip) | Once on `in_progress` transition (frozen route) |
| Distance Matrix (driver→pickup) | 1 call / 30 s while `accepted`/`driver_arriving`; cancelled on `driver_arrived` |

---

## 4. State Management Updates

### 4.1 `bookingDraftStore` (Zustand) — additions
```ts
type PlaceSource = 'current-location' | 'search' | 'manual-pin';

interface BookingDraftState {
  // existing
  pickup: Place | null;
  destination: Place | null;
  passengerCount: number;

  // Phase 12 — map/route state only. NO fare, NO options, NO derived pricing.
  route: { distanceMeters: number; durationSeconds: number; polyline: string } | null;

  // Selection provenance — drives UI affordances and analytics.
  pickupSource: PlaceSource | null;
  destinationSource: Exclude<PlaceSource, 'current-location'> | null;

  // 'idle' = no manual placement in flight; 'picking' = crosshair flow active for that endpoint.
  pickupPickMode: 'idle' | 'picking';
  destinationPickMode: 'idle' | 'picking';

  setPickup(p: Place | null, source: PlaceSource): void;
  setDestination(p: Place | null, source: Exclude<PlaceSource, 'current-location'>): void;
  beginPickupPick(): void;            // enters pickup manual-pin mode
  cancelPickupPick(): void;
  beginDestinationPick(): void;       // enters destination manual-pin mode
  cancelDestinationPick(): void;
  setRoute(r: RouteResult | null): void;
  reset(): void;
}
```

Whenever `setPickup` or `setDestination` is invoked with new coordinates, `route` is invalidated (`setRoute(null)`) before `useRouteQuery` re-fetches. `pickupSource`/`destinationSource` are preserved across drag-driven updates (a marker dragged from a search-selected pickup remains `source: 'search'`); they are only overwritten when the user re-enters via a different entry point. **At most one** of `pickupPickMode`/`destinationPickMode` may be `'picking'` at a time — entering one cancels the other.

The store **does not** carry a `fare`, `options.hasLuggage`, `options.isSpecialTrip`, `destinationBarangay`, or `geocodingStatus`-tied fare flow. The fare container in the booking sheet (§5.3) reads no derived value.

### 4.2 `activeTripStore` (Zustand) — additions
```ts
interface ActiveTripState {
  // existing
  tripId: string | null;
  trip: TripDoc | null;
  driverLocation: LatLng | null;

  // Phase 12
  driverToPickup: { etaSeconds: number; distanceMeters: number } | null;
}
```
Sourced from `trip.driverToPickup` (driver-written) — not recomputed on the passenger client.

### 4.3 TanStack Query — new queries
- `useRouteQuery({ pickup, destination })` — Directions; display-only distance/duration/polyline. `staleTime` 5 min, retries 2. **Keyed on `(pickup.coords, destination.coords)`** and must re-fetch whenever either changes — including drag-driven changes. The query is **disabled** while either endpoint is null or fails `isInServiceArea`. On re-fetch, the prior `route` value is invalidated in `bookingDraftStore` (`setRoute(null)`) before the new value is written, so polyline/ETA/distance never display against a mismatched endpoint pair.
- `useOrmocPlacesAutocomplete(query)` — Places, debounced, `staleTime` 30 s.
- `useDriverToPickupETA(tripId)` — Distance Matrix, `refetchInterval: 30s`, enabled only while status ∈ {accepted, driver_arriving}.

> No `useActiveTariff`, no tariff/zonal queries — pricing is deferred.

---

## 5. Passenger Screens (Figma alignment)

### 5.1 Home — `(passenger)/index.tsx`
Full-bleed `LiveMap` centered on current location (fallback `ORMOC_CENTER`); floating "Where to, James?" pill opens the Set Destination sheet.

### 5.2 Set Destination sheet — `SetDestinationSheet.tsx` (new)
- Debounced search via `useOrmocPlacesAutocomplete`; sections **Saved / Recent / Suggested**.
- Saved = `users/{uid}/savedPlaces`; Recent = last 5 trip destinations; Suggested = curated Ormoc landmarks.
- Selecting a row sets `destination` (with `source: 'search'`) and advances to the booking sheet.
- A persistent **"Drop pin on map"** action sits below the search input. Tapping it dismisses the sheet, calls `beginDestinationPick()`, and surfaces a centered crosshair on the map with a sticky **"Set destination here"** button. The CTA is **enabled only while the crosshair sits inside the Ormoc bounds**. Confirming the placement:
  1. Builds a `Place` with `source: 'manual-pin'` from the crosshair coordinates.
  2. Calls `reverseGeocode(coords)` to fill the address label (throws `ServiceAreaError` if coords are out of bounds — defensive backstop).
  3. Sets `destination` via `setDestination(place, 'manual-pin')` and advances to the booking sheet.
- A **Cancel** affordance during pin placement returns the user to the Set Destination sheet (`cancelDestinationPick()`).

### 5.3 Booking sheet — `BookingSheet.tsx` (redesign, Pakyaw-only)
Matches Figma. **No Share tab** (Shared ride UI is removed per requirements). **No privilege-discount toggle or "20% off" copy.**

- **Single mode label** "Pakyaw Solo" (no segmented Solo/Share control).
- **Route summary card**: pickup green dot + destination amber dot, addresses, **distance + ETA chip** ("3.4 km · 8 min"). Each row carries a small **"Adjust"** affordance. Tapping "Adjust" on either row opens a short action menu offering **"Drag pin on map"** (focuses the map and hints to drag the corresponding marker — also available by long-pressing the marker directly) and **"Drop pin on map"** (enters the crosshair flow for that endpoint via `beginPickupPick()` or `beginDestinationPick()`). For pickup, the menu also offers **"Use current location"** which resets pickup via `setPickup(currentLocationPlace, 'current-location')`.
- **Seat stepper**: `passengerCount` 1..6 (display + storage only — does not drive any pricing math in this phase).
- **Fare container**: the Figma fare container is **retained visually** but renders **placeholder content only**. Acceptable placeholder copy: "Fare shown at confirmation" or a skeleton row. There is **no** computed total, no breakdown rows, no "₱" amount, no "Driver receives" line, and **no Confirm-button price**.
- **Confirm button**: "Request Pakyaw" (no embedded price). Disabled while pickup or destination are missing, while either is outside the service area, while the route is still loading, while either pick mode is `'picking'`, or while a service-area assertion fails.

Passenger sees pickup, destination, route polyline, ETA, and distance before confirming. Fare display is deferred.

---

## 6. Driver Screens

### 6.1 `IncomingRequestCard` — enhancement
Rows above Accept/Decline:
```
Pickup        BRGY. COGON
Destination   ORMOC SUPERDOME
ETA           ~5 min to pickup
Distance      3.4 km trip
```
- ETA-to-pickup from Distance Matrix; the trip distance is the Directions value.
- **No fare row, no "You receive" row** — fare display on the driver card is deferred (§11).

### 6.2 En-route driver sheet — `EnRouteSheet.tsx`
Replace raw lat/lng with a phase chip (Heading to pickup / Arriving / At pickup / In progress) plus **distance + ETA to current target** (pickup or destination by phase), keeping the existing state-machine actions.

---

## 7. Map Behavior

### 7.1 Routed polyline
`LiveMap` gains `readonly routePolyline?: string | null`. When present, decode (Google polyline algorithm) and render via `<Polyline>`; keep the straight-line fallback with `lineDashPattern={[6,6]}` to make routing degradation visible.

### 7.2 Camera
Unchanged from Phase 11 — fit active markers + 320 px bottom inset.

### 7.3 Marker interaction
- **Pickup marker** is always visible once a pickup exists (the default current-location pickup counts). It is draggable within the Ormoc service area.
- **Destination marker** is visible from the moment a destination is selected (via search **or** manual pin drop) and is draggable within the Ormoc service area.
- **Drag-end behavior (both markers):**
  1. If the new position is **outside** Ormoc bounds: animate the marker back to its last valid position and show the toast **"Service is currently available only within Ormoc City."** Do **not** reverse-geocode. Do **not** refetch the route.
  2. If the new position is **inside** bounds: update the corresponding endpoint in `bookingDraftStore` (preserving the existing `source` value), invalidate `route` via `setRoute(null)`, debounce reverse geocoding by 500 ms to refresh the address label, and trigger `useRouteQuery` to re-fetch.
- **Manual pin placement (crosshair flow — available for both pickup and destination):** while `pickupPickMode === 'picking'` or `destinationPickMode === 'picking'`, the map shows a centered crosshair tinted to match the active endpoint (green for pickup, amber for destination). A sticky CTA reads **"Set pickup here"** or **"Set destination here"** accordingly, and is enabled only while the crosshair sits inside the Ormoc bounds. Tapping confirms the placement (see §5.2 for destination, §5.3 for pickup). A **Cancel** affordance returns to the prior sheet.
- **Drag is clamped** at the Ormoc bounds where the underlying map library supports it; where clamp is unavailable, the revert-on-drop behavior in step 1 is the authoritative enforcement.

### 7.4 Route polyline updates
The polyline rendered by `LiveMap` is bound to `bookingDraftStore.route.polyline`. Because both markers' drag-end paths and both crosshair confirm paths invalidate `route` before the refetch resolves, the polyline disappears briefly during recomputation; once `useRouteQuery` settles, the **polyline, ETA, and distance update together**. This is the single recomputation path for both pickup and destination changes — there is no separate code path for search-driven vs. drag-driven vs. manual-pin-driven endpoint changes.

---

## 8. Service / Hook Layer

| File | Responsibility |
|---|---|
| `src/lib/serviceArea/ormoc.ts` | Ormoc bounds + bias center |
| `src/lib/serviceArea/index.ts` | `isInServiceArea`, `assertInServiceArea`, `ServiceAreaError` |
| `src/lib/maps/decodePolyline.ts` | Encoded polyline → `LatLng[]` |
| `src/features/maps/services/routingService.ts` | `getRoute()` → distance/duration/polyline |
| `src/features/maps/services/placesService.ts` | Autocomplete + details, Ormoc-biased; **adds `reverseGeocode(coords)` returning a `Place` with `source: 'manual-pin'` — must throw `ServiceAreaError` before any network call if `coords` fail `isInServiceArea`** |
| `src/features/maps/services/distanceMatrixService.ts` | `getDriverToPickup()` |
| `src/features/maps/hooks/useOrmocPlacesAutocomplete.ts` | Query wrapper |
| `src/features/maps/hooks/useRouteQuery.ts` | Query wrapper; disabled while either endpoint is null or out of service area |
| `src/features/maps/hooks/useDriverToPickupETA.ts` | Query wrapper |
| `src/features/booking/services/booking.service.ts` | Service-area assertion before `createTrip` — re-runs at submit time against current store coordinates so an in-flight route fetch cannot race past a now-invalid endpoint |
| `src/features/booking/components/SetDestinationSheet.tsx` | New — search rows + "Drop pin on map" entry into manual placement |
| `src/features/booking/components/PinPlacementOverlay.tsx` | **New** — generic crosshair overlay + tinted CTA used during `pickupPickMode === 'picking'` **or** `destinationPickMode === 'picking'`; takes `target: 'pickup' \| 'destination'` to choose the color and CTA copy |
| `src/features/booking/components/BookingSheet.tsx` | Redesign — Pakyaw-only, fare container placeholder, "Adjust" affordance on pickup/destination rows (drag / drop-pin / use-current-location actions) |
| `src/features/matching/types.ts` | Add `route` to `IncomingRequest` |
| `src/features/matching/components/IncomingRequestCard.tsx` | Add pickup/destination/ETA/distance rows |
| `src/features/trip/components/LiveMap.tsx` | Accept `routePolyline`, `pickup`, `destination`, `onPickupDragEnd`, `onDestinationDragEnd`, `crosshair?: boolean`; render both draggable markers |
| `src/features/trip/components/EnRouteSheet.tsx` | Replace lat/lng with ETA + distance |

> No `computeFare`, no `tariffService`, no `barangayAliases`, no `FareBreakdown` component, no `useActiveTariff` — those land in the future pricing phase.

---

## 9. Zod Schemas (boundary validation)

### 9.1 `createTripSchema`
```ts
const createTripSchema = z.object({
  pickup: placeSchema,
  destination: placeSchema,
  passengerCount: z.number().int().min(1).max(6),
  route: z.object({
    distanceMeters: z.number().int().positive().max(60_000),
    durationSeconds: z.number().int().positive().max(3 * 3600),
    polyline: z.string().min(1).max(8192),
  }),
  serviceAreaId: z.literal('ormoc'),
});
```
No `fare`, no `options`, no `tariffVersion` — these arrive with pricing.

`placeSchema` carries a `source: 'current-location' | 'search' | 'manual-pin'` discriminator so the wire payload preserves selection provenance for analytics. `source` is informational only — it does not gate any server-side check (the L3 rule still enforces bounds on `pickup.geo` and `destination.geo` regardless of source).

### 9.2 `routeResponseSchema`
Validates the Directions response before extracting display-only distance/duration/polyline. Throws `RoutingError` → "Could not calculate route — please try again."

---

## 10. Implementation Phases

Each sub-phase ends with green `expo lint` and the relevant Vitest suite.

### Phase 12A — Foundations (no UI change)
1. `src/lib/serviceArea/ormoc.ts` + helpers + tests.
2. `src/lib/maps/decodePolyline.ts` + fixture tests.
3. `createTripSchema`, `routeResponseSchema` Zod definitions.

### Phase 12B — Services + queries
1. `routingService`, `placesService`, `distanceMatrixService`.
2. Query hooks (`useRouteQuery`, `useOrmocPlacesAutocomplete`, `useDriverToPickupETA`).
3. `bookingDraftStore` additions (route only).
4. Service-area assertion in `booking.service.createTrip`.

### Phase 12C — Schema + rules
1. Extend `TripDoc` type + Zod schema for `route`, `driverToPickup`, `serviceAreaId`.
2. Update `firestore.rules` per §2.2 (service-area bounds, distance sanity, driver-only `driverToPickup` writes).

### Phase 12D — Passenger UI
1. `SetDestinationSheet` (Saved/Recent/Suggested) plus **"Drop pin on map"** entry into manual destination placement.
2. `BookingSheet` redesign — Figma alignment, fare container **placeholder only**, no Share tab, no discount toggle.
3. Pickup-pin drag + reverse-geocode.
4. **Manual pin placement (both endpoints):** `PinPlacementOverlay` component, `beginPickupPick`/`cancelPickupPick` and `beginDestinationPick`/`cancelDestinationPick` flows, reverse-geocode on confirm, service-area gate on the CTA. Only one endpoint may be in `'picking'` mode at a time.
5. **Draggable pickup and destination markers** with revert-on-out-of-bounds, debounced reverse-geocode, and route recalculation. Drag / crosshair / search all funnel through `setPickup` or `setDestination` → `setRoute(null)` → `useRouteQuery` refetch.
6. **"Adjust" affordance** on the booking sheet's pickup and destination rows (offers Drag, Drop-pin, and — for pickup — Use-current-location).
7. Disable Confirm until pickup, destination, and route are present and in service area, and neither pick mode is active.

### Phase 12E — Driver UI
1. Extend `IncomingRequest` + `IncomingRequestCard` with pickup/destination/ETA/distance rows (no fare row).
2. `EnRouteSheet` ETA/distance replacement.
3. Distance Matrix subscription gated to accepted-state trips.

### Phase 12F — Map upgrades
1. `LiveMap` `routePolyline` prop + decode; routed polyline with dashed fallback.
2. `LiveMap` accepts both `pickup` and `destination` as draggable markers; emits `onPickupDragEnd` / `onDestinationDragEnd` with the dropped coordinates. Out-of-bounds drops are reverted by the parent via marker key/coordinate prop reset.
3. `crosshair` prop renders a centered crosshair overlay tinted per `target: 'pickup' | 'destination'` for the pin-placement flow.

### Phase 12G — Shared-ride + discount UI removal
1. Remove all Shared/carpool tabs, toggles, and copy from the booking flow.
2. Remove the privilege-discount toggle and "20% off" copy from the booking flow. `riderType` retained on `users/{uid}` for future use.

### Phase 12H — Verification
1. End-to-end manual test: search pickup + destination in Ormoc → routed polyline renders → ETA + distance display → out-of-area pickup blocked at L1/L2/L3 → driver card shows pickup/destination/ETA/distance → live driver-to-pickup ETA updates.
2. `expo lint`, `vitest run`. The existing `scripts/check-no-money.js` continues to pass unchanged — Phase 12 introduces no monetary fields.

#### Acceptance criteria — manual map-based selection

- **AC-MP-1:** Passenger can set pickup via current location, search, **and** manual pin placement (both crosshair-confirm **and** drag); the active source is reflected in `bookingDraftStore.pickupSource`.
- **AC-MP-2:** Passenger can set destination via search **and** manual pin placement (crosshair-confirm via Set Destination sheet "Drop pin on map", and drag on the placed marker).
- **AC-MP-3:** Both pickup and destination markers are visible and draggable on the booking map once their respective endpoints exist.
- **AC-MP-4:** Dragging either marker updates the stored endpoint, refreshes the displayed address via reverse geocoding, and triggers a route recalculation that updates polyline, ETA, and distance together.
- **AC-MP-5:** Dragging either marker outside Ormoc bounds reverts the marker to its prior position and shows the exact toast **"Service is currently available only within Ormoc City."**
- **AC-MP-6:** Reverse geocoding and route generation are **not** invoked for out-of-area coordinates (verified by spying on `reverseGeocode` and `useRouteQuery` in the manual test).
- **AC-MP-7:** The Confirm button is disabled whenever pickup or destination is missing, outside service area, or while a route fetch is in flight.
- **AC-MP-8:** A direct Firestore `create` attempt with either endpoint outside the Ormoc bounds is rejected by `firestore.rules` (L3 backstop verified independently of the client UI).

---

## 11. Pricing Deferred

**Fare computation is deferred to a future phase.** It will be designed and implemented only after two prerequisites are complete:

1. **Tariff validation.** The Ordinance No. 121 zonal schedule must be reconciled against the operator's authoritative copy and confirmed with the LGU. The exact stored Firestore tariff document shape (map vs. subcollection), the barangay-name normalization map, the enclosed-barangay set, and the night-trip window must all be confirmed before any client reads them.
2. **Survey work.** Operator and driver survey work on real-world fare expectations (special-trip semantics, luggage handling, convenience-fee acceptance, off-zone destinations) must complete so that the implemented model matches field practice rather than only the ordinance text.

Until both are complete, Phase 12 ships **map-driven booking with no fare math**. Concretely, this means:

- **No `computeFare` function** in `src/lib/fare/*`. The directory does not exist in Phase 12.
- **No tariff documents read or written** from the client. No `tariffService`, no `useActiveTariff`, no `tariffDocSchema`.
- **No fare fields on `trips/{tripId}`** — no `fare.zonalRate`, no `billedSeats`, no `baseBuyout`, no `surcharges`, no `convenienceFee`, no `total`, no `driverNet`, no `tariffVersion`, no `destinationBarangay`/`destinationZone` on the trip, no `options.hasLuggage` / `options.isSpecialTrip`.
- **No fare invariants in `firestore.rules`.**
- **No "Special trip" toggle, no "Lots of luggage" toggle** in the booking sheet.
- **The Figma fare container renders placeholder content only** — no amount, no breakdown rows, no "Driver receives" line.
- **No fare row on the driver `IncomingRequestCard`.** Driver fare visibility ships with the pricing phase.
- **No Ordinance No. 121 logic** (zone selection, regular/discounted columns, barangay-keyed lookups, night-trip surcharges, special-trip surcharge, enclosed-barangay radius rule) in any TypeScript file, Firestore document, or Firestore rule shipped in Phase 12.
- **No platform-fee / convenience-fee math** anywhere in Phase 12.

When pricing returns, it will be its own spec with its own implementation phases, its own schema additions (then-new fare fields on `trips/{tripId}`), its own Zod schemas, its own Firestore rule invariants, and its own UI work (re-introducing the fare breakdown, the Confirm-button price, and the driver-card fare row). The map-driven booking surfaces shipped in Phase 12 are designed to absorb that work without restructuring — the destination Place is already resolved, the route is already on the trip, and the booking sheet's fare container is already laid out for content.

---

## 12. Future Multi-City Expansion (foundation only)

| Surface | Now | Later |
|---|---|---|
| Service area | `ORMOC_SERVICE_AREA` const | `SERVICE_AREAS` registry keyed by `ServiceAreaId` |
| Trip field | `serviceAreaId: 'ormoc'` literal | `serviceAreaId: ServiceAreaId` union |
| Rules | numeric bounds inlined | callable that validates against registry |
| UI city picker | none (Ormoc fixed) | onboarding city select persisted on user doc |

No schema migration to add a second city — new constants + rules update only.

---

## 13. Open Questions / [GAP]

1. **Service area bounds:** confirm the precise Ormoc box with operations; current values are conservative.
2. **Distance Matrix client-side** acceptable for Phase 12, or must a Cloud Function proxy ship simultaneously? Spec assumes client-side with restricted keys (proxy = Phase 13).
3. **Saved/Recent/Suggested sources:** confirm the curated Ormoc landmarks list for the "Suggested" section.
4. **Reverse-geocode rate budget:** confirm the 500 ms debounce on pickup-pin drag is acceptable to operations.
5. **Pricing prerequisites** (tariff validation + survey work) tracked separately — see §11. Phase 12 ships independently of their outcome.
6. **OQ-MP-1 (resolved):** Crosshair-style placement is offered for **both** pickup and destination. Pickup retains current-location as default and gains the crosshair flow via the booking sheet's "Adjust → Drop pin on map" action; the destination crosshair flow is entered from the Set Destination sheet.
7. **OQ-MP-2:** Confirm the 500 ms reverse-geocode debounce is acceptable for the destination marker as well (matches the pickup-drag debounce in §3.3 and §7.3).

---

## 13. Cancellation Lifecycle (Phase 12 implementation)

Phase 12 tightened the cancellation behaviour so the trip document represents only meaningful state. The single entry point remains `trip.service.cancel(tripId, by, reason)`; the transaction branches on `current` status. The Firestore rules mirror the same matrix.

### 13.1 Matrix

| Current status | Caller | Effect | History | Driver doc |
|---|---|---|---|---|
| `request` | owning passenger | **document DELETED** (abandoned booking request) | none — does not appear | n/a (no driver assigned) |
| `accepted` / `driver_arriving` / `driver_arrived` | passenger or assigned driver | document **retained**; `status = 'cancelled'`, `cancelledAt`, `cancelledBy`, `cancelReason` written | appears in history | `activeTripId → null`, `availability → 'online'` (same transaction); `tripCount` **not** incremented |
| `in_progress` | — | **not allowed** | n/a | n/a |
| `completed` / `cancelled` | — | rejected (`CancelNotAllowedError`) | n/a | n/a |

### 13.2 Before driver acceptance (`request`)

- The trip document is **permanently deleted** in the same transaction (`tx.delete(tripRef)`).
- **No `cancelled` status is written** and **no `cancelReason` / `cancelledAt` is persisted** — there is no Firestore record left.
- **No trip history is created** — the history query (`status in ['completed','cancelled']`) cannot return it.
- This is treated as an **abandoned booking request**, not a "cancelled trip".
- Driver clients subscribed to the open-requests stream receive a **Firestore document-removal event** for the deleted doc.
- No driver doc is touched (no driver is assigned).
- Authorization (rules):
  - `allow update` for a passenger cancel is **only** valid from `accepted` / `driver_arriving` / `driver_arrived` — writing `status='cancelled'` against a `request` is rejected.
  - `allow delete` is permitted **only** when `request.auth.uid == resource.data.passengerId && resource.data.status == 'request' && resource.data.driverId == null`. This is the **only** delete path in the system.

### 13.3 After driver acceptance (`accepted` / `driver_arriving` / `driver_arrived`)

- Cancellation **no longer deletes** the document.
- The trip status becomes `'cancelled'`, and the document is retained for history.
- Driver availability is restored in the same transaction:
  - `drivers/{driverId}.activeTripId = null`
  - `drivers/{driverId}.availability = 'online'`
  - `tripCount` is **not** incremented (only completion increments).
- All cleanup logic remains transactional — passenger UI and driver UI converge atomically.

### 13.4 During the ride (`in_progress`)

- Cancellation is **not allowed**. `CANCELLABLE_STATUSES` excludes `in_progress`; `trip.service.cancel` throws `CancelNotAllowedError` and Firestore rules reject any `status='cancelled'` write from `in_progress`.
- Only **trip completion** is supported. Per the current implementation, **either the passenger or the assigned driver** may complete the trip (`in_progress → completed`); the rules permit both authors for this transition.

### 13.5 Rule surface (`firestore.rules`)

```
// Passenger may cancel-by-status-write ONLY post-acceptance:
allow update: if request.auth.uid == resource.data.passengerId
  && resource.data.status in ['accepted', 'driver_arriving', 'driver_arrived']
  && request.resource.data.status == 'cancelled'
  && request.resource.data.cancelledAt == request.time
  && request.resource.data.cancelledBy == 'passenger'
  && request.resource.data.cancelReason is string
  && ...;

// Pre-acceptance abandonment: the only permitted delete in the system.
allow delete: if request.auth.uid == resource.data.passengerId
  && resource.data.status == 'request'
  && resource.data.driverId == null;
```

### 13.6 Consequences for downstream surfaces

- **Trip history** (`history.service.listForPassenger`) — query unchanged (`status in ['completed','cancelled']`). Abandoned requests are simply absent.
- **Active-trip listener** (`useActiveTrip`) — a `request` cancel surfaces as a missing document → `clearTrip()` → passenger UI returns to the booking flow. No `CancelledSheet` is shown for an abandoned request.
- **Driver listeners** — observe a document-removal event for the open request and remove the corresponding incoming-request card.

---

*Source of truth: Figma booking flow + [requirements.md](./requirements.md) §1.1. Pricing requirements (§1.2, Appendix A) are explicitly out of scope for Phase 12 — see §11. Companion specs: [architecture.md](./architecture.md) · [database_schema.md](./database_schema.md) · [design_system.md](./design_system.md).*
