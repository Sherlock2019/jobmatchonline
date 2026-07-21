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
