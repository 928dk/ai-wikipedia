#!/usr/bin/env python3
"""
GUI for Advanced Scraper - AI Wikipedia
With image preview, article preview, encrypted credential storage,
Selenium support (undetected-chromedriver), curl fallback,
cookie consent handling, and live terminal output.
"""

import json
import os
import sys
import base64
import hashlib
import subprocess
import time
from pathlib import Path
from typing import List, Dict, Optional
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse
from datetime import datetime

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: PIL not installed. Run: pip install pillow")

try:
    import cryptography
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    print("Warning: cryptography not installed. Run: pip install cryptography")

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    print("Warning: BeautifulSoup not installed. Run: pip install beautifulsoup4 lxml")

try:
    import undetected_chromedriver as uc
    UNDETECTED_AVAILABLE = True
except ImportError:
    UNDETECTED_AVAILABLE = False
    print("Warning: undetected-chromedriver not installed. Run: pip install undetected-chromedriver")

CONFIG_DIR = Path.home() / ".ai-wikipedia"
CREDENTIALS_FILE = CONFIG_DIR / "credentials.enc"

try:
    from scraper_package.core import ScraperCore as _BaseScraperCore
except ImportError:
    _BaseScraperCore = object


class CredentialManager:
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


class ScraperCore(_BaseScraperCore):
    """GUI scraper — extends the package base with GUI-specific overrides."""
    
    def __init__(self):
        super().__init__(rate_limit=0.5, use_selenium=False)
        self._selenium_driver = None
    
    def fetch_with_auth(self, url: str, username: str, password: str, timeout: int = 30) -> Optional[str]:
        try:
            credentials = f'{username}:{password}'
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            req = urllib.request.Request(url, headers={
                **self.session_headers,
                'Authorization': f'Basic {encoded_credentials}'
            })
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Auth fetch error: {e}")
            return None
    
    def fetch_with_selenium(self, url: str, timeout: int = 30, wait_time: int = 5,
                           cookie_policy: str = "accept_all", log_callback=None) -> Optional[str]:
        """Fetch URL using undetected-chromedriver with cookie handling (GUI override)."""
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
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--window-size=1920,1080")
            
            driver = uc.Chrome(options=options, version_main=145)
            driver.set_page_load_timeout(timeout)
            
            self.log(f"Navigating to: {url[:60]}...", log_callback)
            driver.get(url)
            
            self.log(f"Waiting {wait_time}s for page to load...", log_callback)
            time.sleep(wait_time)
            
            self._dismiss_cookie_consent(driver, log_callback)
            
            time.sleep(2)
            
            if cookie_policy == "essential_only":
                self._set_cookie_policy(driver, "essential", log_callback)
            
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
    
    def fetch_with_curl(self, url: str, timeout: int = 30) -> Optional[str]:
        """Fetch URL using curl with full browser headers (GUI override)."""
        try:
            parsed_url = urlparse(url)
            if parsed_url.scheme not in ('http', 'https'):
                print(f"Curl error: rejected non-http(s) URL: {url}")
                return None
            cmd = [
                'curl', '-s', '-L', '--max-time', str(timeout),
                '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                '-H', 'Accept-Language: da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7',
                '-H', 'Accept-Encoding: gzip, deflate, br',
                '-H', 'Connection: keep-alive',
                '-H', 'Upgrade-Insecure-Requests: 1',
                '-H', 'Sec-Fetch-Dest: document',
                '-H', 'Sec-Fetch-Mode: navigate',
                '-H', 'Sec-Fetch-Site: none',
                '-H', 'Sec-Fetch-User: ?1',
                url,
            ]
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout + 5
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout
        except Exception as e:
            print(f"Curl error: {e}")
        return None
    
    def _dismiss_cookie_consent(self, driver, log_callback=None):
        """Dismiss various cookie consent overlays (GUI override with extended selectors)."""
        self.log("Looking for cookie consent...", log_callback)
        
        selectors = [
            ("#onetrust-accept-btn-handler", "OneTrust Accept"),
            ("#onetrust-pc-btn-handler", "OneTrust Customize"),
            (".onetrust-pc-button-plugin", "OneTrust button"),
            ("#CybotCookiebotDialogBodyLevelButtonLevelButtonLevelAccept", "Cookiebot Accept"),
            ("#CybotCookiebotDialogBodyAccept", "Cookiebot Dialog Accept"),
            ("button:has-text('Accepter alle')", "Danish: Accept all"),
            ("button:has-text('Accepter cookies')", "Danish: Accept cookies"),
            ("button:has-text('Accepter')", "Danish: Accept"),
            ("button:has-text('Tillad alle')", "Danish: Allow all"),
            ("button:has-text('Tillad')", "Danish: Allow"),
            ("button:has-text('Jeg accepterer')", "Danish: I accept"),
            ("button:has-text('Accept all')", "English: Accept all"),
            ("button:has-text('Accept')", "English: Accept"),
            ("button:has-text('Allow all')", "English: Allow all"),
            ("button:has-text('Allow')", "English: Allow"),
            ("button:has-text('I accept')", "English: I accept"),
            ("button:has-text('Got it')", "English: Got it"),
            ("button:has-text('OK')", "English: OK"),
            ("button:has-text('Close')", "English: Close"),
            (".cookie-banner button", "Cookie banner"),
            (".cookie-consent button", "Cookie consent"),
            (".cookie-notice button", "Cookie notice"),
            (".CookieConsent button", "CookieConsent"),
            ("[class*='cookie'] button", "Class contains cookie"),
            ("[id*='cookie'] button", "ID contains cookie"),
            ("button[aria-label*='cookie']", "Aria cookie"),
            ("button[data-testid*='cookie']", "Testid cookie"),
        ]
        
        for selector, name in selectors:
            try:
                from selenium.webdriver.common.by import By
                from selenium.webdriver.support.ui import WebDriverWait
                from selenium.webdriver.support import expected_conditions as EC
                
                if ':has-text' in selector:
                    text = selector.split("'")[1] if "'" in selector else ""
                    buttons = driver.find_elements(By.TAG_NAME, "button")
                    for btn in buttons:
                        if text.lower() in btn.text.lower():
                            btn.click()
                            self.log(f"Clicked button: {name}", log_callback)
                            time.sleep(1)
                            return True
                else:
                    element = WebDriverWait(driver, 1).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    element.click()
                    self.log(f"Clicked: {name}", log_callback)
                    time.sleep(1)
                    return True
            except:
                continue
        
        try:
            driver.execute_script("""
                document.querySelectorAll(
                    '[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"], ' +
                    '#CybotCookiebot, #onetrust, .cc-banner, .cc-window'
                ).forEach(el => {
                    if (el.offsetWidth > 0 || el.offsetHeight > 0) {
                        el.style.display = 'none';
                    }
                });
            """)
            self.log("Removed cookie overlays via JS", log_callback)
            return True
        except:
            pass
        
        self.log("No cookie consent found (or already dismissed)", log_callback)
        return False
    
    def _set_cookie_policy(self, driver, policy: str, log_callback=None):
        """Set specific cookie policy if site supports it."""
        try:
            if policy == "essential":
                selectors = [
                    "button:has-text('Reject')",
                    "button:has-text('Essential only')",
                    "button:has-text('Necessary only')",
                    "[aria-label*='reject']",
                ]
                
                for selector in selectors:
                    try:
                        from selenium.webdriver.common.by import By
                        from selenium.webdriver.support.ui import WebDriverWait
                        from selenium.webdriver.support import expected_conditions as EC
                        
                        if ':has-text' in selector:
                            text = selector.split("'")[1]
                            buttons = driver.find_elements(By.TAG_NAME, "button")
                            for btn in buttons:
                                if text.lower() in btn.text.lower():
                                    btn.click()
                                    self.log(f"Set cookie policy: {text}", log_callback)
                                    return True
                        else:
                            element = WebDriverWait(driver, 2).until(
                                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                            )
                            element.click()
                            self.log(f"Set cookie policy: {selector}", log_callback)
                            return True
                    except:
                        continue
                        
        except Exception as e:
            self.log(f"Cookie policy error: {e}", log_callback)


class ScraperGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("AI Wikipedia Scraper")
        self.root.geometry("1200x900")
        
        self.scraper = ScraperCore()
        self.cred_manager = CredentialManager()
        
        self.scraped_articles = []
        self.preview_image_refs = []
        self._selenium_available = UNDETECTED_AVAILABLE
        
        self._setup_styles()
        self._create_menu_bar()
        self._create_main_ui()
    
    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        self.bg_color = '#f0f0f0'
        self.root.configure(bg=self.bg_color)
        
        style.configure('TFrame', background=self.bg_color)
        style.configure('Card.TFrame', background='white', relief='raised')
        
        style.configure('TLabel', background=self.bg_color, font=('Segoe UI', 10))
        style.configure('Header.TLabel', font=('Segoe UI', 14, 'bold'))
        style.configure('TButton', font=('Segoe UI', 10), padding=5)
        style.configure('Action.TButton', font=('Segoe UI', 10, 'bold'))
        
        style.configure('TRadiobutton', background=self.bg_color)
    
    def _create_menu_bar(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Export Selected...", command=self.export_selected)
        file_menu.add_command(label="Export All...", command=self.export_all)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        
        credentials_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Credentials", menu=credentials_menu)
        credentials_menu.add_command(label="Manage Credentials...", command=self.show_credentials_dialog)
        credentials_menu.add_command(label="Clear All Credentials", command=self.clear_credentials)
    
    def _create_main_ui(self):
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(main_paned, width=400)
        main_paned.add(left_frame, weight=1)
        
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=2)
        
        self._create_source_panel(left_frame)
        self._create_terminal_panel(left_frame)
        self._create_articles_list(left_frame)
        self._create_preview_panel(right_frame)
        
        self._create_status_bar()
    
    def _create_source_panel(self, parent):
        source_frame = ttk.LabelFrame(parent, text="Source", padding=10)
        source_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(source_frame, text="Source Type:").pack(anchor=tk.W)
        self.source_var = tk.StringVar(value="website")
        self.source_combo = ttk.Combobox(source_frame, textvariable=self.source_var, 
                                         values=["Website", "Wikipedia", "Lex.dk (Danish)"],
                                         state='readonly', width=18)
        self.source_combo.pack(anchor=tk.W, pady=(5, 0))
        self.source_combo.bind('<<ComboboxSelected>>', lambda e: self._on_source_change())
        
        ttk.Separator(source_frame, orient='horizontal').pack(fill='x', pady=(15, 10))
        
        selenium_frame = ttk.Frame(source_frame)
        selenium_frame.pack(anchor=tk.W, pady=(0, 5))
        
        self.use_selenium_var = tk.BooleanVar(value=True)
        self.use_selenium_subpages_var = tk.BooleanVar(value=True)
        
        ttk.Checkbutton(
            selenium_frame, 
            text="Use JavaScript (Selenium)",
            variable=self.use_selenium_var,
            command=self._on_selenium_toggle
        ).pack(anchor=tk.W)
        
        self.selenium_status = ttk.Label(
            selenium_frame, 
            text="Ready" if self._selenium_available else "Not installed",
            foreground="green" if self._selenium_available else "red"
        )
        self.selenium_status.pack(anchor=tk.W, padx=(20, 0))
        
        ttk.Checkbutton(
            source_frame, 
            text="Use JavaScript for sub-pages",
            variable=self.use_selenium_subpages_var
        ).pack(anchor=tk.W, pady=(5, 0))
        
        ttk.Label(
            source_frame, 
            text="Enables deep crawling of article links with JS rendering",
            foreground="gray"
        ).pack(anchor=tk.W, padx=(20, 0))
        
        ttk.Separator(source_frame, orient='horizontal').pack(fill='x', pady=(15, 10))
        
        wait_frame = ttk.Frame(source_frame)
        wait_frame.pack(anchor=tk.W, fill=tk.X)
        
        ttk.Label(wait_frame, text="Wait time:").pack(anchor=tk.W)
        
        wait_control = ttk.Frame(wait_frame)
        wait_control.pack(fill=tk.X, pady=(5, 0))
        
        self.wait_var = tk.IntVar(value=5)
        wait_scale = ttk.Scale(wait_control, from_=1, to=15, variable=self.wait_var, 
                               orient=tk.HORIZONTAL, length=150)
        wait_scale.pack(side=tk.LEFT)
        
        self.wait_label = ttk.Label(wait_control, text="5 sec")
        self.wait_label.pack(side=tk.LEFT, padx=(10, 0))
        
        wait_scale.bind('<Motion>', lambda e: self.wait_label.config(text=f"{self.wait_var.get()} sec"))
        
        ttk.Separator(source_frame, orient='horizontal').pack(fill='x', pady=(15, 10))
        
        ttk.Label(source_frame, text="Cookie Policy:").pack(anchor=tk.W)
        self.cookie_policy_var = tk.StringVar(value="accept_all")
        self.cookie_combo = ttk.Combobox(source_frame, textvariable=self.cookie_policy_var,
                                         values=["Accept all", "Essential only", "Ask each time"],
                                         state='readonly', width=18)
        self.cookie_combo.pack(anchor=tk.W, pady=(5, 0))
        
        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=5, pady=10)
        
        query_frame = ttk.LabelFrame(parent, text="Query", padding=10)
        query_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(query_frame, text="URL / Query:").pack(anchor=tk.W)
        self.url_entry = ttk.Entry(query_frame, font=('Segoe UI', 10))
        self.url_entry.pack(fill=tk.X, pady=(5, 0))
        self.url_entry.insert(0, "https://")
        
        ttk.Label(query_frame, text="Limit:").pack(anchor=tk.W, pady=(10, 0))
        self.limit_var = tk.StringVar(value="5")
        ttk.Entry(query_frame, textvariable=self.limit_var, width=10).pack(anchor=tk.W)
        
        self.auth_frame = ttk.LabelFrame(parent, text="Authentication (Optional)", padding=10)
        self.auth_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(self.auth_frame, text="Saved Credentials:").pack(anchor=tk.W)
        self.cred_var = tk.StringVar(value="")
        self.cred_combo = ttk.Combobox(self.auth_frame, textvariable=self.cred_var, state='readonly')
        self.cred_combo.pack(fill=tk.X, pady=(5, 0))
        self._update_cred_combo()
        
        ttk.Button(self.auth_frame, text="+ Add New", command=self.show_credentials_dialog).pack(pady=(5, 0))
        
        scrape_frame = ttk.Frame(parent)
        scrape_frame.pack(fill=tk.X, padx=5, pady=10)
        
        self.scrape_btn = ttk.Button(scrape_frame, text="Scrape with JS", 
                                     command=self.start_scrape, style='Action.TButton')
        self.scrape_btn.pack(fill=tk.X)
    
    def _create_terminal_panel(self, parent):
        terminal_frame = ttk.LabelFrame(parent, text="Browser Terminal", padding=5)
        terminal_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.terminal = tk.Text(terminal_frame, wrap=tk.WORD, font=('Consolas', 9),
                                bg='#1e1e1e', fg='#00ff00', insertbackground='white',
                                relief=tk.FLAT, state=tk.DISABLED)
        self.terminal.pack(fill=tk.BOTH, expand=True)
        
        # Configure tags
        self.terminal.tag_configure('info', foreground='#00ffff')
        self.terminal.tag_configure('warning', foreground='#ffff00')
        self.terminal.tag_configure('error', foreground='#ff5555')
        self.terminal.tag_configure('success', foreground='#55ff55')
        self.terminal.tag_configure('dim', foreground='#888888')
        
        # Add clear button
        btn_frame = ttk.Frame(terminal_frame)
        btn_frame.pack(fill=tk.X, pady=(5, 0))
        
        ttk.Button(btn_frame, text="Clear", command=self._clear_terminal).pack(side=tk.LEFT)
    
    def _log(self, message: str, tag: str = None):
        """Log message to terminal."""
        self.terminal.config(state=tk.NORMAL)
        if tag:
            self.terminal.insert(tk.END, message + "\n", tag)
        else:
            self.terminal.insert(tk.END, message + "\n")
        self.terminal.see(tk.END)
        self.terminal.config(state=tk.DISABLED)
    
    def _clear_terminal(self):
        """Clear terminal output."""
        self.terminal.config(state=tk.NORMAL)
        self.terminal.delete(1.0, tk.END)
        self.terminal.config(state=tk.DISABLED)
    
    def _on_selenium_toggle(self):
        """Update button text based on Selenium selection"""
        self._update_scrape_button()
    
    def _update_scrape_button(self):
        """Update button text with visual indicator"""
        if self.use_selenium_var.get():
            self.scrape_btn.config(text="Scrape with JS")
        else:
            self.scrape_btn.config(text="Scrape")
    
    def _create_articles_list(self, parent):
        list_frame = ttk.LabelFrame(parent, text="Scraped Articles", padding=10)
        list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        toolbar = ttk.Frame(list_frame)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(toolbar, text="Filter:").pack(side=tk.LEFT)
        self.filter_entry = ttk.Entry(toolbar, width=15)
        self.filter_entry.pack(side=tk.LEFT, padx=5)
        self.filter_entry.bind('<KeyRelease>', self._filter_articles)
        
        self.count_label = ttk.Label(toolbar, text="0 articles")
        self.count_label.pack(side=tk.RIGHT)
        
        list_container = ttk.Frame(list_frame)
        list_container.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(list_container)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.articles_listbox = tk.Listbox(list_container, yscrollcommand=scrollbar.set,
                                           font=('Segoe UI', 10), selectmode=tk.EXTENDED)
        self.articles_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.articles_listbox.yview)
        
        self.articles_listbox.bind('<<ListboxSelect>>', self._on_article_select)
        
        btn_frame = ttk.Frame(list_frame)
        btn_frame.pack(fill=tk.X, pady=(5, 0))
        
        ttk.Button(btn_frame, text="Select All", command=self._select_all).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="Deselect All", command=self._deselect_all).pack(side=tk.LEFT, padx=2)
    
    def _create_preview_panel(self, parent):
        preview_frame = ttk.LabelFrame(parent, text="Preview", padding=10)
        preview_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        notebook = ttk.Notebook(preview_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        self.article_preview = scrolledtext.ScrolledText(notebook, wrap=tk.WORD, 
                                                         font=('Segoe UI', 10), height=30)
        notebook.add(self.article_preview, text="Article Content")
        
        self.image_preview_frame = ttk.Frame(notebook)
        notebook.add(self.image_preview_frame, text="Images")
        
        self._create_image_preview_ui()
        
        self.article_preview.config(state=tk.DISABLED)
    
    def _create_image_preview_ui(self):
        toolbar = ttk.Frame(self.image_preview_frame)
        toolbar.pack(fill=tk.X, padx=5, pady=5)
        
        self.img_nav_label = ttk.Label(toolbar, text="Image 0 / 0")
        self.img_nav_label.pack(side=tk.LEFT)
        
        ttk.Button(toolbar, text="Prev", command=self._prev_image).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="Next", command=self._next_image).pack(side=tk.LEFT)
        
        preview = ttk.Frame(self.image_preview_frame)
        preview.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.img_canvas = tk.Canvas(preview, bg='#333333', height=400)
        self.img_canvas.pack(fill=tk.BOTH, expand=True)
        
        info_frame = ttk.Frame(self.image_preview_frame)
        info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.img_url_label = ttk.Label(info_frame, text="URL: -", wraplength=600)
        self.img_url_label.pack(anchor=tk.W)
        
        self.img_alt_label = ttk.Label(info_frame, text="Alt: -")
        self.img_alt_label.pack(anchor=tk.W)
        
        self.img_caption_label = ttk.Label(info_frame, text="Caption: -", wraplength=600)
        self.img_caption_label.pack(anchor=tk.W)
    
    def _create_status_bar(self):
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, 
                              relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.progress = ttk.Progressbar(status_bar, mode='indeterminate', length=200)
        self.progress.pack(side=tk.RIGHT, padx=5)
    
    def _on_source_change(self):
        source = self.source_var.get()
        
        if source == "Website":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "https://")
            self.use_selenium_var.set(True)
            self.use_selenium_subpages_var.set(True)
            self.source_combo.config(state='readonly')
        elif source == "Wikipedia":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "")
            self.use_selenium_var.set(False)
            self.use_selenium_subpages_var.set(False)
            self.source_combo.config(state='readonly')
        elif source == "Lex.dk (Danish)":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "")
            self.use_selenium_var.set(False)
            self.use_selenium_subpages_var.set(False)
            self.source_combo.config(state='readonly')
        
        self._update_scrape_button()
    
    def _update_cred_combo(self):
        domains = self.cred_manager.list_domains()
        self.cred_combo['values'] = ["(None)"] + domains
        if domains:
            self.cred_combo.current(0)
        else:
            self.cred_combo.set("")
    
    def show_credentials_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Manage Credentials")
        dialog.geometry("500x400")
        dialog.transient(self.root)
        dialog.grab_set()
        
        main_frame = ttk.Frame(dialog, padding=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(main_frame, text="Domain:", font=('Segoe UI', 10, 'bold')).pack(anchor=tk.W)
        domain_entry = ttk.Entry(main_frame, width=40)
        domain_entry.pack(fill=tk.X, pady=(5, 10))
        
        ttk.Label(main_frame, text="Username:").pack(anchor=tk.W)
        user_entry = ttk.Entry(main_frame, width=40)
        user_entry.pack(fill=tk.X, pady=(5, 10))
        
        ttk.Label(main_frame, text="Password:").pack(anchor=tk.W)
        pass_entry = ttk.Entry(main_frame, width=40, show="*")
        pass_entry.pack(fill=tk.X, pady=(5, 10))
        
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        
        def add_cred():
            domain = domain_entry.get().strip()
            username = user_entry.get()
            password = pass_entry.get()
            if domain and username and password:
                self.cred_manager.add(domain, username, password)
                self._update_cred_combo()
                messagebox.showinfo("Success", f"Credentials saved for {domain}")
                domain_entry.delete(0, tk.END)
                user_entry.delete(0, tk.END)
                pass_entry.delete(0, tk.END)
        
        ttk.Button(btn_frame, text="Add / Update", command=add_cred).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(main_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=15)
        
        ttk.Label(main_frame, text="Saved Credentials:", font=('Segoe UI', 10, 'bold')).pack(anchor=tk.W)
        
        list_frame = ttk.Frame(main_frame)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        cred_listbox = tk.Listbox(list_frame, yscrollcommand=scrollbar.set, height=10)
        cred_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=cred_listbox.yview)
        
        for domain in self.cred_manager.list_domains():
            cred_listbox.insert(tk.END, domain)
        
        def delete_cred():
            sel = cred_listbox.curselection()
            if sel:
                domain = cred_listbox.get(sel[0])
                self.cred_manager.remove(domain)
                cred_listbox.delete(sel[0])
                self._update_cred_combo()
                messagebox.showinfo("Deleted", f"Credentials removed for {domain}")
        
        ttk.Button(main_frame, text="Delete Selected", command=delete_cred).pack(pady=(5, 0))
        
        ttk.Button(main_frame, text="Close", command=dialog.destroy).pack(pady=(10, 0))
    
    def clear_credentials(self):
        if messagebox.askyesno("Confirm", "Delete all saved credentials?"):
            for domain in self.cred_manager.list_domains():
                self.cred_manager.remove(domain)
            self._update_cred_combo()
            messagebox.showinfo("Done", "All credentials cleared")
    
    def _filter_articles(self, event=None):
        filter_text = self.filter_entry.get().lower()
        self.articles_listbox.delete(0, tk.END)
        for i, article in enumerate(self.scraped_articles):
            if filter_text in article.get('title', '').lower():
                self.articles_listbox.insert(tk.END, article.get('title', f'Article {i+1}'))
    
    def _select_all(self):
        self.articles_listbox.select_set(0, tk.END)
    
    def _deselect_all(self):
        self.articles_listbox.selection_clear(0, tk.END)
    
    def _on_article_select(self, event=None):
        sel = self.articles_listbox.curselection()
        if not sel:
            return
        
        idx = sel[0]
        if idx < len(self.scraped_articles):
            article = self.scraped_articles[idx]
            self._show_article_preview(article)
            self._show_image_preview(article.get('images', []))
    
    def _show_article_preview(self, article: Dict):
        self.article_preview.config(state=tk.NORMAL)
        self.article_preview.delete(1.0, tk.END)
        
        title = article.get('title', 'Untitled')
        content = article.get('content', 'No content')
        
        self.article_preview.insert(tk.END, f"# {title}\n\n", 'header')
        self.article_preview.insert(tk.END, content)
        
        self.article_preview.tag_config('header', font=('Segoe UI', 14, 'bold'))
        self.article_preview.config(state=tk.DISABLED)
    
    def _show_image_preview(self, images: List):
        self.current_images = images
        self.current_image_idx = 0
        self._update_image_display()
    
    def _update_image_display(self):
        images = getattr(self, 'current_images', [])
        idx = getattr(self, 'current_image_idx', 0)
        
        self.img_nav_label.config(text=f"Image {idx + 1} / {len(images)}" if images else "No images")
        
        self.img_canvas.delete("all")
        self.preview_image_refs = []
        
        if images and idx < len(images):
            img_data = images[idx]
            self.img_url_label.config(text=f"URL: {img_data.get('url', '-')}")
            self.img_alt_label.config(text=f"Alt: {img_data.get('alt', '-')}")
            caption = img_data.get('caption', '')
            self.img_caption_label.config(text=f"Caption: {caption if caption else '-'}")
            
            if PIL_AVAILABLE:
                try:
                    from PIL import Image, ImageTk
                    import io
                    
                    url = img_data.get('url', '')
                    if url:
                        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req, timeout=10) as resp:
                            img_bytes = resp.read()
                        img = Image.open(io.BytesIO(img_bytes))
                        img.thumbnail((600, 400), Image.Resampling.LANCZOS)
                        photo = ImageTk.PhotoImage(img)
                        self.preview_image_refs.append(photo)
                        
                        x = (600 - photo.width()) // 2
                        y = (400 - photo.height()) // 2
                        self.img_canvas.create_image(x, y, anchor=tk.NW, image=photo)
                except Exception as e:
                    self.img_canvas.create_text(200, 200, text=f"Failed to load image\n{e}", 
                                                fill='white', font=('Segoe UI', 10))
        else:
            self.img_url_label.config(text="URL: -")
            self.img_alt_label.config(text="Alt: -")
            self.img_caption_label.config(text="Caption: -")
    
    def _prev_image(self):
        images = getattr(self, 'current_images', [])
        if images:
            self.current_image_idx = (self.current_image_idx - 1) % len(images)
            self._update_image_display()
    
    def _next_image(self):
        images = getattr(self, 'current_images', [])
        if images:
            self.current_image_idx = (self.current_image_idx + 1) % len(images)
            self._update_image_display()
    
    def start_scrape(self):
        source = self.source_var.get()
        query = self.url_entry.get().strip()
        limit = int(self.limit_var.get() or 5)
        cred_domain = self.cred_var.get()
        wait_time = self.wait_var.get()
        cookie_display = self.cookie_policy_var.get()
        
        cookie_policy_map = {
            "Accept all": "accept_all",
            "Essential only": "essential_only", 
            "Ask each time": "ask"
        }
        cookie_policy = cookie_policy_map.get(cookie_display, "accept_all")
        
        if source == "Website" and not query.startswith('http'):
            messagebox.showerror("Error", "Please enter a valid URL")
            return
        
        if not query and source != "Website":
            messagebox.showerror("Error", "Please enter a search query")
            return
        
        self._clear_terminal()
        self._log("=" * 50)
        self._log("Starting scrape...", "info")
        self._log(f"Source: {source}")
        self._log(f"URL/Query: {query[:60]}...")
        self._log(f"Wait time: {wait_time}s")
        self._log(f"Cookie policy: {cookie_policy}")
        self._log("=" * 50)
        
        self.scrape_btn.config(state=tk.DISABLED)
        self.progress.start()
        self.status_var.set("Scraping...")
        
        self.scraped_articles = []
        self.articles_listbox.delete(0, tk.END)
        
        self._update_scrape_button()
        
        def run_scrape():
            try:
                if source == "Website":
                    self._scrape_website(query, cred_domain, limit, wait_time, cookie_policy)
                elif source == "Wikipedia":
                    self._scrape_wikipedia(query, limit)
                elif source == "Lex.dk (Danish)":
                    self._scrape_lexdk(query, limit)
                
                self.root.after(0, self._scrape_complete)
            except Exception as e:
                self.root.after(0, lambda: self._scrape_error(str(e)))
        
        import threading
        thread = threading.Thread(target=run_scrape)
        thread.daemon = True
        thread.start()
    
    def _scrape_website(self, url: str, cred_domain: str, limit: int, wait_time: int, cookie_policy: str):
        username = password = None
        if cred_domain and cred_domain != "(None)":
            creds = self.cred_manager.get(cred_domain)
            if creds:
                username = creds['username']
                password = creds['password']
        
        html = None
        method_used = "None"
        
        # 1. Try Selenium if enabled
        if self.use_selenium_var.get():
            self.root.after(0, lambda: self.scrape_btn.config(text="Loading with JS..."))
            html = self.scraper.fetch_with_selenium(url, wait_time=wait_time, 
                                                    cookie_policy=cookie_policy,
                                                    log_callback=lambda msg: self.root.after(0, lambda m=msg: self._log(m)))
            if html and len(html) > 100:
                method_used = "Selenium"
            else:
                html = None
        
        # 2. Fallback to curl
        if not html or len(html) < 100:
            self.root.after(0, lambda: self.scrape_btn.config(text="Trying curl..."))
            self._log("Selenium failed, trying curl...", "warning")
            html = self.scraper.fetch_with_curl(url)
            if html and len(html) > 100:
                method_used = "Curl"
            else:
                html = None
        
        # 3. Auth fallback
        if not html and username and password:
            self.root.after(0, lambda: self.scrape_btn.config(text="Trying auth..."))
            self._log("Trying with authentication...", "warning")
            html = self.scraper.fetch_with_auth(url, username, password)
            if html:
                method_used = "Basic Auth"
        
        # 4. Direct fallback
        if not html:
            self.root.after(0, lambda: self.scrape_btn.config(text="Fetching..."))
            self._log("Trying direct fetch...", "warning")
            html = self.scraper.fetch(url)
            method_used = "Direct"
        
        self._log(f"Method used: {method_used}", "success")
        
        if html:
            # Check if we got cookie content instead of real content
            if "cookie" in html[:500].lower() and len(html) < 10000:
                self._log("Got cookie page instead of content", "warning")
                self._log("Try increasing wait time or using credentials", "warning")
            
            self._log("Extracting article...", "info")
            article = self.scraper.extract_article(html, url)
            article['source_url'] = url
            self.scraped_articles.append(article)
            self._log(f"Extracted: {len(article.get('content', ''))} chars", "success")
            self._log(f"Images found: {len(article.get('images', []))}", "info")
            
            # Try to find more article links
            if limit > 1 and BS4_AVAILABLE:
                self._log(f"Looking for more articles (limit: {limit})...", "info")
                soup = BeautifulSoup(html, 'lxml')
                
                # Find article links with URL pattern matching
                article_links = []
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    text = link.get_text(strip=True)
                    
                    # Skip anchors, javascript, mailto
                    if not href or str(href).startswith(('#', 'javascript:', 'mailto:')):
                        continue
                    
                    # Skip navigation/social links
                    skip_patterns = ['/login', '/signup', '/subscribe', '/newsletter', '/search', 
                                     '/category/', '/tag/', '/author/', '/om-', '/kontakt', '/redaktion']
                    if any(p in str(href).lower() for p in skip_patterns):
                        continue
                    
                    # Look for article-like URLs (politiken pattern, /article/, /news/, etc.)
                    href_str = str(href)
                    is_article_url = (
                        '/p/' in href_str or                    # Politiken pattern
                        '/article' in href_str.lower() or
                        '/news/' in href_str.lower() or
                        '/story/' in href_str.lower() or
                        (len(text) > 20 and '/20' in href_str)  # Date pattern in URL
                    )
                    
                    if is_article_url:
                        if not href_str.startswith('http'):
                            href = urljoin(url, href_str)
                        if urlparse(href).netloc == urlparse(url).netloc:
                            article_links.append((href, text))
                
                article_links = article_links[:limit - 1]
                self._log(f"Found {len(article_links)} article links", "info")
                
                for i, (href, text) in enumerate(article_links):
                    self._log(f"Fetching article {i+1}/{len(article_links)}: {text[:40]}...", "dim")
                    time.sleep(self.scraper.rate_limit)
                    
                    # Use Selenium for sub-pages if enabled
                    if self.use_selenium_subpages_var.get() and UNDETECTED_AVAILABLE:
                        sub_html = self.scraper.fetch_with_selenium(
                            href, wait_time=wait_time, 
                            cookie_policy=cookie_policy,
                            log_callback=lambda msg: self.root.after(0, lambda m=msg: self._log(f"  {m}"))
                        )
                    else:
                        sub_html = self.scraper.fetch(href)
                    
                    if sub_html:
                        sub_article = self.scraper.extract_article(sub_html, href)
                        sub_article['source_url'] = href
                        if sub_article.get('content') and len(sub_article.get('content', '')) > 100:
                            self.scraped_articles.append(sub_article)
                            self._log(f"  OK: {len(sub_article.get('content', ''))} chars", "success")
                        else:
                            self._log(f"  Skipped: Not enough content", "warning")
    def _scrape_wikipedia(self, query: str, limit: int):
        self._log(f"Searching Wikipedia for: {query}", "info")
        results = self.scraper.search_wikipedia(query, limit)
        self._log(f"Found {len(results)} results", "success")
        
        for i, result in enumerate(results):
            self._log(f"Fetching article {i+1}/{len(results)}: {result['title'][:40]}...", "dim")
            time.sleep(self.scraper.rate_limit)
            extract = self.scraper.fetch_wikipedia_article(result['title'])
            if extract:
                self.scraped_articles.append({
                    'title': result['title'],
                    'content': extract,
                    'source_url': result['url'],
                    'images': []
                })
                self._log(f"  OK: {len(extract)} chars", "success")
    
    def _scrape_lexdk(self, query: str, limit: int):
        self._log(f"Searching Lex.dk for: {query}", "info")
        results = self.scraper.search_lexdk(query, limit)
        self._log(f"Found {len(results)} results", "success")
        
        for result in results:
            self.scraped_articles.append({
                'title': result['title'],
                'content': result.get('snippet', ''),
                'source_url': result.get('url', ''),
                'images': []
            })
        self._log("Extraction complete", "success")
    
    def _scrape_complete(self):
        self.progress.stop()
        self.scrape_btn.config(state=tk.NORMAL)
        self.scrape_btn.config(text="Done")
        
        self.articles_listbox.delete(0, tk.END)
        for i, article in enumerate(self.scraped_articles):
            self.articles_listbox.insert(tk.END, article.get('title', f'Article {i+1}'))
        
        self.count_label.config(text=f"{len(self.scraped_articles)} articles")
        self.status_var.set(f"Complete: {len(self.scraped_articles)} articles scraped")
        self._log("=" * 50)
        self._log(f"Scraping complete! {len(self.scraped_articles)} articles", "success")
        self._log("=" * 50)
        
        self.root.after(2000, self._update_scrape_button)
        
        if self.scraped_articles:
            self.articles_listbox.selection_set(0)
            self._on_article_select()
    
    def _scrape_error(self, error: str):
        self.progress.stop()
        self.scrape_btn.config(state=tk.NORMAL)
        self.scrape_btn.config(text="Failed")
        self.status_var.set("Error")
        self._log(f"ERROR: {error}", "error")
        messagebox.showerror("Scraping Error", str(error))
        self.root.after(3000, self._update_scrape_button)
    
    def export_selected(self):
        sel = self.articles_listbox.curselection()
        if not sel:
            messagebox.showinfo("Info", "Select articles to export")
            return
        
        articles = [self.scraped_articles[i] for i in sel]
        self._do_export(articles)
    
    def export_all(self):
        if not self.scraped_articles:
            messagebox.showinfo("Info", "No articles to export")
            return
        self._do_export(self.scraped_articles)
    
    def _do_export(self, articles: List[Dict]):
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
            title="Export Articles"
        )
        
        if not filename:
            return
        
        wiki_format = []
        for a in articles:
            wiki_format.append({
                "id": int(time.time() * 1000) + wiki_format.__len__(),
                "title": a.get('title', 'Untitled'),
                "content": a.get('content', ''),
                "summary": a.get('content', '')[:200] + ('...' if len(a.get('content', '')) > 200 else ''),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "verification_status": "unverified",
                "confidence_score": 0,
                "citations": json.dumps([{"source": "Scraped", "url": a.get('source_url', '')}]),
                "images": a.get('images', [])
            })
        
        export_data = {
            "version": "1.3.0",
            "exported": datetime.now().isoformat(),
            "count": len(wiki_format),
            "articles": wiki_format
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        self._log(f"Exported {len(wiki_format)} articles to {filename}", "success")
        messagebox.showinfo("Exported", f"Saved {len(wiki_format)} articles to {filename}")
    
    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = ScraperGUI()
    app.run()
