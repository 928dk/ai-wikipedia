import { useState, useEffect, useRef } from 'react';
import { CompressionType, StorageStats } from '../types';
import { getStorageStats, compressAndSaveWikipedia, formatBytes } from '../utils/compression';
import { Article } from '../types';

function getWeek(d: string) {
  const date = new Date(d);
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return `${date.getFullYear()}-W${String(Math.ceil((days + start.getDay() + 1) / 7)).padStart(2, '0')}`;
}

export function StorageModal({ onClose, articles }: { onClose: () => void; articles: Article[] }) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [compression, setCompression] = useState<CompressionType>('lz4');
  const [message, setMessage] = useState('');
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!chartRef.current || articles.length === 0) return;
    const weeks: Record<string, number> = {};
    for (const a of articles) {
      const w = getWeek(a.created_at || a.updated_at);
      weeks[w] = (weeks[w] || 0) + 1;
    }
    const sorted = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) return;

    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = 160;
    const ml = 40, mr = 10, mt = 10, mb = 24;
    const cw = w - ml - mr, ch = h - mt - mb;
    const mx = Math.max(...sorted.map(([, v]) => v)) * 1.1 || 1;
    const n = sorted.length;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, w, h);

    const barW = Math.min(24, (cw - (n - 1) * 3) / n);
    for (let i = 0; i < n; i++) {
      const bh = (sorted[i][1] / mx) * ch;
      const x = ml + i * (barW + 3);
      const y = mt + ch - bh;
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(x, y, barW, bh);
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sorted[i][0].slice(-5), x + barW / 2, mt + ch + 14);
    }
  }, [articles, stats]);

  const loadStats = async () => {
    const s = await getStorageStats();
    setStats(s);
  };

  const handleCompress = async () => {
    setLoading(true);
    setMessage('Compressing articles...');
    try {
      const result = await compressAndSaveWikipedia(articles, compression);
      setMessage(`Saved ${result.saved} articles. Original: ${formatBytes(result.original)}, Compressed: ${formatBytes(result.compressed)} (${(result.compressed / result.original * 100).toFixed(1)}%)`);
      await loadStats();
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
    setLoading(false);
  };

  const totalRaw = articles.reduce((acc, a) => acc + a.content.length, 0);
  const wikibooks = articles.filter(a => a.type === 'wikibook');
  const byLang: Record<string, number> = {};
  for (const a of articles) {
    const l = a.language || 'en';
    byLang[l] = (byLang[l] || 0) + 1;
  }
  const byStatus: Record<string, number> = {};
  for (const a of articles) {
    const s = a.verification_status || 'unverified';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const avgLen = articles.length ? Math.round(totalRaw / articles.length) : 0;
  const sortedByLen = [...articles].sort((a, b) => b.content.length - a.content.length);
  const longest = sortedByLen[0];
  const shortest = sortedByLen[sortedByLen.length - 1];
  const healthIssues: { title: string; issue: string }[] = [];
  for (const a of articles) {
    if (!a.content || a.content.length < 50) healthIssues.push({ title: a.title, issue: 'Very short or empty' });
    else if (a.content.length < 200) healthIssues.push({ title: a.title, issue: 'Short content' });
    if (!a.citations || a.citations === '[]') healthIssues.push({ title: a.title, issue: 'No citations' });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Wikipedia Storage</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Overview cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{articles.length}</div>
              <div className="text-xs text-gray-500">Total Articles</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{formatBytes(totalRaw)}</div>
              <div className="text-xs text-gray-500">Raw Text</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">{wikibooks.length}</div>
              <div className="text-xs text-gray-500">Books ({articles.length - wikibooks.length} articles)</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{Object.keys(byLang).length}</div>
              <div className="text-xs text-gray-500">Languages</div>
            </div>
          </div>

          {/* Content stats */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Content Statistics</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-500">Average length:</span>
              <span className="font-medium">{formatBytes(avgLen)}</span>
              <span className="text-gray-500">Longest:</span>
              <span className="font-medium truncate" title={longest?.title}>{longest?.title} ({formatBytes(longest?.content.length || 0)})</span>
              <span className="text-gray-500">Shortest:</span>
              <span className="font-medium truncate" title={shortest?.title}>{shortest?.title} ({formatBytes(shortest?.content.length || 0)})</span>
            </div>
          </div>

          {/* Language breakdown */}
          {Object.keys(byLang).length > 0 && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">By Language</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-h-32 overflow-y-auto">
                {Object.entries(byLang).sort(([, a], [, b]) => b - a).map(([lang, count]) => (
                  <div key={lang} className="flex justify-between">
                    <span className="text-gray-500">{lang}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification breakdown */}
          {Object.keys(byStatus).length > 0 && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Verification Status</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center bg-green-50 dark:bg-green-900/30 rounded p-2">
                  <div className="text-lg font-bold text-green-600">{byStatus.verified || 0}</div>
                  <div className="text-xs text-gray-500">Verified</div>
                </div>
                <div className="text-center bg-yellow-50 dark:bg-yellow-900/30 rounded p-2">
                  <div className="text-lg font-bold text-yellow-600">{byStatus.unverified || 0}</div>
                  <div className="text-xs text-gray-500">Unverified</div>
                </div>
                <div className="text-center bg-red-50 dark:bg-red-900/30 rounded p-2">
                  <div className="text-lg font-bold text-red-600">{byStatus.disputed || 0}</div>
                  <div className="text-xs text-gray-500">Disputed</div>
                </div>
              </div>
            </div>
          )}

          {/* Health issues */}
          {healthIssues.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-red-700 dark:text-red-400">Health Issues ({healthIssues.length})</h3>
              <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                {healthIssues.map((h, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{h.title}</span>
                    <span className="text-red-500 ml-2 whitespace-nowrap">{h.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline chart */}
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">Creation Timeline (weekly)</h3>
            <canvas ref={chartRef} className="w-full h-20 rounded" />
          </div>

          {/* Compressed storage */}
          {stats && stats.file_count > 0 && (
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">Compressed Storage</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Chunks:</span>
                  <span className="ml-2 font-medium">{stats.file_count}</span>
                </div>
                <div>
                  <span className="text-gray-500">Original:</span>
                  <span className="ml-2 font-medium">{formatBytes(stats.total_original)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Compressed:</span>
                  <span className="ml-2 font-medium text-green-600">{formatBytes(stats.total_compressed)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Ratio:</span>
                  <span className="ml-2 font-medium">{(stats.compression_ratio * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Compression action */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Compression Algorithm
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="compression"
                  value="lz4"
                  checked={compression === 'lz4'}
                  onChange={() => setCompression('lz4')}
                  className="mr-2"
                />
                <span className="text-sm">LZ4</span>
                <span className="ml-2 text-xs text-gray-500">(fastest, ~40% size)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="compression"
                  value="zstd"
                  checked={compression === 'zstd'}
                  onChange={() => setCompression('zstd')}
                  className="mr-2"
                />
                <span className="text-sm">Zstd</span>
                <span className="ml-2 text-xs text-gray-500">(better ratio, ~35% size)</span>
              </label>
            </div>
          </div>

          {message && (
            <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCompress}
              disabled={loading || articles.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Save to Compressed Storage'}
            </button>
            {stats && stats.file_count > 0 && (
              <button
                disabled={true}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg cursor-not-allowed"
              >
                Export (unavailable)
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center">
            Compressed storage splits articles into chunks for efficient access.
            Wikipedia (~16GB) compresses to ~6GB with LZ4, ~4-5GB with Zstd.
          </p>
        </div>

        <button onClick={onClose} className="w-full mt-4 px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg">
          Close
        </button>
      </div>
    </div>
  );
}
