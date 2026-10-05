import { useState, useEffect } from 'react';
import { Article, VerificationSourceConfig, Language, LANGUAGES } from '../types';
import { StatusBadge } from './StatusBadge';
import { InboxNotification } from './InboxNotification';
import { ChatInterface } from './ChatInterface';

import { SyncConfig } from '../types/sync';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface InboxItem { filename: string; text: string; format: string; }

export function ArticleList({ articles, onSelect, onImport, onExport, onGenerate, onSaveArticle, enabledSources, syncConfig, syncQueueLength, onTriggerSync, onClearQueue, onOpenSyncSettings, onOpenQueueReview, inboxItems, onInboxDismiss, onInboxSummarize, emptyArticles, onOpenEmptyArticles, selectedLanguage, onUpdateAll, updating, updateProgress }: {
  articles: Article[];
  onSelect: (article: Article) => void;
  onImport: () => void;
  onExport: () => void;
  onGenerate: () => void;
  onSaveArticle: (title: string, content: string) => void;
  enabledSources: VerificationSourceConfig[];
  syncConfig: SyncConfig | null;
  syncQueueLength: number;
  onTriggerSync: () => void;
  onClearQueue: () => void;
  onOpenSyncSettings: () => void;
  onOpenQueueReview: () => void;
  inboxItems: InboxItem[];
  onInboxDismiss: (i: number) => void;
  onInboxSummarize: (item: InboxItem) => void;
  emptyArticles: Article[];
  onOpenEmptyArticles: () => void;
  selectedLanguage: Language;
  onUpdateAll: () => void;
  updating: boolean;
  updateProgress: { current: number; total: number; currentTitle: string; updated: number; notFound: number; skipped: number } | null;
}) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'confidence'>('newest');
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    let interval: number | undefined;
    if (updating) {
      interval = window.setInterval(() => setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length), 100);
    }
    return () => { if (interval !== undefined) clearInterval(interval); };
  }, [updating]);

  const sorted = [...articles].sort((a, b) => {
    switch (sortBy) {
      case 'oldest': return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      case 'title': return a.title.localeCompare(b.title);
      case 'confidence': return (b.confidence_score || 0) - (a.confidence_score || 0);
      default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
  });

  const filtered = sorted.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.summary?.toLowerCase().includes(search.toLowerCase());
    const langMatch = !a.language || a.language === selectedLanguage;
    return matchesSearch && langMatch;
  });

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button onClick={onGenerate} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          + Generate with AI
        </button>
        <button onClick={onImport} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          Import Article
        </button>
        <button onClick={onExport} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Export / Sync
        </button>
        <button onClick={onUpdateAll} disabled={updating || articles.length === 0}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
          {updating ? `${SPINNER_FRAMES[spinnerIdx]} Updating...` : 'Update All'}
        </button>
      </div>

      {updating && updateProgress && (
        <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
          <p className="text-sm text-teal-700 dark:text-teal-300">
            {SPINNER_FRAMES[spinnerIdx]} Updating {updateProgress.current}/{updateProgress.total} — {updateProgress.currentTitle}
          </p>
          <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
            {updateProgress.updated} updated · {updateProgress.skipped} unchanged · {updateProgress.notFound} not found
          </p>
        </div>
      )}

      {syncConfig && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>
              Nightly sync: {syncConfig.enabled ? 'Enabled' : 'Disabled'}
              {syncConfig.last_sync && ` · Last: ${new Date(syncConfig.last_sync).toLocaleDateString()}`}
              {syncQueueLength > 0 && ` · ${syncQueueLength} article${syncQueueLength > 1 ? 's' : ''} in queue`}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={onTriggerSync} title="Trigger one sync cycle now"
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">
              Sync Now
            </button>
            <button onClick={onOpenSyncSettings} title="Configure nightly sync settings"
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700">
              Settings
            </button>
            {emptyArticles.length > 0 && (
              <button onClick={onOpenEmptyArticles} title="Find articles with missing or empty content"
                className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">
                Fill Out ({emptyArticles.length})
              </button>
            )}
            {syncQueueLength > 0 && (
              <>
                <button onClick={onOpenQueueReview} title="Review and import pending articles from queue"
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                  Review ({syncQueueLength})
                </button>
                <button onClick={onClearQueue} title="Clear all pending articles from queue"
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {inboxItems.length > 0 && (
        <InboxNotification items={inboxItems} onDismiss={onInboxDismiss} onSummarize={onInboxSummarize} />
      )}

      <div className="mb-8">
        <ChatInterface onSaveArticle={onSaveArticle} articles={articles} enabledSources={enabledSources}
          syncConfig={syncConfig} syncQueueLength={syncQueueLength} selectedLanguage={selectedLanguage} />
      </div>

      {filtered.length === 0 && search && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          No articles found for &quot;{search}&quot;
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-lg ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title="Card view"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title A-Z</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </div>

      {filtered.length > 0 && viewMode === 'card' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <div
              key={article.id}
              onClick={() => onSelect(article)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {article.type === 'wikibook' && <span className="mr-1">📘</span>}
                {article.title}
                {article.type === 'wikibook' && <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">Book</span>}
                {article.language && article.language !== selectedLanguage && (
                  <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                    {LANGUAGES.find(l => l.code === article.language)?.flag}
                  </span>
                )}
              </h3>
              {article.summary && (
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3">{article.summary}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <StatusBadge status={article.verification_status} score={article.confidence_score} />
                <span className="text-gray-500">{new Date(article.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && viewMode === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Confidence</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => onSelect(article)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {article.type === 'wikibook' && <span className="mr-1">📘</span>}
                      {article.title}
                      {article.type === 'wikibook' && <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">Book</span>}
                    </div>
                    {article.summary && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md mt-0.5">{article.summary}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <StatusBadge status={article.verification_status} score={article.confidence_score} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((article.confidence_score || 0) * 100)}%`,
                            background: article.confidence_score > 0.7 ? '#22c55e' : article.confidence_score > 0.3 ? '#eab308' : '#ef4444'
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round((article.confidence_score || 0) * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">{new Date(article.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
