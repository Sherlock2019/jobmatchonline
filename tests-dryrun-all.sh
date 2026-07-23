#!/usr/bin/env bash
# Full dry-run verification: cheap tier + production tier + AWS infra + repo health.
export PATH="$HOME/.local/bin:$PATH"
cd /home/dzoan/jobmatch3
P=0; F=0
ok(){ echo "  PASS $1"; P=$((P+1)); }
no(){ echo "  FAIL $1"; F=$((F+1)); }
chk(){ [ "$2" = "$3" ] && ok "$1 ($2)" || no "$1 (got $2, want $3)"; }

echo "════════ 1. CHEAP TIER — https://jobsmatchnow.com (EC2) ════════"
chk "site" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://jobsmatchnow.com)" "200"
chk "www redirect" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://www.jobsmatchnow.com)" "301"
chk "web app" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' https://jobsmatchnow.com/app/)" "200"
MAIN_JS=$(curl -s -m 15 https://jobsmatchnow.com | grep -o 'src="[^"]*index[^"]*\.js"' | head -1 | sed 's/src="//;s/"$//')
MOCKUP_ASSET=$(curl -s -m 15 "https://jobsmatchnow.com$MAIN_JS" | grep -o 'assets/match-mockup-[^"]*\.png' | head -1)
[ -n "$MOCKUP_ASSET" ] \
  && chk "content-hashed mockup image" "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://jobsmatchnow.com/$MOCKUP_ASSET")" "200" \
  || no "content-hashed mockup image (asset URL missing from bundle)"
chk "APK download" "$(curl -s -o /dev/null -m 15 -r 0-99 -w '%{http_code}' https://jobsmatchnow.com/downloads/JobsMatchNow-android-debug.apk)" "206"
H=$(curl -s -m 15 https://jobsmatchnow.com | grep -c "Stop chasing jobs and candidates")
[ "$H" -ge 1 ] && ok "hero headline present" || no "hero headline missing"
CERT=$(echo | openssl s_client -servername jobsmatchnow.com -connect jobsmatchnow.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
[ -n "$CERT" ] && ok "TLS cert valid until: $CERT" || no "TLS cert check"
echo "--- feature suite (19 checks):"
bash tests-e2e-smoke.sh 2>/dev/null | tail -2 | head -1
bash tests-e2e-smoke.sh 2>/dev/null | grep -q "ALL PASS" && ok "cheap tier feature suite 19/19" || no "cheap tier feature suite"

echo
echo "════════ 2. EC2 SERVICES ════════"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=12 ubuntu@13.229.182.186"
SVC=$($SSH "systemctl is-active nginx jobsmatchnow-api postgresql certbot.timer 2>/dev/null | tr '\n' ' '")
chk "nginx api postgres certbot all active" "$(echo $SVC | tr -s ' ')" "active active active active"
DBROWS=$($SSH "sudo -u postgres psql -d jobsmatchnow -t -c 'select count(*) from app_state'" | tr -d ' \n')
chk "postgres app_state populated" "$DBROWS" "1"
BK=$($SSH "ls /var/backups/jobsmatchnow/db-*.sql.gz 2>/dev/null | wc -l")
[ "$BK" -ge 1 ] && ok "daily backups present ($BK file(s))" || no "no backups found"
STORE=$($SSH "sudo journalctl -u jobsmatchnow-api -n 50 --no-pager 2>/dev/null | grep -o 'store: postgresql (RDS)' | tail -1")
[ -n "$STORE" ] && ok "API booted with postgresql store" || no "API store banner not found in logs"

echo
echo "════════ 3. PRODUCTION TIER — CloudFront/ECS/RDS ════════"
CF=https://d36bi29i1nwlbr.cloudfront.net
chk "CDN site" "$(curl -s -o /dev/null -m 20 -w '%{http_code}' $CF/)" "200"
chk "CDN app" "$(curl -s -o /dev/null -m 20 -w '%{http_code}' $CF/app/)" "200"
chk "API via CDN->ALB->Fargate" "$(curl -s -m 20 $CF/api/health | grep -c '\"ok\":true')" "1"
sed "s|^B=https://jobsmatchnow.com|B=$CF|" tests-e2e-smoke.sh > /tmp/smoke_cf.sh
bash /tmp/smoke_cf.sh 2>/dev/null | grep -q "ALL PASS" && ok "production tier feature suite 19/19" || no "production tier feature suite"

echo
echo "════════ 4. AWS INFRA STATE ════════"
ECS=$(aws ecs describe-services --cluster jobsmatchnow --services jobsmatchnow-api \
  --query 'services[0].[status,runningCount,desiredCount]' --output text 2>/dev/null | tr '\t' '/')
chk "ECS service ACTIVE 2/2" "$ECS" "ACTIVE/2/2"
TG=$(aws elbv2 describe-target-groups --names jobsmatchnow-tg --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null)
HEALTHY=$(aws elbv2 describe-target-health --target-group-arn "$TG" --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' --output text 2>/dev/null)
chk "ALB healthy targets" "$HEALTHY" "2"
RDS=$(aws rds describe-db-instances --db-instance-identifier jobsmatchnow-db --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null)
chk "RDS status" "$RDS" "available"
CFST=$(aws cloudfront get-distribution --id E1Q7HAOG5F4BI5 --query 'Distribution.Status' --output text 2>/dev/null)
chk "CloudFront deployed" "$CFST" "Deployed"
EC2ST=$(aws ec2 describe-instances --instance-ids i-081b93beeca009045 --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null)
chk "EC2 running" "$EC2ST" "running"
B1=$(aws s3api head-bucket --bucket jobsmatchnow-web-809185823456 2>&1; echo $?)
B2=$(aws s3api head-bucket --bucket jobsmatchnow-backups-809185823456 2>&1; echo $?)
[ "${B1: -1}" = 0 ] && [ "${B2: -1}" = 0 ] && ok "both S3 buckets reachable" || no "S3 bucket check"

echo
echo "════════ 5. LOCAL REPO HEALTH ════════"
npm run lint >/dev/null 2>&1 && ok "typecheck clean" || no "typecheck"
npm test >/dev/null 2>&1 && ok "API unit tests" || no "API unit tests"
[ -z "$(git status --porcelain)" ] && ok "git tree clean (root)" || no "uncommitted changes (root)"
bash -n startdemo.sh && bash -n deploy/deploy-production.sh && bash -n deploy/aws/00-cheap-mvp-ec2.sh && ok "all launcher/deploy scripts parse" || no "script syntax"

echo
echo "══════════════════════════════════════════════"
echo "DRY RUN RESULT: $P passed, $F failed"
[ $F -eq 0 ] && echo "✅ EVERYTHING WORKING" || echo "⚠ ISSUES FOUND ABOVE"
