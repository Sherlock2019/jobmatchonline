#!/usr/bin/env bash
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
VPC=vpc-01878ccdb861fec71
TASKSG=sg-01ffcc81d87e87939
TG=$(aws elbv2 describe-target-groups --names jobsmatchnow-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text | tr '\t' ',')
echo "== create ECS service-linked role =="
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com 2>&1 | head -3 || true
sleep 12
echo "== create service (2 tasks) =="
aws ecs create-service --cluster jobsmatchnow --service-name jobsmatchnow-api \
  --task-definition jobsmatchnow-api --desired-count 2 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASKSG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG,containerName=api,containerPort=3001" \
  --health-check-grace-period-seconds 60 \
  --query 'service.{name:serviceName,status:status,desired:desiredCount}' --output table 2>&1 | head -12
echo "== wait services-stable =="
aws ecs wait services-stable --cluster jobsmatchnow --services jobsmatchnow-api && echo "SERVICE STABLE"
ALBDNS=$(aws elbv2 describe-load-balancers --names jobsmatchnow-alb --query 'LoadBalancers[0].DNSName' --output text)
echo "== verify via ALB: $ALBDNS =="
for i in 1 2 3 4; do
  R=$(curl -s -m 15 "http://$ALBDNS/api/health")
  [ -n "$R" ] && { echo "health: $R"; break; }
  sleep 15
done
curl -s -o /dev/null -m 15 -w "app shell: HTTP %{http_code}\n" "http://$ALBDNS/"
echo "targets:"
aws elbv2 describe-target-health --target-group-arn "$TG" --query 'TargetHealthDescriptions[].{ip:Target.Id,state:TargetHealth.State}' --output table | head -12
echo "PHASE_B2_DONE"
