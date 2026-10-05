import { Article } from '../types';
import { loadArticles, saveArticles } from '../utils/storage';

export function ExportModal({ onClose, articles }: { onClose: () => void; articles: Article[] }) {
  const exportJson = () => {
    const data = JSON.stringify({ articles, version: '1.0.0', exported: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-wikipedia-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const imported = data.articles || data;
        if (Array.isArray(imported)) {
          const existing = loadArticles();
          const existingIds = new Set(existing.map(a => a.id));
          const merged = [...existing, ...imported.filter((a: Article) => !existingIds.has(a.id))];
          saveArticles(merged);
          window.location.reload();
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Export / Sync</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export articles as JSON to sync with another device or backup. Copy the file to your USB and import on another computer.
        </p>
        <div className="space-y-4">
          <button
            onClick={exportJson}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export All ({articles.length} articles)
          </button>
          <label className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer text-center block">
            Import from JSON
            <input type="file" accept=".json" onChange={importJson} className="hidden" />
          </label>
          <p className="text-xs text-gray-500 text-center">
            Your data is stored locally. Export to sync across devices.
          </p>
        </div>
        <button onClick={onClose} className="w-full mt-4 px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Close</button>
      </div>
    </div>
  );
}
