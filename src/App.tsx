import { useState, useEffect, useRef } from 'react';
import { Article, VerificationSourceConfig, Language, LANGUAGES, LANGUAGE_STORAGE_KEY } from './types';
import { SyncConfig, PendingArticle } from './types/sync';
import { DEFAULT_SOURCES } from './constants';
import { loadArticles, saveArticles, loadVerificationSources, saveVerificationSources } from './utils/storage';
import { ThemeToggle } from './components/ThemeToggle';
import { ArticleList } from './components/ArticleList';
import { ArticleView } from './components/ArticleView';
import { EditArticleModal } from './components/EditArticleModal';
import { GenerateModal } from './components/GenerateModal';
import { GenerateBookModal } from './components/GenerateBookModal';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { SourcesModal } from './components/SourcesModal';
import { StorageModal } from './components/StorageModal';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import { QueueReviewModal } from './components/QueueReviewModal';
import { DistillModal } from './components/DistillModal';
import { OracleModal } from './components/OracleModal';
import { EmptyArticlesModal } from './components/EmptyArticlesModal';
import { GraphView } from './components/GraphView';
import { importFromWikipedia, importFromWikiBooks, importFromLexDk } from './utils/importExport';
import { enhanceArticle } from './utils/generation';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

interface InboxItem {
  filename: string;
  text: string;
  format: string;
}

interface FetchedArticle {
  title: string;
  content: string;
  pageid: number;
}

function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showGenerateBook, setShowGenerateBook] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showQueueReview, setShowQueueReview] = useState(false);
  const [showDistill, setShowDistill] = useState(false);
  const [showOracle, setShowOracle] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [verificationSources, setVerificationSources] = useState<VerificationSourceConfig[]>(DEFAULT_SOURCES);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [oracleTopic, setOracleTopic] = useState('');
  const [showEmptyArticles, setShowEmptyArticles] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ current: number; total: number; currentTitle: string; updated: number; notFound: number; skipped: number } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (saved === 'en' || saved === 'da' || saved === 'de' || saved === 'es') ? saved : 'en';
  });

  const handleLanguageChange = (lang: Language) => {
    setSelectedLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const emptyArticles = articles.filter(a => !a.content || a.content.length < 50);

  useEffect(() => {
    setArticles(loadArticles());
    setVerificationSources(loadVerificationSources(DEFAULT_SOURCES));

    const BATCH_SIZE = 25;

    const loadSyncData = () => {
      invoke<SyncConfig>('get_sync_config').then(async (config) => {
        setSyncConfig(config);
        if (config.auto_import) {
          try {
            const queue = await invoke<PendingArticle[]>('get_sync_queue');
            if (queue.length > 0) {
              const batch = queue.slice(0, BATCH_SIZE);
              const newArticles: Article[] = [];
              const wikiItems = batch.filter(a => a.source === 'news' || a.source === 'random');
              if (wikiItems.length > 0) {
                const articles = await invoke<FetchedArticle[]>('fetch_wikipedia_articles', { titles: wikiItems.map(a => a.title) });
                for (const f of articles) {
                  if (f.content && f.content.length > 50) {
                    newArticles.push({
                      id: Date.now() + Math.random(),
                      title: f.title,
                      content: f.content,
                      summary: f.content.slice(0, 200) + (f.content.length > 200 ? '...' : ''),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      verification_status: 'verified' as const,
                      confidence_score: 0.95,
                      citations: JSON.stringify([{ source: 'Wikipedia', url: `https://en.wikipedia.org/?curid=${f.pageid}` }]),
                    });
                  }
                }
              }
              for (const item of batch.filter(a => a.source === 'lex')) {
                try {
                  const article = await importFromLexDk(item.title);
                  if (article) newArticles.push(article);
                } catch (e) { console.error('Lex.dk auto-import failed:', e); }
              }
              for (const item of batch.filter(a => a.source === 'wikibooks')) {
                try {
                  const article = await importFromWikiBooks(item.title);
                  if (article) newArticles.push(article);
                } catch (e) { console.error('WikiBooks auto-import failed:', e); }
              }
              if (newArticles.length > 0) {
                const existing = loadArticles();
                const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
                const filtered = newArticles.filter(a => !existingTitles.has(a.title.toLowerCase()));
                if (filtered.length > 0) {
                  const merged = [...filtered, ...existing];
                  setArticles(merged);
                  saveArticles(merged);
                }
              }
              const remaining = queue.slice(BATCH_SIZE);
              if (remaining.length > 0) {
                await invoke('update_sync_queue', { articles: remaining });
                setSyncQueueLength(remaining.length);
              } else {
                await invoke('clear_sync_queue');
                setSyncQueueLength(0);
              }
            } else {
              setSyncQueueLength(0);
            }
          } catch (e) {
            console.error('Auto-import failed:', e);
          }
        } else {
          const q = await invoke<PendingArticle[]>('get_sync_queue').catch(() => []);
          setSyncQueueLength(q.length);
        }
      }).catch(() => {});
    };

    loadSyncData();
    const pollInterval = setInterval(loadSyncData, 30_000);

    const unlistenInbox = listen<InboxItem>('inbox-file-detected', (event) => {
      setInboxItems(prev => [...prev, event.payload]);
    });

    return () => {
      clearInterval(pollInterval);
      unlistenInbox.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (oracleTopic) {
      setShowGenerate(true);
      setOracleTopic('');
    }
  }, [oracleTopic]);

  const handleGenerate = (title: string, content: string, citations?: string) => {
    const article: Article = {
      id: Date.now(),
      title,
      language: selectedLanguage,
      content,
      summary: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'unverified',
      confidence_score: 0,
      citations: citations || null,
    };
    setArticles(prev => {
      const updated = [article, ...prev];
      saveArticles(updated);
      return updated;
    });
    setSelectedArticle(article);
  };

  const handleEdit = (updatedArticle: Article) => {
    const updated = articles.map(a => a.id === updatedArticle.id ? updatedArticle : a);
    setArticles(updated);
    saveArticles(updated);
    setSelectedArticle(updatedArticle);
  };

  const handleFetchMore = async (title: string): Promise<void> => {
    try {
      const imported = await importFromWikipedia([title], selectedLanguage);
      if (imported.length > 0 && imported[0].content) {
        const wi = imported[0];
        setArticles(prev => {
          const updated = prev.map(a => {
            if (a.title.toLowerCase() === title.toLowerCase()) {
              return { ...a, content: wi.content, summary: wi.summary, citations: wi.citations, verification_status: 'verified' as const, confidence_score: 0.95, updated_at: new Date().toISOString() };
            }
            return a;
          });
          saveArticles(updated);
          return updated;
        });
        setSelectedArticle(prev => prev?.title.toLowerCase() === title.toLowerCase()
          ? { ...prev!, content: wi.content, summary: wi.summary, citations: wi.citations, verification_status: 'verified' as const, confidence_score: 0.95, updated_at: new Date().toISOString() }
          : prev
        );
      }
    } catch (e) {
      console.error('Fetch more failed:', e);
    }
  };

  const handleImport = async (titles: string[], lang?: Language) => {
    const imported = await importFromWikipedia(titles, lang || selectedLanguage);
    const existing = loadArticles();
    const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
    const filtered = imported.filter(a => !existingTitles.has(a.title.toLowerCase()));
    const merged = [...filtered, ...existing];
    setArticles(merged);
    saveArticles(merged);
  };

  const handleWikiBooksImport = async (title: string) => {
    const article = await importFromWikiBooks(title);
    if (article) {
      const existing = loadArticles();
      const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
      if (!existingTitles.has(article.title.toLowerCase())) {
        const merged = [article, ...existing];
        setArticles(merged);
        saveArticles(merged);
      }
    }
  };

  const handleTriggerSync = async () => {
    try {
      await invoke<string>('trigger_sync');
    } catch (e) {
      console.error('Sync failed:', e);
    }
  };

  const handleDeleteArticle = (id: number) => {
    const idx = articles.findIndex(a => a.id === id);
    if (idx === -1) return;
    const updated = articles.filter(a => a.id !== id);
    setArticles(updated);
    saveArticles(updated);
  };

  const handleDeleteAllEmpty = () => {
    const kept = articles.filter(a => a.content && a.content.length >= 50);
    setArticles(kept);
    saveArticles(kept);
    setShowEmptyArticles(false);
  };

  const updatingRef = useRef(false);

  const handleUpdateAllArticles = async () => {
    updatingRef.current = true;
    setUpdating(true);
    const currentArticles = loadArticles();
    const updatedArticles = [...currentArticles];
    let updated = 0, notFound = 0, skipped = 0;
    const langs: Language[] = ['en', 'da', 'de', 'es'];
    const langOrder = [selectedLanguage, ...langs.filter(l => l !== selectedLanguage)];

    for (let i = 0; i < currentArticles.length; i++) {
      if (!updatingRef.current) return;
      const a = currentArticles[i];
      if (a.type === 'wikibook') {
        setUpdateProgress({ current: i + 1, total: currentArticles.length, currentTitle: `${a.title} (book, skipped)`, updated, notFound, skipped });
        skipped++;
        continue;
      }
      let found = false;

      for (const lang of langOrder) {
        if (!updatingRef.current) return;
        try {
          setUpdateProgress({ current: i + 1, total: currentArticles.length, currentTitle: a.title, updated, notFound, skipped });
          const fetched = await importFromWikipedia([a.title], lang);
          if (fetched.length > 0 && fetched[0].content) {
            const idx = updatedArticles.findIndex(art => art.id === a.id);
            if (idx !== -1) {
              if (updatedArticles[idx].content === fetched[0].content) {
                skipped++;
              } else {
                updatedArticles[idx] = {
                  ...a,
                  content: fetched[0].content,
                  summary: fetched[0].summary,
                  citations: fetched[0].citations,
                  language: lang,
                  verification_status: 'verified',
                  confidence_score: 0.95,
                  updated_at: new Date().toISOString(),
                };
                updated++;
              }
            }
            found = true;
            break;
          }
        } catch (e) {
          console.error(`Update failed for ${a.title} in ${lang}:`, e);
        }
      }
      if (!found) notFound++;
    }

    if (updatingRef.current) {
      setArticles(updatedArticles);
      saveArticles(updatedArticles);
    }
    setUpdating(false);
    setUpdateProgress(null);
  };

  const handleFetchArticleContent = async (id: number, title: string) => {
    const imported = await importFromWikipedia([title], selectedLanguage);
    if (imported.length > 0 && imported[0].content) {
      const wi = imported[0];
      setArticles(prev => {
        const updated = prev.map(a =>
          a.id === id
            ? { ...a, content: wi.content, summary: wi.summary, citations: wi.citations, verification_status: 'verified' as const, confidence_score: 0.95, updated_at: new Date().toISOString() }
            : a
        );
        saveArticles(updated);
        return updated;
      });
    }
  };

  const handleEnhanceArticle = async (id: number) => {
    const article = articles.find(a => a.id === id);
    if (!article || !article.content) return;
    try {
      const enhanced = await enhanceArticle(article.content, article.title);
      if (enhanced.length < article.content.length * 0.8) {
        console.warn('Enhanced content too short, keeping original');
        return;
      }
      if (enhanced === article.content) {
        console.warn('Enhanced content unchanged, keeping original');
        return;
      }
      setArticles(prev => {
        const updated = prev.map(a =>
          a.id === id
            ? { ...a, content: enhanced, summary: enhanced.slice(0, 200) + (enhanced.length > 200 ? '...' : ''), updated_at: new Date().toISOString() }
            : a
        );
        saveArticles(updated);
        return updated;
      });
    } catch (e) {
      console.error('Enhance failed:', e);
      alert('Enhance failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const handleFileImport = (imported: Article[]) => {
    const existing = loadArticles();
    const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
    const filtered = imported.filter(a => !existingTitles.has(a.title.toLowerCase()));
    const merged = [...filtered, ...existing];
    setArticles(merged);
    saveArticles(merged);
  };

  const handleRefreshBook = async (id: number, title: string) => {
    const book = await importFromWikiBooks(title);
    if (book && book.content) {
      setArticles(prev => {
        const updated = prev.map(a =>
          a.id === id
            ? { ...a, content: book.content, summary: book.summary, citations: book.citations, chapters: book.chapters, verification_status: 'verified' as const, confidence_score: 0.95, updated_at: new Date().toISOString() }
            : a
        );
        saveArticles(updated);
        return updated;
      });
    }
  };

  const handleClearSyncQueue = async () => {
    try {
      await invoke('clear_sync_queue');
      setSyncQueueLength(0);
    } catch (e) {
      console.error('Clear queue failed:', e);
    }
  };

  const handleSaveSyncConfig = async (config: SyncConfig) => {
    try {
      await invoke('save_sync_config', { config });
      setSyncConfig(config);
    } catch (e) {
      console.error('Save sync config failed:', e);
    }
  };

  const handleGenerateBook = (title: string, content: string, chapters: { title: string; content: string }[], citations?: string) => {
    const article: Article = {
      id: Date.now(),
      title,
      type: 'wikibook',
      language: selectedLanguage,
      content,
      summary: `A multi-chapter book about ${title} with ${chapters.length} chapters.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'unverified',
      confidence_score: 0,
      citations: citations || null,
      chapters,
    };
    setArticles(prev => {
      const updated = [article, ...prev];
      saveArticles(updated);
      return updated;
    });
    setSelectedArticle(article);
  };

  const handleImportQueue = async (fetched: { title: string; content: string; pageid: number }[]) => {
    const newArticles: Article[] = fetched
      .filter(f => f.content && f.content.length > 50)
      .map(f => ({
      id: Date.now() + Math.random(),
      title: f.title,
      content: f.content,
      summary: f.content.slice(0, 200) + (f.content.length > 200 ? '...' : ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_status: 'verified' as const,
      confidence_score: 0.95,
      citations: f.pageid > 0
        ? JSON.stringify([{ source: 'Wikipedia', url: `https://en.wikipedia.org/?curid=${f.pageid}` }])
        : JSON.stringify([{ source: 'Imported', url: '' }]),
    }));
    const existing = loadArticles();
    const existingTitles = new Set(existing.map(a => a.title.toLowerCase()));
    const filtered = newArticles.filter(a => !existingTitles.has(a.title.toLowerCase()));
    const merged = [...filtered, ...existing];
    setArticles(merged);
    saveArticles(merged);
    try { await invoke('clear_sync_queue'); setSyncQueueLength(0); } catch (_) {}
  };

  const handleInboxDismiss = (i: number) => {
    setInboxItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleInboxSummarize = async (item: InboxItem) => {
    try {
      const summary = await invoke<string>('generate_summary', {
        articlesJson: `=== ${item.filename} ===\n${item.text.slice(0, 4000)}`
      });
      const article: Article = {
        id: Date.now() + Math.random(),
        title: `Inbox: ${item.filename.replace(/\.[^.]+$/, '')}`,
        content: summary,
        summary: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        verification_status: 'unverified',
        confidence_score: 0,
        citations: null,
      };
      setArticles(prev => {
        const updated = [article, ...prev];
        saveArticles(updated);
        return updated;
      });
      setSelectedArticle(article);
      setInboxItems(prev => prev.filter((_, idx) => idx !== 0));
    } catch (e) {
      console.error('Summarize failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ThemeToggle />
      
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5 10 5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <h1 className="text-2xl font-bold">AI Wikipedia</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <div className="flex items-center gap-0.5 mr-1 bg-blue-900/50 rounded-lg p-0.5">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => handleLanguageChange(l.code)}
                    className={`px-2 py-1.5 text-xs rounded-md transition-colors ${
                      selectedLanguage === l.code
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                    }`}
                    title={l.label}
                  >
                    {l.flag}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowGraph(!showGraph)}
                className="px-3 py-2 bg-indigo-700 rounded-lg hover:bg-indigo-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Map
              </button>
              <button onClick={() => setShowGenerateBook(true)}
                className="px-3 py-2 bg-rose-700 rounded-lg hover:bg-rose-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Book
              </button>
              <button onClick={() => setShowOracle(true)}
                className="px-3 py-2 bg-amber-700 rounded-lg hover:bg-amber-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Oracle
              </button>
              <button onClick={() => setShowDistill(true)}
                className="px-3 py-2 bg-emerald-700 rounded-lg hover:bg-emerald-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Distill
              </button>
              <button onClick={() => setShowStorage(true)}
                className="px-3 py-2 bg-purple-700 rounded-lg hover:bg-purple-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2v-10M2 12h14" />
                </svg>
                Storage
              </button>
              <button onClick={() => setShowSources(true)}
                className="px-3 py-2 bg-blue-700 rounded-lg hover:bg-blue-600 text-xs sm:text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 012.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 012.573 1.066c1.543.94 3.31-.826 2.37-2.37.996.608 2.296.07 2.572 1.066zM5.84 14.668a1.92 1.92 0 01.383 1.128l-2.36 7.072a1.92 1.92 0 01-3.648 1.28H3.6a1.92 1.92 0 01-.383-1.128l2.36-7.072a1.92 1.92 0 013.648-1.28h3.648z" />
                </svg>
                Sources
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8">
        {showGraph && (
          <div className="px-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Knowledge Map</h2>
              <button onClick={() => setShowGraph(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Close</button>
            </div>
            <GraphView articles={articles} onSelect={setSelectedArticle} />
          </div>
        )}
        {selectedArticle ? (
          <ArticleView key={selectedArticle.id}
            article={selectedArticle}
            onBack={() => setSelectedArticle(null)}
            verificationSources={verificationSources}
            onEdit={(article) => setEditingArticle(article)}
            onFetchMore={handleFetchMore}
            onDelete={handleDeleteArticle}
            onRefreshBook={handleRefreshBook}
            onEnhanceArticle={handleEnhanceArticle}
          />
        ) : (
          <ArticleList
            articles={articles}
            onSelect={setSelectedArticle}
            onImport={() => setShowImport(true)}
            onExport={() => setShowExport(true)}
            onGenerate={() => setShowGenerate(true)}
            onSaveArticle={handleGenerate}
            enabledSources={verificationSources}
            syncConfig={syncConfig}
            syncQueueLength={syncQueueLength}
            onTriggerSync={handleTriggerSync}
            onClearQueue={handleClearSyncQueue}
            onOpenSyncSettings={() => setShowSyncSettings(true)}
            onOpenQueueReview={() => setShowQueueReview(true)}
            inboxItems={inboxItems}
            onInboxDismiss={handleInboxDismiss}
            onInboxSummarize={handleInboxSummarize}
            emptyArticles={emptyArticles}
            onOpenEmptyArticles={() => setShowEmptyArticles(true)}
            selectedLanguage={selectedLanguage}
            onUpdateAll={handleUpdateAllArticles}
            updating={updating}
            updateProgress={updateProgress}
          />
        )}
      </main>

      <footer className="bg-gray-200 dark:bg-gray-800 py-6 text-center text-gray-600 dark:text-gray-400">
        <p>AI Wikipedia - Powered by Ollama & Multi Source Verification</p>
        <p className="text-sm mt-1">Data stored locally. Export to sync.</p>
      </footer>

      {showGenerate && (
        <GenerateModal onClose={() => { setShowGenerate(false); setOracleTopic(''); }} onGenerate={handleGenerate} articles={articles} enabledSources={verificationSources} initialTopic={oracleTopic || undefined} selectedLanguage={selectedLanguage} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} onWikiBooksImport={handleWikiBooksImport} onFileImport={handleFileImport} selectedLanguage={selectedLanguage} />
      )}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} articles={articles} />
      )}
      {showStorage && (
        <StorageModal onClose={() => setShowStorage(false)} articles={articles} />
      )}
      {editingArticle && (
        <EditArticleModal
          article={editingArticle}
          onClose={() => setEditingArticle(null)}
          onSave={handleEdit}
        />
      )}
      {showSources && (
        <SourcesModal
          sources={verificationSources}
          onClose={() => setShowSources(false)}
          onUpdate={(sources) => {
            setVerificationSources(sources);
            saveVerificationSources(sources);
          }}
        />
      )}
      {showSyncSettings && syncConfig && (
        <SyncSettingsModal
          config={syncConfig}
          onClose={() => setShowSyncSettings(false)}
          onSave={handleSaveSyncConfig}
          onTriggerSync={handleTriggerSync}
          queueLength={syncQueueLength}
          onClearQueue={handleClearSyncQueue}
        />
      )}
      {showQueueReview && (
        <QueueReviewModal
          onClose={() => setShowQueueReview(false)}
          onImport={handleImportQueue}
          onClearQueue={handleClearSyncQueue}
        />
      )}
      {showDistill && (
        <DistillModal
          articles={articles}
          onClose={() => setShowDistill(false)}
          onSave={handleGenerate}
        />
      )}
      {showOracle && (
        <OracleModal
          articles={articles}
          onClose={() => setShowOracle(false)}
          onSearchTopic={(topic) => { setOracleTopic(topic); setShowOracle(false); }}
        />
      )}
      {showGenerateBook && (
        <GenerateBookModal
          onClose={() => setShowGenerateBook(false)}
          onGenerate={handleGenerateBook}
          articles={articles}
          enabledSources={verificationSources}
          selectedLanguage={selectedLanguage}
        />
      )}
      {showEmptyArticles && (
        <EmptyArticlesModal
          articles={emptyArticles}
          onClose={() => setShowEmptyArticles(false)}
          onDelete={handleDeleteArticle}
          onDeleteAll={handleDeleteAllEmpty}
          onFetchContent={handleFetchArticleContent}
        />
      )}
    </div>
  );
}

export default App;
