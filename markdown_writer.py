"""
Markdown file writer for categorized tweets
Stores tweet references (IDs) instead of full content
"""
import os
import json
from datetime import datetime
from config import OUTPUT_DIR, INPUT_FILE
from classifier import load_categories


def ensure_output_dir():
    """Create output directory if it doesn't exist."""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)


def get_category_filepath(category_id: str) -> str:
    """Get the filepath for a category's markdown file."""
    return os.path.join(OUTPUT_DIR, f"{category_id}.md")


def load_tweet_index() -> dict:
    """Load tweets and create an index by ID for quick lookup."""
    if not os.path.exists(INPUT_FILE):
        return {}
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        tweets = json.load(f)
    
    index = {}
    for i, tweet in enumerate(tweets):
        # Use index as fallback ID
        tweet_id = tweet.get("metadata", {}).get("rest_id", str(i))
        index[tweet_id] = tweet
    
    return index


def generate_category_file(category_id: str, tweet_ids: list, tweet_index: dict):
    """
    Generate a markdown file for a category with tweet references.
    
    Args:
        category_id: The category identifier
        tweet_ids: List of tweet IDs in this category
        tweet_index: Dict mapping tweet_id -> tweet data
    """
    ensure_output_dir()
    filepath = get_category_filepath(category_id)
    
    categories = load_categories()
    description = categories.get(category_id, "")
    
    # Format category name
    cat_name = category_id.replace("_", " ").title()
    
    lines = [
        f"# {cat_name}",
        "",
        f"*{description}*" if description else "",
        "",
        f"**Total tweets:** {len(tweet_ids)}",
        "",
        f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
        "",
        "---",
        ""
    ]
    
    # Add tweet entries with preview
    for i, tweet_id in enumerate(tweet_ids, 1):
        tweet = tweet_index.get(tweet_id, {})
        
        author = tweet.get("screen_name", "unknown")
        text = tweet.get("full_text", "")[:100]
        text = text.replace("\n", " ")
        if len(tweet.get("full_text", "")) > 100:
            text += "..."
        url = tweet.get("url", "")
        
        lines.append(f"### {i}. @{author}")
        lines.append(f"> {text}")
        lines.append(f"")
        lines.append(f"**ID:** `{tweet_id}` | [View Tweet]({url})")
        lines.append("")
        lines.append("---")
        lines.append("")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))


def write_all_categories(categorized: dict, tweet_index: dict):
    """
    Write all category files.
    
    Args:
        categorized: Dict mapping category_id -> list of tweet_ids
        tweet_index: Dict mapping tweet_id -> tweet data
    """
    ensure_output_dir()
    
    for category_id, tweet_ids in categorized.items():
        generate_category_file(category_id, tweet_ids, tweet_index)
        print(f"   ✓ {category_id}.md - {len(tweet_ids)} tweets")


def get_summary_stats(categorized: dict) -> str:
    """Generate a summary of categorized tweets."""
    categories = load_categories()
    
    lines = ["\n📊 Classification Summary:", "-" * 35]
    
    # Count unique tweets (some may be in multiple categories)
    all_ids = set()
    for category_id in sorted(categorized.keys()):
        tweet_ids = categorized[category_id]
        count = len(tweet_ids)
        all_ids.update(tweet_ids)
        name = category_id.replace("_", " ").title()
        lines.append(f"  {name}: {count}")
    
    lines.append("-" * 35)
    lines.append(f"  Unique tweets: {len(all_ids)}")
    lines.append(f"  Categories used: {len(categorized)}")
    
    return "\n".join(lines)
