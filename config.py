"""
Configuration for Tweet Classification System
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenRouter API Configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# Free route from OpenRouter (auto-selects best available free model)
MODEL = "openrouter/free"

# Rate limiting (free tier is limited)
RATE_LIMIT_DELAY = 1.0  # seconds between requests
MAX_RETRIES = 3
RETRY_DELAY = 5.0  # seconds

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
    "misc": "Content that doesn't fit other categories"
}

# Output settings
OUTPUT_DIR = "output"
PROGRESS_FILE = "progress.json"
CATEGORIES_FILE = "categories.json"  # Stores dynamically created categories

# Input file
INPUT_FILE = "twitter-Bookmarks-1770374722863.json"
