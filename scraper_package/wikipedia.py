"""
Wikipedia scraping module.
Consolidates code from scraper.py and scraper_multi.py.
"""

import time
import urllib.parse
from typing import List, Dict, Optional
import urllib.request
import urllib.error
import json

from .core import ScraperCore


USER_AGENT = "AI-Wikipedia-Scraper/2.0 (local personal research tool)"


class WikipediaScraper:
    """Wikipedia scraper with search, article fetch, and category support."""
    
    def __init__(self, rate_limit: float = 0.5):
        self.rate_limit = rate_limit
        self.base_url = "https://en.wikipedia.org/w/api.php"
        self.core = ScraperCore(rate_limit=rate_limit)
    
    def _request_json(self, url: str, retries: int = 3) -> Optional[Dict]:
        """GET a JSON endpoint with 429/5xx backoff and retry."""
        attempt = 0
        while True:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=30) as response:
                    return json.loads(response.read().decode())
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                    retry_after = 0.0
                    try:
                        retry_after = float(e.headers.get("Retry-After", "") or 0)
                    except (TypeError, ValueError):
                        retry_after = 0.0
                    backoff = retry_after if retry_after > 0 else float(2 ** attempt)
                    print(f"HTTP {e.code}; backing off {backoff:.0f}s "
                          f"(attempt {attempt + 1}/{retries})")
                    time.sleep(backoff)
                    attempt += 1
                    continue
                print(f"HTTP error: {e}")
                return None
            except Exception as e:
                print(f"Request error: {e}")
                return None
    
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
            data = self._request_json(url)
            if not data:
                return []
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
        finally:
            time.sleep(self.rate_limit)
    
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
            data = self._request_json(url)
            if not data:
                return None
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
                    for c in categories[-5:]
                ]
                
                return {
                    "title": page.get("title", title),
                    "content": content,
                    "pageid": page.get("pageid"),
                    "categories": category_names
                }
        except Exception as e:
            print(f"Error fetching '{title}': {e}")
        finally:
            time.sleep(self.rate_limit)
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
            data = self._request_json(url)
            if not data:
                return []
            members = data.get("query", {}).get("categorymembers", [])
            return [m["title"] for m in members]
        except Exception as e:
            print(f"Category error: {e}")
            return []
        finally:
            time.sleep(self.rate_limit)
    
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
                data = self._request_json(url)
                if not data:
                    break
                items = data.get("query", {}).get("random", [])
                titles.extend([item["title"] for item in items])
                remaining -= len(items)
                time.sleep(self.rate_limit)
            except Exception as e:
                print(f"Random error: {e}")
                break
        
        return titles
    
    def scrape_wikipedia(self, titles: List[str]) -> List[Dict]:
        """Scrape multiple Wikipedia articles with images."""
        articles = []
        
        for title in titles:
            params = {
                "action": "query",
                "titles": title,
                "prop": "extracts|pageimages",
                "exintro": False,
                "explaintext": True,
                "piprop": "thumbnail|original",
                "pithumbsize": 500,
                "format": "json",
                "origin": "*"
            }
            url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
            
            try:
                data = self._request_json(url)
                if not data:
                    time.sleep(self.rate_limit)
                    continue
                pages = data.get("query", {}).get("pages", {})
                
                for page_id, page in pages.items():
                    if page_id == "-1":
                        continue
                    content = page.get("extract", "")
                    if content:
                        images = []
                        if "original" in page:
                            orig = page["original"]
                            images.append({
                                "url": orig.get("source", ""),
                                "alt": page.get("title", title),
                                "caption": None
                            })
                        elif "thumbnail" in page:
                            thumb = page["thumbnail"]
                            images.append({
                                "url": thumb.get("source", ""),
                                "alt": page.get("title", title),
                                "caption": None
                            })
                        
                        articles.append({
                            "source": "wikipedia",
                            "title": page.get("title", title),
                            "content": content,
                            "url": f"https://en.wikipedia.org/?curid={page_id}",
                            "images": images
                        })
            except Exception as e:
                print(f"Wikipedia error for '{title}': {e}")
            
            time.sleep(self.rate_limit)
        
        return articles
