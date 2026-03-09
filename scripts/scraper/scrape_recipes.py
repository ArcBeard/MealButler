#!/usr/bin/env python3
"""
Crawl recipe sites and extract structured recipe data using recipe-scrapers.
Outputs a JSON file with all scraped recipes.

Usage:
    python scrape_recipes.py [--output recipes_raw.json] [--limit 100]
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from recipe_scrapers import scrape_html

# ─── Configuration ──────────────────────────────────────────────────
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Category pages to crawl for recipe links
SOURCES = {
    "allrecipes": {
        "base": "https://www.allrecipes.com",
        "categories": [
            "/recipes/76/appetizers-and-snacks/",
            "/recipes/78/breakfast-and-brunch/",
            "/recipes/17561/lunch/",
            "/recipes/17562/dinner/",
            "/recipes/79/desserts/",
            "/recipes/80/main-dish/",
            "/recipes/96/salad/",
            "/recipes/81/side-dish/",
            "/recipes/94/soups-stews-and-chili/",
        ],
        "link_pattern": "/recipe/",
    },
    "budgetbytes": {
        "base": "https://www.budgetbytes.com",
        "categories": [
            "/category/recipes/breakfast/",
            "/category/recipes/lunch/",
            "/category/recipes/dinner/",
            "/category/recipes/snacks/",
            "/category/recipes/side-dishes/",
            "/category/recipes/soups/",
        ],
        "link_pattern": "budgetbytes.com/",
    },
}

session = requests.Session()
session.headers.update(HEADERS)


def generate_recipe_id(url: str) -> str:
    """Deterministic ID from URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:12]


def crawl_category(base_url: str, category_path: str, link_pattern: str, limit: int) -> list[str]:
    """Extract recipe links from a category page."""
    url = base_url + category_path
    print(f"  Crawling category: {url}")
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"    Failed to fetch category: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if link_pattern in href and href not in links:
            # Normalize URL
            if href.startswith("/"):
                href = base_url + href
            links.add(href)
            if len(links) >= limit:
                break

    print(f"    Found {len(links)} recipe links")
    return list(links)


def scrape_recipe(url: str) -> dict | None:
    """Scrape a single recipe URL using recipe-scrapers."""
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()

        scraper = scrape_html(resp.text, org_url=url)

        recipe = {
            "recipeId": generate_recipe_id(url),
            "title": scraper.title(),
            "sourceUrl": url,
            "sourceName": _extract_source_name(url),
            "imageUrl": scraper.image(),
            "servings": _safe_int(scraper.yields()),
            "readyInMinutes": scraper.total_time() or 0,
            "prepMinutes": scraper.prep_time() or 0,
            "cookMinutes": scraper.cook_time() or 0,
            "ingredients": _format_ingredients(scraper.ingredients()),
            "steps": _format_steps(scraper.instructions_list()),
        }

        return recipe

    except Exception as e:
        print(f"    Failed to scrape {url}: {e}")
        return None


def _extract_source_name(url: str) -> str:
    """Extract human-readable source name from URL."""
    if "allrecipes" in url:
        return "AllRecipes"
    if "budgetbytes" in url:
        return "Budget Bytes"
    return url.split("/")[2]


def _safe_int(value) -> int:
    """Extract integer from yields string like '4 servings'."""
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        digits = "".join(c for c in value if c.isdigit())
        return int(digits) if digits else 4
    return 4


def _format_ingredients(raw: list[str]) -> list[dict]:
    """Convert ingredient strings to structured format."""
    return [
        {"id": i + 1, "name": ing, "amount": 0, "unit": "", "original": ing}
        for i, ing in enumerate(raw)
    ]


def _format_steps(raw: list[str]) -> list[dict]:
    """Convert instruction strings to step objects."""
    return [{"number": i + 1, "step": step} for i, step in enumerate(raw)]


def main():
    parser = argparse.ArgumentParser(description="Scrape recipes from popular sites")
    parser.add_argument("--output", default="recipes_raw.json", help="Output JSON file")
    parser.add_argument("--limit", type=int, default=100, help="Max recipes per category")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests (seconds)")
    args = parser.parse_args()

    all_urls: list[str] = []

    # Phase 1: Crawl category pages to collect recipe URLs
    print("Phase 1: Collecting recipe URLs...")
    for source_name, source in SOURCES.items():
        print(f"\nSource: {source_name}")
        for cat in source["categories"]:
            urls = crawl_category(source["base"], cat, source["link_pattern"], args.limit)
            all_urls.extend(urls)
            time.sleep(args.delay)

    # Deduplicate
    all_urls = list(dict.fromkeys(all_urls))
    print(f"\nTotal unique recipe URLs: {len(all_urls)}")

    # Phase 2: Scrape each recipe
    print("\nPhase 2: Scraping recipes...")
    recipes: list[dict] = []
    for i, url in enumerate(all_urls):
        print(f"  [{i + 1}/{len(all_urls)}] {url}")
        recipe = scrape_recipe(url)
        if recipe:
            recipes.append(recipe)
        time.sleep(args.delay)

    # Save
    output_path = Path(args.output)
    output_path.write_text(json.dumps(recipes, indent=2))
    print(f"\nDone! Scraped {len(recipes)} recipes → {output_path}")


if __name__ == "__main__":
    main()
