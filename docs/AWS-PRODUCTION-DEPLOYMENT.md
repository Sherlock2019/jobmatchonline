# JobsMatchNow AWS production deployment

This guide describes the recommended public-release architecture. The current EC2 deployment is suitable for an MVP pilot; it is not a substitute for a managed database, multi-instance API, monitoring, backups, and signed store releases.

## Architecture

| Layer | Current MVP | Recommended AWS production service | Release gate |
|---|---|---|---|
| Web frontend | React 19 + Vite PWA | AWS Amplify Hosting, or S3 + CloudFront | CI build, CSP, accessibility and browser tests |
| Mobile | Capacitor iOS/Android; isolated Expo Go preview | Signed TestFlight and Google Play tracks; EAS or native CI | Store accounts, signing, privacy forms and review |
| API | Node.js + Express REST API | ECR image on ECS Fargate behind an Application Load Balancer | At least two tasks across Availability Zones |
| Database | JSON store for MVP validation | RDS PostgreSQL, encryption, automated backups, Multi-AZ | Schema migrations and restore test |
| Geolocation | City and private distance-range filter | PostgreSQL + PostGIS geography index | Store coarse search coordinates; never return exact coordinates |
| Identity | Signed session cookie and LinkedIn OAuth adapter | Cognito/OIDC plus Secrets Manager | Verified redirect URIs, key rotation and account deletion |
| Media | External demo images | Private S3 bucket with presigned uploads and CloudFront | Malware/type validation and lifecycle rules |
| Observability | Health endpoint and service restart | CloudWatch logs, metrics, alarms, dashboards and tracing | Alert runbook and synthetic smoke tests |
| Edge security | Nginx + TLS on the MVP host | Route 53, ACM, AWS WAF and rate limiting | HSTS, CSP, origin protection and abuse controls |

## 1. Create separate AWS environments

Use separate `staging` and `production` accounts or, at minimum, separate VPCs, databases, secrets, domains, and deployment roles. Enable MFA, AWS Budgets, CloudTrail and least-privilege IAM before moving user data.

## 2. Deploy the web frontend

1. Connect the repository to AWS Amplify Hosting.
2. Set the build command to `npm ci && npm run build` and the artifact directory to `dist` for the Vite application.
3. Configure `staging.jobsmatchnow.com` first, then `jobsmatchnow.com` after acceptance testing.
4. Let Amplify/ACM provision TLS and configure the GoDaddy DNS records it provides.
5. Add security headers: Content-Security-Policy, HSTS, Referrer-Policy, Permissions-Policy and X-Content-Type-Options.

AWS supports managed custom domains and certificates for Amplify Hosting: <https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html>.

## 3. Containerize and deploy the API

1. Add a production Dockerfile that runs as a non-root user and exposes only the API port.
2. Push versioned images to Amazon ECR; never deploy the `latest` tag alone.
3. Run at least two ECS Fargate tasks in private subnets across two Availability Zones.
4. Put an Application Load Balancer in public subnets and expose only HTTPS.
5. Configure `/api/health` for target health checks and enable deployment rollback.
6. Allow the ECS security group to reach only the database and required external APIs.

## 4. Replace the MVP JSON store with PostgreSQL

Create an RDS PostgreSQL instance with encryption, automated backups, deletion protection and Multi-AZ for production. Use a migration tool and normalized tables for users, companies, jobs, preferences, swipes, matches, conversations, audit events and OAuth connections.

For Geolocation of Opportunities:

- Store a user-selected city and a coarse/geohashed search point separately from any private address.
- Use PostGIS `geography` columns and a GiST index for radius queries.
- Return distance bands or rounded kilometres, not exact candidate coordinates.
- Require mutual consent before sharing a proposed public meeting place.
- Add retention and deletion policies for all location-derived data.

## 5. Configure identity and secrets

Store database credentials, cookie signing keys, LinkedIn client secrets and mobile signing material in AWS Secrets Manager. Rotate secrets and inject them into ECS tasks at runtime. Use Amazon Cognito or another audited OIDC provider for production accounts, MFA, password recovery, token revocation and account deletion.

LinkedIn sign-in and job distribution require approved LinkedIn products and production credentials; an adapter alone does not grant access.

## 6. Add storage, jobs and messaging

- Use private S3 buckets and presigned URLs for résumés, avatars and company assets.
- Use SQS for email, matching recomputation, imports and other retryable background work.
- Use SES or an approved provider for verified transactional email.
- Consider ElastiCache only after measurements show a need for caching or distributed rate limits.

## 7. DNS and cutover

1. Deploy and validate staging.
2. Lower the GoDaddy DNS TTL before cutover.
3. Add the Amplify/CloudFront validation and application records.
4. Point the API subdomain to the Application Load Balancer.
5. Run smoke tests, then switch the apex and `www` records.
6. Keep the previous EC2 release available for rollback until error rates and business events are stable.

## 8. CI/CD release gates

Every release should run TypeScript checks, unit tests, API integration tests, frontend builds, dependency and container scans, database migration checks, accessibility smoke tests, and same-origin routing tests. Deploy an immutable version to staging, require approval, then promote the same artifacts to production.

## 9. Release mobile applications

The Expo QR launcher is for development. Production requires signed binaries:

```bash
cd mobile-expo
npx eas-cli@latest login
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Use the preview profile for internal testers. Promote the production Android build through Google Play internal, closed, and production tracks. Promote the iOS build through TestFlight internal/external testing and App Store review. Expo's official production-build guide is at <https://docs.expo.dev/deploy/build-project/>.

## 10. Production acceptance checklist

- Candidate and recruiter signup, account recovery, session expiry, and account deletion work.
- Authorization is enforced on every candidate, employer, job, match and message endpoint.
- Load-test the matching and discovery endpoints at the target concurrency.
- Run OWASP web/API testing and mobile privacy checks.
- Test account export, account deletion, consent withdrawal and abuse reporting; verify that secrets never reach browser or mobile bundles.
- Database restore, ECS rollback, and DNS rollback are rehearsed.
- WAF, alarms, dashboards, paging, audit logs, privacy export/deletion, and retention jobs are verified.
- TestFlight and Play internal builds point to staging; store builds point only to production HTTPS endpoints.

## How to test now

### Expo Go on a real iPhone or Android phone

1. Install Expo Go from the official store.
2. On Windows, double-click `launch-jobsmatchnow-expo.cmd`. On macOS/Linux/WSL with directly reachable networking, run `npm run expo:mobile` from the repository root.
3. Keep the computer and phone on the same private Wi-Fi.
4. Scan the Expo QR code. Android scans inside Expo Go; iPhone can scan with the Camera app and open Expo Go.
5. Test candidate and recruiter modes, change the distance slider, swipe, create a mutual match, and send a message.

If LAN QR testing is blocked, run `npm run start:tunnel` inside `mobile-expo` with `EXPO_PUBLIC_APP_URL=https://jobsmatchnow.com/app/`.

### Real production-like testing

1. Deploy a staging web/API/database environment with production topology but reduced capacity.
2. Build the `preview` EAS profile and distribute the generated install link to internal testers.
3. Upload Android to Play internal testing and iOS to TestFlight.
4. Run smoke, offline/reconnect, upgrade, deep-link, OAuth, permission, accessibility, low-memory, and slow-network tests on physical devices.
5. Only the signed `production` profile may point at production services.

Expo documents the QR workflow and tunnel fallback at <https://docs.expo.dev/get-started/start-developing/>. Expo Go is a development client; it is not proof that signing, store review, privacy declarations, or production infrastructure are complete.
