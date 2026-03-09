#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="Prod-Frontend"
REGION="us-east-1"

# Resolve bucket and distribution from CloudFormation
BUCKET=$(aws cloudformation list-stack-resources \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "StackResourceSummaries[?ResourceType=='AWS::S3::Bucket'].PhysicalResourceId" \
  --output text)

DIST_ID=$(aws cloudformation list-stack-resources \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "StackResourceSummaries[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId" \
  --output text)

if [[ -z "$BUCKET" || -z "$DIST_ID" ]]; then
  echo "Error: Could not resolve bucket or distribution from stack $STACK_NAME"
  exit 1
fi

echo "Bucket:       $BUCKET"
echo "Distribution: $DIST_ID"
echo ""

# Build
echo "→ Building..."
npm run build

# Generate runtime config (same shape as CDK's config.json)
API_URL=$(aws cloudformation list-exports --region "$REGION" \
  --query "Exports[?Name=='Prod-Backend:ApiUrl'].Value" --output text 2>/dev/null || true)

if [[ -z "$API_URL" ]]; then
  # Fallback: read from existing deployed config
  API_URL=$(aws s3 cp "s3://$BUCKET/config.json" - 2>/dev/null | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).apiUrl))
  " || true)
fi

if [[ -n "$API_URL" ]]; then
  echo "→ Writing config.json (apiUrl: $API_URL)"
  # Preserve full config from S3 (includes cognito block)
  aws s3 cp "s3://$BUCKET/config.json" dist/config.json 2>/dev/null || \
    echo "{\"apiUrl\":\"$API_URL\"}" > dist/config.json
fi

# Sync to S3
echo "→ Syncing to S3..."
aws s3 sync dist/ "s3://$BUCKET" --delete --region "$REGION"

# Invalidate CloudFront
echo "→ Invalidating CloudFront..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text)

echo ""
echo "Done! Invalidation: $INVALIDATION_ID"
echo "Site: https://$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" \
  --output text)"
