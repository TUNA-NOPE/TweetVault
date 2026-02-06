"""TweetVault - AI-Powered Tweet Classification System."""
import argparse
import os
import time
from datetime import datetime, timedelta

from config import (
    INPUT_FILE,
    OUTPUT_DIR,
    PROGRESS_FILE,
    CATEGORIES_FILE,
    BATCH_SIZE,
    RATE_LIMIT_DELAY,
    DAILY_REQUEST_LIMIT,
)

# Rate limits
REQUESTS_PER_MINUTE = 50
MINUTE_WINDOW = 60  # seconds
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
    load_requests_today,
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


def wait_for_rate_limit(requests_this_minute: list[float], requests_today: int, daily_limit: int) -> bool:
    """Wait if we're hitting rate limits. Returns True if we can continue, False if daily limit hit."""
    now = time.time()
    
    # Clean up old requests (older than 1 minute)
    requests_this_minute[:] = [t for t in requests_this_minute if now - t < MINUTE_WINDOW]
    
    # Check daily limit - sleep until midnight if reached
    if requests_today >= daily_limit:
        now_dt = datetime.now()
        tomorrow = (now_dt + timedelta(days=1)).replace(hour=0, minute=0, second=5, microsecond=0)
        sleep_seconds = (tomorrow - now_dt).total_seconds()
        hours = sleep_seconds / 3600
        print(f"\n⏸ Daily limit reached ({daily_limit} requests).")
        print(f"  Sleeping for {hours:.1f} hours until midnight...")
        print(f"  Will resume at {tomorrow.strftime('%Y-%m-%d %H:%M:%S')}")
        time.sleep(sleep_seconds)
        return True  # Signal that we should reload requests_today
    
    # Check per-minute limit
    if len(requests_this_minute) >= REQUESTS_PER_MINUTE:
        oldest = min(requests_this_minute)
        sleep_time = MINUTE_WINDOW - (now - oldest) + 1  # +1 second buffer
        if sleep_time > 0:
            print(f"\n⏸ Minute rate limit ({REQUESTS_PER_MINUTE}/min) - sleeping {sleep_time:.0f}s...")
            time.sleep(sleep_time)
            # Clean up again after sleeping
            now = time.time()
            requests_this_minute[:] = [t for t in requests_this_minute if now - t < MINUTE_WINDOW]
    
    return False


def process(tweets: list, limit: int | None, dry_run: bool, batch_size: int, daily_limit: int):
    processed = load_progress()
    categories = load_all_categories()
    dynamic = load_dynamic_categories()
    requests_today = load_requests_today()
    requests_this_minute: list[float] = []  # Timestamps of recent requests

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

    total_batches = (len(remaining) + batch_size - 1) // batch_size

    print(f"\n{len(remaining)} tweets remaining ({len(processed)} already done)")
    print(f"  Total batches: {total_batches}")
    print(f"  Rate limits: {REQUESTS_PER_MINUTE}/min, {daily_limit}/day")
    print(f"  Requests used today: {requests_today}/{daily_limit}")
    print(f"  Will auto-sleep when hitting rate limits and continue until done.")

    for batch_num in range(total_batches):
        # Check and wait for rate limits
        daily_reset = wait_for_rate_limit(requests_this_minute, requests_today, daily_limit)
        if daily_reset:
            # Daily limit was hit and we slept - reload today's count (should be 0 now)
            requests_today = load_requests_today()
            requests_this_minute.clear()

        start = batch_num * batch_size
        batch = remaining[start : start + batch_size]

        print(f"\n[Batch {batch_num + 1}/{total_batches}] {len(batch)} tweets  (req {requests_today + 1}/{daily_limit} today, {len(requests_this_minute) + 1}/{REQUESTS_PER_MINUTE} this min)")
        for tid, author, text in batch:
            preview = text[:60].replace("\n", " ")
            print(f"  @{author}: {preview}{'...' if len(text) > 60 else ''}")

        results = classify_batch(batch, categories)
        requests_today += 1
        requests_this_minute.append(time.time())

        for tid, author, _ in batch:
            r = results[tid]
            cats = r["categories"]
            print(f"  @{author} -> {', '.join(c.replace('_', ' ').title() for c in cats)}")

            for new_id, desc in r["new_categories"].items():
                new_id = new_id.lower().replace(" ", "_")
                if new_id not in categories:
                    print(f"  + New category: {new_id}")
                    categories[new_id] = desc
                    dynamic[new_id] = desc

            processed[tid] = cats

        # Save after each batch
        if not dry_run:
            save_progress(processed, requests_today)
            if dynamic:
                save_dynamic_categories(dynamic)

        # Small delay between batches for stability
        if batch_num < total_batches - 1:
            time.sleep(RATE_LIMIT_DELAY)

    categorized = invert_to_categories(processed)
    print_summary(categorized)
    print(f"\n  API requests used today: {requests_today}/{daily_limit}")

    if not dry_run:
        print(f"\nGenerating markdown in {OUTPUT_DIR}/...")
        tweet_index = build_tweet_index(tweets)
        write_all(categorized, categories, tweet_index)
        print("\n✅ All tweets classified!")
    else:
        print("\nDry run complete - no files saved")


def main():
    parser = argparse.ArgumentParser(
        description="TweetVault - AI-Powered Tweet Classification",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                       Process all tweets (within daily limit)
  python main.py --daily-limit 1000    Use higher limit ($10+ credits)
  python main.py --limit 20            Process max 20 tweets
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
    parser.add_argument("--daily-limit", type=int, default=DAILY_REQUEST_LIMIT,
                        help=f"Max API requests per day (default: {DAILY_REQUEST_LIMIT}, use 1000 with $10+ credits)")

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
    process(
        tweets,
        limit=args.limit,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        daily_limit=args.daily_limit,
    )


if __name__ == "__main__":
    main()
