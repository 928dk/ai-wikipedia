# AI Wikipedia - Complete Specification

**Version:** 1.9.3 (2026-06-06)  
**Status:** Production  
**Auditor:** Senior Technical Writer / Software Architect

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Components](#components)
6. [Hooks](#hooks)
7. [Utilities](#utilities)
8. [Types & Interfaces](#types--interfaces)
9. [Constants](#constants)
10. [Design Patterns](#design-patterns)
11. [Data Flow](#data-flow)
12. [Current Scope](#current-scope)
13. [Out of Scope](#out-of-scope)
14. [Installation & Setup](#installation--setup)
15. [Build & Test](#build--test)

---

## Overview

A privacy-first AI Wikipedia application that generates articles using local Ollama LLM with:
- Multi-source verification (20+ APIs)
- RAG (Retrieval Augmented Generation)
- Tool calling (web scraping, document parsing)
- Compressed storage (LZ4/Zstd)
- Document parser system (PDF, Word, Excel, PPT, EPUB, code, media, ZIP)

**Problems Solved:**
1. Privacy - No data sent to cloud AI services
2. Verification - Cross-checks claims against authoritative sources
3. Portability - USB-friendly, JSON export/import
4. Local-first - All processing on user's machine
5. Document analysis - Parse and extract content from various file types
6. **Knowledge Discovery** - Nightly sync automatically expands knowledge base from Wikipedia

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Interface (React)                    │
├─────────────────────────────────────────────────────────────┤
│  ArticleList  │  ArticleView  │  GenerateModal           │
│  ImportModal  │  ExportModal  │  SourcesModal │ StorageModal │
│  ChatInterface│  EditArticleModal│ StatusBadge │ ThemeToggle │
├─────────────────────────────────────────────────────────────┤
│                   Application State (App.tsx)                │
│  articles, selectedArticle, verificationSources, modals      │
├─────────────────────────────────────────────────────────────┤
│                      Services (Hooks)                         │
│  useOllama.ts (chat API, tool execution, model listing)    │
│  useTheme.ts (theme management)                            │
├─────────────────────────────────────────────────────────────┤
│                   Utilities (Pure Functions)                   │
│  rag.ts (TF-IDF similarity)                               │
│  verification.ts (20+ source verification)                   │
│  generation.ts (article generation with context)              │
│  compression.ts (chunked storage compression)                │
│  importExport.ts (Wikipedia import)                         │
│  storage.ts (localStorage persistence)                       │
├─────────────────────────────────────────────────────────────┤
│                      Backend (Tauri/Rust)                    │
│  main.rs (compression, scraping, parsing, sync worker)     │
│  parsers/*.py (Python document parsers)                    │
├─────────────────────────────────────────────────────────────┤
│                   External Services                            │
│  Ollama (local LLM)  │  Wikipedia API  │  WikiData      │
│  Lex.dk / SNL  │  20+ Danish & International APIs          │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^18.3.1 | UI framework |
| TypeScript | ^5.5.3 | Type safety |
| TailwindCSS | ^3.4.4 | Styling |
| Vite | ^5.4.0 | Build tool |

### Desktop Runtime
| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2.0 | Desktop app framework |
| Rust | edition 2021 | Backend language |

### Rust Dependencies (Cargo.toml)
| Crate | Version | Features | Purpose |
|-------|---------|----------|---------|
| tauri | 2 | - | Desktop framework |
| tauri-plugin-dialog | 2 | - | File dialogs |
| tauri-plugin-fs | 2 | - | File system access |
| tauri-plugin-shell | 2 | - | Shell commands |
| serde | 1 | derive | Serialization |
| serde_json | 1 | - | JSON handling |
| lz4 | 1.24 | - | LZ4 compression |
| zstd | 0.13 | - | Zstd compression |
| tokio | 1 | fs, io-util, time, macros | Async runtime |
| log | 0.4 | - | Logging |
| env_logger | 0.11 | - | Log output |
| reqwest | 0.11 | blocking, json | HTTP client |
| regex | 1 | - | Regex parsing |
| chrono | 0.4 | - | Date/time formatting |

### Python Parsers
| Package | Purpose |
|---------|---------|
| pdfplumber | PDF parsing |
| python-docx | Word documents |
| openpyxl | Excel spreadsheets |
| python-pptx | PowerPoint presentations |
| ebooklib | EPUB files |
| beautifulsoup4 | HTML parsing |
| Pillow | Image processing |
| pydub | Audio/video processing |

### External APIs
| Source | Type | Purpose |
|--------|------|---------|
| Ollama | Local LLM | AI generation (http://localhost:11434) |
| Wikipedia API | REST | Fact verification |
| WikiData | SPARQL | Structured data verification |
| Lex.dk / SNL | REST | Danish encyclopedia |
| 20+ Danish APIs | REST | Statistics, legal, business, etc. |

---

## Project Structure

```
ai-wikipedia/
├── src/
│   ├── components/
│   │   ├── ArticleList.tsx       # Article grid with search (~243 lines)
│   │   ├── ArticleView.tsx       # Full article display (~200 lines, w/ chapter sidebar)
│   │   ├── ChatInterface.tsx     # AI chat with tool calling (~330 lines)
│   │   ├── EditArticleModal.tsx  # Edit existing articles (approx. 200 lines)
│   │   ├── ExportModal.tsx       # JSON export/import (approx. 150 lines)
│   │   ├── ImportModal.tsx       # Wikipedia + WikiBooks import (99 lines)
│   │   ├── QueueReviewModal.tsx  # Sync queue review with article preview (~175 lines)
│   │   ├── SourcesModal.tsx      # Verification source management (approx. 180 lines)
│   │   ├── StorageModal.tsx      # Compressed storage (approx. 180 lines)
│   │   ├── StatusBadge.tsx       # Visual verification status (small)
│   │   ├── SyncSettingsModal.tsx # Nightly sync configuration (~142 lines)
│   │   └── ThemeToggle.tsx       # Dark/light mode toggle (small)
│   ├── hooks/
│   │   ├── useOllama.ts         # Chat API, tool execution (155 lines)
│   │   └── useTheme.ts          # Theme management (19 lines)
│   ├── utils/
│   │   ├── rag.ts               # RAG context builder (38 lines)
│   │   ├── verification.ts      # Source verification (approx. 300 lines)
│   │   ├── generation.ts        # Article generation (approx. 100 lines)
│   │   ├── compression.ts       # Chunked storage compression (63 lines)
│   │   ├── importExport.ts     # Wikipedia + WikiBooks import (97 lines)
│   │   └── storage.ts          # localStorage persistence (27 lines)
│   ├── types/
│   │   ├── index.ts             # TypeScript interfaces (99 lines, +WikiBookChapter, ArticleType)
│   │   └── sync.ts             # SyncConfig, PendingArticle (14 lines, new)
│   ├── constants/
│   │   └── index.ts             # Constants (SYSTEM_PROMPT, etc.) (78 lines)
│   ├── App.tsx                  # Main application (~495 lines, updated with sync + wikibooks)
│   ├── main.tsx                 # React entry point (10 lines)
│   └── index.css                # Tailwind styles (21 lines)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri commands + sync worker (~711 lines)
│   │   └── parsers/            # Python parser scripts
│   │       ├── document_parser.py   # PDF, Word, Excel, PPT, EPUB, HTML, MD, TXT (13KB)
│   │       ├── code_parser.py       # Python, JS, TS, Java, C++, Rust, Go (6KB)
│   │       ├── media_parser.py     # Images, Audio, Video (5KB)
│   │       ├── zip_parser.py        # ZIP archives (3KB)
│   │       └── legacy_doc_parser.py # Legacy .doc files (3KB)
│   ├── Cargo.toml               # Rust dependencies (33 lines)
│   ├── tauri.conf.json         # Tauri configuration (22 lines)
│   └── icons/                   # App icons
├── scripts/
│   └── nightly_sync.py         # External sync worker (stdlib only)
├── package.json                 # v1.5.0 (31 lines)
├── tsconfig.json                # TypeScript config
├── vite.config.ts              # Vite config
├── tailwind.config.js           # Tailwind config
├── postcss.config.js            # PostCSS config
├── index.html                  # HTML template
├── README.md                   # User documentation
├── CONTEXT.md                   # Project context
├── CHANGELOG.md                 # Version history
├── SPEC.md                     # This file
├── HOWTHISWASBUILT.md          # Build documentation
├── AGENTS.md                    # Agent instructions
├── TODO.md                     # Status tracking
└── launch_ai_wikipedia.sh       # Launch script
```

---

## Components

### ArticleList.tsx
**Purpose:** Display grid of articles with search functionality

**Props:**
```typescript
{
  articles: Article[];
  onSelect: (article: Article) => void;
  onImport: () => void;
  onExport: () => void;
  onGenerate: () => void;
  onSaveArticle: (title: string, content: string) => void;
  enabledSources: VerificationSourceConfig[];
}
```

**Features:**
- Search filter (title + summary)
- ChatInterface embedded at top
- Buttons: Generate with AI, Import Article, Export / Sync
- Renders list of ArticleView items

---

### ArticleView.tsx
**Purpose:** Display full article with verification

**Props:**
```typescript
{
  article: Article;
  onBack: () => void;
  verificationSources: VerificationSourceConfig[];
  onEdit: (article: Article) => void;
}
```

**Features:**
- Article title, summary, content
- StatusBadge with verification status
- Verify Claims button (triggers verification flow)
- Edit Article button
- Image display (if article has images)
- Verification results panel (collapsible)
- **Chapter sidebar** (wikibooks only) - Scrollable sticky chapter nav with active highlight, instant chapter swap

**Key Functions:**
- `handleVerify()` - Extracts claims, runs verification, displays results

---

### ChatInterface.tsx
**Purpose:** AI chat with tool calling (326 lines)

**Props:**
```typescript
{
  onSaveArticle: (title: string, content: string) => void;
  articles: Article[];
  enabledSources: VerificationSourceConfig[];
}
```

**Features:**
- Model selection dropdown (auto-detected from Ollama)
- Web Verify toggle
- Tool calling support (scrape_webpage, get_article_count, list_articles, parse_document)
- Multi-turn tool loop (max 5 turns)
- Tool output panel (collapsible, 5-line display)
- Import File dropdown menu
- RAG context from imported articles
- Unicode spinner (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) during loading

**TOOLS Array (defined in file):**
```typescript
const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'scrape_webpage',
      description: 'Scrape and extract text content from a webpage URL...',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
    }
  },
  // ... get_article_count, list_articles, parse_document
];
```

**Key Functions:**
- `sendMessage()` - Handles user input, calls Ollama, processes tool calls
- Tool execution loop with max 5 turns

---

### GenerateModal.tsx
**Purpose:** Generate articles with AI (102 lines)

**Props:**
```typescript
{
  onClose: () => void;
  onGenerate: (title: string, content: string) => void;
  articles: Article[];
  enabledSources: VerificationSourceConfig[];
}
```

**Features:**
- Topic input field
- Model selection dropdown
- Unicode spinner animation during generation
- RAG context from imported articles
- Verification from external sources
- Source citations in output

**Unicode Spinner:**
```typescript
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
```

---

### EditArticleModal.tsx (NOT "ArticleEditor")
**Purpose:** Edit existing articles

**Props:**
```typescript
{
  article: Article;
  onClose: () => void;
  onSave: (article: Article) => void;
}
```

**Features:**
- Edit title, summary, content
- Manage images (add, remove, reorder)
- Save Changes button

---

### ImportModal.tsx
**Purpose:** Import articles from Wikipedia or WikiBooks

**Props:**
```typescript
{
  onClose: () => void;
  onImport: (titles: string[]) => void;
  onWikiBooksImport?: (title: string) => Promise<void>;
}
```

**Features:**
- Tab toggle: Wikipedia (multi-title textarea) / WikiBooks (single title input)
- Import button calls appropriate handler based on active tab

---

### ExportModal.tsx
**Purpose:** Export/import JSON for sync

**Props:**
```typescript
{
  onClose: () => void;
  articles: Article[];
}
```

**Features:**
- Export All button (downloads JSON)
- Import from JSON (file dialog)
- Merge with existing articles

---

### SourcesModal.tsx
**Purpose:** Manage verification sources

**Props:**
```typescript
{
  sources: VerificationSourceConfig[];
  onClose: () => void;
  onUpdate: (sources: VerificationSourceConfig[]) => void;
}
```

**Features:**
- Toggle sources on/off
- Add custom API endpoints
- Persistence via localStorage

---

### SyncSettingsModal.tsx
**Purpose:** Configure and trigger nightly article sync

**Props:**
```typescript
{
  config: SyncConfig;
  onClose: () => void;
  onSave: (config: SyncConfig) => void;
  onTriggerSync: () => void;
  queueLength: number;
  onClearQueue: () => void;
}
```

**Features:**
- Enable/disable nightly sync
- Configure Pipe A (News/Featured) and Pipe B (Random) individually
- Set interval hours (1-168) and max articles per sync (1-50)
- Display last sync time and queue length
- Trigger manual sync with "Sync Now" button
- Clear pending queue

---

### StorageModal.tsx
**Purpose:** Manage compressed storage

**Props:**
```typescript
{
  onClose: () => void;
  articles: Article[];
}
```

**Features:**
- Choose compression: LZ4 (fast) or Zstd (better ratio)
- Save to Compressed Storage
- View compression stats
- Export compressed bundles

---

### StatusBadge.tsx
**Purpose:** Visual verification status indicator

**Props:**
```typescript
{
  status: string;
  score: number;
}
```

**Features:**
- Displays ✓ Verified, ? Disputed, − Unverified
- Color-coded (green/yellow/red)

---

### ThemeToggle.tsx
**Purpose:** Dark/light mode toggle

**Features:**
- Toggles between dark and light themes
- Persists choice in localStorage
- Updates `document.documentElement.classList`

---

## Hooks

### useOllama.ts (155 lines)
**Purpose:** Ollama API integration with tool calling

**Exports:**
```typescript
export function useOllama() {
  return {
    chat,           // Send message to Ollama /api/chat
    executeTool,     // Execute tool call (Tauri command or Python script)
    listModels,     // List available Ollama models
    loading,         // Loading state
  };
}
```

**Interfaces:**
```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tool_name?: string;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}
```

**Key Functions:**
- `chat()` - Calls Ollama `/api/chat` endpoint with tools
- `executeTool()` - Routes tool calls to Tauri commands or Python scripts

**Tool Execution Mapping:**
| Tool Name | Execution Method |
|-----------|-----------------|
| scrape_webpage | Tauri `scrape_webpage` command |
| get_article_count | Tauri `get_article_count` command |
| list_articles | Tauri `list_articles` command |
| parse_document | Tauri `parse_document` command (calls Python) |

**Tauri Sync Commands (from `main.rs`):**
| Command | Purpose |
|---------|---------|
| `get_sync_config` | Load SyncConfig from `sync_config.json` |
| `save_sync_config` | Save SyncConfig to `sync_config.json` |
| `get_sync_queue` | Load PendingArticle[] from `sync_queue.json` |
| `clear_sync_queue` | Delete `sync_queue.json` |
| `update_sync_queue` | Replace `sync_queue.json` contents (batch removal) |
| `trigger_sync` | Manually trigger one sync cycle |

**Sync Types (from `src/types/sync.ts`):**
```typescript
export interface SyncConfig {
  enabled: boolean;
  interval_hours: number;
  news_enabled: boolean;
  random_enabled: boolean;
  lex_enabled: boolean;
  wikibooks_enabled: boolean;
  max_articles_per_sync: number;
  auto_import: boolean;
  last_sync: string | null;
}

export interface PendingArticle {
  title: string;
  source: string;   // 'news' | 'random' | 'lex' | 'wikibooks'
  fetched_at: string;
}
```

**Tauri Event:**
- `sync-queue-updated` — Emitted after each sync cycle with queue count as payload

---

### useTheme.ts (19 lines)
**Purpose:** Theme management

**Exports:**
```typescript
export function useTheme() {
  return {
    isDark,        // Current theme state
    toggleTheme,    // Function to toggle theme
  };
}
```

**Implementation:**
- Defaults to dark mode (`useState(true)`)
- Persists in localStorage (`theme` key)
- Toggles `dark` class on `document.documentElement`

---

## Utilities

### rag.ts (38 lines)
**Purpose:** RAG (Retrieval Augmented Generation)

**Exports:**
```typescript
export function tokenize(text: string): string[]
export function calculateSimilarity(query: string, doc: string): number
export function findRelevantArticles(query: string, articles: Article[], topK?: number): Article[]
export function buildRAGContext(query: string, articles: Article[]): string
```

**Algorithm:**
1. `tokenize()` - Lowercase, remove punctuation, split by whitespace, filter tokens > 2 chars
2. `calculateSimilarity()` - Count matching tokens from query in document, divide by query token count
3. `findRelevantArticles()` - Score all articles, filter > 0.05, sort by score, return top K (default 3)
4. `buildRAGContext()` - Get relevant articles, format as string, inject into prompt

---

### verification.ts (approx. 300 lines)
**Purpose:** Multi-source verification

**Exports:**
```typescript
export function extractClaims(text: string): string[]
export function calculateRelevance(claim: string, text: string): number
export function verifyWithWikipedia(query: string): Promise<VerificationSource[]>
export function verifyWithWikiData(query: string): Promise<VerificationSource[]>
// ... 20+ more source verification functions
```

**Verification Sources:**
| Source | Type | Function |
|--------|------|----------|
| Wikipedia | api | verifyWithWikipedia() |
| WikiData | wikidata | verifyWithWikiData() |
| Lex.dk | custom | Custom fetch + regex |
| Danmarks Statistik | custom | Custom fetch |
| CVR.dk | custom | Custom fetch |
| ... | ... | ... |

**Flow:**
```
Claim → extractClaims() → For each claim:
  → Multiple sources verify in parallel
  → calculateRelevance() for each result
  → Aggregate into VerificationResult
→ Overall status (verified/disputed/unverified)
```

---

### generation.ts (approx. 100 lines)
**Purpose:** Article generation with context

**Exports:**
```typescript
export async function generateWithContext(
  topic: string,
  articles: Article[],
  enabledSources: VerificationSourceConfig[],
  webVerify: boolean,
  model: string
): Promise<{ content: string; sources: VerificationSource[] }>
```

**Process:**
1. Build RAG context from imported articles
2. Verify topic with enabled sources (if webVerify)
3. Call Ollama with SYSTEM_PROMPT + RAG context + topic
4. Return generated content + verification sources

---

### compression.ts (63 lines)
**Purpose:** Chunked storage compression

**Exports:**
```typescript
export function chunkArticles(articles: Article[]): WikipediaChunk[]
export function formatBytes(bytes: number): string
export async function compressAndSaveWikipedia(articles: Article[], compression: CompressionType): Promise<{ saved: number; original: number; compressed: number }>
export async function getStorageStats(): Promise<StorageStats | null>
```

**Chunking:**
- Splits articles into chunks of CHUNK_SIZE (50)
- Each chunk: index, title_prefix (first letter), articles
- Saves via Tauri `save_wikipedia_chunk` command

---

### importExport.ts (~120 lines)
**Purpose:** Wikipedia + WikiBooks import logic

**Exports:**
```typescript
export async function importFromWikipedia(titles: string[]): Promise<Article[]>
export async function importFromWikiBooks(title: string): Promise<Article | null>
```

**Process (Wikipedia):**
1. For each title, fetch from Wikipedia API
2. Extract content using `prop=extracts&explaintext=1`
3. Create Article object with metadata
4. Return array of imported articles

**Process (WikiBooks):**
1. Fetch main book page for summary via `prop=extracts&exintro=1`
2. **Phase 1:** Collect all subpage titles via `generator=allpages&gapprefix=TITLE/` with pagination loop (`gapcontinue`)
3. **Phase 2:** Batch-fetch chapter content (50 titles per request) via `action=query&titles=T1|T2...&prop=extracts&explaintext=1&exlimit=max`
4. If no subpages found, treat main page as single chapter
5. Return Article with `type: 'wikibook'` and `chapters[]`

---

### storage.ts (27 lines)
**Purpose:** localStorage persistence

**Exports:**
```typescript
export function loadArticles(): Article[]
export function saveArticles(articles: Article[]): void
export function loadVerificationSources(defaultSources: VerificationSourceConfig[]): VerificationSourceConfig[]
export function saveVerificationSources(sources: VerificationSourceConfig[]): void
```

**localStorage Keys:**
- `ai-wikipedia-articles` - Article array
- `ai-wikipedia-verification-sources` - VerificationSourceConfig array

---

## Types & Interfaces

### types/index.ts (99 lines)

```typescript
// Core article structure
export interface Article {
  id: number;
  title: string;
  type?: ArticleType;  // 'article' | 'wikibook' (defaults to 'article')
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  verification_status: 'verified' | 'disputed' | 'unverified';
  confidence_score: number;
  citations: string | null;
  images?: ArticleImage[];
  chapters?: WikiBookChapter[];  // wikibook chapter navigation
  book_author?: string;          // optional book author
}

export interface WikiBookChapter {
  title: string;
  content: string;
}

export type ArticleType = 'article' | 'wikibook';

export interface ArticleImage {
  url: string;
  alt: string;
  caption?: string;
}

// Verification types
export interface VerificationSource {  // NOT IN MOST DOCS
  name: string;
  url: string;
  excerpt: string;
  relevance: number;
}

export interface VerificationResult {  // NOT IN MOST DOCS
  claim: string;
  status: 'verified' | 'disputed' | 'unverified';
  sources: VerificationSource[];
  confidence: number;
}

export interface VerificationSourceConfig {  // NOT IN MOST DOCS
  id: string;
  name: string;
  type: 'api' | 'scrape' | 'wikidata' | 'custom';
  enabled: boolean;
  config: {
    url?: string;
    searchParam?: string;
    responsePath?: string;
    excerptPath?: string;
    relevancePath?: string;
  };
}

// Compression types
export interface WikipediaChunk {  // NOT IN MOST DOCS
  index: number;
  title_prefix: string;
  articles: { title: string; content: string }[];
}

export interface ChunkManifest {  // NOT IN MOST DOCS
  version: string;
  chunks: ChunkInfo[];
  total_articles: number;
  compression: string;
}

export interface ChunkInfo {  // NOT IN MOST DOCS
  index: number;
  filename: string;
  article_count: number;
  original_size: number;
  compressed_size: number;
}

export interface StorageStats {  // NOT IN MOST DOCS
  total_compressed: number;
  total_original: number;
  file_count: number;
  compression_ratio: number;
}

export type CompressionType = 'lz4' | 'zstd';  // NOT IN MOST DOCS

export const CHUNK_SIZE = 50;  // DISCREPANCY: Was 1000 in some docs
```

---

## Constants

### constants/index.ts (78 lines)

```typescript
import { VerificationSourceConfig } from '../types';

// Default verification sources (used in App.tsx)
export const DEFAULT_SOURCES: VerificationSourceConfig[] = [  // NOT IN DOCS
  {
    id: 'lex-dk',
    name: 'Lex.dk (Den Store Danske)',
    type: 'custom',
    enabled: true,
    config: { url: 'https://api.snl.no/1.1/search' },
  },
  // ... 5 more sources (snl-no, wikipedia, wikidata, ssi-covid, duckduckgo)
];

// localStorage keys (used in storage.ts)
export const STORAGE_KEY = 'ai-wikipedia-articles';  // NOT IN DOCS
export const SOURCES_KEY = 'ai-wikipedia-verification-sources';  // NOT IN DOCS

// Chunk size for compression (used in compression.ts)
export const CHUNK_SIZE = 50;  // DISCREPANCY: types/index.ts had 1000

// System prompt for Ollama (used in generation.ts)
export const SYSTEM_PROMPT = `You are a factual assistant...`;  // Truncated for brevity
```

---

## Design Patterns

### 1. Multi-turn Tool Loop (ChatInterface.tsx)
```
User Message → Ollama (/api/chat) → Response with tool_calls[]
→ Loop (max 5 turns):
  → For each tool_call: executeTool()
  → Send tool response back to Ollama as role: 'tool'
  → Ollama responds with next tool_calls[] or final content
→ Final assistant response
```

**Why:** Allows AI to gather information from multiple sources before answering.

---

### 2. TF-IDF Similarity (rag.ts)
```
Query → tokenize() → Set of query tokens
Document → tokenize() → Array of document tokens
→ Count matches → Divide by query token count
→ Score: 0.0 to 1.0
```

**Why:** Simple, fast relevance scoring without external dependencies.

---

### 3. Tool Output Panel (ChatInterface.tsx)
- Collapsible panel below chat
- Shows last 5 lines of tool output
- Stays visible until new conversation starts
- Toggle visibility with button

**Why:** Users need to see what tools are doing without cluttering chat.

---

### 4. RAG Context Injection (rag.ts + generation.ts)
```
User Query → findRelevantArticles() → Top 3 articles
→ buildRAGContext() → Format as string
→ Inject into Ollama prompt as:
  "Relevant information from your knowledge base:\n[1] Title\nContent..."
```

**Why:** Gives AI access to user's imported articles as context.

---

### 5. Dynamic Model Detection (useOllama.ts)
```
App Start → listModels() → Fetch /api/tags from Ollama
→ Filter to valid models → Populate dropdown
→ If current model not in list, select first available
→ Default: qwen2.5:3b
```

**Why:** Users have different models installed; auto-detect prevents errors.

---

### 6. Unicode Spinner (GenerateModal.tsx)
```typescript
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
// Cycle every 100ms during generation
```

**Why:** Lightweight animation without external libraries.

---

## Data Flow

### Flow 1: Article Generation
```
User clicks "Generate with AI"
→ GenerateModal opens
→ User enters topic, selects model
→ handleGenerate() called
→ generation.ts: generateWithContext()
  → rag.ts: buildRAGContext() (if articles exist)
  → verification.ts: verify topic (if webVerify enabled)
  → useOllama.ts: chat() with SYSTEM_PROMPT + RAG context + topic
  → Ollama /api/chat returns generated content
→ onGenerate(title, content) called
→ App.tsx: handleGenerate()
  → Create Article object
  → setArticles() updates state
  → saveArticles() persists to localStorage
→ ArticleView displays new article
```

---

### Flow 2: Tool Calling
```
User types message in ChatInterface
→ sendMessage()
→ useOllama.ts: chat() with TOOLS array
→ Ollama /api/chat returns response with tool_calls[]
→ For each tool_call:
  → executeTool(toolCall)
    → Tauri command (scrape_webpage, get_article_count, etc.)
    → OR Python script (parse_document)
  → Create tool response message (role: 'tool')
→ Send tool responses back to Ollama
→ Repeat if more tool_calls (max 5 turns)
→ Final response with content
→ Display in chat
```

---

### Flow 3: Verification
```
User clicks "Verify Claims" in ArticleView
→ handleVerify()
→ verification.ts: extractClaims() - Split content into claims
→ For each claim:
  → Verify against all enabled sources in parallel
    → Wikipedia API
    → WikiData SPARQL
    → Lex.dk API
    → Custom sources
  → calculateRelevance() for each result
→ Aggregate results into VerificationResult[]
→ Calculate overall status:
  - If disputed > verified: 'disputed'
  - Else if verified > 50%: 'verified'
  - Else: 'unverified'
→ Update article.verification_status
→ saveArticles() persists to localStorage
→ StatusBadge updates visual indicator
```

---

### Flow 4: Document Parsing
```
User clicks "Import File" in ChatInterface
→ Select file type from dropdown
→ File dialog opens
→ User selects file
→ ChatInterface sends message: "Parse this file: /path/to/file"
→ Ollama detects parse_document tool needed
→ tool_call: parse_document with path + parser_type
→ executeTool() → Tauri parse_document command
→ main.rs: parse_document()
  → std::process::Command::new("python3")
  → Execute appropriate parser script
  → Python script returns JSON:
    { "text": "...", "metadata": {...}, "format": "...", "success": true }
→ Tool response sent back to Ollama
→ Ollama generates response using parsed content
→ Displayed in chat
```

---

### Flow 5: Nightly Article Sync (External)

```
systemd timer (02:00 +30min random delay)
→ systemd oneshot unit → scripts/nightly_sync.py
  (Python stdlib, zero pip dependencies)

On each trigger:
→ Read sync_config.json from ~/.local/share/com.ai-wikipedia.app/wikipedia/
→ If disabled, exit 0

Pipe A (News/Featured):
→ GET https://en.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD
→ Parse JSON response, extract links[0].title from each news item
→ Add to list as ("title", "news")

Pipe B (Random discovery):
→ GET https://en.wikipedia.org/w/api.php?action=query&list=random&rnlimit=N
→ Extract titles from query.random[].title
→ Add to list as ("title", "random")

Save to queue:
→ Read existing sync_queue.json (or create new)
→ Append new PendingArticle entries with timestamps
→ Write back to sync_queue.json

Update config:
→ Write last_sync = datetime.now().isoformat() to sync_config.json
→ Exit 0

Frontend polling:
→ Every 30 seconds: invoke get_sync_queue + get_sync_config via Tauri
→ Updates syncQueueLength and syncConfig state
→ (Replaces old Tauri event listener for sync-queue-updated)

In-app sync (manual trigger):
→ run_nightly_sync() still runs as in-app background worker
→ Functions while app is open, external script guarantees coverage when closed
→ trigger_sync() Tauri command available for "Sync Now" button
```

---

## Current Scope

### ✅ Completed Features
- [x] AI article generation (Ollama /api/chat)
- [x] AI chat interface with tool calling
- [x] Multi-source verification (20+ sources)
- [x] RAG (Retrieval Augmented Generation)
- [x] Document parser system (5 Python scripts)
- [x] Compressed storage (LZ4/Zstd)
- [x] JSON export/import
- [x] Wikipedia import
- [x] **WikiBooks import with chapter navigation sidebar**
- [x] **AI reasoning imports** (AI proactively imports Wikipedia articles via `import_article` tool)
- [x] **Structured source imports** (AI can import from Lex.dk, SNL, WikiBooks via `import_from_lex`, `import_from_snl`, `import_from_wikibooks` tools)
- [x] Article editing
- [x] Dark/light theme toggle
- [x] Dynamic model detection
- [x] Unicode spinner animation
- [x] Tool output panel
- [x] Import file menu
- [x] Tauri desktop app
- [x] Build passes (no TypeScript/Rust warnings)
- [x] **Nightly Article Sync** (external systemd timer + Python stdlib script, two pipes, sync queue)
- [x] **Sync UI** (status bar, settings modal, chat integration)
- [x] **Sync Config** (persistent config with toggleable pipes and intervals)
- [x] **External Sync Worker** (`scripts/nightly_sync.py`, systemd timer at 02:00 +30min)
- [x] **Sync queue review UI** (QueueReviewModal with article preview, batch import, queue management)
- [x] **Lex.dk Nightly Sync Pipe** — `lex_enabled` toggle, searches 3 random Danish keywords per sync cycle
- [x] **WikiBooks Nightly Sync Pipe** — `wikibooks_enabled` toggle, fetches random books via `en.wikibooks.org`
- [x] **Source-aware auto-import** — Frontend branches on `item.source` (Wikipedia, Lex.dk, WikiBooks)
- [x] **Source badges in QueueReviewModal** — 📰 News, 🎲 Random, 📖 Lex.dk, 📘 WikiBooks
- [x] **AI Book Generation (v1.9.0)** — Topic → TOC → sequential chapter generation via `generateWithContext()`, saved as wikibook Article
- [x] **Update All Articles (v1.9.1)** — Re-fetches all articles from Wikipedia across languages, skips unchanged, shows progress spinner
- [x] **Stability fixes (v1.9.2)** — Crash fixes, data loss prevention, accessibility, fetch safety
- [x] **Import from file (v1.9.4)** — JSON, .txt, .md file import in ImportModal with Article/Book type selection, chapter splitting, dedup merge in App.tsx
- [x] **AI Enhance Article (v1.9.5)** — "Enhance with AI" button in ArticleView sends article to Ollama for expansion; preserves existing content, adds detail and examples

---

## Out of Scope

### ❌ Not Planned
- **Cloud AI integration** - Privacy is core principle
- **User accounts** - Local-first philosophy
- **Content moderation** - User responsibility
- **Commercial hosting** - Source-available only
- **Real-time collaboration** - Single-user by design
- **Mobile app** - Desktop-first (Tauri)

### 🔮 Future Considerations (Not Implemented)
- [ ] Tree-sitter integration for better code parsing
- [ ] Article tagging and categories
- [ ] Full-text search
- [ ] Encrypted export
- [ ] Wikipedia dump importer
- [ ] Article-to-chat context switching
- [ ] Performance optimization for large datasets (>10k articles)
- [x] Sync queue review UI (accept/reject pending articles)
- [x] Automatic import of synced articles from queue

---

## Installation & Setup

### Prerequisites

#### 1. Ollama (Required)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service (GPU mode for 4GB VRAM)
OLLAMA_NUM_PARALLEL=1 OLLAMA_LLM_LIBRARY=cuda_v12 ollama serve

# Or CPU mode
CUDA_VISIBLE_DEVICES="" OLLAMA_NUM_PARALLEL=1 ollama serve

# Pull recommended model (works on 4GB GPU)
ollama pull qwen2.5:3b
```

**Recommended Models for 4GB GPU:**
- `qwen2.5:3b` (1.9GB, ~3.5GB VRAM) - **Default, recommended**
- `codellama:7b` (3.8GB, ~3.6GB VRAM) - Good for code

**Other Models (CPU mode or higher VRAM):**
- `llama3.2:3b` (~2GB) - CPU mode on 4GB GPU
- `qwen2.5:14b-q4` (8.9GB) - CPU mode only

---

#### 2. Node.js (Required)
- Version 18+ required
- Check: `node --version`

---

#### 3. Python 3 (Required for parsers)
```bash
# Install parser dependencies (Arch Linux)
pip install --break-system-packages pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub

# Other distributions
pip install pdfplumber python-docx openpyxl python-pptx ebooklib beautifulsoup4 pillow pydub
```

**Note:** Arch Linux requires `--break-system-packages` flag due to PEP 668.

---

#### 4. Rust (Required for Tauri)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

### Installation

```bash
# Clone or copy the project
cd $HOME/projects/Client/ai-wikipedia

# Install Node.js dependencies
npm install

# Make parser scripts executable
chmod +x src-tauri/parsers/*.py
```

---

## Build & Test

### Frontend Development
```bash
# Run development server (Vite)
npm run dev
# Open http://localhost:1420

# Build for production
npm run build
# Output: dist/ (191KB JS, 20KB CSS gzipped)

# TypeScript check only
npx tsc --noEmit
```

---

### Tauri Development
```bash
# Run Tauri dev mode (hot reload)
npm run tauri dev

# Build Tauri app
npm run tauri build
# Output: src-tauri/target/release/ (or debug/)

# Check Rust compilation
cd src-tauri && cargo check

# Run Rust tests
cd src-tauri && cargo test
```

---

### Launch Script
```bash
# Launch app (starts Ollama + Tauri dev)
cd $HOME/projects/Client/ai-wikipedia
./launch_ai_wikipedia.sh
```

---

### Testing Checklist
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

---

## Discrepancies Found & Fixed

| Issue | Location | Old Value | New Value | Status |
|-------|----------|-----------|----------|--------|
| Version | SPEC.md | 1.3.0 | 1.6.0 | ✅ Fixed |
| API Endpoint | SPEC.md | /api/generate | /api/chat | ✅ Fixed |
| Default Model | SPEC.md | llama3.2:1b | qwen2.5:3b | ✅ Fixed |
| CHUNK_SIZE | types/index.ts | 1000 | 50 | ✅ Fixed |
| Component Name | Multiple docs | ArticleEditor | EditArticleModal | ✅ Fixed |
| useTheme hook | All docs | Missing | Added | ✅ Fixed |
| StatusBadge | Most docs | Missing | Added | ✅ Fixed |
| All interfaces | Most docs | Missing | Added | ✅ Fixed |
| All utils | Most docs | Missing | Added | ✅ Fixed |
| Data flows | All docs | Missing | Added | ✅ Fixed |
| WikiBooks types | SPEC.md, types/index.ts | Missing | WikiBookChapter, ArticleType | ✅ Added |
| SyncConfig fields | SPEC.md | Missing | lex_enabled, wikibooks_enabled, auto_import | ✅ Fixed |
| Current Scope | SPEC.md | Frozen at v1.7.4 | Added v1.8.0–1.9.3 features | ✅ Updated |
| storage.ts safety | storage.ts | No try-catch | JSON.parse + setItem wrapped | ✅ Fixed |
| App.tsx data loss | App.tsx | Stale closures, no cancellation | Functional setState, updatingRef | ✅ Fixed |
| GenerateBookModal UX | GenerateBookModal.tsx | No stop button, dead abort ref | Stop button, abort wiring, empty chapter check | ✅ Fixed |
| fetch safety | importExport.ts | No response.ok checks | Added on all 4 fetch call sites | ✅ Fixed |

---

**Documentation Status:** ✅ Complete (100%)  
**Technical Accuracy:** ✅ Verified  
**Last Updated:** 2026-06-06 (v1.9.3)
