import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(
  process.cwd(),
  process.env.DATA_DIR || ".."
);

export interface Tweet {
  id: string;
  text: string;
  author: string;
  url: string;
  categories: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  count: number;
}

const BASE_CATEGORIES: Record<string, string> = {
  tech_programming:
    "Coding tips, programming languages, developer tools, software engineering",
  ai_ml:
    "Artificial intelligence, machine learning, LLMs, neural networks, data science",
  business_startups:
    "Entrepreneurship, growth strategies, marketing, fundraising, product management",
  personal_development:
    "Productivity, habits, mindset, career advice, self-improvement",
  design_ui_ux:
    "User interface design, user experience, visual design, design tools",
  finance_crypto: "Investing, cryptocurrency, trading, personal finance",
  humor_memes: "Funny content, jokes, memes, entertainment",
  news_politics: "Current events, political commentary, world news",
  misc: "Content that doesn't fit other categories",
};

function readJSON(filename: string): any {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function findTweetsFile(): string | null {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("twitter-") && f.endsWith(".json"));
  return files[0] || null;
}

function loadProgress(): Record<string, string[]> {
  const data = readJSON("progress.json");
  return data?.processed || {};
}

export function getCategoryDescriptions(): Record<string, string> {
  const descriptions = { ...BASE_CATEGORIES };
  const dynamic = readJSON("categories.json");
  if (dynamic) Object.assign(descriptions, dynamic);
  return descriptions;
}

export function getTweets(): Tweet[] {
  const tweetsFile = findTweetsFile();
  if (!tweetsFile) return [];

  const raw = readJSON(tweetsFile);
  if (!Array.isArray(raw)) return [];

  const progress = loadProgress();

  return raw.map((tweet: any, i: number) => {
    const id =
      tweet.metadata?.rest_id || tweet.url?.split("/").pop() || String(i);
    return {
      id,
      text: tweet.full_text || "",
      author: tweet.screen_name || "unknown",
      url: tweet.url || "",
      categories: progress[id] || [],
    };
  });
}

export function getClassifiedTweets(): Tweet[] {
  return getTweets().filter((t) => t.categories.length > 0);
}

export function getCategories(): Category[] {
  const tweets = getClassifiedTweets();
  const descriptions = getCategoryDescriptions();

  const counts: Record<string, number> = {};
  for (const tweet of tweets) {
    for (const cat of tweet.categories) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }

  return Object.entries(descriptions)
    .filter(([id]) => (counts[id] || 0) > 0)
    .map(([id, description]) => ({
      id,
      name: id
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      description,
      count: counts[id] || 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getTweetsByCategory(categoryId: string): Tweet[] {
  return getClassifiedTweets().filter((t) =>
    t.categories.includes(categoryId)
  );
}

export function searchTweets(query: string): Tweet[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return getClassifiedTweets().filter((t) => {
    const haystack = `${t.text} ${t.author}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function getStats() {
  const all = getTweets();
  const classified = all.filter((t) => t.categories.length > 0);
  return {
    totalTweets: all.length,
    classifiedTweets: classified.length,
    totalCategories: getCategories().length,
  };
}
