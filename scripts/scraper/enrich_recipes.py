#!/usr/bin/env python3
"""
Enrich scraped recipes with Claude-assigned metadata:
  - mealTypes (breakfast, lunch, dinner, snack)
  - cuisines (Italian, Mexican, etc.)
  - diets (vegetarian, vegan, gluten-free, etc.)
  - estimated calories per serving
  - emoji (single food emoji)

Usage:
    python enrich_recipes.py [--input recipes_raw.json] [--output recipes_enriched.json] [--batch-size 20]
"""

import argparse
import json
import time
from pathlib import Path

import anthropic

client = anthropic.Anthropic()
MODEL = "claude-sonnet-4-20250514"

CLASSIFY_PROMPT = """Classify each recipe below. Return a JSON array with one object per recipe, in the same order.

Each object must have:
- "recipeId": the recipe's ID (copy from input)
- "mealTypes": array of applicable types from ["breakfast", "lunch", "dinner", "snack"]
- "cuisines": array of cuisines (e.g., ["Italian", "Mediterranean"]). Use title case. Pick 1-3.
- "diets": array of applicable diets from ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "low-carb", "paleo"]. Empty array if none apply.
- "estimatedCalories": estimated calories per serving (integer)
- "emoji": single food emoji that best represents the dish

Return ONLY the JSON array, no markdown or explanation.

Recipes:
{recipes_json}"""


def enrich_batch(recipes: list[dict]) -> list[dict]:
    """Send a batch of recipes to Claude for classification."""
    # Build a concise version for the prompt (title + ingredients only)
    summaries = []
    for r in recipes:
        ingredients = [ing["original"] if isinstance(ing, dict) else ing for ing in r.get("ingredients", [])]
        summaries.append({
            "recipeId": r["recipeId"],
            "title": r["title"],
            "servings": r.get("servings", 4),
            "ingredients": ingredients[:15],  # limit for token savings
        })

    prompt = CLASSIFY_PROMPT.format(recipes_json=json.dumps(summaries, indent=2))

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text
    # Extract JSON array
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end == 0:
        print(f"  Warning: Could not parse Claude response")
        return []

    return json.loads(text[start:end])


def merge_enrichments(recipes: list[dict], enrichments: list[dict]) -> list[dict]:
    """Merge Claude enrichment data into recipe objects."""
    enrichment_map = {e["recipeId"]: e for e in enrichments}

    for recipe in recipes:
        enrichment = enrichment_map.get(recipe["recipeId"])
        if enrichment:
            recipe["mealTypes"] = enrichment.get("mealTypes", ["dinner"])
            recipe["cuisines"] = enrichment.get("cuisines", ["American"])
            recipe["diets"] = enrichment.get("diets", [])
            recipe["estimatedCalories"] = enrichment.get("estimatedCalories", 400)
            recipe["emoji"] = enrichment.get("emoji", "🍽️")
        else:
            # Defaults if Claude missed this recipe
            recipe["mealTypes"] = ["dinner"]
            recipe["cuisines"] = ["American"]
            recipe["diets"] = []
            recipe["estimatedCalories"] = 400
            recipe["emoji"] = "🍽️"

    return recipes


def main():
    parser = argparse.ArgumentParser(description="Enrich recipes with Claude classification")
    parser.add_argument("--input", default="recipes_raw.json", help="Input JSON file")
    parser.add_argument("--output", default="recipes_enriched.json", help="Output JSON file")
    parser.add_argument("--batch-size", type=int, default=20, help="Recipes per Claude call")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    recipes = json.loads(Path(args.input).read_text())
    print(f"Loaded {len(recipes)} recipes from {args.input}")

    all_enrichments: list[dict] = []

    for i in range(0, len(recipes), args.batch_size):
        batch = recipes[i : i + args.batch_size]
        batch_num = i // args.batch_size + 1
        total_batches = (len(recipes) + args.batch_size - 1) // args.batch_size
        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} recipes)...")

        try:
            enrichments = enrich_batch(batch)
            all_enrichments.extend(enrichments)
            print(f"    Got {len(enrichments)} enrichments")
        except Exception as e:
            print(f"    Batch failed: {e}")

        if i + args.batch_size < len(recipes):
            time.sleep(args.delay)

    recipes = merge_enrichments(recipes, all_enrichments)

    output_path = Path(args.output)
    output_path.write_text(json.dumps(recipes, indent=2))
    print(f"\nDone! Enriched {len(recipes)} recipes → {output_path}")


if __name__ == "__main__":
    main()
