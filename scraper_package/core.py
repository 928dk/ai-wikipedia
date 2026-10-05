"""
Core scraping functionality with multiple fallback methods.
Consolidates common code from all scraper files.
"""

import json
import time
import subprocess
import base64
import os
import re
import socket
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Callable
from urllib.parse import urljoin, urlparse, quote, unquote
import urllib.request
import urllib.error

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

try:
    import cryptography
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

try:
    import undetected_chromedriver as uc
    UNDETECTED_AVAILABLE = True
except ImportError:
    UNDETECTED_AVAILABLE = False


CONFIG_DIR = Path.home() / ".ai-wikipedia"
CREDENTIALS_FILE = CONFIG_DIR / "credentials.enc"

_IPV4_PREFERRED = False


def force_ipv4():
    """Prefer IPv4 for urllib connections.

    This box has no routable IPv6 (only Tailscale/ProtonVPN ULAs), but
    getaddrinfo lists IPv6 first for many hosts, so plain urllib requests
    stall on the IPv6 connect timeout (~30s) before falling back to IPv4.
    Reorder results so IPv4 is tried first; IPv6 remains as a fallback for
    IPv6-only hosts. Idempotent.
    """
    global _IPV4_PREFERRED
    if _IPV4_PREFERRED:
        return
    orig_getaddrinfo = socket.getaddrinfo

    def _ipv4_first(*args, **kwargs):
        results = orig_getaddrinfo(*args, **kwargs)
        return sorted(results, key=lambda r: 0 if r[0] == socket.AF_INET else 1)

    socket.getaddrinfo = _ipv4_first
    _IPV4_PREFERRED = True


def report_lex_dk_unreachable(exc: Exception):
    """Print a clear message when the Lex.dk/SNL search API is unreachable.

    The historical api.snl.no endpoint no longer resolves; surface that
    instead of a raw "could not resolve host" so the user knows Lex.dk
    search is simply unavailable rather than broken.
    """
    cause = getattr(exc, "reason", exc)
    if isinstance(cause, socket.gaierror):
        print("Lex.dk: search API unreachable (api.snl.no no longer resolves). "
              "Lex.dk search is currently unavailable.")
    else:
        print(f"Lex.dk: search API unreachable ({cause}). "
              "Lex.dk search is currently unavailable.")


class CredentialManager:
    """Encrypted credential storage."""
    
    def __init__(self):
        self.credentials = {}
        self.key = self._get_or_create_key()
        self._load()
    
    def _get_or_create_key(self) -> bytes:
        if not CRYPTO_AVAILABLE:
            raise RuntimeError("cryptography package required for credential storage: pip install cryptography")
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        key_file = CONFIG_DIR / ".key"
        if key_file.exists():
            return key_file.read_bytes()
        key = Fernet.generate_key()
        key_file.write_bytes(key)
        os.chmod(str(key_file), 0o600)
        return key
    
    def _load(self):
        if not CREDENTIALS_FILE.exists():
            return
        try:
            if CRYPTO_AVAILABLE:
                fernet = Fernet(self.key)
                with open(CREDENTIALS_FILE, 'rb') as file:
                    encrypted = file.read()
                decrypted = fernet.decrypt(encrypted)
                self.credentials = json.loads(decrypted)
            else:
                with open(CREDENTIALS_FILE, 'r') as f:
                    self.credentials = json.load(f)
        except Exception as e:
            print(f"Failed to load credentials: {e}")
            self.credentials = {}
    
    def _save(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        try:
            if CRYPTO_AVAILABLE:
                fernet = Fernet(self.key)
                encrypted = fernet.encrypt(json.dumps(self.credentials).encode())
                with open(CREDENTIALS_FILE, 'wb') as file:
                    file.write(encrypted)
            else:
                with open(CREDENTIALS_FILE, 'w') as f:
                    json.dump(self.credentials, f)
            os.chmod(str(CREDENTIALS_FILE), 0o600)
        except Exception as e:
            print(f"Failed to save credentials: {e}")
    
    def add(self, domain: str, username: str, password: str):
        self.credentials[domain] = {"username": username, "password": password}
        self._save()
    
    def get(self, domain: str) -> Optional[Dict]:
        return self.credentials.get(domain)
    
    def remove(self, domain: str):
        if domain in self.credentials:
            del self.credentials[domain]
            self._save()
    
    def list_domains(self) -> List[str]:
        return list(self.credentials.keys())


class ScraperCore:
    """Core scraping with multiple fallback methods."""
    
    def __init__(self, rate_limit: float = 0.5, use_selenium: bool = False):
        force_ipv4()
        self.rate_limit = rate_limit
        self.use_selenium = use_selenium
        self.session_headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AI-Wikipedia-Scraper/2.0'
        }
        self.visited = set()
        self.assets = {'html': [], 'js': [], 'css': [], 'images': [], 'others': []}
    
    def reset(self):
        self.visited = set()
        self.assets = {'html': [], 'js': [], 'css': [], 'images': [], 'others': []}
    
    def log(self, message: str, callback: Optional[Callable] = None):
        """Log message with optional callback."""
        timestamp = time.strftime("%H:%M:%S")
        log_line = f"[{timestamp}] {message}"
        if callback:
            callback(log_line)
        print(log_line)
    
    def fetch_url(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL with multiple fallback methods."""
        # Method 1: Direct request
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AI-Wikipedia-Scraper/2.0"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Direct fetch error: {e}")
        
        # Method 2: Curl fallback
        print("Trying curl fallback...")
        result = self.fetch_with_curl(url, timeout)
        if result:
            return result
        
        # Method 3: Selenium
        if self.use_selenium:
            print("Trying headless browser...")
            result = self.fetch_with_selenium(url, timeout)
            if result:
                return result
        
        return None
    
    def fetch_with_curl(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL using curl."""
        try:
            result = subprocess.run(
                ['curl', '-s', '-L', '-A', 'Mozilla/5.0', '--max-time', str(timeout), url],
                capture_output=True, text=True, timeout=timeout + 5
            )
            if result.returncode == 0:
                return result.stdout
        except Exception as e:
            print(f"Curl error: {e}")
        return None
    
    def fetch_with_selenium(self, url: str, timeout: int = 30, 
                            wait_time: int = 5, log_callback: Optional[Callable] = None) -> Optional[str]:
        """Fetch using undetected-chromedriver with cookie handling."""
        if not UNDETECTED_AVAILABLE:
            self.log("undetected-chromedriver not installed", log_callback)
            return None
        
        driver = None
        try:
            self.log("Starting headless Chrome...", log_callback)
            
            options = uc.ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            
            driver = uc.Chrome(options=options)
            driver.set_page_load_timeout(timeout)
            
            self.log(f"Navigating to: {url[:60]}...", log_callback)
            driver.get(url)
            
            time.sleep(wait_time)
            
            # Dismiss cookie consent
            self._dismiss_cookie_consent(driver, log_callback)
            
            html = driver.page_source
            self.log(f"Page loaded: {len(html)} chars", log_callback)
            return html
            
        except Exception as e:
            self.log(f"Selenium error: {e}", log_callback)
            return None
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
    
    def _dismiss_cookie_consent(self, driver, log_callback=None):
        """Dismiss various cookie consent overlays."""
        self.log("Looking for cookie consent...", log_callback)
        
        selectors = [
            ("#onetrust-accept-btn-handler", "OneTrust Accept"),
            ("#CybotCookiebotDialogBodyLevelButtonLevelAccept", "Cookiebot Accept"),
            (".cookie-banner button", "Cookie banner"),
            ("button:has-text('Accept')", "Accept button"),
            ("button:has-text('Accept all')", "Accept all"),
            ("button:has-text('Got it')", "Got it"),
        ]
        
        for selector, name in selectors:
            try:
                if ':has-text' in selector:
                    from selenium.webdriver.common.by import By
                    buttons = driver.find_elements(By.TAG_NAME, "button")
                    text = selector.split("'")[1]
                    for btn in buttons:
                        if text.lower() in btn.text.lower():
                            btn.click()
                            self.log(f"Clicked: {name}", log_callback)
                            time.sleep(1)
                            return True
                else:
                    from selenium.webdriver.common.by import By
                    from selenium.webdriver.support.ui import WebDriverWait
                    from selenium.webdriver.support import expected_conditions as EC
                    element = WebDriverWait(driver, 1).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    element.click()
                    self.log(f"Clicked: {name}", log_callback)
                    time.sleep(1)
                    return True
            except:
                continue
        
        # Try JS removal
        try:
            driver.execute_script("""
                document.querySelectorAll('[id*="cookie"], [class*="cookie"]').forEach(el => {
                    if (el.offsetWidth > 0) el.style.display = 'none';
                });
            """)
        except:
            pass
        
        self.log("No cookie consent found", log_callback)
        return False
    
    def parse_html(self, html: str) -> Optional[BeautifulSoup]:
        """Parse HTML content."""
        if not BS4_AVAILABLE or not html:
            return None
        try:
            return BeautifulSoup(html, 'lxml')
        except Exception as e:
            print(f"Parse error: {e}")
        return None
    
    def extract_article(self, html: str, base_url: str) -> Dict:
        """Extract article content and images from HTML."""
        if not BS4_AVAILABLE or not html:
            return {"title": "No content", "content": html[:1000] if html else "", "images": []}
        
        soup = BeautifulSoup(html, 'lxml')
        
        # Extract title
        title_tag = soup.find('h1') or soup.find('title')
        title = title_tag.get_text(strip=True) if title_tag else "Untitled"
        
        # Extract content
        content = ""
        selectors = [
            ('article', None),
            ('main', None),
            ('div', {'class': re.compile(r'article|content|post|entry', re.I)}),
            ('div', {'id': re.compile(r'article|content|post|entry', re.I)}),
        ]
        
        container = None
        for selector, attrs in selectors:
            container = soup.find(selector, attrs) if attrs else soup.find(selector)
            if container:
                for tag in container.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                    tag.decompose()
                content = container.get_text(separator='\n', strip=True)
                if len(content) > 100:
                    break
        
        if not content:
            for p in soup.find_all('p')[:20]:
                text = p.get_text(strip=True)
                if text:
                    content += text + "\n\n"
        
        # Extract images
        images = []
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src and not str(src).startswith('data:'):
                if not str(src).startswith('http'):
                    src = urljoin(base_url, str(src))
                alt = img.get('alt', '')
                
                # Try to get caption
                caption = ""
                parent = img.find_parent(['figure', 'div'])
                if parent:
                    figcaption = parent.find('figcaption')
                    if figcaption:
                        caption = figcaption.get_text(strip=True)
                
                if not any(src in i['url'] for i in images):
                    images.append({"url": str(src), "alt": alt, "caption": caption})
        
        return {"title": title, "content": content.strip(), "images": images[:10]}
    
    def safe_url(self, url: str) -> str:
        """Safely encode URL, handling non-ASCII characters."""
        if not url:
            return ""
        try:
            parsed = urlparse(url)
            path = quote(unquote(parsed.path), safe='/:@!$&\'()*+,;?=')
            return parsed._replace(path=path).geturl()
        except Exception:
            return url

    def search_wikipedia(self, query: str, limit: int = 10) -> List[Dict]:
        """Search Wikipedia opensearch API."""
        import urllib.parse as _up
        url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={_up.quote(query)}&limit={limit}&format=json"
        try:
            req = urllib.request.Request(url, headers=self.session_headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                titles = data[1]
                snippets = data[2]
                urls = data[3]
                return [{"title": t, "snippet": s, "url": u} for t, s, u in zip(titles, snippets, urls)]
        except Exception as e:
            print(f"Wikipedia search error: {e}")
            return []

    def fetch_wikipedia_article(self, title: str) -> Optional[str]:
        """Fetch a single Wikipedia article extract."""
        import urllib.parse as _up
        url = f"https://en.wikipedia.org/w/api.php?action=query&titles={_up.quote(title)}&prop=extracts&explaintext=1&format=json&origin=*"
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                pages = data.get('query', {}).get('pages', {})
                for page_id, page_data in pages.items():
                    if 'extract' in page_data:
                        return page_data['extract']
        except Exception as e:
            print(f"Wikipedia fetch error: {e}")
        return None

    def search_lexdk(self, query: str, limit: int = 5) -> List[Dict]:
        """Search Lex.dk (Den Store Danske) via SNL API."""
        import urllib.parse as _up
        url = f"https://api.snl.no/1.1/search?zone=lex&q={_up.quote(query)}&limit={limit}"
        try:
            req = urllib.request.Request(url, headers={**self.session_headers, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
                hits = data.get('hits', {}).get('hits', [])
                return [{"title": h.get('_source', {}).get('title', ''),
                         "url": h.get('_source', {}).get('url', ''),
                         "snippet": h.get('_source', {}).get('text', '')[:200]}
                        for h in hits]
        except urllib.error.URLError as e:
            report_lex_dk_unreachable(e)
        except Exception as e:
            print(f"Lex.dk search error: {e}")
        return []
