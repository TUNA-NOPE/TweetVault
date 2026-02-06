"""Consolidated file I/O — tweets, progress, categories, rate tracking."""
import json
import os
import time
from config import INPUT_FILE, PROGRESS_FILE, CATEGORIES_FILE, BASE_CATEGORIES


def load_tweets(path: str = INPUT_FILE) -> list:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def get_tweet_id(tweet: dict, index: int) -> str:
    if "metadata" in tweet and "rest_id" in tweet["metadata"]:
        return tweet["metadata"]["rest_id"]
    if "url" in tweet:
        parts = tweet["url"].split("/")
        if parts:
            return parts[-1]
    return str(index)


def build_tweet_index(tweets: list) -> dict:
    return {get_tweet_id(t, i): t for i, t in enumerate(tweets)}


# --- Progress: {tweet_id: [cat1, cat2, ...]} ---

def load_progress() -> dict:
    if not os.path.exists(PROGRESS_FILE):
        return {}
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        return json.load(f).get("processed", {})


def save_progress(processed: dict, requests_today: int = 0):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                "processed": processed,
                "last_updated": time.strftime("%Y-%m-%d %H:%M:%S"),
                "rate": {
                    "date": time.strftime("%Y-%m-%d"),
                    "requests": requests_today,
                },
            },
            f,
            indent=2,
        )


def load_requests_today() -> int:
    """Get the number of API requests already made today."""
    if not os.path.exists(PROGRESS_FILE):
        return 0
    with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    rate = data.get("rate", {})
    if rate.get("date") == time.strftime("%Y-%m-%d"):
        return rate.get("requests", 0)
    return 0  # new day, counter resets


# --- Categories ---

def load_dynamic_categories() -> dict:
    if not os.path.exists(CATEGORIES_FILE):
        return {}
    with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_dynamic_categories(dynamic: dict):
    with open(CATEGORIES_FILE, "w", encoding="utf-8") as f:
        json.dump(dynamic, f, indent=2)


def load_all_categories() -> dict:
    cats = dict(BASE_CATEGORIES)
    cats.update(load_dynamic_categories())
    return cats


# --- Derived ---

def invert_to_categories(processed: dict) -> dict:
    """Convert {tweet_id: [cats]} -> {cat: [tweet_ids]}."""
    categorized: dict[str, list] = {}
    for tweet_id, cats in processed.items():
        for cat in cats:
            categorized.setdefault(cat, []).append(tweet_id)
    return categorized
