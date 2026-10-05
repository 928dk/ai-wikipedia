#!/usr/bin/env python3
"""
Multi-Source Scraper for AI Wikipedia
With advanced web scraping capabilities from site-reverser engine.
"""

import json
import time
import argparse
import re
import os
import subprocess
from datetime import datetime
from typing import List, Dict, Optional, Callable
from urllib.parse import urljoin, urlparse, quote, unquote
import urllib.request
import urllib.parse
import urllib.error

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    print("Warning: BeautifulSoup not installed. Run: pip install beautifulsoup4 lxml")

class AdvancedScraper:
    def __init__(self, rate_limit: float = 0.5, use_selenium: bool = False):
        self.rate_limit = rate_limit
        self.use_selenium = use_selenium
        self.session = None  # Using direct requests instead
        self.session_headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AI-Wikipedia-Scraper/1.0'
        }
        self.visited = set()
        self.assets = {'html': [], 'js': [], 'css': [], 'images': [], 'others': []}
        
    def reset(self):
        self.visited = set()
        self.assets = {'html': [], 'js': [], 'css': [], 'images': [], 'others': []}
    
    def get_content_type(self, url: str) -> str:
        """Determine content type from URL."""
        path = urlparse(url).path.lower()
        if path.endswith(('.html', '.htm')) or not path: return 'html'
        if path.endswith('.js'): return 'js'
        if path.endswith('.css'): return 'css'
        if path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp')): return 'images'
        return 'others'
    
    def fetch_with_curl(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL using curl (fallback method)."""
        try:
            result = subprocess.run(
                ['curl', '-s', '-L', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                 '--max-time', str(timeout), url],
                capture_output=True, text=True, timeout=timeout + 5
            )
            if result.returncode == 0:
                return result.stdout
        except Exception as e:
            print(f"Curl error: {e}")
        return None
    
    def fetch_with_selenium(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL using headless browser (for JavaScript-rendered content)."""
        if not self.use_selenium:
            return None
            
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            from webdriver_manager.chrome import ChromeDriverManager
        except ImportError:
            print("Selenium not installed. Run: pip install selenium webdriver-manager")
            return None
        
        driver = None
        try:
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
            
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.set_page_load_timeout(timeout)
            
            driver.get(url)
            time.sleep(3)  # Wait for dynamic content
            
            html = driver.page_source
            driver.quit()
            return html
        except Exception as e:
            print(f"Selenium error: {e}")
            if driver:
                try:
                    driver.quit()
                except:
                    pass
        return None
    
    def fetch_url(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL with multiple fallback methods."""
        # Method 1: Direct request
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AI-Wikipedia-Scraper/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                code = response.getcode()
                if code == 200:
                    return response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Direct fetch error: {e}")
        
        # Method 2: Curl fallback
        print("Trying curl fallback...")
        result = self.fetch_with_curl(url, timeout)
        if result:
            return result
        
        # Method 3: Selenium (if enabled)
        if self.use_selenium:
            print("Trying headless browser...")
            result = self.fetch_with_selenium(url, timeout)
            if result:
                return result
        
        return None
    
    def parse_html(self, html: str) -> Optional[BeautifulSoup]:
        """Parse HTML content."""
        if not BS4_AVAILABLE:
            return None
        try:
            return BeautifulSoup(html, 'lxml')
        except Exception as e:
            print(f"Parse error: {e}")
        return None
    
    def extract_assets(self, soup: BeautifulSoup, base_url: str):
        """Extract all assets (links, scripts, images) from parsed HTML."""
        # HTML links
        for a in soup.find_all('a', href=True):
            self.assets['html'].append(urljoin(base_url, a['href']))
        
        # JavaScript files
        for script in soup.find_all('script', src=True):
            self.assets['js'].append(urljoin(base_url, script['src']))
        
        # CSS files
        for link in soup.find_all('link', rel='stylesheet', href=True):
            self.assets['css'].append(urljoin(base_url, link['href']))
        
        # Images
        for img in soup.find_all('img', src=True):
            src = img.get('src', '')
            if src and not src.startswith('data:'):
                self.assets['images'].append(urljoin(base_url, src))
        
        # Lazy-loaded images
        for img in soup.find_all('img'):
            for attr in ['data-src', 'data-lazy-src', 'data-original', 'data-lazy-original']:
                src = img.get(attr, '')
                if src and not src.startswith('data:'):
                    self.assets['images'].append(urljoin(base_url, src))
        
        # Deduplicate
        for k in self.assets:
            self.assets[k] = list(set(self.assets[k]))
    
    def safe_url(self, url: str) -> str:
        """Safely encode a URL, handling non-ASCII characters."""
        if not url:
            return ""
        try:
            # Parse the URL
            parsed = urlparse(url)
            # Encode non-ASCII characters in path
            path = quote(unquote(parsed.path), safe='/:@!$&\'()*+,;?=')
            # Reconstruct URL
            return parsed._replace(path=path).geturl()
        except Exception:
            return url
    
    def crawl_site(self, base_url: str, max_depth: int = 1, max_pages: int = 50,
                   progress_callback: Optional[Callable] = None) -> Dict:
        from queue import Queue
        self.reset()
        
        visited = set()
        queue = Queue()
        # Safely encode the base URL
        safe_base = self.safe_url(base_url)
        queue.put((safe_base, 0))
        safe_base_domain = urlparse(safe_base).netloc
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
                progress_callback(f"Crawling [{depth}]: {url}")
            
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
                    # Join and safely encode
                    link = urljoin(url, raw_href)
                    link = self.safe_url(link)
                    parsed = urlparse(link)
                    
                    # Only follow same-domain links
                    if parsed.netloc == safe_base_domain:
                        if (link, depth + 1) not in queue.queue:
                            queue.put((link, depth + 1))
                except Exception:
                    continue
            
            # Extract article content if this looks like an article page
            article = self.extract_article(soup, url)
            if article:
                discovered_articles.append(article)
            
            time.sleep(self.rate_limit)
        
        return {
            "assets": self.assets,
            "articles": discovered_articles,
            "total_pages": len(visited)
        }
    
    def extract_article(self, soup: BeautifulSoup, url: str) -> Optional[Dict]:
        """Extract article content and images from parsed HTML."""
        if not soup:
            return None
        
        images = []
        
        # Extract images with captions
        for figure in soup.find_all('figure'):
            img = figure.find('img')
            if img:
                img_url = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if img_url and not img_url.startswith('data:'):
                    caption = figure.find('figcaption')
                    caption_text = caption.get_text(strip=True) if caption else ""
                    images.append({
                        "url": urljoin(url, img_url),
                        "alt": img.get('alt', ''),
                        "caption": caption_text
                    })
        
        # Extract standalone images
        for img in soup.find_all('img'):
            if len(images) >= 5:  # Limit to 5 images per article
                break
            img_url = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if img_url and not img_url.startswith('data:') and 'icon' not in img_url.lower():
                # Check if not already in list
                if not any(img_url in i['url'] for i in images):
                    images.append({
                        "url": urljoin(url, img_url),
                        "alt": img.get('alt', ''),
                        "caption": None
                    })
        
        # Try common article container selectors
        selectors = [
            ('article', None),
            ('main', None),
            ('div', {'class': re.compile(r'article|content|post|entry', re.I)}),
            ('div', {'id': re.compile(r'article|content|post|entry', re.I)}),
        ]
        
        for selector, attrs in selectors:
            container = soup.find(selector, attrs) if attrs else soup.find(selector)
            if container:
                title_elem = container.find(['h1', 'h2']) or soup.find('title')
                title = title_elem.get_text(strip=True) if title_elem else "Untitled"
                
                # Remove unwanted elements
                for unwanted in container.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                    unwanted.decompose()
                
                content = container.get_text(separator='\n', strip=True)
                
                if len(content) > 100:  # Only return if substantial content
                    return {
                        "source": "crawl",
                        "title": title,
                        "content": content,
                        "url": url,
                        "images": images
                    }
        
        return None
    
    def scrape_wikipedia(self, titles: List[str]) -> List[Dict]:
        """Scrape Wikipedia articles with images."""
        articles = []
        base_url = "https://en.wikipedia.org/w/api.php"
        
        for title in titles:
            # Fetch content
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
                            images = []
                            # Get main image
                            if "original" in page:
                                orig = page["original"]
                                images.append({
                                    "url": orig.get("source", ""),
                                    "alt": page.get("title", title),
                                    "caption": None
                                })
                            # Get thumbnail
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
    
    def scrape_website(self, url: str, max_depth: int = 0, max_pages: int = 50) -> List[Dict]:
        """Scrape articles from any website."""
        print(f"Scraping website: {url}")
        
        if max_depth == 0:
            # Single page
            html = self.fetch_url(url)
            if html:
                soup = self.parse_html(html)
                if soup:
                    article = self.extract_article(soup, url)
                    if article:
                        return [article]
        else:
            # Crawl site
            result = self.crawl_site(url, max_depth, max_pages)
            return result.get("articles", [])
        
        return []
    
    def scrape_from_file(self, filepath: str) -> List[str]:
        """Read titles/URLs from a file (one per line)."""
        titles = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    item = line.strip()
                    if item and not item.startswith('#'):
                        titles.append(item)
        except Exception as e:
            print(f"File error: {e}")
        return titles


def article_to_wiki_format(source_article: Dict) -> Dict:
    """Convert scraped article to AI Wikipedia format."""
    content = source_article["content"]
    source = source_article.get("source", "unknown")
    images = source_article.get("images", [])
    
    return {
        "id": int(str(hash(source_article["title"]))[:9]),
        "title": source_article["title"],
        "content": content,
        "summary": content[:500] + "..." if len(content) > 500 else content,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "verification_status": "verified" if source in ["wikipedia", "lex.dk"] else "unverified",
        "confidence_score": 0.95 if source in ["wikipedia", "lex.dk"] else 0.7,
        "citations": json.dumps([{
            "source": source,
            "url": source_article.get("url", ""),
            "accessed": datetime.now().isoformat()
        }]),
        "images": images
    }


def main():
    parser = argparse.ArgumentParser(
        description="Advanced Multi-Source Scraper for AI Wikipedia",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Wikipedia
  python3 scraper_advanced.py --source wikipedia --titles my_articles.txt
  
  # Lex.dk (Danish)
  python3 scraper_advanced.py --source lex.dk --query "Danmark"
  
  # Scrape a single website
  python3 scraper_advanced.py --source website --url "https://example.com/articles"
  
  # Crawl a website (2 levels deep)
  python3 scraper_advanced.py --source website --url "https://example.com" --crawl-depth 2
  
  # Use headless browser (for JavaScript sites)
  python3 scraper_advanced.py --source website --url "https://example.com" --selenium
        """
    )
    
    parser.add_argument("--source", choices=["wikipedia", "lex.dk", "website", "file", "all"], 
                       default="wikipedia", help="Data source")
    parser.add_argument("--query", help="Search query")
    parser.add_argument("--url", help="Website URL to scrape")
    parser.add_argument("--titles", help="File with titles/URLs (one per line)")
    parser.add_argument("--limit", type=int, default=50, help="Number of articles")
    parser.add_argument("--output", "-o", default="scraped_export.json")
    parser.add_argument("--delay", type=float, default=0.5, help="Rate limit delay (seconds)")
    parser.add_argument("--crawl-depth", type=int, default=0, help="Crawl depth (0=single page)")
    parser.add_argument("--max-pages", type=int, default=20, help="Max pages to crawl")
    parser.add_argument("--selenium", action="store_true", help="Use headless browser")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    scraper = AdvancedScraper(rate_limit=args.delay, use_selenium=args.selenium)
    all_articles = []
    
    print("=" * 50)
    print("AI Wikipedia - Advanced Scraper")
    print("=" * 50)
    print(f"Source: {args.source}")
    print(f"Output: {args.output}")
    if args.verbose:
        print(f"Rate limit: {args.delay}s")
        if args.selenium:
            print("Browser: Selenium (headless Chrome)")
    print("-" * 50)
    
    if args.source == "wikipedia":
        if args.titles:
            titles = scraper.scrape_from_file(args.titles)
        elif args.query:
            titles = [args.query]
        else:
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
    
    elif args.source == "website":
        if not args.url:
            print("Error: --url required for website scraping")
            return
        
        def progress(msg):
            if args.verbose:
                print(f"  {msg}")
        
        articles = scraper.scrape_website(args.url, args.crawl_depth, args.max_pages)
        all_articles.extend(articles)
    
    elif args.source == "file":
        if not args.titles:
            print("Error: --titles required for file mode")
            return
        
        items = scraper.scrape_from_file(args.titles)
        print(f"Processing {len(items)} items...")
        
        # Detect if URLs or titles
        for item in items:
            if item.startswith('http://') or item.startswith('https://'):
                # It's a URL
                scraped = scraper.scrape_website(item, args.crawl_depth, args.max_pages)
                all_articles.extend(scraped)
            else:
                # It's a Wikipedia title
                scraped = scraper.scrape_wikipedia([item])
                all_articles.extend(scraped)
    
    # Convert to AI Wikipedia format
    wiki_articles = [article_to_wiki_format(a) for a in all_articles]
    
    print("-" * 50)
    print(f"Total scraped: {len(wiki_articles)} articles")
    
    # Save
    export = {
        "version": "1.0.0",
        "exported": datetime.now().isoformat(),
        "source": args.source,
        "count": len(wiki_articles),
        "articles": wiki_articles
    }
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(export, f, indent=2, ensure_ascii=False)
    
    print(f"Saved: {args.output}")
    print("\nImport in AI Wikipedia: Export/Sync > Import from JSON")


if __name__ == "__main__":
    main()
