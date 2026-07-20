# Production origin

The server copy is served by Nginx from `/var/www/jobmatchsnow.work/current`.
Releases live in timestamped directories under `/var/www/jobmatchsnow.work/releases`, and `current` is an atomic symlink so rollback is immediate.

The existing default server and applications are preserved. Dedicated virtual hosts serve the canonical `.com` domain and the legacy `.work` domain:

- Canonical: `jobsmatchnow.com` (`www.jobsmatchnow.com` redirects to the apex)
- Legacy: `jobmatchsnow.work` and `www.jobmatchsnow.work`

## Current release

- Origin: `13.229.182.186`
- Release: `/var/www/jobmatchsnow.work/releases/20260719071506`
- Canonical Nginx site: `/etc/nginx/sites-available/jobsmatchnow.com`
- Legacy Nginx site: `/etc/nginx/sites-available/jobmatchsnow.work`
- Managed fallback: `https://jobmatch-now.dzoandzoan67.chatgpt.site`
- Live MVP app: `https://jobsmatchnow.com/app/`
- API service: `jobsmatchnow-api.service` behind Nginx at `/api/`

Validate the origin before a DNS change:

```bash
curl --resolve jobsmatchnow.com:443:13.229.182.186 https://jobsmatchnow.com/
```

To roll back, repoint `/var/www/jobmatchsnow.work/current` to a previous release, test Nginx, and reload it.

## DNS and TLS

The canonical `.com` domain has a Let's Encrypt certificate, apex canonicalization, HTTP-to-HTTPS redirects, HSTS, and automatic certificate renewal through `certbot.timer`.

Required DNS records:

- `A` record for `@` → `13.229.182.186` (replace the two GoDaddy parking A records)
- `CNAME` record for `www` → `jobsmatchnow.com`

The server's AWS security group must also allow inbound TCP 443 before enabling HTTPS.
