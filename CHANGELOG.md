# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Wikipedia 429 rate limiting (scraper)** — `scraper_package/wikipedia.py` now throttles between API calls and retries transient failures (`429`, `500`, `502`, `503`, `504`) with exponential backoff, honoring the `Retry-After` header when present. A descriptive `User-Agent` is sent with every request. Previously a burst of ~2 rapid requests triggered 429s for the entire batch.
- **Dead Lex.dk endpoint (scraper)** — The Lex.dk search path hit `api.snl.no` (Norwegian SNL API, now NXDOMAIN). `scraper_package/core.py` and `scraper_package/advanced.py` now catch the `URLError` and print a clear message: "Lex.dk: search API unreachable (api.snl.no no longer resolves). Lex.dk search is currently unavailable." instead of a raw DNS traceback.
- **IPv6 connect stall (scraper)** — `getaddrinfo` listed IPv6 first on this machine (no routable IPv6), so every urllib request stalled ~30s before falling back to IPv4. `force_ipv4()` in `scraper_package/core.py` now sorts resolution IPv4-first, applied at `ScraperCore` init so all entry points (CLI, GUI) benefit.
- **GUI import RuntimeWarning (scraper)** — `scraper_package/__init__.py` no longer eagerly imports `.gui`; `ScraperGUI` is now resolved lazily via a module-level `__getattr__`, removing the partial-import `RuntimeWarning` when launching with `python3 -m scraper_package.gui`.

### Added
- **Test suite** — `tests/test_scraper_fixes.py` (with `tests/__init__.py`) covering 429 retry/backoff, IPv4-first ordering + idempotence, lazy GUI import (no tkinter on package import), and Lex.dk clear-message reporting.

## [1.9.6] - 2026-06-08

### Fixed
- **`C:\fakepath\` file import bug** — "Import File" in CLI chat used `<input>.value` which always returns a browser-faked path. Replaced with Tauri `open()` dialog (`@tauri-apps/plugin-dialog`) to get the real OS file path. Browser dev mode falls back to `FileReader.readAsText()` for text files with an error for binary files.

### Changed
- **Version bumped** — 1.9.5 → 1.9.6
- Spec folder `.opencode/specs/015-file-import-path-fix/` created for tracking.

## [1.9.5] - 2026-06-06

### Added
- **AI Enhance Article** — New "Enhance with AI" button in ArticleView sends the current article to Ollama for expansion. Adds detail, examples, and practical advice while preserving all existing content. Handles all article types and languages.

### Changed
- **Version bumped** — 1.9.4 → 1.9.5
- Spec folder `.opencode/specs/014-ai-enhance-article/` created for tracking.

## [1.9.4] - 2026-06-06

### Added
- **Import from file** — New third tab in ImportModal supporting JSON, .txt, and .md file imports. Choose Article or Book type, Book mode supports single chapter or split-by-headings. JSON files can contain multiple articles. Wired to `handleFileImport` in App.tsx with dedup by title.

### Changed
- **Version bumped** — 1.9.3 → 1.9.4
- Spec folder `.opencode/specs/013-import-from-file/` created for tracking.

## [1.9.3] - 2026-06-06

### Added
- **Map view** — "Graph" renamed to "Map" (force-directed knowledge visualization)
- **Refresh from WikiBooks** — New button in ArticleView for wikibook articles, re-fetches full content from WikiBooks and overwrites existing book
- **Storage modal metrics** — Article type/language breakdown, content statistics (avg/longest/shortest), verification status, health issues table, weekly creation timeline chart

### Fixed
- **Update All skips wikibooks** — No longer replaces book content with Wikipedia article extracts
- **WikiBooks chapter content** — Switched from `prop=extracts` (capped at 1 extract per batch) to `prop=revisions&rvprop=content` with wikitext stripper; also fixed `aplimit`→`gaplimit` for full subpage discovery in 1-2 API calls instead of dozens

## [1.9.2] - 2026-06-05

### Fixed
- **ArticleView crash (P0)** — Added `key={selectedArticle.id}` prop to prevent `activeChapter` out-of-bounds crash when switching between wikibooks with different chapter counts.
- **storage.ts crash (P0)** — Added try-catch on `loadArticles` (corrupted localStorage) and `saveArticles` (quota exceeded). Added schema versioning for future migration.
- **Data loss in async operations (P0)** — `handleGenerate`, `handleGenerateBook`, and `handleInboxSummarize` now use functional `setArticles(prev => ...)` to prevent stale closure issues when multiple operations modify articles concurrently.
- **Data loss in Update All (P0)** — Added `updatingRef` cancellation guard to `handleUpdateAllArticles` to prevent overwriting user edits made during the async update loop.
- **No stop button during book generation (P0)** — GenerateBookModal now has a "Stop" button during chapter generation that properly aborts the loop and shows cancellation status.
- **GenerateBookModal issues (P1)** — Enter key guarded with `generatingToc` check to prevent double-trigger; `setGeneratingChapters` moved before `onClose` to avoid React unmounted warning; empty chapter content validated; error messages now include actual error details.
- **handleDeleteArticle no-op write (P1)** — Added existence check before filtering to avoid unnecessary re-render and localStorage write.
- **importExport.ts fetch safety (P1)** — Added `response.ok` checks on all 4 Wikipedia/WikiBooks fetch call sites. Added domain fallback for unknown language keys.
- **Accessibility (P2)** — Added `htmlFor`/`id` association on model label and select in GenerateBookModal.
- **Minor (P2)** — `updateChapter` uses functional updater; `validChapters` memoized; `clearInterval` guarded against `undefined` in ArticleList; `JSON.parse(article.citations)` safely caught in ArticleView; progress bar shows completed fraction; error clears on user input.

### Changed
- **Version bumped** — 1.9.1 → 1.9.2
- Spec folder `.opencode/specs/010-stability-fixes/` created for tracking.
- **CONTEXT.md** — Updated version from v1.7.4 to v1.9.2.
- **SPEC.md** — Updated Current Scope, SyncConfig interface, and Discrepancies table for v1.8.0–1.9.2 features.

## [1.9.1] - 2026-06-05

### Added
- **Update All Articles** — New "Update All" button re-fetches every article from Wikipedia across multiple languages. Tries `selectedLanguage` first, then falls back to other languages. Shows progress with spinner animation, skips unchanged content.

### Changed
- **Version bumped** — 1.9.0 → 1.9.1
- Spec folder `.opencode/specs/009-update-all-articles/` created for tracking.

## [1.9.0] - 2026-06-05

### Added
- **AI Book Generation** — Generate multi-chapter books from a single topic prompt. AI creates a table of contents (5-8 chapters), then generates each chapter sequentially. Saved as a wikibook-type article with full chapter sidebar navigation.
- **GenerateBookModal** — New modal with topic input, model selection, editable table of contents, sequential chapter generation with progress tracking.
- **`generateTableOfContents()`** — New utility function that asks Ollama to produce chapter titles as a JSON array for any given topic.

### Changed
- **Version bumped** — 1.8.0 → 1.9.0
- Spec folder `.opencode/specs/008-ai-book-generation/` created for tracking.

## [1.8.0] - 2026-06-05

### Added
- **Lex.dk Nightly Sync Pipe** — New `lex_enabled` toggle in sync config. Background sync now searches 3 random Danish keywords from a pool of 14 (historie, natur, kultur, etc.) against `api.snl.no/1.1/search?zone=lex`, collecting up to 5 titles per keyword. Queued with source tag `"lex"`.
- **WikiBooks Nightly Sync Pipe** — New `wikibooks_enabled` toggle. Background sync fetches 3 random WikiBooks titles via `en.wikibooks.org/w/api.php?list=random`. Queued with source tag `"wikibooks"`.
- **Source-aware auto-import** — Frontend auto-import loop branches on `item.source`: Wikipedia items use `fetch_wikipedia_articles`, Lex.dk items use `importFromLexDk`, WikiBooks items use `importFromWikiBooks`.
- **Source badges in QueueReviewModal** — Each queued article now shows its source: 📰 News, 🎲 Random, 📖 Lex.dk, 📘 WikiBooks.

### Changed
- **Version bumped** — 1.7.4 → 1.8.0
- **SyncConfig type** — Added `lex_enabled: boolean`, `wikibooks_enabled: boolean`
- Spec folder `.opencode/specs/007-multi-source-nightly-sync/` created for tracking.

## [1.7.4] - 2026-06-01

### Fixed
- **Sync random article cap removed** — `trigger_sync` no longer caps random articles at `max_articles_per_sync.min(5)`. Now uses full `max_articles_per_sync` value directly (up from max 5 random per sync).

- **Sync queue deduplication** — `add_to_queue` now skips titles already in the queue (case-insensitive), preventing duplicate entries across repeated syncs.

- **Auto-import batch size increased** — Frontend auto-import now processes 25 articles per poll cycle (up from 10), reducing the gap between sync and visible articles.

- **Queue review article preview** — QueueReviewModal now has a split-pane layout. Click any queued article to fetch and preview its Wikipedia content inline before deciding whether to import it.

### Changed
- **Version bumped** — 1.7.3 → 1.7.4

## [1.7.3] - 2026-05-30

### Fixed
- **Sync queue batch processing** — Frontend auto-import now processes max 10 articles per 30s poll cycle instead of attempting all pending articles at once. A single failed API call no longer blocks the entire queue. Added `update_sync_queue` Tauri command for incremental queue draining.

### Changed
- **Version bumped** — 1.7.2 → 1.7.3
- Spec folder `.opencode/specs/006-sync-queue-batching/` created for tracking.

## [1.7.2] - 2026-05-28

### Fixed
- **Chat import tools now save articles to knowledge base** — `import_article`, `import_from_wikibooks`, `import_from_lex`, and `import_from_snl` tools called via ChatInterface now persist imported content via `saveArticles()` instead of only returning a summary string to the AI. Previously the AI could describe imported content but it wouldn't appear in the article list or be searchable. Fix: `executeTool()` in `useOllama.ts` accepts an `onSaveArticle` callback that fires on successful import.

### Changed
- **Version bumped** — 1.7.1 → 1.7.2
- Spec folder `.opencode/specs/005-chat-import-save/` created for tracking.

## [1.7.1] - 2026-05-28

### Fixed
- **Wikibooks chapter content** — `importFromWikiBooks()` now properly fetches all chapter content instead of only the first chapter. Two-phase fix: paginate all subpage titles via `allpages` generator with `gapcontinue`, then batch-fetch each chapter's content via individual `titles=` queries.
- **Missing chapters** — Previously only the first 10 subpages were fetched; now all subpages are collected via API pagination before content retrieval.

### Changed
- **Version bumped** — 1.7.0 → 1.7.1
- **Refactored `importFromWikiBooks()`** — Extracted chapter+content fetching into `fetchWikiBookChapters()` helper function for clarity.
- Spec folder `.opencode/specs/004-wikibooks-pagination/` created for tracking.

## [1.7.0] - 2026-05-27

### Added

#### Structured Source Imports (Lex.dk, SNL, WikiBooks AI Tools)
- **`import_from_wikibooks` tool** - AI can now import books from WikiBooks with chapter structure (previously only available via ImportModal)
- **`import_from_lex` tool** - AI can import articles from Lex.dk (Den Store Danske, Danish-language encyclopedia)
- **`import_from_snl` tool** - AI can import articles from Store Norske Leksikon (Norwegian-language encyclopedia)
- **`importFromLexDk()`** - New function in `importExport.ts` using `api.snl.no/1.1/search?zone=lex` API with HTML stripping and license verification
- **`importFromSNL()`** - New function in `importExport.ts` using `api.snl.no/1.1/search?zone=snl` API with HTML stripping and license verification
- **SYSTEM_PROMPT guidance** - AI instructed to use source-specific imports: Danish topics → Lex.dk, Norwegian topics → SNL, educational books → WikiBooks

### Changed
- **Version bumped** - 1.6.1 → 1.7.0

### Technical
- Shared `importFromSNLShared()` helper for Lex.dk/SNL (same API, different zone param)
- HTML stripping via `DOMParser` (browser-native, no dependencies)
- License verification — articles with `license_name !== 'fri'` (CC-BY-SA-3.0) are skipped
- All 3 tools use dynamic `import()` pattern matching existing `import_article` handler
- Spec folder `.opencode/specs/003-structured-sources/` created for tracking

## [1.6.1] - 2026-05-27

### Added

#### AI Reasoning for Article Imports
- **`import_article` tool** - New tool in ChatInterface TOOLS array: the AI can now call `import_article("Topic")` to fetch Wikipedia articles on demand
- **executeTool handler** - `useOllama.ts` now handles `import_article` by calling `importFromWikipedia()` and returning formatted results to the AI
- **SYSTEM_PROMPT guidance** - AI instructed to use `import_article` proactively when users ask about topics not in the knowledge base, rather than saying "I don't know"

### Changed
- **Version bumped** - 1.6.0 → 1.6.1

### Technical
- Dynamic `import()` used for `importFromWikipedia` inside `executeTool` to avoid compile-time dependency issues
- Tool result includes title, character count, summary, and citation for AI to relay to user

## [1.6.0] - 2026-05-27

### Added

#### WikiBooks Import
- **WikiBooks API integration** - Import books from `en.wikibooks.org` with hierarchical chapter structure
- **Chapter discovery** - Uses `generator=allpages` with `gapprefix=TITLE/` to find all subpages (chapters)
- **Fallback to single-page** - If no subpages found, treats main book page as single chapter
- **`importFromWikiBooks(title)`** - New function in `importExport.ts` returns `Article | null` with chapters
- **New types** - `WikiBookChapter` interface, `ArticleType` discriminator (`'article' | 'wikibook'`)

#### Chapter Sidebar Navigation
- **ArticleView chapter sidebar** - Sticky scrollable chapter list when `article.type === 'wikibook'`
- **Active chapter highlighting** - Blue highlight on selected chapter, instant swap via `useState(0)`
- **Chapter title heading** - Shows selected chapter title above content

#### UI Indicators
- **📘 Book icon** - Displayed next to wikibook titles in both card and list views
- **"(Book)" tag** - Yellow badge on wikibooks for quick identification

#### ImportModal Tab Toggle
- **Wikipedia tab** - Existing multi-title textarea (unchanged)
- **WikiBooks tab** - Single text input for book title import
- **`onWikiBooksImport` prop** - Optional callback for book import flow

### Changed
- **Version bumped** - 1.5.0 → 1.6.0
- **Article type** - Optional `type?: ArticleType` discriminator on `Article` interface
- **ImportModal** - Now accepts `onWikiBooksImport?: (title: string) => Promise<void>` prop

### Technical
- **New Types** - `src/types/index.ts`: `WikiBookChapter`, `ArticleType`, `Article.chapters`, `Article.book_author`, `Article.type`
- **Import logic** - `src/utils/importExport.ts`: `importFromWikiBooks()` added (97 lines total in file)
- **No breaking changes** - Optional fields on `Article` persist automatically via localStorage JSON serialization

## [1.5.0] - 2026-05-07

### Added

#### Nightly Article Sync (Background Worker)
- **Pipe A: News/Featured** - Fetches Wikipedia "In the News" articles via `/feed/featured/YYYY/MM/DD` API
- **Pipe B: Random Discovery** - Fetches random Wikipedia articles via `Special:Random` (max 5 per cycle)
- **24-Hour Background Worker** - `tokio::spawn` in Tauri `setup()` runs nightly sync indefinitely
- **Sync Queue** - Articles stored in `sync_queue.json` in app data directory
- **Sync Config** - Persistent config in `sync_config.json` (enabled, interval, pipe toggles, max articles)
- **Tauri Events** - `sync-queue-updated` emitted to frontend with queue count
- **Tauri Commands** - `get_sync_config`, `save_sync_config`, `get_sync_queue`, `clear_sync_queue`, `trigger_sync`

#### Sync UI
- **SyncSettingsModal** - Configure pipes, interval, max articles; trigger manual sync
- **Sync Status Bar** - ArticleList shows enabled/disabled, last sync, queue count
- **Sync Status in Chat** - ChatInterface welcome shows "X articles synced" message
- **Real-time Updates** - Frontend listens for `sync-queue-updated` event via `@tauri-apps/api/event`

#### Changed
- **Timer interval** - Uses `chrono` formatting (`.format("%Y")`) for date-based Wikipedia API URLs
- **Event emission** - Uses Tauri v2 `Emitter` trait (`app.emit()`) instead of deprecated `emit_all`
- **Rust dependencies** - Added `chrono = "0.4"`, tokio features `"time"`, `"macros"`

### Technical
- **New Types** - `src/types/sync.ts`: `SyncConfig`, `PendingArticle` interfaces
- **Sync Code Location** - `src-tauri/src/main.rs`: Full sync logic (~220 lines of sync-specific code)
- **Data Flow** - Background worker → queue file → Tauri event → frontend listener
- **Install deps** - `chrono = "0.4"` added; no Python changes required

## [1.4.0] - 2026-05-06

### Added

#### Tool Calling Support
- **Ollama Tool/Function Calling** - Chat now supports tool calls via `/api/chat` endpoint
- **Dynamic Model Detection** - Auto-detects available Ollama models, defaults to `qwen2.5:3b`
- **Scrape Webpage Tool** - AI can now scrape web content via `scrape_webpage` Tauri command
- **Get Article Count Tool** - AI can check knowledge base size via `get_article_count`
- **List Articles Tool** - AI can list saved articles via `list_articles`
- **Multi-turn Tool Loop** - Chat processes multiple tool calls in sequence (max 5 turns)
- **Tool Usage Display** - Chat shows tool calls (🔧) and results in real-time

#### Improved
- **Model Selection** - Dropdown shows only available models from Ollama
- **Import Paths Fixed** - Corrected `..types` → `../types`, `..utils/` → `../utils/` 
- **Component Imports Fixed** - Same-directory imports now use `./` instead of `../`
- **React Hook Imports** - Only import hooks actually used (removes unused import warnings)
- **Default Model** - Changed from `llama3.2` (unavailable) to `qwen2.5:3b`

#### Fixed
- **TypeScript Errors** - Fixed TS6133 (unused imports), TS2307 (module not found)
- **Missing CHUNK_SIZE** - Added export to `constants/index.ts`
- **Ollama 404 Errors** - App now detects available models before making requests
- **Build Warnings** - Clean build with no TypeScript or Rust warnings

### Changed

#### Architecture
- **Chat API** - Switched from `/api/generate` (completion) to `/api/chat` (chat with tools)
- **useOllama Hook** - Rewritten to support `ChatMessage` with `tool_calls`, `tool_call_id`
- **Tauri Backend** - Added `reqwest`, `regex` dependencies for web scraping
- **ChatInterface** - Now processes tool calls in a loop with follow-up requests

#### Dependencies
- **Rust** - Added `reqwest = "0.11"`, `regex = "1"` for tool execution
- **Frontend** - Updated TypeScript types for Ollama tool calling

## [1.3.1] - 2026-03-19

### Fixed

#### Scraper GUI
- **Tkinter PhotoImage error** - Removed invalid `pasteboard_remove()` call
- **Sub-page Selenium** - Added checkbox to enable JS rendering for article links
- **URL Pattern Detection** - Now detects Politiken `/p/` pattern and other article formats

### Added

#### Deep Crawling
- **"Use JavaScript for sub-pages" checkbox** - Enabled by default
- **Article URL patterns** - Recognizes `/p/`, `/article/`, `/news/`, `/story/`
- **Skip patterns** - Ignores login, subscribe, category, author links
- **Content quality check** - Skips pages with < 100 chars content

### Changed

#### Scraper GUI UI
- **Source Type** - Radiobuttons replaced with dropdown combobox
- **Cookie Policy** - Radiobuttons replaced with dropdown combobox
- **Layout** - Reorganized with separators between sections

## [1.3.0] - 2026-03-18

### Added

#### RAG (Retrieval Augmented Generation)
- **Local Knowledge Base Search** - AI searches imported articles before answering
- **TF-IDF Similarity Matching** - Finds relevant content using token overlap
- **Context Injection** - Top 3 relevant articles included in AI prompts

#### Web Verify Mode
- **Toggle in CLI Chat** - Enable/disable real-time verification
- **Pre-answer Verification** - Sources fetched before AI generates response
- **Source Display** - Verified sources shown with excerpts and URLs

#### Source Citing
- **Strict Citation Requirements** - AI instructed to cite `[Source: Name]` format
- **Minimum 2 Sources** - Verification requires at least 2 sources
- **Medical Caution** - Extra warnings for health-related queries
- **Generated Articles** - Include Sources section at the bottom

#### Article Editor
- **Edit Button** - Open any article and click "Edit Article"
- **Edit Modal** - Full editor with title, summary, and content fields
- **Save Changes** - Updates article with new timestamp

### Changed

#### Default Model
- **llama3.2 (8B)** is now the default model
- 1B model marked with ⚠️ warning badge
- Better factual accuracy for medical/technical topics

#### Title Updated
- Changed from "AI Wikipedia - Powered by Ollama & Wikipedia"
- To "AI Wikipedia - Powered by Ollama & Multi Source Verification"

#### Import Button Renamed
- "Import Wikipedia" → "Import Article"

## [1.2.0] - 2026-03-18

### Added

#### Article Images
- **Image Support** - Articles can now contain images
- **Image Display** - ArticleView shows images in a grid (up to 4)
- **Caption Support** - Images display with captions when available

#### Advanced Scraper
- **Multi-Source Scraping** - Wikipedia, Lex.dk, any website
- **Image Extraction** - Captures article images with captions
- **Website Crawling** - Configurable depth with page limits
- **Unicode URL Support** - Handles non-ASCII URLs properly
- **Multiple Fetch Methods** - Direct, curl, or Selenium fallback

#### New CLI Options
- `--max-pages` - Limit pages crawled
- `--selenium` - Use headless browser for JS sites
- `--verbose` - Detailed output

### Changed

#### AI Chat Interface
- **Always Visible** - CLI chat now always visible under search bar
- **Vite Proxy** - Ollama requests routed through dev server proxy for CORS

## [1.1.0] - 2026-03-18

### Added

#### Compression System
- **LZ4 Compression** - Fast, low-CPU compression for Wikipedia storage (~40% size)
- **Zstd Compression** - Better compression ratio (~35% size) with adjustable levels
- **Chunked Storage** - Articles stored as compressed shards for efficient access
- **Storage Modal** - UI to manage compressed storage, view stats, export
- **Manifest System** - Track chunk metadata for efficient retrieval

#### AI Chat Interface
- **CLI-style Chat** - Terminal-like interface for asking questions
- **Model Selection** - Choose Ollama model (llama3.2, mistral, phi3, codellama)
- **Save to Articles** - One-click save AI responses as articles
- **Dark Theme** - Monospace terminal aesthetic

#### Rust Backend
- `compress_lz4` / `decompress_lz4` - LZ4 compression commands
- `compress_zstd` / `decompress_zstd` - Zstd compression commands
- `save_wikipedia_chunk` / `load_wikipedia_chunk` - Chunked storage
- `save_manifest` / `load_manifest` - Storage metadata
- `get_storage_stats` - View compression ratios

### Technical

#### New Dependencies
- `lz4 = "1.24"` - LZ4 compression
- `zstd = "0.13"` - Zstd compression
- `tokio` - Async runtime
- `log` / `env_logger` - Logging

## [1.0.0] - 2026-03-18

### Added

#### Core Features
- **AI Article Generation** - Generate Wikipedia-style articles using Ollama LLM
- **Multi-Source Verification** - Verify claims against Wikipedia and WikiData
- **Import from Wikipedia** - Import real Wikipedia articles by title
- **Export/Import Sync** - JSON-based data sync for portability
- **Dark Mode** - Theme toggle with persistence

#### Components
- `App` - Main application container with state management
- `ArticleList` - Grid view of all articles with search
- `ArticleView` - Full article display with verification panel
- `GenerateModal` - AI article generation dialog
- `ImportModal` - Wikipedia article import dialog
- `ExportModal` - Data export/import interface
- `StatusBadge` - Visual verification status indicator
- `ThemeToggle` - Dark/light mode switcher

#### Verification System
- Wikipedia API integration for claim verification
- WikiData SPARQL endpoint for structured data verification
- Confidence scoring based on source relevance
- Claim extraction from article content
- Source citation tracking

#### Desktop App Support
- Tauri 2.0 integration for native desktop app
- Cross-platform builds (Linux AppImage, DEB, RPM)
- File system access for native file dialogs

### Technical

#### Dependencies
- React 18.3.1
- TypeScript 5.5.3
- TailwindCSS 3.4.4
- Vite 5.4.0
- Tauri 2.0.0
- Tauri Plugins: dialog, fs, shell

#### Configuration
- `package.json` - Node dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript compiler options
- `src-tauri/tauri.conf.json` - Tauri app configuration
- `src-tauri/Cargo.toml` - Rust dependencies

### Known Limitations

- Ollama must be running on localhost:11434
- Default model is llama3.2:1b (changeable in code)
- Data stored in localStorage (browser-specific)
- No authentication or multi-user support
- Verification is informational, not authoritative

### Documentation

- `README.md` - Installation and usage guide
- `VERSION` - Current version number
- `CHANGELOG.md` - Version history (this file)
- `CONTEXT.md` - Project context and motivation
- `SPEC.md` - Feature specification
- `HOWTHISWASBUILT.md` - Build process documentation
