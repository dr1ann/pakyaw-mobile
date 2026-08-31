# Fare Engine Boundary

Transport fare display and server-generated fare snapshots are part of the
current V1 contract. This legacy client helper is not an authority for quote
or booking calculations; those remain backend-owned. Do not add wallet,
stored-value, payment-processing, settlement, payout, or PSP behavior here.
`check:no-money` enforces that deferred payment domain while allowing ordinary
transport fare and Driver-earnings presentation.
