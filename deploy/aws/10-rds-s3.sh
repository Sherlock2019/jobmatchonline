#!/usr/bin/env bash
# Tier 1 phase A: S3 backups bucket + DB security group + RDS PostgreSQL (async create)
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
IID=i-081b93beeca009045
ACC=809185823456
REG=ap-southeast-1

echo "== instance network facts =="
read -r VPC SUBNET SG <<<"$(aws ec2 describe-instances --instance-ids $IID \
  --query 'Reservations[0].Instances[0].[VpcId,SubnetId,SecurityGroups[0].GroupId]' --output text)"
echo "vpc=$VPC subnet=$SUBNET ec2_sg=$SG"

echo "== S3 backups bucket =="
BUCKET=jobsmatchnow-backups-$ACC
aws s3api create-bucket --bucket "$BUCKET" --region $REG \
  --create-bucket-configuration LocationConstraint=$REG 2>&1 | head -2 || true
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules": [{"ID": "expire-old-backups", "Status": "Enabled", "Filter": {"Prefix": "backups/"},
             "Expiration": {"Days": 30}}]}'
echo "bucket ready: s3://$BUCKET"

echo "== DB security group (5432 only from the EC2 SG) =="
DBSG=$(aws ec2 create-security-group --group-name jobsmatchnow-db-sg \
  --description "jobsmatchnow RDS - postgres from app server only" --vpc-id "$VPC" \
  --query GroupId --output text 2>/dev/null) \
  || DBSG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=jobsmatchnow-db-sg \
       --query 'SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$DBSG" --protocol tcp --port 5432 \
  --source-group "$SG" 2>&1 | head -2 || true
echo "db_sg=$DBSG"

echo "== DB subnet group (default VPC subnets) =="
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC --query 'Subnets[].SubnetId' --output text)
aws rds create-db-subnet-group --db-subnet-group-name jobsmatchnow-db-subnets \
  --db-subnet-group-description "jobsmatchnow" --subnet-ids $SUBNETS 2>&1 | head -2 || true

echo "== master password (generated, stored only on this machine + later on EC2) =="
PW=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
umask 077; mkdir -p "$HOME/.jobsmatchnow"; echo "$PW" > "$HOME/.jobsmatchnow/rds-master-pw"
echo "saved to ~/.jobsmatchnow/rds-master-pw"

echo "== create RDS PostgreSQL db.t4g.micro (async, ~8 min) =="
aws rds create-db-instance \
  --db-instance-identifier jobsmatchnow-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --allocated-storage 20 --storage-type gp3 \
  --master-username jobsmatch --master-user-password "$PW" \
  --db-name jobsmatchnow \
  --vpc-security-group-ids "$DBSG" \
  --db-subnet-group-name jobsmatchnow-db-subnets \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --storage-encrypted \
  --multi-az \
  --query 'DBInstance.{id:DBInstanceIdentifier,status:DBInstanceStatus,class:DBInstanceClass}' --output table 2>&1 | head -12
echo "PHASE_A_DONE"
