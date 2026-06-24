# Pakyaw — Reusable UI Component Inventory

Catalog of UI components observed across the Figma screens, grouped by category. Each entry notes where it appears, observed variants, and states. Color/type tokens referenced here are defined in `design_system.md`. Pixel values are **visual estimates** from the mockups, not exported specs — **[ASSUMPTION]** unless a numeric label is literally on-screen.

Naming uses the three theme contexts: **Passenger** (dark/blue gradient), **Driver** (light, blue+green), **Fleet** (light, violet).

---

## 1. Foundational / Layout

### 1.1 Screen scaffold
- Full-bleed background (passenger: cool blue gradient; driver/fleet: near-white gradient). Rounded device frame in mockups (presentation only).
- Status bar (9:41, signal/wifi/battery) — OS chrome, not built.
- **[GAP]** Safe-area insets / exact margins not specified; left/right page padding ≈ 20–24 px.

### 1.2 Bottom Tab Bar
- **Passenger:** Ride · Activity · Wallet · Account (4 tabs). Active tab = filled blue rounded pill with white icon+label; inactive = grey icon + label.
- **Driver:** Drive · Earnings · Wallet · Account (4 tabs). Active = light-blue/green tinted pill.
- **Fleet:** Home · Drivers · Fleet · Revenue · Reports (5 tabs). Active = light-blue tinted icon+label.
- Floating, white, rounded-top container with subtle shadow.

### 1.3 Top App Bar / Header
- Variants:
  - **Centered label header:** circular back button (white, rounded, soft shadow) + centered uppercase tracked title ("SIGN IN", "STEP 1 OF 4").
  - **Large-title header:** small uppercase eyebrow ("MAY 2026", "FLEET", "REPORTS") above a large bold title ("Activity", "Wallet").
  - **Title + action:** title left, text action right ("Notifications" + "Mark all read"; search icon button).
- Back button: circular icon button, used app-wide.

### 1.4 Progress Indicators
- **Step pill text:** "STEP 1 OF 4", "1/6", "2/6", "5/6" — uppercase, tracked, muted.
- **Segmented progress bar (driver/fleet):** gradient-filled rounded bar with blue→amber/violet fill + step counter (e.g., 4/6).
- **Carousel pager dots:** row of dots, active = elongated blue/violet pill, inactive = grey dot.

---

## 2. Buttons & Actions

### 2.1 Primary Button (full-width)
- **Passenger:** blue gradient, white bold label, large radius (~28–32 px pill), optional trailing arrow ("Next →", "Continue →") or leading check ("✓ Create my account"). Full-width with side margins, near bottom.
- **Driver "Go online":** green gradient pill with power icon.
- **Fleet:** violet/purple gradient pill ("Continue", "I agree, continue", "Submit application").
- **States:** enabled (saturated gradient); **disabled** (flat grey, muted label — e.g., "Continue →" greyed in sign-up step 1, "Verify phone to continue").

### 2.2 Secondary / Outline Button
- White fill, dark label, subtle border ("I already have an account", "History", "Not yet").
- Driver/fleet ghost variants on light bg.

### 2.3 Tertiary / Text Button & Links
- Inline colored text links: "Skip" (grey), "Forgot password"/"Forgot PIN?" (accent), "Mark all read" (blue), "View receipt" (blue), "CHANGE" (blue), "Add payment method" (blue), "Get help/Get help" (accent).

### 2.4 Destructive Button
- **Log out:** red-tinted fill, red label, red icon (passenger account, driver, fleet reports).
- "Switch to rider (demo)": amber-tinted fill, amber label.

### 2.5 Icon Button
- Circular: back, search, map controls (insights/layers/locate/recenter), chat, call.
- Map control stack (passenger ride): vertical group of circular white buttons with icons.

### 2.6 Wallet Action Chips
- Small pill buttons inside the wallet balance card: "+ Top up", "↗ Send", "▭ Pay" (passenger); "Cash out" (primary) + "History" (outline) (driver).

### 2.7 Stepper / Counter Control
- Minus / value / plus control. Used for: passengers boarding (passenger fare sheet), vehicle-mix counts (fleet garage, color-coded +/- per vehicle type: blue/amber/green).

### 2.8 Quantity Slider + Presets
- Fleet "How many vehicles?": large numeric value, horizontal slider, preset chips (3/5/10/20/50).

---

## 3. Inputs & Form Controls

### 3.1 Text Field
- White rounded card (~14–16 px radius), leading icon (mail, lock, phone), placeholder in muted grey, optional trailing action ("Send code", "Verify", "27s" timer).
- **Field label:** uppercase tracked grey label above field ("EMAIL", "PASSWORD", "MOBILE NUMBER", "FIRST NAME").
- Variants: single full-width; **paired half-width** (First name / Last name; Brand / Model; Year / Color).
- Driver variant: pill-shaped outlined field on light bg with "+63" prefix chip.
- Helper text below field (muted): "We use email so we can recover your account…", "Code sent via SMS · check your messages."

### 3.2 OTP / Code Input
- **Passenger:** inline 6-dot/digit field with cursor inside a text field + "Verify" action.
- **Driver PIN:** 4 separate rounded square boxes.
- **[GAP]** Two different OTP patterns (inline vs boxed) — unify or document intentional difference.

### 3.3 Toggle / Switch
- iOS-style switch, blue when on. Used on fare sheet: "Special trip", "Lots of luggage", "Privilege discount".

### 3.4 Selection Card (single-select / radio behavior)
- Bordered card; selected state = colored border + tinted background + leading icon highlight.
- Used for: discount eligibility (Regular/Student/PWD/Senior), payout method (GCash/Bank), legal structure (Sole proprietor/Corporation/Cooperative), vehicle type grid.

### 3.5 Segmented Control / Tabs
- **Pill segmented toggle:** "Pakyaw (Solo) / Share Route" (fare sheet), "Trips / Insights" (activity), "Today / This week / This month" (driver earnings). Active segment = blue fill, white text.
- **Filter chips (multi-option):** "All Trips / Pakyaw / Share" (activity), "All / Online / Offline" (drivers/fleet), "All / Earnings / Cashouts" (driver wallet). Active = blue fill; inactive = white/outline.

### 3.6 Upload Tile / Dropzone
- Dashed-border tile with upload icon + label + sublabel ("Front / ID side facing up", "OR / Official Receipt"). States: empty (dashed, upload icon) → uploaded/verified (green check + "Looks great" + extracted value like license no./expiry).
- Compact 4-up row for vehicle photos (Front/Back/Left/Right).
- Document row variant (fleet permits): icon + title + sublabel + trailing file icon.

### 3.7 Consent / Checkbox Card
- Card with check indicator + bold title + description. Tappable to accept.
- Used for: driver agreements (3), fleet agreements (3), "I consent to a background check." Accepted = green check + green-tinted card.

### 3.8 Search Field
- Rounded white field with leading search icon + placeholder; passenger ride home adds a trailing **VOICE** affordance. Driver/fleet plain search ("Search drivers").

---

## 4. Data Display & Cards

### 4.1 Stat / KPI Card
- Small rounded white card: uppercase label + large value, sometimes a sublabel/delta.
- Passenger activity: Spent/Saved/Distance. Driver earnings: Online/Accept/Rating. Fleet: Active drivers/Online vehicles/Active trips/Avg rating; driver wallet Today/This week/Pending.
- Color-coded values (green = saved/positive, amber = rating/earnings, blue = count, red = deduction).

### 4.2 Hero Balance / Earnings Card
- Large gradient card (passenger wallet: blue; driver earnings: amber-tinted; driver wallet: blue): big currency value, label, delta ("+12% vs yesterday"), embedded action chips, masked account no. ("•••• 4567").

### 4.3 Profile Card
- Avatar (initials in colored circle) + name + subtitle/status + inline stats row (trips/saved/rating or rating/trips/accept) + Edit action.
- Passenger account, driver account, fleet header (company + avatar).

### 4.4 List Item / Row
- **Settings row:** leading tinted icon chip + title + right-aligned value/summary + chevron. (Account menus, payment methods, reports list.)
- **Transaction row:** leading icon + title + timestamp + right amount (green credit "+₱96", neutral/grey debit).
- **Vehicle row (fleet):** icon + plate + type + status badge + sub-cards (Registration / Service mileage).

### 4.5 Trip Card (history)
- Compound card: header (date/time · driver · plate) + mode badge (Pakyaw/Share) + origin (blue dot) → destination (amber dot) + fare + discount delta + footer meta (rating · distance · duration · payment · View receipt). Origin/destination use a **route connector** (dot–line–dot).

### 4.6 Driver-Match Card (live)
- Avatar + name + rating·trips + vehicle·plate, with chat/call icon buttons. Appears as bottom sheet content during matching/arrival.

### 4.7 Notification Item
- Card: leading rounded tinted icon (color by type: blue trip, green promo, amber/warning) + bold title + body + relative time + unread dot.

### 4.8 Fare Breakdown Block ("HOW THIS IS CALCULATED")
- Labeled rows: description (+ sub-note) left, amount right; emphasized total; split row "Driver net ₱X · Platform ₱Y". Highlighted total in amber bold.

### 4.9 Receipt / Summary Table (review screens)
- Key–value rows (label left muted, value right bold): sign-up review, fleet review-and-submit, driver "Who are you" recap.

### 4.10 Coupon / Promo Card
- Dashed/ticket-style card with code (e.g., PAKYAW20), title ("20% OFF Share Ride"), small icon. Wallet "Active promos."

---

## 5. Status, Feedback & Indicators

### 5.1 Badge / Pill (status)
- Small rounded label. Variants by color:
  - Mode: "SHARE" (green), "PAKYAW" (blue) on trip cards.
  - Trip state: "In Trip" (blue), "Pickup" (amber) on fleet dashboard.
  - Vehicle: "QR PAIRED" (violet) on fleet vehicle cards.
  - Driver state: "Online" (green), "Offline", "In Trip", "Pickup" on driver lists.
  - Discount: "–20%" (amber) on eligibility cards.
  - Verification: "• Verified" / "• Cleared" (green) on driver documents.
  - Eyebrow chips: "ANYWHERE IN ORMOC", "TWO WAYS TO RIDE", "LIVE DRIVER TRACKING" (light-blue tinted, tracked).

### 5.2 Status Tracker / Stepper (vertical & horizontal)
- **Horizontal trip stepper:** Driver assigned · En route · Arriving (passenger ride). Active node emphasized.
- **Vertical application tracker:** Document review → Background check → Approval (driver status), with check/active/pending node states.

### 5.3 Progress Bar (goal)
- Driver incentive: green fill bar + "9 of 12 trips · 75%" + caption.

### 5.4 Countdown Timer
- Inline text countdown: free-cancel "Cancel · free 1:59" (passenger ride), OTP resend "27s", no-show 5-min timer (Blueprint). Shift timer "Online · 1m".

### 5.5 Empty State
- Icon/illustration + message: "No saved destinations yet. Add as many as you'd like — or skip."

### 5.6 Map Overlays
- Driver/vehicle pins (circular avatars/markers), origin/destination pins (blue/amber teardrop), route polyline (blue), Hot/Busy heat overlay (driver), Virtual/Smart pickup marker.

### 5.7 Hourly Heat Strip
- Driver earnings: grid of small cells colored by earnings intensity across the day (12AM–11PM), legend implied by color.

### 5.8 Bar Chart
- Fleet dashboard weekly revenue: 7 bars (Mon–Sun), tallest/most-recent highlighted amber, others blue.

---

## 6. Overlays & Containers

### 6.1 Bottom Sheet
- Rounded-top white panel over map. Variants: fare/booking sheet (expandable, scrollable), searching state, driver-match, arriving controls, offline prompt (driver), pre-flight checklist (driver, modal-like full sheet with dimmed backdrop).

### 6.2 Modal / Dialog
- **[GAP]** Confirmation dialogs (cancel ride, report seat abuse, fallback "keep waiting/upgrade") are described in Blueprint but not shown — design needed.

### 6.3 Illustration / Icon Hero
- Centered circular tinted background holding a spot illustration or emoji-style icon (onboarding slides, sign-in phone illo, discount ID illo, success "sparkle" badge on review/under-review screens).

---

## 7. Iconography (component-level usage)
See `design_system.md §Icons` for the full list. Components consistently use: line icons inside tinted rounded-square "icon chips" (settings rows, notifications, reports), teardrop map pins, vehicle glyphs (motorcycle/tricycle/multicab/sedan), and currency "₱" treatments.

---

## 8. Component Reuse Matrix (where each appears)

| Component | Passenger | Driver | Fleet |
|---|---|---|---|
| Bottom tab bar | ✓ (4) | ✓ (4) | ✓ (5) |
| Primary gradient button | ✓ blue | ✓ blue/green | ✓ violet |
| Step progress (pill/bar) | ✓ pill | ✓ bar | ✓ bar |
| Text field + label | ✓ | ✓ | ✓ |
| OTP/PIN input | ✓ inline | ✓ boxed | — |
| Selection card | ✓ | ✓ | ✓ |
| Segmented control | ✓ | ✓ | ✓ |
| Filter chips | ✓ | ✓ | ✓ |
| Upload tile | — | ✓ | ✓ |
| Consent card | — | ✓ | ✓ |
| Stat/KPI card | ✓ | ✓ | ✓ |
| Hero balance card | ✓ | ✓ | — |
| Profile card | ✓ | ✓ | ✓ (company) |
| Trip card | ✓ | ✓ (txn) | ✓ (live trip) |
| Status badge/pill | ✓ | ✓ | ✓ |
| Bottom sheet | ✓ | ✓ | — |
| Map + pins/heat | ✓ | ✓ | — |
| Bar chart / heat strip | — | ✓ strip | ✓ bars |
| Coupon/promo card | ✓ | — | — |

---

## 9. Open Questions ([GAP])
- Exact radii, spacing, and shadow tokens are estimated from mockups; request exported design tokens.
- OTP pattern inconsistency (inline vs boxed).
- Missing dialogs/modals (cancel, report abuse, share fallback).
- No componentry shown for QR scan, in-trip nav, SOS-active, admin dashboard.
- Whether Fleet console is mobile or also responsive web affects component breakpoints.

---

## 10. Phase 11 Component Updates

The component inventory has been updated with the following additions:
- **`LiveMap` Component (`src/features/trip/components/LiveMap.tsx`)**: Reusable interactive map component wrapping `react-native-maps`. Renders:
  - Driver marker (violet dot/ring)
  - Passenger own location marker (blue pulsing dot)
  - Pickup marker (green dot/ring)
  - Destination marker (red dot/ring)
  - Path polyline (blue stroke)
  - Automatic `fitToCoordinates` camera adjustments with `320px` bottom padding.
- **Operational Sheet Actions**:
  - **`DriverAcceptedSheet`**: Added "Start navigation" primary button.
  - **`DriverEnRouteSheet`**: Added "Arrived at pickup" primary button.
  - **`DriverArrivedSheet`**: Added "Start trip" primary button.
  - **`DriverInTripSheet`**: Added "End trip" primary button.
  - **`SearchingSheet`**: Added "Cancel request" destructive button.
  - **`DriverMatchedSheet`**: Added "Cancel ride" destructive button.
  - **`EnRouteSheet`**: Added "Cancel ride" destructive button.
  - **`ArrivedSheet`**: Added "Cancel ride" destructive button.
  - **`InTripSheet`**: Added "End trip" primary button.
- **Floating Bottom Sheet Containers**: Embedded floating sheet containers with rounded top corners (`radius/lg`) and shadow elevations (`shadow/float`) in both `ride.tsx` and `drive.tsx` to host the status sheets.
- **Exclusions**: Re-asserted that no fare, payment, or rating components are present in these sheets.
