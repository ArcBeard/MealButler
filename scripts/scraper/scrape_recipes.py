#!/usr/bin/env python3
"""
Crawl recipe sites and extract structured recipe data using recipe-scrapers.
Outputs a JSON file with all scraped recipes.

Usage:
    python scrape_recipes.py [--output recipes_raw.json] [--limit 60] [--pages 3]
"""

import argparse
import hashlib
import json
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

# Sites that actually work (no 402 paywall). Each has:
#   - categories: paths to crawl
#   - css_selector: CSS selector for recipe links on category pages
#   - url_filter: substring that must be in href (to skip non-recipe links)
#   - paginate: whether to crawl /page/2/, /page/3/ etc.
SOURCES = {
    "budgetbytes": {
        "base": "https://www.budgetbytes.com",
        "categories": [
            "/category/recipes/breakfast/",
            "/category/recipes/chicken/",
            "/category/recipes/beef/",
            "/category/recipes/pasta/",
            "/category/recipes/vegetarian/",
            "/category/recipes/soup/",
            "/category/recipes/rice/",
            "/category/extra-bytes/budget-friendly-meal-prep/",
        ],
        "css_selector": "article.post-summary > a[href]",
        "url_filter": "budgetbytes.com/",
        "paginate": True,
    },
    "skinnytaste": {
        "base": "https://www.skinnytaste.com",
        "categories": [
            "/recipes/dinner-recipes/",
            "/recipes/chicken/",
            "/recipes/soup/",
            "/recipes/pasta/",
            "/recipes/vegetarian/",
            "/recipes/salad/",
            "/recipes/breakfast-brunch/",
        ],
        "css_selector": "article.ast-archive-post .post-thumb-img-content a[href]",
        "url_filter": "skinnytaste.com/",
        "paginate": True,
    },
    "cookieandkate": {
        "base": "https://cookieandkate.com",
        "categories": [
            "/category/food-recipes/entrees/",
            "/category/food-recipes/pasta/",
            "/category/food-recipes/soups-and-stews/",
            "/category/food-recipes/salads/",
            "/category/food-recipes/breakfast/",
            "/category/food-recipes/easy-weeknight-dinners/",
            "/category/food-recipes/budget-friendly/",
        ],
        "css_selector": "article.post-summary h2.post-summary__title a[href]",
        "url_filter": "cookieandkate.com/",
        "paginate": True,
    },
}

# URLs to skip (category pages, list pages, non-recipe content)
SKIP_PATTERNS = [
    "/category/",
    "/tag/",
    "/page/",
    "/about",
    "/contact",
    "/privacy",
    "/recipes/$",  # bare /recipes/ index
    "weeknight-dinners",  # roundup posts, not recipes
    "meal-prep-ideas",
    "quick-and-easy",
]

session = requests.Session()
session.headers.update(HEADERS)


def generate_recipe_id(url: str) -> str:
    """Deterministic ID from URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:12]


def _should_skip(url: str) -> bool:
    """Check if URL matches skip patterns."""
    for pattern in SKIP_PATTERNS:
        if pattern in url:
            return True
    return False


def crawl_category(
    base_url: str,
    category_path: str,
    css_selector: str,
    url_filter: str,
    limit: int,
    pages: int,
    delay: float,
) -> list[str]:
    """Extract recipe links from a category page (with pagination)."""
    links: set[str] = set()

    for page in range(1, pages + 1):
        if len(links) >= limit:
            break

        url = base_url + category_path
        if page > 1:
            url = url.rstrip("/") + f"/page/{page}/"

        print(f"  Crawling: {url}")
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 404 and page > 1:
                break  # no more pages
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"    Failed: {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        for a in soup.select(css_selector):
            href = a.get("href", "")
            if not href or href in links:
                continue
            if url_filter not in href:
                continue
            if href.startswith("/"):
                href = base_url + href
            if _should_skip(href):
                continue
            links.add(href)
            if len(links) >= limit:
                break

        print(f"    Running total: {len(links)} links")

        if page < pages:
            time.sleep(delay)

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

        # Quick sanity check — skip if no title or ingredients
        if not recipe["title"] or not recipe["ingredients"]:
            print(f"    Skipped (missing title/ingredients): {url}")
            return None

        return recipe

    except Exception as e:
        print(f"    Failed: {e}")
        return None


def _extract_source_name(url: str) -> str:
    """Extract human-readable source name from URL."""
    if "budgetbytes" in url:
        return "Budget Bytes"
    if "skinnytaste" in url:
        return "Skinnytaste"
    if "cookieandkate" in url:
        return "Cookie and Kate"
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
    parser.add_argument("--limit", type=int, default=60, help="Max recipe links per category")
    parser.add_argument("--pages", type=int, default=3, help="Max pages to crawl per category")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests (seconds)")
    args = parser.parse_args()

    all_urls: list[str] = []

    # Phase 1: Crawl category pages to collect recipe URLs
    print("Phase 1: Collecting recipe URLs...")
    for source_name, source in SOURCES.items():
        print(f"\nSource: {source_name}")
        for cat in source["categories"]:
            urls = crawl_category(
                source["base"],
                cat,
                source["css_selector"],
                source["url_filter"],
                args.limit,
                args.pages if source.get("paginate") else 1,
                args.delay,
            )
            all_urls.extend(urls)
            time.sleep(args.delay)

    # Deduplicate while preserving order
    all_urls = list(dict.fromkeys(all_urls))
    print(f"\nTotal unique recipe URLs: {len(all_urls)}")

    # Phase 2: Scrape each recipe
    print("\nPhase 2: Scraping recipes...")
    recipes: list[dict] = []
    failed = 0
    for i, url in enumerate(all_urls):
        print(f"  [{i + 1}/{len(all_urls)}] {url}")
        recipe = scrape_recipe(url)
        if recipe:
            recipes.append(recipe)
        else:
            failed += 1
        time.sleep(args.delay)

    # Save
    output_path = Path(args.output)
    output_path.write_text(json.dumps(recipes, indent=2))
    print(f"\nDone! Scraped {len(recipes)} recipes ({failed} failed) → {output_path}")


if __name__ == "__main__":
    main()
