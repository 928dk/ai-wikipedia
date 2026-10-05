import { useState, useMemo } from 'react';
import { Article, VerificationSourceConfig, VerificationResult } from '../types';
import { StatusBadge } from './StatusBadge';
import { extractClaims, verifyClaim } from '../utils/verification';

export function ArticleView({ article, onBack, verificationSources, onEdit, onFetchMore, onDelete, onRefreshBook, onEnhanceArticle }: {
  article: Article;
  onBack: () => void;
  verificationSources: VerificationSourceConfig[];
  onEdit: (article: Article) => void;
  onFetchMore: (title: string) => Promise<void>;
  onDelete?: (id: number) => void;
  onRefreshBook?: (id: number, title: string) => Promise<void>;
  onEnhanceArticle?: (id: number) => Promise<void>;
}) {
  const [showVerification, setShowVerification] = useState(false);
  const [verification, setVerification] = useState<{ claims: VerificationResult[]; overallConfidence: number; status: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [refreshingBook, setRefreshingBook] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const safeChapter = article.chapters ? Math.min(activeChapter, article.chapters.length - 1) : 0;
  const citations = useMemo(() => {
    try { return article.citations ? JSON.parse(article.citations) : []; }
    catch { return []; }
  }, [article.citations]);

  const handleVerify = async () => {
    setVerifying(true);
    const claims = extractClaims(article.content);
    const results = await Promise.all(claims.map(c => verifyClaim(c, verificationSources)));
    const verified = results.filter(r => r.status === 'verified').length;
    const disputed = results.filter(r => r.status === 'disputed').length;
    const confidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    let status = 'unverified';
    if (disputed > verified) status = 'disputed';
    else if (verified > claims.length / 2) status = 'verified';
    setVerification({ claims: results, overallConfidence: confidence, status });
    setShowVerification(true);
    setVerifying(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={onBack} className="mb-6 text-blue-600 hover:underline flex items-center gap-2">
        ← Back to Articles
      </button>
      
      <article className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{article.title}</h1>
            {article.summary && <p className="text-xl text-gray-600 dark:text-gray-400">{article.summary}</p>}
          </div>
          <StatusBadge status={article.verification_status} score={article.confidence_score} />
        </div>

        <div className="flex flex-wrap gap-4 mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify Claims'}
          </button>
          <button
            onClick={() => onEdit(article)}
            className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200"
          >
            Edit Article
          </button>
          {citations.length > 0 && (
            <a
              href={citations[0]?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
            >
              View Source
            </a>
          )}
          <button
            onClick={() => { setFetchingMore(true); onFetchMore(article.title).finally(() => setFetchingMore(false)); }}
            disabled={fetchingMore}
            className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 disabled:opacity-50"
          >
            {fetchingMore ? 'Fetching...' : 'Get More Content'}
          </button>
          {article.type === 'wikibook' && onRefreshBook && (
            <button
              onClick={() => { setRefreshingBook(true); onRefreshBook(article.id, article.title).finally(() => setRefreshingBook(false)); }}
              disabled={refreshingBook}
              className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
            >
              {refreshingBook ? 'Refreshing...' : 'Refresh from WikiBooks'}
            </button>
          )}
          {onEnhanceArticle && (
            <button
              onClick={() => { setEnhancing(true); onEnhanceArticle(article.id).finally(() => setEnhancing(false)); }}
              disabled={enhancing}
              className="px-4 py-2 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 disabled:opacity-50"
            >
              {enhancing ? 'Enhancing...' : 'Enhance with AI'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { if (window.confirm(`Delete "${article.title}"?`)) onDelete(article.id); }}
              className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200"
            >
              Delete
            </button>
          )}
        </div>

        {showVerification && verification && (
          <div className="mb-6 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200">
            <h3 className="text-lg font-semibold mb-4">Confidence Score Card</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {verification.claims.filter(c => c.status === 'verified').length}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Verified</div>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {verification.claims.filter(c => c.status === 'unverified' && c.sources.length > 0).length}
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">Inferred</div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {verification.claims.filter(c => c.status === 'disputed' || (c.status === 'unverified' && c.sources.length === 0)).length}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">Unverified</div>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                  style={{ width: `${Math.round(verification.overallConfidence * 100)}%` }} />
              </div>
              <span className="text-sm font-bold">{Math.round(verification.overallConfidence * 100)}%</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl font-bold">
                {verification.status === 'verified' && '✓ Verified'}
                {verification.status === 'disputed' && '? Disputed'}
                {verification.status === 'unverified' && '− Unverified'}
              </span>
              <span className="text-xs text-gray-500">per {verification.claims.length} claims checked</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {verification.claims.map((claim, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 text-sm"
                  style={{
                    borderLeftColor: claim.status === 'verified' ? '#22c55e' :
                      claim.status === 'disputed' ? '#ef4444' : '#eab308'
                  }}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="flex-1">"{claim.claim.slice(0, 120)}{claim.claim.length > 120 ? '...' : ''}"</p>
                    <span className="ml-2 text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded"
                      style={{
                        background: claim.status === 'verified' ? '#dcfce7' :
                          claim.status === 'disputed' ? '#fce7f3' : '#fef9c3',
                        color: claim.status === 'verified' ? '#16a34a' :
                          claim.status === 'disputed' ? '#dc2626' : '#ca8a04',
                      }}>
                      {claim.status === 'verified' ? 'VERIFIED' : claim.status === 'disputed' ? 'DISPUTED' : 'UNVERIFIED'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round(claim.confidence * 100)}% · {claim.sources.length} source{claim.sources.length !== 1 ? 's' : ''}
                    {claim.sources.filter(s => s.relevance > 0.3).slice(0, 2).map((s, i) => (
                      <span key={i}>
                        {' · '}
                        {s.verification_method === 'property_match' && <span className="text-green-500" title="WikiData property match">🧩</span>}
                        {s.verification_method === 'llm_judgment' && <span className="text-yellow-500" title="LLM judgment">🤖</span>}
                        {s.verification_method === 'keyword_overlap' && <span className="text-gray-400" title="Keyword correlation only">📊</span>}
                        {' '}
                        <a href={s.url} target="_blank" className="text-blue-500 hover:underline">
                          {s.property_label ? `${s.name} (${s.property_label})` : s.name}
                        </a>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {article.images && article.images.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {article.images.slice(0, 4).map((img, idx) => (
                <figure key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.alt || article.title}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  {img.caption && (
                    <figcaption className="p-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        {article.type === 'wikibook' && article.chapters && article.chapters.length > 0 ? (
          <div className="flex gap-6">
            <nav className="w-56 flex-shrink-0">
              <div className="sticky top-4 space-y-1 max-h-[70vh] overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2 px-3">Chapters</h3>
                {article.chapters.map((ch, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveChapter(idx)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      activeChapter === idx
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            </nav>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {article.chapters[safeChapter].title}
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                {article.chapters[safeChapter].content.split('\n').filter(line => line.trim()).map((p, idx) => <p key={idx} className="mb-4">{p}</p>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {article.content.split('\n').filter(line => line.trim()).map((p, idx) => <p key={idx} className="mb-4">{p}</p>)}
          </div>
        )}
      </article>
    </div>
  );
}
