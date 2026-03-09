#!/usr/bin/env bash
set -euo pipefail

TABLE_NAME="${1:-Prod-Backend-MealAppTable63E31160-1OC65EWJFNS0W}"
REGION="${2:-us-east-1}"
INPUT_FILE="${3:-recipes_enriched.json}"

echo "=== Recipe DB Setup ==="
echo "Table:  $TABLE_NAME"
echo "Region: $REGION"
echo "Input:  $INPUT_FILE"
echo ""

# ─── Helper: wait for table AND all GSIs to become ACTIVE ────────
wait_for_table() {
  echo "  Waiting for table + GSIs to become ACTIVE..."
  while true; do
    TABLE_STATUS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" \
      --query 'Table.TableStatus' --output text 2>/dev/null)
    GSI_STATUSES=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" \
      --query 'Table.GlobalSecondaryIndexes[*].IndexStatus' --output text 2>/dev/null || echo "")

    ALL_ACTIVE=true
    if [ "$TABLE_STATUS" != "ACTIVE" ]; then
      ALL_ACTIVE=false
    fi
    if echo "$GSI_STATUSES" | grep -qiE "CREATING|UPDATING|DELETING"; then
      ALL_ACTIVE=false
    fi

    if $ALL_ACTIVE; then
      echo "  Table and all GSIs are ACTIVE"
      return
    fi
    echo "  Table: $TABLE_STATUS | GSIs: $GSI_STATUSES — waiting 15s..."
    sleep 15
  done
}

# ─── Helper: check if GSI exists ─────────────────────────────────
gsi_exists() {
  local gsi_name="$1"
  aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" \
    --query "Table.GlobalSecondaryIndexes[?IndexName=='$gsi_name'].IndexName" \
    --output text 2>/dev/null | grep -q "$gsi_name"
}

# ─── Step 1: Create GSI1 (cuisine-mealtype) ──────────────────────
echo "Step 1: GSI1 (gsi1-cuisine-mealtype)"
if gsi_exists "gsi1-cuisine-mealtype"; then
  echo "  Already exists — skipping"
else
  echo "  Creating GSI1..."
  aws dynamodb update-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --attribute-definitions \
      AttributeName=gsi1pk,AttributeType=S \
      AttributeName=gsi1sk,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"gsi1-cuisine-mealtype\",\"KeySchema\":[{\"AttributeName\":\"gsi1pk\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"gsi1sk\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
    --output text > /dev/null
  wait_for_table
fi
echo ""

# ─── Step 2: Create GSI2 (diet-cuisine) ──────────────────────────
echo "Step 2: GSI2 (gsi2-diet-cuisine)"
if gsi_exists "gsi2-diet-cuisine"; then
  echo "  Already exists — skipping"
else
  echo "  Creating GSI2..."
  aws dynamodb update-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --attribute-definitions \
      AttributeName=gsi2pk,AttributeType=S \
      AttributeName=gsi2sk,AttributeType=S \
    --global-secondary-index-updates \
      "[{\"Create\":{\"IndexName\":\"gsi2-diet-cuisine\",\"KeySchema\":[{\"AttributeName\":\"gsi2pk\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"gsi2sk\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
    --output text > /dev/null
  wait_for_table
fi
echo ""

# ─── Step 3: Ingest recipes ──────────────────────────────────────
echo "Step 3: Ingesting recipes from $INPUT_FILE"
if [ ! -f "$INPUT_FILE" ]; then
  echo "  ERROR: $INPUT_FILE not found. Run scrape + enrich first."
  exit 1
fi

RECIPE_COUNT=$(python3 -c "import json; print(len(json.load(open('$INPUT_FILE'))))")
echo "  Found $RECIPE_COUNT recipes to ingest"

# Activate venv if present
if [ -d ".venv" ]; then
  source .venv/bin/activate
fi

python3 ingest_to_dynamo.py --input "$INPUT_FILE" --table "$TABLE_NAME" --region "$REGION"

echo ""
echo "=== Done! ==="
echo "GSIs created and $RECIPE_COUNT recipes ingested into $TABLE_NAME"
