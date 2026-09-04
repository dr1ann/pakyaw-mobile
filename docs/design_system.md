# Pakyaw Mobile Design System (Phase 1 Foundation)

> Official design foundation for Pakyaw Passenger and Driver mobile applications.
> Aligned with `FIGMA_STYLE_MOBILE_PRODUCT_DESIGN_SKILL.md` and codebase tokens in `src/constants/theme.ts`.

---

## 1. Design Principles & Pakyaw Character

1. **Task-Oriented First**: Design around transport state, user intent, primary action, failure modes, and visual stability. Do not decorate for decoration's sake.
2. **Distinctly Pakyaw**: Friendly, local to Ormoc City, operationally sharp, highly readable outdoors, lightweight, and modern. Avoid generic AI startup templates, Bento dashboards on phones, or cloning Grab/Uber/Maxim.
3. **Map-Centric Awareness**: Protect map legibility. Group controls predictably, keep primary actions reachable, and never hide route context behind oversized sheets.
4. **State Stability**: Keep trip context, map camera, and primary action anchors stable across lifecycle transitions:
   - Driver: `Navigating → Arrived → Start Trip → End Trip`
   - Passenger: `Searching → Accepted → Driver Arriving → Driver Arrived → In Trip`
5. **Human UX Writing**: Active voice, sentence case, specific verbs (`Book Pakyaw`, `Try again`), zero backend/Firebase terminology, and no artificial urgency.

---

## 2. Color System & Semantic Roles

Defined in `src/constants/theme.ts`:

### 2.1 Brand & Core Accents
| Token | Value | Semantic Role |
|---|---|---|
| `colors.blue.primary` | `#2F80ED` | Primary brand action, active highlights, passenger primary buttons |
| `colors.blue.tint` | `#E8F1FE` | Selected card fill, icon chip background, secondary button fill |
| `colors.blue.deep` | `#0B1B3F` | Deep brand contrast |
| `colors.amber.primary` | `#F5A623` | Fares, ratings, pickup highlights, warning notices |
| `colors.amber.tint` | `#FDEFD8` | Warning surface, discount chips |
| `colors.amber.deep` | `#E07B00` | High-contrast amber text and emphasis |
| `colors.green.primary` | `#27AE60` | Driver availability ("Online"), trip start, success confirmations |
| `colors.green.tint` | `#E3F6EC` | Driver success badge background, verified status fill |
| `colors.violet.primary` | `#7B61FF` | Fleet accents, compass toggle active state |
| `colors.violet.tint` | `#EFEAFE` | Secondary fleet accent surfaces |
| `colors.cyan.primary` | `#00C6D7` | Pakyaw signature cyan accent |
| `colors.cyan.tint` | `#E0F9FB` | Soft cyan informational surface |

### 2.2 Semantic States
| Token | Value | Usage |
|---|---|---|
| `colors.success` | `#27AE60` | Operational clearance, arrived status, positive action |
| `colors.warning` | `#F2A93B` | Attention required, off-route warnings, expiring timer |
| `colors.danger` | `#EB5757` | Destructive action, error alerts, trip cancellation |
| `colors.dangerSubtle` | `#FDECEC` | Danger badge / chip / field background |
| `colors.info` | `#2F80ED` | Informational chips and notices |

### 2.3 Ink & Typography Colors
| Token | Value | Contrast & Role |
|---|---|---|
| `colors.ink[900]` | `#0E1726` | Primary headings, titles, high-emphasis text (15.6:1 contrast) |
| `colors.ink[700]` | `#33415C` | Body copy, prominent descriptions |
| `colors.ink[500]` | `#6B7689` | Secondary labels, timestamps, field hints (4.8:1 contrast) |
| `colors.ink[400]` | `#9AA4B2` | Placeholders, disabled states, subtle metadata |
| `colors.white` | `#FFFFFF` | Inverse text on brand buttons |

### 2.4 Surfaces & Overlays
| Token | Value | Role |
|---|---|---|
| `colors.surface.card` | `#FFFFFF` | Standard elevated cards, sheets, form fields |
| `colors.surface.muted` | `#F4F7FB` | Inactive backgrounds, disabled button surfaces |
| `colors.surface.bgPassenger` | `#EAF1FB` | Light cool background for passenger screens |
| `colors.surface.bgLight` | `#F7FAFE` | Crisp background for driver workflow |
| `colors.overlay` | `rgba(14, 23, 38, 0.5)` | Modal and sheet backdrops |
| `colors.border.subtle` | `#E6EBF2` | Card borders, dividers, grab handles |
| `colors.border.default` | `#CBD5E1` | Interactive control boundaries |
| `colors.border.focus` | `#2F80ED` | Input field focus boundary |
| `colors.border.danger` | `#EB5757` | Input field validation error boundary |

---

## 3. Typography (Montserrat)

Pakyaw standardizes on **Montserrat** across both apps. Loaded in `_layout.tsx` via `@expo-google-fonts/montserrat`.

### 3.1 Font Families
- `typography.family.regular`: `Montserrat_400Regular`
- `typography.family.medium`: `Montserrat_500Medium`
- `typography.family.semibold`: `Montserrat_600SemiBold`
- `typography.family.bold`: `Montserrat_700Bold`
- `typography.family.extraBold`: `Montserrat_800ExtraBold`

### 3.2 Semantic Type Scale
| Variant | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `hero` | 38 | 800 (ExtraBold) | 46 | Splash, onboarding hero titles |
| `display` | 32 | 700 (Bold) | 38 | Major feature headers |
| `h1` | 30 | 700 (Bold) | 36 | Primary screen titles |
| `h2` | 24 | 700 (Bold) | 32 | Modal & major section headers |
| `h3` | 18 | 600 (SemiBold) | 26 | Card titles, sheet headings |
| `bodyMd` | 16 | 500 (Medium) | 24 | Prominent body text, list titles |
| `body` | 15 | 400 (Regular) | 22 | Standard content, descriptions |
| `button` | 15 | 600 (SemiBold) | - | Primary / secondary button labels |
| `bodySmall` | 13 | 400 (Regular) | 20 | Sublabels, secondary trip info |
| `caption` | 12 | 400 (Regular) | 16 | Small hints, footnotes, legal |
| `label` | 11 | 600 (SemiBold) | - | Eyebrow badges, uppercase field labels (tracked `0.8`) |

---

## 4. Spacing & Radius Scales

### 4.1 Spacing Scale (4px base)
- `spacing[1]`: 4px
- `spacing[2]`: 8px
- `spacing[3]`: 12px
- `spacing[4]`: 16px (Standard card & element padding)
- `spacing[5]`: 20px (Standard screen horizontal padding)
- `spacing[6]`: 24px
- `spacing[8]`: 32px
- `spacing[10]`: 40px
- `spacing[12]`: 48px (Minimum touch target)
- `spacing[15]`: 60px
- `spacing[20]`: 80px

### 4.2 Radius Scale
- `radius.xs`: 4px (Sheet grab handles, fine progress bars)
- `radius.sm`: 10px (Small tags, chips, inner items)
- `radius.md`: 14px (Standard cards, text inputs)
- `radius.lg`: 20px (Bottom sheet top corners, dialog cards)
- `radius.pill`: 999px (Buttons, status pills, floating map action buttons)

### 4.3 Elevation & Shadows
- `shadow.none`: Flat surfaces
- `shadow.card`: Subtle lift for cards and inline modules (`elevation: 4, radius: 16, opacity: 0.08`)
- `shadow.float`: Floating map controls, bottom sheets (`elevation: 8, radius: 24, opacity: 0.1`)

---

## 5. Reusable Visual Primitives (`@pakyaw/shared/components/ui/`)

| Component | File | Primary Use |
|---|---|---|
| `Text` | `Text.tsx` | Semantic typography helper with variant, weight, and color mapping |
| `Button` | `Button.tsx` | Primary, secondary, outline, ghost actions with `destructive` tone |
| `Input` | `Input.tsx` | Standardized text input shell with focus/error state and 48px touch target |
| `Field` | `Field.tsx` | Form field container with uppercase label, hint, and error messaging |
| `Card` | `Card.tsx` | Padded surface container supporting `default`, `muted`, and `outlined` variants |
| `MapActionButton` | `MapActionButton.tsx` | Standard floating map control button (recenter, compass, layers) |
| `StatusPill` | `StatusPill.tsx` | Status chip with dot indicator, uppercase text, and semantic tone coloring |
| `IconChip` | `IconChip.tsx` | Icon container with tone tint background and standardized sizing |
| `Sheet` | `Sheet.tsx` | Modal bottom sheet with overlay backdrop and grab handle |
| `EmptyState` | `EmptyState.tsx` | Standard illustration, title, description, and action container |
| `Screen` | `Screen.tsx` | Safe area and scroll container with standardized screen background tokens |

---

## 6. Rules for Raw Values

1. **Colors**: Never use raw hex values (e.g. `#2F80ED`, `#EB5757`) in component stylesheets. Import `colors` from `@/constants/theme`.
2. **Spacing & Radii**: Use `spacing[*]`, `radius[*]`, and `shadow[*]`. Never invent arbitrary radii like `23px` or `17px`.
3. **Typography**: Always use `Text` or `typography.family.*` with `typography.size.*`. Do not set raw font sizes like `14` or `17` with system weights.
4. **Touch Targets**: All interactive elements must maintain at least 44x44px (preferably 48x48px) hit area.

---

## 7. Shared Foundation vs Role-Specific Nuance

### Consistent Across Passenger & Driver:
- Identical brand colors, semantic state tokens, neutral grayscale ink.
- Identical Montserrat typography family and type scale.
- Identical 4px spacing scale and radius definitions.
- Identical shared UI primitives (`@pakyaw/shared/components/ui/*`).
- Identical bottom sheet handle styling, radius (`radius.lg`), and backdrop overlay.

### Role-Specific Nuances:
- **Driver**: High-contrast outdoor readability, emerald green availability emphasis (`#27AE60`), compact operational controls, voice and maneuver banners.
- **Passenger**: Cool airy background (`#EAF1FB`), electric blue brand focus (`#2F80ED`), booking flow clarity, friendly destination cards.
