# Pakyaw — Design System

Extracted from the Figma screenshots in `docs/figma/`. **All hex values are visual estimates** sampled by eye from the PNG mockups, not exported design tokens — treat them as **[ASSUMPTION]** and confirm against the source Figma file. Spacing/radius/size values are likewise estimated from proportions.

The product has **three theme contexts** that share one visual language but differ by accent and background:

| Context | Background | Primary accent | Secondary accent |
|---|---|---|---|
| **Passenger** | Cool blue gradient (light, airy) | Blue | Amber/orange |
| **Driver** | Near-white / pale blue gradient | Blue + **Green** (online/go) | Amber |
| **Fleet Owner** | Near-white / pale gradient | **Violet / purple** | Blue, amber |

---

## 1. Color Palette

### 1.1 Brand & Primary (Blue)
| Token | Est. hex | Usage |
|---|---|---|
| `blue/primary` | `#2F80ED` ~ `#2D9CFF` | Primary buttons, active tabs, links, selected segments |
| `blue/gradient-start` | `#3D8BFF` | Top of primary button gradient |
| `blue/gradient-end` | `#1E6FE0` | Bottom of primary button gradient |
| `blue/tint` | `#E8F1FE` | Selected card fill, icon-chip backgrounds, eyebrow chips |
| `blue/deep` | `#0B1B3F` ~ `#10213F` | Headlines on light bg (near-navy) |

### 1.2 Secondary (Amber / Orange)
| Token | Est. hex | Usage |
|---|---|---|
| `amber/primary` | `#F5A623` ~ `#FF9F1C` | Earnings/fare totals, ratings (★), destination pin, highlights |
| `amber/tint` | `#FDEFD8` | Discount badge bg, "Switch to rider" button, amber icon chips |
| `amber/deep` | `#E07B00` | Emphasis numerals (e.g., "20% off") |

### 1.3 Driver accent (Green)
| Token | Est. hex | Usage |
|---|---|---|
| `green/primary` | `#27AE60` ~ `#2BB673` | "Go online" button, Online status, Verified/Cleared, positive deltas, saved amounts |
| `green/tint` | `#E3F6EC` | Verified/consent card fill, green icon chips |

### 1.4 Fleet accent (Violet)
| Token | Est. hex | Usage |
|---|---|---|
| `violet/primary` | `#7B61FF` ~ `#8A6CF0` | Fleet primary buttons, eyebrows, QR PAIRED badge, active fill |
| `violet/gradient` | `#8E7BFF → #6C4FE0` | Fleet button gradient |
| `violet/tint` | `#EFEAFE` | Selected card, violet icon chips |

### 1.5 Semantic
| Token | Est. hex | Usage |
|---|---|---|
| `success` | `#27AE60` | Verified, online, positive |
| `warning` | `#F2A93B` | Service-due, Pickup badge, surge/weather notices |
| `danger` | `#EB5757` | Log out, service-fee deduction (–₱), errors |
| `info` | `#2F80ED` | In-trip badge, info |

### 1.6 Neutrals / Grayscale
| Token | Est. hex | Usage |
|---|---|---|
| `ink/900` | `#0E1726` | Primary headings |
| `ink/700` | `#33415C` | Body text |
| `ink/500` | `#6B7689` | Secondary text, labels |
| `ink/400` | `#9AA4B2` | Placeholder, muted captions, disabled label |
| `surface/card` | `#FFFFFF` | Cards, sheets, fields |
| `surface/muted` | `#F4F7FB` | Disabled button, subtle panels |
| `surface/bg-passenger` | `#EAF1FB → #DCE8F7` gradient | Passenger background |
| `surface/bg-light` | `#F7FAFE → #FFFFFF` | Driver/fleet background |
| `border/subtle` | `#E6EBF2` | Card borders, dividers, dashed upload tiles |

> **[GAP]** Exact brand hex, gradient stops, and dark-mode palette must be confirmed from Figma styles. The passenger "Always dark" appearance setting implies a dark palette exists but no dark screens were provided.

---

## 2. Typography

Single sans-serif family across all roles. **[ASSUMPTION]** the typeface is a geometric/grotesque sans (appearance consistent with **Inter / SF Pro / Poppins**-style). Headlines are heavy and slightly condensed-feeling; confirm the actual font.

### 2.1 Type scale (estimated)
| Style | Size / weight | Usage |
|---|---|---|
| Display / H1 | ~28–32 px, **Bold/800** | Screen titles ("Welcome back", "Ride instantly, around your city", "Activity", "Wallet") |
| H2 | ~22–24 px, Bold | Section/large values, "Run your fleet" |
| H3 / Card title | ~17–18 px, **SemiBold/700** | Card headers, list titles, names |
| Body | ~15–16 px, Regular/Medium | Descriptions, field values |
| Body small | ~13–14 px, Regular | Helper text, sublabels, captions |
| Label / Eyebrow | ~11–12 px, **SemiBold, UPPERCASE, letter-spacing ~+0.08em** | Field labels ("EMAIL"), section eyebrows ("MAY 2026", "FLEET"), step counters, status chips |
| Numeric / Currency hero | ~34–40 px, **Bold** | Balance/earnings/fare totals (₱1,240.50) |

### 2.2 Type treatments
- **Headlines:** near-black/navy, tight leading, often two lines with a key word colored (e.g., "Welcome to **Pakyaw**" with Pakyaw in blue).
- **Eyebrows / labels:** uppercase, tracked, muted grey or accent-colored.
- **Currency:** large bold integer with smaller decimals (e.g., **1,240**`.50`); "₱" peso glyph precedes; amber or white depending on card.
- **Emphasis spans:** inline color emphasis for discounts ("**20% off**" amber) and names (blue).

> **[GAP]** Confirm font family, exact sizes, line-heights, and whether a separate numeric/monospace face is used for currency.

---

## 3. Spacing & Layout Patterns

### 3.1 Spacing scale ([ASSUMPTION], 4px base)
`4 · 8 · 12 · 16 · 20 · 24 · 32` px. Cards commonly use ~16 px internal padding; screen side margins ~20–24 px; vertical gaps between stacked cards ~12–16 px.

### 3.2 Radii ([ASSUMPTION])
| Token | Est. | Usage |
|---|---|---|
| `radius/sm` | 10–12 px | Icon chips, small badges |
| `radius/md` | 14–16 px | Text fields, cards, list rows |
| `radius/lg` | 20–24 px | Large cards, bottom sheets (top corners) |
| `radius/pill` | 999 px | Primary buttons, segmented toggles, chips, status pills |

### 3.3 Elevation / Shadow
- Soft, low-opacity diffuse shadows (`y ~4–8, blur ~16–24, black ~6–10%`) on cards, sheets, floating tab bar, and circular icon buttons. No hard borders on most cards (shadow-separated on tinted bg).

### 3.4 Layout patterns
- **Mobile, single-column, ~390–430 px wide** (iOS frame; 9:41 status bar, notch).
- **Header → content → bottom-pinned CTA** is the dominant page template; primary action floats at the bottom with side margins.
- **Bottom tab bar** floats above content with rounded container (passenger/driver/fleet main sections).
- **Bottom sheet over map** for all booking/driving states (expandable, scrollable content; drag-handle implied).
- **Card stacks**: scrollable vertical lists of rounded cards (settings, transactions, trips, vehicles).
- **Two-up grids**: half-width paired fields, 2×2 vehicle-type grid, KPI card pairs.
- **Eyebrow + big title** opening pattern on most top-level screens.
- **Stepped flows** with progress bar/counter pinned near the header.
- **Map-first screens** (passenger ride, driver drive) use full-bleed map with floating controls + bottom sheet.

> **[GAP]** Fleet console is shown at phone width; if it's also web/desktop, responsive breakpoints and a multi-column dashboard grid are needed (not in the provided designs).

---

## 4. Icons

Style: **outline/line icons**, ~1.5–2 px stroke, rounded joins; frequently placed inside **tinted rounded-square "icon chips"** (color-coded by context). Some spot **emoji-style/3D illustrative** icons appear on onboarding and success screens.

### 4.1 Observed icons
- **Auth/forms:** mail, lock, phone/handset, user, ID card, check, eye **[ASSUMPTION]**.
- **Navigation/tabs:** map/route (Ride/Drive), clock (Activity), wallet/card (Wallet), person (Account), grid (Home), people (Drivers), car (Fleet), bar-chart (Earnings/Reports), document (Reports).
- **Map:** teardrop pins (origin blue, destination amber), navigation arrow/locate, layers, insights/trend, plus/recenter, vehicle markers.
- **Vehicles:** motorcycle, tricycle, multicab/van, sedan glyphs (used in onboarding, vehicle cards, trip cards).
- **Ride controls:** share (nodes), shield/SOS, phone, chat bubble, power (online toggle), lightning/flash (incentive, "Ready to roll").
- **Status/meta:** star (rating), arrow-up trend (delta), gift (promo), bell (notifications), warning triangle (alerts), shield-check (verified/safety), QR/scan, upload (cloud/arrow-up), filter (funnel), search (magnifier), chevron-right (row disclosure), pencil (edit).
- **Currency:** "₱" peso symbol used typographically, sometimes in a coin/badge.
- **Brand mark:** stylized blue bird/swoosh "P." logo (app icon + onboarding hero).

### 4.2 Icon-chip color coding
- Blue chip = neutral/navigational; green chip = success/verified/positive; amber chip = rating/earnings/warning; violet chip = fleet; red = destructive.

> **[GAP]** No icon set name is given; confirm whether a library (e.g., Feather/Lucide/Phosphor) or custom set is used, and export the brand logo.

---

## 5. Imagery & Illustration
- **Spot illustrations:** soft, rounded, pastel with blue/amber palette — used on onboarding slides and empty/success states inside a **circular tinted halo**.
- **Maps:** light-styled map tiles with muted greys/greens; blue route polyline; barangay labels (BRGY. COGON, etc.).
- **Avatars:** colored circles with white initials (RM, JD, AS…); consistent across roles.
- **Emoji-style glyphs** (🛺 tricycle, 🧺/💵 etc.) appear in some onboarding cards.

---

## 6. Motion ([ASSUMPTION] / [GAP])
- Implied transitions: carousel slide, bottom-sheet expand/collapse, progress-bar fill, countdown ticking, button enable state change, status-tracker node activation, heat-map updates.
- **[GAP]** No motion specs (durations, easing) are provided.

---

## 7. Component Tokens Summary (cross-reference)
Reusable components built on these tokens are cataloged in `component_inventory.md`. Key recurring patterns:
- **Primary button** = `radius/pill` + role-accent gradient + white bold label; disabled = `surface/muted` + `ink/400`.
- **Card** = `surface/card` + `radius/md|lg` + soft shadow + ~16 px padding.
- **Field** = `surface/card` + `radius/md` + leading icon + `ink/400` placeholder + uppercase `ink/500` label above.
- **Status pill** = `radius/pill` + semantic tint bg + semantic text.
- **Icon chip** = `radius/sm|md` + context tint bg + line icon.

---

## 8. Consolidated Open Questions ([GAP])
1. Export real Figma tokens (color/type/spacing/radius/shadow) — all values here are visual estimates.
2. Confirm typeface(s) and full type scale.
3. Provide dark-mode palette (passenger "Always dark").
4. Confirm icon library and export brand logo/marks.
5. Define motion specs.
6. Confirm fleet console target (mobile vs responsive web) and breakpoints.
7. Reconcile per-role accent usage rules (when blue vs green vs violet vs amber).

---

## 9. Phase 11 Design System Realignment — Map Visual Tokens

The design system has been extended in Phase 11 with concrete visual tokens for map styling and interactive elements:
- **Map Visual Theme**: Leverages light-styled platform maps (Apple Maps on iOS, Google Maps on Android) with clean, high-contrast layouts.
- **Route Polyline Token**: Styled with a stroke width of `4px` and colored using `colors.blue.primary` (`#2F80ED`), ensuring high visibility and brand alignment.
- **Marker Visual Tokens**:
  - **Pickup Marker**: A white outer ring (`border/subtle`) enclosing a green center (`colors.green.primary` / `#27AE60`) to denote the starting point.
  - **Destination Marker**: A white outer ring enclosing a red center (`colors.danger` / `#EB5757`) to denote the endpoint.
  - **Driver Marker**: A white outer ring enclosing a violet center (`colors.violet.primary` / `#7B61FF`) to highlight the vehicle on the passenger view.
  - **Passenger Own Location Marker**: A translucent blue outer ring with a blue dot center (`colors.blue.primary` / `#2F80ED`) to represent the driver's own position on the driver view.
- **Elevation and Padding**: Floating sheets use `shadow/float` with a rounded corner radius of `radius/lg` (`20px`). The map camera auto-fitting applies a bottom inset padding of `320px` to clear the active bottom sheet layout beautifully.

---

## 10. Phase 12 Navigation Experience — Map & Banner Tokens

Visual + camera tokens for the Navigation Experience phase (full behavioral spec in **[phase12_navigation_spec.md](./phase12_navigation_spec.md)** §3 / §7). All tokens reuse existing palette/spacing primitives — no new color families are introduced.

### 10.1 Maneuver banner (driver-only)
Top-pinned banner that surfaces the next maneuver while the driver is in `to_pickup` or `to_destination` navigation phase.

| Slot | Token |
|---|---|
| Surface | `ink/900` (`#0E1726`) |
| Maneuver icon | `surface/card` (`#FFFFFF`), Lucide stroke `2px` |
| Road / step text | `surface/card` (`#FFFFFF`), `Body` weight Medium |
| Distance-to-maneuver | `surface/card` (`#FFFFFF`), `H3` weight SemiBold |
| Container radius | `radius/lg` (20 px) |
| Elevation | `shadow/float` |
| Padding | `16 px` vertical, `20 px` horizontal |
| Top inset | safe-area top + `12 px` |

### 10.2 Trip-stats row (driver-only)
Three-up row directly under the banner showing live trip metrics. Uses existing type scale — no new sizes introduced.

| Slot | Heading token | Value token |
|---|---|---|
| ETA | `Label / Eyebrow` · `ink/500` | `H3` SemiBold · `ink/900` |
| DISTANCE | `Label / Eyebrow` · `ink/500` | `H3` SemiBold · `ink/900` |
| ARRIVAL | `Label / Eyebrow` · `ink/500` | `H3` SemiBold · `ink/900` |

Layout: `flex-row`, equal `flex-1` cells, `12 px` vertical padding, `1 px` divider in `border/subtle` between cells.

### 10.3 Navigation camera constants
Authoritative numeric tokens for `mapRef.animateCamera` in driver Navigation Mode. Overview mode reverts to the existing top-down camera (no tilt).

| Token | Value | Notes |
|---|---|---|
| `NAV_PITCH` | `45°` | Heading-up follow tilt (resolved from OQ-NAV-1) |
| `NAV_ZOOM` | `17.5` | Driver-centered street-level zoom |
| `NAV_CAMERA_ANIM_MS` | `600 ms` | `animateCamera` duration during follow updates |
| `NAV_RECENTER_IDLE_MS` | `8000 ms` | Idle delay after manual pan before auto-recenter offer |
| `NAV_PITCH_OVERVIEW` | `0°` | Top-down camera when user toggles Overview |

### 10.4 Navigation polylines (carried over)
Polyline colors are unchanged from Phase 11/12 — Navigation Experience does not introduce new route colors:

- **Driver → Pickup** (`trip.driverRoute.polyline`, rendered on both driver and passenger): `colors.violet.primary` (`#7B61FF`), stroke `4 px`.
- **Pickup → Destination** (`trip.route.polyline`): `colors.blue.primary` (`#2F80ED`), stroke `4 px`.

The two routes never share a Firestore field and never share rendering treatment — see [phase12_navigation_spec.md](./phase12_navigation_spec.md) "Booking Route vs Driver Route".

### 10.5 External navigation hand-off (carried over)
The "Open in Maps" affordance hands off to the platform-native app — Android → Google Maps, iOS → Apple Maps (resolved from OQ-NAV-8; do not force Google Maps on iOS). Button uses the standard `Primary button` token; no new visual treatment.

---

*Companion specifications: [architecture.md](./architecture.md) · [component_inventory.md](./component_inventory.md).*
