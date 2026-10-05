# How This Was Built

This document traces the development process of the AI Wikipedia application (v1.4.0).

## Session Overview

**Initial Development:** 2026-03-18  
**Current Version:** v1.4.0 (2026-05-06)  
**Tech Stack:** React + TypeScript + TailwindCSS + Vite + Tauri 2.0 + Ollama + Python

## Initial Requirements

User requested:
1. AI Wikipedia application with local LLM
2. Alternative/additional sources for verification (not Grokipedia)
3. Make it "batteries included"
4. USB portable / syncable to server
5. Use Ollama for privacy
6. **Added later:** Tool calling support, document parsing, multi-source verification

## Design Decisions Made

### 1. Tauri vs Next.js

**Initial attempt:** Created Next.js app with API routes

**Problem encountered:**
- sql.js native module compilation issues (Bus error)
- Required server-side rendering complexity
- Heavy for USB portability

**Solution:** Switched to Tauri with React SPA
- Single executable possible (~3MB vs ~80MB Electron)
- Native file system access via Rust backend
- LZ4/Zstd compression via Rust crates

### 2. Data Storage

**Choice:** localStorage (browser) + JSON export/import + Compressed Storage

**Rationale:**
- Zero infrastructure
- Works offline
- Export to USB provides sync capability
- No server required
- LZ4/Zstd for large Wikipedia dumps (16GB → ~5-6GB)

**Alternative considered:** SQLite via Tauri
- Would require more complex setup
- Less portable
- Decided against for v1, but compression added in v1.1.0

### 3. Verification Sources

**Included (v1.0.0):**
- Wikipedia API (REST)
- WikiData SPARQL

**Expanded (v1.3.0+):**
- Lex.dk (Den Store Danske) - Denmark's National Encyclopedia
- 20+ Danish APIs (Danmarks Statistik, CVR.dk, Retsinformation, etc.)
- International sources (Eurostat, IMF, OECD, SEC EDGAR, EUR-Lex)

**Deferred:**
- DuckDuckGo (ddgs package has heavy dependencies)
- Fact-checking APIs (would require API keys)
- Custom sources (extensible architecture ready)

### 4. AI Architecture Evolution

**v1.0.0 - v1.2.0:** `/api/generate` (completion API)
- Single-shot article generation
- No conversation history

**v1.3.0:** Switched to `/api/chat` (chat API)
- Multi-turn conversations
- RAG (Retrieval Augmented Generation)
- Web Verify toggle

**v1.4.0:** Tool calling support
- Ollama function/tool calling
- Multi-turn tool loops (max 5 turns)
- Tools: scrape_webpage, get_article_count, list_articles, parse_document
- Tool execution via Tauri commands and Python scripts

### 5. Component Architecture

**Initial (v1.0.0):** Single-file `App.tsx` (~610 lines)
- All components in one file
- Simple but hard to maintain

**Current (v1.4.0):** Split components
```
src/
├── components/
│   ├── ChatInterface.tsx    # AI chat with tool calling
│   ├── GenerateModal.tsx    # Article generation (Unicode spinner)
│   ├── ArticleEditor.tsx    # Edit articles
│   ├── ImportModal.tsx      # Import from Wikipedia/scraper
│   └── VerifyModal.tsx      # Claim verification
├── hooks/
│   └── useOllama.ts         # Chat API, tool execution
├── utils/
│   ├── rag.ts               # RAG context builder
│   ├── verification.ts      # Source verification
│   └── generation.ts        # Article generation
├── types/
│   └── index.ts             # TypeScript types
└── constants/
    └── index.ts             # SYSTEM_PROMPT, CHUNK_SIZE
```

## Build Process

### Step 1: Project Initialization

```bash
# Created initial Next.js project (later abandoned)
npx create-next-app@latest ai-wikipedia

# Cleaned and started fresh with Vite + React
mkdir ai-wikipedia
cd ai-wikipedia
npm init -y
```

### Step 2: Core Files Created

1. **package.json** - Dependencies including:
   - React 18
   - Vite 5.4+
   - TailwindCSS 3.4+
   - Tauri packages 2.0

2. **Configuration files:**
   - tsconfig.json
   - vite.config.ts
   - tailwind.config.js
   - postcss.config.js

3. **Source files:**
   - src/main.tsx - Entry point
   - src/App.tsx - Main application (later split)
   - src/index.css - Styles
   - index.html - Template

### Step 3: Application Architecture

**v1.0.0 - Single-file React application (`App.tsx`):**

**State Management:**
```typescript
const [articles, setArticles] = useState<Article[]>([])
const [isDark, setIsDark] = useState(true)
const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
```

**Core Functions:**
- `generateWithOllama()` - AI generation (via `/api/generate`)
- `verifyClaim()` - Wikipedia + WikiData verification
- `importFromWikipedia()` - Import articles
- `loadArticles()` / `saveArticles()` - localStorage persistence

**v1.4.0 - Split architecture:**
- Components separated into individual files
- Custom hooks (`useOllama.ts`)
- Utility functions separated (`rag.ts`, `verification.ts`, `generation.ts`)
- Types and constants in dedicated directories

### Step 4: Tauri Integration

**Files created:**
- src-tauri/Cargo.toml
- src-tauri/src/main.rs
- src-tauri/tauri.conf.json

**Rust commands added (v1.1.0 - v1.4.0):**
- `compress_lz4` / `decompress_lz4` - LZ4 compression
- `compress_zstd` / `decompress_zstd` - Zstd compression
- `scrape_webpage` - Web scraping (uses reqwest)
- `get_article_count` - Count articles
- `list_articles` - List article titles
- `parse_document` - Parse files via Python scripts (v1.4.0)

**Configuration highlights:**
```json
{
  "bundle": {
    "targets": ["deb", "rpm", "appimage"]
  }
}
```

### Step 5: Document Parser System (v1.4.0)

**Python parser scripts created in `src-tauri/parsers/`:**
- `document_parser.py` - PDF (pdfplumber), Word (python-docx), Excel (openpyxl), PowerPoint (python-pptx), EPUB (ebooklib), HTML (beautifulsoup4), Markdown, Text
- `code_parser.py` - Python, JS, TS, Java, C++, Rust, Go (AST extraction)
- `media_parser.py` - Images (Pillow), Audio/Video (pydub)
- `zip_parser.py` - ZIP archives (extract and list)
- `legacy_doc_parser.py` - Legacy .doc files

**Python dependencies installed:**
```bash
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub
```

**Tauri integration:**
- `parse_document` command uses `std::process::Command` to call Python scripts
- Returns JSON: `{"text": "", "metadata": {}, "format": "", "success": true, "error": ""}`

## Iterative Improvements

### Issue: TypeScript Errors

**Problem:** Strict mode errors
```
error TS6133: 'useCallback' is declared but its value is never read.
error TS2307: Cannot find module '../types'.
```

**Solution:** 
- Removed unused imports and parameters
- Fixed import paths (`..types` → `../types`, `..utils/` → `../utils/`)
- Same-directory imports use `./` instead of `../`

### Issue: Tauri Build Timeout

**Problem:** First cargo check took >5 minutes

**Solution:** Ran in background, continued documentation

### Issue: TOOLS Array Corruption (v1.4.0)

**Problem:** ChatInterface.tsx had corrupted TOOLS array
```
Line 58: ]; = [
```
Duplicated TOOLS arrays from failed edit attempts.

**Solution:**
- Removed duplicate array definitions
- Properly closed array with `];` (not `]; = [`)
- Verified with `npm run build`

### Issue: NodeJS.Timeout TypeScript Error (v1.4.0)

**Problem:**
```
src/components/GenerateModal.tsx(29,19): error TS2503: Cannot find namespace 'NodeJS'.
```

**Solution:** Use `number` type for intervals instead of `NodeJS.Timeout`

### Issue: Ollama Model Availability (v1.4.0)

**Problem:** Default model `llama3.2` not available on 4GB GPU

**Solution:**
- Dynamic model detection in `useOllama.ts` `listModels()`
- Default to `qwen2.5:3b` (works on 4GB VRAM)
- Fallback chain: `opencode/big-pickle` → gemini-3-pro → gemini-3-flash → gemini-2.5-flash → qwen-32b → llama3.1-8b → qwen2.5:3b → llama3.2:3b

## File Structure (Current)

```
ai-wikipedia/
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx    # ~326 lines (chat + tool calling)
│   │   ├── GenerateModal.tsx    # ~102 lines (Unicode spinner)
│   │   ├── ArticleEditor.tsx    # ~200 lines
│   │   ├── ImportModal.tsx      # ~150 lines
│   │   └── VerifyModal.tsx      # ~180 lines
│   ├── hooks/
│   │   └── useOllama.ts         # ~155 lines (chat API + tools)
│   ├── utils/
│   │   ├── rag.ts               # ~80 lines
│   │   ├── verification.ts      # ~300 lines (20+ sources)
│   │   └── generation.ts        # ~100 lines
│   ├── types/
│   │   └── index.ts             # ~50 lines
│   ├── constants/
│   │   └── index.ts             # ~30 lines (SYSTEM_PROMPT)
│   ├── App.tsx                  # ~400 lines (main app)
│   ├── main.tsx                 # ~10 lines (entry)
│   └── index.css                # ~21 lines (styles)
├── src-tauri/
│   ├── src/
│   │   └── main.rs              # ~319 lines (Rust commands)
│   ├── parsers/                 # Python parser scripts
│   │   ├── document_parser.py   # ~13KB
│   │   ├── code_parser.py       # ~6KB
│   │   ├── media_parser.py      # ~5KB
│   │   ├── zip_parser.py        # ~3KB
│   │   └── legacy_doc_parser.py # ~3KB
│   ├── Cargo.toml               # ~33 lines (Rust deps)
│   └── tauri.conf.json         # ~22 lines
├── package.json                 # v1.4.0
├── CHANGELOG.md                 # Version history
├── CONTEXT.md                   # Project context
├── README.md                    # User documentation
└── launch_ai_wikipedia.sh       # Launch script
```

## Commands Used

### Development:
```bash
# Install dependencies
npm install

# Run development server (Vite)
npm run dev

# Build for production
npm run build

# TypeScript check only
npx tsc --noEmit
```

### Tauri:
```bash
# Run Tauri dev mode
npm run tauri dev

# Build Tauri app
npm run tauri build

# Check Rust compilation
cd src-tauri && cargo check

# Run Rust tests
cd src-tauri && cargo test
```

### Python Parsers:
```bash
# Install dependencies (Arch Linux)
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub

# Test parser
python3 src-tauri/parsers/document_parser.py /path/to/file.pdf

# Make scripts executable
chmod +x src-tauri/parsers/*.py
```

### Launch Script:
```bash
# Launch app (starts Ollama + Tauri dev)
./launch_ai_wikipedia.sh
```

## External Services Used

### 1. Wikipedia API (no auth required)
- OpenSearch: `https://en.wikipedia.org/w/api.php?action=opensearch`
- Query: `https://en.wikipedia.org/w/api.php?action=query&prop=extracts`

### 2. WikiData SPARQL (no auth required)
- Endpoint: `https://query.wikidata.org/sparql`

### 3. Lex.dk (Den Store Danske)
- Denmark's National Encyclopedia
- CC-BY-SA licensed content

### 4. Ollama (local)
- Endpoint: `http://localhost:11434/api/chat` (v1.3.0+)
- Previously: `/api/generate` (v1.0.0 - v1.2.0)
- Default model: `qwen2.5:3b` (v1.4.0)
- Previously: `llama3.2:1b` (v1.0.0 - v1.3.0)

### 5. 20+ Danish & International APIs
- Danmarks Statistik, CVR.dk, Retsinformation, Nationalbanken, etc.
- Eurostat, IMF, OECD, SEC EDGAR, EUR-Lex, etc.

## Environment Requirements

### Runtime:
- Node.js 18+
- Ollama installed and running
- Python 3.x with parser dependencies
- Models pulled: `ollama pull qwen2.5:3b`

### Build:
- Rust toolchain
- Tauri CLI
- npm/yarn

### GPU (optional):
- NVIDIA GPU with 4GB+ VRAM for local models
- GTX 960M works with `qwen2.5:3b` (~3.5GB VRAM)

## Key Design Patterns

### 1. Component Split Architecture
Separate components for maintainability and testing.

### 2. Tool Calling Architecture
```
User Message → Ollama (/api/chat) → tool_calls[]
→ executeTool() → Tauri command / Python script
→ tool response → Ollama (follow-up)
→ Repeat (max 5 turns) → Final response
```

### 3. RAG (Retrieval Augmented Generation)
```
User Query → TF-IDF similarity search → Top 3 articles
→ Build context string → Inject into prompt
→ Ollama generates with context
```

### 4. Verification Pipeline
```
Claim → Multiple sources (Wikipedia, WikiData, Lex.dk, APIs)
→ Relevance scoring → Status (✓ Verified, ? Disputed, − Unverified)
→ Minimum 2 sources required
```

### 5. Client-Side Only (Web Version)
No server-side code, all processing in browser.

### 6. Local-First (Desktop Version)
Tauri backend for system access, but no cloud dependencies except public APIs.

## Debugging Notes

### Problem: Next.js Bus Error
**Cause:** sql.js native module compilation failure
**Solution:** Abandoned Next.js, used Vite + React instead

### Problem: Ollama Connection
**Test command:**
```bash
curl http://localhost:11434/api/tags
```
**Expected:** JSON with available models

### Problem: TOOLS Array Corruption
**Cause:** Multiple edit attempts created duplicate arrays
**Solution:** Removed duplicates, verified with `npm run build`

### Problem: Python Externally-Managed (Arch Linux)
**Cause:** Arch's PEP 668 compliance
**Solution:** Use `--break-system-packages` flag (acceptable for local tools)

## Testing Checklist

- [x] Ollama running at localhost:11434
- [x] Model available: qwen2.5:3b
- [x] Generate article works
- [x] Verify claims returns results
- [x] Import Wikipedia article works
- [x] Export creates valid JSON
- [x] Import merges articles correctly
- [x] Dark mode toggles
- [x] Articles persist after refresh
- [x] Tool calling works (scrape, parse, list)
- [x] Document parsers execute successfully
- [x] Unicode spinner animates
- [x] Build passes (npm run build)
- [x] Rust compiles (cargo check)

## Performance Considerations

- **Bundle size:** ~191KB JS + ~20KB CSS (production build, gzipped)
- **Tauri binary:** ~3-5MB (vs 80MB Electron)
- **Verification:** Parallel fetch to multiple sources
- **localStorage:** Synchronous but fast for small datasets
- **Compressed Storage:** LZ4 ~40% reduction, Zstd ~35% reduction
- **Parser Scripts:** ~5-13KB each, fast execution

## Future Build Steps

1. **Tree-sitter Integration** - Better code parsing (AST extraction)
2. **Article Editing Enhancements** - Test and improve existing component
3. **Tagging and Categories** - Organize articles
4. **Full-text Search** - Search within article content
5. **Server Sync Mode** - Optional cloud sync
6. **Encrypted Export** - Secure export for sensitive data
7. **Wikipedia Dump Importer** - Bulk import from official dumps
8. **Article-to-Chat Context Switching** - Use any article as chat context

## Lessons Learned

1. **Native modules complicate portability** - JavaScript-only solutions are more portable
2. **Component splitting improves maintainability** - Easier to test and modify
3. **Tauri is lightweight** - Fast builds, small binaries
4. **Verification is approximate** - Correlation ≠ causation
5. **Export/import solves sync** - No server needed for basic sync
6. **Dynamic model detection is crucial** - Users have different hardware
7. **Tool calling enables powerful workflows** - AI can now scrape, parse, and analyze
8. **Python scripts work well for parsing** - Leveraged existing libraries (pdfplumber, etc.)
9. **Unicode spinners improve UX** - Smooth animations (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) without heavy libraries
10. **TOOLS array syntax is fragile** - Always verify with `npm run build` after editing

## Commands Reference

```bash
# Full build
npm install && npm run build && cd src-tauri && cargo check

# Development with hot reload
npm run tauri dev

# Check TypeScript
npx tsc --noEmit

# Lint
npm run lint

# Clean build
rm -rf node_modules dist src-tauri/target
npm install && npm run build

# Launch with Ollama (GPU mode)
OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve
./launch_ai_wikipedia.sh

# Launch with Ollama (CPU mode)
CUDA_VISIBLE_DEVICES="" OLLAMA_NUM_PARALLEL=1 ollama serve
./launch_ai_wikipedia.sh
```

## Version History Summary

- **v1.0.0 (2026-03-18):** Core features, Tauri integration, verification
- **v1.1.0 (2026-03-18):** Compression system (LZ4/Zstd), AI chat interface
- **v1.2.0 (2026-03-18):** Article images, advanced scraper
- **v1.3.0 (2026-03-18):** RAG support, web verify mode, article editor
- **v1.3.1 (2026-03-19):** Scraper GUI fixes, deep crawling
- **v1.4.0 (2026-05-06):** Tool calling, document parsers, dynamic model detection, Unicode spinner

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
