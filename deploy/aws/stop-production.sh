#!/usr/bin/env bash
# FULL STOP of the production stack — nothing left running, launch again with launch-production.sh.
#   ECS -> 0 tasks · RDS stopped · CloudFront disabled · ALB deleted (recreated on launch)
# Remaining cost: storage pennies only (S3 files, ECR image, RDS disk while stopped).
# ⚠ AWS auto-restarts a stopped RDS after 7 days — if launch is >7 days away, ask for
#   delete-with-final-snapshot instead (true indefinite $0 compute).
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
DIST=E1Q7HAOG5F4BI5

echo "== 1/4 ECS -> 0 tasks =="
aws ecs update-service --cluster jobsmatchnow --service jobsmatchnow-api --desired-count 0 \
  --query 'service.desiredCount' --output text
aws ecs wait services-stable --cluster jobsmatchnow --services jobsmatchnow-api && echo "tasks drained"

echo "== 2/4 stop RDS =="
aws rds stop-db-instance --db-instance-identifier jobsmatchnow-db \
  --query 'DBInstance.DBInstanceStatus' --output text 2>&1 | head -1 || true

echo "== 3/4 disable CloudFront distribution =="
aws cloudfront get-distribution-config --id $DIST > /tmp/cf.json
ETAG=$(python3 -c "import json;print(json.load(open('/tmp/cf.json'))['ETag'])")
python3 - <<'EOF'
import json
d = json.load(open('/tmp/cf.json'))['DistributionConfig']
d['Enabled'] = False
json.dump(d, open('/tmp/cf-disabled.json', 'w'))
EOF
aws cloudfront update-distribution --id $DIST --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-disabled.json --query 'Distribution.Status' --output text

echo "== 4/4 delete ALB (listener + load balancer; target group kept, it is free) =="
ALB=$(aws elbv2 describe-load-balancers --names jobsmatchnow-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)
if [ -n "$ALB" ] && [ "$ALB" != "None" ]; then
  for L in $(aws elbv2 describe-listeners --load-balancer-arn "$ALB" --query 'Listeners[].ListenerArn' --output text); do
    aws elbv2 delete-listener --listener-arn "$L"
  done
  aws elbv2 delete-load-balancer --load-balancer-arn "$ALB" && echo "ALB deleted"
else
  echo "ALB already gone"
fi

echo
echo "== final state =="
echo "ECS running: $(aws ecs describe-services --cluster jobsmatchnow --services jobsmatchnow-api --query 'services[0].runningCount' --output text)"
echo "RDS:         $(aws rds describe-db-instances --db-instance-identifier jobsmatchnow-db --query 'DBInstances[0].DBInstanceStatus' --output text)"
echo "CloudFront:  disabling (takes a few minutes to propagate)"
echo "ALB:         deleted"
echo "MVP tier (https://jobsmatchnow.com) is UNTOUCHED and stays live."
echo "PRODUCTION STOPPED — relaunch with deploy/aws/launch-production.sh"
