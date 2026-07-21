# Build decisions — JobsMatchNow upgrade

Ambiguities resolved in favor of the simplest option consistent with the
"mutual intent + coaching" positioning.

## Item 2 — Auth flows

- **Mock SSO lands on pre-made provider accounts.** "Continue with LinkedIn/Google"
  simulates the OAuth round-trip (~0.9s) and signs in as `sso-linkedin-demo` /
  `sso-google-demo`, whose name/email/photo play the role of the provider profile.
  When SSO is used from the **Register** screen, the chosen role (candidate vs
  company/headhunter) is applied by running the same identity through the register
  endpoint, so one code path covers both.
- **Registration is idempotent by email.** Registering twice with the same email
  logs back into the existing account instead of erroring — friendlier for a demo.
- **SSO demo accounts are excluded from the login dropdown** — they are reached via
  the provider buttons; the dropdown lists every other seeded (and newly registered)
  profile as "Name — Candidate/Recruiter".
- **The workspace role switch stays**, repurposed: it jumps between the flagship
  demo personas (`candidate-demo` / `employer-demo`) so a presenter can flip sides
  quickly. Real identity comes from the session, not a hardcoded demo user.
- **Session is sessionStorage-only** (no server-side session): consistent with the
  demo's "instant login" positioning; the `AuthProvider` interface in
  `src/lib/auth.ts` is where a real OAuth/token flow would plug in.
- **Seed additions are merged idempotently at server start** (by id), so existing
  `data/db.json` files pick up new demo accounts without a reset.

## Item 3 — Mobile landing + "Mobile view" toggle

- **The mobile layout is a separate component** (`MobileLanding`), selected via a
  `matchMedia('(max-width:767px)')` hook rather than CSS-only, because its DOM
  order (mockup → pitch → CTAs → accordion) differs from the desktop landing.
- **All marketing copy lives verbatim in `src/content/landingContent.ts`**; the
  desktop comparison table imports the same 11 rows, so both layouts can't drift.
- **The "Mobile view" toggle previews the mobile landing** inside a 390px device
  frame. Auth modals opened inside the frame render full-screen (they're
  portal-level overlays), and completing login exits the preview into the real
  workspace — the frame is a marketing preview, not a full app emulator.
- The comparison content keeps the existing repo copy (it matches the brief's
  intent and was already written for this product).

## Item 4 — Candidate profile model, wizard, page

- **Dual skill representation.** Skills/languages are stored as detailed objects
  (`skillsDetail: {name, level}`) while the plain name arrays (`skills`,
  `languages`) are derived on every save — the existing matching engine and card
  UI keep working unchanged.
- **`seniority` also writes `experienceLevel`** so the fit score sees the wizard's
  answer; `exec` was appended to the experience ladder.
- **Completeness is computed server-side** on every profile save (70% weight on
  required fields, 30% on optionals) — a single source of truth for the % shown
  anywhere.
- **Wizard saves per step** (PATCH on Continue), so a half-finished onboarding
  survives a refresh; the final step clears the `onboarding` flag.
- **Resume upload ships in item 4 as raw-body PDF/DOCX storage** under
  `server/uploads/resumes/` (gitignored) with metadata in the store; conversion,
  thumbnails, viewer, and anonymization arrive with item 6.
- **Photo is a URL field** (pre-filled by mock SSO); no binary avatar upload —
  keeps the demo dependency-free.

## Item 5 — Recruiter profile (company & headhunter)

- **Two wizard steps** (Organization → Contact & finish): the brief enumerates one
  branching form plus shared contact fields, so a 4-step ceremony would be padding.
- **The account-type switch lives in step 1** and can be flipped mid-wizard; both
  branches write to the same user record, and completeness is computed per-branch.
- **Startup seed merge now backfills absent fields** on existing seed records
  (never overwriting edits), so older dev databases gain the new recruiter fields.
- The old generic profile view was removed; candidates and recruiters each have a
  dedicated profile page with per-section edit buttons.
