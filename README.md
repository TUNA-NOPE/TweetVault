# TweetVault

AI-powered Twitter bookmark classifier using OpenRouter's free route.

## Features

- **Batch classification** - Classifies 10 tweets per API call (configurable)
- **Multi-category** - Tweets can belong to multiple categories
- **Dynamic categories** - AI creates new categories when needed
- **Resumable** - Progress saved after every batch
- **Reference-based output** - Markdown files reference tweet IDs, JSON stays source of truth

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/TweetVault.git
cd TweetVault
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OpenRouter API key
```

## Usage

```bash
source venv/bin/activate

python main.py                       # Process all tweets
python main.py --limit 20            # Process 20 tweets
python main.py --limit 5 --dry-run   # Test with 5 tweets
python main.py --batch-size 5        # Smaller batches
python main.py --categories          # Show all categories
python main.py --reset               # Reset progress
```

## Project Structure

```
config.py       Settings (model, batch size, rate limits, base categories)
storage.py      All file I/O (tweets, progress, categories)
classifier.py   Batch classification via OpenRouter API
writer.py       Markdown output generation
main.py         CLI + orchestration
```

## Configuration

Edit `config.py` to customize:
- `BATCH_SIZE` - Tweets per API call (default: 10)
- `BASE_CATEGORIES` - Starting category set
- `RATE_LIMIT_DELAY` - Delay between batches
- `MODEL` - OpenRouter model route

## License

MIT
