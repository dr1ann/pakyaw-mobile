# Driver Onboarding Form UX and Validation Implementation Plan

Status: planning only; no application code is changed by this document.

## Objective

Improve the driver registration and application forms so applicants can distinguish required and optional fields, understand unfamiliar transport identifiers, enter only appropriate characters, select expiry dates safely, see successful private-document uploads, and carry their pre-OTP name into the post-OTP application.

The implementation must preserve the canonical Pakyaw contract, Firebase security boundaries, private document paths, and Expo SDK 56 compatibility.

## Authoritative constraints

1. The canonical user record remains `users/{uid}` with `name` and `mobile`. Do not add canonical `firstName`, `middleName`, `lastName`, `phone`, or `phoneNumber` aliases.
2. The canonical driver application continues to store `personalDetails.fullLegalName`; the requested First/Middle/Last fields are registration UI fields that compose the canonical `name` value.
3. Middle name is optional. First name and last name are required.
4. After OTP succeeds, the application screen reads the authenticated user's canonical profile and prefills `fullLegalName` from `users.name`. The verified phone identity continues to prefill `verifiedMobile` from Firebase Auth. An existing saved application always takes precedence over profile defaults.
5. The client never writes approval, review, audit, account-status, matching-availability, or privileged document fields.
6. Required private document keys remain exactly `drivers_license`, `orcr`, and `franchise`.
7. Dates remain stored as `YYYY-MM-DD`, with the existing Asia/Manila end-of-day expiry semantics.

## Official-source findings and validation boundary

| Field | Official evidence | Implementation decision |
| --- | --- | --- |
| Applicant name | The LTO medical-evaluation form presents the applicant name as Last, First, Middle. | Collect separate First Name, optional Middle Name, and Last Name before OTP, then compose the canonical full name without changing the Firestore contract. |
| Plate number | LTO circulars document multiple valid schemes, including old, special, new-design, motorcycle, electric, and vintage variants. | Do not impose one universal plate regex. Convert letters to uppercase, reject unrelated punctuation/emoji, trim repeated spaces, and explain that the value must match the plate or current registration document exactly. |
| Motor Vehicle File Number | LTO plate-processing guidance describes a 15-digit numeric Motor Vehicle File Number without spaces or dashes. | Do not apply that rule to the current `orcrNumber` field because “OR/CR number” is ambiguous and may refer to a different printed identifier. Explain where to look and accept a conservative identifier character set. A future contract change may rename this specifically to `mvFileNumber` and then enforce 15 digits. |
| Driver's license number | No sufficiently authoritative source reviewed here establishes one universal current-and-legacy input format. | Do not invent an exact regex. Normalize uppercase and accept letters, digits, spaces, and hyphens only. |
| LTFRB franchise number | Official LTFRB records show case-number examples, but they do not establish one universal format for every franchise document and region. | Do not invent an exact regex. Ask the applicant to copy the identifier exactly from the CPC, PA, or applicable franchise document and allow conservative identifier characters. |

Official references reviewed:

- [LTO medical evaluation form showing Last, First, Middle name fields](https://lto.gov.ph/wp-content/uploads/2024/02/MC-VDM-2024-2525.pdf)
- [LTO new plate-number series and classifications](https://www.lto.gov.ph/wp-content/uploads/2023/10/MC_vpt_2013_1772.pdf)
- [LTO plate-processing guidance covering old/special/new plate formats and the 15-digit MV File Number](https://www.lto.gov.ph/wp-content/uploads/2023/10/praos_18feb2015.pdf)
- [LTO electric and vintage plate-series assignments](https://www.lto.gov.ph/wp-content/uploads/2023/10/MEMO_12092022_Plate_Series.pdf)
- [LTFRB official record containing franchise case-number examples](https://ltfrb.gov.ph/wp-content/uploads/2021/06/Provisional-Authority-compliance.pdf)

## Planned form behavior

### Registration before OTP

Replace the single Full Name input with:

| Input | Required | Placeholder | Input behavior |
| --- | --- | --- | --- |
| First Name | Yes | `Juan` | Trim surrounding/repeated spaces; permit legitimate Unicode letters, spaces, apostrophes, periods, and hyphens; reject digits and unrelated symbols. |
| Middle Name | No | `Santos (optional)` | Same name-character policy; omission must not produce an extra space in the composed name. |
| Last Name | Yes | `Dela Cruz` | Same name-character policy. |
| Mobile Number | Yes | `0917 123 4567` | Accept the existing `09xxxxxxxxx`, `9xxxxxxxxx`, or `+639xxxxxxxxx` forms; reject letters and unrelated symbols; normalize to `+639xxxxxxxxx` before Firebase Auth. |
| SMS Code | Yes after send | `6-digit verification code` | Digits only, maximum length six, and Verify remains disabled until exactly six digits are present. |

Terms of Service and Privacy Policy acceptance remain required and receive visible required indicators.

Compose the profile name as `First + optional Middle + Last`, with normalized spaces. Keep `createVerifiedDriverProfile` responsible for writing the existing canonical `name` and normalized `mobile` fields.

### Application after OTP

Use a canonical-profile query/service scoped to `users/{auth.uid}`. When there is no saved driver application:

- `personalDetails.fullLegalName` defaults to the canonical `users.name` created before OTP.
- `personalDetails.verifiedMobile` defaults to `auth.currentUser.phoneNumber` and remains read-only.
- A loading state prevents the empty form from winning a race against the profile fetch.
- A missing/mismatched profile produces a user-safe retry/error state rather than silently saving blank identity data.

When a saved application exists, its values remain authoritative so later profile reads never overwrite driver edits or correction work.

### Required markers, placeholders, and help

Build one reusable onboarding field component rather than duplicating label logic. It will support:

- A visible red `*` on every contract-required input, required switch/choice, required consent, OTP code when visible, and each required private document.
- An explicit `(optional)` label on Middle Name.
- A placeholder on every editable text input.
- A small accessible `?` button beside complex or exact-format labels.
- A help dialog or compact modal with a clear title, short explanation, example, close action, screen-reader label, and at least a 44-by-44-point touch target.
- Inline field errors in human-readable text; raw issue codes remain internal.

Help is required for:

- Mobile Number and SMS Code
- Barangay Address
- Emergency Contact Mobile
- Plate Number
- Unit/Body Number
- Vehicle Description
- Owner/Operator Information and the ownership switch
- OR/CR Number and OR/CR Expiry
- Driver's License Number and Expiry
- Franchise Type, Franchise Number, and Expiry
- Each private document type

Suggested placeholders/help examples are guidance, not accepted fake values:

| Field | Placeholder/example guidance |
| --- | --- |
| Full legal name | Prefilled from the verified profile, for example `Juan Santos Dela Cruz` |
| Barangay address | `House/Street, Barangay, City or Municipality` |
| Emergency contact name | `Maria Dela Cruz` |
| Emergency contact mobile | `0917 123 4567` |
| Plate number | `Enter exactly as shown on the plate or CR` |
| Unit/body number | `Enter the fleet, operator, or body number shown on the vehicle` |
| Vehicle description | `White Toyota Vios, 2022` |
| Owner/operator information | `Registered owner or operator name` |
| OR/CR number | `Enter the identifier shown on the latest OR/CR` |
| Driver's license number | `Enter exactly as printed on the license` |
| Franchise type | `CPC, PA, or document type shown on the franchise` |
| Franchise number | `Enter exactly as printed on the franchise document` |

## Input control and validation strategy

Use pure input-normalization helpers so validation behavior is testable outside React:

1. `sanitizeNamePart` permits name-appropriate Unicode characters and normalized spacing without corrupting legitimate Filipino names.
2. `sanitizeOtpCode` keeps digits only and caps input at six characters.
3. Mobile input allows only a leading `+` and digits while the existing Philippine normalizer remains the submission authority.
4. `sanitizeIdentifier` uppercases and permits letters, digits, spaces, and hyphens for plate, OR/CR, license, unit/body, and franchise identifiers. Field-specific reasonable maximum lengths prevent accidental oversized input, but uncertain government identifiers do not receive speculative exact-pattern rejection.
5. Multiline descriptive fields retain normal punctuation and receive length limits rather than numeric filtering.
6. Submission readiness remains enforced by `getSubmissionReadiness(application, now)`; UI restrictions supplement but never replace domain validation.
7. Stable validation issue codes map to friendly section-level and field-level messages through one translation table.

## Expiry date inputs

Replace free-text OR/CR, driver's license, and franchise expiry fields with a reusable native date field. Although OR/CR expiry is the reported problem, all three canonical expiry fields should behave consistently.

Implementation approach:

1. Install the Expo SDK 56-compatible picker with `npx expo install @react-native-community/datetimepicker`; the versioned Expo documentation currently recommends 9.1.0.
2. Present a pressable read-only field that opens the platform date picker instead of accepting keyboard input.
3. Format the selected calendar components directly as `YYYY-MM-DD`; do not use a UTC conversion that can shift the date by one day.
4. Display a localized readable date while retaining the canonical ISO date-only value in form state.
5. Prevent selection of an already expired date where supported, while preserving the shared validator as the final expiry check.
6. Support clearing/changing a date only while the application is editable.
7. Because this adds a native module, inspect native changes, run `npx expo prebuild --clean`, rebuild the development client, review the generated diff, and perform a physical-device check as required by `AGENTS.md`.

Expo SDK 56 references:

- [Expo SDK 56 DateTimePicker](https://docs.expo.dev/versions/v56.0.0/sdk/date-time-picker/)
- [Expo SDK 56 DocumentPicker](https://docs.expo.dev/versions/v56.0.0/sdk/document-picker/)

## Private-document success state

Enhance each required document row without weakening privacy:

- Show the required `*`, plain-language document name, current state, help button, and upload/replace action.
- Show a green check and `Uploaded privately` only after the Storage upload and permitted metadata/application update both succeed.
- Show a distinct approved check for `approved`.
- Do not show a success check for `missing`, `rejected`, or `expired`; show a corrective action instead.
- Use a progress indicator during selection/upload and retain the existing retry-safe error message.
- Derive the durable state from the driver's subscribed application/document metadata, not from a permanent optimistic local Boolean.
- Preserve the canonical private path and never expose a public download URL.

## Planned file changes

The exact component split may be adjusted after focused tests, but implementation should remain within these boundaries:

- `src/app/(auth)/driver-register.tsx`
  - Separate name fields, required markers, placeholders, OTP filtering, and composed canonical name.
- `src/app/(driver)/application.tsx`
  - Profile prefill, reusable labeled inputs, date pickers, contextual help, placeholders, friendly issues, and document success indicators.
- `src/features/onboarding/components/ApplicationField.tsx` (new)
  - Required/optional label treatment, placeholder wiring, inline errors, and accessible help trigger.
- `src/features/onboarding/components/FieldHelpDialog.tsx` (new)
  - Shared accessible help presentation.
- `src/features/onboarding/components/ExpiryDateField.tsx` (new)
  - Expo SDK 56-compatible native date selection and canonical date-only formatting.
- `src/features/onboarding/components/DocumentUploadRow.tsx` (new)
  - Private upload status/check, progress, retry, and replacement presentation.
- `src/features/onboarding/field-config.ts` (new)
  - Required flags, placeholders, help text, input modes, and safe length limits.
- `src/features/onboarding/input-validation.ts` (new)
  - Pure sanitizers, name composition, identifier normalization, and date-only helpers.
- `src/features/onboarding/services/driver-registration.service.ts`
  - Accept composed name input without changing the canonical Firestore payload.
- `src/features/onboarding/services/driver-application.service.ts` or a focused profile-default service
  - Read only the authenticated canonical profile needed for initial application defaults.
- `src/features/onboarding/hooks/useDriverApplication.ts`
  - Coordinate profile/application loading and ensure saved applications win over defaults.
- `package.json` and `package-lock.json`
  - Add only the Expo-installed date-picker dependency.

Do not modify the canonical `DriverApplication` shape or add legacy identity aliases merely to support UI state.

## Test plan

### Pure unit tests

- Required First Name and Last Name; optional Middle Name.
- Correct name composition with omitted middle name and normalized whitespace.
- Legitimate apostrophes, hyphens, periods, spaces, and Unicode letters remain valid.
- Digits and unrelated symbols are removed/rejected from name-only inputs.
- OTP accepts digits only, caps at six, and cannot verify at fewer than six digits.
- Philippine mobile variants normalize exactly as the existing contract requires.
- Identifier normalizers uppercase and reject unrelated punctuation without imposing unverified LTO/LTFRB formats.
- Date selection produces the intended `YYYY-MM-DD` in Asia/Manila and does not shift around UTC boundaries.
- Friendly issue mapping covers every existing onboarding validation code.

### Registration and application tests

- Profile creation writes one combined canonical `name`, normalized `mobile`, and no first/middle/last aliases.
- OTP send remains disabled until required name/consent/mobile inputs are valid.
- OTP success routes to the application and the canonical name/mobile appear after the profile loads.
- A saved draft takes precedence over profile defaults.
- A missing profile or profile-read failure shows a safe retry state.
- Every required field/document displays `*`; Middle Name displays `(optional)`.
- Complex fields expose accessible help and every editable input has a placeholder.
- Date fields cannot receive arbitrary keyboard text and return canonical date-only values.
- Upload success shows a check only after the private upload/update completes; failed uploads do not show success.
- Rejected/expired documents show replacement guidance; read-only application statuses prevent replacement.
- Submission remains disabled until canonical readiness succeeds.

### Regression gates

Run from `app-driver/`:

```text
npm run typecheck
npm run lint
npm test
```

Also run `npm run check:no-money` if implementation touches shared scanning paths or booking/pricing files. It should not be necessary for this onboarding-only change unless the changed-file scope expands.

## Native and physical-device smoke test

After installing the date-picker dependency:

1. Review the dirty worktree and preserve all unrelated native changes.
2. Run `npx expo prebuild --clean` from `app-driver/`.
3. Rebuild and reinstall the Android development client; restarting Metro alone is insufficient for a newly added native module.
4. Start Metro with a clean cache only if needed and connect the physical device over the same LAN or an explicitly selected tunnel.
5. On the device, verify:
   - First/Middle/Last input behavior, required indicators, and placeholders.
   - OTP accepts only six digits and reaches the application.
   - The canonical name and Firebase phone are prefilled after OTP.
   - Every help button opens readable guidance and is accessible.
   - All three expiry controls open the native picker and save the selected date without a one-day shift.
   - All three private documents show progress, a successful private-upload check, retry on failure, and no false success.
   - Save draft, reload, correction editing, and read-only statuses preserve data.

Record the device/OS, development-client build, test Firebase project, fictional test account, date selections, document states, and pass/fail result without capturing secrets or real personal documents.

## Definition of done

- The requested UX is present without changing canonical Firestore identity/application shapes.
- Exact validation exists only where the format is authoritative and unambiguous.
- Uncertain LTO/LTFRB identifiers remain usable with guidance and safe character/length controls.
- Name and phone reliably prefill after OTP, with saved applications taking precedence.
- Private upload success is visible and reflects durable state.
- Typecheck, lint, the full test suite, native regeneration/rebuild, and physical-device smoke tests pass.
- The final diff contains no Gradle cache, Firebase logs, credentials, public document URLs, generated build output, or unrelated user changes.
