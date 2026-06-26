# Pakyaw Platform — Requirements

**Sources:** `docs/Corporate-Fare-Strategy-Technical-Realignment-and-Local-Operational-Blueprint-for-the-Pakyaw-Platform.pdf` (the "Blueprint") and `docs/figma/` screenshots (passenger, driver, fleet_owner).

**Scope note:** The Blueprint is primarily a business/investment and operations document. The Figma screens show three client apps: **Passenger**, **Driver**, and **Fleet Owner (Operator Console)**. Where the document and the designs disagree or one is silent, this is flagged.

**Firebase note:** The Blueprint mentions "Firebase hosting, optimized mapping APIs, and database syncing" only as a line item in the operating-cost table, and references a self-hosted "Headless Linux AI Server." Per instructions, **Firebase is treated as one possible implementation, not a requirement.** All requirements below are written technology-agnostically. Anything that names a specific technology is listed under [§4 Implementation-Specific Details](#4-implementation-specific-details).

**Assumption convention:** Lines beginning with **[ASSUMPTION]** are not stated in the source material and are inferred. **[GAP]** marks information that is missing and should be confirmed before build. **[DEFERRED]** marks features intentionally out of scope for the MVP (see §0). **[RESOLVED]** marks a previously open conflict that has been decided.

---

## 0. MVP Scope (finalized)

The current MVP is intentionally limited to the capabilities below. Everything else in this document is **retained for context** but marked **[DEFERRED]** and is out of scope for the MVP build. No requirements have been removed; numbering is preserved.

**In scope (MVP):**

1. **Authentication** — sign-up, sign-in, identity/role onboarding for **Passenger and Driver users only** (§1.1; Fleet Owner auth/registration FR-1.1.16–1.1.17 is **[DEFERRED]**).
2. **Driver availability** — online/offline and pre-flight checklist (§1.3.8–1.3.10).
3. **Booking** — destination selection and ride requests, including the Solo seat-reservation model (§1.3.1–1.3.3; §1.2.5 *seat model only*).
4. **Matching** — Solo dispatch and Share corridor matching (§1.3.3–1.3.4).
5. **Trip lifecycle** — live trip states from assignment to completion (§1.4).
6. **Trip history** — passenger trip activity/history view (§1.5.4–1.5.5).

**Deferred for MVP (per Q2 and scope decision):** Pricing / fare calculation, surcharges, discounts and **commission** (§1.2, except the seat model in FR-1.2.5); **wallet, earnings, payouts, tips, promos** (§1.5, except trip history); cancellation **fee governance** (§1.6); trust, safety & disputes (§1.7); notifications (§1.8); fleet owner console (§1.9); and ancillary revenue verticals (§1.10).

---

## 1. Functional Requirements (what the system must do)

### 1.1 Accounts, Roles & Onboarding

- **FR-1.1.1** The system shall support three distinct user roles: **Passenger**, **Driver**, and **Fleet Owner/Operator**. Each has its own app/console (separate Figma sets).
- **FR-1.1.2** Passengers shall register with email + password, then provide first name, last name, and mobile number. *(Figma: passenger sign_up steps 1–4.)*
- **FR-1.1.3** The system shall verify a passenger's mobile number via a 6-digit SMS code, with a resend countdown timer. *(Figma: "ENTER 6-DIGIT CODE", "27s" countdown, "Code sent via SMS".)*
- **FR-1.1.4** During passenger onboarding, the user shall declare a **discount eligibility / rider type**: Regular, Student, PWD, or Senior Citizen. Discounted types are 20% off and require ID submission. *(Figma: "Discount eligibility" step; Blueprint §2 mandates 20% privilege discount.)*
- **FR-1.1.5** The system shall present a review/confirmation screen summarizing name, email, phone, and rider type before creating the account.
- **FR-1.1.6** Passengers shall optionally save named destinations ("home, school, work") during onboarding and edit them later. *(Figma: "Where do you usually go?", Saved places.)*
- **FR-1.1.7** Drivers shall apply through a multi-step application (6 steps in Figma): select primary vehicle type → identity details → vehicle details → document upload → payout method → agreement acceptance.
- **FR-1.1.8** Drivers shall select a primary vehicle type from: **Motorcycle** (Solo / habal-habal), **Tricycle** (**6 seats** — see [RESOLVED] below), **Multicab** (Shared / 8 seats), **Sedan** (Comfort / 4 seats). More vehicles can be added later.
  - **[RESOLVED] (Q1)** Tricycle capacity is **6 seats**. The earlier Figma driver-onboarding "Up to 3 passengers" label is superseded; the Blueprint fare model and Figma passenger booking ("6 seats") are authoritative. The full seat-reservation/billing model is specified in FR-1.2.5.
- **FR-1.1.9** Drivers shall enter vehicle details matching their OR/CR: plate number, brand, model, year, color.
- **FR-1.1.10** Drivers shall upload verification documents: driver's license (front/back), vehicle OR and CR, four vehicle photo angles (front/back/left/right), and a selfie. The system shall capture explicit consent to a background check. *(Figma: "Verify your papers", "I consent to a background check … NBI clearance.")*
- **FR-1.1.11** The system shall validate uploaded documents for sharpness, expiry, and name match, and display per-document status (e.g., "Looks great", license expiry, OR/CR numbers). *(Figma checkmarks + "We'll check sharpness, expiry, and name match.")*
- **FR-1.1.12** Drivers shall choose a payout method (GCash or bank transfer) during onboarding.
- **FR-1.1.13** Drivers shall accept three agreements before submission: Driver Terms of Service, Privacy & data use, Driver Code of Conduct. *(Figma: "Sign your driver agreement".)*
- **FR-1.1.14** After submission, the system shall show an application **status screen** ("under review") with progress states: Document review → Background check → Approval & welcome kit, and an expected approval window (24–48 hours). *(Figma: status_page_after_applying.)*
- **FR-1.1.15** Returning drivers shall sign in with mobile number + a PIN, with optional biometric unlock and "Forgot PIN" recovery. *(Figma: "Enter your PIN", "Use biometric".)*
- **FR-1.1.16** Fleet Owners shall sign in to an Operator Console with work email + password, with "Forgot password" and SSO-support contact. *(Figma: fleet sign_in.)*
- **FR-1.1.17** Fleet Owners shall register a new fleet through a 6-step flow: company identity & legal structure (Sole proprietor / Corporation / Cooperative) → fleet size → vehicle mix counts → compliance document upload (DTI/SEC, BIR 2303, LTFRB franchise) → payout method → agreements. A review/submit screen ends the flow with a stated review window (24 hours). *(Figma: register_new_fleet 1–6.)*
- **FR-1.1.18 [ASSUMPTION]** A single person may hold more than one role (e.g., the Figma "Switch to rider (demo)" button on driver/fleet screens implies role switching). Confirm whether this is a real multi-role feature or demo-only.

### 1.2 Fare Calculation & Pricing — [DEFERRED] (Q2) except the seat model in FR-1.2.5

- **FR-1.2.1** The system shall compute passenger fares from the **official Ormoc zonal tariff (Ordinance No. 121, S. 2023)**, keyed on the destination barangay's zone. The full zonal schedule (Zones 1–4, regular and discounted rates) is in [Appendix A](#appendix-a-zonal-tariff-ordinance-no-121-s-2023).
- **FR-1.2.2** Base fare rules: PHP 10.00 flat for the first 2.5 km, +PHP 1.50 per succeeding km for regular passengers; privileged passengers (Senior/PWD/Student) pay the legislated **20% discount** (e.g., PHP 8.00 base). *(Blueprint §2A.)*
- **FR-1.2.3** The system shall apply surcharges:
  - **Special Trip:** +PHP 5.00 flat (trips beyond the usual route, e.g., into private subdivisions/properties).
  - **Night Trip (21:00–05:00):** +PHP 5.00 within 2.5 km radius, +PHP 10.00 outside it.
- **FR-1.2.4** The system shall support two ride modes: **Pakyaw (Solo/Exclusive)** and **Share (Carpool)**. *(Blueprint §1; Figma ride page toggle "Pakyaw (Solo)" / "Share Route".)*
- **FR-1.2.5 — Solo (Pakyaw) seat-reservation model. [RESOLVED] (Q1) — the seat model is IN SCOPE for the MVP; the fare math built on it is [DEFERRED] (Q2).**
  - **Seat model (IN SCOPE):**
    - A tricycle has a fixed capacity of **6 seats**.
    - A **Solo (Pakyaw)** booking reserves the **entire vehicle** — no other passengers may be matched to it.
    - **Billed seats** are derived from the passenger count: if `passengers` is **1–4**, billing uses a **minimum of 4 seats**; if `passengers` is **5–6**, billing uses the **actual occupied seats**. Equivalently, `billed_seats = clamp(passengers, 4, 6)`.
    - **Empty (unbilled) seats cannot be occupied by anyone else** — the reservation holds the whole vehicle regardless of how many seats are billed.
  - **Fare math (DEFERRED — see §0, Q2):** The monetary buyout computation that consumes `billed_seats` is out of scope for the MVP and retained here for context only:
    - Base Buyout Fare = `zonal_tariff(destination) × billed_seats`, plus applicable LGU surcharge.
    - The Base Buyout Fare is passed **100% to the driver**.
    - A separate, legally distinct **Platform Technology Convenience Fee** (flat **PHP 15.00**) is added. *(Blueprint §3.)*
    - Worked examples (Blueprint §3): 1 passenger to Camp Downes (₱10 regular) → 4-seat floor: ₱40 base + ₱5 special = ₱45 + ₱15 fee = **₱60 total**; 6 passengers → ₱60 base + ₱5 + ₱15 = **₱80 total**.
- **FR-1.2.6 — Share (Carpool) pricing:** Each Share passenger is quoted upfront = their own zonal base fare + a **shared tech fee** (≈ PHP 5.00 per passenger in Blueprint §4 example). *(Blueprint §4 use case: ₱11 base + ₱5 shared fee = ₱16 quoted.)*
  - **[GAP]** The Figma Share screen shows "Split Pakyaw buyout — 1/1 share" and a "₱0.00 Carpool fills at 4 seats" line with the same ₱87.60 total as Solo. The exact Share split formula as designed (per-head reduction as seats fill) is **not fully specified** and must be reconciled with the Blueprint's flat per-passenger model.
- **FR-1.2.7** The receipt/fare breakdown shall itemize: Base Buyout/base fare, surcharges (special/night), platform convenience fee, total fare, and the driver-net amount vs. platform amount. *(Figma: "HOW THIS IS CALCULATED", "Driver net ₱600 · Platform ₱600" style rows.)*
- **FR-1.2.8 [DEFERRED] (Q2)** The platform shall take a configurable commission. **Commission is deferred for the MVP** (see §0). Documented values remain inconsistent and are retained for context only, to be reconciled when pricing is brought back into scope:
  - Blueprint §7: "15% commission" headline.
  - Blueprint §9 revenue model: 40% or 60% **platform share of the ₱15 tech fee**.
  - Figma driver agreement: "Service fee 15%."
  - **[GAP]** Confirm the canonical commission model (flat % of fare vs. % share of the convenience fee) — to be resolved post-MVP.
- **FR-1.2.9** The system shall display privilege discounts as a toggle on the fare screen and reflect the discounted total when enabled. *(Figma: "Privilege discount … 20% off base fare" toggle.)*
- **FR-1.2.10** The fare screen shall support add-ons that affect price: **Special trip** (door-to-door/private property, +₱5) and **Lots of luggage** (full vehicle buyout / 6 seats). *(Figma toggles.)*
- **FR-1.2.11** The booking screen shall display trip context: distance, estimated time, and traffic level. *(Figma: "3.4 km · 8 min · Light".)*
- **FR-1.2.12** The system shall present an upfront, non-negotiable total fare before the passenger confirms. *(Blueprint anti-overcharging goal; Figma "Confirm · ₱78.00".)*

### 1.3 Booking, Matching & Dispatch

> **MVP scope (per §0):** Destination search & ride requests (FR-1.3.1–1.3.2), Solo dispatch and Share corridor matching (FR-1.3.3–1.3.4), and driver availability / going online (FR-1.3.8–1.3.10) are **IN SCOPE**. **[DEFERRED] (§0):** Share seat-count / anti-leakage display (FR-1.3.5), Report Seat Abuse (FR-1.3.6), and QR street-hail onboarding (FR-1.3.7) are out of scope for the MVP and retained for context only. FR-1.3.11 (driver incoming-request handling) is required for matching/dispatch but remains an open **[GAP]** (no design provided).

- **FR-1.3.1** Passengers shall search/select a destination (by place name, mall, barangay, or landmark), with optional voice input. *(Figma home: "Search destination … Schools · malls · barangays · landmarks", "VOICE".)*
- **FR-1.3.2** The home screen shall show live supply context: nearby drivers within 1 km and average pickup time. *(Figma: "14 drivers within 1km", "AVG PICKUP 3 min".)*
- **FR-1.3.3 — Solo dispatch:** On confirming a Solo ride the system shall search for an available driver and show a "Finding your ride… / Reserving the whole vehicle" state, then a matched driver (name, rating, trip count, vehicle, plate). *(Figma ride states.)*
- **FR-1.3.4 — Share matching (TODA-Zoned Virtual Corridor Stop Heuristic):** The Share-mode matcher shall:
  - **(a)** Batch requests into a **3-minute epoch** ("Spatio-Temporal Epoch Queue").
  - **(b)** Plot a straight linear corridor route toward the destination with **zero backtracking**.
  - **(c)** Restrict pickups/drop-offs to pre-approved **Virtual Stops** (barangay landmarks); passengers walk a short distance (under 200 m) to a stop.
  - **(d)** Enforce a **passenger walking radius** and a **driver detour radius** (perpendicular deviation cap). *(Specific meter values are rendered as missing math placeholders in the PDF — see [GAP].)*
  - **(e)** Prevent opposite-coast matching (e.g., Camp Downes vs. Punta).
  - **(f)** **Occupancy Lock:** not dispatch a vehicle until **≥3 passengers** on the same corridor are matched.
  - **(g)** **Zero-Bleed Fallback:** if the 3-minute timer expires before 3 passengers match, dispatch nothing and prompt the passenger to keep waiting or upgrade to Solo.
  - **[GAP]** Numeric values for passenger walking radius, driver detour radius, and the search-radius constraint did not render in the PDF (math/image placeholders). The Blueprint text says walking is "under 200 meters." Confirm exact thresholds.
- **FR-1.3.5** The Share passenger app shall display the live registered seat count and an anti-leakage notice: "Your ride is pooled. Current seats booked: 3 of 6. Do not pay for unlisted passengers."
- **FR-1.3.6** During an active Share trip, passengers shall have a **"Report Seat Abuse"** action; triggering it shall refund the reporter's convenience fee and dock the driver's weekly incentive score. *(Blueprint §5B.)*
- **FR-1.3.7 — QR street-hail onboarding:** A street passenger shall be able to scan a vehicle's laminated QR code to open a lightweight, no-download web booking portal. The server shall run a compatibility check against the driver's active trajectory:
  - **Backtracking constraint:** new drop-off must not force the driver to revisit nodes already passed.
  - **Detour constraint:** new drop-off must add **< 180 seconds** to existing passengers' ETA.
  - If approved: register the passenger (for safety/insurance), show the exact LGU zonal fare + a flat **PHP 5.00** convenience fee, update the driver manifest, capture commission. If rejected: block and notify the driver ("Route Mismatch… Booking rejected to preserve existing passenger ETAs"). *(Blueprint §6.)*
- **FR-1.3.8 — QR driver-vehicle pairing:** At shift start, a driver shall scan the vehicle's QR sticker to go online; this locks the driver's profile and license to that vehicle for the shift. *(Blueprint §5C.)*
- **FR-1.3.9** Drivers shall toggle Online/Offline. Going online requires passing a pre-flight safety checklist (license verified, OR/CR active, TPL insurance current, identity selfie matched, active vehicle selected, operator affiliation). *(Figma: "Ready to roll?" checklist + "Go online".)*
- **FR-1.3.10** The driver map shall show demand context (heat/busy zones) and the driver's location. *(Figma online map: "Hot / Busy" legend.)*
- **FR-1.3.11 [ASSUMPTION]** Drivers receive incoming ride requests with accept/decline and can navigate to pickup. *(Implied by accept-rate metrics and cancellation rules; no explicit request-card screen is in the Figma set.)* — **[GAP]** no driver "incoming request" or in-trip navigation screen was provided.

### 1.4 Live Trip Experience

- **FR-1.4.1** Passengers shall see a live map of the assigned driver approaching, with ETA and remaining distance. *(Figma: "ARRIVING IN 1 min", "1.4 km".)*
- **FR-1.4.2** The trip shall progress through visible states: Driver assigned → En route → Arriving/Arrived. *(Figma stepper.)*
- **FR-1.4.3** Passengers shall be able to contact the driver (call/message), **share the trip**, trigger **SOS**, and **end trip**. *(Figma ride controls: "Share trip", "SOS", "End trip", chat/call icons.)*
- **FR-1.4.4** A free-cancellation countdown shall be shown after booking ("Cancel · free 1:59" decreasing). *(Figma.)*
- **FR-1.4.5 — One-Tap SOS:** Both passengers and drivers shall have a one-tap SOS that transmits live GPS, generates an emergency incident ticket, alerts the operations dashboard, and notifies an emergency contact. *(Blueprint §11C.)*
- **FR-1.4.6** On arrival for pickup, the system shall start a **5-minute no-show countdown**; on expiry the ride is marked "No Passenger Present." *(Blueprint §10A Scenario 3.)*

### 1.5 Payments, Wallet & Earnings — [DEFERRED] (Q2) except trip history (FR-1.5.4–1.5.5)

> **[DEFERRED] (Q2):** Wallet, top-up/send/pay, promos/vouchers, driver earnings, cash-out/payouts, tips, and incentive bonuses are out of scope for the MVP (see §0). **Trip activity/history (FR-1.5.4–FR-1.5.5) is IN SCOPE.** The remaining requirements are retained for context only.

- **FR-1.5.1** Passengers shall pay via multiple methods: **Pakyaw Wallet** (default), **GCash**, bank/debit card, or **Cash** (pay the driver). *(Figma wallet + ride "Cash" selector.)*
- **FR-1.5.2** The passenger wallet shall show available balance, top-up, send, and pay actions, weekly spend insight, linked payment methods, and active promos. *(Figma wallet_page.)*
- **FR-1.5.3** The system shall support **promo codes / vouchers** (e.g., PAKYAW20 "20% OFF Share Ride", WELCOME50 "₱50 OFF First Ride"). *(Figma.)*
- **FR-1.5.4** Passengers shall view **trip activity/history** with per-trip detail: date/time, driver, plate, mode (Pakyaw/Share), origin→destination, fare, discount applied, rating, distance, duration, payment method, and a "View receipt" link. *(Figma activity_page.)*
- **FR-1.5.5** The activity screen shall summarize monthly Spent, Saved (discounts + share), and Distance, with a Trips/Insights tab and filters (All / Pakyaw / Share). *(Figma.)*
- **FR-1.5.6** Drivers shall have a **wallet** showing available balance, earned-today, **Cash out**, history, and today/this-week/pending tallies, plus recent transactions (per-trip credits, cashouts, incentives). *(Figma driver wallet_page.)*
- **FR-1.5.7** Drivers shall cash out to **GCash** (instant, free) or **bank transfer** (₱10 fee for transfers under ₱500); payouts are **daily**. *(Figma "Where do we send your money?"; Blueprint freemium notes daily payouts.)*
- **FR-1.5.8** The driver **earnings** screen shall show net earnings, trip count, average per trip, online hours, acceptance rate, rating, an hourly-earnings heat strip, incentive progress (e.g., "Incentive ₱200 bonus, 9 of 12 trips, 75%"), and a breakdown (trip fares, tips, bonuses, service fee deduction, net). Period tabs: Today / This week / This month. *(Figma earnings_page.)*
- **FR-1.5.9** The system shall support driver **tips** and **incentive bonuses** (e.g., peak-hour, complete-N-trips). *(Figma breakdown + Blueprint incentives.)*
- **FR-1.5.10** Receipts shall display merchant referral coupons when the drop-off is a partner establishment ("Pakyaw Perks", e.g., "10% off at 88 Café"). *(Blueprint §7A.)* — **[GAP]** not shown in Figma; flag as Blueprint-only.

### 1.6 Cancellations (Governance) — [DEFERRED] (per §0)

> **[DEFERRED] (Q2 / §0):** Cancellation **fee governance** is out of scope for the MVP. All FR-1.6.x requirements are retained for context only. (The free-cancellation countdown as a trip state lives in the trip lifecycle at FR-1.4.4 and is IN SCOPE; the fee/penalty/strike governance below is what is deferred.)

*(Blueprint §10. All fees in PHP.)*

- **FR-1.6.1** Passenger cancellation within **60 seconds** (driver not yet en route): free, ₱0, driver uncompensated.
- **FR-1.6.2** Passenger cancellation after driver is en route: **₱10** fee (₱8 to driver, ₱2 platform).
- **FR-1.6.3** Passenger no-show (after 5-min timer): Share **₱10**, Solo **₱20**; split 80% driver / 20% platform.
- **FR-1.6.4** Driver cancellation within **30 seconds** of accidental accept: no strike, no penalty, booking returned to queue.
- **FR-1.6.5** Driver cancellation while en route: automatic **strike**, passenger gets priority rematch, driver reliability score reduced.
- **FR-1.6.6** Monthly driver cancellation-rate enforcement: <5% none; 5–10% warning; 10–15% incentive reduction; >15% temporary suspension.
- **FR-1.6.7** Share-mode: a passenger cancelling **before** occupancy lock incurs no fee; the matcher seeks a replacement. If occupancy then falls below the 3-passenger threshold, remaining passengers are offered: keep waiting / upgrade to Solo / cancel free.
- **FR-1.6.8 — Dynamic cancellation risk pricing:** During abnormal demand (heavy rain, typhoon, fiesta, rush hour, holidays) cancellation penalties may rise by ₱5–₱10, capped at a **maximum ₱30**.

### 1.7 Trust, Safety & Disputes — [DEFERRED] (per §0)

> **[DEFERRED] (§0):** Trust, safety & disputes are out of scope for the MVP. All FR-1.7.x requirements are retained for context only. (One-Tap SOS lives in the trip lifecycle at FR-1.4.5 and is IN SCOPE; the reporting, reputation, fraud, and GPS-anomaly systems below are deferred.)

*(Blueprint §11.)*

- **FR-1.7.1** Passengers may file incident reports up to **72 hours** after ride completion; each report auto-generates a case file with GPS route history, pickup/drop-off coordinates, timestamps, driver ID, and a statement.
- **FR-1.7.2** Fare-manipulation enforcement ladder: 1st offense warning → 2nd 7-day suspension → 3rd permanent removal.
- **FR-1.7.3** Reckless-driving reports trigger a safety review, possible temporary restriction, and mandatory safety orientation.
- **FR-1.7.4** Harassment/intimidation reports put the account into "Safety Review Status" with outcomes: warning / temporary suspension / permanent ban / referral to authorities.
- **FR-1.7.5** Drivers may report passengers: non-payment (account flagged, outstanding balance attached, repeat = removal), harassment, and vehicle/property damage (photo evidence, possible reimbursement).
- **FR-1.7.6 — Reputation system:** Every completed ride updates a **trust score (0–100)** for both passengers and drivers.
  - Passenger factors: no-show frequency, payment disputes, cancellation behavior, verified complaints.
  - Driver factors: acceptance rate, cancellation rate, safety incidents, ratings.
  - Tiers: 90–100 Gold, 75–89 Silver, 60–74 Standard, <60 At-Risk. Higher tiers get priority matching, promo incentives, faster support.
- **FR-1.7.7 — Fraud detection:** The platform shall flag repeated false reporting, excessive cancellations, GPS inconsistencies, multi-account creation, coordinated fare manipulation, and ride-completion anomalies; flagged accounts go to manual review before enforcement.
- **FR-1.7.8 — GPS anomaly detection (anti-leakage):** Monitor real-time driver GPS to flag a **"Mismatched Stop"** (stop > 45 s at a non-pickup coordinate) and a **"Path Deviation Anomaly"** (deviation > 150 m from the assigned route vector). Alerts surface on an admin/operations dashboard.

### 1.8 Notifications — [DEFERRED] (per §0)

> **[DEFERRED] (§0):** Notifications are out of scope for the MVP. All FR-1.8.x requirements are retained for context only.

- **FR-1.8.1** The system shall deliver in-app notifications for: driver arrival, promo unlocks, trip receipts, weather/surge heads-up, and onboarding/welcome. *(Figma notifications.)*
- **FR-1.8.2** Notifications shall show read/unread state and support "Mark all read."
- **FR-1.8.3** Passengers shall configure notification categories (trip / promo / alerts). *(Figma account preferences.)*

### 1.9 Fleet Owner / Operator Console — [DEFERRED] (per §0)

> **[DEFERRED] (§0):** The Fleet Owner / Operator Console is out of scope for the MVP. All FR-1.9.x requirements are retained for context only. (Note: fleet-owner authentication & registration, FR-1.1.16–1.1.17, sit under Auth §1.1 — confirm whether they ship with the MVP auth slice or are deferred alongside the console.)

- **FR-1.9.1** The console shall show a fleet dashboard: today's gross revenue with a weekly bar chart, active drivers (e.g., 12/18), online vehicles (9/14), active trips, and average rating. *(Figma dashboard_page.)*
- **FR-1.9.2** The console shall show **live trips** with driver, location, and status (In Trip / Pickup). *(Figma.)*
- **FR-1.9.3** The console shall list **drivers** with search and All/Online/Offline filters; each row shows name, rating, trips today, assigned vehicle, and today's earnings. *(Figma drivers_page.)*
- **FR-1.9.4** The console shall list **vehicles** with status counts (QR Paired / Idle / Service) and per-vehicle cards: plate, type, assignment/driver, QR-paired state + last scan time, registration expiry, and service mileage. *(Figma fleet_page.)*
- **FR-1.9.5** The console shall generate **reports/exports**: daily revenue summary, weekly payout statement, monthly P&L, vehicle utilization, driver performance, with filters by date range / driver / vehicle. *(Figma reports_page.)*
- **FR-1.9.6** Fleet owners shall register OR/CR and MTOP franchise per vehicle once, generating a unique high-security **QR code** for printing as a weatherproof sticker. *(Blueprint §5C.)*
- **FR-1.9.7 — Maintenance alerts:** The console shall raise automated maintenance alerts based on mileage (e.g., "Tricycle #4 has traveled 1,000 km this month; time for an oil change"). *(Blueprint §7C; premium tier.)*
- **FR-1.9.8 — Boundary logging:** The console shall support automated daily "boundary" logging and driver-shift tracking. *(Blueprint §7C.)*
- **FR-1.9.9 — SaaS tiering:** Basic live tracking is free; advanced features (maintenance alerts, automated boundary logging, B2B logistics access) require a **₱499/month** subscription per fleet. *(Blueprint §7C.)*

### 1.10 Ancillary Revenue Verticals (Blueprint-only; not in Figma) — [DEFERRED] (per §0)

> **[DEFERRED] (§0):** Ancillary revenue verticals are out of scope for the MVP. All FR-1.10.x requirements are retained for context only.

- **FR-1.10.1 — Pakyaw Perks (merchant referrals):** Generate a digital coupon on the receipt when drop-off is a partner establishment; charge the merchant a ₱20–₱50 lead-generation fee per delivered customer. *(Blueprint §7A.)*
- **FR-1.10.2 — Pasabuy/Pasugo (errands/logistics):** Repurpose idle drivers for hyperlocal delivery/errands at a base fee (e.g., ₱49) plus per-km surcharge. *(Blueprint §7B.)*
- **FR-1.10.3 [GAP]** No Figma screens exist for Perks or Pasabuy/Pasugo. Treat as roadmap features pending design.

---

## 2. Non-Functional Requirements

- **NFR-1 Localization:** UI shall support English with Cebuano/Bisaya copy in places (e.g., "Mangita ta'g pamasahero," "Nia kay oras? Nia mi pasahero," "Adlaw-adlaw ang sweldo," "Padagan ang imong negosyo"). The account screen exposes a Language setting. **[ASSUMPTION]** Full bilingual (English/Cebuano) localization is a goal, not yet fully realized in the screens.
- **NFR-2 Currency & locale:** All monetary values are Philippine Peso (₱), two-decimal precision; timestamps in local Ormoc time; phone numbers in +63 format.
- **NFR-3 Regulatory compliance:** Fares must comply with Ordinance No. 121 S. 2023; the platform must respect MTOP/LGU franchising (Phase 1 = already-franchised Ormoc tricycles only), PH Data Privacy Act, DOLE labor rules, and (for logistics) DICT PEMEDES rules. *(Blueprint §1, §7, fleet agreement "LTFRB-aligned compliance".)*
- **NFR-4 Real-time performance:** Live driver tracking, ETAs, GPS telemetry streaming, and 3-minute matching epochs require low-latency real-time updates. **[ASSUMPTION]** Target update cadence ≤ a few seconds; specific SLA unspecified — **[GAP]**.
- **NFR-5 Scale baseline:** The launch model assumes 100 drivers × ~10 rides/day ≈ 30,000 bookings/month; the AI server is sized for ~50 concurrent support chats. The system should scale beyond this without redesign. *(Blueprint §9.)*
- **NFR-6 Privacy & data security:** Ride and location data used "only for matching, safety, and support"; fleet data described as "end-to-end audited"; 2FA available/required (passenger optional "2FA off"; fleet "2-factor verification required on every device"). Sensitive documents (licenses, OR/CR, permits) "encrypted in transit."
- **NFR-7 Offline-first AI/data privacy:** The Blueprint requires customer-support AI, document-verification VLMs, and fraud/GPS-anomaly models to run **locally/offline** to keep data private and avoid recurring cloud costs. *(Blueprint §5A, §8B.)* — implementation detail, but the **privacy intent** is a real NFR.
- **NFR-8 Reliability/availability:** Marketplace must function continuously (drivers go online anytime); cancellation/dispatch logic must be resilient to no-shows, breakdowns, and weather. **[GAP]** No uptime target stated.
- **NFR-9 Accessibility:** Discount tiers (Senior/PWD/Student) imply an accessibility-conscious audience. **[ASSUMPTION]** WCAG-style accessibility (contrast, large tap targets, voice search) is desirable; not specified — **[GAP]**.
- **NFR-10 Trust/abuse resistance:** Anti-leakage, fraud detection, reputation scoring, and dispute case files must be tamper-evident and auditable. *(Blueprint §5, §10, §11.)*
- **NFR-11 Device/platform:** Passenger and Driver are mobile apps (Figma shows iOS status bars / notch). Street-hail booking must work as a **no-install mobile web** portal. Fleet console is shown at phone width but is conceptually a "dashboard/console." **[GAP]** Confirm whether the operator console is also web/desktop.
- **NFR-12 Maintainability/configurability:** Tariff tables, surcharge amounts, commission %, convenience fee, cancellation fees, matching radii, and incentive thresholds must be **configurable** (they are governed by ordinances and business policy that change). **[ASSUMPTION]** strongly implied; not explicitly stated.

---

## 3. Implementation-Specific Details (NOT requirements — descoped or vendor-specific)

These appear in the source material but are implementation choices, business/finance content, or hardware. They should **not** constrain the software design unless re-confirmed.

- **IMPL-1 Firebase:** "Firebase hosting … and database syncing" is one cost line item. **Not required.** Any hosting/DB/real-time-sync technology that meets §2 NFRs is acceptable.
- **IMPL-2 Self-hosted AI server:** "Headless Linux AI Server (Ubuntu)," AMD Ryzen 9 7900X, dual RTX 3090, vLLM with continuous batching/prefix caching on CUDA, Qwen2.5-Coder for dev copilots. This is a chosen infrastructure approach for privacy/cost — the **functional** needs are: support automation, document verification, and GPS/fraud anomaly detection (see FR-1.7.7, FR-1.7.8, NFR-7).
- **IMPL-3 Mapping APIs:** "optimized mapping APIs" is unspecified/vendor-agnostic. Maps, routing, geocoding, ETA, and geohashing are functional needs; the provider is open.
- **IMPL-4 QR codes:** "Laminated/weatherproof high-security QR sticker." QR is the chosen mechanism for driver-vehicle pairing and street-hail onboarding; the **requirement** is secure vehicle pairing + no-install street onboarding (FR-1.3.7/8).
- **IMPL-5 SMS/OTP provider:** SMS 6-digit verification is required (FR-1.1.3); provider unspecified.
- **IMPL-6 Payment rails:** GCash and PH banks (BPI, BDO, UnionBank, Metrobank) named as supported payout/payment targets — these are integrations, configurable.
- **IMPL-7 Finance/business content (not software):** Pre-seed raise ₱4,019,500; NPV/IRR (₱1,829,760 / 50.92% at 30% discount); COA Circular 2022-004 asset reclassification; DOLE 8-person payroll; OrCham investor framing; DICT PEMEDES amnesty. These inform business viability, **not** app behavior.
- **IMPL-8 Specific hardware inventory** (iPhones, laptops, CCTV, etc.) — procurement, not software.
- **IMPL-9 "2FA off" / "Always dark" defaults** in Figma are sample states, not mandated defaults.

---

## 4. Cross-Document Conflicts & Open Questions (consolidated)

| # | Conflict / Gap | Source A | Source B | Action |
|---|---|---|---|---|
| Q1 | Tricycle capacity | Figma driver onboarding: "up to 3 passengers" | Blueprint + Figma booking: 6 seats | **[RESOLVED]** 6 seats; Solo reserves the whole vehicle; `billed_seats = clamp(passengers, 4, 6)`; empty seats cannot be occupied by others. Seat model is IN SCOPE (FR-1.2.5); fare math built on it is [DEFERRED]. |
| Q2 | Commission model | "15% commission" (§7, agreement) | 40%/60% share of ₱15 fee (§9) | **[DEFERRED]** Pricing, commission, wallet, and payout rules are out of scope for the MVP (§0). Canonical commission to be defined when pricing returns to scope (FR-1.2.8). |
| Q3 | Share split formula | Blueprint: flat per-passenger (₱base + ₱5) | Figma: "Split Pakyaw buyout 1/1 share" UI | Define exact Share pricing |
| Q4 | Matching radii values | Blueprint text: walk "<200 m" | PDF math placeholders blank for walk/detour radius | Obtain numeric thresholds |
| Q5 | Driver request/in-trip nav screens | — | Missing from Figma | Design needed |
| Q6 | Perks / Pasabuy / Pasugo screens | Blueprint §7 | Missing from Figma | Roadmap/design needed |
| Q7 | Multi-role switching | "Switch to rider (demo)" | unclear if real | Confirm scope |
| Q8 | Operator console platform | Figma at phone width | "console/dashboard" wording | Confirm web vs mobile |
| Q9 | Real-time SLA / uptime targets | — | unstated | Define NFR targets |

---

## Appendix A — Zonal Tariff (Ordinance No. 121, S. 2023)

*(Transcribed from Blueprint §2D; regular rate / Senior-PWD-Student rate, in PHP.)*

**Zone 1 — Red / Freezone**

| Barangay | Regular | Discounted |
|---|---|---|
| North, East, West, South | 10.00 | 8.00 |
| Alegria, Bantigue, Batuan, Camp Downes, Can-adieng, Cogon, Don Felipe Larrazabal, Linao, Punta, Toog | 10.00 | 8.00 |
| Doña Feliza Mejia | 11.00 | 8.80 |
| Naungan | 12.00 | 9.60 |
| San Isidro, Tambulilid | 12.00 | 9.60 |
| Bagong Buhay / Bliss | 13.00 | 10.40 |
| San Pablo | 14.00 | 11.20 |
| Alta Vista | 15.00 | 12.00 |
| Libertad, Patag, Sto. Niño, San Antonio | 16.00 | 12.80 |
| Salvacion | 19.00 | 15.20 |
| Donghol | 20.00 | 16.00 |
| Airport, Nasunogan | 22.00 | 17.60 |

**Zone 2 — Blue**

| Barangay | Regular | Discounted |
|---|---|---|
| Ipil, Panali-an | 13.00 | 10.40 |
| Danhug, Macabug, Sumangga | 17.00 | 13.60 |
| Can-untog | 19.00 | 15.20 |
| Mabini | 25.00 | 20.00 |

**Zone 3 — Yellow**

| Barangay | Regular | Discounted |
|---|---|---|
| Dayhagan | 18.00 | 14.40 |
| Juaton | 19.00 | 15.20 |
| Concepcion | 21.00 | 16.80 |
| Luna | 22.00 | 17.60 |
| Cabulihan | 23.00 | 18.40 |
| Cagbuhangin | 24.00 | 19.20 |
| Dolores, Valencia | 25.00 | 20.00 |
| Milagro | 29.00 | 23.20 |
| San Jose | 31.00 | 24.80 |
| Matica-a | 33.00 | 26.40 |
| Sabang Bao | 35.00 | 28.00 |
| Hibunaon | 36.00 | 28.80 |

**Zone 4 — Green**

| Barangay | Regular | Discounted |
|---|---|---|
| Lilo-an | 19.00 | 15.20 |
| Licuma | 22.00 | 17.60 |
| Curva, Lao, Tzu Chi | 23.00 | 18.40 |
| Labrador, Margen, San Vicente | 27.00 | 21.60 |
| R.M. Tan, San Juan | 31.00 | 24.80 |
| Mas-In | 32.00 | 25.60 |
| Nueva Sociedad | 37.00 | 29.60 |
| Green Valley | 40.00 | 32.00 |
| Leondoni | 41.00 | 32.80 |
| Esperanza | 43.00 | 34.40 |
| Manlilinao | 49.00 | 39.20 |

**Surcharges:** Special Trip +₱5.00; Night Trip (21:00–05:00) +₱5.00 within 2.5 km / +₱10.00 outside.

**Enclosed barangays within 2.5 km radius:** North, South, East, West, Alegria, Bantigue, Camp Downes, Can-adieng, Cogon, Don Felipe Larrazabal, Linao, Punta, Toog.

---

## 5. Phase 11 Realignment — Real Operational Flow

The following requirements were realized in Phase 11:
- **FR-1.11.1 (Interactive Maps)**: Replaced placeholder maps in both passenger and driver UIs with real Google Maps integration (`react-native-maps`).
- **FR-1.11.2 (Live Markers)**:
  - Passenger side shows pickup marker (green), destination marker (red), and live driver marker (violet) from `drivers/{driverId}.location`.
  - Driver side shows own location (blue pulsing dot), passenger pickup marker (green), and destination marker (red) after the trip starts.
- **FR-1.11.3 (Route Polyline)**: Displays a route polyline (`colors.blue.primary` / `4px`) connecting the active points:
  - Pre-trip (accepted -> arrived): connecting driver's location to pickup.
  - In-trip: connecting pickup to destination.
- **FR-1.11.4 (Interactive Operational Flow)**: Added state-driven buttons to eliminate manual Firestore editing:
  - Driver: "Start navigation" -> "Arrived at pickup" -> "Start trip" -> "End trip".
  - Passenger: "Cancel request"/"Cancel ride" (pre-`in_progress` only) and "End trip" (during `in_progress`).
  - Terminal States: "Done" clears `activeTripStore` and resets availability / screen layouts.
- **FR-1.11.5 (Secure Release Transaction)**: Passenger-initiated completions and post-acceptance cancellations atomically clear the driver's active trip and reset availability to `'online'` (including incrementing `tripCount` by 1 upon completion).
- **FR-1.11.6 (Cancellation Lifecycle)**: Cancellation behaviour depends on the lifecycle stage and runs in a single Firestore transaction:
  - **Before driver acceptance (`request`):** the passenger cancelling **permanently deletes** the trip document — an abandoned booking request. No `cancelled` status is written, no trip history is created, and driver listeners receive a Firestore document-removal event.
  - **After driver acceptance (`accepted` / `driver_arriving` / `driver_arrived`):** cancellation no longer deletes the document; the status becomes `cancelled`, the trip remains in history, and driver availability is restored. All cleanup remains transactional.
  - **During the ride (`in_progress`):** cancellation is not allowed; only trip completion is supported (either the passenger or the driver may complete the trip).
- **Zero-Money Verification**: Re-asserted that no fare computation, payment, rating, or shared-ride elements are present in the map, sheets, or transaction logic.
