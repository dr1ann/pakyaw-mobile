# Pakyaw — Screen Map

Maps every Figma file in `docs/figma/` to its screen name, role, flow position, and purpose. Filenames are the designer's working labels and don't always match step numbers; the **Screen / step** column reflects what the screen actually shows. **[GAP]** marks ambiguity.

> Note: the "driver banner on the very top" of some driver screens (a floating green "DRIVER" pill / browser chrome) is per instructions ignored — it's a Figma presentation artifact, not a UI element to build.

---

## Passenger (`docs/figma/passenger/`) — 24 files

| File | Screen / step | Flow | Purpose |
|---|---|---|---|
| `homepage.png` | Onboarding slide 1 — "Ride instantly" | 1.1 | Intro carousel, ANYWHERE IN ORMOC |
| `homepage(1).png` | Onboarding slide 2 — "Pakyaw private, or share" | 1.1 | Two ride modes |
| `homepage(2).png` | Onboarding slide 3 — "Watch your driver" | 1.1 | Live tracking |
| `homepage(3).png` | Onboarding slide 4 — "Verified, rated, safe" | 1.1 | Trust/SOS |
| `homepage(4).png` | Onboarding slide 5 — "Where do you usually go?" | 1.1 | Optional saved destinations |
| `homepage(5).png` | "Welcome to Pakyaw" account choice | 1.1 | Create account / sign in |
| `sign_in.png` | Sign in | 1.3 | Email + password login |
| `sign_up.png` | Sign-up Step 1 of 4 | 1.2 | Email + password |
| `sign_up(1).png` | Sign-up Step 2 of 4 (pre-verify) | 1.2 | Name + mobile, "Send code" |
| `sign_up(1)-verify_phone_clicked.png` | Step 2 — code sent state | 1.2 | 6-digit code field, countdown |
| `sign_up(2).png` | Sign-up Step 3 of 4 | 1.2 | Discount eligibility |
| `sign_up(3).png` | Sign-up Step 4 of 4 | 1.2 | Review and create |
| `ride_page.png` | Ride home (map) | 1.4 | Search destination, supply stats, tabs |
| `ride_page(searched a place to go).png` | Fare sheet — Solo (collapsed) | 1.4 | Mode toggle, seat stepper, toggles |
| `ride_page(searched a place to go)(1).png` | Fare sheet — Solo (scrolled) | 1.4 | Convenience fee, totals, vehicle list |
| `ride_page(searched a place to go)(share route selected).png` | Fare sheet — Share | 1.4/1.5 | Split buyout, "min 3 seats" |
| `ride_page(searched a place to go-all-checked).png` | Fare sheet — Solo, all add-ons on | 1.4 | Special + luggage + privilege |
| `ride_page(confirmed_searching_for_available_riders).png` | Searching for driver | 1.4 | "Finding your ride…", free-cancel timer |
| `ride_page(rider_accepted_passenger).png` | Driver matched | 1.4 | Driver card, plate |
| `ride_page(arriving_at_destination).png` | En route / arriving | 1.4 | ETA, stepper, Share/SOS/End trip |
| `activity_page.png` | Activity / trip history | 1.7 | Spend/Saved/Distance, trip cards |
| `account_page.png` | Account (top) | 1.7 | Profile, account list |
| `account_page(1).png` | Account (scrolled) | 1.7 | Preferences, Log out |
| `wallet_page.png` | Wallet | 1.7 | Balance, methods, promos |
| `notifications.png` | Notifications | 1.7 | Notification list |

---

## Driver (`docs/figma/driver/`) — 23 files

| File | Screen / step | Flow | Purpose |
|---|---|---|---|
| `homepage.png` | Driver landing — "Drive Pakyaw" | 2.1 | Already a driver / Apply to drive |
| `clicked_already_a_driver.png` | Driver login — "What's your mobile?" | 2.2 | Phone entry |
| `verify_phone.png` | Enter PIN | 2.2 | PIN + biometric login |
| `clicked_apply_to_drive.png` | Apply carousel 1/3 — "Drive on your time" | 2.3 | Value prop |
| `clicked_apply_to_drive(1).png` | Apply carousel 2/3 — "Safer for everyone" | 2.3 | Value prop |
| `clicked_apply_to_drive(2).png` | Apply carousel 3/3 — "Get paid daily" | 2.3 | → Let's get started |
| `clicked_lets_get_started.png` | Application 1/6 — "What will you drive?" | 2.4 | Vehicle type grid |
| `vehicle_selected.png` | Application 2/6 — "Who are you?" (James, code 1234) | 2.4 | Identity + demo code |
| `vehicle_info(2).png` | Application 2/6 variant — "Who are you?" (Ricky) | 2.4 | Identity (no-code variant) **[GAP]** filename says vehicle_info |
| `vehicle_info.png` | Application 3/6 — "Tell us about your ride" | 2.4 | Plate/brand/model/year/color |
| `vehicle_info(1).png` | Application 4/6 — "Verify your papers" (empty) | 2.4 | Document upload (pristine) |
| `submit_for_review_clicked.png` | Application 5/6 — "Where do we send your money?" | 2.4 | GCash / bank payout |
| `driver_agreement.png` | Application 6/6 — "Sign your driver agreement" | 2.4 | 3 agreements → submit |
| `status_page_after_applying_page.png` | "You're under review" | 2.5 | Application status tracker |
| `drive_page(offline).png` | Drive — Offline | 2.6 | Map, power button, offline sheet |
| `clicked_online_buttton.png` | Go-online pre-flight checklist | 2.6 | "Ready to roll?" 6 checks |
| `drive_page(online).png` | Drive — Online | 2.6 | Heat map, today's earnings sheet |
| `earnings_page.png` | Earnings (top) | 2.7 | Net earnings, incentive, hourly strip |
| `earnings_page(1).png` | Earnings (scrolled) | 2.7 | Full breakdown rows |
| `wallet_page.png` | Driver wallet | 2.7 | Balance, cash out, transactions |
| `gcash_clicked.png` | Cash-out — GCash selected | 2.7 | Payout method + GCash mobile |
| `account_page.png` | Driver account | 2.8 | Profile, vehicle, documents |

**Unresolved [GAP] — document-verified state:** A screen showing all papers verified ("Looks great" / checkmarks, "Submit for review") appears in the captures; map it to the `vehicle_info` series. Confirm exact filename↔step pairing with the designer, since `vehicle_info(1)`/`(2)` and `vehicle_selected` filenames don't match their on-screen step numbers.

---

## Fleet Owner (`docs/figma/fleet_owner/`) — 15 files

| File | Screen / step | Flow | Purpose |
|---|---|---|---|
| `homepage.png` | Console landing — "Run your fleet" | 3.1 | Sign in / Register CTAs |
| `sign_in_page.png` | Operator sign-in | 3.2 | Work email + password, 2FA note |
| `dashboard_page.png` | Dashboard / Home tab | 3.3 | Revenue, KPIs, live trips |
| `drivers_page.png` | Drivers tab | 3.3 | Driver list, filters |
| `fleet_page.png` | Fleet tab | 3.3 | Vehicle cards, QR/idle/service |
| `reports_page.png` | Reports tab | 3.3 | Exports & insights |
| `clicked_register_a_new_fleet.png` | Register carousel 1/3 — "List your fleet" | 3.4 | Value prop |
| `clicked_register_a_new_fleet(1).png` | Register carousel 2/3 — "Dispatch & dashboard" | 3.4 | Value prop |
| `clicked_register_a_new_fleet(2).png` | Register carousel 3/3 — "Operator-first payouts" | 3.4 | → Register fleet |
| `register_new_fleet_page.png` | Register 1/6 — "Tell us who you are" | 3.4 | Company + legal structure |
| `register_new_fleet_page(1).png` | Register 2/6 — "How many vehicles?" | 3.4 | Fleet size slider |
| `register_new_fleet_page(2).png` | Register 3/6 — "What's in your garage?" | 3.4 | Vehicle mix steppers |
| `register_new_fleet_page(3).png` | Register 4/6 — "Upload your permits" | 3.4 | DTI/SEC, BIR, LTFRB |
| `register_new_fleet_page(4).png` | Register 5/6 — "Where do we send earnings?" | 3.4 | Bank / GCash |
| `register_new_fleet_page(5).png` | Register 6/6 — "A few promises before we go" | 3.4 | Agreements |
| `register_new_fleet_page(6).png` | "Review and submit" | 3.4 | Application summary |

---

## Screens referenced but NOT in Figma ([GAP] — design needed)

| Missing screen | Referenced by |
|---|---|
| Passenger forgot-password | — (none provided) |
| Discount-ID upload (passenger) | Account "Submit ID to unlock discount" |
| Post-trip rating + receipt (passenger) | Notifications "Tap to rate", Activity "View receipt" |
| Share fill / fallback / upgrade dialogs | Blueprint §4, §10C |
| Report Seat Abuse UI | Blueprint §5B |
| QR street-hail web portal | Blueprint §6 |
| Driver QR pairing scan | Blueprint §5C |
| Driver incoming-request card / accept-decline | Implied by accept-rate metric |
| Driver in-trip navigation / complete-trip | — |
| One-tap SOS active screen | FR-1.4.5 |
| Fleet "Revenue" tab | Fleet bottom nav |
| Admin / Operations dashboard | Blueprint §5A, §11 (anomaly & SOS alerts) |
| Pakyaw Perks / Pasabuy / Pasugo | Blueprint §7 |

---

## Phase 11 Screen Realignment

The following screen flows were fully realized and integrated in Phase 11:
- **`(passenger)/ride.tsx`**: Replaced static placeholder maps with a fully interactive `LiveMap` background. The screen hosts:
  - `BookingSheet`: Draft pickup & destination markers.
  - `SearchingSheet`: Added a "Cancel request" button.
  - `DriverMatchedSheet`, `EnRouteSheet`, `ArrivedSheet`: Added "Cancel ride" buttons and real-time driver tracking.
  - `InTripSheet`: Added "End trip" button.
- **`(driver)/drive.tsx`**: Replaced static placeholder maps with a fully interactive `LiveMap` background showing the driver's own location. The screen hosts:
  - `DriverAcceptedSheet`: Added "Start navigation" button.
  - `DriverEnRouteSheet`: Added "Arrived at pickup" button.
  - `DriverArrivedSheet`: Added "Start trip" button.
  - `DriverInTripSheet`: Added "End trip" button.
  - `DriverCompletedSheet` and `DriverCancelledSheet`: Renders the final state sheet with a "Done" button to teardown the active trip.

---

*Companion specifications: [architecture.md](./architecture.md) · [navigation.md](./navigation.md).*
