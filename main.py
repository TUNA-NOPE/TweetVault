"""TweetVault - AI-Powered Tweet Classification System."""
import argparse
import os
import time

from config import (
    INPUT_FILE,
    OUTPUT_DIR,
    PROGRESS_FILE,
    CATEGORIES_FILE,
    BATCH_SIZE,
    RATE_LIMIT_DELAY,
)
from storage import (
    load_tweets,
    get_tweet_id,
    build_tweet_index,
    load_progress,
    save_progress,
    load_all_categories,
    load_dynamic_categories,
    save_dynamic_categories,
    invert_to_categories,
)
from classifier import classify_batch
from writer import write_all


def print_summary(categorized: dict):
    print("\nClassification Summary:")
    print("-" * 35)
    all_ids: set[str] = set()
    for cat_id in sorted(categorized):
        ids = categorized[cat_id]
        all_ids.update(ids)
        print(f"  {cat_id.replace('_', ' ').title()}: {len(ids)}")
    print("-" * 35)
    print(f"  Unique tweets: {len(all_ids)}")
    print(f"  Categories used: {len(categorized)}")


def process(tweets: list, limit: int | None, dry_run: bool, batch_size: int):
    processed = load_progress()
    categories = load_all_categories()
    dynamic = load_dynamic_categories()

    # Collect unprocessed tweets
    remaining: list[tuple[str, str, str]] = []
    for i, tweet in enumerate(tweets):
        tid = get_tweet_id(tweet, i)
        if tid not in processed:
            remaining.append((
                tid,
                tweet.get("screen_name", "unknown"),
                tweet.get("full_text", ""),
            ))

    if limit:
        remaining = remaining[:limit]

    if not remaining:
        print("All tweets already processed.")
        categorized = invert_to_categories(processed)
        if categorized:
            print_summary(categorized)
        return

    print(f"\nProcessing {len(remaining)} tweets in batches of {batch_size}...")
    if processed:
        print(f"  (Skipping {len(processed)} already processed)")

    total_batches = (len(remaining) + batch_size - 1) // batch_size

    for batch_num in range(total_batches):
        start = batch_num * batch_size
        batch = remaining[start : start + batch_size]

        print(f"\n[Batch {batch_num + 1}/{total_batches}] {len(batch)} tweets")
        for tid, author, text in batch:
            preview = text[:60].replace("\n", " ")
            print(f"  @{author}: {preview}{'...' if len(text) > 60 else ''}")

        results = classify_batch(batch, categories)

        for tid, author, _ in batch:
            r = results[tid]
            cats = r["categories"]
            print(f"  @{author} -> {', '.join(c.replace('_', ' ').title() for c in cats)}")

            # Register new dynamic categories in memory
            for new_id, desc in r["new_categories"].items():
                new_id = new_id.lower().replace(" ", "_")
                if new_id not in categories:
                    print(f"  + New category: {new_id}")
                    categories[new_id] = desc
                    dynamic[new_id] = desc

            processed[tid] = cats

        # Save progress after each batch (true resumability)
        if not dry_run:
            save_progress(processed)
            if dynamic:
                save_dynamic_categories(dynamic)

        # Rate limit between batches
        if batch_num < total_batches - 1:
            time.sleep(RATE_LIMIT_DELAY)

    categorized = invert_to_categories(processed)
    print_summary(categorized)

    if not dry_run:
        print(f"\nGenerating markdown in {OUTPUT_DIR}/...")
        tweet_index = build_tweet_index(tweets)
        write_all(categorized, categories, tweet_index)
        print("\nDone!")
    else:
        print("\nDry run complete - no files saved")


def main():
    parser = argparse.ArgumentParser(
        description="TweetVault - AI-Powered Tweet Classification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                       Process all tweets
  python main.py --limit 20            Process 20 tweets
  python main.py --limit 5 --dry-run   Test with 5 tweets
  python main.py --batch-size 5        Use smaller batches
  python main.py --reset               Reset and start fresh
  python main.py --categories          Show all categories
        """,
    )
    parser.add_argument("--limit", "-l", type=int, help="Max tweets to process")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Classify without saving")
    parser.add_argument("--reset", "-r", action="store_true", help="Reset all progress")
    parser.add_argument("--input", "-i", type=str, default=INPUT_FILE, help="Input JSON file")
    parser.add_argument("--categories", "-c", action="store_true", help="Show categories")
    parser.add_argument("--batch-size", "-b", type=int, default=BATCH_SIZE, help="Tweets per API call")

    args = parser.parse_args()

    print("TweetVault - AI Tweet Classifier")
    print("=" * 35)

    if args.categories:
        cats = load_all_categories()
        print("\nCategories:")
        print("-" * 35)
        for cid, desc in sorted(cats.items()):
            print(f"  {cid}: {desc}")
        print(f"\n  Total: {len(cats)}")
        return

    if not os.environ.get("OPENROUTER_API_KEY"):
        print("\nOPENROUTER_API_KEY not set!")
        print("  export OPENROUTER_API_KEY='your-key-here'")
        print("  Get a free key at: https://openrouter.ai\n")

    if args.reset:
        for f in [PROGRESS_FILE, CATEGORIES_FILE]:
            if os.path.exists(f):
                os.remove(f)
        print("Progress reset.")

    tweets = load_tweets(args.input)
    if not tweets:
        print(f"No tweets found in {args.input}")
        return

    print(f"Loaded {len(tweets)} tweets")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    process(tweets, limit=args.limit, dry_run=args.dry_run, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
