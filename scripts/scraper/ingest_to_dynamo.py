#!/usr/bin/env python3
"""
Ingest enriched recipes into DynamoDB with tag-item pattern for GSI queries.

Data model:
  - Base item:  pk=RECIPE#<id>, sk=META — full recipe data
  - Tag items:  pk=RECIPE#<id>, sk=TAG#<cuisine>#<mealType> — indexed by GSI1
  - Diet tags:  pk=RECIPE#<id>, sk=DTAG#<diet>#<cuisine> — indexed by GSI2

GSI1 (gsi1-cuisine-mealtype):
  - gsi1pk: CUISINE#<cuisine>
  - gsi1sk: MEALTYPE#<mealType>#<paddedTime>

GSI2 (gsi2-diet-cuisine):
  - gsi2pk: DIET#<diet>
  - gsi2sk: CUISINE#<cuisine>#<mealType>

Usage:
    python ingest_to_dynamo.py [--input recipes_enriched.json] [--table MealAppTable] [--region us-east-1]
"""

import argparse
import json
import time
from pathlib import Path

import boto3

BATCH_SIZE = 25  # DynamoDB batch_write_item limit


def build_items_for_recipe(recipe: dict) -> list[dict]:
    """Build the base item + tag items for a single recipe."""
    recipe_id = recipe["recipeId"]
    items: list[dict] = []

    # Base item: full recipe data
    base = {
        "pk": f"RECIPE#{recipe_id}",
        "sk": "META",
        "title": recipe["title"],
        "sourceUrl": recipe.get("sourceUrl", ""),
        "sourceName": recipe.get("sourceName", ""),
        "imageUrl": recipe.get("imageUrl", ""),
        "servings": recipe.get("servings", 4),
        "readyInMinutes": recipe.get("readyInMinutes", 0),
        "prepMinutes": recipe.get("prepMinutes", 0),
        "cookMinutes": recipe.get("cookMinutes", 0),
        "ingredients": recipe.get("ingredients", []),
        "steps": recipe.get("steps", []),
        "cuisines": recipe.get("cuisines", []),
        "diets": recipe.get("diets", []),
        "mealTypes": recipe.get("mealTypes", []),
        "estimatedCalories": recipe.get("estimatedCalories", 400),
        "emoji": recipe.get("emoji", "🍽️"),
    }
    items.append(base)

    cuisines = recipe.get("cuisines", ["American"])
    meal_types = recipe.get("mealTypes", ["dinner"])
    diets = recipe.get("diets", [])
    ready_time = recipe.get("readyInMinutes", 0)
    padded_time = str(ready_time).zfill(4)

    # GSI1 tag items: CUISINE × MEALTYPE
    for cuisine in cuisines:
        for meal_type in meal_types:
            tag = {
                "pk": f"RECIPE#{recipe_id}",
                "sk": f"TAG#{cuisine}#{meal_type}",
                "gsi1pk": f"CUISINE#{cuisine}",
                "gsi1sk": f"MEALTYPE#{meal_type}#{padded_time}",
                "recipeId": recipe_id,
                "title": recipe["title"],
                "estimatedCalories": recipe.get("estimatedCalories", 400),
                "readyInMinutes": ready_time,
                "imageUrl": recipe.get("imageUrl", ""),
            }
            items.append(tag)

    # GSI2 tag items: DIET × CUISINE × MEALTYPE
    for diet in diets:
        for cuisine in cuisines:
            for meal_type in meal_types:
                dtag = {
                    "pk": f"RECIPE#{recipe_id}",
                    "sk": f"DTAG#{diet}#{cuisine}#{meal_type}",
                    "gsi2pk": f"DIET#{diet}",
                    "gsi2sk": f"CUISINE#{cuisine}#{meal_type}",
                    "recipeId": recipe_id,
                    "title": recipe["title"],
                    "estimatedCalories": recipe.get("estimatedCalories", 400),
                    "readyInMinutes": ready_time,
                }
                items.append(dtag)

    return items


def batch_write(table_name: str, items: list[dict], dynamodb) -> int:
    """Write items in batches of 25. Returns count of items written."""
    written = 0
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i : i + BATCH_SIZE]
        request_items = {
            table_name: [{"PutRequest": {"Item": item}} for item in batch]
        }

        response = dynamodb.batch_write_item(RequestItems=request_items)

        # Handle unprocessed items with exponential backoff
        unprocessed = response.get("UnprocessedItems", {})
        retries = 0
        while unprocessed and retries < 5:
            retries += 1
            time.sleep(2**retries * 0.1)
            response = dynamodb.batch_write_item(RequestItems=unprocessed)
            unprocessed = response.get("UnprocessedItems", {})

        written += len(batch)

    return written


def main():
    parser = argparse.ArgumentParser(description="Ingest recipes into DynamoDB")
    parser.add_argument("--input", default="recipes_enriched.json", help="Input JSON file")
    parser.add_argument("--table", default="MealAppTable", help="DynamoDB table name")
    parser.add_argument("--region", default="us-east-1", help="AWS region")
    parser.add_argument("--dry-run", action="store_true", help="Print items without writing")
    args = parser.parse_args()

    recipes = json.loads(Path(args.input).read_text())
    print(f"Loaded {len(recipes)} recipes from {args.input}")

    all_items: list[dict] = []
    for recipe in recipes:
        items = build_items_for_recipe(recipe)
        all_items.extend(items)

    print(f"Generated {len(all_items)} DynamoDB items ({len(recipes)} base + {len(all_items) - len(recipes)} tag items)")

    if args.dry_run:
        # Print a sample
        sample = all_items[:10]
        print("\nSample items:")
        for item in sample:
            print(f"  pk={item['pk']}, sk={item['sk']}")
            if "gsi1pk" in item:
                print(f"    GSI1: {item['gsi1pk']} / {item['gsi1sk']}")
            if "gsi2pk" in item:
                print(f"    GSI2: {item['gsi2pk']} / {item['gsi2sk']}")
        return

    dynamodb = boto3.client("dynamodb", region_name=args.region)
    # Convert to DynamoDB format using resource
    dynamodb_resource = boto3.resource("dynamodb", region_name=args.region)
    table = dynamodb_resource.Table(args.table)

    # Use table.batch_writer for automatic batching + retry
    written = 0
    with table.batch_writer() as batch:
        for i, item in enumerate(all_items):
            batch.put_item(Item=item)
            written += 1
            if (i + 1) % 100 == 0:
                print(f"  Written {i + 1}/{len(all_items)} items...")

    print(f"\nDone! Wrote {written} items to {args.table}")


if __name__ == "__main__":
    main()
