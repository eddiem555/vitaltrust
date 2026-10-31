#!/usr/bin/env bash
# Create (if needed) the VitalTrust KB S3 bucket and upload the clinical-protocols seed.
# Federated CDW: aws login. Do not use long-lived keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
BUCKET="${BUCKET_NAME:-vitaltrust-kb-data-772180452080}"
SEED="$ROOT/docs/seed/vitaltrust-clinical-protocols.txt"
KEY="vitaltrust-clinical-protocols.txt"

if [[ ! -f "$SEED" ]]; then
  echo "Missing seed file: $SEED"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI not found."
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "Not authenticated. Run: aws login"
  exit 1
fi

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket exists: $BUCKET"
else
  echo "Creating bucket: $BUCKET in $REGION"
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

aws s3 cp "$SEED" "s3://${BUCKET}/${KEY}" --region "$REGION"
echo "Uploaded s3://${BUCKET}/${KEY}"
echo "If the KB data source already exists, Sync it in Bedrock → Knowledge bases → vitaltrust-ehr-kb."
