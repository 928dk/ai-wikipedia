# Project Context

## Version
**Current:** v1.9.6 (2026-06-08)

## Motivation

This project was created to address several needs:

1. **Privacy-First AI** - Many AI tools send data to cloud services. This project keeps all AI processing local using Ollama.

2. **Verified Information** - AI-generated content can contain hallucinations. The verification system cross-checks claims against Wikipedia, WikiData, and Lex.dk.

3. **Portable Knowledge Base** - Users wanted a personal Wikipedia they could carry on USB drives, sync across devices, and use offline.

4. **Direct AI Interaction** - Sometimes users just want quick answers without creating full articles. The CLI chat interface provides direct access with tool calling.

5. **Document Processing** - Parse and analyze various file types (PDF, Word, Excel, PowerPoint, EPUB, code, media, ZIP, legacy docs) locally using AI.

6. **Educational Purpose** - Understanding how AI, verification, and local-first architecture work together.

## Design Decisions

### Local-First AI

**Why Ollama?**
- Runs entirely on local hardware
- No data leaves the machine
- Works offline once model is downloaded
- Supports multiple models (qwen2.5:3b, codellama:7b, llama3.2, mistral, phi3, etc.)
- Dynamic model detection - auto-detects available models

**Trade-off:** Requires user to have Ollama installed and running. This is intentional - it makes the privacy model explicit.

### Tool Calling Architecture

**Ollama `/api/chat` Endpoint**
- Supports function/tool calling (NOT `/api/generate`)
- Multi-turn conversations with tool_call → tool response loops
- Max 5 tool turns to prevent infinite loops
- Tools defined in `ChatInterface.tsx` TOOLS array

**Available Tools:**
- `scrape_webpage` - Scrape web content via Tauri `scrape_webpage` command
- `get_article_count` - Get knowledge base article count
- `list_articles` - List all saved article titles
- `parse_document` - Parse files (PDF, Word, Excel, PPT, EPUB, HTML, Markdown, Text, Code, Media, ZIP, Legacy Doc)

**Tool Execution Flow:**
1. User sends message
2. Ollama responds with `tool_calls[]`
3. Frontend calls `executeTool()` in `useOllama.ts`
4. Tauri invokes Rust command or Python parser script
5. Tool result sent back to Ollama as `tool` role message
6. Repeat until final response (max 5 turns)

### Parser System

**Python Parser Scripts** (in `src-tauri/parsers/`):
- `document_parser.py` - PDF (pdfplumber), Word (python-docx), Excel (openpyxl), PowerPoint (python-pptx), EPUB (ebooklib), HTML (beautifulsoup4), Markdown, Text
- `code_parser.py` - Python, JS, TS, Java, C++, Rust, Go (AST extraction)
- `media_parser.py` - Images (Pillow), Audio/Video (pydub)
- `zip_parser.py` - ZIP archives (extract and list contents)
- `legacy_doc_parser.py` - Legacy .doc files

**Tauri Integration:**
- `parse_document` command in `main.rs`
- Uses `std::process::Command` to call Python scripts
- Returns JSON: `{ 'text': str, 'metadata': dict, 'format': str, 'success': bool, 'error': str }`

### Verification Architecture

**Wikipedia API**
- Free, no API key required
- Massive corpus of human-verified content
- Good for factual claims and general knowledge

**WikiData SPARQL**
- Structured data format
- Good for facts with specific entities
- Enables precise entity matching

**Lex.dk (Den Store Danske)**
- Denmark's National Encyclopedia
- User's most trusted verification source
- High relevance scoring
- CC-BY-SA licensed content

**Limitation:** Verification shows correlation, not causation. High relevance doesn't guarantee truth - it shows the claim topic exists in the source.

### Data Storage

**localStorage**
- Works in browser without server
- Zero infrastructure needed
- Automatic persistence
- Easy to export/import as JSON

**Compressed Storage**
- LZ4/Zstd compression for large datasets
- Chunked storage for efficient access
- ~40% size reduction (LZ4) or ~35% (Zstd)
- Ideal for Wikipedia dumps

**Trade-off:** Browser-specific. Each browser has separate storage. Export/import solves cross-browser sync.

### Compression Strategy

**Why LZ4 + Zstd?**
- LZ4: Extremely fast, very low CPU impact
- Zstd: Better compression, still low CPU
- Both are well-established, no heavy dependencies

**Use Cases:**
- Small datasets: localStorage is fine
- Wikipedia dumps: Compressed chunks
- Export files: Can be compressed for transfer

### Tauri vs Electron

**Why Tauri?**
- Smaller bundle size (~3MB vs ~80MB)
- Rust backend = more memory efficient
- Native system integration
- Rust compression libraries available (lz4, zstd crates)
- Better for simple web apps wrapped as desktop apps

**Why not pure Electron?**
- Electron is heavier
- More memory overhead
- Overkill for this use case

## Current Implementation

### Frontend (React + TypeScript + Vite)

**Key Components:**
- `App.tsx` - Main app with article management, source configuration
- `ChatInterface.tsx` - AI chat with tool calling, RAG context, model selection
- `GenerateModal.tsx` - Article generation with Unicode spinner (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
- `ArticleEditor.tsx` - Edit existing articles
- `ImportModal.tsx` - Import from Wikipedia/scraper JSON
- `VerifyModal.tsx` - Claim verification UI

**Hooks:**
- `useOllama.ts` - Chat API, tool execution, model listing

**Utils:**
- `rag.ts` - Build RAG context from articles
- `verification.ts` - Wikipedia, WikiData, custom source verification
- `generation.ts` - Article generation with context

**Types:**
- `types/index.ts` - Article, VerificationSourceConfig, etc.

### Backend (Tauri + Rust)

**Commands in `main.rs`:**
- `compress_lz4` / `decompress_lz4` - LZ4 compression
- `compress_zstd` / `decompress_zstd` - Zstd compression
- `scrape_webpage` - Scrape web content (uses reqwest)
- `get_article_count` - Count articles in storage
- `list_articles` - List article titles
- `parse_document` - Parse files using Python scripts
- `get_sync_config` / `save_sync_config` - Sync configuration
- `get_sync_queue` / `clear_sync_queue` - Sync queue management
- `trigger_sync` - Manual sync trigger

**Nightly Sync Worker (v1.5.0):**
- Background worker started via `tauri::async_runtime::spawn()` in `setup()`
- Pipe A: Fetches Wikipedia "In the News" articles from `/feed/featured/` API
- Pipe B: Fetches random articles via `Special:Random` redirect
- Syncs every 24 hours (configurable)
- Writes to `sync_queue.json` in app data directory
- Emits `sync-queue-updated` Tauri event to frontend
- Two new config files: `sync_config.json`, `sync_queue.json`

**Dependencies (Cargo.toml):**
- `tauri` v2.0
- `lz4` - LZ4 compression
- `zstd` - Zstd compression
- `reqwest` - HTTP client for scraping
- `serde` - Serialization

### Python Parsers

**Location:** `src-tauri/parsers/`

**Dependencies (installed with `--break-system-packages`):**
- pdfplumber (PDF)
- python-docx (Word)
- openpyxl (Excel)
- python-pptx (PowerPoint)
- ebooklib (EPUB)
- beautifulsoup4 (HTML)
- Pillow (images)
- pydub (audio/video)

**Output Format:**
```json
{
  "text": "extracted text content",
  "metadata": { "filename": "...", "size": 1234, ... },
  "format": "pdf|docx|xlsx|...",
  "success": true,
  "error": ""
}
```

## User Stories

### Researcher
> "I want to explore topics and verify claims without sending my research to cloud services."

**Solution:** Generate articles with Ollama, verify with Wikipedia/WikiData/Lex.dk, all local. Parse documents for analysis.

### Student
> "I need an offline-capable knowledge base for studying."

**Solution:** Import Wikipedia articles, verify claims, export/import for sync, or use compressed storage. Parse lecture materials.

### Privacy Advocate
> "I don't trust cloud AI with my data."

**Solution:** 100% local AI processing, local data storage, no external services except public verification APIs.

### Knowledge Collector
> "I want to build a personal wiki that I control."

**Solution:** Generate, import, verify, compress, and export articles. Data never leaves user control. Parse various document types.

### Quick Question Asker
> "I just have a quick question - I don't want to create a full article."

**Solution:** AI CLI chat with tool calling (scrape web, parse docs, check knowledge base). Type and ask instantly.

### Developer
> "I want to analyze code files and extract structure."

**Solution:** Use `parse_document` with `parser_type: 'code'` to get AST, functions, classes, imports.

## Related Projects

- **Ollama** - Local LLM runtime: https://ollama.ai
- **Wikipedia API** - Free knowledge source: https://en.wikipedia.org/api/rest_v1/
- **WikiData** - Structured knowledge base: https://www.wikidata.org
- **Lex.dk / SNL** - Norwegian/Swedish encyclopedia API
- **Tauri** - Desktop app framework: https://tauri.app
- **LZ4** - Fast compression: https://lz4.github.io/lz4/
- **Zstd** - Better compression: https://facebook.github.io/zstd/
- **OpenViking** - Memory/RAG system (parser inspiration)

## File Structure

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
│   │   └── generation.ts       # Article generation
│   ├── types/
│   │   ├── index.ts             # TypeScript types
│   │   └── sync.ts              # SyncConfig, PendingArticle
│   ├── constants/
│   │   └── index.ts             # SYSTEM_PROMPT, CHUNK_SIZE
│   ├── App.tsx                  # Main application
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind styles
├── src-tauri/
│   ├── src/
│   │   └── main.rs              # Tauri commands (compression, parsing, scraping)
│   ├── parsers/                 # Python parser scripts
│   │   ├── document_parser.py   # PDF, Word, Excel, PPT, EPUB, HTML, MD, TXT
│   │   ├── code_parser.py       # Python, JS, TS, Java, C++, Rust, Go
│   │   ├── media_parser.py      # Images, Audio, Video
│   │   ├── zip_parser.py        # ZIP archives
│   │   └── legacy_doc_parser.py # Legacy .doc files
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json         # Tauri config
├── package.json                 # v1.4.0
├── CHANGELOG.md                 # Version history
├── CONTEXT.md                   # This file
├── README.md                    # User documentation
└── launch_ai_wikipedia.sh       # Launch script
```

## Future Considerations

### Potential Additions
- [x] Custom verification sources (custom APIs, databases)
- [x] Model selection UI (in chat interface)
- [x] Tool calling support (Ollama function calling)
- [x] Document parser system (Python scripts)
- [x] Unicode spinner animation
- [ ] Article editing (existing component, needs testing)
- [ ] Tagging and categories
- [ ] Full-text search
- [ ] Server sync mode
- [ ] Encrypted export
- [ ] Wikipedia dump importer
- [ ] Article-to-chat context switching
- [ ] Tree-sitter integration for better code parsing

### Not Planned
- Cloud AI integration (privacy is core)
- User accounts (local-first philosophy)
- Content moderation (user responsibility)
- Commercial hosting (source-available only)

## Build & Test

### Frontend
```bash
cd $HOME/projects/Client/ai-wikipedia
npm run build  # TypeScript + Vite (191KB JS bundle)
```

### Backend
```bash
cd $HOME/projects/Client/ai-wikipedia/src-tauri
cargo check  # Rust compilation check
```

### Launch
```bash
cd $HOME/projects/Client/ai-wikipedia
./launch_ai_wikipedia.sh
```

### Python Dependencies
```bash
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub
```

## Known Issues

1. **TOOLS Array Corruption** - Fixed in v1.4.0. Previously corrupted by duplicate arrays (`]; = [` syntax). Now properly closed with `];`.

2. **NodeJS Namespace** - TypeScript `NodeJS.Timeout` not available. Use `number` type for intervals.

3. **Ollama Model Availability** - App now auto-detects available models. Falls back to `qwen2.5:3b` (works on 4GB GPU).

4. **Python Externally-Managed** - Arch Linux requires `--break-system-packages` flag for pip installs.

5. **File Import in Browser Dev Mode** — "Import File" uses `FileReader.readAsText()` for text files (`.txt`, `.md`, `.html`). Binary files (`.pdf`, `.docx`, `.xlsx`, `.pptx`) show an error in browser mode — the desktop app (`npm run tauri`) is required for binary document parsing.

## Troubleshooting

### Build Errors
```bash
# TypeScript errors
cd $HOME/projects/Client/ai-wikipedia
npm run build  # Check for TS errors

# Rust errors
cd src-tauri
cargo check
```

### Ollama Not Available
```bash
# Start Ollama
OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve

# Check models
curl http://localhost:11434/api/tags
```

### Parser Script Failures
```bash
# Test parser
python3 src-tauri/parsers/document_parser.py /path/to/file.pdf

# Check Python dependencies
python3 -c "import pdfplumber, docx, openpyxl, pptx, ebooklib, bs4, PIL, pydub"
```
