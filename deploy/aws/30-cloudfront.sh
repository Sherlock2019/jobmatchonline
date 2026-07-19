#!/usr/bin/env bash
# Phase C: S3 (private) + CloudFront CDN for the frontend; /api/* routed to the ALB.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd /home/dzoan/jobmatch3
ACC=809185823456 REG=ap-southeast-1
BUCKET=jobsmatchnow-web-$ACC
ALBDNS=$(aws elbv2 describe-load-balancers --names jobsmatchnow-alb --query 'LoadBalancers[0].DNSName' --output text)
say(){ echo; echo "===== $*"; }

say "C1: private web bucket"
aws s3api create-bucket --bucket "$BUCKET" --region $REG \
  --create-bucket-configuration LocationConstraint=$REG >/dev/null 2>&1 || true
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

say "C2: assemble + upload site (marketing prerender + app + downloads)"
STAGE=/tmp/jmn-cdn; rm -rf "$STAGE"; mkdir -p "$STAGE/app" "$STAGE/downloads"
node - <<'EOF'
const { pathToFileURL } = require('node:url');
(async () => {
  const u = pathToFileURL(process.cwd() + '/marketing/dist/server/index.js');
  u.searchParams.set('cdn', String(Date.now()));
  const { default: worker } = await import(u.href);
  const res = await worker.fetch(new Request('http://localhost/', { headers: { accept: 'text/html' } }),
    { ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  require('node:fs').writeFileSync('marketing/dist/client/index.html', await res.text());
  console.log('prerendered');
})().catch((e) => { console.error(e); process.exit(1); });
EOF
cp -r marketing/dist/client/. "$STAGE/"
cp public/sw.js "$STAGE/sw.js" 2>/dev/null || true
cp -r dist/. "$STAGE/app/"
cp releases/JobsMatchNow-android-debug.apk "$STAGE/downloads/" 2>/dev/null || true
aws s3 sync "$STAGE/" "s3://$BUCKET/" --delete --only-show-errors
echo "uploaded $(find "$STAGE" -type f | wc -l) files"

say "C3: origin access control"
OAC=$(aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=jobsmatchnow-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3 \
  --query 'OriginAccessControl.Id' --output text 2>/dev/null) \
  || OAC=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='jobsmatchnow-oac'].Id | [0]" --output text)
echo "oac=$OAC"

say "C4: index-rewrite function (\"/dir/\" -> \"/dir/index.html\")"
cat > /tmp/cf-fn.js <<'EOF'
function handler(event) {
  var req = event.request;
  if (req.uri.endsWith('/')) req.uri += 'index.html';
  else if (!req.uri.includes('.')) req.uri += '/index.html';
  return req;
}
EOF
FN=$(aws cloudfront create-function --name jobsmatchnow-index-rewrite \
  --function-config Comment=index-rewrite,Runtime=cloudfront-js-2.0 \
  --function-code fileb:///tmp/cf-fn.js --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text 2>/dev/null) \
  || FN=$(aws cloudfront describe-function --name jobsmatchnow-index-rewrite --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text)
ETAGF=$(aws cloudfront describe-function --name jobsmatchnow-index-rewrite --query 'ETag' --output text)
aws cloudfront publish-function --name jobsmatchnow-index-rewrite --if-match "$ETAGF" >/dev/null 2>&1 || true
echo "fn=$FN"

say "C5: distribution (S3 default origin + ALB origin for /api/*)"
cat > /tmp/cf-dist.json <<EOF
{
  "CallerReference": "jobsmatchnow-$(date +%s)",
  "Comment": "JobsMatchNow production CDN",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "PriceClass": "PriceClass_200",
  "HttpVersion": "http2and3",
  "Origins": {"Quantity": 2, "Items": [
    {"Id": "s3web", "DomainName": "$BUCKET.s3.$REG.amazonaws.com",
     "OriginAccessControlId": "$OAC", "S3OriginConfig": {"OriginAccessIdentity": ""}},
    {"Id": "alb", "DomainName": "$ALBDNS",
     "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "http-only",
       "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}}}
  ]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3web", "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "FunctionAssociations": {"Quantity": 1, "Items": [
      {"FunctionARN": "$FN", "EventType": "viewer-request"}]}
  },
  "CacheBehaviors": {"Quantity": 1, "Items": [
    {"PathPattern": "/api/*", "TargetOriginId": "alb", "ViewerProtocolPolicy": "redirect-to-https",
     "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
       "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
     "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
     "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3",
     "Compress": true}
  ]}
}
EOF
DIST=$(aws cloudfront create-distribution --distribution-config file:///tmp/cf-dist.json \
  --query 'Distribution.{id:Id,domain:DomainName}' --output text 2>&1 | head -2)
echo "distribution: $DIST"
DISTID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='JobsMatchNow production CDN'].Id | [0]" --output text)
CFDOM=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='JobsMatchNow production CDN'].DomainName | [0]" --output text)
echo "dist_id=$DISTID cf_domain=$CFDOM"

say "C6: bucket policy - CloudFront only"
cat > /tmp/bucket-policy.json <<EOF
{"Version": "2012-10-17", "Statement": [{
  "Sid": "AllowCloudFront", "Effect": "Allow",
  "Principal": {"Service": "cloudfront.amazonaws.com"},
  "Action": "s3:GetObject", "Resource": "arn:aws:s3:::$BUCKET/*",
  "Condition": {"StringEquals": {"AWS:SourceArn": "arn:aws:cloudfront::$ACC:distribution/$DISTID"}}}]}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket-policy.json && echo "policy set"

say "C7: wait for distribution deployment (5-10 min)"
aws cloudfront wait distribution-deployed --id "$DISTID" && echo "DEPLOYED"
echo "== verify =="
curl -s -o /dev/null -m 20 -w "https://$CFDOM -> HTTP %{http_code}\n" "https://$CFDOM/"
curl -s -m 20 "https://$CFDOM/api/health"; echo
curl -s -o /dev/null -m 20 -w "app: HTTP %{http_code}\n" "https://$CFDOM/app/"
echo "PHASE_C_DONE cf=$CFDOM"
