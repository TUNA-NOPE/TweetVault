"""Markdown output generation for categorized tweets."""
import os
from datetime import datetime
from config import OUTPUT_DIR


def write_category_file(
    category_id: str, description: str, tweet_ids: list, tweet_index: dict
):
    path = os.path.join(OUTPUT_DIR, f"{category_id}.md")
    name = category_id.replace("_", " ").title()

    lines = [
        f"# {name}",
        "",
        f"*{description}*" if description else "",
        "",
        f"**Total tweets:** {len(tweet_ids)}",
        "",
        f"*Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
        "",
        "---",
        "",
    ]

    for i, tweet_id in enumerate(tweet_ids, 1):
        tweet = tweet_index.get(tweet_id, {})
        author = tweet.get("screen_name", "unknown")
        full_text = tweet.get("full_text", "")
        preview = full_text[:100].replace("\n", " ")
        if len(full_text) > 100:
            preview += "..."
        url = tweet.get("url", "")

        lines.append(f"### {i}. @{author}")
        lines.append(f"> {preview}")
        lines.append("")
        lines.append(f"**ID:** `{tweet_id}` | [View Tweet]({url})")
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_all(categorized: dict, categories: dict, tweet_index: dict):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for cat_id, tweet_ids in sorted(categorized.items()):
        desc = categories.get(cat_id, "")
        write_category_file(cat_id, desc, tweet_ids, tweet_index)
        print(f"   {cat_id}.md - {len(tweet_ids)} tweets")
