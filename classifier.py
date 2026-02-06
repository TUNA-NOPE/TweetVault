"""
AI Classifier using OpenRouter API
Supports multi-category classification and dynamic category creation
"""
import requests
import time
import json
import os
import re
from config import (
    OPENROUTER_API_KEY, 
    OPENROUTER_BASE_URL, 
    MODEL,
    BASE_CATEGORIES,
    CATEGORIES_FILE,
    RATE_LIMIT_DELAY,
    MAX_RETRIES,
    RETRY_DELAY
)


def load_categories() -> dict:
    """Load categories including any dynamically created ones."""
    categories = dict(BASE_CATEGORIES)
    
    if os.path.exists(CATEGORIES_FILE):
        with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
            dynamic = json.load(f)
            categories.update(dynamic)
    
    return categories


def save_new_category(category_id: str, description: str):
    """Save a new dynamically created category."""
    dynamic = {}
    if os.path.exists(CATEGORIES_FILE):
        with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
            dynamic = json.load(f)
    
    dynamic[category_id] = description
    
    with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(dynamic, f, indent=2)


def build_classification_prompt(tweet_text: str, author: str) -> str:
    """Build the prompt for multi-category classification with dynamic category support."""
    categories = load_categories()
    category_list = "\n".join([
        f"- {cat_id}: {desc}"
        for cat_id, desc in categories.items()
    ])
    
    return f"""You are a tweet classifier. Analyze the following tweet and classify it.

EXISTING CATEGORIES:
{category_list}

RULES:
1. A tweet can belong to MULTIPLE categories if the content fits more than one
2. If no existing category fits well, you may CREATE a new category
3. Use lowercase with underscores for category IDs (e.g., "web3_nft", "health_fitness")

Tweet by @{author}:
"{tweet_text}"

Respond in this exact JSON format:
{{"categories": ["category_id1", "category_id2"], "new_categories": {{"new_cat_id": "description"}}}}

- "categories" = list of 1+ category IDs that apply (from existing OR new)
- "new_categories" = empty {{}} if no new categories needed, otherwise {{"id": "description"}}

Respond with ONLY the JSON, no other text."""


def parse_classification_response(response_text: str) -> tuple[list, dict]:
    """
    Parse the AI response to extract categories and any new category definitions.
    Returns (list of category IDs, dict of new categories)
    """
    try:
        # Try to extract JSON from the response
        # Handle potential markdown code blocks
        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        
        data = json.loads(text)
        categories = data.get("categories", ["misc"])
        new_cats = data.get("new_categories", {})
        
        # Validate categories are strings
        categories = [str(c).lower().replace(" ", "_") for c in categories if c]
        
        return categories, new_cats
        
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"   ⚠️ Parse error: {e}, defaulting to misc")
        return ["misc"], {}


def classify_tweet(tweet_text: str, author: str = "unknown") -> list:
    """
    Classify a tweet using OpenRouter API.
    Returns list of category IDs (can be multiple).
    """
    if not OPENROUTER_API_KEY:
        print("   ⚠️ No API key, using 'misc'")
        return ["misc"]
    
    prompt = build_classification_prompt(tweet_text, author)
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/TweetVault",
        "X-Title": "TweetVault Classifier"
    }
    
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 200,
        "temperature": 0.2
    }
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                OPENROUTER_BASE_URL,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                
                categories, new_cats = parse_classification_response(content)
                
                # Save any new categories
                for cat_id, desc in new_cats.items():
                    cat_id = cat_id.lower().replace(" ", "_")
                    print(f"   🆕 New category: {cat_id} - {desc}")
                    save_new_category(cat_id, desc)
                
                return categories
                    
            elif response.status_code == 429:
                print(f"   ⏳ Rate limited, waiting {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)
                continue
            else:
                print(f"   ❌ API error {response.status_code}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
    
    return ["misc"]
