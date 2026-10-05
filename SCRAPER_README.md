# Advanced Scraper for AI Wikipedia

A versatile Python scraper with multi-source support, image capture, website crawling, graphical user interface, and JavaScript rendering support with anti-bot bypass.

## Features

- **Multi-Source** - Wikipedia, Lex.dk, any website
- **Image Capture** - Extracts images with captions from articles
- **Website Crawling** - Configurable depth with page limits
- **JavaScript Rendering** - undetected-chromedriver for anti-bot sites
- **Automatic Fallback** - Selenium → Curl → Auth → Direct
- **Credential Storage** - Encrypted username/password management
- **GUI Interface** - Visual scraper with preview
- **Unicode Support** - Handles non-ASCII URLs properly

## Installation

```bash
# Basic dependencies
pip install --break-system-packages beautifulsoup4 lxml

# For image preview in GUI
pip install --break-system-packages pillow

# For encrypted credential storage
pip install --break-system-packages cryptography

# For JavaScript-rendered/anti-bot sites (RECOMMENDED)
pip install --break-system-packages undetected-chromedriver
```

## Quick Start

### GUI Mode (Recommended)

```bash
python3 scraper_gui.py
```

The GUI provides:
- Source selection (Website, Wikipedia, Lex.dk)
- **JavaScript (Selenium) option** - Enabled by default for websites
- URL/query input
- Credential management with encryption
- Article preview
- Image preview with navigation
- Select/deselect articles
- Export to JSON

### Command Line Mode

```bash
# Website with anti-bot protection
python3 scraper_advanced.py --source website --url "https://example.com" --selenium

# Wikipedia
python3 scraper_advanced.py --source wikipedia --query "Machine Learning" --limit 10
```

## GUI Usage

### Starting the GUI

```bash
python3 scraper_gui.py
```

### Source Selection

Choose a source type from dropdown:
- **Website** - Any website URL (Selenium enabled by default)
- **Wikipedia** - Search and scrape Wikipedia articles
- **Lex.dk (Danish)** - Search Danish encyclopedia

### Cookie Policy

Select how to handle cookie consent from dropdown:
- **Accept all** - Accepts all cookies automatically
- **Essential only** - Only essential cookies
- **Ask each time** - Doesn't auto-dismiss, lets site ask

### JavaScript Rendering (Selenium)

For sites with anti-bot protection (like Politiken, Prenly, etc.):

1. "Use JavaScript (Selenium)" is **enabled by default** for websites
2. The button shows "Scrape with JS"
3. Click Scrape

**Deep Crawling with Sub-Pages:**

1. "Use JavaScript for sub-pages" is **enabled by default**
2. When scraping a frontpage, the scraper will follow article links
3. Each article link is fetched with Selenium for full JS rendering
4. **URL Pattern Detection** - Looks for `/p/` (Politiken), `/article/`, `/news/`, `/story/` patterns

**Fallback Chain:**
1. **Selenium** (undetected-chromedriver) - Bypasses anti-bot
2. **Curl** - Full browser headers
3. **Basic Auth** (if credentials provided)
4. **Direct** - Python urllib

### Tested Sites

| Site | Status | Notes |
|------|--------|-------|
| e-avis.politiken.dk | ✅ Works | Individual articles with JS + URL pattern matching |
| politiken.dk/.../p/ARTICLEID | ✅ Works | Direct article URLs with Selenium |
| prenly.com | ✅ Should work | With Selenium enabled |
| Wikipedia | ✅ Works | Direct API (throttled, retries on 429) |
| Lex.dk | ⚠️ Unavailable | Search API (`api.snl.no`) no longer resolves; prints clear message |
| Any website | ✅ Works | With Selenium |

### Visual Indicators

The scrape button shows progress:

| State | Button Text |
|-------|-------------|
| Idle | `Scrape` or `Scrape with JS` |
| Selenium | `Loading with JS...` |
| Curl fallback | `Trying curl...` |
| Auth fallback | `Trying auth...` |
| Direct fetch | `Fetching...` |
| Success | `Done` (resets after 2s) |
| Error | `Failed` (resets after 3s) |

### Article Preview

- Select articles from the list
- View full content in the preview panel
- Navigate with filter/search

### Image Preview

- Switch to "Images" tab
- Navigate through images with Prev/Next buttons
- View URL, alt text, and caption

### Credential Management

1. Click **+ Add New** in Authentication section
2. Enter domain, username, and password
3. Credentials are **encrypted** with Fernet (AES-128)
4. Stored in `~/.ai-wikipedia/credentials.enc`
5. Reuse saved credentials for future scrapes

### Export

1. Select articles from the list (Ctrl+Click for multiple)
2. Click **File → Export Selected**
3. Or **File → Export All**
4. Save as JSON file

## Command Line Usage

### Wikipedia

```bash
# Search and scrape
python3 scraper_advanced.py --source wikipedia --query "Python Programming" --limit 20
```

### Lex.dk (Danish Encyclopedia)

```bash
python3 scraper_advanced.py --source lex.dk --query "Danmark"
```

### Any Website

```bash
# Single page (auto-attempts all methods)
python3 scraper_advanced.py --source website --url "https://pol.dk"

# With Selenium explicitly
python3 scraper_advanced.py --source website --url "https://example.com" --selenium
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--source` | Data source (wikipedia, lex.dk, website, file) | website |
| `--query` | Search query | - |
| `--url` | Website URL to scrape | - |
| `--titles` | File with URLs/titles | - |
| `--limit` | Number of articles | 50 |
| `--output, -o` | Output file | scraped_export.json |
| `--delay` | Rate limit delay (seconds) | 0.5 |
| `--selenium` | Use headless browser | true |
| `--verbose, -v` | Verbose output | false |

## Output Format

```json
{
  "version": "1.3.0",
  "exported": "2026-03-19T12:00:00",
  "source": "website",
  "count": 5,
  "articles": [
    {
      "id": 123456789,
      "title": "Article Title",
      "content": "Full article text...",
      "summary": "First 200 chars...",
      "images": [
        {
          "url": "https://example.com/image.jpg",
          "alt": "Image description",
          "caption": "Optional caption"
        }
      ],
      "verification_status": "unverified",
      "confidence_score": 0,
      "citations": "[{\"source\":\"Scraped\",\"url\":\"...\"}]"
    }
  ]
}
```

## Importing

1. Run the scraper (GUI or CLI) → generates JSON file
2. Open AI Wikipedia
3. Click **Export / Sync**
4. Click **Import from JSON**
5. Select your exported file

## Credential Encryption

Credentials are encrypted using Fernet (symmetric encryption):
- Key stored in `~/.ai-wikipedia/.key` (permissions 0600)
- Credentials stored in `~/.ai-wikipedia/credentials.enc`
- Uses AES-128-CBC encryption
- Password is never stored in plain text

### Security Notes

- Credentials are encrypted at rest
- Key is stored locally on your machine
- For maximum security, use HTTPS URLs
- Clear credentials when done with `Credentials → Clear All Credentials`

## Troubleshooting

### Selenium Not Working

1. Install dependencies:
```bash
pip install --break-system-packages undetected-chromedriver
```

2. Check if Chrome/Chromium is installed:
```bash
google-chrome --version
# or
chromium --version
```

### Anti-Bot Sites Still Failing

Some sites have aggressive bot protection. Try:
1. Enable "Use JavaScript (Selenium)" checkbox
2. Wait a few minutes between scrapes
3. Use credentials if site requires login

### GUI Image Preview Not Working

Install pillow:
```bash
pip install --break-system-packages pillow
```

### Unicode Errors

The scraper handles non-ASCII URLs properly.

### Rate Limiting

Increase delay for sites with rate limits in the CLI version.

Wikipedia requests are **throttled automatically** (a short delay between API calls). Transient failures (`429`, `500`, `502`, `503`, `504`) are retried up to 3 times with exponential backoff, honoring the `Retry-After` response header when present. A descriptive `User-Agent` is sent with every request.

### IPv6 Connect Stalls

If requests take ~30s before responding on a machine without routable IPv6, run the scraper after `ScraperCore` has applied `force_ipv4()` (built-in since this release) — it sorts address resolution IPv4-first so requests connect immediately.

### Lex.dk Unavailable

Lex.dk search currently reports "Lex.dk: search API unreachable (api.snl.no no longer resolves). Lex.dk search is currently unavailable." The underlying `api.snl.no` endpoint is dead (NXDOMAIN) and the modern Lex.dk search is JavaScript-driven with no server-rendered results. Wikipedia remains the recommended source.

### Credential Decryption Failed

Delete corrupted files and re-add credentials:
```bash
rm ~/.ai-wikipedia/.key ~/.ai-wikipedia/credentials.enc
```
