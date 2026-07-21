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

## Item 6 — Resume upload + in-app viewer

- **Runtime tool detection**: LibreOffice (`soffice`) and `pdftoppm` are probed
  once per process. On this demo host neither exists, so DOCX renders via
  mammoth HTML and page-1 thumbnails are generated in the uploader's browser
  with pdf.js and posted back (`needsClientThumbnail` handshake).
- **Text extraction uses pdfjs-dist (Node legacy build) for PDFs** and mammoth
  for DOCX — no native dependencies.
- **Anonymization order matters**: emails/phones/links are redacted before the
  candidate's name tokens, so the name pass can't break the email pattern.
- **Access rule is viewerId-based** (owner, or recruiter with a mutual match) —
  demo-level enforcement matching the app's sessionless auth; noted as the seam
  where real session auth would go.
- **Every seed candidate gets a generated one-page PDF resume at server start**
  (with visible contact details, so the anonymized preview is demonstrable),
  written by a ~40-line built-in PDF writer — keeps `./startdemo.sh` self-
  sufficient with zero external calls.
- **Pre-match thumbnails are CSS-blurred** on the recruiter card; deck candidates
  are served without email/phone fields pre-match.

## Item 7 — Job postings: create + import

- **Weighted skills reuse the wizard's LevelTagInput** capped at 3 dots (weight
  1–3); names are derived into `requiredSkills` so existing matching/UI work
  unchanged until item 8 consumes the weights.
- **`salaryRange` is the structured source of truth**; the display string
  `salary` is formatted server-side on every save.
- **Responsibilities and interview steps use the tag input as bullet/step
  builders** (Enter per bullet) instead of a bespoke editor.
- **JobSourceAdapter lives client-side** (`src/lib/jobSources.ts`); the paste
  adapter posts URL+text to `/api/jobs/parse`, which uses the Claude API when
  `ANTHROPIC_API_KEY` is set and a dictionary/regex heuristic parser otherwise
  (also the fallback on any API failure). No scraping — the URL is stored as a
  reference only.
- **Demo import picks a random bundled sample** from
  `src/content/jobSamples.ts`; a sample pasteable posting is one click away in
  the paste panel so the parser is demoable without leaving the app.
- **Import fills the same editor form as the review screen** — imported values
  are editable before saving, satisfying "review before saving" without a
  second UI.

## Item 8 — Matching core

- **Factor weights**: skills 40%, seniority 15%, salary 15%, distance 10%,
  work mode 10%, employment type 10%. Languages no longer carry weight (the
  brief doesn't list them) but stay in the evidence.
- **Unknown factors score neutrally** (0.5–0.7) rather than zero, so half-filled
  demo profiles still get sensible scores; every neutral factor says so in its
  evidence line ("not set yet"), doubling as a completion nudge.
- **Cross-currency salary comparison returns 'unknown'** — honest, and avoids
  baking exchange rates into a demo.
- **"Above your expected range" scores 0.8** and gets its own (positive) badge —
  a role paying more than expected is not a mismatch.
- **Recruiter decks score candidates against that recruiter's first active
  job** (falling back to any of their jobs, then the first job in the store).
- **The flip card is CSS 3D** on the existing swipe card; the "Why this match"
  button stops pointer capture so flipping never fights the drag gesture.
- **Salary reveal**: deck cards carry `salaryHidden` + a server-computed
  `salaryStatus` badge; exact ranges appear only in match-expanded payloads
  (both directions at once, shown in the match modal).

## Part B — Coaching features (items 9–12)

- **Committed as one unit**: the four features share one generation module
  (`server/coaching.js`) and one UI module, so per-item commits would have been
  artificial slices of the same files.
- **Generation strategy** (shared by prep and kits): Claude API when
  `ANTHROPIC_API_KEY` is set, otherwise a skill-keyed question bank with
  template fallbacks; results cached on the job (`prepCache`) / match
  (`kitCache`) records as the brief requires.
- **The "Prepare" tab lives in a job-detail modal** opened from the card's
  "Full role" button — the app had no job detail view before; a modal keeps the
  deck flow intact.
- **Screening answers ride the like-swipe** (stored on the swipe record) and are
  joined onto matches at read time, so pre-existing matches and both swipe
  orders work. Candidates can skip the form; the like still counts.
- **Recruiter surface for answers + kits** is the pipeline tile (click a
  candidate) — that is where recruiters already work their matches.
- **Gap coach adds skills at level 3/5** ("have it" ≠ "expert") and re-runs the
  bootstrap so every score updates live; unadded skills stay visibly listed as
  honest gaps.
- **Screening questions auto-suggest at job creation** when none are provided,
  and the editor has a "Suggest from required skills" button (max 3 questions).
