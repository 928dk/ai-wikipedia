#!/usr/bin/env python3
"""
Wikipedia Scraper for AI Wikipedia
Fetches articles and exports as JSON for import.
"""

import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import urllib.request
import urllib.parse
import re

class WikipediaScraper:
    def __init__(self, rate_limit: float = 0.5):
        self.rate_limit = rate_limit
        self.base_url = "https://en.wikipedia.org/w/api.php"
        
    def search(self, query: str, limit: int = 10) -> List[Dict]:
        """Search Wikipedia for articles."""
        params = {
            "action": "opensearch",
            "search": query,
            "limit": limit,
            "namespace": 0,
            "format": "json",
            "origin": "*"
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                results = []
                titles = data[1]
                descriptions = data[2]
                urls = data[3]
                for i, title in enumerate(titles):
                    results.append({
                        "title": title,
                        "description": descriptions[i] if i < len(descriptions) else "",
                        "url": urls[i]
                    })
                return results
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    def get_article(self, title: str) -> Optional[Dict]:
        """Fetch full article content."""
        params = {
            "action": "query",
            "titles": title,
            "prop": "extracts|info|categories",
            "exintro": False,
            "explaintext": True,
            "format": "json",
            "origin": "*",
            "inprop": "url"
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                pages = data.get("query", {}).get("pages", {})
                
                for page_id, page in pages.items():
                    if page_id == "-1":
                        return None
                    
                    content = page.get("extract", "")
                    if not content:
                        return None
                    
                    categories = page.get("categories", [])
                    category_names = [
                        c["title"].replace("Category:", "") 
                        for c in categories[-5:]  # Last 5 categories
                    ]
                    
                    return {
                        "title": page.get("title", title),
                        "content": content,
                        "pageid": page.get("pageid"),
                        "categories": category_names
                    }
        except Exception as e:
            print(f"Error fetching '{title}': {e}")
        return None
    
    def get_category_members(self, category: str, limit: int = 50) -> List[str]:
        """Get articles in a category."""
        category = category.replace("Category:", "")
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmlimit": min(limit, 500),
            "cmtype": "page",
            "format": "json",
            "origin": "*"
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                members = data.get("query", {}).get("categorymembers", [])
                return [m["title"] for m in members]
        except Exception as e:
            print(f"Category error: {e}")
            return []
    
    def get_trending(self, limit: int = 100) -> List[str]:
        """Get trending/featured articles from Wikipedia main page."""
        try:
            url = "https://en.wikipedia.org/w/api.php?action=query&titles=Main_Page&prop=links&pllimit=500&format=json&origin=*"
            req = urllib.request.Request(url, headers={
                "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                pages = data.get("query", {}).get("pages", {})
                links = []
                for page in pages.values():
                    links.extend([l["title"] for l in page.get("links", [])])
                return links[:limit]
        except Exception as e:
            print(f"Trending error: {e}")
            return []
    
    def get_random_articles(self, count: int = 100) -> List[str]:
        """Get random Wikipedia articles."""
        titles = []
        remaining = count
        
        while remaining > 0:
            batch = min(remaining, 10)
            params = {
                "action": "query",
                "list": "random",
                "rnnamespace": 0,
                "rnlimit": batch,
                "format": "json",
                "origin": "*"
            }
            url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
            
            try:
                req = urllib.request.Request(url, headers={
                    "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
                })
                with urllib.request.urlopen(req, timeout=30) as response:
                    data = json.loads(response.read().decode())
                    items = data.get("query", {}).get("random", [])
                    titles.extend([item["title"] for item in items])
                    remaining -= len(items)
                    time.sleep(self.rate_limit)
            except Exception as e:
                print(f"Random error: {e}")
                break
        
        return titles


def article_to_wiki_format(wiki_article: Dict, verification_status: str = "verified") -> Dict:
    """Convert scraped article to AI Wikipedia format."""
    content = wiki_article["content"]
    return {
        "id": int(str(hash(wiki_article["title"]))[:9]),
        "title": wiki_article["title"],
        "content": content,
        "summary": content[:500] + "..." if len(content) > 500 else content,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "verification_status": verification_status,
        "confidence_score": 0.95,
        "citations": json.dumps([{
            "source": "Wikipedia",
            "url": f"https://en.wikipedia.org/?curid={wiki_article.get('pageid', '')}",
            "accessed": datetime.now().isoformat()
        }])
    }


def main():
    parser = argparse.ArgumentParser(description="Wikipedia Scraper for AI Wikipedia")
    parser.add_argument("--mode", choices=["search", "category", "trending", "random", "import"], 
                       default="random", help="Scraping mode")
    parser.add_argument("--query", help="Search query (for search mode)")
    parser.add_argument("--category", help="Category name (for category mode)")
    parser.add_argument("--limit", type=int, default=50, help="Number of articles")
    parser.add_argument("--output", "-o", default="wikipedia_export.json", help="Output file")
    parser.add_argument("--delay", type=float, default=0.5, help="Rate limit delay (seconds)")
    
    args = parser.parse_args()
    
    scraper = WikipediaScraper(rate_limit=args.delay)
    articles = []
    
    print(f"AI Wikipedia Scraper - Mode: {args.mode}")
    print(f"Output: {args.output}")
    print("-" * 50)
    
    if args.mode == "search":
        if not args.query:
            print("Error: --query required for search mode")
            return
        print(f"Searching: {args.query}")
        results = scraper.search(args.query, args.limit)
        titles = [r["title"] for r in results]
        print(f"Found {len(titles)} results")
        
    elif args.mode == "category":
        if not args.category:
            print("Error: --category required for category mode")
            return
        print(f"Fetching category: {args.category}")
        titles = scraper.get_category_members(args.category, args.limit)
        print(f"Found {len(titles)} articles")
        
    elif args.mode == "trending":
        print("Fetching trending articles...")
        titles = scraper.get_trending(args.limit)
        print(f"Found {len(titles)} articles")
        
    elif args.mode == "random":
        print(f"Fetching {args.limit} random articles...")
        titles = scraper.get_random_articles(args.limit)
        print(f"Found {len(titles)} articles")
        
    elif args.mode == "import":
        print(f"Importing from: {args.query}")
        with open(args.query, 'r') as f:
            data = json.load(f)
            titles = data.get("articles", []) if isinstance(data, dict) else data
        print(f"Found {len(titles)} titles")
    
    else:
        titles = []
    
    print(f"\nFetching article content...")
    for i, title in enumerate(titles):
        if i > 0 and i % 10 == 0:
            print(f"  Progress: {i}/{len(titles)}")
        
        article = scraper.get_article(title)
        if article:
            wiki_format = article_to_wiki_format(article)
            articles.append(wiki_format)
        
        time.sleep(args.delay)
    
    print(f"\nSuccessfully scraped: {len(articles)}/{len(titles)} articles")
    
    # Save export
    export = {
        "version": "1.0.0",
        "exported": datetime.now().isoformat(),
        "source": "wikipedia",
        "count": len(articles),
        "articles": articles
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    
    print(f"\nSaved to: {args.output}")
    print(f"Import this file in AI Wikipedia using: Export/Sync > Import from JSON")


if __name__ == "__main__":
    main()
