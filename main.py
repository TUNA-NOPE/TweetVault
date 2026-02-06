"""
TweetVault - AI-Powered Tweet Classification System

Classifies Twitter bookmarks using OpenRouter's free AI models.
- Supports multi-category classification
- Dynamic category creation
- Reference-based output (keeps JSON as source of truth)
"""
import json
import os
import argparse
from collections import defaultdict
import time

from config import (
    INPUT_FILE, 
    OUTPUT_DIR, 
    PROGRESS_FILE,
    RATE_LIMIT_DELAY
)
from classifier import classify_tweet, load_categories
from markdown_writer import (
    write_all_categories,
    get_summary_stats,
    ensure_output_dir,
    load_tweet_index
)


def load_tweets(file_path: str) -> list:
    """Load tweets from JSON file."""
    if not os.path.exists(file_path):
        print(f"❌ Error: File {file_path} not found.")
        return []
    
    print(f"📂 Loading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        print(f"   Found {len(data)} tweets")
        return data
    else:
        print(f"   Unexpected data format: {type(data).__name__}")
        return []


def load_progress() -> dict:
    """Load previously processed tweet classifications."""
    if not os.path.exists(PROGRESS_FILE):
        return {"processed": {}, "categories": defaultdict(list)}
    
    with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Convert categories lists back to defaultdict
    result = {
        "processed": data.get("processed", {}),
        "categories": defaultdict(list, data.get("categories", {}))
    }
    return result


def save_progress(progress: dict):
    """Save classification progress."""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            "processed": progress["processed"],
            "categories": dict(progress["categories"]),
            "last_updated": time.strftime("%Y-%m-%d %H:%M:%S")
        }, f, indent=2)


def get_tweet_id(tweet: dict, index: int) -> str:
    """Extract unique ID from tweet."""
    if "metadata" in tweet and "rest_id" in tweet["metadata"]:
        return tweet["metadata"]["rest_id"]
    if "url" in tweet:
        # Extract ID from URL
        parts = tweet["url"].split("/")
        if parts:
            return parts[-1]
    return str(index)


def process_tweets(tweets: list, limit: int = None, dry_run: bool = False):
    """
    Process and classify tweets with multi-category support.
    """
    progress = load_progress()
    processed = progress["processed"]
    categorized = progress["categories"]
    
    # Find unprocessed tweets
    remaining = []
    for i, tweet in enumerate(tweets):
        tweet_id = get_tweet_id(tweet, i)
        if tweet_id not in processed:
            remaining.append((i, tweet_id, tweet))
    
    if limit:
        remaining = remaining[:limit]
    
    if not remaining:
        print("✅ All tweets have already been processed!")
        # Still show stats and write files
        if categorized:
            print(get_summary_stats(dict(categorized)))
        return
    
    print(f"\n🔄 Processing {len(remaining)} tweets...")
    if len(processed) > 0:
        print(f"   (Skipping {len(processed)} already processed)")
    
    for idx, (i, tweet_id, tweet) in enumerate(remaining):
        text = tweet.get("full_text", "")
        author = tweet.get("screen_name", "unknown")
        
        # Show progress
        print(f"\n[{idx+1}/{len(remaining)}] @{author}")
        preview = text[:80].replace("\n", " ")
        print(f"   📝 {preview}..." if len(text) > 80 else f"   📝 {preview}")
        
        # Classify (returns list of categories)
        categories = classify_tweet(text, author)
        
        # Format category display
        cat_names = [c.replace("_", " ").title() for c in categories]
        print(f"   📁 → {', '.join(cat_names)}")
        
        # Store in all matching categories
        for cat in categories:
            if tweet_id not in categorized[cat]:
                categorized[cat].append(tweet_id)
        
        # Mark as processed
        processed[tweet_id] = categories
        
        # Rate limiting
        if idx < len(remaining) - 1:
            time.sleep(RATE_LIMIT_DELAY)
    
    # Update progress
    progress["processed"] = processed
    progress["categories"] = categorized
    
    # Summary
    print(get_summary_stats(dict(categorized)))
    
    # Save results
    if not dry_run:
        print(f"\n💾 Saving progress...")
        save_progress(progress)
        
        print(f"📄 Generating markdown files in {OUTPUT_DIR}/...")
        tweet_index = load_tweet_index()
        write_all_categories(dict(categorized), tweet_index)
        
        print("\n✅ Done!")
    else:
        print("\n🧪 Dry run complete - no files saved")


def show_categories():
    """Display all current categories."""
    categories = load_categories()
    print("\n📚 Current Categories:")
    print("-" * 40)
    for cat_id, desc in sorted(categories.items()):
        print(f"  {cat_id}: {desc}")
    print("-" * 40)
    print(f"  Total: {len(categories)} categories")


def main():
    parser = argparse.ArgumentParser(
        description="TweetVault - AI-Powered Tweet Classification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                    # Process all tweets
  python main.py --limit 10         # Process only 10 tweets  
  python main.py --limit 5 --dry-run # Test with 5 tweets
  python main.py --reset            # Reset progress and start fresh
  python main.py --categories       # Show all categories
        """
    )
    
    parser.add_argument("--limit", "-l", type=int, default=None,
                        help="Maximum number of tweets to process")
    parser.add_argument("--dry-run", "-d", action="store_true",
                        help="Classify tweets but don't save to files")
    parser.add_argument("--reset", "-r", action="store_true",
                        help="Reset progress and start fresh")
    parser.add_argument("--input", "-i", type=str, default=INPUT_FILE,
                        help=f"Input JSON file (default: {INPUT_FILE})")
    parser.add_argument("--categories", "-c", action="store_true",
                        help="Show all current categories")
    
    args = parser.parse_args()
    
    print("🐦 TweetVault - AI Tweet Classifier")
    print("=" * 40)
    
    # Show categories if requested
    if args.categories:
        show_categories()
        return
    
    # Check for API key
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("\n⚠️  OPENROUTER_API_KEY not set!")
        print("   export OPENROUTER_API_KEY='your-key-here'")
        print("   Get a free key at: https://openrouter.ai\n")
    
    # Reset progress if requested  
    if args.reset:
        for f in [PROGRESS_FILE, "categories.json"]:
            if os.path.exists(f):
                os.remove(f)
        print("🔄 Progress reset")
    
    # Load and process tweets
    tweets = load_tweets(args.input)
    if tweets:
        ensure_output_dir()
        process_tweets(tweets, limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
