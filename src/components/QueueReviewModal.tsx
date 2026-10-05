import { useState, useEffect } from 'react';
import { PendingArticle } from '../types/sync';
import { invoke } from '@tauri-apps/api/core';

interface FetchedArticle {
  title: string;
  content: string;
  pageid: number;
}

export function QueueReviewModal({
  onClose,
  onImport,
  onClearQueue,
}: {
  onClose: () => void;
  onImport: (articles: FetchedArticle[]) => void;
  onClearQueue: () => void;
}) {
  const [queue, setQueue] = useState<PendingArticle[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<FetchedArticle | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    invoke<PendingArticle[]>('get_sync_queue').then(setQueue).catch(() => {});
  }, []);

  useEffect(() => {
    if (queue.length > 0 && selected.size === 0) {
      setSelected(new Set(queue.map(a => a.title)));
    }
  }, [queue]);

  const toggleSelect = (title: string) => {
    const next = new Set(selected);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === queue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map(a => a.title)));
    }
  };

  const handlePreview = async (title: string) => {
    if (preview?.title === title) return;
    setPreviewLoading(true);
    try {
      const articles = await invoke<FetchedArticle[]>('fetch_wikipedia_articles', { titles: [title] });
      setPreview(articles[0] || null);
    } catch (e) {
      console.error('Preview fetch failed:', e);
      setPreview(null);
    }
    setPreviewLoading(false);
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const selectedItems = queue.filter(a => selected.has(a.title));
      const wikiTitles = selectedItems.filter(a => a.source === 'news' || a.source === 'random').map(a => a.title);
      const lexItems = selectedItems.filter(a => a.source === 'lex');
      const wbItems = selectedItems.filter(a => a.source === 'wikibooks');
      const allArticles: FetchedArticle[] = [];
      if (wikiTitles.length > 0) {
        const articles = await invoke<FetchedArticle[]>('fetch_wikipedia_articles', { titles: wikiTitles });
        allArticles.push(...articles);
      }
      for (const item of lexItems) {
        try {
          const { importFromLexDk } = await import('../utils/importExport');
          const a = await importFromLexDk(item.title);
          if (a) allArticles.push({ title: a.title, content: a.content, pageid: 0 });
        } catch (e) { console.error('Lex.dk import failed:', e); }
      }
      for (const item of wbItems) {
        try {
          const { importFromWikiBooks } = await import('../utils/importExport');
          const a = await importFromWikiBooks(item.title);
          if (a) allArticles.push({ title: a.title, content: a.content, pageid: 0 });
        } catch (e) { console.error('WikiBooks import failed:', e); }
      }
      onImport(allArticles);
    } catch (e) {
      console.error('Import failed:', e);
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Review Sync Queue ({queue.length} article{queue.length !== 1 ? 's' : ''})
        </h2>

        {queue.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-4">Queue is empty.</p>
        ) : (
          <div className="flex gap-4 flex-1 min-h-0">
            <div className="flex flex-col w-1/3 min-w-0">
              <div className="flex items-center gap-2 mb-3 text-sm">
                <label className="flex items-center gap-1 text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === queue.length && queue.length > 0}
                    onChange={selectAll}
                  />
                  Select all
                </label>
                <span className="text-gray-400">({selected.size} selected)</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded p-1">
                {queue.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => handlePreview(item.title)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.title)}
                      onChange={() => toggleSelect(item.title)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm truncate block ${preview?.title === item.title ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-900 dark:text-white'}`}>
                        {item.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.source === 'news' ? '📰 News' : item.source === 'lex' ? '📖 Lex.dk' : item.source === 'wikibooks' ? '📘 WikiBooks' : '🎲 Random'} · {new Date(item.fetched_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-2/3 border border-gray-200 dark:border-gray-700 rounded p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading preview...
                </div>
              ) : preview ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{preview.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                    {preview.content.length > 3000 ? preview.content.slice(0, 3000) + '...' : preview.content}
                  </p>
                  {preview.content.length > 3000 && (
                    <p className="text-xs text-gray-400 mt-2">Showing first 3000 characters</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Click an article to preview
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
          <button
            onClick={() => { handleImport(); onClose(); }}
            disabled={selected.size === 0 || importing}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : `Import Selected (${selected.size})`}
          </button>
          <button
            onClick={() => { onClearQueue(); onClose(); }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
