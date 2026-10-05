import { useState, useEffect } from 'react';
import { Article } from '../types';
import { invoke } from '@tauri-apps/api/core';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function DistillModal({
  articles,
  onClose,
  onSave,
}: {
  articles: Article[];
  onClose: () => void;
  onSave: (title: string, content: string, citations?: string) => void;
}) {
  const [count, setCount] = useState(10);
  const [distilling, setDistilling] = useState(false);
  const [summary, setSummary] = useState('');
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!distilling) return;
    const interval = window.setInterval(() => {
      setSpinnerIdx(prev => (prev + 1) % SPINNER_FRAMES.length);
    }, 100);
    return () => clearInterval(interval);
  }, [distilling]);

  const recent = [...articles]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, count);

  const handleDistill = async () => {
    setDistilling(true);
    setError('');
    try {
      const input = recent.map(a =>
        `=== ${a.title} (${new Date(a.updated_at).toLocaleDateString()}) ===\n${a.content.slice(0, 2000)}`
      ).join('\n\n');
      const result = await invoke<string>('generate_summary', { articlesJson: input });
      setSummary(result);
    } catch (e) {
      setError(String(e));
    }
    setDistilling(false);
  };

  const handleSave = () => {
    if (summary) {
      const title = `Weekly Briefing — ${new Date().toLocaleDateString()}`;
      onSave(title, summary);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Weekly Distillation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Synthesize your recent articles into a cohesive weekly briefing using AI.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Last</span>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-sm text-gray-600 dark:text-gray-400">articles ({recent.length} available)</span>
        </div>

        {!summary && !distilling && (
          <button
            onClick={handleDistill}
            disabled={recent.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 self-start"
          >
            Generate Briefing
          </button>
        )}

        {distilling && (
          <div className="text-center py-8 text-purple-500">
            <span className="text-2xl">{SPINNER_FRAMES[spinnerIdx]}</span>
            <p className="mt-2">Distilling {recent.length} articles...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm mb-4">
            {error}
          </div>
        )}

        {summary && (
          <div className="flex-1 overflow-y-auto mb-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
              {summary}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          {summary && (
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Save as Article
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500">
            {summary ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
