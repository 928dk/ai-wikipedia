"""
Multi-source scraper that combines Wikipedia, Lex.dk, and file imports.
Consolidates code from scraper_multi.py.
"""

from typing import List, Dict
import urllib.parse
import json

from .wikipedia import WikipediaScraper
from .advanced import AdvancedScraper


class MultiSourceScraper:
    """Unified scraper for multiple sources."""
    
    def __init__(self, rate_limit: float = 0.5):
        self.wiki_scraper = WikipediaScraper(rate_limit=rate_limit)
        self.advanced_scraper = AdvancedScraper(rate_limit=rate_limit)
        self.rate_limit = rate_limit
    
    def scrape_wikipedia(self, titles: List[str]) -> List[Dict]:
        """Scrape Wikipedia articles."""
        return self.wiki_scraper.scrape_wikipedia(titles)
    
    def scrape_lex_dk(self, query: str, limit: int = 5) -> List[Dict]:
        """Scrape Lex.dk articles."""
        return self.advanced_scraper.scrape_lex_dk(query, limit)
    
    def scrape_from_file(self, filepath: str) -> List[str]:
        """Read titles/URLs from a file (one per line)."""
        items = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    item = line.strip()
                    if item and not item.startswith('#'):
                        items.append(item)
        except Exception as e:
            print(f"File error: {e}")
        return items
    
    def scrape_auto(self, source: str, query: str = None, titles_file: str = None, 
                   limit: int = 50, url: str = None, crawl_depth: int = 0,
                   max_pages: int = 50, use_selenium: bool = False) -> List[Dict]:
        """Auto-detect source and scrape accordingly."""
        all_articles = []
        
        if source == "wikipedia":
            if titles_file:
                titles = self.scrape_from_file(titles_file)
            elif query:
                titles = [query]
            else:
                titles = [f"Article_{i}" for i in range(limit)]
            
            all_articles.extend(self.scrape_wikipedia(titles))
        
        elif source == "lex.dk":
            if not query:
                print("Error: --query required for lex.dk")
                return []
            all_articles.extend(self.scrape_lex_dk(query, limit))
        
        elif source == "website":
            if not url:
                print("Error: --url required for website scraping")
                return []
            
            self.advanced_scraper.use_selenium = use_selenium
            all_articles.extend(
                self.advanced_scraper.scrape_website(url, crawl_depth, max_pages)
            )
        
        elif source == "file":
            if not titles_file:
                print("Error: --titles required for file mode")
                return []
            
            items = self.scrape_from_file(titles_file)
            
            for item in items:
                if item.startswith('http://') or item.startswith('https://'):
                    all_articles.extend(
                        self.advanced_scraper.scrape_website(item, crawl_depth, max_pages)
                    )
                else:
                    all_articles.extend(self.scrape_wikipedia([item]))
        
        return all_articles
