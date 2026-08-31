# Phase 6 — Driver identity and eligibility boundary

Driver verification continues through the existing phone-authenticated account,
`driverApplications/{uid}`, reviewed
`drivers/{uid}/driverDocuments/{type}`, and Operations approval flow. The app
does not create a second onboarding or verification collection.

Operational eligibility is decided by the backend at the availability,
matching, and offer-acceptance boundaries. A Driver must have a matching
authenticated identity, an active non-suspended account, an approved
application, approved required documents, current Philippine-calendar expiry
dates, and valid safe vehicle identity. The mobile app only displays the
public-safe reason returned by the backend when going online is blocked.

Accepted Trips carry the backend-generated `driverPublic` snapshot. This app
does not authoritatively write that field or read private Driver identity data
to populate a Trip. Passenger-safe snapshots contain only the Driver ID,
display name, optional profile photo, safe vehicle fields, and
`verification.verified`; they exclude license, OR/CR, franchise, address,
emergency-contact, reviewer, suspension, and audit data.

The old `scripts/create-driver.mjs` client-side provisioning helper was removed
because its placeholder `approved` Driver document bypassed the canonical
application/document architecture. Controlled pilots must be provisioned with
complete approved records through the Admin/backend process or explicit test
fixtures; there is no runtime verification bypass.

The Driver app remains a Firebase client. It cannot deploy Firebase backend
configuration, and it cannot directly claim Trips, mutate lifecycle state, or
write `driverPublic`.
