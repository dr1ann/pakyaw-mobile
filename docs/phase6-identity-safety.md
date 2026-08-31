# Phase 6 — Passenger-facing Driver identity

Passenger phone authentication and the existing account boundary remain in
place. A Passenger does not perform Driver KYC and does not read
`users/{driverId}`, Driver applications, reviewed documents, or verification
Storage files to render a ride.

After backend-authoritative acceptance, the Passenger consumes the Trip's
historical `driverPublic` snapshot. The canonical snapshot contains only the
Driver ID, display name, optional profile photo, safe vehicle fields, and
`verification.verified`. It intentionally excludes license, OR/CR, franchise,
address, emergency-contact, reviewer, suspension, audit, phone, and rating
data.

Missing identity, photo, rating, and ETA data is shown as unavailable or hidden;
the client never fabricates a Driver name, plate, vehicle, rating, photo, or
ETA. Historical Trips without a valid canonical snapshot remain readable and
show neutral identity states.

The Passenger app remains a Firebase client. It cannot deploy Firebase backend
configuration or authoritatively write `driverPublic`, Driver assignment,
Trip lifecycle, or Shared Ride state.
