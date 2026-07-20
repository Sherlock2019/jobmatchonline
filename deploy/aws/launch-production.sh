#!/usr/bin/env bash
# LAUNCH the stopped production stack: start RDS, recreate ALB, scale ECS to 2,
# point CloudFront's /api origin at the new ALB, re-enable the distribution, verify.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
DIST=E1Q7HAOG5F4BI5
VPC=vpc-01878ccdb861fec71
ALBSG=sg-03f3dadfb2c85eeb4

echo "== 1/6 start RDS (3-5 min) =="
aws rds start-db-instance --db-instance-identifier jobsmatchnow-db \
  --query 'DBInstance.DBInstanceStatus' --output text 2>&1 | head -1 || true
aws rds wait db-instance-available --db-instance-identifier jobsmatchnow-db && echo "RDS available"

echo "== 2/6 recreate ALB =="
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text)
ALB=$(aws elbv2 create-load-balancer --name jobsmatchnow-alb --subnets $SUBNETS --security-groups $ALBSG \
  --scheme internet-facing --type application --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null) \
  || ALB=$(aws elbv2 describe-load-balancers --names jobsmatchnow-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
TG=$(aws elbv2 describe-target-groups --names jobsmatchnow-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 create-listener --load-balancer-arn "$ALB" --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG" >/dev/null 2>&1 || true
ALBDNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB" --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB: $ALBDNS"

echo "== 3/6 scale ECS to 2 =="
aws ecs update-service --cluster jobsmatchnow --service jobsmatchnow-api --desired-count 2 \
  --query 'service.desiredCount' --output text
aws ecs wait services-stable --cluster jobsmatchnow --services jobsmatchnow-api && echo "SERVICE STABLE"

echo "== 4/6 point CloudFront /api origin at the new ALB + enable =="
aws cloudfront get-distribution-config --id $DIST > /tmp/cf.json
ETAG=$(python3 -c "import json;print(json.load(open('/tmp/cf.json'))['ETag'])")
ALBDNS=$ALBDNS python3 - <<'EOF'
import json, os
d = json.load(open('/tmp/cf.json'))['DistributionConfig']
d['Enabled'] = True
for o in d['Origins']['Items']:
    if o['Id'] == 'alb':
        o['DomainName'] = os.environ['ALBDNS']
json.dump(d, open('/tmp/cf-enabled.json', 'w'))
EOF
aws cloudfront update-distribution --id $DIST --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-enabled.json --query 'Distribution.Status' --output text

echo "== 5/6 wait for CloudFront deployment =="
aws cloudfront wait distribution-deployed --id $DIST && echo "CDN deployed"

echo "== 6/6 verify =="
CF=$(aws cloudfront get-distribution --id $DIST --query 'Distribution.DomainName' --output text)
curl -s -o /dev/null -m 20 -w "site https://$CF -> HTTP %{http_code}\n" "https://$CF/"
curl -s -m 20 "https://$CF/api/health"; echo
echo "PRODUCTION LAUNCHED"
