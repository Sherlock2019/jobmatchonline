# JobsMatchNow — Deployment Tiers

Two live deployments of the same codebase (same API, same PostgreSQL store via `DATABASE_URL`, same 19-check smoke suite `tests-e2e-smoke.sh`).

| | 💚 Cheap MVP | 🏭 Production |
|---|---|---|
| **URL** | https://jobsmatchnow.com | https://d36bi29i1nwlbr.cloudfront.net |
| **Monthly cost** | **~$10** (one t3.micro) | **~$60–75** (before free-plan credits) |
| **Web serving** | nginx on EC2, HTTPS via Let's Encrypt | CloudFront CDN (HTTP/3) + private S3 |
| **API** | systemd service, auto-restart 5s | ECS Fargate ×2 behind ALB, self-healing |
| **Database** | **local PostgreSQL 16** on the EC2 (free) | RDS PostgreSQL (encrypted, managed) |
| **Backups** | daily `pg_dump`, keeps 7 (`/var/backups/jobsmatchnow`) | RDS automated (1 day; 7 after plan upgrade) |
| **Scaling** | vertical only (resize instance) | horizontal (`ecs update-service --desired-count N`) |
| **Single point of failure** | yes — the one instance | no single API/web SPOF; DB single-AZ until plan upgrade |
| **Deploy command** | `deploy/deploy-production.sh` (web) + `deploy/aws/00-cheap-mvp-ec2.sh` (api) | `deploy/aws/10…30` scripts + `docker push` + `ecs update-service` |

## When to use which
- **Cheap MVP** — demos, early users, investor pitches. Same durable data model as production.
- **Production** — real traffic, uptime expectations, or due-diligence (e.g. showing LinkedIn an operable architecture).

## Pending (both tiers)
- **DNS**: jobsmatchnow.com points at the EC2 tier. Cutover to CloudFront needs Route 53 + nameserver change at GoDaddy + ACM cert.
- **AWS plan**: account is on the Free plan — upgrade unlocks RDS Multi-AZ, 7-day retention, WAF.
- **EC2 IP** is not Elastic — never stop (only reboot) the instance, or DNS breaks.
