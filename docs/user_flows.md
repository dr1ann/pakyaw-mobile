# Pakyaw — User Flows

> **Historical / superseded source note:** older four-seat Solo and carpool
> wording in this archive is retained for traceability only. Current Pakyaw
> accepts 1–6 actual passengers and bills six seats; Shared Ride behavior is
> governed by the canonical backend configuration.

Derived from the Figma screens (`docs/figma/`) and the Blueprint operational logic. Each flow lists the screens involved (file names in `docs/figma/<role>/`), decision points, and system actions. **[ASSUMPTION]** / **[GAP]** mark inferred or missing steps.

Three apps:
- **Passenger app** — dark/blue gradient theme.
- **Driver app** — light theme, green "DRIVER" pill, blue/green accents.
- **Fleet Owner (Operator Console)** — light theme, violet/purple accent.

---

## 1. Passenger Flows

### 1.1 First-launch onboarding carousel → account choice
**Screens:** `homepage.png` → `homepage(1..3).png` → `homepage(4).png` → `homepage(5).png`

1. App opens to a 5-slide carousel (pager dots, "Skip" top-right, "Next" CTA):
   - Slide 1 "Ride instantly, around your city" (ANYWHERE IN ORMOC).
   - Slide 2 "Pakyaw private, or share to save" (TWO WAYS TO RIDE).
   - Slide 3 "Watch your driver appear in real time" (LIVE DRIVER TRACKING).
   - Slide 4 "Verified, rated and built for safety" (VERIFIED DRIVERS · SOS).
   - Slide 5 "Where do you usually go?" — optional saved-destination capture (add place name + address, or skip).
2. Final screen `homepage(5).png` "Welcome to Pakyaw": **Create an account** or **I already have an account**. Footer: Terms & Privacy consent.
3. **Decision:** new user → Sign-up (1.2); returning → Sign-in (1.3).

### 1.2 Passenger sign-up (4 steps)
**Screens:** `sign_up.png` (Step 1) → `sign_up(1).png` (Step 2) → `sign_up(1)-verify_phone_clicked.png` / `sign_up(3)...` (verify) → `sign_up(2).png` (Step 3) → `sign_up(3).png` (Step 4)

1. **Step 1 of 4 — Create your account:** email + password (≥6 chars). "Continue" disabled until valid (greyed in `sign_up.png`).
2. **Step 2 of 4 — Tell us about you:** first name, last name, mobile number with "Send code".
3. **Phone verification:** tapping "Send code" reveals a 6-digit code field + "Verify", a resend countdown ("27s"), helper "Code sent via SMS." CTA reads "Verify phone to continue" (disabled until verified).
4. **Step 3 of 4 — Discount eligibility:** choose Regular / Student / PWD / Senior Citizen. Discounted options show "–20%" badge + "ID required." Regular pre-selected.
5. **Step 4 of 4 — Review and create:** read-only summary (Name, Email, Phone, Rider type) → "Create my account."
6. System creates the account → lands on the live **Ride** home (1.4).
- **[GAP]** ID-upload step for discounted tiers isn't shown; account screen later says "Submit ID to unlock discount," implying ID verification happens post-signup.

### 1.3 Passenger sign-in
**Screen:** `sign_in.png`
1. "Welcome back" — email + password → "Sign in." Back arrow returns to welcome.
- **[GAP]** No forgot-password / social-login screen provided for passengers.

### 1.4 Booking a ride (core flow)
**Screens:** `ride_page.png` → `ride_page(searched a place to go).png` (+ variants) → `ride_page(confirmed_searching_for_available_riders).png` → `ride_page(rider_accepted_passenger).png` → `ride_page(arriving_at_destination).png`

> **Phase 12 — pickup / destination / minimum-trip-distance.** In the Phase 12 implementation the passenger:
> 1. Sets **pickup** via one of three entry points: (a) **"Use Current Location"** (GPS — top row of the pickup sheet), (b) search, or (c) manual map-pin (crosshair or drag). The resolved pickup must fall inside the Ormoc service area; out-of-area picks are rejected with "Service is currently available only within Ormoc City."
> 2. Sets **destination** via search or manual map-pin (crosshair or drag), same service-area gate.
> 3. The **Directions API** computes the route as soon as both endpoints exist; polyline, distance, and ETA render.
> 4. **Minimum trip distance check** — if `route.distanceMeters < 50`:
>    - the booking sheet shows the inline message **"Pickup and destination are too close."**,
>    - the destination row is visually marked invalid,
>    - the Confirm button is disabled,
>    - **no Firestore write is attempted**.
>    - The check uses the routed distance, **not** lat/lng equality. The user can adjust either endpoint; once the routed distance is ≥ 50 m the warning clears and Confirm re-enables.
> 5. Else: continue with the normal booking flow described below.

1. **Home / Ride (`ride_page.png`):** map with nearby driver pins; greeting "Where to, James?"; search field ("Schools · malls · barangays · landmarks") + VOICE; supply stats ("14 drivers within 1km", "AVG PICKUP 3 min"); bottom tab bar (Ride / Activity / Wallet / Account); map overlay controls (insights, layers, locate, etc.).
2. **Destination selected (`ride_page(searched a place to go).png`):** a fare sheet expands:
   - Trip header: From / To, distance · time · traffic ("3.4 km · 8 min · Light").
   - Destination barangay + ordinance zone + base tariff ("Brgy. San Isidro · ₱12.00").
   - **Mode toggle:** "Pakyaw (Solo)" vs "Share Route."
   - **Solo options:** Passengers boarding stepper (min 4-seat floor), "Special trip" toggle (+₱5), "Lots of luggage" (full 6-seat buyout), "Privilege discount" toggle.
   - **"HOW THIS IS CALCULATED"** breakdown rows (base buyout, surcharge, convenience fee, total, driver-net vs platform).
   - Smart/Virtual pickup point with "CHANGE."
   - Payment selector ("Cash") + **Confirm · ₱<total>**.
3. **Variants:**
   - `(1)` scrolled view exposing platform convenience fee (₱15), total (₱87.60), and vehicle options (Tricycle 4 MIN ₱88, Motorcycle/Multicab "Coming soon").
   - `(share route selected)` switches to Share: shows "Split Pakyaw buyout · 1/1 share", "Carpool fills at 4 seats · ₱0.00", per-passenger total, "Min 3 seats before dispatch."
   - `(all-checked)` Solo with Special trip + Lots of luggage + Privilege all on → "Heavy luggage · full-vehicle buyout (6 seats)."
4. **Confirm Solo (Searching Stage):** The map renders the pickup and destination points. The bottom card displays "Finding your ride… Reserving the whole vehicle." The passenger has a **"Cancel request"** button. Because no driver has accepted yet, tapping it **deletes the trip document outright** (an abandoned booking request) — no `cancelled` status is written and nothing is kept in history.
5. **Driver Matched (Accepted Stage):** The map renders the live driver marker at their starting position. The passenger card displays the "Driver matched" pill and "Your driver is on the way", and has a **"Cancel ride"** button.
6. **En Route / Arriving Stage:** As the driver approaches, the map updates their marker live. The passenger card shows "Driver en route" or "Driver has arrived" status, along with a **"Cancel ride"** button.
7. **In-Trip Stage:** Once the ride starts (`in_progress`), the passenger card updates to "Trip in progress." The map displays a route polyline towards the destination. **Cancellation is no longer available** — only trip completion (either the passenger or the driver may complete the trip per the current implementation).
8. **Completion / Cancellation Teardown (lifecycle-dependent, single Firestore transaction):**
   - **Cancel before acceptance (`request`):** the trip document is **deleted**. The passenger's active state clears and the UI returns to the booking flow. No driver is involved.
   - **Cancel after acceptance (`accepted`/`driver_arriving`/`driver_arrived`):** the trip status becomes `cancelled` (document retained), the assigned driver's availability and active-trip details are reset, and the passenger's local active state clears.
   - **Completion (`in_progress` → `completed`):** status set to `completed`, driver reset, `tripCount` incremented.
9. **Post-Trip Terminal Screen:** After **completion** or a **post-acceptance cancellation**, the passenger sees a terminal summary screen and can tap "Done" to dismiss it and return to the main Ride screen. An **abandoned `request`** shows no terminal screen — the deleted document simply returns the passenger to the booking flow.
- **[GAP]** Post-trip rating/receipt screen not in Figma (referenced by notifications "Tap to rate" and activity "View receipt").

### 1.5 Share-mode wait & fallback (Blueprint logic)
1. Passenger confirms Share → enters 3-minute batching epoch; UI shows "Min 3 seats before dispatch."
2. **If ≥3 matched on the corridor:** vehicle dispatched; seat counter "X of 6" displayed; "Do not pay for unlisted passengers."
3. **If timer expires < 3:** prompt "Your carpool line did not fill. Keep waiting, or upgrade to a Solo Pakyaw ride?"
4. **Occupancy collapse** (a matched passenger cancels before dispatch): remaining riders offered keep-waiting / upgrade-Solo / cancel-free.
- **[GAP]** These exact dialog screens aren't in Figma; behavior is from Blueprint §4 & §10C.

### 1.6 Report seat abuse (anti-leakage)
1. During active Share trip, passenger taps **"Report Seat Abuse."**
2. System refunds the reporter's convenience fee and docks the driver's weekly incentive score.
- **[GAP]** No dedicated screen; button referenced in Blueprint §5B.

### 1.7 Activity, Wallet, Account (passenger)
- **Activity (`activity_page.png`):** monthly Spent/Saved/Distance cards; Trips/Insights tabs; All/Pakyaw/Share filter chips; trip cards (driver, plate, mode badge, route, fare, discount, rating, distance, duration, payment, "View receipt").
- **Wallet (`wallet_page.png`):** balance card (Top up / Send / Pay); weekly-spend insight; payment-method list (Pakyaw Wallet default, GCash, BPI Debit, Cash) + "Add payment method"; active promos (PAKYAW20, WELCOME50).
- **Account (`account_page.png`, `account_page(1).png`):** profile card (avatar, trips/saved/rating, Edit); rider-type/discount row; Account section (Phone, Password & security/2FA, Payment methods, Saved places, Promotions); Preferences (Notifications, Language, Appearance, Help & support); **Log out**; version + member-since footer.
- **Notifications (`notifications.png`):** list with unread dots, category icons, timestamps, "Mark all read."

---

## 2. Driver Flows

### 2.1 Driver landing & entry
**Screen:** `homepage.png` (driver)
1. "Drive Pakyaw" value props (Drive on your time / Verified passengers only / Get paid daily).
2. CTAs: **I'm already a driver** (→ 2.2 login) or **Apply to drive** (→ 2.4 onboarding carousel/application).

### 2.2 Returning driver login
**Screens:** `clicked_already_a_driver.png` → `verify_phone.png`
1. "What's your mobile?" — +63 number → "Continue" (one-time code if needed). Footer "Trouble logging in? Get help."
2. **Enter your PIN** (4 boxes) → "Sign in"; "Use biometric"; "Forgot PIN?"

### 2.3 Pre-drive onboarding carousel
**Screens:** `clicked_apply_to_drive.png` → `clicked_apply_to_drive(1).png` → `clicked_apply_to_drive(2).png`
1. Step 1 of 3 "Drive on your time" (no quotas/shifts).
2. Step 2 of 3 "Safer for everyone" (identity-checked passengers, SOS).
3. Step 3 of 3 "Get paid daily" → **Let's get started** (→ 2.4).

### 2.4 Driver application (6 steps)
**Screens:** `clicked_lets_get_started.png` (Step 1) → `vehicle_selected.png` / `vehicle_info.png` (Step 2) → `vehicle_info(1).png`? see below → step ordering:

Progress bar shows N/6. Observed steps:
1. **1/6 — What will you drive?** Vehicle type grid: Motorcycle / Tricycle / Multicab / Sedan (`clicked_lets_get_started.png`).
2. **2/6 — Who are you?** Full name (as on license), mobile (+63), 6-digit code ("use 1234 for demo"), email (`vehicle_selected.png`, `vehicle_info(2).png`? — name/phone/code variant).
3. **3/6 — Tell us about your ride:** plate number, brand, model, year, color ("Match what's on your OR/CR") (`vehicle_info.png`).
4. **4/6 — Verify your papers:** driver's license front/back, OR & CR, vehicle photos (4 angles), selfie + background-check consent. States transition from upload to "Looks great"/checkmarks (`vehicle_info(1).png` empty → `vehicle_info(2).png` verified).
5. **5/6 — Where do we send your money?** GCash (instant, free) or Bank transfer (₱10 fee under ₱500) (`submit_for_review_clicked.png`).
6. **6/6 — Sign your driver agreement:** Driver ToS / Privacy & data use / Driver Code of Conduct, tap each to accept → **I agree, submit** (`driver_agreement.png`).
- **Note:** Figma file names don't cleanly map 1:1 to step numbers; see `screen_map.md` for the exact filename→screen reconciliation and **[GAP]** items.

### 2.5 Application review status
**Screen:** `status_page_after_applying_page.png`
1. "You're under review" — progress: Document review → Background check (NBI 1–2 days) → Approval & welcome kit. Approval window 24–48 hrs. CTA "Preview the driver app."

### 2.6 Going online (pre-flight) & Active driving operational flow
**Screens:** `drive_page(offline).png` → `clicked_online_buttton.png` → `drive_page(online).png`
1. **Offline (`drive_page(offline).png`):** map, STATUS "Offline", today's total (₱1,245), power button, bottom sheet "You're offline — tap the power button to start receiving requests." Tabs: Drive / Earnings / Wallet / Account.
2. **Tap power → pre-flight checklist (`clicked_online_buttton.png`):** "Ready to roll?" with six checks (license verified, OR/CR active, TPL insurance current, identity selfie matched, active vehicle selected, independent operator). CTAs: **Not yet** / **Go online**.
   - **[ASSUMPTION]** QR driver-vehicle pairing scan (Blueprint §5C) occurs here or at "active vehicle selected"; no scan screen is in Figma — **[GAP]**.
3. **Online (`drive_page(online).png`):** STATUS "Online", shift timer, earnings (₱1,245), Hot/Busy heat legend, locate button, today's earnings sheet.
4. **Matched Trip Dispatch & Acceptance:** The driver receives a full-bleed overlay of an incoming request. On tapping "Accept", their availability changes to `on_trip` and they enter the active trip stepper:
   - **Accepted State:** The map renders the driver's location and the pickup marker. The bottom sheet renders a **"Start Navigation"** button, which transitions the trip to `driver_arriving`.
   - **En Route State:** The map draws a route polyline towards the pickup point. The bottom sheet renders an **"Arrived at Pickup"** button, which transitions the trip to `driver_arrived`.
   - **Arrived State:** The map highlights the pickup point. The bottom sheet renders a **"Start Trip"** button, which transitions the trip to `in_progress`.
   - **In-Trip State:** The map renders a route polyline towards the destination point. The bottom sheet renders an **"End Trip"** button.
   - **Terminal Stage:** Once the driver or passenger taps "End Trip", a secure Firestore transaction completes the trip, resets the driver's availability to `online`, increments their `tripCount`, and displays a terminal success summary sheet. Tapping "Done" returns the driver to the Online screen.

### 2.7 Earnings & cash-out
**Screens:** `earnings_page.png` / `earnings_page(1).png` → `wallet_page.png` → `gcash_clicked.png`
1. **Earnings — Performance:** Today/This week/This month tabs; Net earnings card (₱1,245, +12% vs yesterday, 14 trips, ₱89 avg, online 6.5h, accept 96%, rating 4.92); Hourly earnings strip; Incentive progress ("₱200 bonus, 9 of 12 trips, 75%, complete 3 more before 8 PM"); Breakdown (Trip fares ₱934, Tips ₱100, Bonuses ₱62, Service fee 15% –₱187, Net ₱1,245).
2. **Wallet:** Available balance ₱3,287, earned-today; **Cash out** / History; Today/This week/Pending tallies; All/Earnings/Cashouts filter; recent transactions.
3. **Cash out (`gcash_clicked.png`):** choose GCash (selected, instant free) or Bank transfer; enter GCash mobile → "Save payout."

### 2.8 Driver account
**Screen:** `account_page.png` (driver)
- Profile (avatar RM, "Verified driver", rating/trips/accept); Vehicle card (Tricycle · TRC-1182, OR/CR verified, expiry); Documents (license/OR-CR/selfie/background — Verified/Cleared); "Switch to rider (demo)"; Log out.

---

## 3. Fleet Owner / Operator Console Flows

### 3.1 Console landing
**Screen:** `homepage.png` (fleet_owner)
1. "Run your fleet" value props (Real-time dispatch / Daily payouts / Vehicle compliance). CTAs: **Sign in to console** (→ 3.2) or **Register a new fleet** (→ 3.4). Footer "Pakyaw Operator Terms · LTFRB-aligned compliance."

### 3.2 Operator sign-in
**Screen:** `sign_in_page.png` (fleet_owner)
1. "Welcome back" — work email + password → "Continue"; "Need SSO? Contact support"; "Forgot password." Footnote: 2FA required on every device; fleet data end-to-end audited.

### 3.3 Console main tabs
**Screens:** `dashboard_page.png`, `drivers_page.png`, `fleet_page.png`, `reports_page.png` — bottom tabs: Home / Drivers / Fleet / Revenue / Reports.
1. **Home/Dashboard:** company name + avatar; Today's revenue (₱8,420 gross, +18%, weekly bar chart); KPI cards (Active drivers 12/18, Online vehicles 9/14, Active trips 3, Avg rating 4.84); Live trips list (driver, location, In Trip/Pickup badge).
2. **Drivers:** count, search, All/Online/Offline filters; driver rows (name, rating, trips today, vehicle, today's earnings).
3. **Fleet:** "7 vehicles"; status counts (QR Paired 3 / Idle 4 / Service 2); vehicle cards (plate, type, assignment, QR-paired + last scan, registration expiry, service mileage).
4. **Reports:** Exports & insights (Daily revenue summary, Weekly payout statement, Monthly P&L, Vehicle utilization, Driver performance); Filters (date range/driver/vehicle); "Switch to rider (demo)"; Log out.
- **[GAP]** The "Revenue" tab has no dedicated screenshot.

### 3.4 Register a new fleet (6 steps)
**Screens:** `clicked_register_a_new_fleet.png` (carousel 1/3) → `clicked_register_a_new_fleet(1).png` (2/3) → `clicked_register_a_new_fleet(2).png` (3/3) → `register_new_fleet_page.png` (1/6) → `register_new_fleet_page(1..6).png`

1. **Intro carousel (3 slides):** "List your fleet" / "Dispatch & dashboard" / "Operator-first payouts" → **Let's register your fleet.**
2. **1/6 — About your company:** company/trade name; legal structure (Sole proprietor / Corporation / Cooperative); owner full name, email, phone.
3. **2/6 — Fleet size:** "How many vehicles?" slider + presets (3/5/10/20/50).
4. **3/6 — Vehicle mix:** steppers for Motorcycle / Tricycle / Multicab counts ("0 of 5 vehicles declared").
5. **4/6 — Compliance documents:** upload DTI/SEC permit, BIR Form 2303, LTFRB franchise ("Encrypted in transit. Reviewed within 1 business day").
6. **5/6 — Payout method:** Bank account or GCash.
7. **6/6 — Agreements:** Operator ToS / 15% platform commission / Data & privacy policy → **I agree, continue.**
8. **Review and submit:** summary (Company, Owner, Fleet size, Documents X/Y uploaded, Payout) → **Submit application** (reviewed within 24 hrs; demo mode available while reviewing).

---

## 4. Cross-Role / System Flows (Blueprint-driven, mostly no dedicated UI)

- **QR street-hail onboarding (FR-1.3.7):** street passenger scans laminated QR → no-install web portal → enters drop-off → server backtracking/detour check → approve (show LGU fare + ₱5 fee, update manifest) or reject ("Route Mismatch").
- **Cancellation governance (FR-1.6.x):** state machine across passenger/driver actions and timers (60s / 30s / 5-min no-show), strikes, and monthly rate thresholds.
- **Trust & safety (FR-1.7.x):** report → auto case file (GPS, timestamps, IDs) → enforcement ladder; one-tap SOS; trust-score tiers (Gold/Silver/Standard/At-Risk); fraud flags → manual review.
- **GPS anomaly detection (FR-1.7.8):** Mismatched Stop (>45 s) and Path Deviation (>150 m) alerts to ops dashboard.
- **[GAP]** None of these system flows have passenger/driver/admin screens in the provided Figma; an **Admin/Operations dashboard** is referenced repeatedly but not designed.
