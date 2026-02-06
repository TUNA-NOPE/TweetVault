import os
from dotenv import load_dotenv

load_dotenv()

# OpenRouter API
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openrouter/free"

# Batching & rate limiting
BATCH_SIZE = 10
RATE_LIMIT_DELAY = 1.0  # seconds between batches
MAX_RETRIES = 3
RETRY_DELAY = 5.0  # seconds between retries

# File paths
INPUT_FILE = "twitter-Bookmarks-1770374722863.json"
OUTPUT_DIR = "output"
PROGRESS_FILE = "progress.json"
CATEGORIES_FILE = "categories.json"

# Base categories (AI can add more dynamically)
BASE_CATEGORIES = {
    "tech_programming": "Coding tips, programming languages, developer tools, software engineering",
    "ai_ml": "Artificial intelligence, machine learning, LLMs, neural networks, data science",
    "business_startups": "Entrepreneurship, growth strategies, marketing, fundraising, product management",
    "personal_development": "Productivity, habits, mindset, career advice, self-improvement",
    "design_ui_ux": "User interface design, user experience, visual design, design tools",
    "finance_crypto": "Investing, cryptocurrency, trading, personal finance",
    "humor_memes": "Funny content, jokes, memes, entertainment",
    "news_politics": "Current events, political commentary, world news",
    "misc": "Content that doesn't fit other categories",
}
