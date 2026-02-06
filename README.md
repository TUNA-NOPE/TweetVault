# 🐦 TweetVault

AI-powered Twitter bookmark classifier using OpenRouter's free AI models.

## Features

- **Multi-category classification** - Tweets can belong to multiple categories
- **Dynamic categories** - AI creates new categories when needed
- **Reference-based output** - MD files contain tweet IDs, keeping JSON as source of truth
- **Resumable processing** - Progress is saved automatically

## Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/TweetVault.git
cd TweetVault

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add your API key
cp .env.example .env
# Edit .env with your OpenRouter API key
```

## Usage

```bash
# Activate venv
source venv/bin/activate

# Show available categories
python main.py --categories

# Test with 5 tweets (dry run)
python main.py --limit 5 --dry-run

# Process 50 tweets
python main.py --limit 50

# Process all tweets
python main.py

# Reset progress
python main.py --reset
```

## Output

Categorized tweets are saved in `output/` as markdown files with tweet references:

```markdown
# Tech Programming

**Total tweets:** 42

---

### 1. @author
> Tweet preview text...

**ID:** `1234567890` | [View Tweet](url)
```

## Configuration

Edit `config.py` to customize:
- Base categories
- Rate limiting
- Model selection

## License

MIT
