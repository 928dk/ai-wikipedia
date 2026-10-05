## Project Status (v1.9.5 - 2026-06-06)

### Completed ✅
- [x] Core features (article generation, verification, import/export)
- [x] Tauri desktop app integration
- [x] LZ4/Zstd compression system
- [x] RAG (Retrieval Augmented Generation)
- [x] Web Verify mode in chat
- [x] Article editor
- [x] Multi-source verification (20+ sources)
- [x] Tool calling support (Ollama function calling)
- [x] Document parser system (PDF, Word, Excel, PPT, EPUB, code, media, ZIP)
- [x] Dynamic model detection
- [x] Unicode spinner animation
- [x] Fixed TOOLS array syntax errors
- [x] Clean build (no TypeScript or Rust warnings)
- [x] **Nightly Article Sync** - Background worker with Wikipedia News + Random discovery
- [x] **Sync UI** - Status bar, settings modal, chat integration
- [x] **Sync Config** - Persistent config with pipe toggles, interval, max articles
- [x] **Real-time Events** - Frontend listens for `sync-queue-updated` from Tauri
- [x] **WikiBooks Import** - Import books with chapter navigation sidebar
- [x] **Book Icon + Tag** - 📘 icon and "(Book)" badge in article lists
- [x] **Chapter Sidebar** - Scrollable chapter nav in ArticleView for wikibooks
- [x] **AI Reasoning for Imports** - AI can proactively import Wikipedia articles via `import_article` tool instead of saying "I don't know"
- [x] **Structured Source Imports** - AI can import from Lex.dk, SNL, and WikiBooks via dedicated tools (`import_from_lex`, `import_from_snl`, `import_from_wikibooks`)
- [x] **WikiBooks Pagination + Full Chapter Content** - `importFromWikiBooks()` now paginates all subpages via `gapcontinue` and batch-fetches full chapter content
- [x] **Chat import tools save to knowledge base** — `executeTool()` in `useOllama.ts` now calls `onSaveArticle` on successful import
- [x] **Sync queue batch processing** — Auto-import processes max 25 articles per poll cycle
- [x] **Sync random cap removed** — No more `.min(5)` limit on random sync articles
- [x] **Sync queue deduplication** — Duplicate titles are skipped when adding to queue
- [x] **Queue review article preview** — Click-to-preview article content in QueueReviewModal
- [x] **Lex.dk Nightly Sync Pipe** — New `lex_enabled` sync pipe searches 3 random Danish keywords per sync
- [x] **WikiBooks Nightly Sync Pipe** — New `wikibooks_enabled` sync pipe fetches random books
- [x] **Source-aware auto-import** — Frontend branches on `item.source` for Wikipedia, Lex.dk, WikiBooks
- [x] **Source badges in QueueReviewModal** — 📰 News, 🎲 Random, 📖 Lex.dk, 📘 WikiBooks
- [x] **AI Book Generation (v1.9.0)** — User gives a topic, AI generates TOC, each chapter generated independently via `generateWithContext()`, saved as wikibook Article
- [x] **`generateTableOfContents()`** — Ollama prompt returning JSON array of chapter titles, with text fallback parsing
- [x] **`generateChapter()`** — Wraps `generateWithContext()` per chapter, returns `WikiBookChapter`
- [x] **GenerateBookModal.tsx** — Topic input → TOC gen → editable chapter list → sequential gen with progress bar → save as wikibook
- [x] **GenerateBookModal wired in App.tsx** — Book button (rose), state, handler, modal render
- [x] **zstd backup** — `ai-wikipedia-20260605-*.tar.zstd`
- [x] **Spec folder** — `.opencode/specs/008-ai-book-generation/`
- [x] **VERSION → 1.9.0** — Updated
- [x] **CHANGELOG.md** — v1.9.0 entry added
- [x] **TODO.md** — Updated for v1.9.0
- [x] **npm run build** — Clean TypeScript + Vite build
- [x] **Update All Articles (v1.9.1)** — "Update All" button re-fetches every article from Wikipedia across multiple languages, skips unchanged content, shows progress spinner
- [x] **`handleUpdateAllArticles()`** — Iterates all articles, tries `selectedLanguage` → `en` → other languages, compares content for skip-if-unchanged, saves once at end
- [x] **Update All button + progress in ArticleList** — Teal button in tool bar, inline spinner with counts (updated/unchanged/not found)
- [x] **zstd backup** — `ai-wikipedia-update-all-20260605-*.tar.zstd`
- [x] **Spec folder** — `.opencode/specs/009-update-all-articles/`
- [x] **VERSION → 1.9.1** — Updated
- [x] **CHANGELOG.md** — v1.9.1 entry added
- [x] **TODO.md** — Updated for v1.9.1
- [x] **npm run build** — Clean TypeScript + Vite build

### Stability Fixes (v1.9.2) 🔧
- [x] **P0: ArticleView crash** — Added `key` prop on `<ArticleView>` to prevent `activeChapter` OOB crash when switching wikibooks of different chapter counts
- [x] **P0: storage.ts crash** — Added try-catch on `loadArticles` (corrupted localStorage) and `saveArticles` (quota exceeded)
- [x] **P0: App.tsx data loss** — Functional `setArticles` in `handleGenerate`/`handleGenerateBook`/`handleInboxSummarize` to prevent stale closure
- [x] **P0: App.tsx data loss** — `updatingRef` cancellation guard in `handleUpdateAllArticles` to prevent overwrite of concurrent user edits
- [x] **P0: GenerateBookModal UX** — Added Stop button during chapter generation, user can abort mid-generation
- [x] **P1: GenerateBookModal** — Enter key guard, `onClose` before state update, empty chapter validation, error detail in messages
- [x] **P1: App.tsx** — `handleDeleteArticle` existence check to avoid no-op writes
- [x] **P1: importExport.ts** — Added `response.ok` checks on all 4 fetch call sites, domain fallback for unknown languages
- [x] **P1: storage.ts** — Added schema versioning with migration path
- [x] **P2: Various** — Progress bar semantics fixed, error messages include details, label/select a11y, `JSON.parse` citations guard, `clearInterval` guard, functional state updaters, etc.
- [x] **Docs updated** — CONTEXT.md, SPEC.md, VERSION, CHANGELOG.md, Todo.md
- [x] **Build verification** — `npm run build` passes clean

### Needs Testing 🧪
- [ ] Test full book gen flow with stop button
- [ ] Test Update All flow with concurrent edit (verify no data loss)
- [ ] Test delete article confirmation
- [ ] Test cross-language update
- [ ] Test Lex.dk / WikiBooks sync pipes
- [x] Create release build: `npm run tauri build`

### AI Enhance Article (v1.9.5) ✅
- [x] `enhanceArticle()` in generation.ts — sends content+title to Ollama with expansion prompt
- [x] ArticleView: "Enhance with AI" button with amber styling + loading state
- [x] App.tsx: `handleEnhanceArticle` — calls enhanceArticle, updates article content, saves
- [x] Spec folder: `.opencode/specs/014-ai-enhance-article/`
- [x] VERSION → 1.9.5, sync-version.sh propagated
- [x] Build verification — `npm run build` passes clean

### Import from File (v1.9.4) ✅
- [x] ImportModal third tab: file input (.json, .txt, .md)
- [x] Import as: Article / Book radio
- [x] Book mode: Single chapter / Split by headings radio
- [x] `splitByHeadings()` helper splits on `##` / `=== ` headings
- [x] JSON parsing: extracts from `data.articles`, array, or single object
- [x] Text/md: uses stem filename as title
- [x] `handleFileImport` in App.tsx — dedup by title, save
- [x] `onFileImport` prop wired on ImportModal
- [x] Build verification — `npm run build` passes clean

### Pending 📋
- [ ] Tagging and categories
- [ ] Full-text search
- [ ] Encrypted export
- [ ] Wikipedia dump importer
- [ ] Article-to-chat context switching
- [ ] Performance optimization for large datasets

### Known Issues 🐛
1. **Sync UI requires Tauri** - Sync controls only appear when running as Tauri desktop app, not in browser dev mode.
2. **WikiBooks API rate limits** - Fixed in v1.9.3: `gaplimit=max` reduces API calls from dozens to 1-2; `revisions` API avoids 1-extract-per-batch cap.
3. **Python Externally-Managed** - Arch Linux requires `--break-system-packages` flag.
4. **Lex.dk non-Wikipedia items** — Preview in QueueReviewModal shows "Preview not available" for non-Wikipedia articles since preview uses `fetch_wikipedia_articles`.
5. **Wikibook updates** — Fixed in v1.9.3: "Refresh from WikiBooks" button re-fetches full book content including chapters. The old Update All path skips wikibooks entirely.

### Documentation 📚
- [x] CHANGELOG.md - Updated (v1.9.5)
- [x] VERSION - Updated (1.9.5)
- [x] Todo.md - Updated (v1.9.5)
- [x] SPEC.md - Updated (1.9.5)
- [x] CONTEXT.md - Updated (1.9.5)
- [x] sync-version.sh — Now also updates Cargo.toml
- [ ] README.md - May need update

### Build Commands 🛠️
```bash
# Frontend
npm run build

# Backend
cd src-tauri && cargo check

# Launch
./launch_ai_wikipedia.sh

# Python deps
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub
```
