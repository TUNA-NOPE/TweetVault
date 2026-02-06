"""Batch tweet classification via OpenRouter API."""
import json
import re
import time

import requests

from config import OPENROUTER_API_KEY, OPENROUTER_URL, MODEL, MAX_RETRIES, RETRY_DELAY


def _system_prompt(categories: dict) -> str:
    cat_list = "\n".join(f"- {k}: {v}" for k, v in categories.items())
    return (
        "You are a tweet classifier. Classify each tweet into one or more categories.\n\n"
        f"CATEGORIES:\n{cat_list}\n\n"
        "RULES:\n"
        "1. A tweet can belong to MULTIPLE categories\n"
        "2. If no category fits, CREATE a new one (lowercase_with_underscores ID)\n"
        "3. Respond with ONLY valid JSON, no other text"
    )


def _user_prompt(batch: list[tuple[str, str, str]]) -> str:
    entries = "\n\n".join(
        f'[{tid}] @{author}: "{text}"' for tid, author, text in batch
    )
    return (
        f"Classify these tweets:\n\n{entries}\n\n"
        'Respond as JSON:\n'
        '{"<tweet_id>": {"categories": ["cat1"], "new_categories": {"new_id": "description"}}, ...}\n'
        "Use empty {} for new_categories if none needed."
    )


def _parse_response(text: str, tweet_ids: list[str]) -> dict:
    """Parse batch response -> {tweet_id: {categories, new_categories}}."""
    fallback = {tid: {"categories": ["misc"], "new_categories": {}} for tid in tweet_ids}

    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return fallback
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError:
            return fallback

    results = {}
    for tid in tweet_ids:
        entry = data.get(tid, data.get(str(tid), {}))
        cats = entry.get("categories", ["misc"]) if entry else ["misc"]
        cats = [str(c).lower().replace(" ", "_") for c in cats if c] or ["misc"]
        new_cats = entry.get("new_categories", {}) if entry else {}
        results[tid] = {"categories": cats, "new_categories": new_cats}
    return results


def classify_batch(
    batch: list[tuple[str, str, str]], categories: dict
) -> dict:
    """
    Classify a batch of tweets in a single API call.

    Args:
        batch: list of (tweet_id, author, text)
        categories: current full category dict

    Returns:
        {tweet_id: {"categories": [...], "new_categories": {...}}}
    """
    tweet_ids = [tid for tid, _, _ in batch]
    fallback = {tid: {"categories": ["misc"], "new_categories": {}} for tid in tweet_ids}

    if not OPENROUTER_API_KEY:
        return fallback

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/TweetVault",
        "X-Title": "TweetVault Classifier",
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _system_prompt(categories)},
            {"role": "user", "content": _user_prompt(batch)},
        ],
        "temperature": 0.2,
        "reasoning": {"enabled": True},
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                OPENROUTER_URL, headers=headers, json=payload, timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    content = data["choices"][0]["message"]["content"]
                    return _parse_response(content, tweet_ids)
                
                print(f"   Unexpected API response: {data}")
                # Fall through to retry logic
            
            if resp.status_code == 429:
                print(f"   Rate limited, waiting {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
                continue
                
            print(f"   API error {resp.status_code}: {resp.text}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            print(f"   Request error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)

    return fallback
