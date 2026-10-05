"""
Advanced scraping with crawling, cookie handling, and multiple fetch methods.
Consolidates code from scraper_advanced.py.
"""

import time
import urllib.parse
from typing import List, Dict, Optional, Callable
import urllib.request
import urllib.error
import json

from .core import ScraperCore, CredentialManager, report_lex_dk_unreachable


class AdvancedScraper(ScraperCore):
    """Advanced scraper with crawling, Selenium, curl fallback, and cookie handling."""
    
    def __init__(self, rate_limit: float = 0.5, use_selenium: bool = False):
        super().__init__(rate_limit=rate_limit, use_selenium=use_selenium)
        self.cred_manager = CredentialManager()
    
    def scrape_lex_dk(self, query: str, limit: int = 5) -> List[Dict]:
        """Scrape Lex.dk (Den Store Danske) via SNL API."""
        articles = []
        api_url = f"https://api.snl.no/1.1/search?q={urllib.parse.quote(query)}&limit={limit}"
        
        try:
            req = urllib.request.Request(api_url, headers={
                "Accept": "application/json",
                "User-Agent": "AI-Wikipedia-Scraper/2.0"
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode())
                
                # Try different response formats
                results = data.get("objects", data.get("hits", {}).get("hits", []))
                
                for item in results:
                    # Handle different response structures
                    title = item.get("title", item.get("_source", {}).get("title", query))
                    content = item.get("extract", item.get("_source", {}).get("text", ""))
                    url = item.get("uri", item.get("_source", {}).get("url", f"https://lex.dk/{urllib.parse.quote(query)}"))
                    
                    articles.append({
                        "source": "lex.dk",
                        "title": title,
                        "content": content,
                        "url": url
                    })
        except urllib.error.URLError as e:
            report_lex_dk_unreachable(e)
        except Exception as e:
            print(f"Lex.dk error: {e}")
        
        return articles
    
    def scrape_website(self, url: str, max_depth: int = 0, max_pages: int = 50,
                      cookie_policy: str = "accept_all", 
                      log_callback: Optional[Callable] = None) -> List[Dict]:
        """Scrape articles from any website."""
        self.log(f"Scraping website: {url[:60]}...", log_callback)
        
        if max_depth == 0:
            # Single page
            html = self.fetch_url(url)
            if html:
                article = self.extract_article(html, url)
                if article:
                    return [article]
        else:
            # Crawl site
            result = self.crawl_site(url, max_depth, max_pages, log_callback)
            return result.get("articles", [])
        
        return []
    
    def crawl_site(self, base_url: str, max_depth: int = 1, max_pages: int = 50,
                  progress_callback: Optional[Callable] = None) -> Dict:
        """Crawl a website and extract articles."""
        from queue import Queue
        
        self.reset()
        
        visited = set()
        queue = Queue()
        safe_base = self.safe_url(base_url)
        queue.put((safe_base, 0))
        safe_base_domain = urllib.parse.urlparse(safe_base).netloc
        discovered_articles = []
        
        while not queue.empty():
            if len(visited) >= max_pages:
                if progress_callback:
                    progress_callback(f"Reached limit of {max_pages} pages")
                break
            
            url, depth = queue.get()
            
            if url in visited or depth > max_depth:
                continue
            
            visited.add(url)
            
            if progress_callback:
                progress_callback(f"Crawling [{depth}]: {url[:60]}...")
            
            html = self.fetch_url(url)
            if not html:
                continue
            
            soup = self.parse_html(html)
            if not soup:
                continue
            
            self.extract_assets(soup, url)
            
            # Discover links for further crawling
            for a in soup.find_all('a', href=True):
                try:
                    raw_href = a.get('href', '')
                    if not raw_href or raw_href.startswith('#') or raw_href.startswith('javascript:'):
                        continue
                    
                    link = urllib.parse.urljoin(url, raw_href)
                    link = self.safe_url(link)
                    parsed = urllib.parse.urlparse(link)
                    
                    # Only follow same-domain links
                    if parsed.netloc == safe_base_domain:
                        if (link, depth + 1) not in queue.queue:
                            queue.put((link, depth + 1))
                except Exception:
                    continue
            
            # Extract article content
            article = self.extract_article(html, url)
            if article:
                discovered_articles.append(article)
            
            time.sleep(self.rate_limit)
        
        return {
            "assets": self.assets,
            "articles": discovered_articles,
            "total_pages": len(visited)
        }
    
    def extract_assets(self, soup, base_url: str):
        """Extract all assets (links, scripts, images) from parsed HTML."""
        # HTML links
        for a in soup.find_all('a', href=True):
            self.assets['html'].append(urllib.parse.urljoin(base_url, a['href']))
        
        # JavaScript files
        for script in soup.find_all('script', src=True):
            self.assets['js'].append(urllib.parse.urljoin(base_url, script['src']))
        
        # CSS files
        for link in soup.find_all('link', rel='stylesheet', href=True):
            self.assets['css'].append(urllib.parse.urljoin(base_url, link['href']))
        
        # Images
        for img in soup.find_all('img', src=True):
            src = img.get('src', '')
            if src and not src.startswith('data:'):
                self.assets['images'].append(urllib.parse.urljoin(base_url, src))
        
        # Lazy-loaded images
        for img in soup.find_all('img'):
            for attr in ['data-src', 'data-lazy-src', 'data-original']:
                src = img.get(attr, '')
                if src and not src.startswith('data:'):
                    self.assets['images'].append(urllib.parse.urljoin(base_url, src))
        
        # Deduplicate
        for k in self.assets:
            self.assets[k] = list(set(self.assets[k]))
