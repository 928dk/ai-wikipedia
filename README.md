# AI Wikipedia

> **Environment note (spec 152, 2026-10-03).** This project runs on **system Python** (`python3`). Its old `venv` symlink pointed into the non-existent `/opt/shared` pool and has been **removed**; no venv is needed. Dependencies (`beautifulsoup4 lxml urllib3 requests`) are checked and installed by `launch_scraper_gui.sh`.


A portable, privacy-first AI Wikipedia powered by Ollama with multi-source verification and document parsing.

## Version
**Current:** v1.7.4 (2026-06-01)

## Features

- **Nightly Article Sync** - Background worker automatically fetches Wikipedia News + Random articles every 24h
- **AI Article Generation** - Create articles using local Ollama LLM with RAG and verification
- **AI Chat Interface** - CLI-style terminal with tool calling (scrape web, parse docs, check knowledge base)
- **Tool Calling Support** - AI can scrape webpages, parse documents (PDF, Word, Excel, PPT, EPUB, code, media, ZIP), list articles
- **RAG (Retrieval Augmented Generation)** - AI uses your imported articles as context
- **Multi-Source Verification** - Verify claims against 20+ authoritative sources (minimum 2 required)
  - **Lex.dk (Den Store Danske)** - Denmark's National Encyclopedia (most trusted)
  - **Wikipedia & WikiData** - International encyclopedia and structured data
  - **20+ Danish & International APIs** - Statistics, legal, business, and more
- **Document Parser System** - Parse and extract content from various file types using Python scripts
- **Article Editor** - Edit and update existing articles
- **Compressed Storage** - LZ4/Zstd compression for Wikipedia dumps (16GB → ~5-6GB)
- **Import Articles** - Import from Wikipedia or scraped JSON files
- **Portable & Syncable** - Export/import JSON for syncing across devices
- **Dark Mode** - Built-in theme toggle
- **Unicode Spinner** - Smooth loading animation (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) during generation
- **Dynamic Model Detection** - Auto-detects available Ollama models, defaults to `qwen2.5:3b`

## Quick Start

### Prerequisites

1. **Ollama** - Install from [ollama.ai](https://ollama.ai)
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama service (GPU mode for 4GB VRAM)
   OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve
   
   # Pull recommended model (works on 4GB GPU)
   ollama pull qwen2.5:3b
   ```

2. **Node.js** - v18+ required

3. **Python 3** - For document parsers
   ```bash
   # Install parser dependencies (Arch Linux)
   pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub
   ```

### Installation

```bash
# Clone or copy the project
cd /path/to/ai-wikipedia

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Open [http://localhost:1420](http://localhost:1420) in your browser.

### Building Desktop App (Tauri)

```bash
# Install Rust (required for Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the Tauri app
npm run tauri build
```

Executable will be in `src-tauri/target/release/` or `src-tauri/target/debug/`.

### Launch Script

```bash
# Use the launch script (starts Ollama + Tauri dev)
./launch_ai_wikipedia.sh
```

## Nightly Article Sync

The app automatically fetches articles every 24 hours from two sources:
- **Pipe A: News** - Wikipedia "In the News" featured articles
- **Pipe B: Random** - Random Wikipedia articles for discovery

### Sync Status
- A sync status bar shows at the top of the article list when running as a Tauri app
- Shows enabled/disabled status, last sync time, and queue count
- Click "Sync Now" to trigger an immediate sync
- Click "Settings" to configure sync behavior

### Sync Settings
- **Enable/Disable** - Turn nightly sync on/off
- **Pipe A (News)** - Toggle featured news article fetching
- **Pipe B (Random)** - Toggle random article discovery
- **Max Articles** - Limit articles per sync cycle
- **Interval** - Set sync frequency in hours (default: 24)
- **Trigger Sync Now** - Manual one-time sync
- **Clear Queue** - Remove pending articles from queue

### Chat Status
When articles are synced, the ChatInterface welcome area shows:
> "📡 X articles synced from Wikipedia. Queue ready for review."

## Usage

### AI Chat (Always Visible)

The AI CLI chat is always visible under the search bar:
- **Tool Calling** - AI can scrape webpages, parse documents, check article count
- **Model Selection** - Auto-detected from Ollama (qwen2.5:3b, codellama:7b, llama3.2, etc.)
- **Web Verify Toggle** - Cross-reference answers with external sources
- **RAG Context** - AI uses your imported articles when available
- **Import File Menu** - Dropdown to import and parse documents directly

### Generate Article with AI

1. Click **"+ Generate with AI"**
2. Enter a topic (e.g., "Quantum Computing")
3. Select model from dropdown
4. Click **Generate**
5. Article is created using Ollama with:
   - RAG context from your imported articles
   - Verification from external sources
   - Source citations in the output
   - Unicode spinner animation during generation

### Tool Calling Examples

Ask the AI to use tools:
- *"Scrape this webpage: https://example.com"*
- *"Parse this PDF file: /home/user/documents/report.pdf"*
- *"How many articles are in my knowledge base?"*
- *"List all articles I have saved"*
- *"Parse this code file: /path/to/script.py"*

### Parse Documents

1. Click **"Import File"** dropdown in chat
2. Select file type (PDF, Word, Excel, PPT, EPUB, HTML, Markdown, Text, Code, Media, ZIP, Legacy Doc)
3. Choose file via dialog
4. AI parses and extracts content with metadata
5. Content added to chat context

**Supported Formats:**
- **Documents:** PDF (pdfplumber), Word (python-docx), Excel (openpyxl), PowerPoint (python-pptx), EPUB (ebooklib)
- **Web:** HTML (beautifulsoup4), Markdown
- **Code:** Python, JS, TS, Java, C++, Rust, Go (AST extraction)
- **Media:** Images (Pillow), Audio/Video (pydub)
- **Other:** ZIP archives, Legacy .doc files

### Verify Claims

1. Open any article
2. Click **"Verify Claims"**
3. Each claim is checked against enabled sources
4. Results show: ✓ Verified, ? Disputed, or − Unverified
5. **Minimum 2 sources** required for verification

### Edit Articles

1. Open any article
2. Click **"Edit Article"**
3. Modify title, summary, or content
4. Manage images: add, remove, or reorder (↑↓)
5. Click **"Save Changes"**

### Enable/Disable Sources

1. Click **"Sources"** in the header
2. Toggle sources on/off
3. Add custom API endpoints
4. Changes persist in localStorage

### Import Articles

1. Click **"Import Article"**
2. Enter article titles from Wikipedia (one per line)
3. Click **"Import"**
4. Articles are added with verified status

Alternatively, use **"Export / Sync"** to import scraped JSON files.

### Export / Sync Data

1. Click **"Export / Sync"**
2. Click **"Export All"** to download JSON
3. Save to USB or cloud storage
4. On target device, use **"Import from JSON"**

## Advanced Scraper

Bulk import articles from any source with images:

```bash
# Wikipedia with images
python3 scraper_advanced.py --source wikipedia --query "Machine Learning" --limit 50

# Any website with crawling
python3 scraper_advanced.py --source website --url "https://pol.dk" --crawl-depth 1 --max-pages 10

# Lex.dk (Danish)
python3 scraper_advanced.py --source lex.dk --query "Danmark"
```

See `SCRAPER_README.md` for full documentation.

### Compressed Storage

1. Click **"Storage"** in the header
2. Choose compression: **LZ4** (fast) or **Zstd** (better ratio)
3. Click **"Save to Compressed Storage"**
4. View compression stats: original vs compressed size
5. Export compressed bundles for backup

**Expected compression ratios:**
| Algorithm | Ratio | Speed | CPU Impact |
|-----------|-------|-------|------------|
| LZ4 | ~40% | 2GB/s | Very Low |
| Zstd | ~35% | 500MB/s | Low-Med |

**For 16GB Wikipedia:** ~5-6GB with LZ4, ~4-5GB with Zstd

## Verification Sources

### Primary Sources (Enabled by Default)
| Source | Type | Description |
|--------|------|-------------|
| **Lex.dk** | Encyclopedia | Denmark's National Encyclopedia (Den Store Danske) |
| **Wikipedia** | Encyclopedia | International encyclopedia |
| **WikiData** | Structured Data | Structured knowledge base |

### Danish Public APIs
| Source | Keywords | Description |
|--------|----------|-------------|
| Danmarks Statistik | statistics, population | Statistics Denmark API |
| CVR.dk | company, virksomhed | Danish Business Register |
| Retsinformation | law, legal, folketing | Danish legal documents |
| Nationalbanken | currency, valuta | Exchange rates |
| Dataforsyningen | geo, address | Geospatial data |
| DMI Vejr | weather, vejr | Weather data |
| MotorAPI | vehicle, bil | Vehicle registration |
| Lægemiddelstyrelsen | medicine, medicin | Drug prices |
| SSI COVID-19 | covid, coronavirus | COVID-19 surveillance data |
| Folketinget | parliament, politics | Parliamentary documents |
| DSB Feeds | train, tog | Train schedules |
| Energi Data Service | energy, solar, wind | Energy production data |
| elprisenligenu.dk | electricity, strom | Electricity prices |

### International Sources
| Source | Keywords | Description |
|--------|----------|-------------|
| Eurostat | eu, european | EU Statistics |
| IMF Data | imf, global economy | International Monetary Fund |
| OECD Data | oecd | Economic cooperation data |
| SEC EDGAR | sec, edgar | US company filings |
| EUR-Lex | eu law | EU legislation |
| EconPapers | economics, research | Economics working papers |

### CBS Library Resources
| Source | Access | Description |
|--------|--------|-------------|
| CVR.dk | Free | Danish Business Register |
| Eurostat | Free | EU Statistics |
| IMF Data | Free | International statistics |
| SEC EDGAR | Free | US Company filings |
| EUR-Lex | Free | EU Law |
| OECD Data | Campus/VPN | OECD Publications |
| Domsdatabasen | Free | Danish Court Cases |
| EconLit | Campus/VPN | Economics literature |

**Note:** Some CBS library resources require campus or VPN access.

## Configuration

### Ollama Settings

The app connects to Ollama at `http://localhost:11434` by default.

To change the model, use the dropdown in the CLI Chat interface.

**Recommended models for 4GB GPU (GTX 960M):**
- `qwen2.5:3b` (1.9GB, ~3.5GB VRAM) - **Default, recommended**
- `codellama:7b` (3.8GB, ~3.6GB VRAM) - Good for code tasks

**Other models (CPU mode or higher VRAM):**
- `llama3.2:3b` (~2GB) - CPU mode on 4GB GPU
- `qwen2.5:14b-q4` (8.9GB) - CPU mode only
- `llama3.1:8b` (~5.7GB) - CPU mode only

**Model fallback chain:** `opencode/big-pickle` → gemini-3-pro → gemini-3-flash → gemini-2.5-flash → qwen-32b → llama3.1-8b → qwen2.5:3b → llama3.2:3b

### Adding Custom Verification Sources

Edit `CUSTOM_VERIFIERS` in `src/App.tsx`:

```typescript
const CUSTOM_VERIFIERS = {
  'my-source': async (query) => {
    const sources: VerificationSource[] = [];
    try {
      const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      // Parse and add sources
    } catch (e) { console.error('Error:', e); }
    return sources;
  },
};
```

## Data Storage

### Local Storage
- **Web version**: localStorage (browser-specific)
- **Desktop app**: localStorage (persists between sessions)

### Compressed Storage (Wikipedia Dumps)
- Stored in app data directory as `.json.lz4` or `.json.zst` chunks
- Manifest tracks chunk metadata for efficient retrieval
- Export entire compressed bundle for backup

To transfer data:
1. Export to JSON (or compressed bundle)
2. Copy file to target device
3. Import JSON on target device

## Privacy

- All AI processing uses local Ollama - no data sent to external AI services
- Verification uses public APIs (read-only)
- Document parsing happens locally via Python scripts
- Data stored locally on your machine
- Export files are unencrypted JSON - keep them secure

## Tech Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Build Tool**: Vite
- **Desktop**: Tauri 2.0 (Rust)
- **Compression**: LZ4 + Zstd (Rust crates)
- **AI**: Ollama (local LLM) with tool calling
- **Parsers**: Python (pdfplumber, python-docx, openpyxl, python-pptx, ebooklib, beautifulsoup4, Pillow, pydub)
- **Verification**: 20+ APIs (Wikipedia, WikiData, Lex.dk, Danish APIs)

## Project Structure

```
ai-wikipedia/
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx    # AI chat with tool calling
│   │   ├── GenerateModal.tsx    # Article generation (Unicode spinner)
│   │   ├── ArticleEditor.tsx    # Edit articles
│   │   ├── ImportModal.tsx      # Import from Wikipedia/scraper
│   │   └── VerifyModal.tsx      # Claim verification
│   ├── hooks/
│   │   └── useOllama.ts         # Chat API, tool execution
│   ├── utils/
│   │   ├── rag.ts               # RAG context builder
│   │   ├── verification.ts      # Source verification
│   │   └── generation.ts        # Article generation
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── constants/
│   │   └── index.ts             # SYSTEM_PROMPT, CHUNK_SIZE
│   ├── App.tsx                  # Main application
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind styles
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Rust commands (compression, parsing, scraping)
│   │   └── parsers/            # Python parser scripts
│   │       ├── document_parser.py   # PDF, Word, Excel, PPT, EPUB, HTML, MD, TXT
│   │       ├── code_parser.py       # Python, JS, TS, Java, C++, Rust, Go
│   │       ├── media_parser.py     # Images, Audio, Video
│   │       ├── zip_parser.py       # ZIP archives
│   │       └── legacy_doc_parser.py # Legacy .doc files
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json         # Tauri config
├── package.json                 # v1.4.0
├── CHANGELOG.md                 # Version history
├── CONTEXT.md                   # Project context
├── README.md                    # This file
└── launch_ai_wikipedia.sh       # Launch script
```

## Troubleshooting

### "Ollama not available"
```bash
# Start Ollama (GPU mode)
OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve

# Or CPU mode
CUDA_VISIBLE_DEVICES="" OLLAMA_NUM_PARALLEL=1 ollama serve

# Check if running
curl http://localhost:11434/api/tags

# List available models
ollama list
```

### Build fails on Tauri
```bash
# Update Rust
rustup update

# Clean and rebuild
cd src-tauri
cargo clean
cargo update
cargo check
```

### Compression not working
```bash
# Check Rust compiles
cd src-tauri
cargo check
```

### Parser scripts fail
```bash
# Test parser
python3 src-tauri/parsers/document_parser.py /path/to/file.pdf

# Check Python dependencies (Arch Linux)
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub

# Make scripts executable
chmod +x src-tauri/parsers/*.py
```

### TypeScript build errors
```bash
# Check for errors
cd $HOME/projects/Client/ai-wikipedia
npm run build

# Common fixes:
# - Check import paths (use ../ not ..)
# - Ensure all required fields in Tool definitions
# - Use 'number' not 'NodeJS.Timeout' for intervals
```

## License

MIT License - See LICENSE file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Latest: v1.5.0 (2026-05-07)
- ✅ Nightly article sync (background worker with Wikipedia News + Random)
- ✅ Sync UI (status bar, settings modal, chat status indicator)
- ✅ Tool calling support (scrape, parse, list articles)
- ✅ Document parser system (PDF, Word, Excel, PPT, EPUB, code, media, ZIP)
- ✅ Dynamic model detection
- ✅ Unicode spinner animation
- ✅ Clean build (no TypeScript or Rust warnings)
