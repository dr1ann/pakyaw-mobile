# Branch Identity — Read First

This checkout is the maintained **Pakyaw Driver app** when working on branch `driver-app`.

The mobile repository is intentionally split by role:

- `driver-app` = maintained Driver application.
- `passenger-app` = maintained Passenger application.
- `main`, `map-fix`, and other historical branches are not current implementation sources.

Before architecture, Firebase, matching, trip, onboarding, or shared-domain work, read [docs/branch_architecture.md](docs/branch_architecture.md). It overrides older documentation where older docs still describe one combined Passenger + Driver Expo binary. `BRANCH_SPLIT_MANIFEST.md` documents the original role split.

Do not add Passenger-only routes or flows to this branch. Changes under `packages/shared/` that affect both products must be intentionally reconciled with `passenger-app`; changing one Git branch does not automatically update the other.

Preserve the current server-authoritative integration. Do not reintroduce direct client authority over trip creation/assignment, offer claiming, fare, approval, or lifecycle state. Driver matching uses addressed `tripOffers` and backend callables such as `acceptTripOffer`.

---

# Tech Stack

## Frontend

- React Native
- Expo (SDK 56 — see [AGENTS.md](AGENTS.md))
- TypeScript (strict)
- Expo Router
- Vanilla React Native Stylesheet (using custom design tokens in `theme.ts`)

## State Management

- TanStack Query — server state only
- Zustand — client/global state only

## Forms and Validation

- React Hook Form
- Zod

## Backend

- Firebase
  - Authentication
  - Cloud Firestore
  - Storage
  - Cloud Functions integration for authoritative commands

## Notifications

- Expo Notifications
- Firebase Cloud Messaging (future)

## Maps and Geolocation

- Google Maps
- Expo Location

## Other

- Lucide React Native (icons)
- date-fns (dates)
- dotenv (env)

## Testing

- Vitest
- React Native Testing Library

## Code Quality

- ESLint
- Prettier
- Git

---

# Architecture

- Follow [docs/branch_architecture.md](docs/branch_architecture.md) first for branch ownership and current backend boundaries.
- Use legacy docs only when compatible with the maintained Driver branch and current code/tests.
- Thin route/controller layer; business logic lives inside feature services.
- Use Zod for every external input boundary (forms, network, storage, environment variables).
- TanStack Query owns server state.
- Zustand owns client/global state.
- Firestore subscriptions may feed live state where permitted; sensitive commands remain backend-authoritative.
- Do not duplicate sources of truth.
- Prefer composition over abstraction. Introduce abstractions only after a second concrete consumer exists.

---

# Code Quality

- Strict TypeScript.
- Never use `any`. Prefer `unknown` and narrow, or define proper types.
- Never disable TypeScript or ESLint rules to silence errors.
- Do not use `@ts-ignore` or `@ts-expect-error` unless absolutely unavoidable and accompanied by a clear explanation.
- Preserve runtime behavior while improving type safety.
- Keep components small and focused.
- Keep changes scoped to the requested task.
- Never hardcode colors, spacing, typography, or sizing. Use the design tokens from `docs/design_system.md`.

---

# Process

- Never assume APIs or library behavior. Verify against the current `driver-app` codebase or versioned documentation.
- Never use `main` or `map-fix` as the implementation reference for Driver work.
- Respect the Expo SDK version defined in [AGENTS.md](AGENTS.md).
- Before implementing, understand the existing architecture instead of introducing parallel solutions.
- Prefer fixing the root cause over patching symptoms.
- For shared-contract changes, inspect the corresponding maintained `passenger-app` contract before considering the work complete.

---

# Required Validation

Before considering any task complete, always run:

```bash
npm run typecheck
```

```bash
npm run lint
```

If tests exist for the modified area, also run:

```bash
npm test
```

or the smallest relevant test subset.

If any validation step fails:

1. Fix the issue.
2. Re-run the affected validation.
3. Repeat until all validation passes.

Never consider a task complete while TypeScript compilation, linting, or relevant tests are failing.
