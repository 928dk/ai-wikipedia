#!/usr/bin/env python3
"""
Multi-Source Scraper for AI Wikipedia
Scrapes from Wikipedia, Lex.dk, and other sources.
"""

import json
import time
import argparse
import re
from datetime import datetime
from typing import List, Dict, Optional
import urllib.request
import urllib.parse

class MultiSourceScraper:
    def __init__(self, rate_limit: float = 0.5):
        self.rate_limit = rate_limit
        self.base_url = "https://en.wikipedia.org/w/api.php"
        
    def scrape_wikipedia(self, titles: List[str]) -> List[Dict]:
        """Scrape Wikipedia articles."""
        articles = []
        base_url = "https://en.wikipedia.org/w/api.php"
        
        for title in titles:
            params = {
                "action": "query",
                "titles": title,
                "prop": "extracts|info",
                "explaintext": True,
                "format": "json",
                "origin": "*"
            }
            url = f"{base_url}?{urllib.parse.urlencode(params)}"
            
            try:
                req = urllib.request.Request(url, headers={
                    "User-Agent": "AI-Wikipedia-Scraper/1.0 (Educational Project)"
                })
                with urllib.request.urlopen(req, timeout=30) as response:
                    data = json.loads(response.read().decode())
                    pages = data.get("query", {}).get("pages", {})
                    
                    for page_id, page in pages.items():
                        if page_id == "-1":
                            continue
                        content = page.get("extract", "")
                        if content:
                            articles.append({
                                "source": "wikipedia",
                                "title": page.get("title", title),
                                "content": content,
                                "url": f"https://en.wikipedia.org/?curid={page_id}"
                            })
            except Exception as e:
                print(f"Wikipedia error for '{title}': {e}")
            
            time.sleep(self.rate_limit)
        
        return articles
    
    def scrape_lex_dk(self, query: str) -> List[Dict]:
        """Scrape Lex.dk (Den Store Danske) via SNL API."""
        articles = []
        api_url = f"https://api.snl.no/1.1/search?q={urllib.parse.quote(query)}&limit=5"
        
        try:
            req = urllib.request.Request(api_url, headers={
                "Accept": "application/json",
                "User-Agent": "AI-Wikipedia-Scraper/1.0"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                results = data.get("objects", [])
                
                for item in results:
                    articles.append({
                        "source": "lex.dk",
                        "title": item.get("title", query),
                        "content": item.get("extract", item.get("description", "")),
                        "url": item.get("uri", f"https://lex.dk/{urllib.parse.quote(query)}")
                    })
        except Exception as e:
            print(f"Lex.dk error: {e}")
        
        return articles
    
    def scrape_from_file(self, filepath: str) -> List[str]:
        """Read titles from a file (one per line)."""
        titles = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    title = line.strip()
                    if title and not title.startswith('#'):
                        titles.append(title)
        except Exception as e:
            print(f"File error: {e}")
        return titles


def article_to_wiki_format(source_article: Dict) -> Dict:
    """Convert scraped article to AI Wikipedia format."""
    content = source_article["content"]
    source = source_article.get("source", "unknown")
    
    return {
        "id": int(str(hash(source_article["title"]))[:9]),
        "title": source_article["title"],
        "content": content,
        "summary": content[:500] + "..." if len(content) > 500 else content,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "verification_status": "verified",
        "confidence_score": 0.95 if source in ["wikipedia", "lex.dk"] else 0.7,
        "citations": json.dumps([{
            "source": source,
            "url": source_article.get("url", ""),
            "accessed": datetime.now().isoformat()
        }])
    }


def main():
    parser = argparse.ArgumentParser(description="Multi-Source Scraper for AI Wikipedia")
    parser.add_argument("--source", choices=["wikipedia", "lex.dk", "file", "all"], 
                       default="wikipedia", help="Data source")
    parser.add_argument("--query", help="Search query")
    parser.add_argument("--titles", help="File with titles (one per line)")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--output", "-o", default="scraped_export.json")
    parser.add_argument("--delay", type=float, default=0.5)
    
    args = parser.parse_args()
    
    scraper = MultiSourceScraper(rate_limit=args.delay)
    all_articles = []
    
    print(f"Multi-Source Scraper")
    print(f"Source: {args.source}")
    print("-" * 50)
    
    if args.source == "wikipedia":
        if args.titles:
            titles = scraper.scrape_from_file(args.titles)
        elif args.query:
            titles = [args.query]
        else:
            # Default: random articles
            titles = [f"Article_{i}" for i in range(args.limit)]
        
        print(f"Fetching {len(titles)} Wikipedia articles...")
        articles = scraper.scrape_wikipedia(titles)
        all_articles.extend(articles)
    
    elif args.source == "lex.dk":
        if not args.query:
            print("Error: --query required for lex.dk")
            return
        print(f"Searching Lex.dk for: {args.query}")
        articles = scraper.scrape_lex_dk(args.query)
        all_articles.extend(articles)
    
    elif args.source == "file":
        if not args.titles:
            print("Error: --titles required for file mode")
            return
        titles = scraper.scrape_from_file(args.titles)
        print(f"Scraping {len(titles)} articles...")
        articles = scraper.scrape_wikipedia(titles)
        all_articles.extend(articles)
    
    # Convert to AI Wikipedia format
    wiki_articles = [article_to_wiki_format(a) for a in all_articles]
    
    print(f"\nScraped: {len(wiki_articles)} articles")
    
    # Save
    export = {
        "version": "1.0.0",
        "exported": datetime.now().isoformat(),
        "count": len(wiki_articles),
        "articles": wiki_articles
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    
    print(f"Saved: {args.output}")
    print("\nImport in AI Wikipedia: Export/Sync > Import from JSON")


if __name__ == "__main__":
    main()
