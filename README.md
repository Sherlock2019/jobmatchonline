# JobMatch 3

JobMatch is a two-sided, mutual-intent hiring product for candidates and recruiting teams. It combines a swipeable discovery experience with explainable fit scores, recruiter pipelines, messaging, hiring analytics, and a LinkedIn-ready integration layer.

## Product surfaces

- Candidate workspace: explainable job recommendations, touch/drag matching, mutual matches, messages, preferences, and privacy controls.
- Recruiter workspace: ranked talent discovery, pipeline stages, jobs, response-quality metrics, and candidate conversations.
- Web and desktop: responsive PWA that can be installed from supported browsers.
- Mobile: Capacitor projects are included in `ios/` and `android/` and share the production web codebase.
- LinkedIn: OpenID Connect sign-in and basic profile import are implemented server-side. A disabled-by-default Talent Solutions adapter maps jobs for partner sync.

## Local development

Requirements: Node.js 20+.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:3000` and the API at `http://localhost:3001`. The demo database is created at `data/db.json` on first start.

### Test immediately on a phone

Put the phone and computer on the same Wi-Fi, then run:

```bash
npm run mobile
```

The launcher starts the complete app, finds the computer's local-network address, and prints a QR code to scan. Keep the launcher open while testing. On Windows, double-click `launch-jobmatch-mobile.cmd`; it requests one administrator confirmation, opens a temporary private-Wi-Fi route into WSL, and automatically removes that firewall rule and route when the launcher closes. On Linux/WSL with directly reachable networking, use `./launch-mobile.sh`.

If the phone cannot connect, allow Node.js through the computer firewall for private networks. You can override address detection with `MOBILE_HOST=192.168.x.x npm run mobile`.

Validation:

```bash
npm test
npm run lint
npm run build
```

## LinkedIn configuration

1. Create an application in the LinkedIn Developer Portal and add the “Sign In with LinkedIn using OpenID Connect” product.
2. Copy `.env.example` to `.env` and configure `SESSION_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and the exact HTTPS `LINKEDIN_REDIRECT_URI` registered in LinkedIn.
3. Keep the client secret server-side. The included OAuth flow uses `state`, short-lived signed cookies, least-privilege `openid profile email` scopes, a server-side code exchange, and an HttpOnly login session.

OpenID Connect provides basic member identity data; it must not be marketed as identity verification. LinkedIn job posting and recruiting APIs are restricted partner products. `LINKEDIN_TALENT_SYNC_ENABLED` must remain `false` until LinkedIn provisions the application and an agreement is in place.

Official references:

- [LinkedIn authorization code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [LinkedIn Job Posting API access](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview)

## iOS and Android

Set `VITE_API_BASE_URL` to the public HTTPS API before producing a native build, then sync the web bundle:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Android Studio is required for Android signing and release bundles. Xcode on macOS with an Apple Developer account is required for iOS signing, associated domains, and App Store delivery. The `jobmatch://auth/linkedin` callback is registered in both native projects; use verified universal/app links before public release to reduce custom-scheme interception risk.

## Production hardening checklist

The repository is a production-oriented product foundation, not a claim that infrastructure and partner credentials already exist. Before public launch:

- Replace the JSON demo store with PostgreSQL and transactions; move sessions and OAuth state to Redis or another shared encrypted store.
- Add your identity provider, MFA options for recruiters, organization membership, RBAC, audit events, account deletion, and recovery flows.
- Encrypt provider tokens with a managed KMS and never return them to the browser.
- Add object storage and malware scanning for resumes and employer assets.
- Run matching asynchronously, version scoring models, add bias/fairness evaluation, and give people a recommendation appeal/control surface.
- Add consent records, retention policies, privacy export/deletion, regional data controls, accessibility audits, observability, backups, incident response, and legal review.
- Add API rate limiting at the edge, CSP and security headers, bot protection, structured logs, metrics, traces, and alerting.
- Add unit, API integration, end-to-end, accessibility, mobile-device, and load test suites to CI.
- Complete Apple/Google signing, privacy manifests, store metadata, deep links, push notifications, and release-channel automation.

## Architecture

- `src/`: React/Vite responsive client and installable PWA.
- `server/`: Express API, matching rules, validation, OAuth, integrations, and demo persistence.
- `server/matching.js`: deterministic and unit-tested scoring, daily allowance, and reciprocal-match detection.
- `server/integrations/linkedin.js`: LinkedIn OAuth and job payload adapter.
- `ios/`, `android/`: generated Capacitor native shells.

The matching engine intentionally returns the evidence behind each score. Mutual matches are created by the API only after reciprocal intent, and duplicate swipes are idempotent.
