# Pakyaw — UI Behavior

Interactive behavior, states, transitions, and validation rules inferred from the Figma screens and Blueprint logic. Behaviors visible in the mockups are stated as fact; behaviors inferred from convention or the Blueprint are marked **[ASSUMPTION]**; unknowns are **[GAP]**.

---

## 1. Global Behaviors

### 1.1 Navigation
- **Back button** (circular, top-left) returns to the previous screen in a flow; present on all multi-step and detail screens.
- **Bottom tabs** switch top-level sections without losing booking state. **[ASSUMPTION]** Active section persists per tab.
- **"Skip"** on carousels jumps to the end/auth choice without completing intro.
- **Carousel:** swipe or "Next" advances; pager dots reflect position; final slide CTA changes ("Next" → "Continue to sign up" / "Let's get started" / "Let's register your fleet").

### 1.2 Primary button enable/disable
- Primary CTA is **disabled (flat grey)** until the screen's requirements are met, then becomes a saturated gradient.
  - Sign-up Step 1: disabled until valid email + password (≥6 chars).
  - Sign-up Step 2: CTA "Verify phone to continue" stays disabled until the phone is verified.
  - **[ASSUMPTION]** Same pattern applies to all form steps (continue gated on required fields).

### 1.3 Theming
- Three fixed theme contexts (passenger dark/blue, driver light blue/green, fleet light violet). Passenger account exposes **Appearance** ("Always dark") — **[ASSUMPTION]** light/dark toggle exists for passenger; default shown is dark.
- **[GAP]** Whether driver/fleet themes are user-switchable is unspecified.

### 1.4 Localization
- Mixed English + Cebuano microcopy appears statically. Account → **Language** ("English") implies switchable locale. **[ASSUMPTION]** Strings are localizable; no live language switch is demonstrated.

---

## 2. Authentication & Onboarding Behaviors

### 2.1 Phone verification (passenger)
- Tapping **"Send code"** transitions the field group to reveal a 6-digit code input + **"Verify"** and starts a **resend countdown** ("27s" → 0). **[ASSUMPTION]** "Send code" re-enables when countdown hits 0.
- Helper text confirms dispatch ("Code sent via SMS"). On successful verify, the gating CTA enables.
- **[GAP]** Error states (wrong/expired code, resend limit) not shown.

### 2.2 Driver PIN / biometric
- 4-box PIN; **[ASSUMPTION]** auto-advances between boxes and auto-submits on the 4th digit, or via "Sign in."
- **"Use biometric"** triggers device biometric prompt. **"Forgot PIN?"** → recovery (**[GAP]** flow not shown).
- Demo affordance: driver onboarding accepts code **"1234"** as a demo OTP.

### 2.3 Multi-step forms (sign-up / driver application / fleet registration)
- Progress shown as "STEP n OF m" / "n/6" + animated segmented bar.
- Back preserves entered data **[ASSUMPTION]**.
- **Review screens** are read-only summaries gating final submission ("Create my account", "Submit application", "I agree, submit").
- **Selection cards** behave as single-select radios (one highlighted at a time): discount tier, payout method, legal structure, vehicle type.

### 2.4 Document upload (driver & fleet)
- Upload tile cycles: **empty (dashed + upload icon)** → uploading **[ASSUMPTION]** → **verified** (green check, "Looks great," extracted fields like license no./expiry, OR/CR no.).
- Server-side checks declared: "sharpness, expiry, and name match." Failing a check **[ASSUMPTION]** reverts the tile to an error state — **[GAP]** error UI not shown.
- 4-angle vehicle photos must each be captured; counter "0 of 5 vehicles declared" / "3 of 3 uploaded" tracks completion.
- Background-check consent is a required checkbox before submit.

### 2.5 Application review status
- After submit, a **status tracker** shows Document review → Background check → Approval as check/active/pending nodes. **[ASSUMPTION]** nodes update live/async as backend progresses; approval notified via email + SMS ("We'll text/email you the moment you're live").
- "Preview the driver app" lets a pending driver explore in demo mode.

---

## 3. Passenger Ride Booking Behaviors

### 3.1 Destination search
- Typing/selecting a destination expands the **fare bottom sheet**. **VOICE** triggers speech-to-text search **[ASSUMPTION]**.
- Home shows live supply ("14 drivers within 1km", "AVG PICKUP 3 min") — **[ASSUMPTION]** refreshes periodically.

### 3.1.1 Set Pickup — "Use Current Location" (Phase 12)
- When the pickup sheet (`SetDestinationSheet` rendered in `mode === 'pickup'`) opens, a leading **"Use Current Location"** row appears above Saved / Recent / Suggested. Icon: `location.fill`; sublabel: "Detect via GPS".
- Tap behavior:
  1. Checks foreground location permission. If undetermined or askable, requests it; if permanently denied, alerts the user to enable it in device settings.
  2. Resolves the device position via `expo-location` (`getCurrentPositionAsync`, balanced accuracy), then reverse-geocodes it to a `Place`.
  3. If the resolved place is **inside Ormoc**, sets it as pickup with `source: 'current-location'`. Otherwise alerts: **"Service is currently available only within Ormoc City."** and does not set pickup.
- During detection the row shows an inline spinner and is disabled to prevent double-trigger; on failure (no GPS fix, network error) it alerts: "Could not resolve your current location. Please try again or search for a location."

### 3.1.2 Minimum trip distance — "Too close" gating (Phase 12)
- As soon as the route resolves with `route.distanceMeters < 50`, the booking sheet:
  1. Renders the destination row in its invalid treatment (red accent / warning icon).
  2. Shows the inline message **"Pickup and destination are too close."** directly beneath the route distance/ETA chip.
  3. Disables the Confirm button.
- The polyline, distance, and ETA **continue to render** in the too-close state so the user understands the cause — the sub-50 m value is what the message is referring to.
- The check is always against the **routed distance** returned by the Directions API; the UI does **not** compare latitude/longitude between pickup and destination (which would falsely allow same-place bookings that snap to slightly different coordinates, and falsely reject genuinely different addresses metres apart in GPS).
- Adjusting either endpoint (drag, drop-pin, search, or "Use current location") refetches the route; once the new distance ≥ 50 m the warning clears and Confirm re-enables.

### 3.2 Fare sheet — mode toggle
- **"Pakyaw (Solo)" ↔ "Share Route"** segmented toggle swaps the pricing model and the options shown:
  - **Solo:** passenger-boarding stepper, Special trip, Lots of luggage, Privilege discount; breakdown shows base buyout × seats + surcharge + ₱15 convenience fee.
  - **Share:** "Split Pakyaw buyout · 1/1 share", "Carpool fills at 4 seats", per-passenger price, "Min 3 seats before dispatch."
- Switching modes recomputes the total and the Confirm button label in real time.

### 3.3 Stepper & toggles recompute fare live
- **Passengers boarding stepper:** minimum is the **4-seat floor**; increasing headcount scales the base buyout up to **6 seats**. Decrement disabled below floor **[ASSUMPTION]**.
- **Special trip** toggle adds +₱5 surcharge line.
- **Lots of luggage** toggle forces **full 6-seat buyout** ("Heavy luggage · full-vehicle buyout (6 seats)").
- **Privilege discount** toggle applies 20% to the base fare and updates totals (destination header shows discounted value, e.g., "₱12.00 (₱9.60 disc.)").
- Each change updates the "HOW THIS IS CALCULATED" rows, total, and driver-net/platform split instantly.

### 3.4 Pickup point
- **Smart/Virtual pickup** shown with **"CHANGE"**; in Share mode it's a **Virtual Stop** (landmark), in Solo a smart pickup. **[GAP]** pickup-picker screen not shown.

### 3.5 Payment selection
- Cash/method selector adjacent to Confirm; **[ASSUMPTION]** opens the payment-method list (from wallet) to switch method before confirming.

### 3.6 Confirm → dispatch state machine & Live Map Interactions
1. **Confirm** → "Finding your ride… / Reserving the whole vehicle" with a **Cancel request** option.
2. **Driver matched** → driver card appears ("Driver matched" pill, "Your driver is on the way") and a **Cancel ride** option.
3. **En route / Arriving** → ETA + distance + horizontal stepper (Driver assigned · En route · Arriving); controls **Share trip / SOS / End trip** + chat/call.
4. **Interactive Map Integration:** Both passenger and driver interfaces display a native interactive map (`LiveMap.tsx`). It visualizes custom thematic markers for the pickup point, destination, driver's live location, and the user's own location.
5. **Marker Key Re-mounting Fix:** To prevent a native rendering bug in `react-native-maps` where custom marker views would disappear when transitioning from draggable (booking phase) to non-draggable (active trip phase) on the passenger side, the marker keys for both pickup and destination are dynamically set to include their draggable status, forcing a complete native re-mount when the trip status transitions.
6. **Camera Auto-Fitting & Insets:** The map camera dynamically centers and fits all active coordinates via `fitToCoordinates`. To prevent the floating bottom sheets and status cards from obscuring markers, a bottom margin inset of `320px` is applied to the camera bounds.
6. **Passenger Action Sheets & Manual Transitions:** 
   - During `searching`, `accepted`, `driver_arriving`, or `driver_arrived` states, a floating status card is rendered. The passenger can tap a **"Cancel Request"** or **"Cancel Ride"** button to abort.
   - During `in_progress` (in-trip) state, the card renders the "Ride in progress" status without any action buttons. **Cancellation is not available once the trip is `in_progress`** — only completion (by passenger or driver).
   - Tapping a cancellation button triggers an atomic Firestore transaction whose effect depends on the lifecycle stage:
     - **`request` (pre-acceptance):** the trip document is **deleted** (abandoned request). No `cancelled` status is written, nothing enters history, and the passenger returns to the booking flow. No driver is involved.
     - **`accepted` / `driver_arriving` / `driver_arrived` (post-acceptance):** the trip status is set to `cancelled` (document retained), the matched driver's availability is reset to `online`, and the driver's `activeTripId` is cleared.
   - Buttons dynamically show loading indicators and disable themselves during transitions to prevent double-triggering.

- **Cancel behavior:** The passenger can cancel any time **before the trip starts** — a pre-acceptance `request` cancel deletes the booking, while a post-acceptance cancel marks it `cancelled`. Once `in_progress`, cancellation is disabled and only completion remains.
- **Share path:** enters batching epoch; if not filled in 3 min → fallback prompt (keep waiting / upgrade to Solo). **[GAP]** prompt screen not shown.

### 3.7 SOS
- One-tap; **[ASSUMPTION]** opens confirm then transmits GPS, creates incident ticket, alerts ops, notifies emergency contact (Blueprint §11C). Available to passenger and driver. **[GAP]** active-SOS UI not shown.

### 3.8 In-trip anti-leakage (Share)
- Seat counter "X of 6" visible; **"Report Seat Abuse"** triggers fee refund + driver incentive dock (Blueprint §5B). **[GAP]** no UI in Figma.

---

## 4. Driver Operational Behaviors

### 4.1 Go online (pre-flight)
- Tapping the **power button** opens the **"Ready to roll?"** checklist over a dimmed map. All six checks must be satisfied (license, OR/CR, TPL insurance, selfie, active vehicle, operator status) before **"Go online"** is actionable. **"Not yet"** dismisses.
- **[ASSUMPTION]** A failed check blocks going online and links to remediation; QR vehicle-pairing scan happens here (Blueprint §5C) — **[GAP]** not shown.

### 4.2 Online & Active Trip States (Operational Transitions)
- Status pill flips Offline → **Online**; a **shift timer** starts ("Online · 1m"); today's earnings sheet updates; map shows **Hot/Busy** demand heat.
- **Operational Stepper Sheets:** Once matched to a trip (`on_trip` availability), the driver's bottom sheet area switches to status-driven lifecycle sheets:
  - **DriverAcceptedSheet (`accepted`):** Shows pickup/destination names and passenger headcount. Renders a **"Start Navigation"** button, which transitions the trip to `driver_arriving`.
  - **DriverEnRouteSheet (`driver_arriving`):** Displays a live path polyline to the pickup point, ETA, and an **"Arrived at Pickup"** button. Tapping it transitions the trip to `driver_arrived`. 
    - **Driver → Pickup Navigation Polyline:** In `accepted` and `driver_arriving` statuses, the map displays a solid **Violet** (`colors.violet.primary`) route polyline, or a dashed violet straight line fallback. In Phase 12 this route was UI-only; the **Navigation Experience phase supersedes that** — the driver publishes it to `trip.driverRoute` so the passenger renders the exact road route from Firestore (no passenger routing; Distance Matrix retired). Directions requests stay throttled on the driver (moves $\ge 50$ m or every 25 s, plus off-route / phase-change triggers). See **[phase12_navigation_spec.md](./phase12_navigation_spec.md)**.
    - **Instant Cleanup:** Upon tapping `"Arrived at pickup"` (transitioning to `driver_arrived` status) or on cancellation/completion, both the routed violet polyline and the dashed fallback line disappear instantly from the map.
  - **DriverArrivedSheet (`driver_arrived`):** Informs the passenger of arrival and displays a **"Start Trip"** button. Tapping it transitions the trip to `in_progress`.
  - **DriverInTripSheet (`in_progress`):** Displays a route polyline towards the destination, passenger count, and an **"End Trip"** button. Tapping it completes the trip.
  - **Terminal sheets (`completed`/`cancelled`):** Let the driver tap "Done" / "Dismiss" to clear the active trip state and return safely to the Online screen.
- **Atomic State Transitions:** Completing or cancelling a trip invokes the backend transaction that updates the Trip, SharedRide membership when applicable, Driver active state, availability, and trip counter together.
- **UI Responsiveness:** All transition buttons disable and display loading spinner animations while mutations are pending.

### 4.3 Earnings & incentives
- Period tabs (Today/This week/This month) re-scope all figures.
- **Incentive progress bar** advances with completed trips toward a bonus, with a deadline ("Complete 3 more trips before 8 PM to unlock").
- Breakdown shows live composition incl. negative **service fee (15%)** in red.

### 4.4 Cash out
- **"Cash out"** opens payout-method selection; GCash (instant, free) vs bank (₱10 fee under ₱500). Selecting GCash reveals a GCash-mobile field → "Save payout." **[ASSUMPTION]** confirmation + pending state follows.

---

## 5. Fleet Console Behaviors

- **Dashboard** auto-refreshes KPIs and **Live trips** (In Trip/Pickup badges) **[ASSUMPTION]** real-time.
- **Drivers / Fleet** lists: search + filter chips (All/Online/Offline) filter rows live.
- **Vehicle cards** show QR-paired state + "scanned Xm ago" (updates on driver shift scan), registration expiry (color warns near expiry **[ASSUMPTION]**), and service mileage (amber when due — ties to maintenance alerts, Blueprint §7C).
- **Reports** items generate/export documents; **Filters** (date/driver/vehicle) scope outputs. **[GAP]** export format/states not shown.
- Registration steppers/sliders update declared counts live ("0 of 5 vehicles declared").

---

## 6. Cancellation, Timing & Governance Behaviors (Blueprint §10)

| Trigger | Timing | Behavior |
|---|---|---|
| Passenger cancel, pre-dispatch | ≤60 s | Free, ₱0 |
| Passenger cancel, driver en route | after free window | ₱10 fee (₱8 driver / ₱2 platform) |
| Passenger no-show | 5-min on-site timer → "No Passenger Present" | Share ₱10 / Solo ₱20, 80/20 split |
| Driver accidental accept | ≤30 s | No strike, returned to queue |
| Driver cancel en route | any | Strike + reliability drop + passenger priority rematch |
| Driver monthly cancel rate | rolling month | <5% none · 5–10% warning · 10–15% incentive cut · >15% suspension |
| Share pre-lock cancel | before 3-pax lock | No fee; matcher seeks replacement |
| Occupancy collapse | post-match, pre-dispatch | Remaining riders: keep waiting / upgrade Solo / cancel free |
| Surge conditions | rain/typhoon/fiesta/rush/holiday | Cancellation penalty +₱5–₱10, max ₱30 |

- Passenger cancellation in the ride UI is supported during searching (`request`) and matched (`accepted`, `driver_arriving`, `driver_arrived`) states. A `request` cancel **deletes** the trip (abandoned request); a matched-state cancel writes `status = 'cancelled'`. `in_progress` cannot be cancelled.
- **Note:** The fee/timing/governance table above is **deferred Blueprint context**, not implemented behavior. The MVP records only the *fact* of a (post-acceptance) cancellation — no fees, strikes, timers, or surge penalties exist in code.
- **[GAP]** Fee-confirmation dialogs and no-show timer UI are not in Figma.

---

## 7. Validation & Error Handling

- **Inline field validation** implied (password "At least 6 characters"; phone format "+63 917…"; plate/OR/CR matched to documents).
- **Disabled-until-valid** CTAs are the primary validation feedback shown.
- **Booking-flow business-rule validation (Phase 12)** is layered across UI / booking service / Firestore rules and currently covers two rules: **(a) Ormoc service area** (every endpoint must fall inside the bounds) and **(b) minimum trip distance** (`route.distanceMeters >= 50`). The UI surfaces the rule with an inline message and a disabled Confirm; the booking service re-asserts at submit (race protection); the Firestore create rule is the backstop a malicious client cannot bypass. The minimum-distance check is on the Directions-API routed distance, never on lat/lng equality. See [phase12_spec.md §1.5](./phase12_spec.md#15-minimum-trip-distance--50-m).
- **[GAP]** Explicit error messages, toasts, network-failure, retry, and offline behaviors are not depicted — define before build.

---

## 8. Real-Time & Async Behaviors (system-driven)

- Live map: driver pins, route polyline, ETA, and heat overlays update continuously.
- **3-minute Share epoch** countdown governs match/dispatch.
- GPS telemetry streamed for anomaly detection (Mismatched Stop >45 s, Path Deviation >150 m) → ops alerts (Blueprint §5A) — backend behavior, surfaces on admin (not in Figma).
- Notifications arrive async with unread state; "Mark all read" clears dots.
- **[GAP]** Reconnect/stale-data handling, optimistic UI, and push-notification behaviors unspecified.

---

## 9. Accessibility Behaviors ([ASSUMPTION] / [GAP])
- Voice search suggests audio input support.
- Large tap targets and high-contrast values are visually present.
- **[GAP]** Screen-reader labels, dynamic type, reduced-motion, and focus order are not specified.
