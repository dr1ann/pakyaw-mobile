@AGENTS.md

# Tech Stack

## Frontend
- React Native
- Expo (SDK 56 — see [AGENTS.md](AGENTS.md))
- TypeScript (strict)
- Expo Router
- NativeWind v4

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

# Architecture

- Follow [docs/architecture.md](docs/architecture.md) and [docs/design_system.md](docs/design_system.md). They are the source of truth for structure and visual tokens — these rules defer to them on any conflict.
- Thin route/controller layer; business logic lives in feature services.
- Use Zod for all external input (forms, network, storage boundaries).
- TanStack Query owns server state. Zustand owns client/global state. Do not mix.
- Prefer composition over duplication, but do not introduce abstractions until a second concrete consumer exists.

# Code Quality

- Strict TypeScript. No `any` — use `unknown` and narrow, or define the type.
- Never hardcode colors, spacing, or typography — use design tokens from [docs/design_system.md](docs/design_system.md).
- Keep components small and focused; reuse before creating.
- Keep changes scoped — do not modify unrelated files.

# Process

- Never assume APIs or behavior — check the code or the versioned docs first ([AGENTS.md](AGENTS.md) pins the Expo version).
- Before declaring a task complete, run `expo lint` and any tests that exist for the touched area.
