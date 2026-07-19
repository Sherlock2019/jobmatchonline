#!/usr/bin/env bash
# Phase B: ECR image + ECS Fargate service (2 tasks) behind an ALB.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd /home/dzoan/jobmatch3
ACC=809185823456 REG=ap-southeast-1
VPC=vpc-01878ccdb861fec71
EC2SG=sg-09318344e8cb6708e
DBSG=sg-04ee3f7e74439fbb2
ECR=$ACC.dkr.ecr.$REG.amazonaws.com
say(){ echo; echo "===== $*"; }

say "B1: fresh production web build into dist/"
npm run build:web:production >/dev/null || exit 1

say "B2: ECR repo + docker build/push"
aws ecr create-repository --repository-name jobsmatchnow-api --image-scanning-configuration scanOnPush=true >/dev/null 2>&1 || true
aws ecr get-login-password | docker login --username AWS --password-stdin "$ECR" >/dev/null || exit 1
docker build -q -f server/Dockerfile -t jobsmatchnow-api:latest . || exit 1
docker tag jobsmatchnow-api:latest "$ECR/jobsmatchnow-api:latest"
docker push -q "$ECR/jobsmatchnow-api:latest" || exit 1
echo "pushed $ECR/jobsmatchnow-api:latest"

say "B3: task execution role"
cat > /tmp/ecs-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
aws iam create-role --role-name jobsmatchnowEcsExecRole --assume-role-policy-document file:///tmp/ecs-trust.json >/dev/null 2>&1 || true
aws iam attach-role-policy --role-name jobsmatchnowEcsExecRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true

say "B4: log group"
aws logs create-log-group --log-group-name /ecs/jobsmatchnow-api 2>/dev/null || true
aws logs put-retention-policy --log-group-name /ecs/jobsmatchnow-api --retention-in-days 14 2>/dev/null || true

say "B5: security groups (ALB 80 open; tasks 3001 from ALB; RDS 5432 from tasks)"
ALBSG=$(aws ec2 create-security-group --group-name jobsmatchnow-alb-sg --description "jobsmatchnow ALB" --vpc-id $VPC --query GroupId --output text 2>/dev/null) \
  || ALBSG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=jobsmatchnow-alb-sg --query 'SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$ALBSG" --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$ALBSG" --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true
TASKSG=$(aws ec2 create-security-group --group-name jobsmatchnow-task-sg --description "jobsmatchnow ECS tasks" --vpc-id $VPC --query GroupId --output text 2>/dev/null) \
  || TASKSG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=jobsmatchnow-task-sg --query 'SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$TASKSG" --protocol tcp --port 3001 --source-group "$ALBSG" 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id "$DBSG" --protocol tcp --port 5432 --source-group "$TASKSG" 2>/dev/null || true
echo "alb_sg=$ALBSG task_sg=$TASKSG"

say "B6: ALB + target group + listener"
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC --query 'Subnets[?MapPublicIpOnLaunch==`true`].SubnetId' --output text)
echo "public subnets: $SUBNETS"
ALB=$(aws elbv2 create-load-balancer --name jobsmatchnow-alb --subnets $SUBNETS --security-groups "$ALBSG" \
  --scheme internet-facing --type application --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null) \
  || ALB=$(aws elbv2 describe-load-balancers --names jobsmatchnow-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text)
TG=$(aws elbv2 create-target-group --name jobsmatchnow-tg --protocol HTTP --port 3001 --vpc-id $VPC \
  --target-type ip --health-check-path /api/health --health-check-interval-seconds 20 \
  --healthy-threshold-count 2 --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null) \
  || TG=$(aws elbv2 describe-target-groups --names jobsmatchnow-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 create-listener --load-balancer-arn "$ALB" --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG" >/dev/null 2>&1 || true
ALBDNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB" --query 'LoadBalancers[0].DNSName' --output text)
echo "alb=$ALBDNS"

say "B7: task definition (DATABASE_URL -> RDS)"
PW=$(cat "$HOME/.jobsmatchnow/rds-master-pw")
EP=$(aws rds describe-db-instances --db-instance-identifier jobsmatchnow-db --query 'DBInstances[0].Endpoint.Address' --output text)
DBURL="postgresql://jobsmatch:$PW@$EP:5432/jobsmatchnow"
cat > /tmp/taskdef.json <<EOF
{
  "family": "jobsmatchnow-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256", "memory": "512",
  "executionRoleArn": "arn:aws:iam::$ACC:role/jobsmatchnowEcsExecRole",
  "containerDefinitions": [{
    "name": "api",
    "image": "$ECR/jobsmatchnow-api:latest",
    "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
    "environment": [
      {"name": "DATABASE_URL", "value": "$DBURL"},
      {"name": "NODE_ENV", "value": "production"},
      {"name": "SESSION_SECRET", "value": "$(head -c 32 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 32)"}
    ],
    "logConfiguration": {"logDriver": "awslogs", "options": {
      "awslogs-group": "/ecs/jobsmatchnow-api", "awslogs-region": "$REG", "awslogs-stream-prefix": "api"}}
  }]
}
EOF
aws ecs register-task-definition --cli-input-json file:///tmp/taskdef.json --query 'taskDefinition.revision' --output text
rm -f /tmp/taskdef.json

say "B8: cluster + service (2 tasks)"
aws ecs create-cluster --cluster-name jobsmatchnow >/dev/null 2>&1 || true
SUB_CSV=$(echo $SUBNETS | tr ' ' ',')
aws ecs create-service --cluster jobsmatchnow --service-name jobsmatchnow-api \
  --task-definition jobsmatchnow-api --desired-count 2 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUB_CSV],securityGroups=[$TASKSG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG,containerName=api,containerPort=3001" \
  --health-check-grace-period-seconds 60 \
  --query 'service.serviceName' --output text 2>&1 | head -3 \
  || aws ecs update-service --cluster jobsmatchnow --service jobsmatchnow-api \
       --task-definition jobsmatchnow-api --desired-count 2 --force-new-deployment \
       --query 'service.serviceName' --output text

say "B9: wait for service stable (may take a few minutes)"
aws ecs wait services-stable --cluster jobsmatchnow --services jobsmatchnow-api && echo "SERVICE STABLE"

say "B10: verify through the ALB"
for i in 1 2 3; do
  curl -s -m 15 "http://$ALBDNS/api/health" && echo " <- http://$ALBDNS/api/health" && break
  sleep 20
done
curl -s -o /dev/null -m 15 -w "app shell via ALB: HTTP %{http_code}\n" "http://$ALBDNS/"
echo "PHASE_B_DONE alb=$ALBDNS"
