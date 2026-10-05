"""
GUI for Advanced Scraper with image preview, article preview,
encrypted credential storage, and live terminal output.
"""

import json
import sys
import time
from pathlib import Path
from typing import List, Dict, Optional, Callable
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import urllib.request
import urllib.parse

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from .core import ScraperCore, CredentialManager
from .wikipedia import WikipediaScraper
from .advanced import AdvancedScraper
from .utils import article_to_wiki_format


class ScraperGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("AI Wikipedia Scraper v2.0")
        self.root.geometry("1200x900")
        
        self.scraper = ScraperCore()
        self.wiki_scraper = WikipediaScraper()
        self.advanced_scraper = AdvancedScraper()
        self.cred_manager = CredentialManager()
        
        self.scraped_articles = []
        self.preview_image_refs = []
        self._selenium_available = True  # Will be updated in _setup_styles
        
        self._setup_styles()
        self._create_menu_bar()
        self._create_main_ui()
    
    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        self.bg_color = '#f0f0f0'
        self.root.configure(bg=self.bg_color)
        
        self._selenium_available = True  # Update based on import
        try:
            import undetected_chromedriver as uc
        except ImportError:
            self._selenium_available = False
        
        style.configure('TFrame', background=self.bg_color)
        style.configure('Card.TFrame', background='white', relief='raised')
        style.configure('TLabel', background=self.bg_color, font=('Segoe UI', 10))
        style.configure('Header.TLabel', font=('Segoe UI', 14, 'bold'))
        style.configure('TButton', font=('Segoe UI', 10), padding=5)
        style.configure('Action.TButton', font=('Segoe UI', 10, 'bold'))
    
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
        ttk.Checkbutton(selenium_frame, text="Use JavaScript (Selenium)", 
                        variable=self.use_selenium_var, command=self._on_selenium_toggle).pack(anchor=tk.W)
        
        self.selenium_status = ttk.Label(selenium_frame, 
                                       text="Ready" if self._selenium_available else "Not installed",
                                       foreground="green" if self._selenium_available else "red")
        self.selenium_status.pack(anchor=tk.W, padx=(20, 0))
        
        ttk.Label(source_frame, text="Cookie Policy:").pack(anchor=tk.W, pady=(10, 0))
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
        
        self.terminal.tag_configure('info', foreground='#00ffff')
        self.terminal.tag_configure('warning', foreground='#ffff00')
        self.terminal.tag_configure('error', foreground='#ff5555')
        self.terminal.tag_configure('success', foreground='#55ff55')
        
        btn_frame = ttk.Frame(terminal_frame)
        btn_frame.pack(fill=tk.X, pady=(5, 0))
        ttk.Button(btn_frame, text="Clear", command=self._clear_terminal).pack(side=tk.LEFT)
    
    def _log(self, message: str, tag: str = None):
        self.terminal.config(state=tk.NORMAL)
        if tag:
            self.terminal.insert(tk.END, message + "\n", tag)
        else:
            self.terminal.insert(tk.END, message + "\n")
        self.terminal.see(tk.END)
        self.terminal.config(state=tk.DISABLED)
    
    def _clear_terminal(self):
        self.terminal.config(state=tk.NORMAL)
        self.terminal.delete(1.0, tk.END)
        self.terminal.config(state=tk.DISABLED)
    
    def _on_source_change(self):
        source = self.source_var.get()
        if source == "Website":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "https://")
            self.use_selenium_var.set(True)
        elif source == "Wikipedia":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "")
            self.use_selenium_var.set(False)
        elif source == "Lex.dk (Danish)":
            self.url_entry.delete(0, tk.END)
            self.url_entry.insert(0, "")
            self.use_selenium_var.set(False)
        self._update_scrape_button()
    
    def _update_scrape_button(self):
        if self.use_selenium_var.get():
            self.scrape_btn.config(text="Scrape with JS")
        else:
            self.scrape_btn.config(text="Scrape")
    
    def _on_selenium_toggle(self):
        self._update_scrape_button()
    
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
    
    def _create_status_bar(self):
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, 
                              relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _filter_articles(self, event=None):
        filter_text = self.filter_entry.get().lower()
        self.articles_listbox.delete(0, tk.END)
        for i, article in enumerate(self.scraped_articles):
            if filter_text in article.get('title', '').lower():
                self.articles_listbox.insert(tk.END, article.get('title', f'Article {i+1}'))
        self.count_label.config(text=f"{self.articles_listbox.size()} articles")
    
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
            
            if PIL_AVAILABLE:
                try:
                    url = img_data.get('url', '')
                    if url:
                        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req, timeout=10) as resp:
                            import io
                            img_bytes = resp.read()
                        img = Image.open(io.BytesIO(img_bytes))
                        img.thumbnail((600, 400))
                        photo = ImageTk.PhotoImage(img)
                        self.preview_image_refs.append(photo)
                        x = (600 - photo.width()) // 2
                        y = (400 - photo.height()) // 2
                        self.img_canvas.create_image(x, y, anchor=tk.NW, image=photo)
                except Exception as e:
                    self.img_canvas.create_text(200, 200, text=f"Failed to load image\n{e}", 
                                                fill='white', font=('Segoe UI', 10))
    
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
        
        if source == "Website" and not query.startswith('http'):
            messagebox.showerror("Error", "Please enter a valid URL")
            return
        
        if not query and source != "Website":
            messagebox.showerror("Error", "Please enter a search query")
            return
        
        self._clear_terminal()
        self._log("=" * 50)
        self._log("Starting scrape...")
        self._log(f"Source: {source}")
        self._log(f"URL/Query: {query[:60]}...")
        self._log("=" * 50)
        
        self.scrape_btn.config(state=tk.DISABLED)
        self.status_var.set("Scraping...")
        
        self.scraped_articles = []
        self.articles_listbox.delete(0, tk.END)
        
        def run_scrape():
            try:
                if source == "Website":
                    self._scrape_website(query, limit)
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
    
    def _scrape_website(self, url: str, limit: int):
        html = self.scraper.fetch_url(url)
        if html:
            article = self.scraper.extract_article(html, url)
            if article:
                article['source_url'] = url
                self.scraped_articles.append(article)
                self.root.after(0, lambda: self._log(f"Extracted: {len(article.get('content', ''))} chars", "success"))
    
    def _scrape_wikipedia(self, query: str, limit: int):
        self._log(f"Searching Wikipedia for: {query}", "info")
        results = self.wiki_scraper.search(query, limit)
        self._log(f"Found {len(results)} results", "success")
        
        for i, result in enumerate(results):
            self._log(f"Fetching article {i+1}/{len(results)}: {result['title'][:40]}...", "dim")
            article = self.wiki_scraper.get_article(result['title'])
            if article:
                article['source_url'] = result['url']
                self.scraped_articles.append(article)
    
    def _scrape_lexdk(self, query: str, limit: int):
        self._log(f"Searching Lex.dk for: {query}", "info")
        articles = self.advanced_scraper.scrape_lex_dk(query, limit)
        self.scraped_articles.extend(articles)
        self._log(f"Found {len(articles)} articles", "success")
    
    def _scrape_complete(self):
        self.scrape_btn.config(state=tk.NORMAL)
        self.status_var.set("Ready")
        self._filter_articles()
        self._log("-" * 50)
        self._log(f"Total scraped: {len(self.scraped_articles)} articles", "success")
    
    def _scrape_error(self, error_msg: str):
        self.scrape_btn.config(state=tk.NORMAL)
        self.status_var.set("Error")
        self._log(f"Error: {error_msg}", "error")
    
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
                messagebox.showinfo("Success", f"Credentials saved for {domain}")
                domain_entry.delete(0, tk.END)
                user_entry.delete(0, tk.END)
                pass_entry.delete(0, tk.END)
        
        ttk.Button(btn_frame, text="Add / Update", command=add_cred).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="Close", command=dialog.destroy).pack(side=tk.LEFT, padx=2)
    
    def clear_credentials(self):
        if messagebox.askyesno("Confirm", "Delete all saved credentials?"):
            for domain in self.cred_manager.list_domains():
                self.cred_manager.remove(domain)
            messagebox.showinfo("Done", "All credentials cleared")
    
    def export_selected(self):
        sel = self.articles_listbox.curselection()
        if not sel:
            messagebox.showwarning("No Selection", "Please select articles to export")
            return
        
        filename = filedialog.asksaveasfilename(defaultextension=".json",
                                                   filetypes=[("JSON files", "*.json")])
        if filename:
            articles = [self.scraped_articles[i] for i in sel]
            from .utils import export_articles
            export_articles(articles, filename, "gui_export")
    
    def export_all(self):
        if not self.scraped_articles:
            messagebox.showwarning("No Articles", "No articles to export")
            return
        
        filename = filedialog.asksaveasfilename(defaultextension=".json",
                                                   filetypes=[("JSON files", "*.json")])
        if filename:
            from .utils import export_articles
            export_articles(self.scraped_articles, filename, "gui_export")
    
    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = ScraperGUI()
    app.run()
